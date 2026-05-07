#!/usr/bin/env python3
"""
LexiSight -- Fast Holistic Extraction (Multi-process)
Uses multiprocessing to extract holistic landmarks from videos in parallel.
Each worker gets its own MediaPipe HolisticLandmarker instance.

Skips already-extracted .npy files for resume support.

Usage: python ml/scripts/extract_holistic_fast.py --dataset include
       python ml/scripts/extract_holistic_fast.py --dataset cislr
       python ml/scripts/extract_holistic_fast.py --dataset both
"""

import os, sys, argparse, csv, time
import numpy as np
import cv2
from pathlib import Path
from multiprocessing import Pool, cpu_count
from functools import partial

BASE_DIR = Path(__file__).parent.parent.parent
ML_DIR = BASE_DIR / "ml"

SEQ_LEN = 30
POSE_COUNT = 33
HAND_COUNT = 21
TOTAL_LANDMARKS = POSE_COUNT + HAND_COUNT * 2  # 75
FEATURE_DIM = TOTAL_LANDMARKS * 3  # 225


def init_worker():
    """Each worker process initializes its own MediaPipe landmarker."""
    import mediapipe as mp
    global _landmarker
    
    model_path = str(BASE_DIR / "ml" / "mediapipe_models" / "holistic_landmarker.task")
    if not os.path.exists(model_path):
        # Fallback: use hand landmarker only
        model_path = None
    
    BaseOptions = mp.tasks.BaseOptions
    HolisticLandmarker = mp.tasks.vision.HolisticLandmarker
    HolisticLandmarkerOptions = mp.tasks.vision.HolisticLandmarkerOptions
    VisionRunningMode = mp.tasks.vision.RunningMode
    
    options = HolisticLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model_path),
        running_mode=VisionRunningMode.VIDEO,
    )
    _landmarker = HolisticLandmarker.create_from_options(options)


