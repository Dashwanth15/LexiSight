#!/usr/bin/env python3
"""
LexiSight -- Video-Only Trainer v2 (Fine-tune from 81% model)
Improvements over v1:
  1. Class-balanced sampling (oversample rare classes)
  2. Focal loss (hard-negative mining — emphasizes confused pairs)
  3. Cosine decay LR schedule
  4. Lower LR (1e-4 for fine-tuning)
  5. Stronger augmentation (rotation, time warp, speed jitter)
  6. Dropout 0.35
  7. Loads weights from temporal_best.keras and fine-tunes

Usage: python ml/scripts/train_video_v2.py
"""

import os, json, pandas as pd, numpy as np
from pathlib import Path
import tensorflow as tf
from sklearn.model_selection import train_test_split
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau, Callback

BASE_DIR = Path(__file__).parent.parent.parent
ML_DIR = BASE_DIR / "ml"

import sys
sys.path.insert(0, str(BASE_DIR))
from ml.models.temporal_v1 import build_temporal_model


# ═══════════════════════════════════════════════════════════
#  FOCAL LOSS — Hard-negative mining built into the loss
# ═══════════════════════════════════════════════════════════

class FocalCategoricalCrossentropy(tf.keras.losses.Loss):
    """
    Focal Loss: down-weights easy examples, focuses on hard ones.
    When the model is confident and correct, loss is reduced.
    When the model is confused (hard negatives), loss is amplified.
    gamma=2.0 is standard. Higher gamma = more focus on hard examples.
    """
    def __init__(self, gamma=2.0, label_smoothing=0.05, **kwargs):
        super().__init__(**kwargs)
        self.gamma = gamma
        self.label_smoothing = label_smoothing
    
    def call(self, y_true, y_pred):
        # Apply label smoothing
        n_classes = tf.cast(tf.shape(y_true)[-1], tf.float32)
        y_true = y_true * (1.0 - self.label_smoothing) + self.label_smoothing / n_classes
        
        # Clip predictions to avoid log(0)
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)
        
        # Standard cross entropy
        ce = -y_true * tf.math.log(y_pred)
        
        # Focal weight: (1 - p_t)^gamma
        # p_t = predicted probability for the true class
        weight = tf.pow(1.0 - y_pred, self.gamma)
        
        focal_loss = weight * ce
        return tf.reduce_sum(focal_loss, axis=-1)


# ═══════════════════════════════════════════════════════════
#  COSINE DECAY LR SCHEDULE
# ═══════════════════════════════════════════════════════════

class CosineDecayCallback(Callback):
    """Cosine annealing from initial_lr to min_lr over total epochs."""
    def __init__(self, initial_lr=1e-4, min_lr=1e-6, total_epochs=100, warmup_epochs=3):
        super().__init__()
        self.initial_lr = initial_lr
        self.min_lr = min_lr
        self.total_epochs = total_epochs
        self.warmup_epochs = warmup_epochs
    
    def on_epoch_begin(self, epoch, logs=None):
        if epoch < self.warmup_epochs:
            # Linear warmup
            lr = self.initial_lr * (epoch + 1) / self.warmup_epochs
        else:
            # Cosine decay
            progress = (epoch - self.warmup_epochs) / max(self.total_epochs - self.warmup_epochs, 1)
            lr = self.min_lr + 0.5 * (self.initial_lr - self.min_lr) * (1 + np.cos(np.pi * progress))
        
        self.model.optimizer.learning_rate.assign(lr)


class OverfitDetector(Callback):
    def on_epoch_end(self, epoch, logs=None):
        ta = logs.get('accuracy', 0)
        va = logs.get('val_accuracy', 0)
        lr = float(tf.keras.backend.get_value(self.model.optimizer.learning_rate))
        gap = ta - va
        status = ""
        if gap > 0.15: status = " WARNING"
        if gap > 0.30: status = " CRITICAL"
        print(f"\n  [Epoch {epoch+1}] train={ta:.4f} val={va:.4f} gap={gap:.4f} lr={lr:.2e}{status}")


