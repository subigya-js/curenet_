"""Train, evaluate, and export the CureNet stroke CT model."""

from __future__ import annotations

import argparse
import json
import os
import random
from pathlib import Path

import numpy as np
from sklearn.utils.class_weight import compute_class_weight

from . import CLASS_NAMES
from .config import StrokeConfig
from .data import (
    assign_splits,
    build_manifest,
    save_manifest,
    tensorflow_dataset,
)
from .metrics import evaluate_and_save, evaluate_external_binary_and_save
from .model import build_model, enable_fine_tuning


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-root", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("artifacts/stroke_ct_v2"))
    parser.add_argument("--quick-check", action="store_true")
    return parser.parse_args()


def download_dataset(dataset_name: str) -> Path:
    import kagglehub

    return Path(kagglehub.dataset_download(dataset_name))


def callbacks(
    output_dir: Path,
    *,
    append_history: bool,
    initial_value_threshold: float | None = None,
):
    from tensorflow import keras

    return [
        keras.callbacks.ModelCheckpoint(
            output_dir / "best_model.keras",
            monitor="val_loss",
            save_best_only=True,
            initial_value_threshold=initial_value_threshold,
        ),
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=4, restore_best_weights=True
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.25, patience=2, min_lr=1e-7
        ),
        keras.callbacks.CSVLogger(
            output_dir / "training_history.csv", append=append_history
        ),
    ]


def main() -> None:
    args = parse_args()
    config = StrokeConfig()
    os.environ["PYTHONHASHSEED"] = str(config.seed)
    random.seed(config.seed)
    np.random.seed(config.seed)

    import tensorflow as tf
    from tensorflow import keras

    tf.random.set_seed(config.seed)
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    dataset_root = args.dataset_root or download_dataset(config.kaggle_dataset)

    manifest, audit = build_manifest(dataset_root)
    manifest = assign_splits(
        manifest,
        seed=config.seed,
        test_fraction=config.test_fraction,
        validation_fraction=config.validation_fraction,
    )
    split_table = manifest.groupby(["split", "label"]).size().unstack(fill_value=0)
    audit["split_counts"] = {
        split: {label: int(count) for label, count in counts.items()}
        for split, counts in split_table.iterrows()
    }
    save_manifest(manifest, audit, output_dir)

    if args.quick_check:
        manifest = (
            manifest.groupby(["split", "label"], group_keys=False)
            .head(8)
            .reset_index(drop=True)
        )

    datasets = {
        split: tensorflow_dataset(
            manifest,
            split,
            image_size=config.image_size,
            batch_size=config.batch_size,
            seed=config.seed,
            training=split == "train",
        )
        for split in ("train", "validation", "test")
    }
    for split in ("train", "validation", "test"):
        present = set(manifest.loc[manifest["split"] == split, "label"])
        missing = set(CLASS_NAMES) - present
        if missing:
            raise RuntimeError(f"Split {split!r} is missing classes: {sorted(missing)}")
    train_rows = manifest.loc[manifest["split"] == "train"]
    weights = compute_class_weight(
        class_weight="balanced",
        classes=np.arange(len(CLASS_NAMES)),
        y=train_rows["label_id"].to_numpy(),
    )
    class_weight = {index: float(value) for index, value in enumerate(weights)}

    model, backbone = build_model(config)
    head_history = model.fit(
        datasets["train"],
        validation_data=datasets["validation"],
        epochs=1 if args.quick_check else config.head_epochs,
        class_weight=class_weight,
        callbacks=callbacks(output_dir, append_history=False),
    )
    if not args.quick_check:
        completed_head_epochs = len(head_history.history["loss"])
        enable_fine_tuning(model, backbone, config)
        model.fit(
            datasets["train"],
            validation_data=datasets["validation"],
            initial_epoch=completed_head_epochs,
            epochs=completed_head_epochs + config.fine_tune_epochs,
            class_weight=class_weight,
            callbacks=callbacks(
                output_dir,
                append_history=True,
                initial_value_threshold=float(min(head_history.history["val_loss"])),
            ),
        )

    best_model = keras.models.load_model(output_dir / "best_model.keras", compile=False)
    test_rows = manifest.loc[manifest["split"] == "test"]
    probabilities = best_model.predict(datasets["test"], verbose=1)
    evaluate_and_save(
        test_rows["label_id"].to_numpy(),
        probabilities,
        CLASS_NAMES,
        test_rows["path"].to_numpy(),
        output_dir,
        seed=config.seed,
    )
    external_rows = manifest.loc[manifest["split"] == "external_test"]
    if not external_rows.empty:
        external_dataset = tensorflow_dataset(
            manifest,
            "external_test",
            image_size=config.image_size,
            batch_size=config.batch_size,
            seed=config.seed,
            training=False,
        )
        external_probabilities = best_model.predict(external_dataset, verbose=1)
        evaluate_external_binary_and_save(
            external_rows["binary_stroke"].astype(np.int32).to_numpy(),
            1.0 - external_probabilities[:, 0],
            external_rows["path"].to_numpy(),
            output_dir,
        )
    final_model_path = output_dir / "brain_stroke_v2.keras"
    best_model.save(final_model_path)

    metadata = {
        **config.to_dict(),
        "task": "three_class_stroke_pattern_classification_from_2d_head_ct",
        "modality": "non-contrast head CT rendered as PNG/JPEG",
        "input_range": [0.0, 1.0],
        "resize": "resize_with_pad",
        "derived_stroke_probability": "1 - P(no_stroke)",
        "dataset_source": "TEKNOFEST-2021 Stroke Dataset",
        "dataset_url": "https://www.kaggle.com/datasets/ozguraslank/brain-stroke-ct-dataset",
        "scientific_scope": "research demonstration; slice-level output; not a diagnosis",
    }
    (output_dir / "brain_stroke_v2.metadata.json").write_text(
        json.dumps(metadata, indent=2, sort_keys=True), encoding="utf-8"
    )
    print(f"Saved model to {final_model_path}")


if __name__ == "__main__":
    main()
