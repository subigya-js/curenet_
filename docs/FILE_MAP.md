# CureNet non-frontend file map

This document explains every versioned non-frontend file or file type and how
it connects to the rest of the system. Frontend implementation files are
intentionally omitted; see `frontend/README.md` for that application.

## Repository root

| File | Purpose and connections |
|---|---|
| `.gitattributes` | Normalizes text-file line endings through Git. It has no runtime role. |
| `.gitignore` | Excludes environments, datasets, generated model weights, checkpoints, caches, and build output. This keeps source control focused on code and reproducibility evidence. |
| `README.md` | Main project entry point: scope, architecture summary, setup, API, training, tests, and links to detailed documents. |
| `CONTRIBUTIONS.md` | Records individual and collaborative ownership so portfolio claims remain accurate. |
| `LICENSE` | Defines the source-code license. Dataset and artifact licenses remain separate. |
| `Makefile` | Provides stable commands for installing, starting, testing, building, and verifying the frontend/FastAPI/model artifacts. It delegates to npm, Python, pytest, Uvicorn, and `scripts/verify_models.py`. |

## Repository documentation

| File | Purpose and connections |
|---|---|
| `docs/ARCHITECTURE.md` | Describes runtime request flows and the boundary between training code and exported models. |
| `docs/RUNBOOK.md` | First-time installation, startup order, manual API calls, testing, training, configuration, and troubleshooting. |
| `docs/FILE_MAP.md` | This file: ownership and dependency map for every non-frontend file. |
| `docs/RESEARCH_SCOPE.md` | Fixes the supported research questions, inputs, outputs, prohibited claims, and evaluation boundaries. Model cards and UI wording should remain consistent with it. |
| `docs/model_cards/lung_ct.md` | Records intended use, architecture, current lung metrics, Grad-CAM interpretation, and limitations. Its numbers originate from `ml_services/reports/lung/test_metrics.json`. |
| `docs/model_cards/stroke_ct.md` | Records the stroke architecture, dataset, preprocessing, reporting requirements, and limitations. It intentionally claims no final performance without a matching evaluation bundle. |

## API and runtime inference

| File | Purpose and connections |
|---|---|
| `ml_services/app.py` | FastAPI entry point. Loads model/metadata pairs, creates the `SymptomRetriever`, defines Pydantic request/response contracts, exposes health/retrieval/imaging endpoints, preprocesses images, routes through the anatomy gate, runs lung or stroke inference, and creates lung Grad-CAM overlays. It imports runtime contracts from `imaging/` and retrieval from `symptom_ir/`; it loads `.keras` files directly rather than importing training model builders. |
| `ml_services/imaging/__init__.py` | Declares the shared imaging runtime package. It intentionally has no side effects. |
| `ml_services/imaging/validator.py` | Applies fast non-neural checks for monochromatic content, foreground coverage, grayscale variation, and contrast before model inference. Called by `app.decode_and_preprocess`. |
| `ml_services/imaging/anatomy_gate.py` | Defines anatomy labels, expected anatomy per analysis type, metadata validation, confidence/margin thresholding, and `AnatomyGateResult`. Used by `app.py`; its constants are also reused by `anatomy_ml` so training and runtime labels cannot drift. |

## Anatomy-gate training package

| File | Purpose and connections |
|---|---|
| `ml_services/anatomy_ml/__init__.py` | Re-exports runtime anatomy class names and model version as training constants. This connects training labels to the runtime contract. |
| `ml_services/anatomy_ml/config.py` | Immutable training hyperparameters: image size, seed, epochs, learning rates, dropout, and maximum unsafe-acceptance rate. Consumed by `model.py` and `train.py`. |
| `ml_services/anatomy_ml/data.py` | Reads a reviewed manifest, resolves paths, validates labels/splits, hashes decoded pixels, rejects group or exact-image leakage, writes audit evidence, and builds TensorFlow datasets. Used by `train.py`. |
| `ml_services/anatomy_ml/model.py` | Builds the MobileNetV3Small anatomy classifier and controls frozen-head and fine-tuning phases. Used only by `train.py`. |
| `ml_services/anatomy_ml/metrics.py` | Chooses probability/margin abstention thresholds on validation data and evaluates coverage and unsafe acceptance on test data. Used by `train.py`. |
| `ml_services/anatomy_ml/train.py` | Orchestrates audit, datasets, class weighting, training, checkpoint selection, threshold selection, test evaluation, and export of the anatomy `.keras` file and metadata. Its outputs are copied into `models/` after review. |
| `ml_services/anatomy_ml/README.md` | Defines required manifest columns, data-source expectations, commands, generated outputs, and acceptance criteria. |

## Lung CT training package

