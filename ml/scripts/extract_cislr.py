#!/usr/bin/env python3
"""
LexiSight — CISLR Dataset Extractor
Extracts landmarks from the CISLR HuggingFace dataset.

Usage: python ml/scripts/extract_cislr.py --output ml/data_processed/cislr
"""

import json, argparse, time
import numpy as np
import cv2
import mediapipe as mp
import yaml
from pathlib import Path
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

BASE_DIR = Path(__file__).parent.parent.parent
MODEL_ASSET = str(BASE_DIR / 'ml' / 'assets' / 'hand_landmarker.task')
TARGET_FRAMES = 30


def load_class_merge(path):
    if not path.exists(): return {}
    with open(path) as f: raw = yaml.safe_load(f)
    rev = {}
    for canon, variants in raw.items():
        if canon == "_EXCLUDE":
            for v in variants: rev[str(v).upper()] = None
        else:
            for v in variants: rev[str(v).upper()] = str(canon).upper()
    return rev


def extract_video_landmarks(video_path, target_frames=TARGET_FRAMES):
    """Extract (target_frames, 2, 21, 3) from a video file."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened(): return None
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total < 5: cap.release(); return None

    indices = np.linspace(0, total - 1, min(target_frames, total), dtype=int)
    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ret, frame = cap.read()
        if ret: frames.append(frame)
    cap.release()
    if len(frames) < 5: return None

    opts = vision.HandLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL_ASSET),
        num_hands=2)
    seq = []
    with vision.HandLandmarker.create_from_options(opts) as det:
        for fr in frames:
            if fr.shape[0] > 480:
                s = 480 / fr.shape[0]
                fr = cv2.resize(fr, (int(fr.shape[1]*s), int(fr.shape[0]*s)))
            rgb = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)
            res = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
            fd = np.zeros((2, 21, 3), dtype=np.float32)
            if res.hand_landmarks:
                for hi, hlm in enumerate(res.hand_landmarks[:2]):
                    w = hlm[0]
                    c = np.array([[p.x-w.x, p.y-w.y, (p.z or 0)-(w.z or 0)] for p in hlm], dtype=np.float32)
                    md = np.max(np.linalg.norm(c, axis=1)) or 1.0
                    fd[hi] = c / md
            seq.append(fd)

    while len(seq) < target_frames: seq.append(seq[-1])
    seq = seq[:target_frames]
    arr = np.array(seq, dtype=np.float32)
    if np.any(arr[:, 0] != 0, axis=(1, 2)).sum() < target_frames * 0.5: return None
    return arr


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", default="ml/data/CISLR",
                   help="Path to CISLR dataset root (or HF cache)")
    p.add_argument("--output", default="ml/data_processed/cislr")
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--use-hf", action="store_true",
                   help="Download from HuggingFace instead of local path")
    args = p.parse_args()

    outdir = Path(args.output)
    merge = load_class_merge(BASE_DIR / "ml" / "configs" / "class_merge.yaml")

    if args.use_hf:
        try:
            from datasets import load_dataset
            print("Loading CISLR from HuggingFace...")
            ds = load_dataset("Exploration-Lab/CISLR", split="train")
            print(f"  Loaded {len(ds)} samples")
            # Process HF dataset entries
            processed = 0
            for i, sample in enumerate(ds):
                # Adapt based on actual HF schema
                cls = str(sample.get("label", sample.get("gloss", "unknown"))).upper()
                canon = merge.get(cls, cls)
                if canon is None: continue

                # If sample has video bytes, write temp and extract
                if "video" in sample:
                    tmp = outdir / "_tmp_video.mp4"
                    tmp.parent.mkdir(parents=True, exist_ok=True)
                    with open(tmp, "wb") as f:
                        f.write(sample["video"]["bytes"] if isinstance(sample["video"], dict) else sample["video"])
                    lm = extract_video_landmarks(tmp)
                    if lm is not None:
                        op = outdir / canon / f"cislr_{i:06d}.npy"
                        op.parent.mkdir(parents=True, exist_ok=True)
                        np.save(op, lm)
                        processed += 1
                    tmp.unlink(missing_ok=True)

                if (i + 1) % 100 == 0:
                    print(f"  [{i+1}/{len(ds)}] processed={processed}")

            print(f"Done: {processed} clips saved to {outdir}")
        except ImportError:
            print("Install datasets: pip install datasets huggingface-hub")
        return

    # Local path mode
    root = Path(args.input)
    if not root.exists():
        print(f"Not found: {root}")
        print("Use --use-hf to download from HuggingFace")
        return

    processed, skipped = 0, 0
    for cls_dir in sorted(root.iterdir()):
        if not cls_dir.is_dir(): continue
        canon = merge.get(cls_dir.name.upper(), cls_dir.name.upper())
        if canon is None: continue
        for v in list(cls_dir.rglob("*.mp4")) + list(cls_dir.rglob("*.avi")):
            op = outdir / canon / f"{v.stem}.npy"
            if op.exists(): skipped += 1; continue
            lm = extract_video_landmarks(v)
            if lm is not None:
                op.parent.mkdir(parents=True, exist_ok=True)
                np.save(op, lm)
                processed += 1
        print(f"  {canon}: {processed} clips")

    print(f"Done: processed={processed} skipped={skipped}")
    json.dump({"dataset": "CISLR", "processed": processed},
              open(outdir / "metadata.json", "w"), indent=2)


if __name__ == "__main__":
    main()
