from __future__ import annotations

import argparse
import json
import os
import random
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow import keras

from training.data import (
    CLASS_NAMES,
    Sample,
    discover_samples,
    save_split_summary,
    split_summary,
    stratified_slice_split,
    write_manifest,
)
from training.metrics import classification_metrics, write_metrics
from training.model import build_lung_classifier, compile_model, enable_fine_tuning


DATASET_DOI = "10.17632/bhmdr45bh2.4"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the CureNet lung CT classifier")
    parser.add_argument("--data-dir", type=Path, default=Path("data/iq-oth-nccd"))
    parser.add_argument(
        "--output-model",
        type=Path,
        default=Path("models/lung_cancer_retrained.keras"),
    )
    parser.add_argument("--reports-dir", type=Path, default=Path("reports/lung"))
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--fine-tune-epochs", type=int, default=10)
    parser.add_argument("--fine-tune-layers", type=int, default=30)
    parser.add_argument("--validation-fraction", type=float, default=0.15)
    parser.add_argument("--test-fraction", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--no-imagenet-weights",
        action="store_true",
        help="Train from random initialization instead of ImageNet transfer learning",
    )
    return parser.parse_args()


def set_reproducibility(seed: int) -> None:
    os.environ.setdefault("TF_DETERMINISTIC_OPS", "1")
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)
    try:
        tf.config.experimental.enable_op_determinism()
    except AttributeError:
        pass


def make_dataset(
    samples: list[Sample], *, image_size: int, batch_size: int, training: bool, seed: int
) -> tf.data.Dataset:
    label_indexes = {name: index for index, name in enumerate(CLASS_NAMES)}
    paths = [str(sample.path) for sample in samples]
    labels = [label_indexes[sample.label] for sample in samples]
    dataset = tf.data.Dataset.from_tensor_slices((paths, labels))

    def load_image(path: tf.Tensor, label: tf.Tensor) -> tuple[tf.Tensor, tf.Tensor]:
        encoded = tf.io.read_file(path)
        image = tf.io.decode_image(encoded, channels=3, expand_animations=False)
        image.set_shape((None, None, 3))
        image = tf.image.convert_image_dtype(image, tf.float32)
        image = tf.image.resize(image, (image_size, image_size), antialias=True)
        return image, label

    dataset = dataset.map(load_image, num_parallel_calls=tf.data.AUTOTUNE)
    if training:
        dataset = dataset.shuffle(len(samples), seed=seed, reshuffle_each_iteration=True)
    return dataset.batch(batch_size).prefetch(tf.data.AUTOTUNE)


def class_weights(samples: list[Sample]) -> dict[int, float]:
    counts = {name: sum(sample.label == name for sample in samples) for name in CLASS_NAMES}
    total = sum(counts.values())
    return {
        index: total / (len(CLASS_NAMES) * counts[name])
        for index, name in enumerate(CLASS_NAMES)
    }


def git_commit() -> str | None:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def callbacks(output_model: Path) -> list[keras.callbacks.Callback]:
    return [
        keras.callbacks.ModelCheckpoint(
            output_model, monitor="val_loss", save_best_only=True, verbose=1
        ),
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=5, restore_best_weights=True, verbose=1
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.2, patience=2, min_lr=1e-7, verbose=1
        ),
        keras.callbacks.CSVLogger(str(output_model.with_suffix(".training.csv"))),
    ]