| File | Purpose and connections |
|---|---|
| `ml_services/lung_ml/__init__.py` | Marks `lung_ml` as an importable Python package without triggering TensorFlow work. |
| `ml_services/lung_ml/download.py` | Downloads the IQ-OTH/NCCD mirror with `kagglehub` into the ignored data directory. Its output becomes the input to `train.py`. |
| `ml_services/lung_ml/data.py` | Maps source-directory aliases to `normal`, `benign`, and `malignant`; discovers images; performs deterministic stratified slice-level splitting; and writes split manifests/summaries. Used by `train.py` and its tests. |
| `ml_services/lung_ml/model.py` | Builds MobileNetV2 with augmentation, normalization, pooling, dropout, and a three-class head; also controls fine-tuning. Used only by `train.py`. |
| `ml_services/lung_ml/metrics.py` | Calculates accuracy, balanced accuracy, macro F1, confusion matrix, and per-class precision/recall/F1. Writes `ml_services/reports/lung/test_metrics.json` when training is launched from `ml_services/`. |
| `ml_services/lung_ml/train.py` | Coordinates reproducibility seeds, datasets, class weights, frozen-head training, fine-tuning, validation-based candidate selection, held-out evaluation, final model export, and metadata export. It connects all other `lung_ml` modules. |
| `ml_services/lung_ml/README.md` | Documents source data, license, commands, output files, slice-level limitation, Grad-CAM boundary, and work required before a clinical claim. |

## Brain-stroke training package

| File | Purpose and connections |
|---|---|
| `ml_services/stroke_ml/__init__.py` | Defines the fixed three-class order and `stroke-ct-v2` version shared across training modules. |
| `ml_services/stroke_ml/config.py` | Immutable EfficientNetV2B0 training and split configuration. Used by `model.py` and `train.py`, and serialized into exported metadata. |
| `ml_services/stroke_ml/data.py` | Discovers eligible CT images, infers labels, excludes masks/overlays, loads external binary labels, hashes decoded pixels, removes exact duplicates, assigns deterministic stratified splits, saves manifests/audits, and builds TensorFlow datasets. Used by `train.py`. |
| `ml_services/stroke_ml/model.py` | Builds the EfficientNetV2B0 classifier, compilation settings, and fine-tuning policy. Used only by `train.py`. |
| `ml_services/stroke_ml/metrics.py` | Writes internal multiclass metrics, bootstrap intervals, calibration error, predictions and confusion matrix; separately evaluates the external binary stroke score. Used by `train.py`. |
| `ml_services/stroke_ml/train.py` | Downloads/accepts the dataset, audits it, builds splits, trains the head and fine-tuning stage, evaluates internal and external sets, and exports the model and metadata. |
| `ml_services/stroke_ml/DATASET_AUDIT.md` | Records the independently observed Kaggle archive inventory, duplicate findings, deterministic split counts, and patient-identifier limitation. `data.py` repeats the audit on every run. |
| `ml_services/stroke_ml/README.md` | Defines task scope, dataset choice, training commands, output bundle, evaluation policy, and redistribution limitation. |

## Symptom information retrieval

| File | Purpose and connections |
|---|---|
| `ml_services/symptom_ir/__init__.py` | Exposes `SymptomRetriever` as the package API. |
| `ml_services/symptom_ir/service.py` | Loads the corpus, tokenizes text, expands a small synonym map, precomputes IDF/document vectors, ranks with 75% TF-IDF cosine plus 25% Jaccard, and detects emergency phrases. Instantiated once by `app.py`. |
| `ml_services/symptom_ir/data/conditions.csv` | Versioned 391-condition retrieval corpus. `service.py` reads its `Disease` and `Symptoms` columns at API startup. It is research data, not a diagnostic knowledge base. |

## Runtime models and metadata

| File | Purpose and connections |
|---|---|
| `ml_services/models/README.md` | Explains the artifact boundary, required model/metadata pairs, verification, and replacement policy. |
| `ct_anatomy_gate_v1.keras` | Serialized anatomy-routing weights loaded by `app.py`. Generated by `anatomy_ml/train.py`; excluded from Git because it is large. |
| `ct_anatomy_gate_v1.metadata.json` | Runtime anatomy class order, input/resize contract, selected thresholds, data audit, evaluation and deployment-ready flag. Validated by `imaging/anatomy_gate.py`. |
| `ct_anatomy_gate_v1.metadata.example.json` | Minimal schema example for understanding or validating a future metadata file; it is not loaded at runtime. |
| `brain_stroke_v2.keras` | Serialized three-class stroke model loaded by `app.py`. Generated by `stroke_ml/train.py`; excluded from Git. |
| `brain_stroke_v2.metadata.json` | Runtime class order, version, image size, resize policy, training configuration and dataset description. Validated by `app.py`. |
| `brain_stroke_v2.metadata.example.json` | Minimal stroke metadata schema example; not loaded at runtime. |
| `lung_cancer_retrained.keras` | Serialized MobileNetV2 lung classifier loaded by `app.py` and used for Grad-CAM. Generated by `lung_ml/train.py`; excluded from Git. |
| `lung_cancer_retrained.metadata.json` | Required lung label order, input shape, dataset/split description, metrics, training configuration and limitations. Read by `app.py` before the FastAPI application is created. |
| `manifest.json` | Expected filenames, byte sizes, metadata partners and SHA-256 values for all runtime models. Read by `scripts/verify_models.py`, not by inference. |

