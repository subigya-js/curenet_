"""Inference API for the recovered CureNet imaging models.

The saved artifacts define preprocessing and output contracts. This service is
a research demonstration and must not be used as a medical diagnostic system.
"""

from __future__ import annotations

import base64
import json
import os
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path
from typing import Annotated, Literal

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from anatomy_gate import (
    ANATOMY_CLASS_NAMES,
    ANATOMY_GATE_VERSION,
    ANATOMY_INPUT_SHAPE,
    EXPECTED_ANATOMY,
    AnatomyGateResult,
    interpret_anatomy_gate_output,
    validate_anatomy_gate_metadata,
)
from validator import validate_radiological_scan

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
ANATOMY_GATE_MODEL_PATH = MODEL_DIR / "ct_anatomy_gate_v1.keras"
ANATOMY_GATE_METADATA_PATH = MODEL_DIR / "ct_anatomy_gate_v1.metadata.json"
STROKE_MODEL_PATH = MODEL_DIR / "brain_stroke.keras"
STROKE_V2_MODEL_PATH = MODEL_DIR / "brain_stroke_v2.keras"
STROKE_V2_METADATA_PATH = MODEL_DIR / "brain_stroke_v2.metadata.json"
RETRAINED_LUNG_MODEL_PATH = MODEL_DIR / "lung_cancer_retrained.keras"
LEGACY_LUNG_MODEL_PATH = MODEL_DIR / "lung_cancer.keras"
configured_lung_model = os.getenv("CURENET_LUNG_MODEL_PATH")
if configured_lung_model:
    configured_path = Path(configured_lung_model)
    LUNG_MODEL_PATH = (
        configured_path
        if configured_path.is_absolute()
        else BASE_DIR / configured_path
    ).resolve()
else:
    LUNG_MODEL_PATH = (
        RETRAINED_LUNG_MODEL_PATH
        if RETRAINED_LUNG_MODEL_PATH.exists()
        else LEGACY_LUNG_MODEL_PATH
    ).resolve()
MAX_UPLOAD_BYTES = int(os.getenv("CURENET_MAX_UPLOAD_BYTES", 10 * 1024 * 1024))
REQUIRE_ANATOMY_GATE = os.getenv(
    "CURENET_REQUIRE_ANATOMY_GATE", "true"
).strip().lower() not in {"0", "false", "no"}
Image.MAX_IMAGE_PIXELS = 25_000_000

STROKE_INPUT_SHAPE = (224, 224, 3)
STROKE_CLASS_NAMES = ("no_stroke", "ischemic_stroke", "hemorrhagic_stroke")
DEFAULT_LUNG_INPUT_SHAPE = (128, 128, 3)
RESEARCH_WARNING = (
    "Research demonstration only. This output is not a medical diagnosis and "
    "must not replace evaluation by a qualified clinician."
)


def _lung_contract() -> tuple[tuple[str, str, str], tuple[int, int, int], str]:
    metadata_path = LUNG_MODEL_PATH.with_suffix(".metadata.json")
    if metadata_path.exists():
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            raw_names = metadata["class_names"]
            raw_shape = metadata["input_shape"]
            names = tuple(str(item).strip().lower() for item in raw_names)
            shape = tuple(int(value) for value in raw_shape)
            if len(names) != 3 or len(set(names)) != 3:
                raise ValueError("class_names must contain three unique labels")
            if len(shape) != 3 or shape[2] != 3 or min(shape) <= 0:
                raise ValueError("input_shape must be [height, width, 3]")
            return names, shape, "model_metadata"  # type: ignore[return-value]
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"Invalid lung model metadata at {metadata_path}: {exc}") from exc

    raw = os.getenv("CURENET_LUNG_CLASS_NAMES", "class_0,class_1,class_2")
    names = tuple(item.strip() for item in raw.split(",") if item.strip())
    if len(names) != 3 or len(set(names)) != 3:
        raise RuntimeError("CURENET_LUNG_CLASS_NAMES must contain exactly 3 unique labels")
    return names, DEFAULT_LUNG_INPUT_SHAPE, "legacy_configuration"  # type: ignore[return-value]


LUNG_CLASS_NAMES, LUNG_INPUT_SHAPE, LUNG_CONTRACT_SOURCE = _lung_contract()
LUNG_SEMANTICS_VERIFIED = set(LUNG_CLASS_NAMES) == {"normal", "benign", "malignant"}
models: dict[str, object] = {}
model_versions: dict[str, str] = {}
model_metadata: dict[str, dict[str, object]] = {}


