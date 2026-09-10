# CureNet AHMS

CureNet is an undergraduate healthcare-management web application with separate
Node/Express application services and a Python/FastAPI medical-imaging research
service.

> Research use only: imaging model outputs are not diagnoses and must not replace
> evaluation by a qualified clinician.

## Repository layout

```text
curenet/                    React frontend
backend/                    Node/Express API and database layer
backend/ml_service/         FastAPI inference and ML training code
  models/                   Keras artifacts and model metadata
  training/                 Dataset, model, and metric modules
  tests/                    Inference-contract and training tests
  reports/lung/             Reproducibility manifests and evaluation
```

## Run the web application

Install the frontend and backend dependencies in their respective directories.
Configure `backend/.env` from `backend/.env.example`, including the local MySQL
credentials expected by the Node service.

```bash
cd curenet
npm install
npm start
```

In another terminal:

```bash
cd backend
npm install
npm start
```

## Train and run the lung ML service

Python 3.11 is the supported setup. From the repository root:

```bash
cd backend/ml_service
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements-train.txt
python download_lung_dataset.py
python train_lung.py
uvicorn app:app --host 127.0.0.1 --port 8000
```

The training command creates `models/lung_cancer_retrained.keras`. When that
file exists, the service prefers it over the recovered legacy artifact and reads
its adjacent metadata for the verified `normal`, `benign`, and `malignant` label
order. Override the choice with `CURENET_LUNG_MODEL_PATH` when necessary.

For lung predictions, the service runs Grad-CAM layer-by-layer across the
MobileNetV2 feature extractor and returns an attention overlay along with
activation area percentage, peak coordinates, and all three class scores.
Grad-CAM shows classifier attention; it is not lesion segmentation or cancer
localization.

The model binary and dataset are ignored by Git because they are reproducible
and large. The split manifest, summary, model metadata, and test metrics remain
versionable evidence. See
[`backend/ml_service/TRAINING.md`](backend/ml_service/TRAINING.md) for the exact
workflow and [`backend/ml_service/MODEL_CARD.md`](backend/ml_service/MODEL_CARD.md)
for results and limitations.

## Verify the ML code

```bash
cd backend/ml_service
.venv/bin/python -m pytest -q
```

You can also use the backend convenience commands after creating the Python
environment:

```bash
cd backend
npm run ml:download:lung
npm run ml:train:lung
npm run ml:start
```

## Brain-stroke status

The brain-stroke artifact and a reproducible training pipeline are not yet part
of this repository. The current API reports that model as unavailable when
`backend/ml_service/models/brain_stroke.keras` is absent. The lung work should
serve as the engineering pattern, but a stroke dataset and label definition must
be evaluated independently rather than copying lung assumptions.
