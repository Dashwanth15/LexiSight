#!/usr/bin/env python3
"""
LexiSight — Quick baseline: Train ONLY on real video clips.
Excludes the 71K static images that were poisoning the temporal model.

This uses the existing hand-only .npy files (already normalized).
Purpose: Get a fast baseline to verify the architecture works on real motion data.
"""

import os, json, argparse, pandas as pd, numpy as np
from pathlib import Path
import yaml, tensorflow as tf
from sklearn.model_selection import train_test_split
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau, Callback

BASE_DIR = Path(__file__).parent.parent.parent
ML_DIR = BASE_DIR / "ml"

import sys
sys.path.insert(0, str(BASE_DIR))
from ml.models.temporal_v1 import build_temporal_model


class OverfitDetector(Callback):
    def on_epoch_end(self, epoch, logs=None):
        ta = logs.get('accuracy', 0)
        va = logs.get('val_accuracy', 0)
        gap = ta - va
        status = ""
        if gap > 0.15: status = " WARNING: OVERFITTING"
        if gap > 0.30: status = " CRITICAL: OVERFITTING HARD"
        print(f"\n  [Epoch {epoch+1}] train={ta:.4f} val={va:.4f} gap={gap:.4f}{status}")


def augment_batch(X):
    """Augment batch of (B, 30, 126) — noise, scale, rotation, frame drop."""
    B, T, D = X.shape
    Xr = X.reshape(B, T, 2, 21, 3)
    for i in range(B):
        if np.random.rand() < 0.5:
            Xr[i] += np.random.normal(0, 0.02, Xr[i].shape).astype(np.float32)
        if np.random.rand() < 0.7:
            Xr[i] *= np.random.uniform(0.8, 1.2)
        if np.random.rand() < 0.6:
            a = np.random.uniform(-15, 15) * np.pi / 180
            c, s = np.cos(a), np.sin(a)
            xv, yv = Xr[i,:,:,:,0].copy(), Xr[i,:,:,:,1].copy()
            Xr[i,:,:,:,0] = xv*c - yv*s
            Xr[i,:,:,:,1] = xv*s + yv*c
        if np.random.rand() < 0.5:
            drop = np.random.choice(T, np.random.randint(1,4), replace=False)
            Xr[i, drop] = 0.0
        if np.random.rand() < 0.3:
            sh = np.random.randint(-2, 3)
            if sh != 0:
                Xr[i] = np.roll(Xr[i], sh, axis=0)
                if sh > 0: Xr[i,:sh] = 0.0
                else: Xr[i,sh:] = 0.0
    return Xr.reshape(B, T, D)


class VideoDataGen(tf.keras.utils.Sequence):
    def __init__(self, df, batch_size, n_classes, augment=False, desc=""):
        self.bs = batch_size
        self.n_classes = n_classes
        self.augment = augment
        
        print(f"[{desc}] Loading {len(df)} video clips...")
        self.X = np.zeros((len(df), 30, 126), dtype=np.float32)
        self.y = np.zeros((len(df), n_classes), dtype=np.float32)
        loaded = 0
        for i, (_, row) in enumerate(df.iterrows()):
            p = ML_DIR / "data_processed" / row["clip_path"]
            if p.exists():
                try:
                    d = np.load(p)
                    self.X[i] = d.reshape(30, -1)
                    loaded += 1
                except: pass
            self.y[i, int(row["class_id"])] = 1.0
        self.idx = np.arange(len(self.X))
        self.on_epoch_end()
        print(f"[{desc}] Loaded {loaded}/{len(df)}")
        
    def __len__(self): return int(np.ceil(len(self.X) / self.bs))
    
    def __getitem__(self, i):
        s, e = i*self.bs, min((i+1)*self.bs, len(self.X))
        X = self.X[self.idx[s:e]].copy()
        y = self.y[self.idx[s:e]]
        if self.augment: X = augment_batch(X)
        return X, y
    
    def on_epoch_end(self):
        if self.augment: np.random.shuffle(self.idx)


def main():
    print("=" * 60)
    print("  VIDEO-ONLY BASELINE TRAINING")
    print("  (Excluding 71K static images that poisoned the model)")
    print("=" * 60)
    
    df = pd.read_csv(ML_DIR / "data_processed" / "manifest.csv")
    
    # CRITICAL FIX: Only use real video data
    video_df = df[df["source"] == "include"].copy()
    print(f"\nTotal in manifest: {len(df)}")
    print(f"Static images (EXCLUDED): {len(df[df['source'] != 'include'])}")
    print(f"Real video clips (USING): {len(video_df)}")
    
    # Filter classes with enough samples
    cc = video_df["class"].value_counts()
    valid = cc[cc >= 3].index.tolist()
    video_df = video_df[video_df["class"].isin(valid)].copy()
    
    unique_classes = sorted(video_df["class"].unique())
    n_classes = len(unique_classes)
    c2id = {c: i for i, c in enumerate(unique_classes)}
    id2c = {str(i): c for c, i in c2id.items()}
    video_df["class_id"] = video_df["class"].map(c2id)
    
    print(f"Classes with >=3 video samples: {n_classes}")
    print(f"Samples per class: min={cc[valid].min()}, max={cc[valid].max()}, mean={cc[valid].mean():.1f}")
    
    # Split: 80/20 stratified random (all same signer)
    train_df, val_df = train_test_split(video_df, test_size=0.2, stratify=video_df["class_id"], random_state=42)
    print(f"Train: {len(train_df)} | Val: {len(val_df)}")
    
    # Save label map
    lm_path = BASE_DIR / "public" / "model" / "label_map.json"
    lm_path.parent.mkdir(parents=True, exist_ok=True)
    with open(lm_path, "w") as f:
        json.dump(id2c, f, indent=2)
    
    # Build model with higher dropout
    model = build_temporal_model(
        n_classes=n_classes, seq_len=30, input_dim=126,
        d_model=128, num_layers=2, num_heads=4, d_ff=256,
        dropout=0.3, classifier_hidden=64
    )
    model.summary()
    
    # Generators
    train_gen = VideoDataGen(train_df, 32, n_classes, augment=True, desc="Train")
    val_gen = VideoDataGen(val_df, 32, n_classes, augment=False, desc="Val")
    
    logs_dir = BASE_DIR / "training_logs"
    logs_dir.mkdir(exist_ok=True)
    
    callbacks = [
        EarlyStopping(monitor='val_accuracy', mode='max', patience=15, restore_best_weights=True, verbose=1),
        ModelCheckpoint(str(logs_dir / "temporal_best.keras"), monitor='val_accuracy', mode='max', save_best_only=True, verbose=1),
        ReduceLROnPlateau(monitor='val_accuracy', mode='max', factor=0.5, patience=5, min_lr=1e-6, verbose=1),
        OverfitDetector()
    ]
    
    print("\n--- Starting video-only training ---")
    print(f"  Classes: {n_classes}")
    print(f"  Dropout: 0.3")
    print(f"  Batch size: 32")
    print(f"  Monitoring: val_accuracy")
    print()
    
    history = model.fit(train_gen, validation_data=val_gen, epochs=100, callbacks=callbacks)
    
    best_val = max(history.history.get('val_accuracy', [0]))
    print(f"\n{'='*50}")
    print(f"  DONE. Best val_accuracy: {best_val:.4f} ({best_val*100:.2f}%)")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()
