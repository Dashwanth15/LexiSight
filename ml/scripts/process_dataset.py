#!/usr/bin/env python3
"""
LexiSight Dataset Processor
═══════════════════════════
Extracts MediaPipe hand landmarks from both datasets and
merges them into a unified training set.

Usage:
    python scripts/process_dataset.py

Requires:
    pip install -r scripts/requirements.txt

Dataset layout expected:
    Datasets/
    ├── ISL Gesture Images/
    │   └── Gesture Image Data/  ← 37 gesture classes (A-Z, 0-9, _)
    └── ISL CSLRT/
        └── Train/               ← 24 letter classes (A-Y)
"""

import os
import cv2
import mediapipe as mp
import numpy as np
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# ── Config ───────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent.parent  # ml/scripts/ → project root
DATASET_A = BASE_DIR / "Datasets" / "ISL Gesture Images" / "Gesture Image Data"
DATASET_B = BASE_DIR / "Datasets" / "ISL CSLRT" / "Train"
OUTPUT_DIR = BASE_DIR / "public" / "model"

MAX_SAMPLES_PRIMARY = 1200   # Increased from 400!
MAX_SAMPLES_SECONDARY = 600  # Increased from 200!

# Exclude underscore class (not a meaningful gesture)
EXCLUDE_CLASSES = {'_'}

# ── MediaPipe tasks API ────────────────────────────────────────────
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

lock = threading.Lock()

def augment(lm_list, noise_level=0.015):
    """Add Gaussian noise to the coordinates for Data Augmentation.
    NOTE: This is only used in train_model.py AFTER train/val/test split
    to prevent data leakage.
    """
    return [max(0.0, min(1.0, val + np.random.normal(0, noise_level))) for val in lm_list]

def extract_landmarks(image_path: Path, detector) -> list | None:
    """Extract 63 normalized landmarks from a hand image."""
    try:
        # Strictly enforce 3-channel RGB to prevent TfLite tensor crashes
        img = cv2.imread(str(image_path))
        if img is None: return None
        
        # Datasets often have huge images causing memory bloat, resize if too large
        if img.shape[0] > 600 or img.shape[1] > 600:
            scale = 600 / max(img.shape[0], img.shape[1])
            img = cv2.resize(img, (int(img.shape[1]*scale), int(img.shape[0]*scale)))

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
    except Exception as e:
        return None

    result = detector.detect(mp_image)
    if not result.hand_landmarks:
        return None

    lm = result.hand_landmarks[0]
    wrist = lm[0]

    # Max distance normalization for scale invariance
    coords_raw = [(p.x - wrist.x, p.y - wrist.y, (p.z or 0) - (wrist.z or 0))
                  for p in lm]
    max_dist = max(
        (x**2 + y**2 + z**2) ** 0.5
        for x, y, z in coords_raw
    ) or 1.0

    coords = []
    for dx, dy, dz in coords_raw:
        coords.extend([dx / max_dist, dy / max_dist, dz / max_dist])

    return coords  # 63 numbers