class AttentionAnalysis(BaseModel):
    method: str
    overlay_image: str
    region_percent: float
    peak_x_percent: float
    peak_y_percent: float
    description: str
    disclaimer: str


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
    common_causes: list[str] = Field(default_factory=list)
    attention: AttentionAnalysis | None = None
    warning: str = RESEARCH_WARNING
    plain_english: str = ""
    next_steps: list[str] = Field(default_factory=list)
    model_version: str = "recovered-legacy"
    stroke_probability: float | None = None
    input_scope: str = "Original model input scope is unverified"
    detected_anatomy: str | None = None
    anatomy_probability: float | None = None
    anatomy_gate_version: str | None = None


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


def validate_stroke_v2_metadata(metadata_path: Path) -> dict[str, object]:
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        class_names = tuple(metadata["class_names"])
        image_size = int(metadata["image_size"])
        model_version = str(metadata["model_version"])
        resize = str(metadata["resize"])
    except FileNotFoundError as exc:
        raise RuntimeError(
            f"Stroke v2 metadata is required at {metadata_path}"
        ) from exc
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Invalid stroke v2 metadata at {metadata_path}: {exc}") from exc

    if class_names != STROKE_CLASS_NAMES:
        raise RuntimeError(
            f"Stroke v2 class order must be {STROKE_CLASS_NAMES}, got {class_names}"
        )
    if image_size != STROKE_INPUT_SHAPE[0]:
        raise RuntimeError(
            f"Stroke v2 image_size must be {STROKE_INPUT_SHAPE[0]}, got {image_size}"
        )
    if model_version != "stroke-ct-v2":
        raise RuntimeError(f"Unsupported stroke model version: {model_version}")
    if resize != "resize_with_pad":
        raise RuntimeError(f"Unsupported stroke resize contract: {resize}")
    return metadata


def load_models() -> tuple[dict[str, object], dict[str, str]]:
    from tensorflow.keras.models import load_model

    loaded: dict[str, object] = {}
    versions: dict[str, str] = {}

    if ANATOMY_GATE_MODEL_PATH.exists():
        try:
            anatomy_metadata = validate_anatomy_gate_metadata(
                ANATOMY_GATE_METADATA_PATH
            )
            anatomy_model = load_model(ANATOMY_GATE_MODEL_PATH, compile=False)
            validate_model_contract(
                anatomy_model, ANATOMY_INPUT_SHAPE, len(ANATOMY_CLASS_NAMES)
            )
            loaded["anatomy_gate"] = anatomy_model
            versions["anatomy_gate"] = ANATOMY_GATE_VERSION
            model_metadata["anatomy_gate"] = anatomy_metadata
            print(
                f"[ML Service] Loaded CT anatomy gate from {ANATOMY_GATE_MODEL_PATH}"
            )
        except Exception as exc:
            print(f"[Warning] Failed loading CT anatomy gate: {exc}")
    else:
        print(
            f"[Notice] CT anatomy gate not found at {ANATOMY_GATE_MODEL_PATH}. "
            "Image predictions will fail closed until it is installed."
        )

    stroke_path = STROKE_V2_MODEL_PATH if STROKE_V2_MODEL_PATH.exists() else STROKE_MODEL_PATH
    if stroke_path.exists():
        try:
            if stroke_path == STROKE_V2_MODEL_PATH:
                validate_stroke_v2_metadata(STROKE_V2_METADATA_PATH)
            stroke_model = load_model(stroke_path, compile=False)
            stroke_output_units = 3 if stroke_path == STROKE_V2_MODEL_PATH else 1
            validate_model_contract(stroke_model, STROKE_INPUT_SHAPE, stroke_output_units)
            loaded["stroke"] = stroke_model
            versions["stroke"] = "stroke-ct-v2" if stroke_output_units == 3 else "recovered-legacy"
            print(f"[ML Service] Loaded brain stroke model from {stroke_path}")
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
            versions["lung"] = "retrained" if LUNG_MODEL_PATH == RETRAINED_LUNG_MODEL_PATH.resolve() else "recovered-legacy"
            print(f"[ML Service] Loaded lung model from {LUNG_MODEL_PATH}")
        except Exception as e:
            print(f"[Warning] Failed loading lung model: {e}")
    else:
        print(f"[Notice] Lung cancer model artifact not found at {LUNG_MODEL_PATH}.")

    return loaded, versions


