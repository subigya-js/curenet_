# CureNet file map

## Root

| Path | Purpose |
|---|---|
| `README.md` | Project overview, startup, training, verification, and limitations. |
| `CONTRIBUTIONS.md` | Team contribution boundaries. |
| `Makefile` | Reproducible frontend, API, training, test, and verification commands. |
| `scripts/verify_models.py` | Verifies runtime artifact checksums from the manifest. |

## FastAPI and inference

| Path | Purpose |
|---|---|
| `ml_services/app.py` | Loads image models, validates contracts, exposes health and imaging endpoints, preprocesses input, runs inference, and creates lung Grad-CAM. |
| `ml_services/imaging/validator.py` | Rejects malformed or implausible radiological uploads. |
| `ml_services/imaging/anatomy_gate.py` | Anatomy-gate metadata validation and output interpretation. |
| `ml_services/models/manifest.json` | Expected runtime artifact checksums. |
| `ml_services/models/*.metadata.json` | Class order, input shape, preprocessing, and model-version contracts. |

## Training packages

| Path | Purpose |
|---|---|
| `ml_services/lung_ml/` | Lung data preparation, MobileNetV2 model, metrics, download, and training entry point. |
| `ml_services/stroke_ml/` | Stroke data audit, preparation, EfficientNetV2B0 model, metrics, and training entry point. |
| `ml_services/anatomy_ml/` | Anatomy-gate configuration, data loading, model, metrics, and training entry point. |
| `ml_services/reports/lung/` | Versioned lung split and evaluation evidence. |
| `notebooks/train_brain_stroke_colab.ipynb` | Colab workflow for brain-stroke training. |

## Tests

| Path | Purpose |
|---|---|
| `ml_services/tests/test_model_contracts.py` | Runtime preprocessing, outputs, response semantics, and Grad-CAM tests. |
| `ml_services/tests/test_anatomy_gate.py` | Anatomy-gate metadata and decision tests. |
| `ml_services/tests/test_validator.py` | Uploaded-image validation tests. |
| `ml_services/tests/test_training_data.py` | Training-data split and leakage safeguards. |
| `ml_services/tests/test_anatomy_training.py` | Anatomy training pipeline tests. |

## Frontend

| Path | Purpose |
|---|---|
| `frontend/src/pages/HomePage.js` | Medical computer-vision project overview. |
| `frontend/src/pages/ImagingPage.js` | Lung and brain-stroke image upload and result interface. |
| `frontend/src/pages/MethodologyPage.js` | Model architecture and contract summaries. |
| `frontend/src/pages/AboutPage.js` | Project and team contribution scope. |
| `frontend/src/config/api.js` | FastAPI health and imaging endpoint URLs. |

## Documentation

| Path | Purpose |
|---|---|
| `docs/ARCHITECTURE.md` | Runtime components, request flow, and failure behavior. |
| `docs/RESEARCH_SCOPE.md` | Included research questions, exclusions, and claim boundary. |
| `docs/RUNBOOK.md` | Installation, startup, tests, training, and configuration. |
| `docs/model_cards/lung_ct.md` | Lung model intended use, contract, evidence, and limitations. |
| `docs/model_cards/stroke_ct.md` | Stroke model intended use, contract, evidence, and limitations. |
