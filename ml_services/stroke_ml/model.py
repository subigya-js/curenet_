"""Transfer-learning model for three-class stroke-pattern classification."""

from __future__ import annotations

from .config import StrokeConfig


def build_model(config: StrokeConfig):
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers

    inputs = keras.Input(
        shape=(config.image_size, config.image_size, 3), name="head_ct_image"
    )
    augmentation = keras.Sequential(
        [
            layers.RandomRotation(0.03),
            layers.RandomTranslation(0.03, 0.03),
            layers.RandomZoom(0.05),
            layers.RandomContrast(0.10),
        ],
        name="ct_augmentation",
    )
    x = augmentation(inputs)
    x = layers.Rescaling(2.0, offset=-1.0, name="efficientnet_scaling")(x)
    backbone = keras.applications.EfficientNetV2B0(
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
    outputs = layers.Dense(len(config.class_names), activation="softmax", name="stroke_class")(x)
    model = keras.Model(inputs, outputs, name="curenet_stroke_ct_v2")
    compile_model(model, config.head_learning_rate)
    return model, backbone


def compile_model(model, learning_rate: float) -> None:
    from tensorflow import keras

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate),
        loss=keras.losses.SparseCategoricalCrossentropy(),
        metrics=[keras.metrics.SparseCategoricalAccuracy(name="accuracy")],
    )


def enable_fine_tuning(model, backbone, config: StrokeConfig, trainable_layers: int = 40) -> None:
    from tensorflow.keras.layers import BatchNormalization

    backbone.trainable = True
    for layer in backbone.layers[:-trainable_layers]:
        layer.trainable = False
    for layer in backbone.layers[-trainable_layers:]:
        if isinstance(layer, BatchNormalization):
            layer.trainable = False
    compile_model(model, config.fine_tune_learning_rate)
