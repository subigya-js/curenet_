import numpy as np
from PIL import Image


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
    # Screenshots and UI cards have massive concentrations of exact background hex values (e.g. flat #1e1e1e).
    # Natural scans (and monitor photos) have continuous sensor noise and tissue gradations.
    gray = np.mean(arr, axis=2).astype(np.uint8)
    _, counts = np.unique(gray, return_counts=True)
    top_pixel_ratio = float(np.max(counts)) / float(gray.size)
    if top_pixel_ratio > 0.50:
        return (
            False,
            "Image contains unnatural flat color blocks characteristic of a software UI or screenshot.",
        )

    # 3. Dynamic Range & Soft-Tissue Contrast Check
    # Medical scans have continuous contrast across bone, air, and soft tissue.
    std_contrast = float(np.std(gray))
    if std_contrast < 10.0:
        return (
            False,
            "Image lacks sufficient contrast or soft-tissue dynamic range.",
        )

    return True, ""
