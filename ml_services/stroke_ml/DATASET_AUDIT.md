# TEKNOFEST Kaggle v3 archive audit

Audit date: 2026-09-11  
Kaggle version: 3, published 2025-03-24  
Archive size: 1,530,251,813 bytes

## Archive inventory

| Partition | Class or resource | Files |
|---|---:|---:|
| Development | Normal PNG | 4,427 |
| Development | Ischemia PNG | 1,130 |
| Development | Bleeding PNG | 1,093 |
| External | PNG with binary label | 200 |
| Supporting | DICOM | 6,850 |
| Supporting | Masks and overlays | 2,623 |
| External | `labels.csv` | 1 |

The counts above were read directly from the downloaded Kaggle archive, not
copied from its description. The archive contains 16,324 files in total.

## Loader result

The implemented loader found 6,850 eligible source PNGs and 20 groups of exact
decoded-pixel duplicates. Nineteen are within development data; one bleeding
image is duplicated in the external set. It keeps the development copy, which
leaves:

- 6,631 unique development images: 4,426 no stroke, 1,130 ischemic stroke, and
  1,075 hemorrhagic stroke.
- 199 unique external images: 130 no stroke and 69 stroke.
- Zero exact-image overlap between resulting splits.

The deterministic seed-2026 split produces 4,641 training, 995 validation, and
995 internal-test images. The 199 external images remain in `external_test` and
are not used for model selection.

## Interpretation constraint

The archive does not expose a reliable patient or examination identifier.
Exact-image deduplication prevents direct duplicate leakage, but cannot prove
that different slices from one patient are separated. Consequently, internal
metrics are slice-level and potentially optimistic. The external labels are
binary, so that set evaluates only stroke/no-stroke screening, not ischemic
versus hemorrhagic subtype classification.
