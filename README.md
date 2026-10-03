# CureNet

**Anatomy-aware medical image classification and symptom information retrieval**

CureNet is a collaborative final-year computer engineering research project.
The focused application combines two CT image-pattern classifiers, an anatomy
and unsupported-input gate, Grad-CAM attention visualization, and a lexical
symptom-retrieval baseline.

> CureNet is an educational research prototype. It is not a medical device and
> must not be used for diagnosis, triage, treatment, or any clinical decision.

## Research modules

| Module | Method | Supported output |
|---|---|---|
| Lung CT | MobileNetV2 transfer learning | `normal`, `benign`, `malignant` |
| Brain stroke | EfficientNetV2B0 transfer learning | `no_stroke`, `ischemic_stroke`, `hemorrhagic_stroke` |
| Anatomy gate | Three-class classifier with abstention thresholds | `head_ct`, `lung_ct`, `unsupported` |
| Symptom retrieval | TF-IDF cosine + Jaccard similarity | Ranked related conditions |

The imaging modules accept one rendered axial CT slice in JPEG or PNG format.
They do not process a complete DICOM study. Grad-CAM shows regions that
influenced a model output; it is not lesion localization or segmentation.

## Focused architecture

```text
React research interface
        |
        v
FastAPI research service
        +-- image validation
        +-- anatomy/OOD gate
        +-- lung CT classifier
        +-- stroke CT classifier
        +-- symptom information retrieval
```

The Node/Express, MySQL, appointment, and administration implementation from
the original hospital-management prototype remains recoverable from Git commit
`435a150`. It is intentionally excluded from the focused medical-AI tree.

## Repository structure

```text
frontend/
  src/pages/              Route-level React pages
  src/styles/             Page and shared styles
  src/config/             Frontend runtime configuration
ml_services/
  app.py                  Versioned FastAPI entry point
  imaging/                Shared image validation and anatomy contracts
  anatomy_ml/             Anatomy-gate training pipeline
  lung_ml/                Lung model, data, metrics, training, and documentation
  stroke_ml/              Stroke model, data, metrics, training, and documentation
  symptom_ir/             Retrieval service and reviewed corpus
  models/                 Runtime artifacts, metadata, and checksum manifest
  reports/                Reproducible evaluation evidence
  tests/                  Model, data, validation, and retrieval tests
docs/model_cards/         Model-specific intended use and limitations
notebooks/                Optional hosted-training notebooks
scripts/                  Repository maintenance utilities
```

Detailed documentation:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): runtime and training data flows
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md): installation, startup, API calls, training, and troubleshooting
- [`docs/FILE_MAP.md`](docs/FILE_MAP.md): purpose and interconnections of every non-frontend file
- [`docs/RESEARCH_SCOPE.md`](docs/RESEARCH_SCOPE.md): supported claims and evaluation boundaries

## Run the focused application

There are two running processes: FastAPI and React. FastAPI is both the HTTP
API and the ML inference service. Model training is offline and does not require
a separate server.

### 1. Install dependencies

Use Python 3.11. TensorFlow compatibility is not guaranteed with Python 3.13.

```bash
make api-install
make frontend-install
make verify-models
```

### 2. Start FastAPI and ML inference

```bash
make api-start
```

Health, model status, and interactive API documentation:

```bash
curl http://127.0.0.1:8000/api/v1/health
```

Open `http://127.0.0.1:8000/docs` to inspect and call the API interactively.

### 3. Start the frontend in a second terminal

```bash
make frontend-start
```

Open `http://localhost:3000`.

See the [runbook](docs/RUNBOOK.md) for first-clone model setup, direct commands,
environment variables, cURL examples, and troubleshooting.

## API

### Image classification

```http
POST /api/v1/imaging/predict
Content-Type: multipart/form-data

file=<jpeg-or-png>
analysis_type=lung|stroke
```

The historical `/predict` path remains as a hidden compatibility alias.

### Symptom retrieval

```http
POST /api/v1/symptoms/search
Content-Type: application/json

{
  "query": "persistent cough chest pain and difficulty breathing",
  "top_k": 5
}
```

Retrieval scores represent lexical similarity to corpus descriptions. They are
not diagnostic confidence or disease probabilities.

## Model selection at runtime

Stroke loading order:

1. `models/brain_stroke_v2.keras`

Lung loading order:

1. `CURENET_LUNG_MODEL_PATH`, when configured
2. `models/lung_cancer_retrained.keras`

The anatomy gate is required by default. Set
`CURENET_REQUIRE_ANATOMY_GATE=false` only for local interface development; the
API marks every resulting prediction as anatomy-unverified.

Large retrained model artifacts are intentionally excluded from Git. A model is
valid only together with its matching metadata and evaluation outputs. A model
download/checksum workflow is planned before public release.

Verify locally available artifacts against the tracked manifest:

```bash
make verify-models
```

## Training

The detailed lung protocol, outputs, and acceptance boundary are documented in
[`ml_services/lung_ml/README.md`](ml_services/lung_ml/README.md). Stroke and anatomy-gate
requirements are documented in their respective package READMEs.

### Lung CT

```bash
cd ml_services
pip install -r requirements-train.txt
python -m lung_ml.download
python -m lung_ml.train
```

### Brain stroke

```bash
cd ml_services
pip install -r requirements-train.txt
python -m stroke_ml.train --output-dir artifacts/stroke_ct_v2
```

### Anatomy gate

```bash
cd ml_services
python -m anatomy_ml.train \
  --manifest /path/to/reviewed-anatomy-manifest.csv \
  --output-dir artifacts/ct_anatomy_gate_v1
```

Do not report a final metric until the corresponding split manifest, config,
predictions, and model metadata come from the same training run.

## Tests

Install the training dependency set before running the complete ML suite:

```bash
make training-install
make frontend-build
make frontend-test
make ml-test
```

The full ML suite requires dependencies from `requirements-train.txt` because
some tests audit training data and model contracts.

## Evaluation limitations

- Current imaging evaluation is slice-level.
- Reliable patient identifiers are not consistently available in the public
  dataset packaging.
- Correlated slices may cross partitions and inflate measured performance.
- No external-site, prospective, subgroup, or clinical validation exists.
- JPEG/PNG input loses DICOM series context and Hounsfield-unit calibration.
- Early ischemic findings may be subtle or absent on one non-contrast CT slice.
- The symptom corpus and relevance judgments have not been clinically validated.

## Contributions

Module ownership and collaborative work are documented in
[`CONTRIBUTIONS.md`](CONTRIBUTIONS.md). The focused portfolio highlights the
lung CT module, Grad-CAM integration, frontend development, and shared symptom
retrieval work while crediting the team-led stroke and original API modules.

## License

Source code is provided under the repository license. Dataset and model-artifact
reuse remains subject to the original dataset licenses and terms.