def process_class(class_name: str, image_dir: Path, label_id: int,
                  max_samples: int, source_tag: str) -> tuple[list, list, int]:
    """Process all images in a class directory."""
    images = list(image_dir.glob("*.jpg")) + list(image_dir.glob("*.png"))
    images = images[:max_samples]

    landmarks_list = []
    labels_list = []

    base_options = python.BaseOptions(model_asset_path=str(BASE_DIR / 'ml' / 'assets' / 'hand_landmarker.task'))
    options = vision.HandLandmarkerOptions(base_options=base_options, num_hands=1)
    
    with vision.HandLandmarker.create_from_options(options) as detector:
        for img_path in images:
            lm = extract_landmarks(img_path, detector)
            if lm:
                landmarks_list.append(lm)
                labels_list.append(label_id)
                # NO augmentation here - it's done in train_model.py AFTER split to avoid leakage

    count = len(landmarks_list)
    if count > 0:
        print(f"  [{source_tag}] {class_name}: {count}/{len(images)} samples extracted")
    else:
        print(f"  [{source_tag}] {class_name}: ⚠ No valid hands detected")

    return landmarks_list, labels_list, count

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    all_landmarks = []
    all_labels = []
    label_map = {}
    label_counter = 0
    class_counts = {}

    print("\n╔══════════════════════════════════════╗")
    print("║   LexiSight Dataset Processor v1.0  ║")
    print("╚══════════════════════════════════════╝\n")

    # ── DATASET A: ISL Gesture Images (PRIMARY) ──────────────────
    print(f"➤ Processing Primary Dataset: {DATASET_A.name}")
    print(f"  Path: {DATASET_A}")

    if not DATASET_A.exists():
        print(f"  ⚠ Not found! Skipping.")
    else:
        classes_a = sorted([
            d.name for d in DATASET_A.iterdir()
            if d.is_dir() and d.name not in EXCLUDE_CLASSES
        ])
        print(f"  Found {len(classes_a)} gesture classes\n")

        for class_name in classes_a:
            class_dir = DATASET_A / class_name
            # Assign label
            key = class_name.upper()
            if key not in label_map.values():
                label_map[str(label_counter)] = key
                current_id = label_counter
                label_counter += 1
            else:
                current_id = {v: int(k) for k, v in label_map.items()}[key]

            lms, labels, count = process_class(
                class_name, class_dir, current_id,
                MAX_SAMPLES_PRIMARY, "PRIMARY"
            )
            all_landmarks.extend(lms)
            all_labels.extend(labels)
            class_counts[key] = class_counts.get(key, 0) + count

    # ── DATASET B: ISL CSLRT (SUPPLEMENT letters A-Y) ─────────────
    print(f"\n➤ Processing Supplement Dataset: {DATASET_B.name}")
    print(f"  Path: {DATASET_B}")

    if not DATASET_B.exists():
        print(f"  ⚠ Not found! Skipping.")
    else:
        classes_b = sorted([d.name for d in DATASET_B.iterdir() if d.is_dir()])
        print(f"  Found {len(classes_b)} letter classes\n")

        # Build reverse label map for lookup
        rev_map = {v: int(k) for k, v in label_map.items()}

        for class_name in classes_b:
            class_dir = DATASET_B / class_name
            key = class_name.upper()

            if key in rev_map:
                current_id = rev_map[key]
            else:
                label_map[str(label_counter)] = key
                current_id = label_counter
                rev_map[key] = label_counter
                label_counter += 1

            lms, labels, count = process_class(
                class_name, class_dir, current_id,
                MAX_SAMPLES_SECONDARY, "CSLRT"
            )
            all_landmarks.extend(lms)
            all_labels.extend(labels)
            class_counts[key] = class_counts.get(key, 0) + count

    # ── Save outputs ──────────────────────────────────────────────
    X = np.array(all_landmarks, dtype=np.float32)
    y = np.array(all_labels, dtype=np.int32)

    np.save(OUTPUT_DIR / "X_train_raw.npy", X)
    np.save(OUTPUT_DIR / "y_train_raw.npy", y)

    with open(OUTPUT_DIR / "label_map.json", "w") as f:
        json.dump(label_map, f, indent=2)

    # ── Summary ─────────────────────────────────────────────────
    print("\n╔══════════════════════════╗")
    print("║       DATASET SUMMARY    ║")
    print("╚══════════════════════════╝")
    print(f"  Raw unique samples  : {len(X):,}")
    print(f"  Total classes       : {len(label_map)}")
    print(f"  Feature dims        : {X.shape[1] if len(X) > 0 else 0}")
    print(f"  Output dir          : {OUTPUT_DIR}")
    print(f"\n  Per-class breakdown:")
    for cls, cnt in sorted(class_counts.items()):
        bar = '█' * min(40, cnt // 10)
        print(f"    {cls:>10}: {bar} {cnt}")

    print("\n⚠  NOTE: Augmentation is now DISABLED here.")
    print("   Augmentation happens in train_model.py AFTER train/val/test split.")
    print("   This prevents data leakage and gives honest validation accuracy.")
    print("\n✓ process_dataset.py complete!")
    print("  Next step: python scripts/train_model.py\n")

if __name__ == "__main__":
    main()
