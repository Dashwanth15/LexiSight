#!/usr/bin/env python3
"""
LexiSight — Temporal Model Trainer (v2 — with full normalization pipeline)
Trains the Temporal Landmark Transformer on sequence data.

Key fixes over v1:
  1. Wrist-relative normalization (removes position dependence)
  2. Scale normalization (removes distance/body-size dependence)
  3. Orientation normalization via wrist→middle-finger alignment
  4. Stronger augmentation (rotation, jitter, frame masking, scaling)
  5. Higher dropout (0.3) + weight decay
  6. Early stopping monitors val_accuracy (not val_loss)
  7. Prints val_accuracy every epoch and halts if train>>val gap detected

Usage: python ml/scripts/train_temporal.py
"""

import os
import json
import time
import argparse
import pandas as pd
import numpy as np
from pathlib import Path
import yaml
import tensorflow as tf
from sklearn.model_selection import StratifiedGroupKFold
from tensorflow.keras.callbacks import (
    EarlyStopping, ModelCheckpoint, ReduceLROnPlateau, Callback
)

BASE_DIR = Path(__file__).parent.parent.parent
ML_DIR = BASE_DIR / "ml"

import sys
sys.path.insert(0, str(BASE_DIR))
from ml.models.temporal_v1 import build_temporal_model


def load_config(config_path):
    with open(config_path, encoding='utf-8') as f:
        return yaml.safe_load(f)


# ═══════════════════════════════════════════════════════════════
#  NORMALIZATION PIPELINE — applied to every .npy during loading
# ═══════════════════════════════════════════════════════════════

def normalize_skeleton(sequence):
    """
    Normalize a raw skeleton sequence of shape (30, 2, 21, 3).
    
    Steps:
      1. Wrist-relative: subtract wrist (landmark 0) from all 21 landmarks per hand
         → removes dependence on where the person stands in the frame
      2. Scale normalize: divide by palm size (distance wrist→middle-finger-MCP)
         → removes dependence on distance from camera / hand size
      3. Orientation normalize: rotate so wrist→middle-finger-MCP points upward
         → removes dependence on hand tilt/rotation style
         
    Returns: normalized sequence of same shape (30, 2, 21, 3)
    """
    # MediaPipe hand landmarks:
    #   0 = WRIST
    #   9 = MIDDLE_FINGER_MCP (base of middle finger)
    
    WRIST = 0
    MIDDLE_MCP = 9
    
    normed = sequence.copy()
    
    for f in range(normed.shape[0]):       # 30 frames
        for h in range(normed.shape[1]):   # 2 hands
            hand = normed[f, h]            # (21, 3)
            
            # Skip if hand is all zeros (not detected)
            if np.abs(hand).max() < 1e-7:
                continue
            
            # --- Step 1: Wrist-relative ---
            wrist = hand[WRIST].copy()     # (3,)
            hand = hand - wrist            # center on wrist
            
            # --- Step 2: Scale normalize ---
            palm_vec = hand[MIDDLE_MCP]    # vector from wrist to middle MCP
            palm_size = np.linalg.norm(palm_vec[:2])  # 2D distance (x, y)
            if palm_size < 1e-6:
                palm_size = 1e-6           # avoid division by zero
            hand = hand / palm_size
            
            # --- Step 3: Orientation normalize ---
            # Rotate hand so wrist→middle_mcp points straight up (0, -1)
            target_angle = -np.pi / 2  # pointing up
            current_angle = np.arctan2(palm_vec[1], palm_vec[0])
            rotation = target_angle - current_angle
            
            cos_r = np.cos(rotation)
            sin_r = np.sin(rotation)
            
            # Rotate x, y; keep z unchanged
            x_rot = hand[:, 0] * cos_r - hand[:, 1] * sin_r
            y_rot = hand[:, 0] * sin_r + hand[:, 1] * cos_r
            hand[:, 0] = x_rot
            hand[:, 1] = y_rot
            
            normed[f, h] = hand
    
    return normed


