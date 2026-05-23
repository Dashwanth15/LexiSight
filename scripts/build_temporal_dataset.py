import os
import cv2
import numpy as np
import json
import re
import time
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import warnings
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).parent.parent
MODEL_DIR = BASE_DIR / "public" / "model"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

SEQ_LEN = 30
FEATURES = 126  # 2 hands * 21 landmarks * 3 coordinates
MODEL_ASSET = str(BASE_DIR / 'scripts' / 'hand_landmarker.task')

DATASET_ROOTS = {
    "Daily": r"c:\Users\Navat\OneDrive\Desktop\Lexisight\New Datasets\ISL_Daily_Words",
    "Emergency": r"c:\Users\Navat\OneDrive\Desktop\Lexisight\New Datasets\ISL_Emergency_Situations\A Video Dataset of the Hand Gestures of Indian Sign Language Words used in Emergency Situations",
    "INCLUDE": r"c:\Users\Navat\OneDrive\Desktop\Lexisight\Datasets\INCLUDE_FULL DATASET",
}

# Thread-local storage to reuse HandLandmarker instances across the lifetime of each thread
thread_local = threading.local()

# Lock to serialize model initialization across threads
init_lock = threading.Lock()

def clean_class_name(name):
    name = re.sub(r'_(Cropped|Raw)', '', name, flags=re.IGNORECASE)
    name = re.sub(r'^\d+\.\s*', '', name)
    name = re.sub(r'[\d_,\-]', ' ', name).lower().strip()
    return re.sub(r'\s+', ' ', name)

def get_signer_from_filename(filename):
    match = re.search(r'(signer|person|p|s|m|f)[\s_-]*(\d+)', filename, re.IGNORECASE)
    if match:
        return match.group(1).lower() + match.group(2)
    return filename

def init_thread_detector(options):
    """Initializes a single detector instance for the active worker thread safely without deadlocks."""
    thread_id = threading.get_ident()
    with init_lock:
        print(f"[Thread-{thread_id}] Initializing HandLandmarker...", flush=True)
        thread_local.detector = vision.HandLandmarker.create_from_options(options)
        print(f"[Thread-{thread_id}] HandLandmarker initialized successfully!", flush=True)

def extract_video_landmarks(v_path, bucket, label_id, weight):
    """Processes a single video, extracts hand landmarks using the thread-local Tasks detector on 30 pre-selected frames, and returns sequence."""
    detector = thread_local.detector
    cap = cv2.VideoCapture(v_path)
    if not cap.isOpened():
        return None
        
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= 0:
        # Fallback if frame count is unavailable: read all frames then resample
        frames = []
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
            results = detector.detect(mp_image)
            
            vec = np.zeros(FEATURES, dtype=np.float32)
            if results.hand_landmarks and results.handedness:
                for idx, hand_landmarks in enumerate(results.hand_landmarks):
                    hand_label = results.handedness[idx][0].category_name
                    wrist = hand_landmarks[0]
                    wx, wy, wz = wrist.x, wrist.y, wrist.z
                    coords = []
                    for lm in hand_landmarks:
                        coords.extend([lm.x - wx, lm.y - wy, (lm.z or 0.0) - (wz or 0.0)])
                    if hand_label == 'Left': 
                        vec[0:63] = coords
                    else: 
                        vec[63:126] = coords
            frames.append(vec)
        cap.release()
        if len(frames) > 0:
            frames = np.array(frames)
            indices = np.linspace(0, len(frames)-1, SEQ_LEN, dtype=int)
            resampled = frames[indices]
            return bucket, resampled, label_id, weight
        return None

    # Pre-calculate the 30 indices to process
    target_indices = set(np.linspace(0, total_frames - 1, SEQ_LEN, dtype=int))
    
    frames_map = {}
    frame_idx = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        
        if frame_idx in target_indices:
            # Convert BGR to RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
            
            # Detect landmarks
            results = detector.detect(mp_image)
            
            vec = np.zeros(FEATURES, dtype=np.float32)
            if results.hand_landmarks and results.handedness:
                for idx, hand_landmarks in enumerate(results.hand_landmarks):
                    hand_label = results.handedness[idx][0].category_name
                    
                    # ROOT-RELATIVE NORMALIZATION:
                    # Make all coordinates relative to the wrist (landmark 0)
                    wrist = hand_landmarks[0]
                    wx, wy, wz = wrist.x, wrist.y, wrist.z
                    
                    coords = []
                    for lm in hand_landmarks:
                        coords.extend([lm.x - wx, lm.y - wy, (lm.z or 0.0) - (wz or 0.0)])
                        
                    if hand_label == 'Left': 
                        vec[0:63] = coords
                    else: 
                        vec[63:126] = coords
            frames_map[frame_idx] = vec
            
        frame_idx += 1
        if len(frames_map) == len(target_indices):
            # Early break once all target frames have been read and processed
            break
        
    cap.release()
    
    # Assemble the final sequence of exactly 30 frames in chronological order
    sorted_indices = sorted(list(target_indices))
    seq = []
    for idx in sorted_indices:
        seq.append(frames_map.get(idx, np.zeros(FEATURES, dtype=np.float32)))
        
    return bucket, np.array(seq), label_id, weight

