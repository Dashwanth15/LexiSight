#!/usr/bin/env python3
"""
LexiSight Dataset Processor - MediaPipe Holistic & Video Edition
════════════════════════════════════════════════════════════════
Extracts spatial-temporal features from video datasets (like INCLUDE)
using MediaPipe Holistic. Outputs a 3D Tensor for Temporal Models.

Usage:
    python scripts/process_dataset.py
"""

import os
import cv2
import numpy as np
import mediapipe as mp
import json
from pathlib import Path
import threading

# ── Config ───────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
DATASET_DIR = BASE_DIR / "Datasets" / "include"  # Expected location of INCLUDE
OUTPUT_DIR = BASE_DIR / "public" / "model"

MAX_SEQ_LENGTH = 150  # Fixed sequence length (e.g., 5 secs @ 30fps)
MAX_SAMPLES_PER_CLASS = 150  # Cap per class to prevent RAM overload

mp_holistic = mp.solutions.holistic

# We select a subset of face landmarks (lips, eyes, eyebrows) to reduce dimensionality.
# Using all 468 face landmarks would cause massive overfitting.
SELECTED_FACE_LANDMARKS = [
    33, 133, 362, 263, # Eyes
    61, 291, 0, 17,    # Lips outer
    13, 14,            # Lips inner
    70, 300            # Eyebrows
]

# Total features:
# Pose: 33 * 4 = 132
# Face: 12 * 3 = 36
# Left Hand: 21 * 3 = 63
# Right Hand: 21 * 3 = 63
# Total = 294 features per frame

def extract_keypoints(results):
    """Extracts and flattens landmarks into a single 1D numpy array."""
    if results.pose_landmarks:
        pose = np.array([[res.x, res.y, res.z, res.visibility] for res in results.pose_landmarks.landmark]).flatten()
    else:
        pose = np.zeros(33 * 4)

    if results.face_landmarks:
        face = np.array([[results.face_landmarks.landmark[idx].x, 
                          results.face_landmarks.landmark[idx].y, 
                          results.face_landmarks.landmark[idx].z] for idx in SELECTED_FACE_LANDMARKS]).flatten()
    else:
        face = np.zeros(len(SELECTED_FACE_LANDMARKS) * 3)

    if results.left_hand_landmarks:
        lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten()
    else:
        lh = np.zeros(21 * 3)

    if results.right_hand_landmarks:
        rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten()
    else:
        rh = np.zeros(21 * 3)

    return np.concatenate([pose, face, lh, rh])

def process_video(video_path: Path):
    """Processes a single video, handles imputation, and returns a padded sequence."""
    cap = cv2.VideoCapture(str(video_path))
    sequence = []
    
    with mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
        prev_keypoints = None
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            # Resize if too large to speed up processing
            if frame.shape[1] > 640:
                scale = 640 / frame.shape[1]
                frame = cv2.resize(frame, (int(frame.shape[1]*scale), int(frame.shape[0]*scale)))
                
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image.flags.writeable = False
            results = holistic.process(image)
            
            keypoints = extract_keypoints(results)
            
            # Forward Fill Imputation
            # If the hands disappear due to motion blur, carry over the last known position.
            if prev_keypoints is not None:
                # LH is indices 168 to 231
                if np.all(keypoints[168:231] == 0):
                    keypoints[168:231] = prev_keypoints[168:231]
                # RH is indices 231 to 294
                if np.all(keypoints[231:294] == 0):
                    keypoints[231:294] = prev_keypoints[231:294]
            
            sequence.append(keypoints)
            prev_keypoints = keypoints

            # Truncate videos that are excessively long
            if len(sequence) >= MAX_SEQ_LENGTH:
                break
                
    cap.release()
    
    if not sequence:
        return None
        
    # Pad if sequence is shorter than MAX_SEQ_LENGTH
    sequence_np = np.array(sequence)
    if len(sequence) < MAX_SEQ_LENGTH:
        padding = np.zeros((MAX_SEQ_LENGTH - len(sequence), sequence_np.shape[1]))
        sequence_np = np.vstack((sequence_np, padding))
        
    return sequence_np

def process_class(class_name: str, class_dir: Path, label_id: int):
    """Processes all videos in a class directory."""
    videos = list(class_dir.glob("*.mp4")) + list(class_dir.glob("*.avi"))
    videos = videos[:MAX_SAMPLES_PER_CLASS]
    
    sequences, labels = [], []
    for vid_path in videos:
        seq = process_video(vid_path)
        if seq is not None:
            sequences.append(seq)
            labels.append(label_id)
            
    count = len(sequences)
    if count > 0:
        print(f"  [INCLUDE] {class_name}: {count}/{len(videos)} videos processed")
    else:
        print(f"  [INCLUDE] {class_name}: ⚠ No valid sequences extracted")
        
    return sequences, labels, count

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    all_sequences, all_labels = [], []
    label_map = {}
    label_counter = 0

    print("\n╔════════════════════════════════════════════════╗")
    print("║ LexiSight Dataset Processor (Holistic/Video)   ║")
    print("╚════════════════════════════════════════════════╝\n")

    print(f"➤ Looking for INCLUDE dataset at: {DATASET_DIR}")
    if not DATASET_DIR.exists():
        print("  ⚠ Dataset folder not found. Please ensure the INCLUDE dataset is unzipped here.")
        return

    classes = sorted([d.name for d in DATASET_DIR.iterdir() if d.is_dir()])
    print(f"  Found {len(classes)} classes. Starting extraction...\n")

    for class_name in classes:
        class_dir = DATASET_DIR / class_name
        label_map[str(label_counter)] = class_name
        
        seqs, labels, count = process_class(class_name, class_dir, label_counter)
        all_sequences.extend(seqs)
        all_labels.extend(labels)
        label_counter += 1

    if not all_sequences:
        print("\n⚠ No data extracted. Check your dataset directory structure.")
        return

    # Save as 3D Tensor: (samples, time, features)
    X = np.array(all_sequences, dtype=np.float32)
    y = np.array(all_labels, dtype=np.int32)

    np.save(OUTPUT_DIR / "X_train_raw.npy", X)
    np.save(OUTPUT_DIR / "y_train_raw.npy", y)

    with open(OUTPUT_DIR / "label_map.json", "w") as f:
        json.dump(label_map, f, indent=2)

    print("\n╔══════════════════════════╗")
    print("║       DATASET SUMMARY    ║")
    print("╚══════════════════════════╝")
    print(f"  Total samples  : {len(X):,}")
    print(f"  Tensor shape   : {X.shape}")
    print(f"  Total classes  : {len(label_map)}")
    print(f"  Output dir     : {OUTPUT_DIR}")
    print("\n✓ process_dataset.py complete!")

if __name__ == "__main__":
    main()
