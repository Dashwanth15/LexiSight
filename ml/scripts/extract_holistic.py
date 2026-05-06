#!/usr/bin/env python3
"""
LexiSight — Holistic Landmark Extractor
Extracts MediaPipe Holistic landmarks (pose + hands) from INCLUDE videos.

Output per clip: .npy of shape (30, 225)
  = 30 frames x (33 pose landmarks + 21 left hand + 21 right hand) x 3 coords

Normalization applied at extraction time:
  - Pose: hip-center relative, shoulder-width scaled
  - Hands: wrist-relative, palm-size scaled  
  - All coords in [-1, 1] range approximately
"""

import os, cv2, json, argparse, time, re
import mediapipe as mp
import numpy as np
from pathlib import Path
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

BASE_DIR = Path(__file__).parent.parent.parent
HOLISTIC_MODEL = str(BASE_DIR / 'ml' / 'assets' / 'holistic_landmarker.task')
TARGET_FRAMES = 30

# Pose landmark indices (upper body focus)
# 0=nose, 2=left_eye_inner, 5=right_eye_inner, 7=left_ear, 8=right_ear,
# 11=left_shoulder, 12=right_shoulder, 13=left_elbow, 14=right_elbow,
# 15=left_wrist, 16=right_wrist, 23=left_hip, 24=right_hip
# We use ALL 33 for completeness but normalize relative to hips
N_POSE = 33
N_HAND = 21
FEATURE_DIM = (N_POSE + N_HAND + N_HAND) * 3  # 75 landmarks x 3 = 225


def normalize_pose(pose_landmarks):
    """Normalize 33 pose landmarks: hip-center relative, shoulder-width scaled."""
    pose = np.array([[lm.x, lm.y, lm.z] for lm in pose_landmarks], dtype=np.float32)
    
    # Center on mid-hip (landmarks 23, 24)
    left_hip = pose[23]
    right_hip = pose[24]
    hip_center = (left_hip + right_hip) / 2.0
    pose = pose - hip_center
    
    # Scale by shoulder width (landmarks 11, 12)
    shoulder_dist = np.linalg.norm(pose[11, :2] - pose[12, :2])
    if shoulder_dist < 1e-6:
        shoulder_dist = 1.0
    pose = pose / shoulder_dist
    
    return pose


def normalize_hand(hand_landmarks):
    """Normalize 21 hand landmarks: wrist-relative, palm-size scaled."""
    hand = np.array([[lm.x, lm.y, lm.z] for lm in hand_landmarks], dtype=np.float32)
    
    # Center on wrist (landmark 0)
    wrist = hand[0].copy()
    hand = hand - wrist
    
    # Scale by max distance from wrist
    max_dist = np.max(np.linalg.norm(hand, axis=1))
    if max_dist < 1e-6:
        max_dist = 1.0
    hand = hand / max_dist
    
    return hand


def extract_clip_holistic(video_path, target_frames=TARGET_FRAMES):
    """Extract holistic landmarks from a video clip."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None
    
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total < 5:
        cap.release()
        return None
    
    # Sample frames evenly
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
    
    # Create holistic landmarker
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
            # Resize if too large
            if fr.shape[0] > 480:
                s = 480 / fr.shape[0]
                fr = cv2.resize(fr, (int(fr.shape[1] * s), int(fr.shape[0] * s)))
            
            rgb = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = detector.detect(mp_img)
            
            # Initialize frame features as zeros
            frame_features = np.zeros(FEATURE_DIM, dtype=np.float32)
            
            # Extract pose (33 landmarks)
            if result.pose_landmarks:
                pose = normalize_pose(result.pose_landmarks)
                frame_features[0:N_POSE*3] = pose.flatten()
            
            # Extract left hand (21 landmarks)
            if result.left_hand_landmarks:
                lh = normalize_hand(result.left_hand_landmarks)
                frame_features[N_POSE*3 : N_POSE*3 + N_HAND*3] = lh.flatten()
            
            # Extract right hand (21 landmarks)
            if result.right_hand_landmarks:
                rh = normalize_hand(result.right_hand_landmarks)
                frame_features[N_POSE*3 + N_HAND*3 : ] = rh.flatten()
            
            sequence.append(frame_features)
    
    # Pad to target_frames if needed
    while len(sequence) < target_frames:
        sequence.append(sequence[-1])
    sequence = sequence[:target_frames]
    
    arr = np.array(sequence, dtype=np.float32)  # (30, 225)
    
    # Check that at least 20% of frames have some pose data
    has_pose = np.any(arr[:, :N_POSE*3] != 0, axis=1).sum()
    if has_pose < target_frames * 0.2:
        return None
    
    return arr


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", default="Datasets/INCLUDE_FULL DATASET")
    p.add_argument("--output", default="ml/data_processed/holistic")
    p.add_argument("--test", type=int, default=0, help="If >0, only process this many videos as a test")
    args = p.parse_args()
    
    root = Path(args.input)
    outdir = Path(args.output)
    
    if not root.exists():
        print(f"Dataset not found: {root}")
        return
    
    # Find all videos
    tasks = []
    for v in list(root.rglob("*.mp4")) + list(root.rglob("*.avi")) + list(root.rglob("*.MOV")) + list(root.rglob("*.mov")):
        raw_class = v.parent.name
        clean_class = re.sub(r'^\d+[\s\.]*', '', raw_class).strip().upper()
        if not clean_class:
            clean_class = raw_class.upper()
        tasks.append((v, clean_class))
    
    if args.test > 0:
        tasks = tasks[:args.test]
    
    classes = set(t[1] for t in tasks)
    print(f"Holistic extractor: {len(tasks)} videos across {len(classes)} classes")
    print(f"Output: {outdir}")
    print(f"Features per frame: {FEATURE_DIM} (33 pose + 21 left hand + 21 right hand) x 3")
    
    t0 = time.time()
    ok, skip, fail = 0, 0, 0
    
    for i, (vp, cls) in enumerate(tasks):
        op = outdir / cls / f"{vp.stem}.npy"
        
        # Skip if already extracted
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
            if i < 5:  # Print first few errors for debugging
                print(f"  Error on {vp.name}: {e}")
        
        done = ok + skip + fail
        if done % 50 == 0 or done == len(tasks):
            elapsed = (time.time() - t0) / 60
            eta = (elapsed / max(done, 1)) * (len(tasks) - done)
            print(f"  [{done}/{len(tasks)}] ok={ok} skip={skip} fail={fail} | {elapsed:.1f}min elapsed, ~{eta:.0f}min remaining")
    
    elapsed = (time.time() - t0) / 60
    print(f"\nDone in {elapsed:.1f} min | ok={ok} skip={skip} fail={fail}")
    
    # Save metadata
    meta = {"dataset": "INCLUDE_HOLISTIC", "processed": ok, "skipped": skip, "failed": fail, "feature_dim": FEATURE_DIM}
    outdir.mkdir(parents=True, exist_ok=True)
    with open(outdir / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2)


if __name__ == "__main__":
    main()