## Lung evaluation evidence

| File | Purpose and connections |
|---|---|
| `ml_services/reports/lung/base_candidate.training.csv` | Epoch log from frozen-backbone training. Useful for learning-curve and convergence review. |
| `ml_services/reports/lung/fine_tuned_candidate.training.csv` | Epoch log from low-learning-rate backbone fine-tuning. |
| `ml_services/reports/lung/split_manifest.csv` | Exact image-to-split assignment for the recorded lung run. Its hash is referenced by summary, metrics, and model metadata. |
| `ml_services/reports/lung/split_summary.json` | Per-class split counts, strategy, manifest hash and leakage limitation. |
| `ml_services/reports/lung/test_metrics.json` | Held-out slice-level results and confusion matrix used by the lung model card. |

## Dependencies and tooling configuration

| File | Purpose and connections |
|---|---|
| `ml_services/requirements.txt` | Runtime dependencies for FastAPI, TensorFlow inference, Pillow and multipart uploads. Included by `requirements-dev.txt`. |
| `ml_services/requirements-dev.txt` | Runtime dependencies plus pytest and HTTPX for development/API testing. Included by `requirements-train.txt`. |
| `ml_services/requirements-train.txt` | Adds Kaggle download, pandas, scikit-learn, Matplotlib and Seaborn for all training/evaluation pipelines. |
| `ml_services/pyproject.toml` | Points pytest at `tests/`, adds `ml_services` to its import path, and defines Ruff's Python version, line length and lint rules. |

## Tests

| File | Purpose and connections |
|---|---|
| `tests/test_anatomy_gate.py` | Tests runtime anatomy metadata validation, threshold interpretation, abstention and anatomy mismatch rejection. |
| `tests/test_anatomy_training.py` | Tests manifest audit/leakage rejection and threshold-selection safety behavior. |
| `tests/test_model_contracts.py` | Tests exported lung architecture, preprocessing, stroke/lung responses, model shape checks, metadata class order and Grad-CAM output. |
| `tests/test_symptom_ir.py` | Tests ranking, deterministic synonym expansion and emergency-message behavior against the real corpus. |
| `tests/test_training_data.py` | Tests lung dataset discovery, deterministic disjoint splitting and per-class metrics. |
| `tests/test_validator.py` | Tests acceptance of scan-like monochrome content and rejection of flat graphic content. |

## Notebook and maintenance script

| File | Purpose and connections |
|---|---|
| `notebooks/train_brain_stroke_colab.ipynb` | Colab workflow that obtains the repository, checks GPU access, runs the stroke smoke/full training command, inspects metrics, and exports artifacts to Drive. It calls the same `stroke_ml.train` module as local training. |
| `scripts/verify_models.py` | Streams each runtime model through SHA-256, verifies size and required metadata against `models/manifest.json`, and returns a nonzero exit code on failure. Called by `make verify-models`. |

## Local but intentionally unversioned directories

| Path | Purpose |
|---|---|
| `ml_services/data/` | Downloaded training datasets. Kept outside Git because of size, licensing and privacy/provenance concerns. |
| `ml_services/artifacts/` | Generated stroke/anatomy training bundles before reviewed files are promoted into `models/`. |
| `ml_services/.venv*` | Local Python environments. They are reproducible from requirements files and must not be committed. |
| `frontend/node_modules/` | Locally installed JavaScript dependencies. Recreated by `npm ci`. |

## Dependency summary

```text
app.py
  +-- imaging/validator.py
  +-- imaging/anatomy_gate.py
  +-- symptom_ir/service.py --> symptom_ir/data/conditions.csv
  `-- models/*.keras + matching metadata

anatomy_ml/train.py --> anatomy_ml/{config,data,model,metrics}.py
lung_ml/train.py    --> lung_ml/{data,model,metrics}.py
stroke_ml/train.py  --> stroke_ml/{config,data,model,metrics}.py

scripts/verify_models.py --> models/manifest.json --> models/*.keras + metadata
```
