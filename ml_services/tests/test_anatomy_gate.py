import json
from pathlib import Path

import numpy as np
import pytest
from fastapi import HTTPException

from anatomy_gate import (
    AnatomyGateResult,
    interpret_anatomy_gate_output,
    validate_anatomy_gate_metadata,
)
from app import enforce_anatomy_match


def valid_metadata() -> dict[str, object]:
    return {
        "class_names": ["head_ct", "lung_ct", "unsupported"],
        "input_shape": [224, 224, 3],
        "model_version": "ct-anatomy-gate-v1",
        "resize": "resize_with_pad",
        "thresholds": {
            "minimum_probability": 0.90,
            "minimum_margin": 0.30,
        },
    }


def test_metadata_contract_accepts_supported_schema(tmp_path: Path) -> None:
    path = tmp_path / "ct_anatomy_gate_v1.metadata.json"
    path.write_text(json.dumps(valid_metadata()), encoding="utf-8")

    assert validate_anatomy_gate_metadata(path) == valid_metadata()


def test_gate_accepts_confident_supported_anatomy() -> None:
    result = interpret_anatomy_gate_output(
        np.array([[0.96, 0.03, 0.01]], dtype=np.float32), valid_metadata()
    )

    assert result.accepted
    assert result.prediction == "head_ct"
    assert result.margin == pytest.approx(0.93)


@pytest.mark.parametrize(
    "scores",
    [
        np.array([[0.55, 0.44, 0.01]], dtype=np.float32),
        np.array([[0.02, 0.03, 0.95]], dtype=np.float32),
    ],
)
def test_gate_abstains_for_ambiguous_or_unsupported_input(scores: np.ndarray) -> None:
    result = interpret_anatomy_gate_output(scores, valid_metadata())

    assert not result.accepted


def test_requested_analysis_must_match_detected_anatomy() -> None:
    result = AnatomyGateResult(
        prediction="head_ct",
        probability=0.98,
        probabilities={"head_ct": 0.98, "lung_ct": 0.01, "unsupported": 0.01},
        margin=0.97,
        accepted=True,
        model_version="ct-anatomy-gate-v1",
    )

    with pytest.raises(HTTPException, match="Anatomy mismatch") as exc_info:
        enforce_anatomy_match(result, "lung")

    assert exc_info.value.status_code == 422


def test_matching_anatomy_is_allowed() -> None:
    result = AnatomyGateResult(
        prediction="lung_ct",
        probability=0.98,
        probabilities={"head_ct": 0.01, "lung_ct": 0.98, "unsupported": 0.01},
        margin=0.97,
        accepted=True,
        model_version="ct-anatomy-gate-v1",
    )

    enforce_anatomy_match(result, "lung")