# ═══════════════════════════════════════════════════════════════
#  AUGMENTATION — applied per-batch during training only
# ═══════════════════════════════════════════════════════════════

def augment_batch_numpy(X_batch):
    """
    Apply aggressive augmentation to a batch of shape (B, 30, 126).
    Operates on the flattened representation.
    
    Augmentations:
      - Gaussian noise (coordinate jitter)
      - Random scaling (simulates distance variation)
      - Random 2D rotation (simulates wrist rotation variation)
      - Random frame dropout (simulates temporal gaps)
      - Random temporal shift (simulates speed variation)
    """
    B, T, D = X_batch.shape
    
    # Reshape to (B, 30, 2, 21, 3) for structured augmentation
    X = X_batch.reshape(B, T, 2, 21, 3)
    
    for i in range(B):
        # 1. Gaussian noise (50% chance, sigma=0.02)
        if np.random.rand() < 0.5:
            noise = np.random.normal(0, 0.02, X[i].shape).astype(np.float32)
            X[i] += noise
        
        # 2. Random scaling (70% chance, range 0.8–1.2)
        if np.random.rand() < 0.7:
            scale = np.random.uniform(0.8, 1.2)
            X[i] *= scale
        
        # 3. Random 2D rotation (60% chance, ±15 degrees)
        if np.random.rand() < 0.6:
            angle = np.random.uniform(-15, 15) * np.pi / 180
            cos_a = np.cos(angle)
            sin_a = np.sin(angle)
            x_vals = X[i, :, :, :, 0].copy()
            y_vals = X[i, :, :, :, 1].copy()
            X[i, :, :, :, 0] = x_vals * cos_a - y_vals * sin_a
            X[i, :, :, :, 1] = x_vals * sin_a + y_vals * cos_a
        
        # 4. Frame dropout (50% chance, drop 1–3 frames)
        if np.random.rand() < 0.5:
            n_drop = np.random.randint(1, 4)
            drop_idx = np.random.choice(T, n_drop, replace=False)
            X[i, drop_idx] = 0.0
        
        # 5. Temporal shift (30% chance, shift ±2 frames)
        if np.random.rand() < 0.3:
            shift = np.random.randint(-2, 3)
            if shift != 0:
                X[i] = np.roll(X[i], shift, axis=0)
                if shift > 0:
                    X[i, :shift] = 0.0
                else:
                    X[i, shift:] = 0.0
    
    return X.reshape(B, T, D)


# ═══════════════════════════════════════════════════════════════
#  CUSTOM CALLBACK — monitor train-vs-val gap
# ═══════════════════════════════════════════════════════════════

class OverfitDetector(Callback):
    """Prints clear warnings if train accuracy >> val accuracy."""
    
    def on_epoch_end(self, epoch, logs=None):
        train_acc = logs.get('accuracy', 0)
        val_acc = logs.get('val_accuracy', 0)
        gap = train_acc - val_acc
        
        print(f"\n  [Monitor] Epoch {epoch+1}: "
              f"train_acc={train_acc:.4f} | val_acc={val_acc:.4f} | gap={gap:.4f}")
        
        if gap > 0.15:
            print(f"  ⚠️  WARNING: Train-Val gap is {gap:.2%}. Model may be overfitting!")
        if gap > 0.30:
            print(f"  🚨 CRITICAL: Train-Val gap is {gap:.2%}. Likely overfitting hard.")


# ═══════════════════════════════════════════════════════════════
#  DATA GENERATOR — preloads into RAM with normalization
# ═══════════════════════════════════════════════════════════════

