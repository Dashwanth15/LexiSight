#!/usr/bin/env python3
"""
LexiSight High-Performance Video Processor
══════════════════════════════════════════
Extracts MediaPipe hand landmarks from large video datasets.
Optimized for 250GB+ workloads using multi-threading and sampling.

Usage:
    python scripts/process_videos.py --input Datasets/Videos --output public/model

Author: Antigravity
"""

import os
import cv2
import mediapipe as mp
import numpy as np
import json
import argparse
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

# --- Configuration ---
FPS_SAMPLE = 5        # Extract 5 frames per second of video
MAX_WORKERS = 8       # Number of parallel video processors (adjust based on CPU)
MODEL_ASSET = 'scripts/hand_landmarker.task'

# --- MediaPipe Setup ---
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

lock = Lock()
progress_counter = 0

def extract_landmarks_from_video(video_path: Path, label_id: int, detector_options):
    """Processes a single video and returns a list of landmark vectors."""
    landmarks_found = []
    
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return [], []

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0: fps = 30
    
    # Calculate frame interval for sampling
    interval = max(1, int(fps / FPS_SAMPLE))
    
    frame_count = 0
    extracted_count = 0

    # We need a fresh detector per thread if using ThreadPool, 
    # but MediaPipe Tasks is generally better with its own instance per thread.
    with vision.HandLandmarker.create_from_options(detector_options) as detector:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Sample frames
            if frame_count % interval == 0:
                # Convert BGR to RGB
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                
                result = detector.detect(mp_image)
                
                if result.hand_landmarks:
                    lm = result.hand_landmarks[0]
                    wrist = lm[0]
                    
                    # Normalization (Matches process_dataset.py logic)
                    coords_raw = [(p.x - wrist.x, p.y - wrist.y, (p.z or 0) - (wrist.z or 0))
                                  for p in lm]
                    
                    max_dist = max((x**2 + y**2 + z**2) ** 0.5 for x, y, z in coords_raw) or 1.0
                    
                    coords = []
                    for dx, dy, dz in coords_raw:
                        coords.extend([dx / max_dist, dy / max_dist, dz / max_dist])
                    
                    landmarks_found.append(coords)
                    extracted_count += 1
            
            frame_count += 1
            
    cap.release()
    return landmarks_found, [label_id] * len(landmarks_found)

def main():
    parser = argparse.ArgumentParser(description="LexiSight Video Dataset Processor")
    parser.add_argument("--input", type=str, default="Datasets/Videos", help="Path to video root folder")
    parser.add_argument("--output", type=str, default="public/model", help="Path to save .npy files")
    parser.add_argument("--fps", type=int, default=5, help="Frames to sample per second")
    parser.add_argument("--workers", type=int, default=8, help="Parallel workers")
    args = parser.parse_args()

    input_root = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_root.exists():
        print(f"Error: Input directory {input_root} not found.")
        return

    # Load existing label map if available
    label_map_path = output_dir / "label_map.json"
    if label_map_path.exists():
        with open(label_map_path, 'r') as f:
            label_map = json.load(f)
            # Find next ID
            next_id = max([int(k) for k in label_map.keys()] + [-1]) + 1
    else:
        label_map = {}
        next_id = 0

    # Discover videos and classes
    video_tasks = []
    classes = sorted([d for d in input_root.iterdir() if d.is_dir()])
    
    print(f"Found {len(classes)} classes in {input_root}")
    
    # Map classes to IDs
    rev_label_map = {v: int(k) for k, v in label_map.items()}
    
    for cls_dir in classes:
        cls_name = cls_dir.name.upper()
        if cls_name not in rev_label_map:
            label_map[str(next_id)] = cls_name
            rev_label_map[cls_name] = next_id
            next_id += 1
        
        cls_id = rev_label_map[cls_name]
        videos = list(cls_dir.glob("**/*.mp4")) + list(cls_dir.glob("**/*.avi")) + list(cls_dir.glob("**/*.mov"))
        for v in videos:
            video_tasks.append((v, cls_id))

    print(f"Total videos to process: {len(video_tasks)}")
    
    # MediaPipe Options
    base_options = python.BaseOptions(model_asset_path=MODEL_ASSET)
    options = vision.HandLandmarkerOptions(base_options=base_options, num_hands=1)

    all_landmarks = []
    all_labels = []

    start_time = time.time()
    
    print(f"Starting extraction using {args.workers} workers...")
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(extract_landmarks_from_video, task[0], task[1], options): task for task in video_tasks}
        
        completed = 0
        for future in as_completed(futures):
            v_path, v_id = futures[future]
            try:
                lms, lbls = future.result()
                all_landmarks.extend(lms)
                all_labels.extend(lbls)
                completed += 1
                if completed % 10 == 0 or completed == len(video_tasks):
                    elapsed = time.time() - start_time
                    eta = (elapsed / completed) * (len(video_tasks) - completed) if completed > 0 else 0
                    print(f"Progress: {completed}/{len(video_tasks)} videos | Samples: {len(all_landmarks)} | ETA: {eta/60:.1f}m")
            except Exception as e:
                print(f"Error processing {v_path}: {e}")

    # Save results
    if all_landmarks:
        X = np.array(all_landmarks, dtype=np.float32)
        y = np.array(all_labels, dtype=np.int32)
        
        # Merge with existing if they exist
        x_path = output_dir / "X_train_video.npy"
        y_path = output_dir / "y_train_video.npy"
        
        np.save(x_path, X)
        np.save(y_path, y)
        
        with open(label_map_path, 'w') as f:
            json.dump(label_map, f, indent=2)
            
        print(f"\nSuccessfully saved {len(X)} samples to {x_path}")
        print(f"Total time: {(time.time() - start_time)/60:.2f} minutes")
    else:
        print("No landmarks extracted.")

if __name__ == "__main__":
    main()
