# Reproducible lung CT training

The committed `models/lung_cancer.keras` file is a recovered artifact. Its
original dataset, label order, split, and evaluation are unknown. It must not be
used to assign medical meanings to `class_0`, `class_1`, or `class_2`.

This pipeline trains a replacement on the IQ-OTH/NCCD lung cancer CT dataset:

- Dataset DOI (Original Source): <https://doi.org/10.17632/bhmdr45bh2.4>
- Kaggle Mirror (Used for Download): <https://www.kaggle.com/datasets/hamdallak/the-iqothnccd-lung-cancer-dataset>
- Kaggle Augmented Version (For visual reference): <https://www.kaggle.com/datasets/subhajeetdas/iq-othnccd-lung-cancer-dataset-augmented>
- License: Creative Commons Attribution 4.0 International
- Classes and fixed indexes: `normal=0`, `benign=1`, `malignant=2`
- Intended use: education and reproducibility research only

## Critical evaluation limitation

The public files contain slices from 110 cases but do not expose patient IDs.
The generated train/validation/test split is deterministic and stratified, but
it is only a **slice-level split**. Adjacent slices from the same patient may
cross partitions and inflate the measured performance. Do not call the result
patient-level validation or clinical accuracy.

## Set up and download

Run these commands from `ml_services` with Python 3.11:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements-train.txt
python download_lung_dataset.py
```

Kaggle may request an API token. Generate one in Kaggle settings and follow the
official `kagglehub` authentication prompt. Never commit the token.

## Train and evaluate

```bash
python train_lung.py
```

The defaults use an ImageNet-initialized MobileNetV2 feature extractor, train a
new three-class head, and then fine-tune the last 30 non-batch-normalization
layers at a lower learning rate.

Generated outputs:

```text
models/lung_cancer_retrained.keras
models/lung_cancer_retrained.metadata.json
models/lung_cancer_retrained.training.csv
reports/lung/split_manifest.csv
reports/lung/split_summary.json
reports/lung/test_metrics.json
```

The dataset, Keras model, candidate checkpoints, and training logs are ignored
by Git. The small metadata, split manifest, split summary, and evaluation JSON
are intentionally versionable so a result cannot be presented without its
label contract and limitations.

Activate the replacement only after inspecting its held-out metrics:

```bash
export CURENET_LUNG_MODEL_PATH="$PWD/models/lung_cancer_retrained.keras"
uvicorn app:app --host 127.0.0.1 --port 8000
```

The API loads the adjacent metadata file and uses its explicit label mapping.
If metadata is missing or invalid, the API falls back to neutral class names.

## Model attention visualization (Grad-CAM)

The inference service computes a Grad-CAM attention heatmap for the selected lung
class:

- The MobileNetV2 architecture extracts spatial features prior to global average
  pooling. Grad-CAM computes gradients of the target class score with respect to
  these feature maps to identify regions of strongest model influence.
- The attention overlay is formatted as a PNG data URL along with activation area
  percentage and peak coordinates.
- **Interpretation boundary**: Grad-CAM visualizes network attention only. It does
  not perform lesion segmentation, delineate tumor margins, or locate disease.
  True lesion localization requires dedicated detection/segmentation architectures
  (e.g., U-Net or Mask R-CNN) trained on pixel-level annotated datasets such as
  LIDC-IDRI or MSD Task06.

## Production boundary

Before any clinical claim, replace this dataset with data that includes stable
patient/study identifiers, split strictly by patient, preserve DICOM metadata
and windowing, evaluate on an external institution, measure calibration and
class-specific sensitivity/specificity, and obtain clinical and regulatory
review.
