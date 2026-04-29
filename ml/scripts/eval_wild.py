#!/usr/bin/env python3
"""
LexiSight — Wild Test Evaluator
Evaluates any model against the wild test set.

Usage: python ml/scripts/eval_wild.py --model public/model/tfjs_model
"""

import json, argparse, time
import numpy as np
from pathlib import Path
from sklearn.metrics import classification_report, confusion_matrix

BASE_DIR = Path(__file__).parent.parent.parent


def load_wild_test(wild_dir):
    """Load all .npy clips from wild test directory."""
    X, y, labels = [], [], []
    label_set = sorted([d.name for d in wild_dir.iterdir() if d.is_dir()])
    label_to_idx = {l: i for i, l in enumerate(label_set)}

    for cls_dir in sorted(wild_dir.iterdir()):
        if not cls_dir.is_dir(): continue
        cls = cls_dir.name
        if cls not in label_to_idx: continue
        for npy in cls_dir.glob("*.npy"):
            arr = np.load(npy)
            X.append(arr)
            y.append(label_to_idx[cls])
            labels.append(cls)

    return np.array(X), np.array(y), label_set


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--wild-dir", default="ml/data_processed/wild_test")
    p.add_argument("--metrics-out", default="ml/eval/metrics_wild.json")
    args = p.parse_args()

    wild_dir = Path(args.wild_dir)
    if not wild_dir.exists():
        print(f"Wild test set not found at {wild_dir}")
        print(f"Follow docs/wild_test_protocol.md to create it.")
        return

    X, y, label_set = load_wild_test(wild_dir)
    print(f"Wild test: {len(X)} clips, {len(label_set)} classes")

    if len(X) == 0:
        print("No clips found. Exiting.")
        return

    # For now, evaluate the existing Dense model on static features
    # TODO: Switch to temporal model evaluation when available
    print("\nWild test evaluation requires a trained model.")
    print("Run this after training with: python ml/scripts/eval_wild.py")

    # Save placeholder metrics
    metrics = {
        "wild_test_clips": len(X),
        "wild_test_classes": len(label_set),
        "wild_test_accuracy": None,
        "note": "Awaiting model training. Record wild test clips first.",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    out = Path(args.metrics_out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Placeholder metrics saved to {out}")


if __name__ == "__main__":
    main()
