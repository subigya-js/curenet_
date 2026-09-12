"""Evaluation utilities with class-level metrics and confidence intervals."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    roc_auc_score,
)


def expected_calibration_error(
    y_true: np.ndarray, probabilities: np.ndarray, bins: int = 10
) -> float:
    confidence = probabilities.max(axis=1)
    predictions = probabilities.argmax(axis=1)
    correct = predictions == y_true
    edges = np.linspace(0.0, 1.0, bins + 1)
    error = 0.0
    for lower, upper in zip(edges[:-1], edges[1:]):
        in_bin = (confidence > lower) & (confidence <= upper)
        if in_bin.any():
            error += in_bin.mean() * abs(correct[in_bin].mean() - confidence[in_bin].mean())
    return float(error)


def bootstrap_interval(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    metric,
    *,
    seed: int,
    iterations: int = 1000,
) -> list[float]:
    rng = np.random.default_rng(seed)
    values = []
    for _ in range(iterations):
        indices = rng.integers(0, len(y_true), size=len(y_true))
        values.append(float(metric(y_true[indices], y_pred[indices])))
    return [float(value) for value in np.percentile(values, [2.5, 97.5])]


def evaluate_and_save(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    class_names: tuple[str, ...],
    paths: np.ndarray,
    output_dir: Path,
    *,
    seed: int,
) -> dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    y_pred = probabilities.argmax(axis=1)
    metrics = {
        "sample_count": int(len(y_true)),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "accuracy_95_ci": bootstrap_interval(
            y_true, y_pred, accuracy_score, seed=seed
        ),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "macro_f1": float(
            f1_score(
                y_true,
                y_pred,
                labels=np.arange(len(class_names)),
                average="macro",
                zero_division=0,
            )
        ),
        "macro_f1_95_ci": bootstrap_interval(
            y_true,
            y_pred,
            lambda actual, predicted: f1_score(
                actual,
                predicted,
                labels=np.arange(len(class_names)),
                average="macro",
                zero_division=0,
            ),
            seed=seed + 1,
        ),
        "macro_ovr_auroc": float(
            roc_auc_score(y_true, probabilities, multi_class="ovr", average="macro")
        ),
        "expected_calibration_error": expected_calibration_error(y_true, probabilities),
        "classification_report": classification_report(
            y_true,
            y_pred,
            labels=np.arange(len(class_names)),
            target_names=class_names,
            output_dict=True,
            zero_division=0,
        ),
    }
    (output_dir / "metrics.json").write_text(
        json.dumps(metrics, indent=2, sort_keys=True), encoding="utf-8"
    )

    prediction_data = {"path": paths, "actual": y_true, "predicted": y_pred}
    prediction_data.update(
        {f"probability_{name}": probabilities[:, index] for index, name in enumerate(class_names)}
    )
    pd.DataFrame(prediction_data).to_csv(output_dir / "predictions.csv", index=False)

    matrix = confusion_matrix(y_true, y_pred)
    figure, axis = plt.subplots(figsize=(7, 6))
    sns.heatmap(
        matrix,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=class_names,
        yticklabels=class_names,
        ax=axis,
    )
    axis.set_xlabel("Predicted")
    axis.set_ylabel("Reference label")
    axis.set_title("Stroke CT confusion matrix")
    figure.tight_layout()
    figure.savefig(output_dir / "confusion_matrix.png", dpi=180)
    plt.close(figure)
    return metrics


def evaluate_external_binary_and_save(
    y_true: np.ndarray,
    stroke_probabilities: np.ndarray,
    paths: np.ndarray,
    output_dir: Path,
) -> dict[str, object]:
    """Evaluate the report-compatible stroke/no-stroke score externally."""
    from sklearn.metrics import precision_recall_fscore_support

    y_pred = (stroke_probabilities >= 0.5).astype(np.int32)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=[0, 1], zero_division=0
    )
    metrics = {
        "sample_count": int(len(y_true)),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "stroke_auroc": float(roc_auc_score(y_true, stroke_probabilities)),
        "no_stroke": {
            "precision": float(precision[0]),
            "recall": float(recall[0]),
            "f1": float(f1[0]),
        },
        "stroke": {
            "precision": float(precision[1]),
            "recall": float(recall[1]),
            "f1": float(f1[1]),
        },
        "scope": "external slice-level binary evaluation; not subtype evaluation",
    }
    (output_dir / "external_binary_metrics.json").write_text(
        json.dumps(metrics, indent=2, sort_keys=True), encoding="utf-8"
    )
    pd.DataFrame(
        {
            "path": paths,
            "actual_stroke": y_true,
            "predicted_stroke": y_pred,
            "stroke_probability": stroke_probabilities,
        }
    ).to_csv(output_dir / "external_binary_predictions.csv", index=False)
    return metrics
