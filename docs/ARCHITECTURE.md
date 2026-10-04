# CureNet architecture

## System boundary

CureNet is a computer-vision research application for two image-analysis tasks:

- lung CT slice classification;
- brain-stroke pattern classification from a head CT slice.

```text
React interface
      |
      v
FastAPI imaging endpoint
      |
      +-- upload and radiological-image validation
      +-- anatomy gate
      +-- lung classifier ------> Grad-CAM
      `-- brain-stroke classifier
```

## Runtime components

### React frontend

The frontend selects the analysis mode, uploads a PNG/JPEG image, calls the
imaging endpoint, and renders class scores, limitations, model metadata, and the
lung Grad-CAM overlay when available.

### FastAPI inference service

`ml_services/app.py` owns runtime model loading, contract checks, preprocessing,
anatomy routing, inference, response construction, and Grad-CAM generation.

### Anatomy gate

The anatomy gate classifies an uploaded image as head CT, lung CT, or unsupported.
It rejects uncertain inputs and prevents a head image from reaching the lung model
or a lung image from reaching the stroke model.

### Lung module

The lung artifact uses MobileNetV2 transfer learning and produces ordered scores
for `normal`, `benign`, and `malignant`. Runtime metadata defines input dimensions,
class order, and model version. Grad-CAM is generated from the classifier's final
convolutional representation.

### Brain-stroke module

The stroke artifact uses EfficientNetV2B0 transfer learning and produces ordered
scores for `no_stroke`, `ischemic_stroke`, and `hemorrhagic_stroke`. Metadata is
validated before the model is admitted into service.

## Imaging request flow

1. Validate upload size and image encoding.
2. Validate basic radiological-image characteristics.
3. Preprocess the image for the anatomy gate.
4. Reject unsupported, uncertain, or anatomy-mismatched input.
5. Preprocess according to the selected classifier contract.
6. Run TensorFlow inference outside the async event loop.
7. Validate output shape, range, and probability semantics.
8. Generate lung Grad-CAM when applicable.
9. Return class scores, model version, input scope, and research warning.

## Failure behavior

- Missing or invalid metadata: startup fails for that artifact.
- Missing optional classifier: health is degraded and that mode is unavailable.
- Missing required anatomy gate: inference remains unavailable.
- Invalid or mismatched image: request fails closed before disease classification.
- Invalid model output: the API returns an error rather than inventing a label.

## Deployment boundary

The current system is a local research prototype. Clinical deployment would
require complete-study DICOM processing, stronger data governance, external
validation, monitoring, security review, and applicable regulatory oversight.
