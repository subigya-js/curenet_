import json
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from zipfile import ZipFile

import numpy as np
import pytest
from PIL import Image

from app import (
    LUNG_CLASS_NAMES,
    build_lung_attention,
    decode_and_preprocess,
    lung_response,
    stroke_response,
    validate_model_contract,
)


MODEL_DIR = Path(__file__).resolve().parents[1] / "models"


def _keras_config(filename: str) -> dict:
    with ZipFile(MODEL_DIR / filename) as archive:
        return json.loads(archive.read("config.json"))


def test_recovered_artifacts_encode_expected_contracts() -> None:
    stroke_path = MODEL_DIR / "brain_stroke.keras"
    if stroke_path.exists():
        stroke = _keras_config("brain_stroke.keras")
        stroke_layers = stroke["config"]["layers"]
        assert stroke["config"]["build_input_shape"] == [None, 224, 224, 3]
        assert stroke_layers[-1]["config"]["units"] == 1
        assert stroke_layers[-1]["config"]["activation"] == "sigmoid"

    lung = _keras_config("lung_cancer.keras")
    lung_layers = lung["config"]["layers"]
    input_layer = next(layer for layer in lung_layers if layer["class_name"] == "InputLayer")
    assert input_layer["config"]["batch_shape"] == [None, 128, 128, 3]
    assert lung_layers[-1]["config"]["units"] == 3
    assert lung_layers[-1]["config"]["activation"] == "softmax"


@pytest.mark.parametrize("target_size", [(224, 224), (128, 128)])
def test_preprocessing_produces_normalized_rgb_batch(target_size: tuple[int, int]) -> None:
    source = Image.fromarray(np.arange(200, dtype=np.uint8).reshape(10, 20))
    encoded = BytesIO()
    source.save(encoded, format="PNG")

    batch = decode_and_preprocess(encoded.getvalue(), target_size)

    assert batch.shape == (1, target_size[1], target_size[0], 3)
    assert batch.dtype == np.float32
    assert 0.0 <= float(batch.min()) <= float(batch.max()) <= 1.0


def test_stroke_response_reports_both_scores() -> None:
    result = stroke_response(np.array([[0.8]], dtype=np.float32))
    assert result.prediction == "stroke"
    assert result.probability == pytest.approx(0.8)
    assert result.probabilities["no_stroke"] == pytest.approx(0.2)


def test_lung_response_is_multiclass() -> None:
    result = lung_response(np.array([[0.1, 0.7, 0.2]], dtype=np.float32))
    assert result.prediction == LUNG_CLASS_NAMES[1]
    assert result.probability == pytest.approx(0.7)
    assert set(result.probabilities) == set(LUNG_CLASS_NAMES)


def test_model_contract_rejects_wrong_input_shape() -> None:
    fake_model = SimpleNamespace(input_shape=(None, 224, 224, 3), output_shape=(None, 3))
    with pytest.raises(RuntimeError, match="contract mismatch"):
        validate_model_contract(fake_model, (128, 128, 3), 3)


def test_gradcam_attention_returns_png_overlay() -> None:
    from tensorflow import keras

    inputs = keras.Input(shape=(8, 8, 3))
    features = keras.layers.Conv2D(
        1,
        3,
        activation="relu",
        use_bias=False,
        kernel_initializer="ones",
    )(inputs)
    pooled = keras.layers.GlobalAveragePooling2D()(features)
    outputs = keras.layers.Dense(
        3,
        activation="softmax",
        use_bias=False,
        kernel_initializer=keras.initializers.Constant([[1.0, 0.0, -1.0]]),
    )(pooled)
    model = keras.Model(inputs, outputs)

    image = Image.fromarray(np.full((16, 16, 3), 128, dtype=np.uint8))
    encoded = BytesIO()
    image.save(encoded, format="PNG")
    batch = np.full((1, 8, 8, 3), 0.5, dtype=np.float32)

    attention = build_lung_attention(model, batch, encoded.getvalue(), class_index=0)

    assert attention.method == "grad_cam"
    assert attention.overlay_image.startswith("data:image/png;base64,")
    assert 0 <= attention.region_percent <= 100
    assert 0 < attention.peak_x_percent < 100
    assert 0 < attention.peak_y_percent < 100
