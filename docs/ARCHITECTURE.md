# CureNet architecture

## Process model

CureNet has two long-running processes and three offline training pipelines.

```text
Browser
  |
  | HTTP
  v
React frontend (localhost:3000)
  |
  | /api/v1/*
  v
FastAPI application (localhost:8000)
  |-- symptom retrieval (in-process Python service + CSV corpus)
  |-- image validation
  |-- anatomy gate (.keras + metadata)
  |-- lung classifier (.keras + metadata) + Grad-CAM
  `-- stroke classifier (.keras + metadata)

Offline only:
  anatomy_ml/train.py --> anatomy model + metadata + evaluation
  lung_ml/train.py    --> lung model + metadata + evaluation
  stroke_ml/train.py  --> stroke model + metadata + evaluation
```

There is no separate Node API and no independent ML microservice. `app.py` is
both the HTTP API and the runtime ML inference process. Training is deliberately
separate so an API deployment does not download datasets or alter models.

## Imaging request flow

`POST /api/v1/imaging/predict` follows this order:

1. FastAPI validates the multipart request and upload-size limit.
2. Pillow verifies that the input is a decodable JPEG or PNG.
3. `imaging/validator.py` applies conservative grayscale, foreground, and
   contrast checks to reject obvious photographs and graphics.
4. The anatomy model classifies the image as `head_ct`, `lung_ct`, or
   `unsupported`. `imaging/anatomy_gate.py` applies the probability and margin
   thresholds stored in anatomy metadata.
5. The API rejects uncertain, unsupported, or anatomy-mismatched inputs.
6. The requested disease model runs:
   - lung: `lung_cancer_retrained.keras`
   - stroke: `brain_stroke_v2.keras`
7. Lung inference also attempts a Grad-CAM attention overlay.
8. The API attaches model scores, model version, anatomy-gate result, supported
   input scope, and research warnings to the response.

The runtime does not import `lung_ml/model.py` or `stroke_ml/model.py`. Those
files define how new models are trained. FastAPI loads the exported `.keras`
artifacts directly and validates their input/output contracts at startup.

## Symptom-retrieval request flow

`POST /api/v1/symptoms/search` follows this order:

1. Pydantic validates the query length and requested result count.
2. Deterministic emergency phrases are checked first. A match returns a safety
   message and suppresses condition rankings.
3. `SymptomRetriever` tokenizes the query and expands a small reviewed synonym
   map.
4. It compares the query with the 391 corpus rows using TF-IDF cosine
   similarity and token-set Jaccard similarity.
5. The API returns the highest-ranked corpus entries and matching terms.

The retrieval score is text similarity, not diagnostic confidence.

## Training-to-runtime artifact flow

```text
Dataset
  -> data.py: discover/audit/split
  -> model.py: construct transfer-learning model
  -> train.py: fit, select checkpoint, evaluate
  -> metrics.py: write reproducibility evidence
  -> exported .keras + metadata
  -> models/manifest.json checksum entry
  -> app.py startup contract validation
```

Model weights, metadata, split evidence, and reported metrics must belong to the
same run. Replacing only a `.keras` file can silently change class order or
preprocessing, so the API treats metadata as part of the model contract.

## Failure behavior

- Missing or incompatible model metadata: the affected model is not loaded.
- Missing required anatomy gate: imaging requests fail with HTTP 503.
- Unsupported or mismatched anatomy: request fails with HTTP 422.
- Invalid/oversized image: request fails with HTTP 400/413.
- Grad-CAM failure: classification still returns, without an attention map.
- Symptom corpus missing or empty: application import fails; this is intentional
  because retrieval cannot operate correctly without its versioned corpus.

## Security and deployment boundary

The current application processes uploads in memory and does not persist them.
It has no authentication, rate limiting, audit log, encrypted clinical storage,
or regulatory controls. It is suitable for a local research demonstration, not
public clinical deployment.
