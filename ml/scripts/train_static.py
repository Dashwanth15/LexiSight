#!/usr/bin/env python3
"""
LexiSight — Static Model Trainer
Trains a simple dense classifier on single-frame hand landmarks for letters (A-Z) and digits (0-9).

Input: (batch, 126) — single frame, 21 landmarks x 3 coords x 2 hands
Output: (batch, n_classes) — softmax over letters/digits

This model handles the STATIC signs (fingerspelling).
The temporal model handles DYNAMIC signs (words).
"""

import os, json, argparse, pandas as pd, numpy as np
from pathlib import Path
import tensorflow as tf
from sklearn.model_selection import train_test_split
from tensorflow.keras import layers, Model
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau, Callback

BASE_DIR = Path(__file__).parent.parent.parent
ML_DIR = BASE_DIR / "ml"


class OverfitDetector(Callback):
    def on_epoch_end(self, epoch, logs=None):
        ta = logs.get('accuracy', 0)
        va = logs.get('val_accuracy', 0)
        gap = ta - va
        status = ""
        if gap > 0.10: status = " WARNING"
        if gap > 0.20: status = " OVERFITTING"
        print(f"\n  [Epoch {epoch+1}] train={ta:.4f} val={va:.4f} gap={gap:.4f}{status}")


def build_static_model(n_classes, input_dim=126, dropout=0.3):
    """Simple dense model for static hand pose classification."""
    inp = layers.Input(shape=(input_dim,), name="landmarks")
    
    x = layers.Dense(256, activation='relu')(inp)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(dropout)(x)
    
    x = layers.Dense(128, activation='relu')(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(dropout)(x)
    
    x = layers.Dense(64, activation='relu')(x)
    x = layers.Dropout(dropout / 2)(x)
    
    out = layers.Dense(n_classes, activation='softmax', name='output')(x)
    
    model = Model(inputs=inp, outputs=out, name="StaticHandClassifier")
    model.compile(
        optimizer=tf.keras.optimizers.AdamW(learning_rate=1e-3, weight_decay=0.01),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.05),
        metrics=['accuracy',
                 tf.keras.metrics.TopKCategoricalAccuracy(k=3, name='top3_acc')]
    )
    return model


def augment_static(X):
    """Augment single-frame landmarks."""
    B = X.shape[0]
    Xr = X.reshape(B, 2, 21, 3)
    
    for i in range(B):
        # Gaussian noise
        if np.random.rand() < 0.5:
            Xr[i] += np.random.normal(0, 0.015, Xr[i].shape).astype(np.float32)
        # Scale
        if np.random.rand() < 0.5:
            Xr[i] *= np.random.uniform(0.85, 1.15)
        # Rotation
        if np.random.rand() < 0.5:
            a = np.random.uniform(-10, 10) * np.pi / 180
            c, s = np.cos(a), np.sin(a)
            xv, yv = Xr[i,:,:,0].copy(), Xr[i,:,:,1].copy()
            Xr[i,:,:,0] = xv*c - yv*s
            Xr[i,:,:,1] = xv*s + yv*c
    
    return Xr.reshape(B, -1)


class StaticDataGen(tf.keras.utils.Sequence):
    def __init__(self, df, batch_size, n_classes, augment=False, desc=""):
        self.bs = batch_size
        self.n_classes = n_classes
        self.augment = augment
        
        print(f"[{desc}] Loading {len(df)} static landmarks...")
        self.X = np.zeros((len(df), 126), dtype=np.float32)
        self.y = np.zeros((len(df), n_classes), dtype=np.float32)
        loaded = 0
        for i, (_, row) in enumerate(df.iterrows()):
            p = ML_DIR / "data_processed" / row["clip_path"]
            if p.exists():
                try:
                    d = np.load(p)
                    # Take frame 0 (all frames are identical for static images)
                    self.X[i] = d[0].reshape(-1)
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
        if self.augment: X = augment_static(X)
        return X, y
    
    def on_epoch_end(self):
        if self.augment: np.random.shuffle(self.idx)


def main():
    print("=" * 60)
    print("  STATIC MODEL TRAINING (Letters + Digits)")
    print("=" * 60)
    
    df = pd.read_csv(ML_DIR / "data_processed" / "manifest.csv")
    
    # Only use static image data
    static_df = df[df["source"] == "static_images"].copy()
    print(f"\nTotal static images: {len(static_df)}")
    
    # Map classes
    unique_classes = sorted(static_df["class"].unique())
    n_classes = len(unique_classes)
    c2id = {c: i for i, c in enumerate(unique_classes)}
    id2c = {str(i): c for c, i in c2id.items()}
    static_df["class_id"] = static_df["class"].map(c2id)
    
    cc = static_df["class"].value_counts()
    print(f"Classes: {n_classes}")
    print(f"Samples per class: min={cc.min()}, max={cc.max()}, mean={cc.mean():.0f}")
    
    # Split
    train_df, val_df = train_test_split(static_df, test_size=0.15, stratify=static_df["class_id"], random_state=42)
    print(f"Train: {len(train_df)} | Val: {len(val_df)}")
    
    # Save label map
    lm_path = BASE_DIR / "public" / "model" / "static_label_map.json"
    lm_path.parent.mkdir(parents=True, exist_ok=True)
    with open(lm_path, "w") as f:
        json.dump(id2c, f, indent=2)
    
    # Build model
    model = build_static_model(n_classes=n_classes, dropout=0.3)
    model.summary()
    
    # Generators
    train_gen = StaticDataGen(train_df, 128, n_classes, augment=True, desc="Train")
    val_gen = StaticDataGen(val_df, 128, n_classes, augment=False, desc="Val")
    
    logs_dir = BASE_DIR / "training_logs"
    logs_dir.mkdir(exist_ok=True)
    
    callbacks = [
        EarlyStopping(monitor='val_accuracy', mode='max', patience=10, restore_best_weights=True, verbose=1),
        ModelCheckpoint(str(logs_dir / "static_best.keras"), monitor='val_accuracy', mode='max', save_best_only=True, verbose=1),
        ReduceLROnPlateau(monitor='val_accuracy', mode='max', factor=0.5, patience=3, min_lr=1e-6, verbose=1),
        OverfitDetector()
    ]
    
    print("\n--- Starting static model training ---")
    history = model.fit(train_gen, validation_data=val_gen, epochs=50, callbacks=callbacks)
    
    best_val = max(history.history.get('val_accuracy', [0]))
    print(f"\n{'='*50}")
    print(f"  DONE. Best val_accuracy: {best_val:.4f} ({best_val*100:.2f}%)")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()