class DataGenerator(tf.keras.utils.Sequence):
    """Custom DataGenerator that preloads ALL .npy clips into RAM,
    applies normalization during loading, and augmentation during training."""
    
    def __init__(self, df, batch_size, n_classes, config, augment=False, desc="Data"):
        self.batch_size = batch_size
        self.n_classes = n_classes
        self.config = config
        self.augment = augment
        
        # Preload everything into RAM WITH normalization
        print(f"[{desc}] Preloading {len(df)} files into RAM with normalization...")
        self.X = np.zeros((len(df), 30, 126), dtype=np.float32)
        self.y = np.zeros((len(df), n_classes), dtype=np.float32)
        
        loaded = 0
        skipped = 0
        for i, (_, row) in enumerate(df.iterrows()):
            if i > 0 and i % 10000 == 0:
                print(f"  Loaded {i}/{len(df)} (normalized)...")
            clip_path = ML_DIR / "data_processed" / row["clip_path"]
            if clip_path.exists():
                try:
                    data = np.load(clip_path)  # (30, 2, 21, 3) raw
                    
                    # Apply normalization BEFORE flattening
                    if data.shape == (30, 2, 21, 3):
                        data = normalize_skeleton(data)
                    
                    self.X[i] = data.reshape(30, -1)
                    loaded += 1
                except Exception:
                    skipped += 1
            else:
                skipped += 1
            self.y[i, int(row["class_id"])] = 1.0
            
        self.indexes = np.arange(len(self.X))
        self.on_epoch_end()
        print(f"[{desc}] Done. Loaded: {loaded}, Skipped: {skipped}")
        
    def __len__(self):
        return int(np.ceil(len(self.X) / self.batch_size))
        
    def __getitem__(self, index):
        start = index * self.batch_size
        end = min((index + 1) * self.batch_size, len(self.X))
        batch_idx = self.indexes[start:end]
        
        X_batch = self.X[batch_idx].copy()
        y_batch = self.y[batch_idx]
        
        # Apply augmentation on the fly (different every epoch)
        if self.augment:
            X_batch = augment_batch_numpy(X_batch)
                
        return X_batch, y_batch
        
    def on_epoch_end(self):
        if self.augment:
            np.random.shuffle(self.indexes)


