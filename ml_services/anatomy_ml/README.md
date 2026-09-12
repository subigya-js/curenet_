# CT anatomy and out-of-distribution gate

The gate runs before the stroke and lung classifiers. It emits `head_ct`,
`lung_ct`, or `unsupported`, then applies validation-selected probability and
margin thresholds. The inference API fails closed when this artifact is absent,
uncertain, unsupported, or inconsistent with the requested analysis.

For local UI development only, inference can be temporarily enabled before the
gate artifact exists:

```bash
CURENET_REQUIRE_ANATOMY_GATE=false python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

The API marks every such response with an anatomy-unverified warning. Never set
this bypass in a shared, staged, or production environment.

## Dataset requirements

Training requires an explicitly reviewed CSV manifest with these columns:

```csv
path,label,group_id,source,split
/data/head/a.png,head_ct,head-patient-001,teknofest,train
/data/lung/b.png,lung_ct,lung-patient-001,lidc-idri,validation
/data/xray/c.png,unsupported,xray-patient-001,mimic-cxr,test
```

Allowed labels are `head_ct`, `lung_ct`, and `unsupported`; allowed splits are
`train`, `validation`, and `test`. `group_id` must identify the patient or study,
not the slice. One group may not cross splits. Every class must appear in every
split. The loader hashes decoded pixels and rejects exact-image leakage or
conflicting labels.

Use multiple independent sources for every label. The unsupported class should
include other CT anatomy, MRI, radiographs, ultrasound, pathology, photographs,
screenshots, and synthetic graphics. Do not let anatomy labels correspond
one-to-one with source datasets, borders, compression formats, or image sizes.

## Training

```bash
cd ml_services
python -m anatomy_ml.train \
  --manifest /path/to/anatomy_manifest.csv \
  --output-dir artifacts/ct_anatomy_gate_v1
```

Run a pipeline smoke test first:

```bash
python -m anatomy_ml.train \
  --manifest /path/to/anatomy_manifest.csv \
  --quick-check \
  --output-dir artifacts/ct_anatomy_gate_smoke
```

Smoke-test metadata is marked `deployment_ready: false`, and the inference API
will reject it. Only a successful full run emits deployable metadata.

The full run exports `ct_anatomy_gate_v1.keras`, matching metadata, test
metrics, an audited manifest, and training history. Copy the model and metadata
into `ml_services/models/`. Thresholds are selected on validation data subject
to the configured maximum unsafe-acceptance rate, then reported once on the
locked test split.

## Acceptance criteria

Do not deploy based on overall accuracy. Report supported-scan coverage,
accepted-only accuracy, unsupported false acceptance, and wrong-anatomy unsafe
acceptance. Validate on complete external sources that were not used for model
selection. The gate reduces known misuse; it cannot prove that an arbitrary
image is medically authentic.