def build_dataset():
    print("Loading Merge Map and Signer Splits...")
    with open(r"c:\Users\Navat\OneDrive\Desktop\Lexisight\scripts\dataset_merge_map.json", "r") as f:
        merge_map = json.load(f)
        
    with open(r"c:\Users\Navat\OneDrive\Desktop\Lexisight\scripts\signer_split.json", "r") as f:
        splits = json.load(f)
        
    safe_classes = [cls for cls, counts in merge_map.items() if sum(counts.values()) >= 10]
    label_map = {cls: idx for idx, cls in enumerate(safe_classes)}
    with open(MODEL_DIR / "temporal_label_map.json", "w") as f:
        json.dump(label_map, f, indent=2)
        
    tasks = []
    for ds_name, ds_path in DATASET_ROOTS.items():
        if not os.path.exists(ds_path): continue
        for root, dirs, files in os.walk(ds_path):
            videos = [f for f in files if f.lower().endswith(('.mp4', '.avi', '.mov'))]
            if not videos: continue
            
            class_name = os.path.basename(root)
            if class_name.lower() in ["sample videos", "video_dataset", "raw_data", "cropped_data"]:
                class_name = os.path.basename(os.path.dirname(root))
                
            clean_word = clean_class_name(class_name)
            if clean_word not in label_map: continue
            
            label_id = label_map[clean_word]
            
            for v_name in videos:
                v_path = os.path.join(root, v_name)
                signer = get_signer_from_filename(v_name) if ds_name != "Daily" else "daily_signer"
                
                bucket = "train"
                if ds_name == "Emergency":
                    if signer in splits["Emergency"]["val_signers"]: bucket = "val"
                    elif signer in splits["Emergency"]["test_signers"]: bucket = "test"
                elif ds_name == "INCLUDE":
                    h = hash(v_name) % 100
                    if h < 15: bucket = "val"
                    elif h < 30: bucket = "test"
                        
                weight = 0.5 if ds_name == "Daily" else 1.0
                tasks.append((v_path, bucket, label_id, weight))
                
    print(f"Total videos queued for extraction: {len(tasks)}")
    
    # Prepare datasets structures
    datasets = {
        "train": {"X": [], "y": [], "W": []},
        "val": {"X": [], "y": [], "W": []},
        "test": {"X": [], "y": []}
    }
    
    # Configure MediaPipe options
    base_options = python.BaseOptions(model_asset_path=MODEL_ASSET)
    options = vision.HandLandmarkerOptions(base_options=base_options, num_hands=2)
    
    # Determine number of parallel workers
    max_workers = min(6, os.cpu_count() or 4)
    print(f"Running extraction in high-performance multithreaded mode with {max_workers} threads...")
    
    processed = 0
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=max_workers, initializer=init_thread_detector, initargs=(options,)) as executor:
        futures = {executor.submit(extract_video_landmarks, t[0], t[1], t[2], t[3]): t for t in tasks}
        
        for future in as_completed(futures):
            res = future.result()
            if res is not None:
                bucket, resampled, label_id, weight = res
                datasets[bucket]["X"].append(resampled)
                datasets[bucket]["y"].append(label_id)
                if bucket in ["train", "val"]:
                    datasets[bucket]["W"].append(weight)
                    
            processed += 1
            if processed % 10 == 0 or processed == len(tasks):
                elapsed = time.time() - start_time
                eta = (elapsed / processed) * (len(tasks) - processed) if processed > 0 else 0
                print(f"Processed {processed}/{len(tasks)} videos | ETA: {eta/60:.1f}m", flush=True)
                
    print("\nSaving Tensors to disk...")
    for b in ["train", "val", "test"]:
        if len(datasets[b]["X"]) > 0:
            X = np.array(datasets[b]["X"])
            y = np.array(datasets[b]["y"])
            np.save(MODEL_DIR / f"X_{b}.npy", X)
            np.save(MODEL_DIR / f"y_{b}.npy", y)
            print(f"{b.upper()} Split: {len(X)} samples saved.")
            if b in ["train", "val"]:
                np.save(MODEL_DIR / f"W_{b}.npy", np.array(datasets[b]["W"]))
                
    print("ALL EXTRACTION COMPLETE!")

if __name__ == "__main__":
    build_dataset()
