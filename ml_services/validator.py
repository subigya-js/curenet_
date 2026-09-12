import numpy as np
from PIL import Image


BLACK_BACKGROUND_MAX = 5
MIN_FOREGROUND_RATIO = 0.08
MIN_FOREGROUND_GRAY_LEVELS = 16
MAX_FOREGROUND_FLAT_RATIO = 0.50


def validate_radiological_scan(image: Image.Image) -> tuple[bool, str]:
    """
    Validates whether an input image meets the fundamental physical characteristics
    of an authentic axial radiological scan (CT/MRI) before neural network inference.
    
    Tolerates real-world clinical capture artifacts, such as:
      - Direct digital PACS/DICOM exports (pure monochrome)
      - Smartphone photos of hospital computer monitors or lightboxes (uniform blue/cool backlight tint)
    
    Strictly rejects out-of-distribution inputs such as:
      - Multi-color website screenshots, UI cards, and software graphics
      - Photographs of outdoor scenes, people, pets, or everyday objects
      - Synthetic memes and documents
    """
    rgb = image.convert("RGB")
    arr = np.asarray(rgb, dtype=np.float32)

    # 1. Color Saturation & Chromatic Dispersion Check
    # Authentic scans are either pure grayscale or a single-hue monochrome LCD photo (blue/cyan screen cast).
    # Multi-color images (clothing, websites, scenery) have wide divergence across color channels.
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    
    # Calculate channel divergence
    rg_diff = np.abs(r - g)
    gb_diff = np.abs(g - b)
    rb_diff = np.abs(r - b)
    mean_divergence = float(np.mean(rg_diff + gb_diff + rb_diff))

    # Real-world LCD monitor photos typically have a uniform tint producing mean divergence between 15 and 35.
    # True multi-color images (scenery, colorful UIs, people) have divergence > 48.
    if mean_divergence > 48.0:
        return (
            False,
            "Image contains significant multi-color saturation. Authentic radiological scans are monochromatic.",
        )

    # Check for multi-colored patches (e.g., a dark image with bright red/green/yellow buttons)
    # If more than 8% of pixels have extreme color divergence (> 60), it's a graphic or real-world photo.
    extreme_color_pixels = float(np.mean((rg_diff > 45) | (gb_diff > 45) | (rb_diff > 45)))
    if extreme_color_pixels > 0.08:
        return (
            False,
            "Image contains localized multi-color elements characteristic of a graphic or non-medical photo.",
        )

    # 2. Synthetic UI & Flat Graphic Check
    # Exported CT slices commonly have a large, exactly black exterior canvas, so
    # black pixels must not count as evidence of a UI. Instead, require enough
    # non-black foreground and evaluate flatness inside that foreground.
    gray = np.mean(arr, axis=2).astype(np.uint8)
    foreground = gray[gray > BLACK_BACKGROUND_MAX]
    foreground_ratio = float(foreground.size) / float(gray.size)
    if foreground_ratio < MIN_FOREGROUND_RATIO:
        return (
            False,
            "Image contains too little visible scan content outside the black background.",
        )

    foreground_values, foreground_counts = np.unique(foreground, return_counts=True)
    foreground_flat_ratio = float(np.max(foreground_counts)) / float(foreground.size)
    if (
        len(foreground_values) < MIN_FOREGROUND_GRAY_LEVELS
        or foreground_flat_ratio > MAX_FOREGROUND_FLAT_RATIO
    ):
        return (
            False,
            "Visible image content contains unnatural flat grayscale regions characteristic of a graphic or screenshot.",
        )

    # 3. Dynamic Range & Soft-Tissue Contrast Check
    # Medical scans have continuous contrast across bone, air, and soft tissue.
    # Measure only visible foreground so a black canvas cannot manufacture a
    # high contrast score around an otherwise flat shape.
    std_contrast = float(np.std(foreground))
    if std_contrast < 10.0:
        return (
            False,
            "Image lacks sufficient contrast or soft-tissue dynamic range.",
        )

    return True, ""
