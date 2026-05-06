#!/usr/bin/env python3
"""
LexiSight — Wild Test Landmark Extractor
Processes recorded wild test videos through MediaPipe Holistic.

Naming convention expected:
  wild_test/
  └── signer_01/
      ├── A/
      │   ├── daylight_01.mp4
      │   ├── daylight_02.mp4
      │   ├── indoor_01.mp4
      │   └── indoor_02.mp4
      ├── BROTHER/
      │   └── ...
      ...

Output:
  ml/data_processed/wild_test/
  └── signer_01/
      ├── A/
      │   ├── daylight_01.npy  (30, 225)
      │   └── ...
      ...

Usage:
  python ml/scripts/extract_wild_test.py --input path/to/wild_test_videos
  python ml/scripts/extract_wild_test.py --input path/to/wild_test_videos --signer signer_01
"""

import argparse, json, os, re, time
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

BASE_DIR = Path(__file__).parent.parent.parent
HOLISTIC_MODEL = str(BASE_DIR / "ml" / "assets" / "holistic_landmarker.task")
TARGET_FRAMES = 30
FEATURE_DIM = (33 + 21 + 21) * 3  # 225

SIGN_PRIORITY_CLASSES = [
    "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
    "0","1","2","3","4","5","6","7","8","9",
    "EXTRA","BROTHER","SISTER","PAINT","KEY","PHOTOGRAPH","PEN",
    "SATURDAY","BLACK","PAPER","LETTER","MONTH","YEAR",
    "BOY","GIRL","THANK YOU","TELEPHONE","COURT","SECRETARY",
    "BATHROOM","PENCIL","DEAD","DIRTY","CLOTHING","DRESS",
    "GIFT","CARD","HARD","GROUND","SUMMER","JOB","YOUNG","COLOUR",
    "SMALL LITTLE","HEALTHY","THURSDAY","SCHOOL",
]


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


def extract_holistic_from_frame(frame, detector):
    if frame.shape[0] > 480:
        s = 480 / frame.shape[0]
        frame = cv2.resize(frame, (int(frame.shape[1] * s), int(frame.shape[0] * s)))
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = detector.detect(mp_img)

    feat = np.zeros(FEATURE_DIM, dtype=np.float32)
    if result.pose_landmarks:
        feat[0:33*3] = normalize_pose(result.pose_landmarks).flatten()
    if result.left_hand_landmarks:
        feat[33*3:33*3+21*3] = normalize_hand(result.left_hand_landmarks).flatten()
    if result.right_hand_landmarks:
        feat[33*3+21*3:] = normalize_hand(result.right_hand_landmarks).flatten()
    return feat


def extract_video(video_path, target_frames=TARGET_FRAMES):
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
        min_pose_detection_confidence=0.25,
        min_pose_landmarks_confidence=0.25,
        min_hand_landmarks_confidence=0.25,
    )
    sequence = []
    with vision.HolisticLandmarker.create_from_options(opts) as detector:
        for fr in frames:
            sequence.append(extract_holistic_from_frame(fr, detector))

    while len(sequence) < target_frames:
        sequence.append(sequence[-1])
    sequence = sequence[:target_frames]
    arr = np.array(sequence, dtype=np.float32)

    has_pose = np.any(arr[:, :33*3] != 0, axis=1).sum()
    if has_pose < target_frames * 0.15:
        return None
    return arr


def extract_live_frames(frame_generator, duration_frames=60, target_frames=TARGET_FRAMES):
    """Extract a fixed-duration window of frames from a live camera stream.

    Args:
        frame_generator: iterable yielding (frame, frame_number) tuples
        duration_frames: how many live frames to collect (e.g. 60 = 2 seconds at 30fps)
        target_frames: how many key frames to subsample for the model

    Returns:
        np.ndarray of shape (target_frames, 225)
    """
    buffer = []
    for frame, _ in frame_generator:
        buffer.append(frame)
        if len(buffer) >= duration_frames:
            break

    if len(buffer) < 5:
        return None

    opts = vision.HolisticLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=HOLISTIC_MODEL),
        min_pose_detection_confidence=0.25,
        min_pose_landmarks_confidence=0.25,
        min_hand_landmarks_confidence=0.25,
    )
    sequence = []
    with vision.HolisticLandmarker.create_from_options(opts) as detector:
        for fr in buffer:
            sequence.append(extract_holistic_from_frame(fr, detector))

    indices = np.linspace(0, len(sequence) - 1, min(target_frames, len(sequence)), dtype=int)
    sampled = [sequence[i] for i in indices]
    while len(sampled) < target_frames:
        sampled.append(sampled[-1])
    return np.array(sampled[:target_frames], dtype=np.float32)


