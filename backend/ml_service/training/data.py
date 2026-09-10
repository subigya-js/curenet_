from __future__ import annotations

import csv
import hashlib
import json
import random
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


CLASS_NAMES = ("normal", "benign", "malignant")
SUPPORTED_SUFFIXES = {".jpg", ".jpeg", ".png"}
CLASS_ALIASES = {
    "normal": "normal",
    "normal case": "normal",
    "normal cases": "normal",
    "benign": "benign",
    "benign case": "benign",
    "benign cases": "benign",
    "bengin": "benign",  # The public dataset contains this typo.
    "bengin case": "benign",
    "bengin cases": "benign",
    "malignant": "malignant",
    "malignant case": "malignant",
    "malignant cases": "malignant",
}


@dataclass(frozen=True)
class Sample:
    path: Path
    label: str


def _normalized_name(value: str) -> str:
    return " ".join(value.lower().replace("_", " ").replace("-", " ").split())


def label_from_path(path: Path) -> str | None:
    for part in reversed(path.parts[:-1]):
        label = CLASS_ALIASES.get(_normalized_name(part))
        if label:
            return label
    return None


def discover_samples(data_dir: Path) -> list[Sample]:
    samples: list[Sample] = []
    for path in sorted(data_dir.rglob("*")):
        if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES:
            label = label_from_path(path.relative_to(data_dir))
            if label:
                samples.append(Sample(path.resolve(), label))

    counts = Counter(sample.label for sample in samples)
    missing = [label for label in CLASS_NAMES if counts[label] == 0]
    if missing:
        raise ValueError(
            f"No images found for: {', '.join(missing)}. "
            "Expected Normal, Benign/Bengin, and Malignant class folders."
        )
    return samples


def stratified_slice_split(
    samples: list[Sample],
    *,
    validation_fraction: float,
    test_fraction: float,
    seed: int,
) -> dict[str, list[Sample]]:
    if validation_fraction <= 0 or test_fraction <= 0:
        raise ValueError("Validation and test fractions must both be positive")
    if validation_fraction + test_fraction >= 1:
        raise ValueError("Validation and test fractions must sum to less than 1")

    rng = random.Random(seed)
    splits: dict[str, list[Sample]] = {"train": [], "validation": [], "test": []}
    for label in CLASS_NAMES:
        class_samples = [sample for sample in samples if sample.label == label]
        if len(class_samples) < 3:
            raise ValueError(f"Class '{label}' needs at least three images")
        rng.shuffle(class_samples)

        test_count = max(1, round(len(class_samples) * test_fraction))
        validation_count = max(1, round(len(class_samples) * validation_fraction))
        if test_count + validation_count >= len(class_samples):
            raise ValueError(f"Class '{label}' is too small for the requested split")

        splits["test"].extend(class_samples[:test_count])
        splits["validation"].extend(
            class_samples[test_count : test_count + validation_count]
        )
        splits["train"].extend(class_samples[test_count + validation_count :])

    for split_samples in splits.values():
        rng.shuffle(split_samples)
    return splits


def write_manifest(
    splits: dict[str, list[Sample]], data_dir: Path, output_path: Path
) -> str:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str]] = []
    for split_name, samples in splits.items():
        for sample in samples:
            try:
                relative_path = sample.path.relative_to(data_dir.resolve())
            except ValueError:
                relative_path = sample.path
            rows.append(
                {"split": split_name, "label": sample.label, "path": str(relative_path)}
            )

    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=("split", "label", "path"))
        writer.writeheader()
        writer.writerows(rows)

    return hashlib.sha256(output_path.read_bytes()).hexdigest()


def split_summary(splits: dict[str, list[Sample]]) -> dict[str, dict[str, int]]:
    return {
        split: dict(sorted(Counter(sample.label for sample in samples).items()))
        for split, samples in splits.items()
    }


def save_split_summary(
    splits: dict[str, list[Sample]], output_path: Path, manifest_sha256: str
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(
            {
                "split_strategy": "deterministic_stratified_slice_level",
                "manifest_sha256": manifest_sha256,
                "counts": split_summary(splits),
                "limitation": (
                    "The public IQ-OTH/NCCD release has no patient identifiers. "
                    "Slices from one patient may cross splits, so this evaluation "
                    "must not be described as patient-level or clinical validation."
                ),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
