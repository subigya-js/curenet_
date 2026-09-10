# CureNet AHMS

CureNet is an undergraduate group project that includes a web application and
two medical-imaging research prototypes: binary brain-stroke analysis and
three-class lung-image classification.

> **Research use only:** model outputs are not medical diagnoses and must not
> replace evaluation by a qualified clinician.

## Restoring the imaging backend

Use Python 3.11. The lung model is already stored at
`backend/models/lung_cancer.keras`. Download the brain model from the original
[Kaggle model page](https://www.kaggle.com/models/divyanshusharma0802/brain-stroke-model)
and save it as `backend/models/brain_stroke.keras`.

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```

The frontend sends requests to `http://127.0.0.1:8000`. See
[`backend/MODEL_CARD.md`](backend/MODEL_CARD.md) for recovered model contracts,
unknowns, limitations, and the evaluation work required before reporting any
scientific performance.

## Important provenance gap

The original dataset manifests and lung class-to-index mapping are unavailable.
The API intentionally exposes the lung outputs as `class_0`, `class_1`, and
`class_2`. Set `CURENET_LUNG_CLASS_NAMES` only after verifying the exact mapping
from original records; guessing disease labels would create misleading results.
