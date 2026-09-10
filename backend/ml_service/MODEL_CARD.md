# CureNet imaging models

## Intended use

This repository contains undergraduate research prototypes for classifying a
brain image for stroke-related patterns and a lung image into one of three
model classes. The software is for education, reproducibility work, and model
engineering demonstrations only. It is not a medical device or diagnosis.

## Recovered contracts

| Model | Input | Output | Training configuration stored in artifact |
|---|---|---|---|
| Brain stroke | RGB, 224 x 224, values scaled to 0-1 | One sigmoid score | Adam, binary cross-entropy |
| Lung | RGB, 128 x 128, values scaled to 0-1 | Three softmax scores | Adam (1e-4), categorical cross-entropy |

The topology is documented in `model_architectures.py`. The Keras files retain
weights and topology, but not the original dataset manifests, train/validation
split, preprocessing provenance, class-index mapping, or evaluation report.

## Critical limitations

- The lung class names and their index order have not been recovered. The API
  therefore returns neutral labels (`class_0`, `class_1`, `class_2`) by default.
- The medical imaging modality, patient population, and acquisition protocol
  are not documented. Do not claim that arbitrary lung or brain images are valid inputs.
- Accuracy, sensitivity, specificity, AUROC, calibration, subgroup performance,
  and external generalization are unknown and must not be claimed.
- A random image can still receive a high softmax or sigmoid score. That score is
  not clinical confidence and does not establish that an input is in distribution.
- Patient-level leakage in the original split cannot be ruled out.

## Required work before reporting scientific results

Recover or replace the datasets with documented sources and licenses; define
the imaging modality and label ontology; create patient-level train,
validation, and held-out test splits; evaluate sensitivity, specificity,
precision, F1, AUROC, confusion matrices, and calibration with confidence
intervals; test external data and important subgroups; and document failure
cases. Any later results must identify the exact model and dataset versions.

## Provenance

The brain artifact was restored from the Kaggle model linked in the original
repository README. The lung artifact was already present in this repository.
Architecture and tensor contracts were inspected from those Keras artifacts.