@asynccontextmanager
async def lifespan(_: FastAPI):
    loaded_models, loaded_versions = load_models()
    models.update(loaded_models)
    model_versions.update(loaded_versions)
    yield
    models.clear()
    model_versions.clear()
    model_metadata.clear()


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
    inference_ready = (
        "anatomy_gate" in models or not REQUIRE_ANATOMY_GATE
    ) and any(
        model_name in models for model_name in ("stroke", "lung")
    )
    return {
        "status": "ok" if inference_ready else "degraded",
        "inference_ready": inference_ready,
        "models_loaded": sorted(models),
        "available_models": {
            "anatomy_gate": "anatomy_gate" in models,
            "stroke": "stroke" in models,
            "lung": "lung" in models,
        },
        "lung_contract_source": LUNG_CONTRACT_SOURCE,
        "lung_class_names": list(LUNG_CLASS_NAMES),
        "lung_semantics_verified": LUNG_SEMANTICS_VERIFIED,
        "model_versions": model_versions,
        "anatomy_gate_required": REQUIRE_ANATOMY_GATE,
        "anatomy_gate_bypassed": (
            not REQUIRE_ANATOMY_GATE and "anatomy_gate" not in models
        ),
    }


def decode_and_preprocess(
    contents: bytes,
    target_size: tuple[int, int],
    *,
    preserve_aspect_ratio: bool = False,
) -> np.ndarray:
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
            if preserve_aspect_ratio:
                image = ImageOps.pad(
                    image,
                    target_size,
                    method=Image.Resampling.BILINEAR,
                    color=(0, 0, 0),
                    centering=(0.5, 0.5),
                )
            else:
                image = image.resize(target_size, Image.Resampling.BILINEAR)
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail="Upload a valid JPEG or PNG image") from exc

    array = np.asarray(image, dtype=np.float32) / 255.0
    return np.expand_dims(array, axis=0)


def enforce_anatomy_match(
    gate_result: AnatomyGateResult, analysis_type: str
) -> None:
    expected = EXPECTED_ANATOMY[analysis_type]
    if not gate_result.accepted:
        raise HTTPException(
            status_code=422,
            detail=(
                "The scan anatomy is unsupported or could not be verified with "
                "sufficient certainty. Upload a clean supported CT slice."
            ),
        )
    if gate_result.prediction != expected:
        readable_detected = gate_result.prediction.replace("_", " ")
        readable_expected = expected.replace("_", " ")
        raise HTTPException(
            status_code=422,
            detail=(
                f"Anatomy mismatch: this appears to be {readable_detected}, but "
                f"{analysis_type} analysis requires {readable_expected}."
            ),
        )


def attach_anatomy_result(
    response: PredictionResponse, gate_result: AnatomyGateResult
) -> PredictionResponse:
    response.detected_anatomy = gate_result.prediction
    response.anatomy_probability = gate_result.probability
    response.anatomy_gate_version = gate_result.model_version
    return response


def attach_anatomy_bypass_warning(
    response: PredictionResponse,
) -> PredictionResponse:
    response.warning = (
        "DEVELOPMENT MODE: CT anatomy was not verified because the anatomy gate "
        "is bypassed. Do not use this result outside local interface testing. "
        + response.warning
    )
    return response


def _position_label(x_percent: float, y_percent: float) -> str:
    horizontal = (
        "left side of the displayed image"
        if x_percent < 40
        else "right side of the displayed image"
        if x_percent > 60
        else "horizontal center of the displayed image"
    )
    vertical = (
        "upper portion"
        if y_percent < 40
        else "lower portion"
        if y_percent > 60
        else "vertical center"
    )
    return f"{vertical}, {horizontal}"


