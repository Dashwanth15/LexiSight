#!/usr/bin/env python3
"""
LexiSight — Manifest Builder
Merges all extracted datasets into a single manifest.csv.

Usage: python ml/scripts/build_manifest.py
"""

import json, csv, argparse
import numpy as np
import yaml
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--processed", default="ml/data_processed")
    p.add_argument("--output", default="ml/data_processed/manifest.csv")
    args = p.parse_args()

    proc = Path(args.processed)
    rows = []
    sources = ["include", "cislr", "acm", "static_images"]

    for source in sources:
        src_dir = proc / source
        if not src_dir.exists():
            print(f"  Skip {source} (not found)")
            continue
        # Search recursively for .npy files
        for npy in src_dir.rglob("*.npy"):
            # The class name is the immediate parent directory of the .npy file
            cls_name = npy.parent.name
            # Try to extract signer_id from filename or path
            parts = npy.stem.split("_")
            signer = parts[0] if len(parts) > 1 else "unknown"
            rows.append({
                "clip_path": str(npy.relative_to(proc)),
                "class": cls_name,
                "source": source,
                "signer_id": signer,
                "split": "",  # assigned later by train script
            })

    # Write manifest
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["clip_path", "class", "source", "signer_id", "split"])
        w.writeheader()
        w.writerows(rows)

    # Stats
    classes = set(r["class"] for r in rows)
    print(f"\nManifest: {len(rows)} clips across {len(classes)} classes")
    print(f"Sources: {dict((s, sum(1 for r in rows if r['source']==s)) for s in sources)}")
    print(f"Saved to: {out}")


if __name__ == "__main__":
    main()
