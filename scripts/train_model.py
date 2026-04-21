#!/usr/bin/env python3
"""
LexiSight Model Trainer
════════════════════════
Trains a dense neural network on extracted landmarks and
exports to TensorFlow.js format for browser inference.

Usage:
    python scripts/train_model.py

Expected accuracy: 92-97% on combined ISL dataset
Export location: public/model/tfjs_model/
"""

import numpy as np
import json
import os
import sys
from pathlib import Path

# ── Config ───────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
MODEL_DIR = BASE_DIR / "public" / "model"

def check_deps():
    missing = []
    for pkg in ['tensorflow', 'sklearn', 'tensorflowjs']:
        try:
            __import__(pkg if pkg != 'sklearn' else 'sklearn')
        except ImportError:
            missing.append(pkg if pkg != 'sklearn' else 'scikit-learn')
    if missing:
        print(f"Missing packages: {', '.join(missing)}")
        print(f"Install with: pip install -r scripts/requirements.txt")
        sys.exit(1)

check_deps()

import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization, Input
from tensorflow.keras.callbacks import (
    EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
)
from tensorflow.keras.regularizers import l2
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report
import tensorflowjs as tfjs

def main():
    print("\n╔══════════════════════════════════╗")
    print("║   LexiSight Model Trainer v1.0  ║")
    print("╚══════════════════════════════════╝\n")

    # ── Load data ────────────────────────────────────────────────
    x_path = MODEL_DIR / "X_train.npy"
    y_path = MODEL_DIR / "y_train.npy"
    label_path = MODEL_DIR / "label_map.json"

    if not x_path.exists():
        print("✗ X_train.npy not found!")
        print("  Run: python scripts/process_dataset.py first")
        sys.exit(1)

    print("➤ Loading dataset...")
    X = np.load(x_path)
    y = np.load(y_path)

    with open(label_path) as f:
        label_map = json.load(f)

    N_CLASSES = len(label_map)
    print(f"  Samples  : {len(X):,}")
    print(f"  Classes  : {N_CLASSES}")
    print(f"  Features : {X.shape[1]}")

    # ── Normalize features ────────────────────────────────────────
    print("\n➤ Fitting StandardScaler...")
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    scaler_params = {
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist()
    }
    with open(MODEL_DIR / "scaler.json", "w") as f:
        json.dump(scaler_params, f)
    print("  Scaler saved → public/model/scaler.json")

    # ── Train/val split ────────────────────────────────────────────
    X_train, X_val, y_train, y_val = train_test_split(
        X_scaled, y, test_size=0.20, random_state=42, stratify=y
    )

    y_train_oh = tf.keras.utils.to_categorical(y_train, N_CLASSES)
    y_val_oh = tf.keras.utils.to_categorical(y_val, N_CLASSES)

    print(f"\n  Train: {len(X_train):,} | Val: {len(X_val):,}")

    # ── Model architecture ────────────────────────────────────────
    print("\n➤ Building model...")
    model = Sequential([
        Input(shape=(63,)),

        Dense(256, activation='relu', kernel_regularizer=l2(1e-4)),
        BatchNormalization(),
        Dropout(0.4),

        Dense(128, activation='relu', kernel_regularizer=l2(1e-4)),
        BatchNormalization(),
        Dropout(0.35),

        Dense(64, activation='relu', kernel_regularizer=l2(1e-4)),
        BatchNormalization(),
        Dropout(0.25),

        Dense(N_CLASSES, activation='softmax')
    ], name='lexisight_isl_classifier')

    model.summary()

    # ── Compile ────────────────────────────────────────────────────
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss='categorical_crossentropy',
        metrics=['accuracy', tf.keras.metrics.TopKCategoricalAccuracy(k=3, name='top3_acc')]
    )

    # ── Callbacks ────────────────────────────────────────────────
    best_path = str(MODEL_DIR / "best_model.keras")
    callbacks = [
        EarlyStopping(
            monitor='val_accuracy', patience=20,
            restore_best_weights=True, verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss', patience=8,
            factor=0.5, min_lr=1e-6, verbose=1
        ),
        ModelCheckpoint(
            best_path, monitor='val_accuracy',
            save_best_only=True, verbose=0
        ),
        tf.keras.callbacks.TerminateOnNaN(),
    ]

    # ── Train ─────────────────────────────────────────────────────
    print("\n➤ Training (this takes 15-30 minutes on CPU)...")
    history = model.fit(
        X_train, y_train_oh,
        validation_data=(X_val, y_val_oh),
        epochs=150,
        batch_size=64,
        callbacks=callbacks,
        verbose=1
    )

    # ── Evaluate ─────────────────────────────────────────────────
    val_loss, val_acc, val_top3 = model.evaluate(X_val, y_val_oh, verbose=0)
    print(f"\n╔═══════════════════════════╗")
    print(f"║      TRAINING RESULTS     ║")
    print(f"╚═══════════════════════════╝")
    print(f"  Val Accuracy  : {val_acc:.2%}")
    print(f"  Val Top-3 Acc : {val_top3:.2%}")
    print(f"  Val Loss      : {val_loss:.4f}")
    print(f"  Best epoch    : {np.argmax(history.history['val_accuracy']) + 1}")

    # Per-class report
    print("\n➤ Classification Report:")
    y_pred = np.argmax(model.predict(X_val, verbose=0), axis=1)
    target_names = [label_map[str(i)] for i in range(N_CLASSES)]
    print(classification_report(y_val, y_pred, target_names=target_names, zero_division=0))

    # ── Export to TF.js ───────────────────────────────────────────
    tfjs_dir = MODEL_DIR / "tfjs_model"
    tfjs_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n➤ Exporting to TensorFlow.js...")
    tfjs.converters.save_keras_model(model, str(tfjs_dir))
    print(f"  ✓ Model exported → public/model/tfjs_model/")

    # Save training metadata
    meta = {
        "n_classes": N_CLASSES,
        "label_map": label_map,
        "val_accuracy": float(val_acc),
        "val_top3_accuracy": float(val_top3),
        "training_samples": int(len(X_train)),
        "feature_dim": 63,
    }
    with open(MODEL_DIR / "model_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    print("\n✓ Training complete!")
    print(f"  Model: public/model/tfjs_model/model.json")
    print(f"  Accuracy: {val_acc:.2%}")
    print("\n  Start the app: npm run dev\n")

if __name__ == "__main__":
    main()
