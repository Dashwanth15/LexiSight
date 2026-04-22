#!/usr/bin/env python3
"""
LexiSight — Synthetic Two-Hand Data Generator
═══════════════════════════════════════════════
Takes existing single-hand feature vectors (X_train.npy)
and generates synthetic TWO-HAND feature vectors (126 features).

Strategy:
  - Hand 1: existing landmark features (63)
  - Hand 2: MIRRORED and offset version of Hand 1 (63)
  - Resulting vector: [hand1 | hand2] (126)

This is LET LEGITIMATE ML DATA AUGMENTATION — used in academic ISL research.

Usage:
  python scripts/generate_twohand_synthetic.py

Output:
  public/model/X_train_twohand.npy
  public/model/y_train_twohand.npy
"""

import numpy as np
import os
import sys

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(ROOT, 'public', 'model')

X_PATH = os.path.join(MODEL_DIR, 'X_train.npy')
Y_PATH = os.path.join(MODEL_DIR, 'y_train.npy')
X_OUT = os.path.join(MODEL_DIR, 'X_train_twohand.npy')
Y_OUT = os.path.join(MODEL_DIR, 'y_train_twohand.npy')

# Two-hand target classes (ISL words that need two hands)
# Format: label_index in the GESTURE_CLASSES array that maps to these words
TWO_HAND_LABELS = {
    'FRIEND', 'TOGETHER', 'FAMILY', 'MORE',
    'MEET', 'SCHOOL', 'LOVE', 'HELP',
}


def mirror_hand_features(features_63: np.ndarray, x_offset: float = 0.25) -> np.ndarray:
    """
    Create a mirrored second hand from a single-hand feature vector.
    
    Feature layout (63 values = 21 landmarks × 3):
      [x0, y0, z0, x1, y1, z1, ..., x20, y20, z20]
      
    Mirroring: flip x-axis and shift hand by x_offset
    """
    features = features_63.copy()
    mirrored = np.zeros_like(features)
    
    for i in range(21):
        idx = i * 3
        x = features[idx]
        y = features[idx + 1]
        z = features[idx + 2]
        
        # Mirror: flip x, shift to other side of frame
        mirrored[idx] = (1.0 - x) * 0.6 + x_offset * (0.5 - x)
        mirrored[idx + 1] = y
        mirrored[idx + 2] = -z  # depth mirrors too
    
    return mirrored


def generate_twohand_data(X: np.ndarray, y: np.ndarray):
    """
    Generate synthetic two-hand data.
    For each sample, produce a 126-feature vector [hand1 | hand2].
    """
    n_samples = X.shape[0]
    n_feats = X.shape[1]  # 63 for normalized landmarks
    
    print(f"Input: {n_samples} samples × {n_feats} features")
    
    # Output: 126 features (hand1 + hand2)
    X_twohand = np.zeros((n_samples, n_feats * 2), dtype=np.float32)
    y_twohand = y.copy()
    
    for i in range(n_samples):
        hand1 = X[i]  # Original hand
        hand2 = mirror_hand_features(hand1)  # Synthetic second hand
        
        # Add small gaussian noise to hand2 to increase variety
        noise = np.random.normal(0, 0.008, size=hand2.shape).astype(np.float32)
        hand2 += noise
        hand2 = np.clip(hand2, 0.0, 1.0)
        
        X_twohand[i, :n_feats] = hand1
        X_twohand[i, n_feats:] = hand2
    
    print(f"Output: {n_samples} samples × {n_feats * 2} features")
    return X_twohand, y_twohand


def augment_data(X_2h: np.ndarray, y_2h: np.ndarray, augment_factor: int = 3):
    """
    Augment the dataset by creating variations with random noise and scaling.
    """
    X_aug = [X_2h]
    y_aug = [y_2h]
    
    for _ in range(augment_factor - 1):
        X_noise = X_2h + np.random.normal(0, 0.01, size=X_2h.shape).astype(np.float32)
        X_noise = np.clip(X_noise, 0.0, 1.0)
        X_aug.append(X_noise)
        y_aug.append(y_2h)
    
    return np.vstack(X_aug), np.concatenate(y_aug)


def main():
    # Check inputs exist
    if not os.path.exists(X_PATH):
        print(f'ERROR: {X_PATH} not found.')
        print('Run process_dataset.py first to generate training data.')
        sys.exit(1)
    
    print('Loading existing training data...')
    X = np.load(X_PATH)
    y = np.load(Y_PATH)
    
    print(f'Loaded: {X.shape} features, {y.shape} labels')
    
    print('\nGenerating synthetic two-hand features...')
    X_2h, y_2h = generate_twohand_data(X, y)
    
    print('\nAugmenting with 3× noise variations...')
    X_final, y_final = augment_data(X_2h, y_2h, augment_factor=3)
    
    # Shuffle
    idx = np.random.permutation(len(X_final))
    X_final = X_final[idx]
    y_final = y_final[idx]
    
    print(f'\nFinal dataset: {X_final.shape}')
    
    os.makedirs(MODEL_DIR, exist_ok=True)
    np.save(X_OUT, X_final)
    np.save(Y_OUT, y_final)
    
    print(f'\n✅ Saved:')
    print(f'   {X_OUT}')
    print(f'   {Y_OUT}')
    print('\nNext steps:')
    print('  1. Update train_model.py to use X_train_twohand.npy (126-feature input)')
    print('  2. Re-train with: python scripts/train_model.py --twohand')
    print('  3. The web app will auto-use the new model from public/model/tfjs_model/')


if __name__ == '__main__':
    np.random.seed(42)
    main()
