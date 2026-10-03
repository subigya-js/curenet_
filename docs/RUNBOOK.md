# CureNet runbook

## What must be started

Only two processes are required:

| Process | Responsibility | Default address |
|---|---|---|
| FastAPI | HTTP API, model loading, inference, Grad-CAM, symptom retrieval | `http://127.0.0.1:8000` |
| React | Browser interface | `http://localhost:3000` |

The ML training packages are commands that finish; they are not servers.

## Prerequisites

- Python 3.11 recommended
- Node.js 18 or 20 with npm
- Approximately 1 GB free for Python/TensorFlow dependencies
- The three expected local `.keras` artifacts under `ml_services/models/`

Check installed model artifacts before starting:

```bash
python3 scripts/verify_models.py
```

All three entries should print `OK`. A fresh Git clone does not include the
large `.keras` files; copy verified artifacts into `ml_services/models/` or
retrain them before starting image inference.

## First-time setup

From the repository root:

```bash
make frontend-install
make api-install
```

`api-install` installs the runtime API plus test dependencies. If this machine
will also train models, install the larger training dependency set instead:

```bash
make training-install
```

Both commands use `ml_services/.venv` by default. To use another environment:

```bash
make api-install ML_VENV=.venv-research
```

## Start the complete application

### Terminal 1: API and ML inference

From the repository root:

```bash
make api-start
```

With the already verified local environment in this workspace:

```bash
make api-start ML_VENV=.venv-tf220
```

Confirm readiness:

```bash
curl http://127.0.0.1:8000/api/v1/health
```

`inference_ready` should be `true`, and `models_loaded` should contain
`anatomy_gate`, `lung`, and `stroke`. Interactive API documentation is available
at `http://127.0.0.1:8000/docs`.

### Terminal 2: frontend

```bash
make frontend-start
```

Open `http://localhost:3000`.

The frontend reads `REACT_APP_ML_API_URL` from `frontend/.env`. The provided
example points to `http://127.0.0.1:8000`.

Stop either development process with `Ctrl+C` in its terminal.

## Run only the API

```bash
cd ml_services
source .venv/bin/activate
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

The API includes both imaging inference and symptom retrieval. There is no
additional API or ML server to start.

## Test the API manually

Symptom retrieval:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/symptoms/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"persistent cough and chest pain","top_k":3}'
```

Lung CT:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/imaging/predict \
  -F 'analysis_type=lung' \
  -F 'file=@/absolute/path/to/lung-slice.png'
```

Brain-stroke CT:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/imaging/predict \
  -F 'analysis_type=stroke' \
  -F 'file=@/absolute/path/to/head-ct-slice.png'
```

## Run tests

The complete ML suite imports training audit and metric modules, so install the
training dependencies first:

```bash
make training-install
make frontend-build
make frontend-test
make ml-test
make verify-models
```

If using this workspace's verified environment:

```bash
make ml-test ML_VENV=.venv-tf220
```

## Train models

Training does not require FastAPI or React to be running.

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

Consult each package README before a full run. Do not overwrite runtime models
until the new run's metadata and evaluation outputs have been reviewed.

## Configuration

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `REACT_APP_ML_API_URL` | React | `http://127.0.0.1:8000` | FastAPI base URL |
| `CURENET_LUNG_MODEL_PATH` | FastAPI | `models/lung_cancer_retrained.keras` | Override lung artifact path |
| `CURENET_REQUIRE_ANATOMY_GATE` | FastAPI | `true` | Fail closed if the anatomy gate is missing |
| `CURENET_MAX_UPLOAD_BYTES` | FastAPI | `10485760` | Maximum in-memory upload size |
| `CURENET_ALLOWED_ORIGINS` | FastAPI | local frontend origins | Comma-separated CORS origins |

Never disable the anatomy gate outside local interface development.

## Common startup failures

### `inference_ready` is false

Read `available_models` in `/api/v1/health` and the API startup log. Confirm the
required `.keras` and metadata pairs exist, then run `make verify-models`.

### `ModuleNotFoundError`

The wrong Python interpreter is active or dependencies were not installed.
Run `make api-install` and start through `make api-start`.

### Frontend cannot reach the API

Confirm FastAPI is running, copy `frontend/.env.example` to `frontend/.env`, and
restart React after changing environment variables.

### Upload is rejected with HTTP 422

The heuristic validator or anatomy gate rejected the image, or the chosen mode
does not match the detected anatomy. Use a clean axial JPEG/PNG CT slice and the
corresponding `lung` or `stroke` mode.