# ═══════════════════════════════════════════════════════════
#  ENHANCED AUGMENTATION
# ═══════════════════════════════════════════════════════════

def augment_batch_v2(X):
    """
    Stronger augmentation than v1:
    - Gaussian noise (coordinate jitter)
    - Random scaling
    - Random 2D rotation (+-15 degrees)
    - Frame dropout (zero out 1-4 random frames)
    - Temporal shift (+-2 frames)
    - Speed jitter (stretch/compress time)
    - Mirror X axis (left-right flip, 30% chance)
    """
    B, T, D = X.shape
    Xr = X.reshape(B, T, 2, 21, 3)
    
    for i in range(B):
        # 1. Gaussian noise (60% chance, sigma=0.015)
        if np.random.rand() < 0.6:
            Xr[i] += np.random.normal(0, 0.015, Xr[i].shape).astype(np.float32)
        
        # 2. Random scaling (70% chance, 0.8-1.2)
        if np.random.rand() < 0.7:
            Xr[i] *= np.random.uniform(0.8, 1.2)
        
        # 3. Random 2D rotation (60% chance, +-15 degrees)
        if np.random.rand() < 0.6:
            a = np.random.uniform(-15, 15) * np.pi / 180
            c, s = np.cos(a), np.sin(a)
            xv, yv = Xr[i,:,:,:,0].copy(), Xr[i,:,:,:,1].copy()
            Xr[i,:,:,:,0] = xv*c - yv*s
            Xr[i,:,:,:,1] = xv*s + yv*c
        
        # 4. Frame dropout (50% chance, drop 1-4 frames)
        if np.random.rand() < 0.5:
            n_drop = np.random.randint(1, 5)
            drop_idx = np.random.choice(T, min(n_drop, T), replace=False)
            Xr[i, drop_idx] = 0.0
        
        # 5. Temporal shift (30% chance, +-2 frames)
        if np.random.rand() < 0.3:
            sh = np.random.randint(-2, 3)
            if sh != 0:
                Xr[i] = np.roll(Xr[i], sh, axis=0)
                if sh > 0: Xr[i,:sh] = 0.0
                else: Xr[i,sh:] = 0.0
        
        # 6. Speed jitter (20% chance — resample time axis)
        if np.random.rand() < 0.2:
            speed = np.random.uniform(0.8, 1.2)
            new_len = int(T * speed)
            if new_len >= 5 and new_len != T:
                indices = np.linspace(0, T-1, new_len).astype(int)
                resampled = Xr[i, indices]
                # Pad or crop back to T
                if new_len < T:
                    pad = np.zeros((T - new_len,) + Xr[i].shape[1:], dtype=np.float32)
                    resampled = np.concatenate([resampled, pad], axis=0)
                Xr[i] = resampled[:T]
        
        # 7. Mirror X (30% chance — flip left-right)
        if np.random.rand() < 0.3:
            Xr[i, :, :, :, 0] *= -1  # flip x coordinates
            # Swap left and right hand
            Xr[i] = Xr[i, :, ::-1, :, :]
    
    return Xr.reshape(B, T, D)


# ═══════════════════════════════════════════════════════════
#  CLASS-BALANCED DATA GENERATOR
# ═══════════════════════════════════════════════════════════

