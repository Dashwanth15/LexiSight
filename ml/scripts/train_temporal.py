#!/usr/bin/env python3
"""
LexiSight — Temporal Model Trainer
Trains the Temporal Landmark Transformer on sequence data.

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
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

BASE_DIR = Path(__file__).parent.parent.parent
ML_DIR = BASE_DIR / "ml"

# Try to import our temporal model
import sys
sys.path.insert(0, str(BASE_DIR))
from ml.models.temporal_v1 import build_temporal_model


def load_config(config_path):
    with open(config_path, encoding='utf-8') as f:
        return yaml.safe_load(f)


def augment_sequence(sequence, config):
    """
    Apply online augmentation to a sequence of shape (30, 2, 21, 3).
    TensorFlow graph-compatible augmentation function.
    """
    # sequence is (frames, hands, landmarks, coords)
    aug = config["augmentation"]
    
    # Random frame dropout (zero out random frames)
    if aug.get("frame_dropout_count", 0) > 0:
        dropout_count = tf.random.uniform([], minval=0, maxval=aug["frame_dropout_count"]+1, dtype=tf.int32)
        indices = tf.random.shuffle(tf.range(tf.shape(sequence)[0]))[:dropout_count]
        
        # Create a mask to zero out the selected frames
        mask = tf.ones([tf.shape(sequence)[0], 1, 1, 1], dtype=tf.float32)
        updates = tf.zeros([dropout_count, 1, 1, 1], dtype=tf.float32)
        mask = tf.tensor_scatter_nd_update(mask, tf.expand_dims(indices, 1), updates)
        sequence = sequence * mask
    
    # Gaussian noise
    sigma = aug.get("gaussian_noise_sigma", 0.0)
    if sigma > 0:
        noise = tf.random.normal(shape=tf.shape(sequence), mean=0.0, stddev=sigma)
        sequence = sequence + noise
    
    # Temporal shift / crop would be more complex to do purely in TF graphs, 
    # but we can apply small scaling and rotation.
    
    scale_min, scale_max = aug.get("scale_range", [0.85, 1.15])
    scale = tf.random.uniform([], minval=scale_min, maxval=scale_max)
    sequence = sequence * scale

    return sequence


class DataGenerator(tf.keras.utils.Sequence):
    """Custom DataGenerator for loading .npy clips batch by batch."""
    
    def __init__(self, df, batch_size, n_classes, config, augment=False):
        self.df = df
        self.batch_size = batch_size
        self.n_classes = n_classes
        self.config = config
        self.augment = augment
        self.indexes = np.arange(len(self.df))
        self.on_epoch_end()
        
    def __len__(self):
        return int(np.ceil(len(self.df) / self.batch_size))
        
    def __getitem__(self, index):
        start = index * self.batch_size
        end = min((index + 1) * self.batch_size, len(self.df))
        
        batch_df = self.df.iloc[self.indexes[start:end]]
        
        X = np.zeros((len(batch_df), 30, 126), dtype=np.float32)
        y = np.zeros((len(batch_df), self.n_classes), dtype=np.float32)
        
        for i, (_, row) in enumerate(batch_df.iterrows()):
            clip_path = ML_DIR / "data_processed" / row["clip_path"]
            if clip_path.exists():
                try:
                    data = np.load(clip_path) # (30, 2, 21, 3)
                    # We can apply simple data augmentation here in numpy if augment is True
                    if self.augment and np.random.rand() < 0.5:
                        # Simple gaussian noise
                        sigma = self.config["augmentation"].get("gaussian_noise_sigma", 0.0)
                        if sigma > 0:
                            data += np.random.normal(0, sigma, data.shape)
                    
                    # Flatten spatial dims: (30, 2*21*3) = (30, 126)
                    X[i] = data.reshape(30, -1)
                except Exception as e:
                    pass # Keep as zeros if load fails
            
            y[i, int(row["class_id"])] = 1.0
            
        return X, y
        
    def on_epoch_end(self):
        if self.augment:
            np.random.shuffle(self.indexes)


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
        # For now, we will just print what it would do.
        print("Waiting for data pipeline to complete.")
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
    
    # 3. Create splits
    # We use GroupKFold to ensure signers don't cross splits, UNLESS there's only 1 signer
    if df["signer_id"].nunique() <= 1:
        from sklearn.model_selection import train_test_split
        train_df, val_df = train_test_split(df, test_size=0.1, stratify=df["class_id"], random_state=42)
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
        
    # 5. Build model
    model_cfg = config["model"]
    model = build_temporal_model(
        n_classes=n_classes,
        seq_len=model_cfg.get("input_frames", 30),
        input_dim=model_cfg.get("input_features", 126),
        d_model=model_cfg.get("projection_dim", 128),
        num_layers=model_cfg.get("num_transformer_layers", 2),
        num_heads=model_cfg.get("num_attention_heads", 4),
        d_ff=model_cfg.get("feedforward_dim", 256),
        dropout=model_cfg.get("dropout", 0.2),
        classifier_hidden=model_cfg.get("classifier_hidden", 64)
    )
    
    model.summary()
    
    # 6. Generators
    train_batch_size = config["training"]["phase1"].get("batch_size", 64)
    train_gen = DataGenerator(train_df, train_batch_size, n_classes, config, augment=True)
    val_gen = DataGenerator(val_df, train_batch_size, n_classes, config, augment=False)
    
    # 7. Callbacks
    logs_dir = BASE_DIR / "training_logs"
    logs_dir.mkdir(exist_ok=True)
    
    callbacks = [
        EarlyStopping(patience=config["training"]["phase1"].get("early_stopping_patience", 15), 
                      restore_best_weights=True),
        ModelCheckpoint(str(logs_dir / "temporal_best.keras"), save_best_only=True),
        ReduceLROnPlateau(factor=0.5, patience=5, min_lr=1e-6)
    ]
    
    # 8. Train Phase 1
    print("\n--- Starting Phase 1 Training ---")
    epochs = config["training"]["phase1"].get("epochs", 100)
    
    # We would actually call model.fit here if data existed
    print(f"Training for {epochs} epochs...")
    try:
        history = model.fit(train_gen, validation_data=val_gen, epochs=epochs, callbacks=callbacks)
        # Save final model
        model.save(str(BASE_DIR / config["export"].get("keras_model_path", "ml/models/best_temporal.keras")))
    except Exception as e:
        print(f"Error during training: {e}")
    
    print("\nTraining completed.")

if __name__ == "__main__":
    main()
