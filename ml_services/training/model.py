from __future__ import annotations

from tensorflow import keras
from tensorflow.keras import layers


def build_lung_classifier(
    *, input_size: int, class_count: int, imagenet_weights: bool
) -> tuple[keras.Model, keras.Model]:
    inputs = keras.Input(shape=(input_size, input_size, 3), name="image")
    x = layers.RandomRotation(0.03, fill_mode="reflect", name="augment_rotation")(inputs)
    x = layers.RandomTranslation(0.03, 0.03, fill_mode="reflect", name="augment_translation")(x)
    x = layers.RandomZoom(0.08, fill_mode="reflect", name="augment_zoom")(x)
    x = layers.RandomContrast(0.1, name="augment_contrast")(x)
    x = layers.Rescaling(2.0, offset=-1.0, name="mobilenet_scaling")(x)

    backbone = keras.applications.MobileNetV2(
        input_shape=(input_size, input_size, 3),
        include_top=False,
        weights="imagenet" if imagenet_weights else None,
    )
    backbone.trainable = False
    x = backbone(x, training=False)
    x = layers.GlobalAveragePooling2D(name="global_average_pool")(x)
    x = layers.Dropout(0.35, name="classifier_dropout")(x)
    outputs = layers.Dense(class_count, activation="softmax", name="class_probabilities")(x)
    model = keras.Model(inputs, outputs, name="curenet_lung_ct_classifier")
    return model, backbone


def compile_model(model: keras.Model, learning_rate: float) -> None:
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss=keras.losses.SparseCategoricalCrossentropy(),
        metrics=[keras.metrics.SparseCategoricalAccuracy(name="accuracy")],
    )


def enable_fine_tuning(backbone: keras.Model, trainable_layers: int) -> None:
    backbone.trainable = True
    cutoff = max(0, len(backbone.layers) - trainable_layers)
    for index, layer in enumerate(backbone.layers):
        layer.trainable = index >= cutoff and not isinstance(
            layer, layers.BatchNormalization
        )
