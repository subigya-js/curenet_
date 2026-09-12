from dataclasses import asdict, dataclass

from . import CLASS_NAMES, MODEL_VERSION


@dataclass(frozen=True)
class AnatomyConfig:
    model_version: str = MODEL_VERSION
    image_size: int = 224
    batch_size: int = 32
    seed: int = 2026
    head_epochs: int = 6
    fine_tune_epochs: int = 8
    head_learning_rate: float = 1e-3
    fine_tune_learning_rate: float = 1e-5
    dropout_rate: float = 0.30
    class_names: tuple[str, str, str] = CLASS_NAMES
    maximum_unsafe_acceptance_rate: float = 0.01

    def to_dict(self) -> dict[str, object]:
        return asdict(self)
