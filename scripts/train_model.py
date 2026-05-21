#!/usr/bin/env python3
"""
LexiSight Model Trainer v4.0 - SPATIAL-TEMPORAL ATTENTION EDITION
Target: 80%+ top-1 accuracy on held-out VALIDATION SIGNERS only.
"""

import numpy as np
import json
import os
import tensorflow as tf
from tensorflow.keras import layers
from pathlib import Path

# Setup Paths
BASE_DIR = Path(__file__).parent.parent
MODEL_DIR = BASE_DIR / "public" / "model"
LOGS_DIR = BASE_DIR / "training_logs"
LOGS_DIR.mkdir(exist_ok=True)

SEQ_LEN = 30
FEATURES = 126 # 2 hands * 21 landmarks * 3 coords

# Custom augmentations are now applied dynamically inside the tf.data.Dataset pipeline.


# ─── 2. Spatial-Temporal Attention Architecture ───────────────────────
def build_transformer_model(num_classes):
    inputs = layers.Input(shape=(SEQ_LEN, FEATURES), name="temporal_input")
    
    # Linear Projection (embed 126-dim into richer space)
    x = layers.Dense(128, activation="relu")(inputs)
    x = layers.LayerNormalization(epsilon=1e-6)(x)
    
    # Temporal Attention Block 1
    attn_output = layers.MultiHeadAttention(num_heads=4, key_dim=128, dropout=0.3)(x, x)
    x = layers.Add()([x, attn_output])
    x = layers.LayerNormalization(epsilon=1e-6)(x)
    
    # Feed Forward
    ffn = layers.Dense(256, activation="relu")(x)
    ffn = layers.Dropout(0.3)(ffn)
    ffn = layers.Dense(128)(ffn)
    x = layers.Add()([x, ffn])
    x = layers.LayerNormalization(epsilon=1e-6)(x)
    
    # Temporal Attention Block 2
    attn_output = layers.MultiHeadAttention(num_heads=4, key_dim=128, dropout=0.3)(x, x)
    x = layers.Add()([x, attn_output])
    x = layers.LayerNormalization(epsilon=1e-6)(x)
    
    # Global Pooling across the 30 frames
    x = layers.GlobalAveragePooling1D()(x)
    
    # Classification Head
    x = layers.Dropout(0.4)(x)
    x = layers.Dense(256, activation="relu")(x)
    x = layers.Dropout(0.4)(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="predictions")(x)
    
    model = tf.keras.Model(inputs, outputs, name="LexiSight_Temporal_Attention")
    
    optimizer = tf.keras.optimizers.AdamW(learning_rate=1e-3, weight_decay=1e-4)
    model.compile(optimizer=optimizer, loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model

# ─── 3. Strict Validation Signer Callback ───────────────────────────────
class StrictSignerValidation(tf.keras.callbacks.Callback):
    def on_epoch_end(self, epoch, logs=None):
        # We enforce that early stopping only looks at 'val_accuracy'
        # which is computed strictly on the held-out signers in the validation set.
        val_acc = logs.get('val_accuracy')
        print(f"\n[Epoch {epoch+1}] Held-Out Signer Validation Accuracy: {val_acc:.4f}")
        if val_acc and val_acc >= 0.80:
            print(">>> SUCCESS: Model reached 80%+ generalization on held-out signers! <<<")

def train():
    print("Loading extracted temporal dataset...")
    
    # In production, these are built by `build_temporal_dataset.py`
    try:
        X_train = np.load(MODEL_DIR / "X_train.npy")
        y_train = np.load(MODEL_DIR / "y_train.npy")
        W_train = np.load(MODEL_DIR / "W_train.npy") # Sample weights (0.5x for Daily_Words)
        X_val = np.load(MODEL_DIR / "X_val.npy")
        y_val = np.load(MODEL_DIR / "y_val.npy")
        
        with open(MODEL_DIR / "temporal_label_map.json", "r") as f:
            label_map = json.load(f)
            num_classes = len(label_map)
            
    except FileNotFoundError:
        print("[ERROR] Extracted .npy files not found.")
        print("Please run `python scripts/build_temporal_dataset.py` first to process the mp4s via MediaPipe.")
        return

    print(f"Training on {len(X_train)} sequences across {num_classes} classes.")
    
    # ─── 4. Dynamic Augmentation in tf.data.Dataset Pipeline ───────────
    def augment_batch(x, y, weight):
        # 1. Spatial Jitter: add small Gaussian noise to landmarks
        noise = tf.random.normal(shape=tf.shape(x), mean=0.0, stddev=0.015)
        x_augmented = x + noise
        
        # 2. Frame Dropout: randomly drop entire frames (zero them out)
        # to force attention block to rely on remaining context.
        batch_size = tf.shape(x)[0]
        seq_len = tf.shape(x)[1]
        mask = tf.random.uniform((batch_size, seq_len, 1), minval=0.0, maxval=1.0) > 0.15
        mask = tf.cast(mask, x.dtype)
        x_augmented = x_augmented * mask
        
        return x_augmented, y, weight

    # Build optimized dataset pipeline
    train_ds = (
        tf.data.Dataset.from_tensor_slices((X_train, y_train, W_train))
        .shuffle(buffer_size=min(4096, len(X_train)))
        .batch(64)
        .map(augment_batch, num_parallel_calls=tf.data.AUTOTUNE)
        .prefetch(tf.data.AUTOTUNE)
    )
    
    checkpoint_path = MODEL_DIR / "best_temporal_model.keras"
    if checkpoint_path.exists():
        print(f"Found existing checkpoint at {checkpoint_path}. Resuming training...")
        model = tf.keras.models.load_model(str(checkpoint_path))
    else:
        print("No existing checkpoint found. Building model from scratch...")
        model = build_transformer_model(num_classes)
    
    model.summary()
    
    callbacks = [
        StrictSignerValidation(),
        tf.keras.callbacks.EarlyStopping(
            monitor='val_accuracy', # This evaluates strictly on the unseen signers
            patience=15,
            restore_best_weights=True,
            mode='max'
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_accuracy',
            factor=0.5,
            patience=5,
            min_lr=1e-5
        ),
        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(MODEL_DIR / "best_temporal_model.keras"),
            monitor="val_accuracy",
            save_best_only=True
        )
    ]
    
    history = model.fit(
        train_ds,
        validation_data=(X_val, y_val),
        epochs=100,
        callbacks=callbacks
    )
    
    # Export to TFJS
    print("Exporting model to TensorFlow.js format...")
    try:
        import tensorflowjs as tfjs
        import shutil
        tfjs_out_dir = MODEL_DIR / "tfjs_model"
        if tfjs_out_dir.exists():
            shutil.rmtree(tfjs_out_dir)
            
        tfjs.converters.save_keras_model(model, str(tfjs_out_dir))
        print("TFJS export complete!")
    except ImportError:
        print("tensorflowjs not installed. Skipping browser export.")

if __name__ == "__main__":
    train()
