# CureNet research scope

## Research questions

1. Can transfer learning classify visual patterns in individual rendered lung
   and non-contrast head CT slices?
2. Can anatomy-aware routing reject unsupported or mismatched inputs before a
   disease-pattern classifier runs?
3. Can lexical information retrieval return useful condition descriptions for
   natural-language symptom queries?

## Supported tasks

### Lung CT

- Input: one rendered axial lung CT slice in PNG or JPEG format.
- Output: `normal`, `benign`, or `malignant` image-pattern class.
- Primary architecture: MobileNetV2 transfer learning.
- Explanation: Grad-CAM attention visualization.

### Brain stroke

- Input: one rendered non-contrast head CT slice in PNG or JPEG format.
- Output: `no_stroke`, `ischemic_stroke`, or `hemorrhagic_stroke`.
- Primary architecture: EfficientNetV2B0 transfer learning.

### Anatomy gate

- Input: a rendered image.
- Output: `head_ct`, `lung_ct`, or `unsupported`.
- Behavior: reject uncertain, unsupported, or anatomy-mismatched input.

### Symptom retrieval

- Input: natural-language symptom description.
- Output: ranked conditions from the project symptom corpus.
- Baseline: TF-IDF cosine similarity combined with token-set Jaccard similarity.

## Prohibited claims

CureNet does not diagnose disease, localize a tumor or stroke lesion, process a
complete clinical CT study, recommend treatment, or replace a qualified
clinician. Similarity and softmax scores are model outputs, not calibrated
patient-level disease probabilities.

## Evaluation boundaries

The public imaging datasets do not consistently expose reliable patient or
study identifiers. Results must be described as slice-level unless a future
dataset audit proves patient-independent evaluation. External prospective and
clinical validation have not been performed.