def build_lung_attention(
    model: object,
    image_batch: np.ndarray,
    original_contents: bytes,
    class_index: int,
) -> AttentionAnalysis:
    """Create a Grad-CAM explanation for the selected lung class.

    This is a classifier-attention map, not a lesion mask. Its only supported
    interpretation is which image regions influenced the selected class score.
    """
    import tensorflow as tf

    keras_model = model  # Kept generic at the API boundary for testability.
    feature_layer = next(
        (
            layer
            for layer in reversed(getattr(keras_model, "layers"))
            if len(getattr(getattr(layer, "output", None), "shape", ())) == 4
        ),
        None,
    )
    if feature_layer is None:
        raise RuntimeError("The lung model has no spatial feature layer for Grad-CAM")

    tensor = tf.convert_to_tensor(image_batch)
    feature_index = getattr(keras_model, "layers").index(feature_layer)
    with tf.GradientTape() as tape:
        value = tensor
        for layer in getattr(keras_model, "layers")[1 : feature_index + 1]:
            value = layer(value, training=False)
        feature_maps = value
        for layer in getattr(keras_model, "layers")[feature_index + 1 :]:
            value = layer(value, training=False)
        predictions = value
        selected_score = predictions[:, class_index]
    gradients = tape.gradient(selected_score, feature_maps)
    if gradients is None:
        raise RuntimeError("Could not calculate gradients for the selected lung class")

    channel_weights = tf.reduce_mean(gradients, axis=(1, 2), keepdims=True)
    heatmap = tf.reduce_sum(feature_maps * channel_weights, axis=-1)[0]
    heatmap = tf.maximum(heatmap, 0)
    maximum = float(tf.reduce_max(heatmap).numpy())
    if maximum <= 0:
        raise RuntimeError("The selected lung class produced an empty attention map")
    heatmap_array = np.asarray(heatmap.numpy() / maximum, dtype=np.float32)

    with Image.open(BytesIO(original_contents)) as opened:
        original = ImageOps.exif_transpose(opened).convert("RGB")
    resized_heatmap = Image.fromarray(
        np.uint8(np.clip(heatmap_array, 0, 1) * 255)
    ).resize(original.size, Image.Resampling.BILINEAR)
    activation = np.asarray(resized_heatmap, dtype=np.float32) / 255.0
    original_array = np.asarray(original, dtype=np.float32)

    color = np.zeros_like(original_array)
    color[..., 0] = 255
    color[..., 1] = activation * 180
    alpha = (np.clip((activation - 0.25) / 0.75, 0, 1) * 0.62)[..., None]
    overlay_array = np.uint8(
        np.clip(original_array * (1 - alpha) + color * alpha, 0, 255)
    )
    overlay = Image.fromarray(overlay_array)

    max_overlay_dim = 384
    if max(overlay.size) > max_overlay_dim:
        scale = max_overlay_dim / max(overlay.size)
        new_size = (
            max(1, int(round(overlay.width * scale))),
            max(1, int(round(overlay.height * scale))),
        )
        overlay = overlay.resize(new_size, Image.Resampling.BILINEAR)

    encoded = BytesIO()
    overlay.save(encoded, format="PNG", optimize=True)
    overlay_data_url = "data:image/png;base64," + base64.b64encode(
        encoded.getvalue()
    ).decode("ascii")

    peak_y, peak_x = np.unravel_index(np.argmax(activation), activation.shape)
    height, width = activation.shape
    peak_x_percent = 100.0 * (float(peak_x) + 0.5) / width
    peak_y_percent = 100.0 * (float(peak_y) + 0.5) / height
    region_percent = 100.0 * float(np.mean(activation >= 0.5))
    position = _position_label(peak_x_percent, peak_y_percent)

    return AttentionAnalysis(
        method="grad_cam",
        overlay_image=overlay_data_url,
        region_percent=round(region_percent, 1),
        peak_x_percent=round(peak_x_percent, 1),
        peak_y_percent=round(peak_y_percent, 1),
        description=(
            f"The strongest influence on the selected class was in the {position}. "
            f"Approximately {region_percent:.1f}% of displayed pixels reached at least "
            "half of the peak activation."
        ),
        disclaimer=(
            "Grad-CAM shows classifier influence, not a detected lesion, anatomical "
            "measurement, or cancer location."
        ),
    )


