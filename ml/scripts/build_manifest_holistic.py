#!/usr/bin/env python3
"""
LexiSight — Improved Manifest Builder with Session-Aware Signer Grouping
======================================================================
Fixes the broken signer_id = filename proxy issue.

What we know about INCLUDE dataset naming:
  - Clips are named MVI_XXXX.npy where MVI_ prefix + number = video file ID
  - Multiple clips with same MVI_XXXX stem = same recording session (same person)
  - MVI_4XXX, MVI_5XXX, MVI_8XXX, MVI_9XXX groups exist in holistic/

So instead of signer_id = npy_file.stem (which makes every clip its own "signer"),
we use the full MVI stem as the session_id, which groups clips from the same video.

For CISLR data: use the folder name as session_id since it already encodes person.

Usage:
  python ml/scripts/build_manifest_holistic.py --mode include_only
  python ml/scripts/build_manifest_holistic.py --mode combined
"""

import argparse
import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent


def extract_session_id(rel_path_str):
    """
    Extract a meaningful session/signer ID from the clip path.
    - INCLUDE clips: MVI_XXXX.npy → use full stem as session_id (each MVI = one recording session)
    - CISLR clips: stored in signer-named folders → parent folder name = signer
    """
    rel_path = Path(rel_path_str)
    filename = rel_path.stem
    parent_name = rel_path.parent.name

    if parent_name == "holistic":
        return filename
    if parent_name == "cislr_holistic":
        return f"cislr_{filename.split('_')[0]}"
    return filename


def scan_directory(data_dir, source_name):
    rows = []
    data_path = Path(data_dir)

    if not data_path.exists():
        print(f"  {source_name}: not found at {data_path}")
        return rows

    for class_dir in sorted(data_path.iterdir()):
        if not class_dir.is_dir():
            continue
        class_name = class_dir.name
        for npy_file in sorted(class_dir.glob("*.npy")):
            rel_path = npy_file.relative_to(BASE_DIR / "ml" / "data_processed")
            session_id = extract_session_id(str(rel_path))
            rows.append({
                "clip_path": str(rel_path),
                "class": class_name,
                "source": source_name,
                "signer_id": session_id,
                "split": "",
            })

    signer_count = len(set(r["signer_id"] for r in rows))
    clip_count = len(rows)
    print(f"  {source_name}: {clip_count} clips, {signer_count} sessions/signers")
    return rows


def main():
    p = argparse.ArgumentParser()
    p.add_argument(
        "--mode",
        choices=["include_only", "combined"],
        default="include_only",
    )
    p.add_argument("--output", default=None)
    args = p.parse_args()

    default_outputs = {
        "include_only": "ml/data_processed/manifest_holistic_include.csv",
        "combined": "ml/data_processed/manifest_holistic_combined.csv",
    }
    output_path = Path(args.output or default_outputs[args.mode])

    print(f"Building manifest: {args.mode}")
    print(f"Output: {output_path}")

    all_rows = []

    all_rows.extend(scan_directory(
        BASE_DIR / "ml" / "data_processed" / "holistic",
        "include_holistic"
    ))

    if args.mode == "combined":
        all_rows.extend(scan_directory(
            BASE_DIR / "ml" / "data_processed" / "cislr_holistic",
            "cislr_holistic"
        ))

    if not all_rows:
        print("ERROR: No data found.")
        return

    df = pd.DataFrame(all_rows)

    print(f"\nTotal: {len(df)} clips, {df['signer_id'].nunique()} sessions/signers, "
          f"{df['class'].nunique()} classes")
    print(f"Per-source: {df['source'].value_counts().to_dict()}")

    cc = df["class"].value_counts()
    print(f"Samples/class: min={cc.min()}, max={cc.max()}, median={cc.median():.1f}")

    signer_class_counts = df.groupby("signer_id")["class"].nunique()
    print(f"Classes per signer: min={signer_class_counts.min()}, "
          f"max={signer_class_counts.max()}, median={signer_class_counts.median():.1f}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"\nSaved: {output_path}")


if __name__ == "__main__":
    main()