def main():
    p = argparse.ArgumentParser(description="LexiSight Wild Test Landmark Extractor")
    p.add_argument("--input", required=True, help="Root wild test video directory")
    p.add_argument("--output", default="ml/data_processed/wild_test",
                   help="Output directory for extracted .npy files")
    p.add_argument("--signer", default=None,
                   help="Process only this signer subdirectory (e.g. signer_01)")
    p.add_argument("--test", type=int, default=0,
                   help="If >0, process only this many videos as a quick test")
    p.add_argument("--skip-existing", action="store_true", default=True,
                   help="Skip videos where .npy already exists")
    args = p.parse_args()

    root = Path(args.input)
    outbase = Path(args.output)

    if not root.exists():
        print(f"Input directory not found: {root}")
        return

    tasks = []
    if args.signer:
        signer_dirs = [root / args.signer]
    else:
        signer_dirs = sorted([d for d in root.iterdir() if d.is_dir()])

    for signer_dir in signer_dirs:
        if signer_dir.name.startswith("."):
            continue
        for cls_dir in sorted(signer_dir.iterdir()):
            if not cls_dir.is_dir() or cls_dir.name.startswith("."):
                continue
            for video in sorted(cls_dir.glob("*.mp4")) + sorted(cls_dir.glob("*.avi")) + \
                        sorted(cls_dir.glob("*.MOV")) + sorted(cls_dir.glob("*.mov")):
                tasks.append((signer_dir.name, cls_dir.name, video))

    if args.test > 0:
        tasks = tasks[:args.test]

    print(f"Wild test extractor: {len(tasks)} videos across {len(signer_dirs)} signers")
    print(f"Output base: {outbase}")
    print(f"Priority classes: {len(SIGN_PRIORITY_CLASSES)} signs")

    t0 = time.time()
    ok, skip, fail = 0, 0, 0

    for i, (signer, cls, video) in enumerate(tasks):
        out_cls_dir = outbase / signer / cls
        out_npy = out_cls_dir / f"{video.stem}.npy"

        if args.skip_existing and out_npy.exists():
            skip += 1
            continue

        try:
            arr = extract_video(video)
            if arr is not None:
                out_cls_dir.mkdir(parents=True, exist_ok=True)
                np.save(out_npy, arr)
                ok += 1
            else:
                fail += 1
                print(f"  [FAIL] Could not extract: {video.relative_to(root)}")
        except Exception as e:
            fail += 1
            if i < 5:
                print(f"  [ERROR] {video.name}: {e}")

        done = ok + skip + fail
        if done % 20 == 0 or done == len(tasks):
            elapsed = (time.time() - t0) / 60
            remaining = (elapsed / max(done, 1)) * max(len(tasks) - done, 0)
            print(f"  [{done}/{len(tasks)}] ok={ok} skip={skip} fail={fail} | "
                  f"{elapsed:.1f}min elapsed, ~{remaining:.0f}min remaining")

    elapsed = (time.time() - t0) / 60
    print(f"\nDone in {elapsed:.1f} min | ok={ok} skip={skip} fail={fail}")

    meta = {
        "dataset": "WILD_TEST",
        "signers": [d.name for d in signer_dirs],
        "processed": ok, "skipped": skip, "failed": fail,
        "feature_dim": FEATURE_DIM,
    }
    with open(outbase / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)


if __name__ == "__main__":
    main()
