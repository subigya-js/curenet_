"""Dataset discovery, auditing, splitting, and TensorFlow input pipelines."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image, UnidentifiedImageError
from sklearn.model_selection import train_test_split

from . import CLASS_NAMES

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}
EXCLUDED_PATH_TOKENS = {"mask", "masks", "overlay", "overlays"}
LABEL_ALIASES = {
    "normal": "no_stroke",
    "no_stroke": "no_stroke",
    "non_stroke": "no_stroke",
    "stroke_yok": "no_stroke",
    "inme_yok": "no_stroke",
    "ischemia": "ischemic_stroke",
    "ischemic": "ischemic_stroke",
    "iskemi": "ischemic_stroke",
    "hemorrhage": "hemorrhagic_stroke",
    "hemorrhagic": "hemorrhagic_stroke",
    "bleeding": "hemorrhagic_stroke",
    "hemorajik": "hemorrhagic_stroke",
}


def load_external_binary_labels(dataset_root: Path) -> dict[str, int]:
    """Load the packaged external-set stroke labels keyed by image stem."""
    candidates = [
        path
        for path in dataset_root.rglob("*.csv")
        if "external" in normalized_token(str(path.relative_to(dataset_root)))
    ]
    if not candidates:
        return {}
    if len(candidates) > 1:
        raise RuntimeError(f"Found multiple external label CSV files: {candidates}")
    table = pd.read_csv(candidates[0], dtype=str)
    required = {"image_id", "Stroke"}
    if not required.issubset(table.columns):
        raise RuntimeError(
            f"External labels must contain {sorted(required)}, got {list(table.columns)}"
        )
    labels: dict[str, int] = {}
    for row in table.itertuples(index=False):
        image_id = str(getattr(row, "image_id")).strip()
        value = int(str(getattr(row, "Stroke")).strip())
        if value not in {0, 1}:
            raise RuntimeError(f"Invalid external Stroke label {value} for {image_id}")
        labels[image_id] = value
    return labels


def normalized_token(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", ascii_value.lower()).strip("_")


def infer_label(path: Path) -> str | None:
    tokens = [normalized_token(part) for part in path.parts]
    for token in reversed(tokens):
        for alias, label in LABEL_ALIASES.items():
            if alias == token or f"_{alias}_" in f"_{token}_":
                return label
    return None


def is_external_path(path: Path) -> bool:
    return any("external" in normalized_token(part) for part in path.parts)


def content_fingerprint(path: Path) -> str:
    """Hash decoded pixels so byte-level re-encodings remain exact duplicates."""
    with Image.open(path) as image:
        pixels = np.asarray(image.convert("RGB"), dtype=np.uint8)
    digest = hashlib.sha256()
    digest.update(str(pixels.shape).encode("ascii"))
    digest.update(pixels.tobytes())
    return digest.hexdigest()


def build_manifest(dataset_root: Path) -> tuple[pd.DataFrame, dict[str, object]]:
    records: list[dict[str, object]] = []
    skipped = Counter()
    external_labels = load_external_binary_labels(dataset_root)

    for path in sorted(dataset_root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in IMAGE_SUFFIXES:
            continue
        path_tokens = {normalized_token(part) for part in path.parts}
        if any(
            excluded in token
            for token in path_tokens
            for excluded in EXCLUDED_PATH_TOKENS
        ):
            skipped["mask_or_overlay"] += 1
            continue
        relative_path = path.relative_to(dataset_root)
        external = is_external_path(relative_path)
        label = infer_label(relative_path)
        binary_stroke: int | None = None
        if external and normalized_token(path.parent.name) == "png":
            binary_stroke = external_labels.get(path.stem)
            if binary_stroke is not None:
                label = "external_stroke" if binary_stroke else "external_no_stroke"
        if label is None:
            skipped["unlabelled"] += 1
            continue
        try:
            with Image.open(path) as image:
                image.verify()
            fingerprint = content_fingerprint(path)
        except (OSError, UnidentifiedImageError):
            skipped["invalid_image"] += 1
            continue
        records.append(
            {
                "path": str(path.resolve()),
                "label": label,
                "label_id": CLASS_NAMES.index(label) if label in CLASS_NAMES else -1,
                "binary_stroke": binary_stroke if external else int(label != "no_stroke"),
                "duplicate_group": fingerprint,
                "external": external,
            }
        )

    manifest = pd.DataFrame.from_records(records)
    if manifest.empty:
        raise RuntimeError(f"No labelled source images found under {dataset_root}")

    development = manifest.loc[~manifest["external"]]
    conflicting = development.groupby("duplicate_group")["label"].nunique()
    conflicting = conflicting[conflicting > 1]
    if not conflicting.empty:
        raise RuntimeError(
            f"Found {len(conflicting)} perceptual duplicates with conflicting labels"
        )

    before = len(manifest)
    development_before = int((~manifest["external"]).sum())
    external_before = int(manifest["external"].sum())
    cross_partition_duplicates = int(
        manifest.groupby("duplicate_group")["external"].nunique().gt(1).sum()
    )
    manifest = manifest.sort_values("external")
    manifest = manifest.drop_duplicates("duplicate_group", keep="first").reset_index(drop=True)
    development = manifest.loc[~manifest["external"]]
    external = manifest.loc[manifest["external"]]
    audit = {
        "dataset_root": str(dataset_root.resolve()),
        "source_images": before,
        "unique_images": len(manifest),
        "duplicates_removed": before - len(manifest),
        "development_source_images": development_before,
        "development_unique_images": int(len(development)),
        "external_source_images": external_before,
        "cross_partition_duplicate_groups": cross_partition_duplicates,
        "class_counts": development["label"].value_counts().sort_index().to_dict(),
        "external_images": int(len(external)),
        "external_binary_counts": {
            str(label): int(count)
            for label, count in external["binary_stroke"].value_counts().sort_index().items()
        },
        "skipped": dict(skipped),
        "patient_identifiers_available": False,
        "split_warning": (
            "The public packaging does not expose patient identifiers. Metrics are "
            "slice-level and must not be described as patient-level performance."
        ),
    }
    return manifest, audit


def assign_splits(
    manifest: pd.DataFrame,
    *,
    seed: int,
    test_fraction: float,
    validation_fraction: float,
) -> pd.DataFrame:
    result = manifest.copy()
    result["split"] = ""
    external_mask = result["external"].astype(bool)
    result.loc[external_mask, "split"] = "external_test"

    development = result.loc[~external_mask]
    if development.empty:
        raise RuntimeError("No development images remain after selecting external data")

    train_val_index, test_index = train_test_split(
        development.index,
        test_size=test_fraction,
        random_state=seed,
        stratify=development["label_id"],
    )
    result.loc[test_index, "split"] = "test"

    relative_validation = validation_fraction / (1.0 - test_fraction)
    train_index, validation_index = train_test_split(
        train_val_index,
        test_size=relative_validation,
        random_state=seed,
        stratify=result.loc[train_val_index, "label_id"],
    )
    result.loc[train_index, "split"] = "train"
    result.loc[validation_index, "split"] = "validation"

    if (result["split"] == "").any():
        raise RuntimeError("Some dataset records were not assigned to a split")
    return result


def save_manifest(
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
    labels = subset["label_id"].astype(np.int32).to_numpy()
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
