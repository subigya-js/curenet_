"""Reconstructed architectures recorded from the CureNet Keras artifacts.

These builders document model topology. They do not recreate trained weights.
"""

from tensorflow import keras
from tensorflow.keras import layers


def build_brain_stroke_model() -> keras.Model:
    return keras.Sequential(
        [
            keras.Input(shape=(224, 224, 3)),
            layers.Conv2D(32, 3, activation="relu"),
            layers.MaxPooling2D(2),
            layers.Conv2D(64, 3, activation="relu"),
            layers.MaxPooling2D(2),
            layers.Conv2D(128, 3, activation="relu"),
            layers.MaxPooling2D(2),
            layers.Flatten(),
            layers.Dense(256, activation="relu"),
            layers.Dropout(0.2),
            layers.Dense(128, activation="relu"),
            layers.Dropout(0.2),
            layers.Dense(1, activation="sigmoid"),
        ],
        name="brain_stroke_model",
    )


def build_lung_model() -> keras.Model:
    inputs = keras.Input(shape=(128, 128, 3))
    x = layers.Conv2D(63, 3, padding="same")(inputs)
    x = layers.BatchNormalization()(x)
    x = layers.Activation("relu")(x)
    x = layers.MaxPooling2D(2)(x)

    shortcut = layers.Conv2D(64, 1, padding="same")(x)
    residual = layers.Conv2D(64, 3, padding="same")(x)
    residual = layers.BatchNormalization()(residual)
    residual = layers.Activation("relu")(residual)
    residual = layers.Conv2D(64, 3, padding="same")(residual)
    residual = layers.BatchNormalization()(residual)
    x = layers.Add()([residual, shortcut])
    x = layers.Activation("relu")(x)
    x = layers.MaxPooling2D(2)(x)

    for _ in range(2):
        x = layers.Conv2D(64, 3, padding="same")(x)
        x = layers.BatchNormalization()(x)
        x = layers.Activation("relu")(x)
        x = layers.Dropout(0.5)(x)
        x = layers.MaxPooling2D(2)(x)

    x = layers.Flatten()(x)
    x = layers.Dense(256, activation="relu")(x)
    x = layers.Dropout(0.5)(x)
    outputs = layers.Dense(3, activation="softmax")(x)
    return keras.Model(inputs, outputs, name="lung_model")