def _stroke_v2_response(scores: np.ndarray) -> PredictionResponse:
    if scores.size != len(STROKE_CLASS_NAMES):
        raise RuntimeError(f"Expected 3 stroke outputs, received {scores.size}")
    if not np.all(np.isfinite(scores)):
        raise RuntimeError("Stroke model returned a non-finite score")
    if np.any(scores < -1e-6) or np.any(scores > 1.0 + 1e-6):
        raise RuntimeError("Stroke model returned a score outside [0, 1]")
    score_sum = float(scores.sum())
    if score_sum <= 0:
        raise RuntimeError("Stroke model returned an invalid probability distribution")

    # Normalize tiny floating-point drift while rejecting outputs that are not softmax-like.
    if not np.isclose(score_sum, 1.0, atol=1e-3):
        raise RuntimeError("Stroke model outputs do not sum to 1")
    scores = scores / score_sum
    best_index = int(np.argmax(scores))
    prediction = STROKE_CLASS_NAMES[best_index]
    probability = float(scores[best_index])
    stroke_probability = float(1.0 - scores[0])
    probabilities = {
        name: float(score) for name, score in zip(STROKE_CLASS_NAMES, scores)
    }
    subtype = prediction.replace("_", " ")
    flagged = prediction != "no_stroke"

    return PredictionResponse(
        analysis_type="stroke",
        prediction=prediction,
        probability=probability,
        probabilities=probabilities,
        message=f"Model output: {subtype} ({probability:.1%} score)",
        status_badge=(
            f"Research Output: {subtype.title()} Pattern"
            if flagged
            else "Research Output: No Stroke Pattern"
        ),
        status_level="danger" if flagged else "success",
        clinical_summary=(
            f"Single-slice research classification: {subtype}. The aggregate "
            f"stroke-pattern score is {stroke_probability:.1%}. This is not a diagnosis."
        ),
        confidence_label=f"Highest model score ({probability:.1%})",
        recommended_action=(
            "If stroke symptoms are present, call local emergency services immediately; "
            "do not use this output to delay care. A clinician must review the complete study."
        ),
        patient_headline=(
            "A stroke-associated image pattern was flagged."
            if flagged
            else "No stroke-associated pattern was the highest-scoring class."
        ),
        patient_explanation=(
            "The model compares one rendered CT slice with patterns in its training data. "
            "It cannot confirm or exclude a stroke, establish when a finding occurred, or "
            "replace review of the full CT examination by a qualified clinician."
        ),
        common_causes=[
            "Image appearance can vary with CT windowing, scanner settings, and artifacts",
            "A single slice does not contain the context of the complete examination",
            "Other conditions can resemble patterns learned by the classifier",
        ],
        plain_english=(
            f"The highest model score was for {subtype}. The combined score for either "
            f"stroke-associated class was {stroke_probability:.1%}. These are model scores, "
            "not the chance that a person has a stroke."
        ),
        next_steps=[
            "If there is face drooping, arm weakness, speech difficulty, or another sudden neurological symptom, call emergency services now",
            "Have a qualified clinician review the complete CT study and clinical history",
            "Do not start, stop, or change treatment based on this research output",
        ],
        model_version="stroke-ct-v2",
        stroke_probability=stroke_probability,
        input_scope="One rendered 2D non-contrast head CT slice (PNG or JPEG)",
    )


