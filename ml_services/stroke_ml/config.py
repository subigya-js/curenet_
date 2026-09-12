"""Shared configuration for stroke model training and inference."""

from dataclasses import asdict, dataclass

from . import CLASS_NAMES, MODEL_VERSION


@dataclass(frozen=True)
class StrokeConfig:
    model_version: str = MODEL_VERSION
    image_size: int = 224
    batch_size: int = 32
    seed: int = 2026
    head_epochs: int = 8
    fine_tune_epochs: int = 12
    head_learning_rate: float = 1e-3
    fine_tune_learning_rate: float = 1e-5
    dropout_rate: float = 0.35
    test_fraction: float = 0.15
    validation_fraction: float = 0.15
    class_names: tuple[str, str, str] = CLASS_NAMES
    kaggle_dataset: str = "ozguraslank/brain-stroke-ct-dataset"

    def to_dict(self) -> dict[str, object]:
        return asdict(self)
