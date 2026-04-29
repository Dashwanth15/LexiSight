#!/usr/bin/env python3
"""
LexiSight Temporal Landmark Transformer — v1.0
═══════════════════════════════════════════════
A lightweight Transformer encoder that classifies ISL signs from
30-frame landmark sequences (1 second of video).

Input:  (batch, 30, 126) — 30 frames × (21 landmarks × 3 coords × 2 hands)
Output: (batch, n_classes) — softmax probabilities

Architecture:
  Frame-wise Linear → Positional Embedding → Transformer Encoder ×2
  → Mean Pool → Dense(64) → Softmax

Total params: ~250K | TFJS export: ~1.5 MB float16
"""

import tensorflow as tf
from tensorflow.keras import layers, Model
import numpy as np


class PositionalEncoding(layers.Layer):
    """Learned positional embedding for sequence positions."""

    def __init__(self, max_len, d_model, **kwargs):
        super().__init__(**kwargs)
        self.max_len = max_len
        self.d_model = d_model

    def build(self, input_shape):
        self.pos_embedding = self.add_weight(
            name="pos_embedding",
            shape=(1, self.max_len, self.d_model),
            initializer="glorot_uniform",
            trainable=True,
        )
        super().build(input_shape)

    def call(self, x):
        seq_len = tf.shape(x)[1]
        return x + self.pos_embedding[:, :seq_len, :]

    def get_config(self):
        config = super().get_config()
        config.update({"max_len": self.max_len, "d_model": self.d_model})
        return config


class TransformerEncoderBlock(layers.Layer):
    """Single Transformer encoder block with pre-norm architecture."""

    def __init__(self, d_model, num_heads, d_ff, dropout=0.1, **kwargs):
        super().__init__(**kwargs)
        self.d_model = d_model
        self.num_heads = num_heads
        self.d_ff = d_ff
        self.dropout_rate = dropout

        self.attn = layers.MultiHeadAttention(
            num_heads=num_heads, key_dim=d_model // num_heads, dropout=dropout
        )
        self.ffn = tf.keras.Sequential([
            layers.Dense(d_ff, activation="gelu"),
            layers.Dropout(dropout),
            layers.Dense(d_model),
            layers.Dropout(dropout),
        ])
        self.norm1 = layers.LayerNormalization(epsilon=1e-6)
        self.norm2 = layers.LayerNormalization(epsilon=1e-6)
        self.dropout1 = layers.Dropout(dropout)

    def call(self, x, training=False, mask=None):
        # Pre-norm: normalize → attend → residual
        x_norm = self.norm1(x)
        attn_output = self.attn(x_norm, x_norm, attention_mask=mask, training=training)
        attn_output = self.dropout1(attn_output, training=training)
        x = x + attn_output

        # FFN with residual
        x_norm = self.norm2(x)
        ffn_output = self.ffn(x_norm, training=training)
        x = x + ffn_output
        return x

    def get_config(self):
        config = super().get_config()
        config.update({
            "d_model": self.d_model,
            "num_heads": self.num_heads,
            "d_ff": self.d_ff,
            "dropout": self.dropout_rate,
        })
        return config


def build_temporal_model(
    n_classes: int,
    seq_len: int = 30,
    input_dim: int = 126,
    d_model: int = 128,
    num_layers: int = 2,
    num_heads: int = 4,
    d_ff: int = 256,
    dropout: float = 0.2,
    classifier_hidden: int = 64,
) -> Model:
    """
    Build the Temporal Landmark Transformer.

    Args:
        n_classes: Number of output classes
        seq_len: Number of frames in input sequence (default: 30)
        input_dim: Features per frame (default: 126 = 21×3×2 hands)
        d_model: Transformer hidden dimension
        num_layers: Number of Transformer encoder layers
        num_heads: Number of attention heads
        d_ff: Feed-forward hidden dimension
        dropout: Dropout rate
        classifier_hidden: Classifier MLP hidden size

    Returns:
        Compiled Keras Model
    """
    # Input: (batch, seq_len, input_dim)
    inp = layers.Input(shape=(seq_len, input_dim), name="landmark_sequence")

    # Frame-wise linear projection to d_model
    x = layers.Dense(d_model, name="frame_projection")(inp)
    x = layers.Dropout(dropout)(x)

    # Add learned positional encoding
    x = PositionalEncoding(max_len=seq_len, d_model=d_model, name="pos_encoding")(x)

    # Transformer encoder stack
    for i in range(num_layers):
        x = TransformerEncoderBlock(
            d_model=d_model,
            num_heads=num_heads,
            d_ff=d_ff,
            dropout=dropout,
            name=f"transformer_block_{i}",
        )(x)

    # Final layer norm
    x = layers.LayerNormalization(epsilon=1e-6, name="final_norm")(x)

    # Mean pool across time dimension → (batch, d_model)
    x = layers.GlobalAveragePooling1D(name="temporal_pool")(x)

    # Classifier head
    x = layers.Dense(classifier_hidden, activation="relu", name="classifier_hidden")(x)
    x = layers.Dropout(dropout / 2)(x)
    out = layers.Dense(n_classes, activation="softmax", name="gesture_output")(x)

    model = Model(inputs=inp, outputs=out, name="TemporalLandmarkTransformer_v1")

    # Compile with label smoothing
    model.compile(
        optimizer=tf.keras.optimizers.AdamW(
            learning_rate=1e-3, weight_decay=0.01
        ),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
        metrics=[
            "accuracy",
            tf.keras.metrics.TopKCategoricalAccuracy(k=3, name="top3_acc"),
            tf.keras.metrics.TopKCategoricalAccuracy(k=5, name="top5_acc"),
        ],
    )
    return model


def model_summary(n_classes=250):
    """Print model summary for verification."""
    model = build_temporal_model(n_classes=n_classes)
    model.summary()
    
    # Calculate TFJS export size estimate
    total_params = model.count_params()
    float16_mb = (total_params * 2) / (1024 * 1024)
    print(f"\nEstimated TFJS size (float16): {float16_mb:.2f} MB")
    print(f"Total parameters: {total_params:,}")
    return model


if __name__ == "__main__":
    model_summary(n_classes=250)
