# CureNet

**An anatomy-aware computer-vision project for lung CT and brain-stroke image analysis.**

CureNet is a final-year computer engineering research project focused exclusively
on medical-image classification. A React interface sends a rendered CT slice to a
FastAPI service, which validates the image, checks its anatomy, runs the matching
TensorFlow classifier, and returns class scores with explicit research limitations.

## Computer-vision modules

| Module | Architecture | Input | Output |
|---|---|---|---|
| Lung CT | MobileNetV2 transfer learning | One rendered axial lung CT slice | `normal`, `benign`, `malignant` |
| Brain stroke | EfficientNetV2B0 transfer learning | One rendered non-contrast head CT slice | `no_stroke`, `ischemic_stroke`, `hemorrhagic_stroke` |
| Anatomy gate | Three-class CT image router | Rendered head/lung/unsupported image | `head_ct`, `lung_ct`, `unsupported` |
| Explainability | Grad-CAM | Lung classifier activation | Attention overlay for model inspection |

This software is a research prototype, not a medical device. Its outputs are
slice-level model scores and must not be interpreted as diagnoses.

## Repository structure

```text
curenet_/
|-- frontend/                  React research interface
|-- ml_services/
|   |-- app.py                FastAPI inference service
|   |-- imaging/              Input validation and anatomy-gate contracts
|   |-- lung_ml/              Lung training and evaluation pipeline
|   |-- stroke_ml/            Brain-stroke training and evaluation pipeline
|   |-- anatomy_ml/           Anatomy-gate training pipeline
|   |-- models/               Runtime metadata and local model artifacts
|   |-- reports/              Reproducible evaluation outputs
|   `-- tests/                Imaging, model-contract, and training tests
|-- notebooks/                Colab training notebook
|-- scripts/verify_models.py  Model checksum verification
`-- docs/                     Architecture, runbook, scope, and model cards
```

## Quick start

### API

```bash
make api-install
make api-start
```

The API runs at `http://127.0.0.1:8000`.

### Frontend

```bash
make frontend-install
make frontend-start
```

The React application runs at `http://localhost:3000`.

## Imaging API

```http
POST /api/v1/imaging/predict
Content-Type: multipart/form-data

file=<PNG or JPEG CT slice>
analysis_type=lung|stroke
```

Compatibility endpoint: `POST /predict`.

Health endpoint:

```http
GET /api/v1/health
```

The health response reports loaded artifacts, model versions, anatomy-gate
status, and lung-class contract verification.

## Inference flow

1. Reject empty, oversized, malformed, or unsupported uploads.
2. Apply basic radiological-image validation.
3. Run the anatomy gate and reject uncertain or mismatched anatomy.
4. Apply the preprocessing contract associated with the selected model.
5. Run lung or brain-stroke classification.
6. Validate output dimensions and probability semantics.
7. Generate a Grad-CAM overlay for accepted lung CT input.
8. Return all class scores, artifact versions, input scope, and warnings.

## Training

Install training dependencies:

```bash
make training-install
```

Lung CT:

```bash
cd ml_services
source .venv/bin/activate
python -m lung_ml.download
python -m lung_ml.train
```

Brain stroke:

```bash
cd ml_services
source .venv/bin/activate
python -m stroke_ml.train --quick-check --output-dir artifacts/stroke_ct_smoke
python -m stroke_ml.train --output-dir artifacts/stroke_ct_v2
```

Anatomy gate:

```bash
cd ml_services
source .venv/bin/activate
python -m anatomy_ml.train \
  --manifest /absolute/path/to/anatomy_manifest.csv \
  --output-dir artifacts/ct_anatomy_gate_v1
```

Training outputs belong under `ml_services/artifacts/`. Runtime artifacts should
only be promoted after reviewing their metadata and evaluation reports.

## Verification

```bash
make ml-test
make frontend-test
make frontend-build
make verify-models
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md)
- [`docs/RESEARCH_SCOPE.md`](docs/RESEARCH_SCOPE.md)
- [`docs/FILE_MAP.md`](docs/FILE_MAP.md)
- [`docs/model_cards/lung_ct.md`](docs/model_cards/lung_ct.md)
- [`docs/model_cards/stroke_ct.md`](docs/model_cards/stroke_ct.md)

## Research limitations

- Inference operates on one rendered 2D slice rather than a complete DICOM study.
- Dataset representativeness and external generalization remain limited.
- The anatomy gate reduces unsupported-input risk but cannot guarantee validity.
- Grad-CAM visualizes classifier influence; it is not lesion segmentation.
- Prospective, multi-site, clinician-supervised validation has not been performed.

## Contribution scope

The primary portfolio contribution is the lung CT module, Grad-CAM integration,
frontend development, and system integration. The brain-stroke module was led by
another team member. See [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md).
