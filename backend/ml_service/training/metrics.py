from __future__ import annotations

import json
from pathlib import Path

import numpy as np


def classification_metrics(
    true_labels: np.ndarray, predicted_labels: np.ndarray, class_names: tuple[str, ...]
) -> dict[str, object]:
    class_count = len(class_names)
    confusion = np.zeros((class_count, class_count), dtype=np.int64)
    for truth, prediction in zip(true_labels, predicted_labels):
        confusion[int(truth), int(prediction)] += 1

    per_class: dict[str, dict[str, float | int]] = {}
    f1_values: list[float] = []
    recalls: list[float] = []
    for index, class_name in enumerate(class_names):
        true_positive = int(confusion[index, index])
        false_positive = int(confusion[:, index].sum() - true_positive)
        false_negative = int(confusion[index, :].sum() - true_positive)
        support = int(confusion[index, :].sum())
        precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0.0
        recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        f1_values.append(f1)
        recalls.append(recall)
        per_class[class_name] = {
            "precision": precision,
            "recall_sensitivity": recall,
            "f1": f1,
            "support": support,
        }

    total = int(confusion.sum())
    accuracy = float(np.trace(confusion) / total) if total else 0.0
    return {
        "accuracy": accuracy,
        "balanced_accuracy": float(np.mean(recalls)),
        "macro_f1": float(np.mean(f1_values)),
        "per_class": per_class,
        "confusion_matrix": confusion.tolist(),
        "confusion_matrix_labels": list(class_names),
        "sample_count": total,
    }


def write_metrics(metrics: dict[str, object], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