class BalancedVideoDataGen(tf.keras.utils.Sequence):
    """
    Class-balanced generator: oversamples rare classes so every class
    appears roughly equally often per epoch.
    """
    def __init__(self, df, batch_size, n_classes, augment=False, desc=""):
        self.bs = batch_size
        self.n_classes = n_classes
        self.augment = augment
        
        print(f"[{desc}] Loading {len(df)} video clips...")
        self.X = np.zeros((len(df), 30, 126), dtype=np.float32)
        self.y_ids = np.zeros(len(df), dtype=np.int32)
        loaded = 0
        for i, (_, row) in enumerate(df.iterrows()):
            p = ML_DIR / "data_processed" / row["clip_path"]
            if p.exists():
                try:
                    d = np.load(p)
                    self.X[i] = d.reshape(30, -1)
                    loaded += 1
                except: pass
            self.y_ids[i] = int(row["class_id"])
        print(f"[{desc}] Loaded {loaded}/{len(df)}")
        
        # Build class-balanced sampling indices
        self.class_indices = {}
        for i in range(len(self.y_ids)):
            cid = self.y_ids[i]
            if cid not in self.class_indices:
                self.class_indices[cid] = []
            self.class_indices[cid].append(i)
        
        # Calculate how many samples per class per epoch
        max_per_class = max(len(v) for v in self.class_indices.values())
        self.balanced_indices = []
        for cid, indices in self.class_indices.items():
            # Oversample to match the largest class
            repeated = np.random.choice(indices, size=max_per_class, replace=True)
            self.balanced_indices.extend(repeated.tolist())
        
        self.balanced_indices = np.array(self.balanced_indices)
        np.random.shuffle(self.balanced_indices)
        print(f"[{desc}] Balanced epoch size: {len(self.balanced_indices)} (from {len(df)} original)")
        
    def __len__(self): 
        return int(np.ceil(len(self.balanced_indices) / self.bs))
    
    def __getitem__(self, i):
        s = i * self.bs
        e = min((i+1) * self.bs, len(self.balanced_indices))
        idx = self.balanced_indices[s:e]
        
        X = self.X[idx].copy()
        y = np.zeros((len(idx), self.n_classes), dtype=np.float32)
        for j, ii in enumerate(idx):
            y[j, self.y_ids[ii]] = 1.0
        
        if self.augment:
            X = augment_batch_v2(X)
        return X, y
    
    def on_epoch_end(self):
        if self.augment:
            # Re-balance every epoch for variety
            self.balanced_indices = []
            max_per_class = max(len(v) for v in self.class_indices.values())
            for cid, indices in self.class_indices.items():
                repeated = np.random.choice(indices, size=max_per_class, replace=True)
                self.balanced_indices.extend(repeated.tolist())
            self.balanced_indices = np.array(self.balanced_indices)
            np.random.shuffle(self.balanced_indices)


class SimpleVideoDataGen(tf.keras.utils.Sequence):
    """Simple validation generator (no balancing, no augmentation)."""
    def __init__(self, df, batch_size, n_classes, desc=""):
        self.bs = batch_size
        self.n_classes = n_classes
        print(f"[{desc}] Loading {len(df)} video clips...")
        self.X = np.zeros((len(df), 30, 126), dtype=np.float32)
        self.y = np.zeros((len(df), n_classes), dtype=np.float32)
        loaded = 0
        for i, (_, row) in enumerate(df.iterrows()):
            p = ML_DIR / "data_processed" / row["clip_path"]
            if p.exists():
                try:
                    self.X[i] = np.load(p).reshape(30, -1)
                    loaded += 1
                except: pass
            self.y[i, int(row["class_id"])] = 1.0
        print(f"[{desc}] Loaded {loaded}/{len(df)}")
    def __len__(self): return int(np.ceil(len(self.X) / self.bs))
    def __getitem__(self, i):
        s, e = i*self.bs, min((i+1)*self.bs, len(self.X))
        return self.X[s:e], self.y[s:e]