def stroke_response(
    raw_output: np.ndarray, model_version: str | None = None
) -> PredictionResponse:
    scores = np.asarray(raw_output, dtype=np.float64).reshape(-1)
    if scores.size == len(STROKE_CLASS_NAMES):
        return _stroke_v2_response(scores)
    if scores.size != 1:
        raise RuntimeError(f"Expected 1 or 3 stroke outputs, received {scores.size}")
    if not np.isfinite(scores[0]):
        raise RuntimeError("Stroke model returned a non-finite score")

    stroke_score = float(np.clip(scores[0], 0.0, 1.0))
    is_stroke = stroke_score >= 0.5
    prediction = "stroke" if is_stroke else "no_stroke"
    probability = stroke_score if is_stroke else 1.0 - stroke_score

    confidence_label = f"Highest model score ({probability:.1%})"

    if is_stroke:
        status_badge = "Possible Stroke Pattern Flagged"
        status_level = "danger"
        patient_headline = "Unusual brain tissue changes detected — seek medical attention now."
        patient_explanation = (
            "The computer detected an area where brain tissue looks different than normal, which could indicate "
            "restricted blood flow (an ischemic stroke) or bleeding. Because brain tissue requires fast medical attention, "
            "this scan should be evaluated by an emergency doctor right away."
        )
        plain_english = (
            "A stroke happens when part of the brain doesn't get enough blood — either because a blood vessel is "
            "blocked, or because it has burst. The AI found areas in this brain scan where the tissue looks "
            "different from what it learned to recognise as normal. This could be a warning sign.\n\n"
            "This is NOT a confirmed stroke diagnosis. The AI is looking at image patterns only — not running "
            "blood tests, checking your blood pressure, or examining your symptoms. Only an emergency doctor "
            "can confirm or rule out a stroke. If the person who had this scan is experiencing symptoms right now, "
            "call emergency services immediately."
        )
        common_causes = [
            "Acute blood clot or restricted blood flow (ischemic stroke)",
            "Localized brain tissue inflammation or swelling",
            "Bleeding (hemorrhagic episode) or transient ischemic event (TIA)",
        ]
        next_steps = [
            "🚨 If symptoms are present NOW (drooping face, arm weakness, slurred speech, confusion) — call emergency services immediately",
            "🏥 If no current symptoms: see a neurologist or emergency doctor today — do not wait",
            "📁 Bring this scan and any previous brain scans to the appointment",
            "🗣️ Tell the doctor exactly what symptoms were noticed and when they started",
            "🚫 Do not drive yourself — have someone take you or call an ambulance",
        ]
        clinical_summary = (
            "The neural network detected visual density variations in the brain scan consistent with "
            "acute ischemic changes. This algorithmic finding requires urgent clinical evaluation."
        )
        recommended_action = (
            "Consult an emergency neurologist or attending physician immediately. Correlate with physical symptoms."
        )
    else:
        status_badge = "No Stroke Pattern Detected"
        status_level = "success"
        patient_headline = "Brain tissue looks balanced and normal in this slice."
        patient_explanation = (
            "The computer examined both sides of the brain and found normal tissue balance with no obvious bleeding "
            "or blocked areas visible. Keep in mind that some minor or very early episodes might not show on a basic scan."
        )
        plain_english = (
            "A healthy brain scan looks roughly symmetrical — both sides should appear similar. The AI compared "
            "your brain scan to the patterns it learned from, and didn't find signs that it associates with a stroke, "
            "like dark patches from blocked blood flow or bright spots from bleeding.\n\n"
            "This is a reassuring result — but it does not guarantee your brain is completely healthy. Very early "
            "or very small changes might not be visible on a single slice. If you or someone you know experienced "
            "any stroke symptoms, see a doctor regardless of this result."
        )
        common_causes = [
            "Normal, healthy symmetric brain tissue",
            "No visible acute bleeding or ischemic damage in this slice",
        ]
        next_steps = [
            "✅ No emergency signs detected — continue with your scheduled follow-up",
            "📋 Know the FAST signs of a stroke: Face drooping, Arm weakness, Speech trouble, Time to call emergency services",
            "🏥 If someone experienced symptoms earlier — still see a doctor, even if this scan looks normal",
            "🧠 Regular check-ups with your doctor are the best way to monitor brain health",
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
        plain_english=plain_english,
        next_steps=next_steps,
        model_version=model_version or "recovered-legacy",
        stroke_probability=stroke_score,
        input_scope="Original legacy model input scope is unverified",
    )



