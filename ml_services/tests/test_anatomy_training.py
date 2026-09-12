from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from PIL import Image

from anatomy_ml.data import load_and_audit_manifest
from anatomy_ml.metrics import acceptance_mask, select_thresholds


def write_manifest(tmp_path: Path, *, leak_group: bool = False) -> Path:
    rows = []
    for split_index, split in enumerate(("train", "validation", "test")):
        for label_index, label in enumerate(("head_ct", "lung_ct", "unsupported")):
            pixels = np.arange(64, dtype=np.uint8).reshape(8, 8)
            pixels = np.roll(pixels, split_index * 7 + label_index * 3)
            image_path = tmp_path / f"{split}-{label}.png"
            Image.fromarray(pixels, mode="L").save(image_path)
            group_id = "leaking-group" if leak_group and label == "head_ct" else f"{split}-{label}"
            rows.append(
                {
                    "path": image_path.name,
                    "label": label,
                    "group_id": group_id,
                    "source": f"source-{label_index}",
                    "split": split,
                }
            )
    manifest_path = tmp_path / "manifest.csv"
    pd.DataFrame(rows).to_csv(manifest_path, index=False)
    return manifest_path


def test_manifest_audit_accepts_disjoint_groups_and_images(tmp_path: Path) -> None:
    manifest, audit = load_and_audit_manifest(write_manifest(tmp_path))

    assert len(manifest) == 9
    assert audit["group_leakage"] == 0
    assert audit["exact_duplicate_leakage"] == 0


def test_manifest_audit_rejects_group_leakage(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="crossing data splits"):
        load_and_audit_manifest(write_manifest(tmp_path, leak_group=True))


def test_thresholds_limit_unsafe_acceptance() -> None:
    probabilities = np.array(
        [
            [0.98, 0.01, 0.01],
            [0.02, 0.96, 0.02],
            [0.02, 0.03, 0.95],
            [0.51, 0.48, 0.01],
        ]
    )
    truth = np.array([0, 1, 2, 1])

    thresholds = select_thresholds(
        truth,
        probabilities,
        unsupported_index=2,
        maximum_unsafe_rate=0.0,
    )
    accepted = acceptance_mask(
        probabilities,
        minimum_probability=thresholds["minimum_probability"],
        minimum_margin=thresholds["minimum_margin"],
        unsupported_index=2,
    )

    assert accepted.tolist() == [True, True, False, False]
