#!/usr/bin/env python3
"""
LexiSight — CISLR Dataset Holistic Extractor
Extracts MediaPipe Holistic landmarks (pose + hands) from CISLR videos.

CISLR has 7,050 videos across 4,764 ISL word classes.
Output per clip: .npy of shape (30, 225)

Uses dataset.csv for class labels (gloss column).
"""

import os, cv2, json, argparse, time, re
import mediapipe as mp
import numpy as np
import pandas as pd
from pathlib import Path
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

BASE_DIR = Path(__file__).parent.parent.parent
HOLISTIC_MODEL = str(BASE_DIR / 'ml' / 'assets' / 'holistic_landmarker.task')
TARGET_FRAMES = 30

N_POSE = 33
N_HAND = 21
FEATURE_DIM = (N_POSE + N_HAND + N_HAND) * 3  # 225


def normalize_pose(pose_landmarks):
    pose = np.array([[lm.x, lm.y, lm.z] for lm in pose_landmarks], dtype=np.float32)
    left_hip = pose[23]
    right_hip = pose[24]
    hip_center = (left_hip + right_hip) / 2.0
    pose = pose - hip_center
    shoulder_dist = np.linalg.norm(pose[11, :2] - pose[12, :2])
    if shoulder_dist < 1e-6:
        shoulder_dist = 1.0
    pose = pose / shoulder_dist
    return pose


def normalize_hand(hand_landmarks):
    hand = np.array([[lm.x, lm.y, lm.z] for lm in hand_landmarks], dtype=np.float32)
    wrist = hand[0].copy()
    hand = hand - wrist
    max_dist = np.max(np.linalg.norm(hand, axis=1))
    if max_dist < 1e-6:
        max_dist = 1.0
    hand = hand / max_dist
    return hand


def extract_clip_holistic(video_path, target_frames=TARGET_FRAMES):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None
    
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total < 5:
        cap.release()
        return None
    
    indices = np.linspace(0, total - 1, min(target_frames, total), dtype=int)
    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ret, frame = cap.read()
        if ret:
            frames.append(frame)
    cap.release()
    
    if len(frames) < 5:
        return None
    
    opts = vision.HolisticLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=HOLISTIC_MODEL),
        min_pose_detection_confidence=0.3,
        min_pose_landmarks_confidence=0.3,
        min_hand_landmarks_confidence=0.3,
        min_face_detection_confidence=0.3,
        min_face_landmarks_confidence=0.3,
    )
    
    sequence = []
    with vision.HolisticLandmarker.create_from_options(opts) as detector:
        for fr in frames:
            if fr.shape[0] > 480:
                s = 480 / fr.shape[0]
                fr = cv2.resize(fr, (int(fr.shape[1] * s), int(fr.shape[0] * s)))
            
            rgb = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = detector.detect(mp_img)
            
            frame_features = np.zeros(FEATURE_DIM, dtype=np.float32)
            
            if result.pose_landmarks:
                pose = normalize_pose(result.pose_landmarks)
                frame_features[0:N_POSE*3] = pose.flatten()
            
            if result.left_hand_landmarks:
                lh = normalize_hand(result.left_hand_landmarks)
                frame_features[N_POSE*3 : N_POSE*3 + N_HAND*3] = lh.flatten()
            
            if result.right_hand_landmarks:
                rh = normalize_hand(result.right_hand_landmarks)
                frame_features[N_POSE*3 + N_HAND*3 : ] = rh.flatten()
            
            sequence.append(frame_features)
    
    while len(sequence) < target_frames:
        sequence.append(sequence[-1])
    sequence = sequence[:target_frames]
    
    arr = np.array(sequence, dtype=np.float32)
    has_pose = np.any(arr[:, :N_POSE*3] != 0, axis=1).sum()
    if has_pose < target_frames * 0.2:
        return None
    
    return arr


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", default="Datasets/CISLR DATASET")
    p.add_argument("--output", default="ml/data_processed/cislr_holistic")
    p.add_argument("--test", type=int, default=0)
    args = p.parse_args()
    
    root = Path(args.input)
    outdir = Path(args.output)
    
    # Load dataset.csv for class labels
    csv_path = root / "dataset.csv"
    if not csv_path.exists():
        print(f"dataset.csv not found at {csv_path}")
        return
    
    df = pd.read_csv(csv_path)
    print(f"CISLR dataset: {len(df)} entries, {df['gloss'].nunique()} unique words")
    
    # Build uid -> (video_path, class) mapping
    video_dir = root / "CISLR_v1.5-a_videos" / "CISLR_v1.5-a_videos"
    if not video_dir.exists():
        # Try without nesting
        video_dir = root / "CISLR_v1.5-a_videos"
    
    tasks = []
    for _, row in df.iterrows():
        uid = row["uid"]
        gloss = str(row["gloss"]).strip().upper().replace(" ", "_")
        vpath = video_dir / f"{uid}.mp4"
        if vpath.exists():
            tasks.append((vpath, gloss))
    
    if args.test > 0:
        tasks = tasks[:args.test]
    
    classes = set(t[1] for t in tasks)
    print(f"Found {len(tasks)} videos across {len(classes)} classes")
    print(f"Output: {outdir}")
    
    t0 = time.time()
    ok, skip, fail = 0, 0, 0
    
    for i, (vp, cls) in enumerate(tasks):
        op = outdir / cls / f"{vp.stem}.npy"
        
        if op.exists():
            skip += 1
            continue
        
        try:
            arr = extract_clip_holistic(vp)
            if arr is not None:
                op.parent.mkdir(parents=True, exist_ok=True)
                np.save(op, arr)
                ok += 1
            else:
                fail += 1
        except Exception as e:
            fail += 1
            if i < 5:
                print(f"  Error on {vp.name}: {e}")
        
        done = ok + skip + fail
        if done % 50 == 0 or done == len(tasks):
            elapsed = (time.time() - t0) / 60
            eta = (elapsed / max(done, 1)) * (len(tasks) - done)
            print(f"  [{done}/{len(tasks)}] ok={ok} skip={skip} fail={fail} | {elapsed:.1f}min elapsed, ~{eta:.0f}min remaining")
    
    elapsed = (time.time() - t0) / 60
    print(f"\nDone in {elapsed:.1f} min | ok={ok} skip={skip} fail={fail}")
    
    meta = {"dataset": "CISLR_HOLISTIC", "processed": ok, "skipped": skip, "failed": fail, "feature_dim": FEATURE_DIM}
    outdir.mkdir(parents=True, exist_ok=True)
    with open(outdir / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2)


if __name__ == "__main__":
    main()
