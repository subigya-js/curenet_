import numpy as np
from PIL import Image

from validator import validate_radiological_scan


def test_accepts_textured_monochrome_scan_with_large_black_background() -> None:
    rng = np.random.default_rng(42)
    height = width = 512
    y, x = np.ogrid[:height, :width]
    head = ((x - 256) / 145) ** 2 + ((y - 256) / 180) ** 2 <= 1
    pixels = np.zeros((height, width), dtype=np.uint8)
    pixels[head] = np.clip(
        rng.normal(115, 24, size=int(head.sum())), 12, 230
    ).astype(np.uint8)
    image = Image.fromarray(pixels, mode="L")

    valid, reason = validate_radiological_scan(image)

    assert valid, reason


def test_rejects_flat_graphic_even_when_background_is_black() -> None:
    pixels = np.zeros((256, 256), dtype=np.uint8)
    pixels[64:192, 64:192] = 160
    image = Image.fromarray(pixels, mode="L")

    valid, reason = validate_radiological_scan(image)

    assert not valid
    assert "flat grayscale" in reason