def normalize_pose(landmarks):
    """Normalize pose landmarks: hip-centered, shoulder-width scaled."""
    pts = np.array([[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32)
    # Hip center = midpoint of landmarks 23 (left hip) and 24 (right hip)
    hip_center = (pts[23] + pts[24]) / 2.0
    pts -= hip_center
    # Scale by shoulder width (landmarks 11 and 12)
    shoulder_width = np.linalg.norm(pts[11] - pts[12])
    if shoulder_width > 0.01:
        pts /= shoulder_width
    return pts


def normalize_hand(landmarks):
    """Normalize hand landmarks: wrist-centered, palm-size scaled."""
    pts = np.array([[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32)
    wrist = pts[0].copy()
    pts -= wrist
    # Scale by palm size (wrist to middle finger MCP, landmark 9)
    palm_size = np.linalg.norm(pts[9])
    if palm_size > 0.001:
        pts /= palm_size
    return pts


def extract_single_video(args):
    """Extract holistic landmarks from a single video. Called by pool workers."""
    video_path, output_path = args
    
    # Skip if already done
    if os.path.exists(output_path):
        return ("skip", video_path)
    
    try:
        import mediapipe as mp
        global _landmarker
        
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            return ("fail", video_path)
        
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        if total_frames < 5:
            cap.release()
            return ("fail", video_path)
        
        # Sample SEQ_LEN frames evenly
        indices = np.linspace(0, total_frames - 1, SEQ_LEN, dtype=int)
        
        all_frames = []
        timestamp_ms = 0
        frame_idx = 0
        sampled = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if sampled < SEQ_LEN and frame_idx == indices[sampled]:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                
                timestamp_ms = int(frame_idx * 1000.0 / fps)
                result = _landmarker.detect_for_video(mp_image, timestamp_ms)
                
                frame_features = np.zeros(FEATURE_DIM, dtype=np.float32)
                
                # Pose (33 landmarks)
                if result.pose_landmarks and len(result.pose_landmarks) > 0:
                    pose_pts = normalize_pose(result.pose_landmarks[0])
                    frame_features[:POSE_COUNT*3] = pose_pts.flatten()
                
                # Left hand (21 landmarks)
                if result.left_hand_landmarks and len(result.left_hand_landmarks) > 0:
                    lh_pts = normalize_hand(result.left_hand_landmarks[0])
                    frame_features[POSE_COUNT*3:(POSE_COUNT+HAND_COUNT)*3] = lh_pts.flatten()
                
                # Right hand (21 landmarks)
                if result.right_hand_landmarks and len(result.right_hand_landmarks) > 0:
                    rh_pts = normalize_hand(result.right_hand_landmarks[0])
                    frame_features[(POSE_COUNT+HAND_COUNT)*3:] = rh_pts.flatten()
                
                all_frames.append(frame_features)
                sampled += 1
            
            frame_idx += 1
        
        cap.release()
        
        if len(all_frames) < SEQ_LEN:
            # Pad with zeros
            while len(all_frames) < SEQ_LEN:
                all_frames.append(np.zeros(FEATURE_DIM, dtype=np.float32))
        
        sequence = np.array(all_frames[:SEQ_LEN], dtype=np.float32)
        
        # Save
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        np.save(output_path, sequence)
        
        return ("ok", video_path)
    
    except Exception as e:
        return ("fail", f"{video_path}: {e}")


def gather_include_jobs():
    """Gather extraction jobs for the INCLUDE dataset."""
    video_root = BASE_DIR / "Datasets" / "INCLUDE"
    out_root = ML_DIR / "data_processed" / "holistic"
    
    jobs = []
    if not video_root.exists():
        print(f"INCLUDE dataset not found at {video_root}")
        return jobs
    
    for class_dir in sorted(video_root.iterdir()):
        if not class_dir.is_dir():
            continue
        class_name = class_dir.name
        for vid in sorted(class_dir.glob("*.mp4")):
            out_path = str(out_root / class_name / f"{vid.stem}.npy")
            jobs.append((str(vid), out_path))
    
    return jobs


def gather_cislr_jobs():
    """Gather extraction jobs for the CISLR dataset."""
    dataset_dir = BASE_DIR / "Datasets" / "CISLR DATASET"
    csv_path = dataset_dir / "dataset.csv"
    out_root = ML_DIR / "data_processed" / "cislr_holistic"
    
    jobs = []
    if not csv_path.exists():
        print(f"CISLR dataset CSV not found at {csv_path}")
        return jobs
    
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            vid_path = dataset_dir / row.get("video_path", row.get("path", ""))
            label = row.get("label", row.get("gloss", "UNKNOWN"))
            
            if vid_path.exists():
                out_path = str(out_root / label / f"{vid_path.stem}.npy")
                jobs.append((str(vid_path), out_path))
    
    return jobs


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dataset", choices=["include", "cislr", "both"], default="both")
    p.add_argument("--workers", type=int, default=0, help="Number of workers (0=auto)")
    args = p.parse_args()
    
    # Determine worker count
    n_cores = cpu_count()
    n_workers = args.workers if args.workers > 0 else max(1, n_cores - 1)
    
    print("=" * 60)
    print("  FAST HOLISTIC EXTRACTION (Multi-process)")
    print(f"  CPU cores: {n_cores}")
    print(f"  Workers: {n_workers}")
    print("=" * 60)
    
    jobs = []
    if args.dataset in ("include", "both"):
        inc_jobs = gather_include_jobs()
        print(f"INCLUDE: {len(inc_jobs)} total videos")
        jobs.extend(inc_jobs)
    
    if args.dataset in ("cislr", "both"):
        cislr_jobs = gather_cislr_jobs()
        print(f"CISLR: {len(cislr_jobs)} total videos")
        jobs.extend(cislr_jobs)
    
    # Filter out already-done
    pending = [(v, o) for v, o in jobs if not os.path.exists(o)]
    already_done = len(jobs) - len(pending)
    print(f"\nAlready extracted: {already_done}")
    print(f"Remaining: {len(pending)}")
    
    if not pending:
        print("Nothing to do!")
        return
    
    print(f"\nStarting extraction with {n_workers} parallel workers...")
    t0 = time.time()
    
    ok_count = 0
    fail_count = 0
    
    with Pool(n_workers, initializer=init_worker) as pool:
        for i, (status, info) in enumerate(pool.imap_unordered(extract_single_video, pending)):
            if status == "ok":
                ok_count += 1
            elif status == "fail":
                fail_count += 1
            
            if (i + 1) % 50 == 0 or (i + 1) == len(pending):
                elapsed = time.time() - t0
                rate = (i + 1) / elapsed * 60
                remaining = (len(pending) - i - 1) / (rate / 60) if rate > 0 else 0
                print(f"  [{i+1}/{len(pending)}] ok={ok_count} fail={fail_count} "
                      f"rate={rate:.1f}/min ETA={remaining/60:.1f}h")
    
    elapsed = time.time() - t0
    print(f"\nDone in {elapsed/60:.1f} minutes")
    print(f"  Extracted: {ok_count}")
    print(f"  Failed: {fail_count}")
    print(f"  Total on disk: {already_done + ok_count}")


if __name__ == "__main__":
    main()
