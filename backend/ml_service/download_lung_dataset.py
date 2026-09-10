from __future__ import annotations

import argparse
from pathlib import Path


DATASET_HANDLE = "hamdallak/the-iqothnccd-lung-cancer-dataset"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download the CC BY 4.0 IQ-OTH/NCCD lung CT dataset from Kaggle."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/iq-oth-nccd"),
        help="Destination directory (default: data/iq-oth-nccd)",
    )
    parser.add_argument("--force", action="store_true", help="Replace an existing download")
    return parser.parse_args()


def main() -> None:
    try:
        import kagglehub
    except ImportError as exc:
        raise SystemExit(
            "kagglehub is required. Install it with: pip install -r requirements-train.txt"
        ) from exc

    args = parse_args()
    destination = args.output_dir.resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    downloaded = kagglehub.dataset_download(
        DATASET_HANDLE,
        output_dir=str(destination),
        force_download=args.force,
    )
    print(f"Dataset downloaded to: {downloaded}")
    print("Source DOI: https://doi.org/10.17632/bhmdr45bh2.4")
    print("License: Creative Commons Attribution 4.0 International")


if __name__ == "__main__":
    main()
