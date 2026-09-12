"""Train, calibrate routing thresholds, evaluate, and export the anatomy gate."""

from __future__ import annotations

import argparse
import json
import os
import random
from pathlib import Path

import numpy as np
from sklearn.utils.class_weight import compute_class_weight

from . import CLASS_NAMES
from .config import AnatomyConfig
from .data import load_and_audit_manifest, save_audited_manifest, tensorflow_dataset
from .metrics import evaluate, save_metrics, select_thresholds
from .model import build_model, enable_fine_tuning


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument(
        "--output-dir", type=Path, default=Path("artifacts/ct_anatomy_gate_v1")
    )
    parser.add_argument("--quick-check", action="store_true")
    return parser.parse_args()


def callbacks(
    output_dir: Path, *, checkpoint_name: str, append_history: bool
):
    from tensorflow import keras

    return [
        keras.callbacks.ModelCheckpoint(
            output_dir / checkpoint_name, monitor="val_loss", save_best_only=True
        ),
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=3, restore_best_weights=True
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
    config = AnatomyConfig()
    os.environ["PYTHONHASHSEED"] = str(config.seed)
    random.seed(config.seed)
    np.random.seed(config.seed)

    import tensorflow as tf
    from tensorflow import keras

    tf.random.set_seed(config.seed)
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest, audit = load_and_audit_manifest(args.manifest)
    save_audited_manifest(manifest, audit, output_dir)

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
    label_lookup = {name: index for index, name in enumerate(CLASS_NAMES)}
    train_labels = manifest.loc[manifest["split"] == "train", "label"].map(
        label_lookup
    )
    weights = compute_class_weight(
        class_weight="balanced",
        classes=np.arange(len(CLASS_NAMES)),
        y=train_labels.to_numpy(),
    )
    class_weight = {index: float(value) for index, value in enumerate(weights)}

    model, backbone = build_model(config)
    candidate_paths = [output_dir / "head_candidate.keras"]
    model.fit(
        datasets["train"],
        validation_data=datasets["validation"],
        epochs=1 if args.quick_check else config.head_epochs,
        class_weight=class_weight,
        callbacks=callbacks(
            output_dir,
            checkpoint_name=candidate_paths[0].name,
            append_history=False,
        ),
    )
    if not args.quick_check:
        enable_fine_tuning(model, backbone, config)
        candidate_paths.append(output_dir / "fine_tuned_candidate.keras")
        model.fit(
            datasets["train"],
            validation_data=datasets["validation"],
            epochs=config.fine_tune_epochs,
            class_weight=class_weight,
            callbacks=callbacks(
                output_dir,
                checkpoint_name=candidate_paths[1].name,
                append_history=True,
            ),
        )

    scored_candidates = []
    for candidate_path in candidate_paths:
        candidate_model = keras.models.load_model(candidate_path, compile=False)
        candidate_model.compile(
            loss=keras.losses.SparseCategoricalCrossentropy()
        )
        validation_loss = float(
            candidate_model.evaluate(datasets["validation"], verbose=0)
        )
        scored_candidates.append((validation_loss, candidate_path, candidate_model))
    selected_validation_loss, selected_candidate, best_model = min(
        scored_candidates, key=lambda item: item[0]
    )
    validation_probabilities = best_model.predict(datasets["validation"], verbose=1)
    validation_labels = manifest.loc[
        manifest["split"] == "validation", "label"
    ].map(label_lookup).to_numpy()
    if args.quick_check:
        # A tiny, one-epoch smoke run is not statistically capable of satisfying
        # the production unsafe-acceptance constraint. Use permissive thresholds
        # only to exercise evaluation and export; metadata prevents deployment.
        thresholds = {
            "minimum_probability": 0.01,
            "minimum_margin": 0.0,
        }
    else:
        thresholds = select_thresholds(
            validation_labels,
            validation_probabilities,
            unsupported_index=CLASS_NAMES.index("unsupported"),
            maximum_unsafe_rate=config.maximum_unsafe_acceptance_rate,
        )

    test_probabilities = best_model.predict(datasets["test"], verbose=1)
    test_rows = manifest.loc[manifest["split"] == "test"]
    test_labels = test_rows["label"].map(label_lookup).to_numpy()
    test_metrics = evaluate(test_labels, test_probabilities, CLASS_NAMES, thresholds)
    save_metrics(test_metrics, output_dir / "metrics.json")

    final_model = output_dir / "ct_anatomy_gate_v1.keras"
    best_model.save(final_model)
    metadata = {
        **config.to_dict(),
        "class_names": list(CLASS_NAMES),
        "input_shape": [config.image_size, config.image_size, 3],
        "input_range": [0.0, 1.0],
        "resize": "resize_with_pad",
        "thresholds": thresholds,
        "dataset_audit": audit,
        "evaluation": test_metrics,
        "selected_training_stage": selected_candidate.stem,
        "selected_validation_loss": selected_validation_loss,
        "deployment_ready": not args.quick_check,
        "quick_check": args.quick_check,
        "scope": (
            "Routes rendered CT slices only; abstains on unsupported or uncertain input"
        ),
    }
    (output_dir / "ct_anatomy_gate_v1.metadata.json").write_text(
        json.dumps(metadata, indent=2, sort_keys=True), encoding="utf-8"
    )
    print(f"Saved anatomy gate to {final_model}")
    print(json.dumps(test_metrics, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
