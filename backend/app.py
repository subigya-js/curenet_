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

    missing = [
        str(path)
        for path in (STROKE_MODEL_PATH, LUNG_MODEL_PATH)
        if not path.exists()
    ]
    if missing:
        raise RuntimeError(f"Missing model artifact(s): {', '.join(missing)}")

    stroke_model = load_model(STROKE_MODEL_PATH, compile=False)
    lung_model = load_model(LUNG_MODEL_PATH, compile=False)
    validate_model_contract(stroke_model, STROKE_INPUT_SHAPE, 1)
    validate_model_contract(lung_model, LUNG_INPUT_SHAPE, 3)
    return {"stroke": stroke_model, "lung": lung_model}


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
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "CureNet medical imaging research API", "warning": RESEARCH_WARNING}


@app.get("/health")
async def health() -> dict[str, object]:
    return {"status": "ok", "models_loaded": sorted(models)}


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
            image = ImageOps.exif_transpose(opened).convert("RGB")
            image = image.resize(target_size, Image.Resampling.BILINEAR)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail="Upload a valid JPEG or PNG image") from exc

    array = np.asarray(image, dtype=np.float32) / 255.0
    return np.expand_dims(array, axis=0)


def stroke_response(raw_output: np.ndarray) -> PredictionResponse:
    stroke_score = float(np.asarray(raw_output).reshape(-1)[0])
    stroke_score = float(np.clip(stroke_score, 0.0, 1.0))
    prediction = "stroke" if stroke_score >= 0.5 else "no_stroke"
    probability = stroke_score if prediction == "stroke" else 1.0 - stroke_score
    return PredictionResponse(
        analysis_type="stroke",
        prediction=prediction,
        probability=probability,
        probabilities={"no_stroke": 1.0 - stroke_score, "stroke": stroke_score},
        message=f"Model output: {prediction} ({probability:.1%} score)",
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
    return PredictionResponse(
        analysis_type="lung",
        prediction=prediction,
        probability=probability,
        probabilities=probabilities,
        message=f"Model output: {prediction} ({probability:.1%} score)",
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
        raise HTTPException(status_code=503, detail="Model is not loaded")

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
