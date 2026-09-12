# Brain stroke CT pipeline

This package rebuilds CureNet's brain-imaging component as a reproducible
research pipeline. It preserves the report's upload-and-early-warning workflow
while narrowing the model to a supportable input and output contract.

## Final task definition

- Input: one 2D non-contrast head CT slice rendered as JPEG or PNG.
- Primary output: `no_stroke`, `ischemic_stroke`, or `hemorrhagic_stroke`.
- Derived report-compatible output: `stroke_probability = 1 - P(no_stroke)`.
- Intended role: educational research and prioritization experiments only.
- Excluded claims: diagnosis, treatment recommendation, patient-level accuracy,
  and support for MRI, photographs, or arbitrary medical images.

The training source is the TEKNOFEST-2021 Stroke Dataset packaged on Kaggle as
`ozguraslank/brain-stroke-ct-dataset`. The source paper describes 6,651
training images: 4,427 no-stroke/chronic-or-normal findings, 1,131
hyperacute/acute ischemic findings, and 1,093 hemorrhagic findings. Seven
radiologists curated the data. The package also contains external data and
lesion masks.

The current Kaggle v3 archive differs slightly from the publication summary.
An independent archive audit found 6,650 development PNGs (4,427 normal, 1,130
ischemia, 1,093 bleeding) plus 200 externally labelled PNGs. It also found 20
exact duplicate groups, including one overlap between development and external
data. See `DATASET_AUDIT.md`; every training run repeats this audit rather than
hard-coding those observations.

The public dataset mirrors do not state an unambiguous reuse license. Confirm
usage rights with the Republic of Turkiye Ministry of Health/TUSEB before
redistributing images or using the work beyond a private academic experiment.
No dataset image is committed to this repository.

## Run in Colab or Kaggle

Use the notebook at `notebooks/train_brain_stroke_colab.ipynb`, or run:

```bash
cd ml_services
python -m pip install -r requirements-train.txt
python -m stroke_ml.train --output-dir artifacts/stroke_ct_v2
```

For a pipeline smoke test with eight images per class and split:

```bash
python -m stroke_ml.train --quick-check --output-dir artifacts/stroke_ct_smoke
```

The full run produces:

```text
artifacts/stroke_ct_v2/
├── brain_stroke_v2.keras
├── brain_stroke_v2.metadata.json
├── dataset_audit.json
├── external_binary_metrics.json
├── external_binary_predictions.csv
├── manifest.csv
├── metrics.json
├── predictions.csv
├── confusion_matrix.png
└── training_history.csv
```

Copy both `brain_stroke_v2.keras` and `brain_stroke_v2.metadata.json` into
`ml_services/models/`. The API detects the model at startup and verifies its
input shape, output count, class order, version, image size, and resize policy
before switching to the v2 response contract. It refuses to load the v2 model
when the metadata is missing or incompatible.

## Dataset decision record

| Dataset | Decision | Reason |
|---|---|---|
| TEKNOFEST-2021 | Primary development set | CT, three report-relevant classes, radiologist labels, manageable on free GPU |
| CQ500 | Future hemorrhage-focused external test | Independent CT examinations and three-reader labels, but not an ischemic-stroke test set |
| RSNA ICH | Not the primary set | Strong hemorrhage resource but approximately 459 GB and does not cover ischemic stroke |
| ISLES 2022 | Not selected | Strong ischemic-stroke resource, but multimodal MRI does not match the report's CT workflow |

## Evaluation policy

Accuracy alone is insufficient. The pipeline saves per-class precision, recall,
and F1; balanced accuracy; macro F1; one-vs-rest macro AUROC; calibration error;
confusion matrix; and bootstrap confidence intervals.

The public Kaggle packaging does not expose reliable patient identifiers. The
pipeline removes exact decoded-pixel duplicates before splitting, but that
cannot prove patient independence. The package's 200-image binary external set
is isolated as `external_test` and never mixed into development. It evaluates
only the derived stroke/no-stroke score because it has no
ischemic-versus-hemorrhagic subtype labels. All primary results must be reported
as slice-level internal testing, and the binary result as external slice-level
testing. Do not call either result “clinical validation.”
