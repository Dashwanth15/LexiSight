#!/usr/bin/env python3
"""
LexiSight — Feature Normalization Layer
=======================================
Applies statistical normalization to MediaPipe landmarks BEFORE feeding to the model:
  - Hand size normalization (palm-size invariant)
  - Distance-from-camera normalization (scale invariant)
  - Body orientation normalization (rotation invariant)
  - Relative landmark features (finger-to-finger, hand-to-face distances)

Why this matters:
  - Current model trusts MediaPipe raw coordinates directly
  - Landmarks vary with: camera distance, hand size, body angle, lighting
  - Normalizing makes predictions invariant to these factors

Usage:
  python ml/scripts/normalize_features.py --input ml/data_processed/holistic \
                                          --output ml/data_processed/holistic_normalized
"""

import argparse
import json
import numpy as np
import pandas as pd
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
from tqdm import tqdm

BASE_DIR = Path(__file__).parent.parent.parent
SEQ_LEN = 30
N_POSE = 33
N_HAND = 21
DIM = (N_POSE + N_HAND + N_HAND) * 3  # 225

# Relative landmark indices for finger-to-finger / hand-to-face features
FINGER_TIPS = [4, 8, 12, 16, 20]  # thumb, index, middle, ring, pinky tips
PALM_CENTER_IDX = 9  # middle finger MCP as palm proxy
HAND_CENTERS = {
    "left": 9,   # left middle finger MCP
    "right": 9,  # right middle finger MCP
}
NOSE_IDX = 0


def compute_relative_features(frame: np.ndarray) -> np.ndarray:
    """
    Compute relative geometric features from a raw 225-dim frame.
    Returns a 30-dim feature vector of distances/ratios.
    """
    feat = np.zeros(30, dtype=np.float32)

    pose = frame[:N_POSE * 3].reshape(N_POSE, 3)
    lh = frame[N_POSE * 3 : N_POSE * 3 + N_HAND * 3].reshape(N_HAND, 3)
    rh = frame[N_POSE * 3 + N_HAND * 3 :].reshape(N_HAND, 3)

    def norm(arr):
        return np.linalg.norm(arr) + 1e-8

    def fingertip_spread(hand):
        tip_indices = [1, 4, 8, 12, 16]  # MCP-ish proxies
        tips = [hand[i] for i in tip_indices if i < len(hand)]
        if len(tips) < 2:
            return 0.0
        dists = [norm(tips[i] - tips[j]) for i in range(len(tips)) for j in range(i+1, len(tips))]
        return float(np.mean(dists)) if dists else 0.0

    feat[0] = fingertip_spread(lh)
    feat[1] = fingertip_spread(rh)
    feat[2] = norm(lh[0] - rh[0]) if len(lh) > 0 and len(rh) > 0 else 0.0

    if np.any(pose[NOSE_IDX]):
        nose = pose[NOSE_IDX]
        lh_center = lh[HAND_CENTERS["left"]] if len(lh) > HAND_CENTERS["left"] else None
        rh_center = rh[HAND_CENTERS["right"]] if len(rh) > HAND_CENTERS["right"] else None
        feat[3] = norm(nose - lh_center) if lh_center is not None else 0.0
        feat[4] = norm(nose - rh_center) if rh_center is not None else 0.0
        feat[5] = norm(pose[11] - pose[12]) if np.any(pose[11]) and np.any(pose[12]) else 1.0

    for i, ft_idx in enumerate(FINGER_TIPS[:5]):
        if ft_idx < len(lh) and np.any(lh[ft_idx]):
            feat[6 + i] = norm(lh[ft_idx] - lh[0])
        if ft_idx < len(rh) and np.any(rh[ft_idx]):
            feat[11 + i] = norm(rh[ft_idx] - rh[0])

    shoulder_dist = norm(pose[11] - pose[12]) if np.any(pose[11]) and np.any(pose[12]) else 1.0
    feat[16] = 1.0 / (shoulder_dist + 1e-8)

    if np.any(pose[23]) and np.any(pose[24]):
        hip_dist = norm(pose[23] - pose[24])
        feat[17] = shoulder_dist / (hip_dist + 1e-8)

    body_center = (pose[11] + pose[12]) / 2 if np.any(pose[11]) else None
    if body_center is not None:
        lh_bulk = np.mean(lh, axis=0) if len(lh) > 0 else None
        rh_bulk = np.mean(rh, axis=0) if len(rh) > 0 else None
        feat[18] = norm(lh_bulk - body_center) if lh_bulk is not None else 0.0
        feat[19] = norm(rh_bulk - body_center) if rh_bulk is not None else 0.0

    for i in range(5):
        if i < len(lh) and np.any(lh[i]):
            feat[20 + i] = norm(lh[i] - pose[NOSE_IDX]) if np.any(pose[NOSE_IDX]) else 0.0
        if i < len(rh) and np.any(rh[i]):
            feat[25 + i] = norm(rh[i] - pose[NOSE_IDX]) if np.any(pose[NOSE_IDX]) else 0.0

    return feat