def main() -> None:
    args = parse_args()
    set_reproducibility(args.seed)

    data_dir = args.data_dir.resolve()
    output_model = args.output_model.resolve()
    reports_dir = args.reports_dir.resolve()
    output_model.parent.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    samples = discover_samples(data_dir)
    splits = stratified_slice_split(
        samples,
        validation_fraction=args.validation_fraction,
        test_fraction=args.test_fraction,
        seed=args.seed,
    )
    manifest_path = reports_dir / "split_manifest.csv"
    manifest_hash = write_manifest(splits, data_dir, manifest_path)
    save_split_summary(splits, reports_dir / "split_summary.json", manifest_hash)

    train_data = make_dataset(
        splits["train"], image_size=args.image_size, batch_size=args.batch_size, training=True, seed=args.seed
    )
    validation_data = make_dataset(
        splits["validation"], image_size=args.image_size, batch_size=args.batch_size, training=False, seed=args.seed
    )
    test_data = make_dataset(
        splits["test"], image_size=args.image_size, batch_size=args.batch_size, training=False, seed=args.seed
    )

    model, backbone = build_lung_classifier(
        input_size=args.image_size,
        class_count=len(CLASS_NAMES),
        imagenet_weights=not args.no_imagenet_weights,
    )
    compile_model(model, learning_rate=1e-3)
    base_candidate = reports_dir / "base_candidate.keras"
    model.fit(
        train_data,
        validation_data=validation_data,
        epochs=args.epochs,
        class_weight=class_weights(splits["train"]),
        callbacks=callbacks(base_candidate),
        shuffle=False,
    )

    candidates = [base_candidate]
    if args.fine_tune_epochs > 0:
        enable_fine_tuning(backbone, args.fine_tune_layers)
        compile_model(model, learning_rate=1e-5)
        fine_tuned_candidate = reports_dir / "fine_tuned_candidate.keras"
        model.fit(
            train_data,
            validation_data=validation_data,
            epochs=args.fine_tune_epochs,
            class_weight=class_weights(splits["train"]),
            callbacks=callbacks(fine_tuned_candidate),
            shuffle=False,
        )
        candidates.append(fine_tuned_candidate)

    candidate_scores: list[tuple[float, Path, keras.Model]] = []
    for candidate_path in candidates:
        candidate_model = keras.models.load_model(candidate_path, compile=False)
        compile_model(candidate_model, learning_rate=1e-5)
        validation_loss = float(candidate_model.evaluate(validation_data, verbose=0)[0])
        candidate_scores.append((validation_loss, candidate_path, candidate_model))
    candidate_scores.sort(key=lambda item: item[0])
    selected_validation_loss, selected_candidate, best_model = candidate_scores[0]
    best_model.save(output_model)

    probabilities = best_model.predict(test_data, verbose=1)
    predictions = np.argmax(probabilities, axis=1)
    truth = np.concatenate([labels.numpy() for _, labels in test_data])
    metrics = classification_metrics(truth, predictions, CLASS_NAMES)
    metrics.update(
        {
            "evaluation_scope": "held_out_slice_level",
            "dataset_doi": DATASET_DOI,
            "manifest_sha256": manifest_hash,
            "selected_validation_loss": selected_validation_loss,
            "selected_training_stage": selected_candidate.stem,
        }
    )
    write_metrics(metrics, reports_dir / "test_metrics.json")

    metadata = {
        "schema_version": 1,
        "model_name": "curenet_lung_ct_classifier",
        "task": "single_slice_lung_ct_classification",
        "class_names": list(CLASS_NAMES),
        "input_shape": [args.image_size, args.image_size, 3],
        "input_value_range": [0.0, 1.0],
        "dataset": {
            "name": "IQ-OTH/NCCD lung cancer dataset",
            "doi": DATASET_DOI,
            "license": "CC BY 4.0",
            "split_strategy": "deterministic_stratified_slice_level",
            "split_counts": split_summary(splits),
            "manifest_sha256": manifest_hash,
        },
        "training": {
            "seed": args.seed,
            "base_epochs_requested": args.epochs,
            "fine_tune_epochs_requested": args.fine_tune_epochs,
            "batch_size": args.batch_size,
            "backbone": "MobileNetV2",
            "imagenet_initialization": not args.no_imagenet_weights,
        },
        "evaluation": metrics,
        "limitations": [
            "Research and education only; not a medical device or diagnosis.",
            "The public dataset lacks patient identifiers, so patient-level separation cannot be verified.",
            "The dataset is small, class-imbalanced, and collected at a limited number of Iraqi centers.",
            "This model evaluates a single exported CT slice, not a complete DICOM study.",
            "External and prospective clinical validation have not been performed.",
        ],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "tensorflow_version": tf.__version__,
        "source_git_commit": git_commit(),
    }
    metadata_path = output_model.with_suffix(".metadata.json")
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")

    print(f"Saved model: {output_model}")
    print(f"Saved metadata: {metadata_path}")
    print(f"Saved evaluation: {reports_dir / 'test_metrics.json'}")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
