"""Evaluation and abstention-threshold selection for the anatomy gate."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from sklearn.metrics import classification_report, confusion_matrix


def acceptance_mask(
    probabilities: np.ndarray,
    *,
    minimum_probability: float,
    minimum_margin: float,
    unsupported_index: int,
) -> np.ndarray:
    order = np.argsort(probabilities, axis=1)
    best = order[:, -1]
    top = probabilities[np.arange(len(probabilities)), best]
    second = probabilities[np.arange(len(probabilities)), order[:, -2]]
    return (
        (best != unsupported_index)
        & (top >= minimum_probability)
        & ((top - second) >= minimum_margin)
    )


def select_thresholds(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    *,
    unsupported_index: int,
    maximum_unsafe_rate: float,
) -> dict[str, float]:
    predicted = probabilities.argmax(axis=1)
    best: tuple[int, int, float, float] | None = None
    for minimum_probability in np.arange(0.50, 1.00, 0.01):
        for minimum_margin in np.arange(0.00, 0.81, 0.02):
            accepted = acceptance_mask(
                probabilities,
                minimum_probability=float(minimum_probability),
                minimum_margin=float(minimum_margin),
                unsupported_index=unsupported_index,
            )
            unsafe_count = int(np.sum(accepted & (predicted != y_true)))
            unsafe_rate = unsafe_count / len(y_true)
            accepted_count = int(accepted.sum())
            candidate = (
                accepted_count,
                -unsafe_count,
                float(minimum_probability),
                float(minimum_margin),
            )
            if unsafe_rate <= maximum_unsafe_rate and (
                best is None or candidate > best
            ):
                best = candidate
    if best is None or best[0] == 0:
        raise RuntimeError(
            "No validation thresholds satisfy the unsafe-acceptance constraint"
        )
    return {
        "minimum_probability": round(best[2], 4),
        "minimum_margin": round(best[3], 4),
    }


def evaluate(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    class_names: tuple[str, ...],
    thresholds: dict[str, float],
) -> dict[str, object]:
    predicted = probabilities.argmax(axis=1)
    unsupported_index = class_names.index("unsupported")
    accepted = acceptance_mask(
        probabilities,
        minimum_probability=thresholds["minimum_probability"],
        minimum_margin=thresholds["minimum_margin"],
        unsupported_index=unsupported_index,
    )
    supported = y_true != unsupported_index
    correct = predicted == y_true
    return {
        "sample_count": int(len(y_true)),
        "classification_report": classification_report(
            y_true,
            predicted,
            labels=np.arange(len(class_names)),
            target_names=class_names,
            output_dict=True,
            zero_division=0,
        ),
        "confusion_matrix": confusion_matrix(
            y_true, predicted, labels=np.arange(len(class_names))
        ).tolist(),
        "accepted_fraction": float(accepted.mean()),
        "supported_coverage": float(accepted[supported].mean()),
        "unsafe_acceptance_rate": float(np.mean(accepted & ~correct)),
        "unsupported_false_acceptance_rate": float(
            accepted[~supported].mean()
        ),
        "accepted_accuracy": float(correct[accepted].mean()) if accepted.any() else None,
        "thresholds": thresholds,
    }


def save_metrics(metrics: dict[str, object], output_path: Path) -> None:
    output_path.write_text(
        json.dumps(metrics, indent=2, sort_keys=True), encoding="utf-8"
    )
