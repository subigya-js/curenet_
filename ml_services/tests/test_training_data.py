from pathlib import Path

import numpy as np
from PIL import Image

from training.data import CLASS_NAMES, discover_samples, stratified_slice_split
from training.metrics import classification_metrics


def test_dataset_discovery_supports_public_bengin_typo(tmp_path: Path) -> None:
    for folder in ("Normal cases", "Bengin cases", "Malignant cases"):
        class_dir = tmp_path / folder
        class_dir.mkdir()
        for index in range(5):
            Image.new("RGB", (8, 8), color=(index * 10, 20, 30)).save(
                class_dir / f"image-{index}.jpg"
            )

    samples = discover_samples(tmp_path)
    assert len(samples) == 15
    assert {sample.label for sample in samples} == set(CLASS_NAMES)


def test_stratified_split_is_deterministic_and_disjoint(tmp_path: Path) -> None:
    samples = []
    for folder in ("Normal cases", "Bengin cases", "Malignant cases"):
        class_dir = tmp_path / folder
        class_dir.mkdir()
        for index in range(20):
            path = class_dir / f"image-{index}.png"
            Image.new("RGB", (8, 8)).save(path)
    discovered = discover_samples(tmp_path)

    first = stratified_slice_split(
        discovered, validation_fraction=0.15, test_fraction=0.15, seed=42
    )
    second = stratified_slice_split(
        discovered, validation_fraction=0.15, test_fraction=0.15, seed=42
    )

    assert first == second
    paths = [{sample.path for sample in split} for split in first.values()]
    assert paths[0].isdisjoint(paths[1])
    assert paths[0].isdisjoint(paths[2])
    assert paths[1].isdisjoint(paths[2])


def test_metrics_include_per_class_sensitivity() -> None:
    metrics = classification_metrics(
        true_labels=np.array([0, 0, 1, 1, 2, 2]),
        predicted_labels=np.array([0, 1, 1, 1, 2, 0]),
        class_names=CLASS_NAMES,
    )
    assert metrics["accuracy"] == 4 / 6
    assert metrics["per_class"]["benign"]["recall_sensitivity"] == 1.0
