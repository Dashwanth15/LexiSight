#!/usr/bin/env python3
"""
LexiSight Standalone TFJS Exporter - Keras 3 to Keras 2 Weight-Transfer Edition
Bypasses NumPy 2.x and Keras 3 conversion version checks by mapping weights in memory.
"""

# ─── MONKEYPATCHES ───
import numpy as np
if not hasattr(np, 'object'):
    np.object = object
    print("[Exporter] Successfully patched np.object for NumPy 2.x compatibility.")

import sys
from unittest.mock import MagicMock
sys.modules["tensorflow_hub"] = MagicMock()
print("[Exporter] Successfully mocked tensorflow_hub to bypass TF Estimator removal crash.")
# ─────────────────────

import tensorflow as tf
import tf_keras
from tf_keras import layers
from pathlib import Path
import tensorflowjs as tfjs
import shutil

BASE_DIR = Path(__file__).parent.parent
MODEL_DIR = BASE_DIR / "public" / "model"
keras_path = MODEL_DIR / "best_temporal_model.keras"
tfjs_out_dir = MODEL_DIR / "tfjs_model"

def build_keras2_model(num_classes):
    inputs = layers.Input(shape=(30, 126), name="temporal_input")
    
    # Linear Projection
    x = layers.Dense(128, activation="relu", name="dense")(inputs)
    x = layers.LayerNormalization(epsilon=1e-6, name="layer_normalization")(x)
    
    # Temporal Attention Block 1
    attn_output = layers.MultiHeadAttention(num_heads=4, key_dim=128, dropout=0.3, name="multi_head_attention")(x, x)
    x = layers.Add(name="add")([x, attn_output])
    x = layers.LayerNormalization(epsilon=1e-6, name="layer_normalization_1")(x)
    
    # Feed Forward
    ffn = layers.Dense(256, activation="relu", name="dense_1")(x)
    ffn = layers.Dropout(0.3, name="dropout_1")(ffn)
    ffn = layers.Dense(128, name="dense_2")(ffn)
    x = layers.Add(name="add_1")([x, ffn])
    x = layers.LayerNormalization(epsilon=1e-6, name="layer_normalization_2")(x)
    
    # Temporal Attention Block 2
    attn_output = layers.MultiHeadAttention(num_heads=4, key_dim=128, dropout=0.3, name="multi_head_attention_1")(x, x)
    x = layers.Add(name="add_2")([x, attn_output])
    x = layers.LayerNormalization(epsilon=1e-6, name="layer_normalization_3")(x)
    
    # Global Pooling
    x = layers.GlobalAveragePooling1D(name="global_average_pooling1d")(x)
    
    # Classification Head
    x = layers.Dropout(0.4, name="dropout_3")(x)
    x = layers.Dense(256, activation="relu", name="dense_3")(x)
    x = layers.Dropout(0.4, name="dropout_4")(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="predictions")(x)
    
    model = tf_keras.Model(inputs, outputs, name="LexiSight_Temporal_Attention")
    return model

def main():
    if not keras_path.exists():
        print(f"[Exporter] Error: Keras model not found at {keras_path}")
        sys.exit(1)
        
    print(f"[Exporter] Loading Keras 3 model from {keras_path}...")
    k3_model = tf.keras.models.load_model(str(keras_path))
    num_classes = k3_model.output_shape[-1]
    print(f"[Exporter] Detected {num_classes} output classes.")
    
    print("[Exporter] Rebuilding identical model architecture using Keras 2 (tf-keras) API...")
    k2_model = build_keras2_model(num_classes)
    
    print("[Exporter] Transferring trained weights from Keras 3 model to Keras 2 model in-memory...")
    weights = k3_model.get_weights()
    k2_model.set_weights(weights)
    print("[Exporter] Weight transfer complete!")
    
    print(f"[Exporter] Converting Keras 2 model to TFJS format and saving to {tfjs_out_dir}...")
    if tfjs_out_dir.exists():
        print("[Exporter] Cleaning existing TFJS directory...")
        shutil.rmtree(tfjs_out_dir)
        
    tfjs.converters.save_keras_model(k2_model, str(tfjs_out_dir))
    print("[Exporter] TFJS conversion complete!")
    
    # Simple validation check
    json_path = tfjs_out_dir / "model.json"
    if json_path.exists():
        print(f"[Exporter] Validation PASSED: {json_path} was created successfully!")
        
        # Check if model.json can be parsed and check its contents
        with open(json_path, "r") as f:
            model_config = f.read()
            if "MultiHeadAttention" in model_config:
                print("[Exporter] Validation SUCCESS: MultiHeadAttention layers are present in TFJS config.")
    else:
        print("[Exporter] Validation FAILED: model.json was not created.")
        sys.exit(1)

if __name__ == "__main__":
    main()
