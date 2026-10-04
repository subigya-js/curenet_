# CureNet runbook

## Components

| Component | Responsibility | Default address |
|---|---|---|
| React | Lung and brain-stroke imaging interface | `http://localhost:3000` |
| FastAPI | Model loading, validation, anatomy routing, inference, Grad-CAM | `http://127.0.0.1:8000` |

## Install and start the API

```bash
make api-install
make api-start
```

To use the verified environment already present in this workspace:

```bash
make api-start ML_VENV=.venv-tf220
```

Check readiness:

```bash
curl http://127.0.0.1:8000/api/v1/health
```

## Install and start the frontend

```bash
make frontend-install
make frontend-start
```

The frontend reads `REACT_APP_ML_API_URL` from `frontend/.env` and defaults to
`http://127.0.0.1:8000`.

## Imaging request

```bash
curl -X POST http://127.0.0.1:8000/api/v1/imaging/predict \
  -F "analysis_type=lung" \
  -F "file=@/absolute/path/to/lung-ct.png"
```

Use `analysis_type=stroke` for a rendered head CT slice.

## Verification

```bash
make ml-test
make frontend-test
make frontend-build
make verify-models
```

With the verified local ML environment:

```bash
make ml-test ML_VENV=.venv-tf220
```

## Training

```bash
make training-install
```

Lung:

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

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `REACT_APP_ML_API_URL` | `http://127.0.0.1:8000` | Frontend API base URL |
| `CURENET_LUNG_MODEL_PATH` | `models/lung_cancer_retrained.keras` | Override lung artifact path |
| `CURENET_REQUIRE_ANATOMY_GATE` | `true` | Fail closed if the anatomy gate is unavailable |
| `CURENET_MAX_UPLOAD_BYTES` | `10485760` | Maximum in-memory upload size |
| `CURENET_ALLOWED_ORIGINS` | local frontend origins | Comma-separated CORS origins |

Never bypass the anatomy gate outside isolated interface development.

## Common failures

### `inference_ready` is false

Inspect `available_models` in the health response, confirm the required model and
metadata pairs exist, and run `make verify-models`.

### Upload rejected

Use an authentic rendered axial CT image in PNG or JPEG format and select the
matching analysis mode. Unsupported or anatomy-mismatched input is rejected.

### Frontend cannot reach FastAPI

Confirm the API is running, verify `REACT_APP_ML_API_URL`, and restart React after
changing frontend environment variables.