def lung_response(
    raw_output: np.ndarray,
    attention: AttentionAnalysis | None = None,
    model_version: str | None = None,
) -> PredictionResponse:
    scores = np.asarray(raw_output, dtype=np.float64).reshape(-1)
    if scores.size != len(LUNG_CLASS_NAMES):
        raise RuntimeError(f"Expected 3 lung outputs, received {scores.size}")
    best_index = int(np.argmax(scores))
    probability = float(scores[best_index])
    prediction = LUNG_CLASS_NAMES[best_index]
    probabilities = {
        name: float(score) for name, score in zip(LUNG_CLASS_NAMES, scores)
    }

    confidence_label = f"Highest model score ({probability:.1%})"

    if prediction == "normal":
        status_badge = "Research Output: Normal Pattern"
        status_level = "success"
        patient_headline = "No unusual patterns detected in this slice."
        patient_explanation = (
            "The model matched this CT slice to its normal class — the tissue patterns in this image "
            "most closely resemble normal lung tissue from its training data.\n\n"
            "This is a research prototype result, not a medical diagnosis. It evaluates only the "
            "single image you uploaded — not your full CT study, symptoms, or medical history. "
            "Only a radiologist reviewing your complete scan can determine whether your lungs are healthy."
        )
        plain_english = (
            "A 'Normal' lung CT scan means the lungs appear clear and healthy. It indicates that the airways are open "
            "and filled with air, and there are no signs of abnormal growths, severe inflammation, or fluid buildup. "
            "The blood vessels and other structures in the chest look typical for a healthy person.\n\n"
            "Keep in mind that while this slice looks clear, it is always important to have a qualified doctor "
            "review your entire scan and medical history."
        )
        common_causes = [
            "This is a pattern-match score, not a clinical finding or health clearance",
            "A full CT study has hundreds of slices — one slice result cannot represent them all",
            "Only a radiologist can identify or rule out lung abnormalities",
        ]
        next_steps = [
            "✅ Keep attending your regular health check-ups as scheduled",
            "📋 If you have any symptoms (cough lasting 3+ weeks, breathlessness, chest pain, unexplained weight loss) — see a doctor regardless of this result",
            "🏥 Share this result with your doctor — never use it alone to make any health decisions",
            "📁 If a doctor ordered this scan, ensure they review all the images, not just this one",
        ]
        clinical_summary = (
            "Single-slice research classification: normal. "
            "No localization, exclusion claim, or clinical validation is available from this output."
        )
        recommended_action = (
            "Keep up with routine health check-ups. If you have symptoms such as a persistent cough, "
            "breathlessness, or chest discomfort, share your full scan with a doctor — "
            "do not rely on this tool alone."
        )
    elif prediction == "benign":
        status_badge = "Research Output: Benign Pattern"
        status_level = "warning"
        patient_headline = "Patterns similar to benign (non-cancerous) tissue detected."
        patient_explanation = (
            "The model matched this CT slice to its benign class — the image patterns most resemble "
            "non-cancerous tissue changes in its training data, such as scar tissue, inflammation, or "
            "a benign nodule.\n\n"
            "This result does not confirm or rule out disease. The model cannot locate, measure, or "
            "characterize any finding. A doctor reviewing your full imaging study and medical history "
            "is the only way to understand what this result means for you."
        )
        plain_english = (
            "In medical terms, 'Benign' means a condition that is not cancer. A benign lung CT scan might show "
            "harmless findings such as small nodules, old scar tissue from past infections, or mild inflammation. "
            "These types of changes are very common, generally do not spread to other parts of the body, and often "
            "do not require treatment.\n\n"
            "However, you should still follow up with a doctor to properly evaluate these findings and ensure "
            "they are truly harmless."
        )
        common_causes = [
            "Benign does not mean 'nothing to worry about' — a doctor must still evaluate it",
            "The model cannot locate a nodule or measure its size — it only scores pattern similarity",
            "Benign findings can include harmless scars, old infections, or small nodules",
        ]
        next_steps = [
            "📞 Book an appointment with your regular doctor this week",
            "📁 Bring your full CT scan files (a CD, USB, or digital copy of all images) — not just this one slice",
            "🗣️ Tell your doctor about any symptoms: cough, chest tightness, shortness of breath, or unusual fatigue",
            "🚫 Do not interpret this result on its own — a doctor's review is the only way to understand what it means for you",
        ]
        clinical_summary = (
            "Single-slice research classification: benign. "
            "The classifier provides no localization, size estimate, or clinical diagnosis."
        )
        recommended_action = (
            "See a doctor and bring your full scan files or CD. They can evaluate this finding "
            "alongside your symptoms and medical history. Do not interpret this result on its own."
        )
    elif prediction == "malignant":
        status_badge = "Research Output: Malignant Pattern"
        status_level = "danger"
        patient_headline = "Patterns similar to malignant tissue detected — please see a doctor."
        patient_explanation = (
            "The model matched this CT slice to its malignant class — the image patterns most resemble "
            "tissue marked as malignant in its training data.\n\n"
            "This is NOT a cancer diagnosis. The model cannot locate a tumor, measure its size, or "
            "confirm cancer is present. It only compares image patterns. Many factors — including scan "
            "quality, positioning, metal implants, or other artifacts — can produce this result even "
            "when no cancer is present. A radiologist must review your complete scan."
        )
        plain_english = (
            "'Malignant' is the medical term for cancerous. A malignant pattern on a lung CT scan suggests the "
            "presence of abnormal tissue or growths that have the potential to grow aggressively and spread. "
            "This often points to a tumor or other cancerous cells that need immediate medical attention and treatment.\n\n"
            "It is highly important not to panic, but you must take this seriously. A radiologist needs to look at "
            "your full scan to confirm exactly what is going on and guide your next steps."
        )
        common_causes = [
            "This is a pattern-similarity score — it cannot confirm or locate cancer",
            "Metal implants, dense tissue, or scan artifacts can trigger this class",
            "Only a radiologist + full DICOM study + clinical history can give a real diagnosis",
        ]
        next_steps = [
            "🏥 See a doctor as soon as possible — ideally within the next few days",
            "📁 Bring your complete CT scan files (all slices, not just this image) to the appointment",
            "🗣️ Tell your doctor about any symptoms: new cough, unexplained weight loss, chest pain, or fatigue",
            "🧘 Try not to panic — many things besides cancer can cause this result. A doctor's review will clarify everything",
            "📞 If you can't get a quick appointment, call your doctor's office and mention you have an imaging result you'd like reviewed",
        ]
        clinical_summary = (
            "Single-slice research classification: malignant. "
            "This output is not localized, not clinically validated, and not a diagnosis."
        )
        recommended_action = (
            "Book an appointment with a pulmonologist or your doctor as soon as possible. "
            "Bring your full scan files. They will review all slices and your clinical history "
            "to determine whether follow-up or further testing is needed."
        )
    else:
        status_badge = f"Unmapped Research Output: {prediction}"
        status_level = "info"
        patient_headline = "This recovered model's class meaning is unknown."
        patient_explanation = (
            "The model produced a numeric class, but its original training dataset and class-index mapping "
            "are unavailable. Assigning a medical meaning to this result would be misleading."
        )
        plain_english = ""
        common_causes = []
        next_steps = []
        clinical_summary = (
            "Neutral legacy-model output only. No clinical interpretation is available without verified class metadata."
        )
        recommended_action = (
            "Do not use this output for a health decision. Use the reproducibly trained model with its metadata, "
            "and consult a qualified clinician for interpretation of medical imaging."
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
        plain_english=plain_english,
        next_steps=next_steps,
        warning=(
            "⚠️ Research tool only — not a medical device. This result is not a diagnosis, "
            "does not replace a radiologist, and must not be used for clinical decisions."
        ),
        attention=attention,
        model_version=model_version or "recovered-legacy",
        input_scope=(
            "One rendered 2D lung CT slice (PNG or JPEG)"
            if model_version == "retrained"
            else "Original legacy model input scope is unverified"
        ),
    )



