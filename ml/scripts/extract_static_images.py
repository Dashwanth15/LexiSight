#!/usr/bin/env python3
"""
LexiSight — Static Image → 30-Frame Clip Converter
Converts existing static image landmarks into the unified
temporal format so letters/digits coexist with word sequences.

Each static image becomes a 30-frame clip by repeating the landmarks.

Usage: python ml/scripts/extract_static_images.py
"""

import json, argparse
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
TARGET_FRAMES = 30


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--x-path", default="public/model/X_train.npy",
                   help="Path to existing X_train.npy (shape: N, 63)")
    p.add_argument("--y-path", default="public/model/y_train.npy")
    p.add_argument("--label-map", default="public/model/label_map.json")
    p.add_argument("--output", default="ml/data_processed/static_images")
    args = p.parse_args()

    xp = BASE_DIR / args.x_path
    yp = BASE_DIR / args.y_path
    lp = BASE_DIR / args.label_map

    if not xp.exists():
        print(f"Not found: {xp}")
        print("Run ml/scripts/process_dataset.py first.")
        return

    X = np.load(str(xp))  # (N, 63)
    y = np.load(str(yp))  # (N,)
    with open(lp) as f:
        label_map = json.load(f)

    outdir = Path(args.output)
    print(f"Converting {len(X)} static samples to {TARGET_FRAMES}-frame clips...")

    counts = {}
    for i in range(len(X)):
        cls_idx = int(y[i])
        cls_name = label_map.get(str(cls_idx), str(cls_idx))

        # Reshape 63 → (21, 3), single hand
        lm_single = X[i].reshape(21, 3)

        # Build (30, 2, 21, 3) — repeat single frame, second hand is zeros
        frame = np.zeros((2, 21, 3), dtype=np.float32)
        frame[0] = lm_single
        clip = np.tile(frame, (TARGET_FRAMES, 1, 1, 1))  # (30, 2, 21, 3)

        cls_dir = outdir / cls_name
        cls_dir.mkdir(parents=True, exist_ok=True)

        idx = counts.get(cls_name, 0)
        np.save(cls_dir / f"static_{idx:05d}.npy", clip)
        counts[cls_name] = idx + 1

    total = sum(counts.values())
    print(f"Done: {total} clips across {len(counts)} classes saved to {outdir}")

    json.dump({
        "dataset": "static_images",
        "source": "Original ISL image datasets (converted to temporal format)",
        "clips": total,
        "classes": len(counts),
        "frames_per_clip": TARGET_FRAMES,
        "note": "Each static image repeated 30 times. Second hand is zeros.",
    }, open(outdir / "metadata.json", "w"), indent=2)


if __name__ == "__main__":
    main()