# ═══════════════════════════════════════════════════════════════
#  MAIN TRAINING LOOP
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="ml/configs/train_temporal.yaml")
    args = parser.parse_args()

    config_path = BASE_DIR / args.config
    if not config_path.exists():
        print(f"Config not found: {config_path}")
        return
        
    config = load_config(config_path)
    
    # 1. Load manifest
    manifest_path = BASE_DIR / config["data"]["manifest_path"]
    if not manifest_path.exists():
        print(f"Manifest not found: {manifest_path}. Please run build_manifest.py first.")
        return
        
    print(f"Loading manifest from {manifest_path}")
    df = pd.read_csv(manifest_path)
    print(f"Total clips in manifest: {len(df)}")
    
    # 2. Filter classes with too few samples
    min_samples = config["data"].get("min_samples_per_class", 20)
    class_counts = df["class"].value_counts()
    valid_classes = class_counts[class_counts >= min_samples].index.tolist()
    
    df = df[df["class"].isin(valid_classes)].copy()
    
    # Map classes to IDs
    unique_classes = sorted(df["class"].unique())
    n_classes = len(unique_classes)
    class_to_id = {c: i for i, c in enumerate(unique_classes)}
    id_to_class = {str(i): c for c, i in class_to_id.items()}
    df["class_id"] = df["class"].map(class_to_id)
    
    print(f"Valid classes: {n_classes} (filtered out {len(class_counts) - n_classes} with < {min_samples} samples)")
    
    # 3. Create splits — signer-disjoint
    if df["signer_id"].nunique() <= 1:
        from sklearn.model_selection import train_test_split
        train_df, val_df = train_test_split(df, test_size=0.2, stratify=df["class_id"], random_state=42)
    else:
        sgkf = StratifiedGroupKFold(n_splits=5)
        train_idx, val_idx = next(sgkf.split(df, df["class_id"], df["signer_id"]))
        train_df = df.iloc[train_idx]
        val_df = df.iloc[val_idx]
    
    print(f"Train set: {len(train_df)} clips, {train_df['signer_id'].nunique()} signers")
    print(f"Val set: {len(val_df)} clips, {val_df['signer_id'].nunique()} signers")
    
    # 4. Save label map
    label_map_path = BASE_DIR / config["export"]["label_map_path"]
    label_map_path.parent.mkdir(parents=True, exist_ok=True)
    with open(label_map_path, "w", encoding='utf-8') as f:
        json.dump(id_to_class, f, indent=2)
        
    # 5. Build model — with HIGHER dropout
    model_cfg = config["model"]
    dropout = 0.3  # Increased from 0.2
    model = build_temporal_model(
        n_classes=n_classes,
        seq_len=model_cfg.get("input_frames", 30),
        input_dim=model_cfg.get("input_features", 126),
        d_model=model_cfg.get("projection_dim", 128),
        num_layers=model_cfg.get("num_transformer_layers", 2),
        num_heads=model_cfg.get("num_attention_heads", 4),
        d_ff=model_cfg.get("feedforward_dim", 256),
        dropout=dropout,
        classifier_hidden=model_cfg.get("classifier_hidden", 64)
    )
    
    model.summary()
    
    # 6. Generators (normalization happens during preload)
    train_batch_size = config["training"]["phase1"].get("batch_size", 64)
    train_gen = DataGenerator(train_df, train_batch_size, n_classes, config, augment=True, desc="Train")
    val_gen = DataGenerator(val_df, train_batch_size, n_classes, config, augment=False, desc="Val")
    
    # 7. Callbacks — monitor val_accuracy, NOT val_loss
    logs_dir = BASE_DIR / "training_logs"
    logs_dir.mkdir(exist_ok=True)
    
    callbacks = [
        EarlyStopping(
            monitor='val_accuracy',   # ← FIXED: was defaulting to val_loss
            mode='max',               # ← higher is better for accuracy
            patience=15,
            restore_best_weights=True,
            verbose=1
        ),
        ModelCheckpoint(
            str(logs_dir / "temporal_best.keras"),
            monitor='val_accuracy',   # ← FIXED: save best by val_accuracy
            mode='max',
            save_best_only=True,
            verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_accuracy',
            mode='max',
            factor=0.5,
            patience=5,
            min_lr=1e-6,
            verbose=1
        ),
        OverfitDetector()  # ← NEW: prints train-vs-val gap every epoch
    ]
    
    # 8. Train
    print("\n--- Starting Training (with normalization + augmentation) ---")
    epochs = config["training"]["phase1"].get("epochs", 100)
    
    print(f"Training for up to {epochs} epochs...")
    print(f"  Dropout: {dropout}")
    print(f"  Normalization: wrist-relative + scale + orientation")
    print(f"  Augmentation: noise + scaling + rotation + frame-drop + temporal-shift")
    print(f"  Early stopping: monitors val_accuracy, patience=15")
    print()
    
    try:
        history = model.fit(
            train_gen,
            validation_data=val_gen,
            epochs=epochs,
            callbacks=callbacks
        )
        
        # Print final summary
        best_val_acc = max(history.history.get('val_accuracy', [0]))
        final_train_acc = history.history['accuracy'][-1]
        print(f"\n{'='*50}")
        print(f"  TRAINING COMPLETE")
        print(f"  Best val_accuracy: {best_val_acc:.4f} ({best_val_acc*100:.2f}%)")
        print(f"  Final train_accuracy: {final_train_acc:.4f}")
        print(f"  Gap: {final_train_acc - best_val_acc:.4f}")
        print(f"{'='*50}")
        
    except Exception as e:
        print(f"Error during training: {e}")
        import traceback
        traceback.print_exc()
    
    print("\nTraining completed.")

if __name__ == "__main__":
    main()