@app.post("/predict", response_model=PredictionResponse)
async def predict(
    file: Annotated[UploadFile, File(...)],
    analysis_type: Annotated[Literal["stroke", "lung", "cancer"], Form()] = "stroke",
) -> PredictionResponse:
    normalized_type = "lung" if analysis_type == "cancer" else analysis_type
    anatomy_model = models.get("anatomy_gate")
    anatomy_metadata = model_metadata.get("anatomy_gate")
    gate_result: AnatomyGateResult | None = None
    if (
        anatomy_model is None or anatomy_metadata is None
    ) and REQUIRE_ANATOMY_GATE:
        raise HTTPException(
            status_code=503,
            detail=(
                "The required CT anatomy gate is not loaded. Install "
                "ct_anatomy_gate_v1.keras and its matching metadata before inference."
            ),
        )

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if anatomy_model is not None and anatomy_metadata is not None:
        anatomy_batch = decode_and_preprocess(
            contents, ANATOMY_INPUT_SHAPE[:2], preserve_aspect_ratio=True
        )
        anatomy_output = await run_in_threadpool(
            anatomy_model.predict, anatomy_batch, verbose=0  # type: ignore[attr-defined]
        )
        gate_result = interpret_anatomy_gate_output(anatomy_output, anatomy_metadata)
        enforce_anatomy_match(gate_result, normalized_type)

    target_size = (
        STROKE_INPUT_SHAPE[:2]
        if normalized_type == "stroke"
        else LUNG_INPUT_SHAPE[:2]
    )
    image_batch = decode_and_preprocess(
        contents,
        target_size,
        preserve_aspect_ratio=(
            normalized_type == "stroke"
            and model_versions.get("stroke") == "stroke-ct-v2"
        ),
    )

    model = models.get(normalized_type)
    if model is None:
        missing_filename = (
            "brain_stroke.keras"
            if normalized_type == "stroke"
            else LUNG_MODEL_PATH.name
        )
        raise HTTPException(
            status_code=503,
            detail=(
                f"Model for '{normalized_type}' is not loaded. "
                f"Please ensure '{missing_filename}' and its required metadata are present in ml_services/models/."
            ),
        )

    raw_output = await run_in_threadpool(
        model.predict, image_batch, verbose=0  # type: ignore[attr-defined]
    )
    if normalized_type == "stroke":
        response = stroke_response(raw_output, model_versions.get("stroke"))
        return (
            attach_anatomy_result(response, gate_result)
            if gate_result is not None
            else attach_anatomy_bypass_warning(response)
        )

    attention = None
    try:
        class_index = int(np.argmax(np.asarray(raw_output).reshape(-1)))
        attention = await run_in_threadpool(
            build_lung_attention, model, image_batch, contents, class_index
        )
    except Exception as exc:
        print(f"[Warning] Lung attention map unavailable: {exc}")
    response = lung_response(raw_output, attention, model_versions.get("lung"))
    return (
        attach_anatomy_result(response, gate_result)
        if gate_result is not None
        else attach_anatomy_bypass_warning(response)
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=False)