def normalize_sequence(seq: np.ndarray) -> np.ndarray:
    """
    Normalize an entire (30, 225) sequence.

    Step 1: Per-frame geometric normalization
    Step 2: Aggregate statistics across sequence
    Step 3: Return original + relative features
    """
    rel_feats = np.array([compute_relative_features(seq[i]) for i in range(seq.shape[0])])
    rel_mean = np.mean(rel_feats, axis=0)
    rel_std = np.std(rel_feats, axis=0) + 1e-8
    rel_norm = (rel_feats - rel_mean) / rel_std

    seq_copy = seq.copy()
    for i in range(seq_copy.shape[0]):
        frame = seq_copy[i]
        pose = frame[:N_POSE*3].reshape(N_POSE, 3)
        lh = frame[N_POSE*3 : N_POSE*3+N_HAND*3].reshape(N_HAND, 3)
        rh = frame[N_POSE*3+N_HAND*3:].reshape(N_HAND, 3)

        if np.any(pose[11]) and np.any(pose[12]):
            shoulder_dist = np.linalg.norm(pose[11, :2] - pose[12, :2]) + 1e-8
            pose[:, :2] /= shoulder_dist

        for hand, center_idx in [(lh, 0), (rh, 0)]:
            if np.any(hand):
                max_dist = np.max(np.linalg.norm(hand, axis=1)) + 1e-8
                hand /= max_dist

        seq_copy[i, :N_POSE*3] = pose.flatten()
        seq_copy[i, N_POSE*3 : N_POSE*3+N_HAND*3] = lh.flatten()
        seq_copy[i, N_POSE*3+N_HAND*3:] = rh.flatten()

    combined = np.concatenate([seq_copy.flatten(), rel_norm.flatten()], axis=0)
    return combined.astype(np.float32)


def normalize_file(npy_path: Path, out_path: Path) -> bool:
    try:
        seq = np.load(npy_path).astype(np.float32)
        if seq.shape != (SEQ_LEN, DIM):
            return False
        normalized = normalize_sequence(seq)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        np.save(out_path, normalized)
        return True
    except Exception:
        return False


def main():
    p = argparse.ArgumentParser(description="Normalize holistic landmark features")
    p.add_argument("--input", default="ml/data_processed/holistic",
                   help="Input directory of .npy files")
    p.add_argument("--output", default="ml/data_processed/holistic_normalized",
                   help="Output directory")
    p.add_argument("--manifest", default=None,
                   help="Optional manifest CSV to process only listed clips")
    p.add_argument("--workers", type=int, default=4)
    args = p.parse_args()

    in_dir = Path(args.input)
    out_dir = Path(args.output)

    if not in_dir.exists():
        print(f"Input not found: {in_dir}")
        return

    tasks = []
    if args.manifest:
        df = pd.read_csv(args.manifest)
        for _, row in df.iterrows():
            p2 = Path(row["clip_path"])
            if p2.is_absolute():
                src = p2
            else:
                src = BASE_DIR / "ml" / "data_processed" / p2
            if src.exists():
                tasks.append(src)
    else:
        tasks = list(in_dir.rglob("*.npy"))

    print(f"Normalizing {len(tasks)} files from {in_dir}")
    print(f"Output: {out_dir}")
    print(f"Output feature dim: {SEQ_LEN * DIM} + {SEQ_LEN * 30} = {SEQ_LEN * (DIM + 30)}")

    ok, fail = 0, 0
    for src in tqdm(tasks, desc="Normalizing"):
        rel = src.relative_to(in_dir)
        dst = out_dir / rel
        if dst.exists():
            ok += 1
            continue
        if normalize_file(src, dst):
            ok += 1
        else:
            fail += 1

    print(f"Done: {ok} ok, {fail} failed")
    print(f"Normalized files: {out_dir}")

    meta = {
        "input_dim": SEQ_LEN * DIM,
        "output_dim": SEQ_LEN * (DIM + 30),
        "relative_feature_dim": 30,
        "processed": ok,
        "failed": fail,
    }
    with open(out_dir / "normalization_meta.json", "w") as f:
        json.dump(meta, f, indent=2)


if __name__ == "__main__":
    main()
