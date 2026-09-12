"""Lightweight transfer-learning model for CT anatomy routing."""

from __future__ import annotations

from .config import AnatomyConfig


def build_model(config: AnatomyConfig):
    from tensorflow import keras
    from tensorflow.keras import layers

    inputs = keras.Input(
        shape=(config.image_size, config.image_size, 3), name="rendered_ct_slice"
    )
    augmentation = keras.Sequential(
        [
            layers.RandomRotation(0.04),
            layers.RandomTranslation(0.04, 0.04),
            layers.RandomZoom(0.08),
            layers.RandomContrast(0.15),
        ],
        name="anatomy_augmentation",
    )
    x = augmentation(inputs)
    x = layers.Rescaling(2.0, offset=-1.0, name="mobilenet_scaling")(x)
    backbone = keras.applications.MobileNetV3Small(
        include_top=False,
        include_preprocessing=False,
        weights="imagenet",
        input_shape=(config.image_size, config.image_size, 3),
    )
    backbone.trainable = False
    x = backbone(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(config.dropout_rate)(x)
    outputs = layers.Dense(
        len(config.class_names), activation="softmax", name="anatomy_class"
    )(x)
    model = keras.Model(inputs, outputs, name="curenet_ct_anatomy_gate_v1")
    compile_model(model, config.head_learning_rate)
    return model, backbone


def compile_model(model, learning_rate: float) -> None:
    from tensorflow import keras

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate),
        loss=keras.losses.SparseCategoricalCrossentropy(),
        metrics=[keras.metrics.SparseCategoricalAccuracy(name="accuracy")],
    )


def enable_fine_tuning(
    model, backbone, config: AnatomyConfig, trainable_layers: int = 30
) -> None:
    from tensorflow.keras.layers import BatchNormalization

    backbone.trainable = True
    for layer in backbone.layers[:-trainable_layers]:
        layer.trainable = False
    for layer in backbone.layers[-trainable_layers:]:
        if isinstance(layer, BatchNormalization):
            layer.trainable = False
    compile_model(model, config.fine_tune_learning_rate)
