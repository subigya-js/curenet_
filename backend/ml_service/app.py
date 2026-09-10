"""Inference API for the recovered CureNet imaging models.

The saved artifacts define preprocessing and output contracts. This service is
a research demonstration and must not be used as a medical diagnostic system.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path
from typing import Annotated, Literal

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from validator import validate_radiological_scan

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
STROKE_MODEL_PATH = MODEL_DIR / "brain_stroke.keras"
LUNG_MODEL_PATH = MODEL_DIR / "lung_cancer.keras"
MAX_UPLOAD_BYTES = int(os.getenv("CURENET_MAX_UPLOAD_BYTES", 10 * 1024 * 1024))
Image.MAX_IMAGE_PIXELS = 25_000_000

STROKE_INPUT_SHAPE = (224, 224, 3)
LUNG_INPUT_SHAPE = (128, 128, 3)
RESEARCH_WARNING = (
    "Research demonstration only. This output is not a medical diagnosis and "
    "must not replace evaluation by a qualified clinician."
)


def _lung_class_names() -> tuple[str, str, str]:
    raw = os.getenv("CURENET_LUNG_CLASS_NAMES", "class_0,class_1,class_2")
    names = tuple(item.strip() for item in raw.split(",") if item.strip())
    if len(names) != 3:
        raise RuntimeError("CURENET_LUNG_CLASS_NAMES must contain exactly 3 labels")
    return names  # type: ignore[return-value]


LUNG_CLASS_NAMES = _lung_class_names()
models: dict[str, object] = {}


class PredictionResponse(BaseModel):
    analysis_type: str
    prediction: str
    probability: float
    probabilities: dict[str, float]
    message: str
    status_badge: str
    status_level: str
    clinical_summary: str
    confidence_label: str
    recommended_action: str
    patient_headline: str
    patient_explanation: str
    common_causes: list[str] = []
    warning: str = RESEARCH_WARNING


def validate_model_contract(
    model: object, expected_input: tuple[int, int, int], output_units: int
) -> None:
    input_shape = tuple(getattr(model, "input_shape")[1:])
    actual_output_units = int(getattr(model, "output_shape")[-1])
    if input_shape != expected_input or actual_output_units != output_units:
        raise RuntimeError(
            "Model contract mismatch: "
            f"expected input {expected_input} and {output_units} output unit(s), "
            f"got {input_shape} and {actual_output_units}"
        )


def load_models() -> dict[str, object]:
    from tensorflow.keras.models import load_model

    loaded: dict[str, object] = {}

    if STROKE_MODEL_PATH.exists():
        try:
            stroke_model = load_model(STROKE_MODEL_PATH, compile=False)
            validate_model_contract(stroke_model, STROKE_INPUT_SHAPE, 1)
            loaded["stroke"] = stroke_model
            print(f"[ML Service] Loaded brain stroke model from {STROKE_MODEL_PATH}")
        except Exception as e:
            print(f"[Warning] Failed loading brain stroke model: {e}")
    else:
        print(
            f"[Notice] Brain stroke model artifact not found at {STROKE_MODEL_PATH}. "
            "Download it from https://www.kaggle.com/models/divyanshusharma0802/brain-stroke-model"
        )

    if LUNG_MODEL_PATH.exists():
        try:
            lung_model = load_model(LUNG_MODEL_PATH, compile=False)
            validate_model_contract(lung_model, LUNG_INPUT_SHAPE, 3)
            loaded["lung"] = lung_model
            print(f"[ML Service] Loaded lung model from {LUNG_MODEL_PATH}")
        except Exception as e:
            print(f"[Warning] Failed loading lung model: {e}")
    else:
        print(f"[Notice] Lung cancer model artifact not found at {LUNG_MODEL_PATH}.")

    return loaded


@asynccontextmanager
async def lifespan(_: FastAPI):
    models.update(load_models())
    yield
    models.clear()


app = FastAPI(
    title="CureNet Medical Imaging Research API",
    version="2.0.0",
    lifespan=lifespan,
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CURENET_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8801,http://127.0.0.1:8801",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if "*" not in allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "CureNet medical imaging research API", "warning": RESEARCH_WARNING}


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "models_loaded": sorted(models),
        "available_models": {
            "stroke": "stroke" in models,
            "lung": "lung" in models,
        },
    }


def decode_and_preprocess(contents: bytes, target_size: tuple[int, int]) -> np.ndarray:
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="The uploaded file is too large")

    try:
        with Image.open(BytesIO(contents)) as opened:
            if opened.format not in {"JPEG", "PNG"}:
                raise HTTPException(status_code=400, detail="Upload a JPEG or PNG image")
            opened.verify()
        with Image.open(BytesIO(contents)) as opened:
            # 1. Gatekeeper: Validate physical radiological scan properties
            is_valid, reason = validate_radiological_scan(opened)
            if not is_valid:
                raise HTTPException(
                    status_code=422,
                    detail=f"Out-of-distribution image rejected: {reason} Please upload an authentic axial CT/MRI scan.",
                )

            image = ImageOps.exif_transpose(opened).convert("RGB")
            image = image.resize(target_size, Image.Resampling.BILINEAR)
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail="Upload a valid JPEG or PNG image") from exc

    array = np.asarray(image, dtype=np.float32) / 255.0
    return np.expand_dims(array, axis=0)


def stroke_response(raw_output: np.ndarray) -> PredictionResponse:
    stroke_score = float(np.asarray(raw_output).reshape(-1)[0])
    stroke_score = float(np.clip(stroke_score, 0.0, 1.0))
    is_stroke = stroke_score >= 0.5
    prediction = "stroke" if is_stroke else "no_stroke"
    probability = stroke_score if is_stroke else 1.0 - stroke_score

    conf_desc = "High Match" if probability >= 0.85 else "Moderate Match" if probability >= 0.65 else "Low Match"
    confidence_label = f"{conf_desc} ({probability:.1%})"

    if is_stroke:
        status_badge = "Possible Stroke Pattern Flagged"
        status_level = "danger"
        patient_headline = "Unusual brain tissue changes detected that require immediate doctor review."
        patient_explanation = (
            "The computer detected an area where brain tissue looks different than normal, which could indicate "
            "restricted blood flow (an ischemic stroke) or bleeding. Because brain tissue requires fast medical attention, "
            "this scan should be evaluated by an emergency doctor right away."
        )
        common_causes = [
            "Acute blood clot or restricted blood flow (ischemic stroke)",
            "Localized brain tissue inflammation or swelling",
            "Bleeding (hemorrhagic episode) or transient ischemic event (TIA)",
        ]
        clinical_summary = (
            "The neural network detected visual density variations in the brain scan consistent with "
            "acute ischemic changes. This algorithmic finding requires urgent clinical evaluation."
        )
        recommended_action = (
            "Consult an emergency neurologist or attending physician immediately. Correlate with physical symptoms."
        )
    else:
        status_badge = "No Signs of Stroke Detected"
        status_level = "success"
        patient_headline = "Brain tissue looks symmetric and normal in this scan slice."
        patient_explanation = (
            "The computer examined both sides of the brain and found normal tissue balance with no obvious bleeding "
            "or blocked areas visible. Keep in mind that some minor or very early episodes might not show on a basic scan."
        )
        common_causes = [
            "Normal, healthy symmetric brain tissue",
            "No visible acute bleeding or ischemic damage in this slice",
        ]
        clinical_summary = (
            "The imaging pipeline did not observe visual indicators of acute cerebral infarction or hemorrhage in this scan."
        )
        recommended_action = (
            "No emergency scan findings. If you or a loved one experiences sudden face drooping, arm weakness, or speech trouble, seek emergency care immediately."
        )

    return PredictionResponse(
        analysis_type="stroke",
        prediction=prediction,
        probability=probability,
        probabilities={"no_stroke": 1.0 - stroke_score, "stroke": stroke_score},
        message=f"Model output: {prediction} ({probability:.1%} score)",
        status_badge=status_badge,
        status_level=status_level,
        clinical_summary=clinical_summary,
        confidence_label=confidence_label,
        recommended_action=recommended_action,
        patient_headline=patient_headline,
        patient_explanation=patient_explanation,
        common_causes=common_causes,
    )


def lung_response(raw_output: np.ndarray) -> PredictionResponse:
    scores = np.asarray(raw_output, dtype=np.float64).reshape(-1)
    if scores.size != len(LUNG_CLASS_NAMES):
        raise RuntimeError(f"Expected 3 lung outputs, received {scores.size}")
    best_index = int(np.argmax(scores))
    probability = float(scores[best_index])
    prediction = LUNG_CLASS_NAMES[best_index]
    probabilities = {
        name: float(score) for name, score in zip(LUNG_CLASS_NAMES, scores)
    }

    conf_desc = "High Match" if probability >= 0.85 else "Moderate Match" if probability >= 0.65 else "Low Match"
    confidence_label = f"{conf_desc} ({probability:.1%})"

    if best_index == 0:
        status_badge = "Scan Appears Clear"
        status_level = "success"
        patient_headline = "Clear Lung Tissue: No abnormal shadows or dense spots detected in this slice."
        patient_explanation = (
            "Healthy lungs on a CT scan appear mostly dark because they are filled with air. In this slice, the computer "
            "found uniform, open lung fields with normal branching blood vessels and no suspicious cloudy patches, "
            "masses, or dense nodules. While a full checkup always considers your complete 3D scan series and symptoms, "
            "this section shows standard healthy lung appearance."
        )
        common_causes = [
            "Normal, open air-filled lung spaces (alveoli)",
            "Healthy airway and vascular structure without obstruction",
            "Absence of detectable consolidated fluid, nodules, or masses",
            "Good baseline scan appearance",
        ]
        clinical_summary = (
            "The automated screening shows predominantly uniform radiolucent lung field density with no dominant "
            "nodular masses, consolidated opacities, or gross architectural distortion detected in this axial slice."
        )
        recommended_action = (
            "Routine health maintenance. If you have lingering cough, shortness of breath, or chest discomfort, "
            "always share your full imaging scan with your physician."
        )
    elif best_index == 1:
        status_badge = "Doctor Review Recommended (Hazy Shadow Found)"
        status_level = "warning"
        patient_headline = "Mild Tissue Variation: A hazy or clouded patch was detected in the lung field."
        patient_explanation = (
            "The computer highlighted an area that looks hazier or thicker than the normal dark, air-filled lung tissue. "
            "In radiology, this is often called 'ground-glass opacity' or localized infiltration.\n\n"
            "⚠️ Please do NOT panic: This finding does NOT mean cancer. In the vast majority of patients, hazy lung patches "
            "are temporary reactions caused by common, treatable conditions like a recent chest cold, seasonal flu, "
            "minor inflammation, or harmless healing tissue. A doctor will review your full scan, listen to your breathing, "
            "and determine if simple observation or antibiotics are appropriate."
        )
        common_causes = [
            "Recent viral or bacterial chest infection (bronchitis, mild pneumonia, chest cold)",
            "Benign post-infection scarring from a past respiratory illness",
            "Mild inflammation or small localized fluid retention",
            "Airway irritation from smoke, dust, seasonal allergies, or acid reflux",
            "Early tissue changes that your physician can easily monitor over time",
        ]
        clinical_summary = (
            "The model identified localized non-uniform attenuation (ground-glass/infiltrative pattern) in the lung field "
            "differing from uniform radiolucency. Non-malignant etiologies (infectious, post-inflammatory, or interstitial) "
            "frequently exhibit this presentation. Clinical and radiological correlation is advised."
        )
        recommended_action = (
            "Schedule a standard doctor's consultation. Bring your scan files or CD so your doctor can evaluate this "
            "finding alongside your symptoms, medical history, and stethoscope exam."
        )
    else:
        status_badge = "Doctor Evaluation Advised (Dense Spot Found)"
        status_level = "danger"
        patient_headline = "Focal Density Detected: A concentrated white spot or nodule was identified."
        patient_explanation = (
            "The computer detected a distinct, concentrated white spot (often called a 'pulmonary nodule') in this slice "
            "that is denser than surrounding lung air space.\n\n"
            "⚠️ What this means for you: Lung spots are extremely common—up to half of all adults who get a CT scan have "
            "one or more nodules. More than 90% of small lung nodules turn out to be completely non-cancerous (benign), "
            "frequently representing old healed scars, small lymph nodes, or past minor infections. Because nodules cannot "
            "be fully diagnosed by AI alone, a pulmonologist or radiologist must examine the spot's exact borders, size, "
            "and density to recommend the right follow-up."
        )
        common_causes = [
            "Benign (harmless) pulmonary nodule or hamartoma",
            "Calcified granuloma or scar tissue from a past healed infection",
            "Active or resolving focal lung infection",
            "Intrapulmonary lymph node reacting to normal environmental dust",
            "Tissue change requiring clinical correlation and possible follow-up scan",
        ]
        clinical_summary = (
            "The model flagged concentrated structural opacity or focal nodular morphology in this slice. "
            "Differential diagnosis includes granulomatous disease, healed infection, benign hamartoma, or focal lesion. "
            "Formal radiologic review with prior comparison scans is strongly recommended."
        )
        recommended_action = (
            "Arrange an appointment with a pulmonologist or attending physician. They can compare this scan with any "
            "earlier scans you have had or schedule a clear follow-up check."
        )

    return PredictionResponse(
        analysis_type="lung",
        prediction=prediction,
        probability=probability,
        probabilities=probabilities,
        message=f"Model output: {prediction} ({probability:.1%} score)",
        status_badge=status_badge,
        status_level=status_level,
        clinical_summary=clinical_summary,
        confidence_label=confidence_label,
        recommended_action=recommended_action,
        patient_headline=patient_headline,
        patient_explanation=patient_explanation,
        common_causes=common_causes,
    )


@app.post("/predict", response_model=PredictionResponse)
async def predict(
    file: Annotated[UploadFile, File(...)],
    analysis_type: Annotated[Literal["stroke", "lung", "cancer"], Form()] = "stroke",
) -> PredictionResponse:
    normalized_type = "lung" if analysis_type == "cancer" else analysis_type
    target_size = (
        STROKE_INPUT_SHAPE[:2]
        if normalized_type == "stroke"
        else LUNG_INPUT_SHAPE[:2]
    )
    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    image_batch = decode_and_preprocess(contents, target_size)

    model = models.get(normalized_type)
    if model is None:
        missing_filename = "brain_stroke.keras" if normalized_type == "stroke" else "lung_cancer.keras"
        raise HTTPException(
            status_code=503,
            detail=(
                f"Model for '{normalized_type}' is not loaded. "
                f"Please ensure '{missing_filename}' is present in backend/ml_service/models/."
            ),
        )

    raw_output = await run_in_threadpool(
        model.predict, image_batch, verbose=0  # type: ignore[attr-defined]
    )
    return (
        stroke_response(raw_output)
        if normalized_type == "stroke"
        else lung_response(raw_output)
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=False)
