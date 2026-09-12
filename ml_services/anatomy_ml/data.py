"""Manifest validation and TensorFlow pipelines for anatomy-gate training."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image, UnidentifiedImageError

from . import CLASS_NAMES


REQUIRED_COLUMNS = {"path", "label", "group_id", "source", "split"}
ALLOWED_SPLITS = {"train", "validation", "test"}
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}


def decoded_pixel_hash(path: Path) -> str:
    with Image.open(path) as image:
        pixels = np.asarray(image.convert("RGB"), dtype=np.uint8)
    digest = hashlib.sha256()
    digest.update(str(pixels.shape).encode("ascii"))
    digest.update(pixels.tobytes())
    return digest.hexdigest()


def load_and_audit_manifest(path: Path) -> tuple[pd.DataFrame, dict[str, object]]:
    manifest_path = path.resolve()
    table = pd.read_csv(manifest_path, dtype=str).fillna("")
    missing_columns = REQUIRED_COLUMNS - set(table.columns)
    if missing_columns:
        raise RuntimeError(f"Manifest is missing columns: {sorted(missing_columns)}")
    if table.empty:
        raise RuntimeError("Anatomy manifest is empty")

    table = table[list(sorted(REQUIRED_COLUMNS))].copy()
    table["label"] = table["label"].str.strip().str.lower()
    table["split"] = table["split"].str.strip().str.lower()
    table["group_id"] = table["group_id"].str.strip()
    table["source"] = table["source"].str.strip()
    unknown_labels = set(table["label"]) - set(CLASS_NAMES)
    unknown_splits = set(table["split"]) - ALLOWED_SPLITS
    if unknown_labels:
        raise RuntimeError(f"Manifest contains unknown labels: {sorted(unknown_labels)}")
    if unknown_splits:
        raise RuntimeError(f"Manifest contains unknown splits: {sorted(unknown_splits)}")
    if (table["group_id"] == "").any() or (table["source"] == "").any():
        raise RuntimeError("Every record requires non-empty group_id and source values")

    def resolve_path(value: str) -> str:
        candidate = Path(value)
        if not candidate.is_absolute():
            candidate = manifest_path.parent / candidate
        return str(candidate.resolve())

    table["path"] = table["path"].map(resolve_path)
    invalid_paths = []
    hashes = []
    for value in table["path"]:
        image_path = Path(value)
        if not image_path.is_file() or image_path.suffix.lower() not in IMAGE_SUFFIXES:
            invalid_paths.append(value)
            hashes.append("")
            continue
        try:
            hashes.append(decoded_pixel_hash(image_path))
        except (OSError, UnidentifiedImageError):
            invalid_paths.append(value)
            hashes.append("")
    if invalid_paths:
        raise RuntimeError(
            f"Manifest contains {len(invalid_paths)} missing or invalid images; "
            f"first invalid path: {invalid_paths[0]}"
        )
    table["content_hash"] = hashes

    group_split_counts = table.groupby("group_id")["split"].nunique()
    leaking_groups = group_split_counts[group_split_counts > 1]
    if not leaking_groups.empty:
        raise RuntimeError(
            f"Found {len(leaking_groups)} group_id values crossing data splits"
        )
    group_label_counts = table.groupby("group_id")["label"].nunique()
    conflicting_groups = group_label_counts[group_label_counts > 1]
    if not conflicting_groups.empty:
        raise RuntimeError(
            f"Found {len(conflicting_groups)} group_id values with conflicting anatomy labels"
        )
    hash_label_counts = table.groupby("content_hash")["label"].nunique()
    conflicting = hash_label_counts[hash_label_counts > 1]
    if not conflicting.empty:
        raise RuntimeError(
            f"Found {len(conflicting)} exact images with conflicting anatomy labels"
        )
    hash_split_counts = table.groupby("content_hash")["split"].nunique()
    duplicate_leakage = hash_split_counts[hash_split_counts > 1]
    if not duplicate_leakage.empty:
        raise RuntimeError(
            f"Found {len(duplicate_leakage)} exact images crossing data splits"
        )

    table = table.drop_duplicates("content_hash", keep="first").reset_index(drop=True)
    for split in sorted(ALLOWED_SPLITS):
        present = set(table.loc[table["split"] == split, "label"])
        missing = set(CLASS_NAMES) - present
        if missing:
            raise RuntimeError(f"Split {split!r} is missing classes: {sorted(missing)}")

    source_counts = (
        table.groupby(["split", "label", "source"]).size().rename("count").reset_index()
    )
    audit = {
        "manifest_path": str(manifest_path),
        "sample_count": int(len(table)),
        "split_counts": {
            split: {
                label: int(count)
                for label, count in values.items()
            }
            for split, values in table.groupby("split")["label"].value_counts().unstack(fill_value=0).iterrows()
        },
        "source_counts": source_counts.to_dict(orient="records"),
        "group_count": int(table["group_id"].nunique()),
        "exact_duplicates_removed": int(len(hashes) - len(table)),
        "group_leakage": 0,
        "exact_duplicate_leakage": 0,
        "single_source_labels": [
            label
            for label in CLASS_NAMES
            if table.loc[table["label"] == label, "source"].nunique() < 2
        ],
        "source_warning": (
            "Every label should contain multiple independent sources so the gate "
            "cannot solve anatomy by recognizing a dataset."
        ),
    }
    return table, audit


def save_audited_manifest(
    manifest: pd.DataFrame, audit: dict[str, object], output_dir: Path
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest.to_csv(output_dir / "manifest.csv", index=False)
    (output_dir / "dataset_audit.json").write_text(
        json.dumps(audit, indent=2, sort_keys=True), encoding="utf-8"
    )


def tensorflow_dataset(
    manifest: pd.DataFrame,
    split: str,
    *,
    image_size: int,
    batch_size: int,
    seed: int,
    training: bool,
):
    import tensorflow as tf

    subset = manifest.loc[manifest["split"] == split]
    paths = subset["path"].astype(str).to_numpy()
    label_lookup = {name: index for index, name in enumerate(CLASS_NAMES)}
    labels = subset["label"].map(label_lookup).astype(np.int32).to_numpy()
    dataset = tf.data.Dataset.from_tensor_slices((paths, labels))

    def load_image(path, label):
        contents = tf.io.read_file(path)
        image = tf.io.decode_image(contents, channels=3, expand_animations=False)
        image.set_shape((None, None, 3))
        image = tf.image.resize_with_pad(image, image_size, image_size, antialias=True)
        image = tf.cast(image, tf.float32) / 255.0
        return image, label

    if training:
        dataset = dataset.shuffle(len(subset), seed=seed, reshuffle_each_iteration=True)
    dataset = dataset.map(load_image, num_parallel_calls=tf.data.AUTOTUNE)
    return dataset.batch(batch_size).prefetch(tf.data.AUTOTUNE)
