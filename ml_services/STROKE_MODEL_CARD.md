# CureNet Stroke CT v2 model card

## Status

Training pipeline implemented; final weights and measured results are pending a
completed GPU run. Blank or illustrative numbers must never be added as results.

## Intended use

The model classifies a rendered 2D non-contrast head CT slice into three image
patterns: no stroke, acute/hyperacute ischemic stroke, or hemorrhagic stroke.
It also derives an aggregate stroke-pattern probability for CureNet's early
warning interface. This is an undergraduate research demonstration, not a
medical device or autonomous diagnostic system.

## Architecture

EfficientNetV2-B0 initialized with ImageNet weights, followed by global average
pooling, batch normalization, dropout, and a three-class softmax head. Training
has a frozen-backbone phase followed by low-learning-rate fine-tuning of the
last 40 non-batch-normalization layers.

## Data

Primary development data: TEKNOFEST-2021 Stroke Dataset. The source paper
reports CT data from the Turkish Ministry of Health's e-Pulse and Teleradiology
systems collected during 2019-2020, curated and annotated by seven radiologists.
The three relevant labels are no stroke, hyperacute/acute ischemia, and
hemorrhage.

The package also includes 200 external PNGs with binary stroke/no-stroke labels.
They are excluded from model development and used only to test the aggregate
`1 - P(no_stroke)` output; they cannot evaluate stroke subtype classification.

Reuse rights for public mirrors are unclear. Data must not be redistributed
from this repository, and the responsible authorities should be contacted
before publication or broader use.

## Preprocessing

- Decode a source PNG/JPEG into three RGB channels.
- Preserve aspect ratio and pad to 224 x 224.
- Scale pixels to 0-1 at the data boundary.
- Convert to EfficientNet's -1 to 1 range inside the saved model.
- Apply small rotation, translation, zoom, and contrast perturbations only in training.

## Required reporting

Report dataset version and counts after audit, exact split method, per-class
recall and precision, macro F1, balanced accuracy, one-vs-rest AUROC,
calibration error, confusion matrix, and 95% bootstrap confidence intervals.
Identify results as slice-level unless patient-independent data can be proven.

## Known limitations

- Patient identifiers are unavailable in the convenient public packaging.
- Exact duplicate removal cannot prevent leakage between different slices from
  the same unidentified patient or examination.
- A single slice omits the context available in a complete CT examination.
- Ischemic changes can be subtle or absent on early non-contrast CT.
- The model does not validate that an upload is actually a supported CT slice.
- Softmax values are not clinical confidence.
- Performance may shift across scanners, reconstruction kernels, institutions,
  populations, image compression, windowing, and comorbid pathologies.
- The model must not guide thrombolysis, thrombectomy, surgery, medication, or discharge.

## Deployment contract

The API returns all three class scores, the selected class, the derived
stroke-pattern probability, model version, supported input scope, and a visible
research warning. Unsupported modalities must not be presented as valid input.
