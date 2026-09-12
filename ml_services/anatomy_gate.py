"""Versioned anatomy-gate contract for routing supported CT slices."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np


ANATOMY_CLASS_NAMES = ("head_ct", "lung_ct", "unsupported")
ANATOMY_GATE_VERSION = "ct-anatomy-gate-v1"
ANATOMY_INPUT_SHAPE = (224, 224, 3)
EXPECTED_ANATOMY = {"stroke": "head_ct", "lung": "lung_ct"}


@dataclass(frozen=True)
class AnatomyGateResult:
    prediction: str
    probability: float
    probabilities: dict[str, float]
    margin: float
    accepted: bool
    model_version: str


def validate_anatomy_gate_metadata(path: Path) -> dict[str, object]:
    try:
        metadata = json.loads(path.read_text(encoding="utf-8"))
        class_names = tuple(str(value) for value in metadata["class_names"])
        input_shape = tuple(int(value) for value in metadata["input_shape"])
        model_version = str(metadata["model_version"])
        resize = str(metadata["resize"])
        thresholds = metadata["thresholds"]
        minimum_probability = float(thresholds["minimum_probability"])
        minimum_margin = float(thresholds["minimum_margin"])
    except FileNotFoundError as exc:
        raise RuntimeError(f"Anatomy-gate metadata is required at {path}") from exc
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Invalid anatomy-gate metadata at {path}: {exc}") from exc

    if class_names != ANATOMY_CLASS_NAMES:
        raise RuntimeError(
            f"Anatomy-gate class order must be {ANATOMY_CLASS_NAMES}, got {class_names}"
        )
    if input_shape != ANATOMY_INPUT_SHAPE:
        raise RuntimeError(
            f"Anatomy-gate input shape must be {ANATOMY_INPUT_SHAPE}, got {input_shape}"
        )
    if model_version != ANATOMY_GATE_VERSION:
        raise RuntimeError(f"Unsupported anatomy-gate version: {model_version}")
    if resize != "resize_with_pad":
        raise RuntimeError(f"Unsupported anatomy-gate resize contract: {resize}")
    if not 0.0 < minimum_probability <= 1.0:
        raise RuntimeError("minimum_probability must be in (0, 1]")
    if not 0.0 <= minimum_margin <= 1.0:
        raise RuntimeError("minimum_margin must be in [0, 1]")
    return metadata


def interpret_anatomy_gate_output(
    raw_output: np.ndarray, metadata: dict[str, object]
) -> AnatomyGateResult:
    scores = np.asarray(raw_output, dtype=np.float64).reshape(-1)
    if scores.size != len(ANATOMY_CLASS_NAMES):
        raise RuntimeError(
            f"Expected {len(ANATOMY_CLASS_NAMES)} anatomy outputs, received {scores.size}"
        )
    if not np.all(np.isfinite(scores)):
        raise RuntimeError("Anatomy gate returned a non-finite score")
    if np.any(scores < -1e-6) or np.any(scores > 1.0 + 1e-6):
        raise RuntimeError("Anatomy gate returned a score outside [0, 1]")
    score_sum = float(scores.sum())
    if score_sum <= 0 or not np.isclose(score_sum, 1.0, atol=1e-3):
        raise RuntimeError("Anatomy-gate outputs do not sum to 1")

    scores = scores / score_sum
    order = np.argsort(scores)[::-1]
    best_index = int(order[0])
    probability = float(scores[best_index])
    margin = probability - float(scores[int(order[1])])
    prediction = ANATOMY_CLASS_NAMES[best_index]
    thresholds = metadata["thresholds"]
    minimum_probability = float(thresholds["minimum_probability"])  # type: ignore[index]
    minimum_margin = float(thresholds["minimum_margin"])  # type: ignore[index]
    accepted = (
        prediction != "unsupported"
        and probability >= minimum_probability
        and margin >= minimum_margin
    )
    return AnatomyGateResult(
        prediction=prediction,
        probability=probability,
        probabilities={
            name: float(score) for name, score in zip(ANATOMY_CLASS_NAMES, scores)
        },
        margin=margin,
        accepted=accepted,
        model_version=str(metadata["model_version"]),
    )
