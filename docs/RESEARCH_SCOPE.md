# CureNet research scope

## Research questions

1. Can transfer learning classify rendered lung CT slices into normal, benign,
   and malignant research classes?
2. Can a separate transfer-learning model classify rendered head CT slices into
   no-stroke, ischemic-stroke, and hemorrhagic-stroke research classes?
3. Can an anatomy gate reduce cross-anatomy and unsupported-image inference?
4. Can Grad-CAM expose the image regions that most influenced lung predictions?

## Included

- Lung CT image classification with MobileNetV2.
- Brain-stroke CT image classification with EfficientNetV2B0.
- Anatomy-aware input routing and abstention.
- Reproducible preprocessing and class-order metadata.
- Slice-level evaluation and saved reports.
- Grad-CAM attention visualization for lung output.
- React/FastAPI integration for research demonstration.

## Excluded

- Clinical diagnosis or treatment recommendation.
- Full DICOM-series interpretation.
- Lesion detection, segmentation, or measurement.
- Non-imaging prediction or clinical workflow automation.
- Prospective clinical decision support.

## Evaluation

Classification reports should include class counts, confusion matrices,
per-class precision/recall/F1, macro F1, balanced accuracy, and ROC-AUC where
appropriate. Splits must be patient-disjoint whenever patient identifiers are
available. Results should report dataset provenance, preprocessing, random seed,
artifact checksum, and known sources of leakage or bias.

## Claim boundary

CureNet reports experimental image-classification scores. It does not establish
clinical accuracy, disease prevalence, patient-level probability, or suitability
for medical use.
