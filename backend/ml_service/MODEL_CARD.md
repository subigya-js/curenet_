# CureNet imaging model card

## Intended use

CureNet contains research prototypes for classifying a brain image for
stroke-related patterns and a lung CT slice as normal, benign, or malignant.
The software is for education, reproducibility work, and model-engineering
demonstrations only. It is not a medical device and does not make a diagnosis.

## Lung CT replacement model

| Property | Value |
|---|---|
| Artifact | `models/lung_cancer_retrained.keras` (generated locally) |
| Task | Three-class classification of one exported axial CT slice |
| Classes | `normal=0`, `benign=1`, `malignant=2` |
| Input | RGB, 224 x 224, float values from 0 to 1 |
| Dataset | IQ-OTH/NCCD, DOI `10.17632/bhmdr45bh2.4`, CC BY 4.0 |
| Architecture | ImageNet MobileNetV2 plus global pooling, dropout, and softmax head |
| Training | Frozen feature extractor followed by low-rate fine-tuning |
| Split | Deterministic stratified 70/15/15 slice-level split, seed 42 |

The completed local run used 1,097 images: 769 train, 164 validation, and 164
test. The held-out **slice-level** result was 88.41% accuracy, 85.23% balanced
accuracy, and 82.72% macro-F1. Per-class recall was 83.87% normal, 77.78%
benign, and 94.05% malignant. Exact results and the confusion matrix are stored
in `reports/lung/test_metrics.json`.

These numbers are not patient-level or clinical performance. The public files
do not provide patient IDs, so correlated slices from one patient may cross
partitions and inflate every reported metric.

The adjacent `lung_cancer_retrained.metadata.json` is part of the inference
contract. It records the label order, input shape, dataset, split-manifest hash,
training settings, metrics, TensorFlow version, and limitations. The API reads
that file instead of guessing class meanings.

## Legacy lung artifact

`models/lung_cancer.keras` accepts 128 x 128 RGB input and emits three softmax
scores, but its original dataset, preprocessing provenance, class-index mapping,
split, and evaluation report are unavailable. Its architecture can be inspected;
its missing history cannot be reconstructed from weights. The API therefore uses
neutral `class_0`, `class_1`, and `class_2` names if this artifact is selected
without verified metadata.

## Brain-stroke artifact

The expected `models/brain_stroke.keras` artifact accepts 224 x 224 RGB input
and emits one sigmoid score. Its referenced download is noted in the API, but
its original data provenance and independent evaluation have not been established
in this repository. It is not yet equivalent to the reproducible lung pipeline.

## Model explainability (Grad-CAM attention)

The lung analysis service generates a gradient-weighted class activation map
(Grad-CAM) for the predicted class:

- **Method**: Layer-by-layer forward and backward pass using `tf.GradientTape`
  across the convolutional backbone to the final 4D spatial feature layer.
- **Contract output**: Returns a base64 PNG data URL overlay, strong-activation
  area percentage (`region_percent`), coordinate peak (`peak_x_percent`, `peak_y_percent`),
  human-readable region description, and an interpretative disclaimer.
- **Non-localization boundary**: Grad-CAM highlights image regions that contributed
  most strongly to the classifier's output score. It is **not** lesion segmentation,
  anatomical bounding, tumor measurement, or pathology localization. High activation
  can stem from normal anatomical structures, scan artifacts, or background patterns
  correlated with training labels.

## Critical limitations

- The IQ-OTH/NCCD release is small, imbalanced, and collected at a limited
  number of Iraqi centers.
- A JPEG/PNG slice discards DICOM series context, Hounsfield-unit calibration,
  acquisition details, and clinically controlled windowing.
- A single-slice classifier cannot assess a complete CT study.
- External-site, prospective, subgroup, robustness, and calibration studies
  have not been performed.
- Softmax is relative model output, not the probability that a patient has cancer.
- The upload validator is a heuristic and cannot prove an image is an authentic CT.

## Required work before any clinical claim

Use data with stable patient and study identifiers; split strictly by patient;
retain the full DICOM study and documented preprocessing; lock a test set before
model selection; evaluate sensitivity, specificity, AUROC, calibration, confidence
intervals, and clinically meaningful subgroups; validate at external institutions;
and obtain radiology, security, privacy, and regulatory review.
