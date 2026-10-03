"""Verify local model artifacts against the tracked CureNet manifest."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "ml_services" / "models"
MANIFEST_PATH = MODEL_DIR / "manifest.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    failures: list[str] = []

    for name, contract in manifest["artifacts"].items():
        model_path = MODEL_DIR / contract["filename"]
        if not model_path.exists():
            failures.append(f"{name}: missing {model_path.name}")
            continue
        if model_path.stat().st_size != int(contract["size_bytes"]):
            failures.append(f"{name}: unexpected file size")
            continue
        if sha256(model_path) != contract["sha256"]:
            failures.append(f"{name}: checksum mismatch")
            continue
        metadata_name = contract.get("metadata")
        if metadata_name and not (MODEL_DIR / metadata_name).exists():
            failures.append(f"{name}: missing {metadata_name}")
            continue
        print(f"OK {name}: {model_path.name}")

    if failures:
        for failure in failures:
            print(f"ERROR {failure}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
