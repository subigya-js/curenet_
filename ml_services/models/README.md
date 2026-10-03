# Runtime model artifacts

This directory is the deployment boundary between the training pipelines and
the FastAPI inference service. The service expects these artifact pairs:

| Module | Model | Metadata |
|---|---|---|
| Anatomy gate | `ct_anatomy_gate_v1.keras` | `ct_anatomy_gate_v1.metadata.json` |
| Brain stroke | `brain_stroke_v2.keras` | `brain_stroke_v2.metadata.json` |
| Lung CT | `lung_cancer_retrained.keras` | `lung_cancer_retrained.metadata.json` |

Large `.keras` files are local generated artifacts and are excluded from Git.
Metadata and `manifest.json` are versioned because they define label order,
input shape, preprocessing, limitations, and artifact checksums.

Verify installed artifacts from the repository root:

```bash
make verify-models
```

Generate replacements through `anatomy_ml`, `stroke_ml`, or `lung_ml`. Never
replace a model without also replacing its matching metadata and updating the
checksum manifest.