# ═══════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  VIDEO TRAINER v2 — Fine-tune from 81% model")
    print("  Focal loss + class-balanced + cosine LR + stronger aug")
    print("=" * 60)
    
    df = pd.read_csv(ML_DIR / "data_processed" / "manifest.csv")
    video_df = df[df["source"] == "include"].copy()
    
    cc = video_df["class"].value_counts()
    valid = cc[cc >= 3].index.tolist()
    video_df = video_df[video_df["class"].isin(valid)].copy()
    
    unique_classes = sorted(video_df["class"].unique())
    n_classes = len(unique_classes)
    c2id = {c: i for i, c in enumerate(unique_classes)}
    id2c = {str(i): c for c, i in c2id.items()}
    video_df["class_id"] = video_df["class"].map(c2id)
    
    train_df, val_df = train_test_split(video_df, test_size=0.2, stratify=video_df["class_id"], random_state=42)
    print(f"\nClasses: {n_classes} | Train: {len(train_df)} | Val: {len(val_df)}")
    
    # Build model with higher dropout
    DROPOUT = 0.35
    model = build_temporal_model(
        n_classes=n_classes, seq_len=30, input_dim=126,
        d_model=128, num_layers=2, num_heads=4, d_ff=256,
        dropout=DROPOUT, classifier_hidden=64
    )
    
    # Load weights from v1 best model
    v1_path = BASE_DIR / "training_logs" / "temporal_best.keras"
    if v1_path.exists():
        print(f"\nLoading pre-trained weights from {v1_path}...")
        from ml.models.temporal_v1 import PositionalEncoding, TransformerEncoderBlock
        v1_model = tf.keras.models.load_model(str(v1_path), custom_objects={
            "PositionalEncoding": PositionalEncoding,
            "TransformerEncoderBlock": TransformerEncoderBlock
        })
        # Transfer weights layer by layer (skip if shape mismatch)
        transferred = 0
        for v1_layer, v2_layer in zip(v1_model.layers, model.layers):
            try:
                v2_layer.set_weights(v1_layer.get_weights())
                transferred += 1
            except: pass
        print(f"  Transferred {transferred}/{len(model.layers)} layers")
        del v1_model
    else:
        print("  No v1 model found, training from scratch")
    
    # Re-compile with focal loss + lower LR
    model.compile(
        optimizer=tf.keras.optimizers.AdamW(learning_rate=1e-4, weight_decay=1e-4),
        loss=FocalCategoricalCrossentropy(gamma=2.0, label_smoothing=0.05),
        metrics=['accuracy',
                 tf.keras.metrics.TopKCategoricalAccuracy(k=3, name='top3_acc'),
                 tf.keras.metrics.TopKCategoricalAccuracy(k=5, name='top5_acc')]
    )
    
    model.summary()
    
    # Generators
    train_gen = BalancedVideoDataGen(train_df, 32, n_classes, augment=True, desc="Train")
    val_gen = SimpleVideoDataGen(val_df, 32, n_classes, desc="Val")
    
    logs_dir = BASE_DIR / "training_logs"
    logs_dir.mkdir(exist_ok=True)
    
    EPOCHS = 80
    callbacks = [
        EarlyStopping(monitor='val_accuracy', mode='max', patience=20,
                      restore_best_weights=True, verbose=1),
        ModelCheckpoint(str(logs_dir / "temporal_v2_best.keras"),
                        monitor='val_accuracy', mode='max', save_best_only=True, verbose=1),
        CosineDecayCallback(initial_lr=1e-4, min_lr=1e-6, total_epochs=EPOCHS, warmup_epochs=3),
        OverfitDetector()
    ]
    
    print(f"\n--- Starting v2 training ---")
    print(f"  Fine-tuning from 81% model")
    print(f"  Loss: Focal (gamma=2.0)")
    print(f"  LR: 1e-4 with cosine decay")
    print(f"  Dropout: {DROPOUT}")
    print(f"  Sampling: class-balanced (oversampling rare classes)")
    print(f"  Augmentation: noise + scale + rotation + frame-drop + speed-jitter + mirror")
    print()
    
    history = model.fit(train_gen, validation_data=val_gen, epochs=EPOCHS, callbacks=callbacks)
    
    best_val = max(history.history.get('val_accuracy', [0]))
    print(f"\n{'='*50}")
    print(f"  v2 DONE. Best val_accuracy: {best_val:.4f} ({best_val*100:.2f}%)")
    print(f"  (v1 was 81.34%)")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
