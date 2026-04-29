#!/usr/bin/env python3
"""
LexiSight — INCLUDE Dataset Extractor
Extracts MediaPipe landmarks from INCLUDE-50 ISL videos.
Output: .npy files (30, 2, 21, 3) per clip.

Usage:
    python ml/scripts/extract_include.py --input ml/data/INCLUDE
"""

import os, cv2, json, argparse, time
import mediapipe as mp
import numpy as np
import yaml
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

BASE_DIR = Path(__file__).parent.parent.parent
MODEL_ASSET = str(BASE_DIR / 'ml' / 'assets' / 'hand_landmarker.task')
TARGET_FRAMES = 30

lock = Lock()
stats = {"processed": 0, "skipped": 0, "no_hand": 0, "total": 0}


def load_class_merge(path):
    if not path.exists(): return {}
    with open(path, encoding='utf-8') as f: raw = yaml.safe_load(f)
    rev = {}
    for canon, variants in raw.items():
        if canon == "_EXCLUDE":
            for v in variants: rev[str(v).upper()] = None
        else:
            for v in variants: rev[str(v).upper()] = str(canon).upper()
    return rev


def extract_clip(video_path, target_frames=TARGET_FRAMES):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened(): return None
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total < 5: cap.release(); return None

    indices = np.linspace(0, total-1, min(target_frames, total), dtype=int)
    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ret, frame = cap.read()
        if ret: frames.append(frame)
    cap.release()
    if len(frames) < 5: return None

    opts = vision.HandLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=MODEL_ASSET), num_hands=2,
        min_hand_detection_confidence=0.3, min_hand_presence_confidence=0.3, min_tracking_confidence=0.3)
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
    if np.any(arr[:, 0] != 0, axis=(1, 2)).sum() < target_frames * 0.2: return None
    return arr


def worker(args_tuple):
    vp, cls, outdir = args_tuple
    op = outdir / cls / f"{vp.stem}.npy"
    if op.exists():
        with lock: stats["skipped"] += 1
        return
    lm = extract_clip(vp)
    if lm is None:
        with lock: stats["no_hand"] += 1
        return
    op.parent.mkdir(parents=True, exist_ok=True)
    np.save(op, lm)
    with lock: stats["processed"] += 1


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", default="ml/data/INCLUDE")
    p.add_argument("--output", default="ml/data_processed/include")
    p.add_argument("--workers", type=int, default=4)
    args = p.parse_args()

    root, outdir = Path(args.input), Path(args.output)
    if not root.exists():
        print(f"Not found: {root}\nDownload: https://zenodo.org/records/4010759"); return

    merge = load_class_merge(BASE_DIR / "ml" / "configs" / "class_merge.yaml")
    import re
    tasks = []
    for v in list(root.rglob("*.mp4")) + list(root.rglob("*.avi")) + list(root.rglob("*.MOV")) + list(root.rglob("*.mov")):
        raw_class_name = v.parent.name
        clean_class_name = re.sub(r'^\d+[\s\.]*', '', raw_class_name).strip()
        if not clean_class_name:
            clean_class_name = raw_class_name
        canon = merge.get(clean_class_name.upper(), clean_class_name.upper())
        if canon is None: continue
        tasks.append((v, canon, outdir))

    stats["total"] = len(tasks)
    print(f"INCLUDE extractor: {len(tasks)} videos across {len(set(t[1] for t in tasks))} classes")
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(worker, t) for t in tasks]
        for i, f in enumerate(as_completed(futs)):
            f.result()
            done = stats["processed"] + stats["skipped"] + stats["no_hand"]
            if done % 100 == 0:
                print(f"  [{done}/{stats['total']}] ok={stats['processed']} skip={stats['skipped']} nohand={stats['no_hand']}")

    print(f"Done in {(time.time()-t0)/60:.1f}m | ok={stats['processed']} skip={stats['skipped']} nohand={stats['no_hand']}")
    json.dump({"dataset": "INCLUDE", "processed": stats["processed"]}, open(outdir / "metadata.json", "w"), indent=2)

if __name__ == "__main__":
    main()
