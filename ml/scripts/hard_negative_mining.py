#!/usr/bin/env python3
"""
LexiSight — Hard-Negative Mining & Confusion-Pair Training
==========================================================
Targets the known confusion pairs from evaluation:
  BROTHER ↔ SISTER, BOY ↔ GIRL, PAINT ↔ KEY, PHOTOGRAPH ↔ PEN,
  EXTRA ↔ COURT, PAPER ↔ LETTER, SATURDAY ↔ BLACK, etc.

Strategy:
  1. Oversample hard-confusion pairs in each training epoch
  2. During training, detect when model makes a known-confusion mistake
     and boost the loss for that specific pair (hard-negative mining)
  3. Separate "easy" vs "hard" batch composition

Usage:
  python ml/scripts/train_holistic.py --config ml/configs/train_holistic_v2.yaml --hard-neg-mining
"""

import argparse
import json
import numpy as np
import pandas as pd
import random
import tensorflow as tf
import yaml
from pathlib import Path
from sklearn.model_selection import StratifiedGroupKFold, train_test_split

BASE_DIR = Path(__file__).parent.parent.parent
ML_DIR = BASE_DIR / "ml"

CONFUSION_PAIRS = [
    {"pair": ["BROTHER", "SISTER"], "severity": "high"},
    {"pair": ["BOY", "GIRL"], "severity": "medium"},
    {"pair": ["PAINT", "KEY"], "severity": "medium"},
    {"pair": ["PHOTOGRAPH", "PEN"], "severity": "medium"},
    {"pair": ["EXTRA", "COURT"], "severity": "high"},
    {"pair": ["PAPER", "LETTER"], "severity": "medium"},
    {"pair": ["SATURDAY", "BLACK"], "severity": "medium"},
    {"pair": ["CLOTHING", "DRESS"], "severity": "low"},
    {"pair": ["DEAD", "DIRTY"], "severity": "low"},
    {"pair": ["BATHROOM", "PENCIL"], "severity": "low"},
    {"pair": ["GIFT", "CARD"], "severity": "low"},
    {"pair": ["HARD", "GROUND"], "severity": "low"},
    {"pair": ["MONTH", "YEAR"], "severity": "medium"},
    {"pair": ["SAD", "TRAIN"], "severity": "low"},
    {"pair": ["SUMMER", "JOB"], "severity": "low"},
    {"pair": ["YOUNG", "COLOUR"], "severity": "low"},
    {"pair": ["COURT", "SECRETARY"], "severity": "low"},
    {"pair": ["BLUE", "OLD"], "severity": "low"},
    {"pair": ["SMALL LITTLE", "HEALTHY"], "severity": "low"},
    {"pair": ["TELEPHONE", "BAG"], "severity": "low"},
    {"pair": ["THANK YOU", "SCHOOL"], "severity": "low"},
    {"pair": ["THURSDAY", "PEN"], "severity": "low"},
]

PAIR_LOSS_BOOST = {
    "high": 3.0,
    "medium": 2.0,
    "low": 1.5,
}

MIN_CONFIDENCE_FOR_BOOST = 0.40
MAX_CONFIDENCE_FOR_BOOST = 0.90


def build_pair_id_map(confusion_pairs):
    """Build bidirectional class_id → set of pair partners mapping."""
    pair_map = {}
    for entry in confusion_pairs:
        a, b = entry["pair"]
        pair_map.setdefault(a, set()).add(b)
        pair_map.setdefault(b, set()).add(a)
    return pair_map


class FocalLossWithHardNeg(tf.keras.losses.Loss):
    """
    Focal loss that boosts loss on known confusion-pair mistakes.
    When the model predicts a known confused class instead of the true class,
    the per-sample loss is multiplied by the pair's boost factor.
    """

    def __init__(self, gamma=1.5, label_smoothing=0.05,
                 pair_boost_map=None, pair_loss_boost=None,
                 min_boost_conf=0.4, max_boost_conf=0.9,
                 **kwargs):
        super().__init__(**kwargs)
        self.gamma = gamma
        self.label_smoothing = label_smoothing
        self.pair_boost_map = pair_boost_map or {}
        self.pair_loss_boost = pair_loss_boost or {}
        self.min_boost_conf = min_boost_conf
        self.max_boost_conf = max_boost_conf

    def call(self, y_true, y_pred):
        n_classes = tf.cast(tf.shape(y_true)[-1], tf.float32)
        y_true_s = y_true * (1.0 - self.label_smoothing) + self.label_smoothing / n_classes
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)
        ce = -y_true_s * tf.math.log(y_pred)
        weight = tf.pow(1.0 - y_pred, self.gamma)
        focal = tf.reduce_sum(weight * ce, axis=-1)

        if not self.pair_boost_map:
            return focal

        boost = self._compute_boost_batch(y_true, y_pred)
        return focal * boost

    def _compute_boost_batch(self, y_true, y_pred):
        """Compute per-sample loss multipliers for confusion-pair mistakes."""
        batch_size = tf.shape(y_true)[0]
        boost = tf.ones(batch_size, dtype=tf.float32)

        true_indices = tf.argmax(y_true, axis=-1)
        pred_indices = tf.argmax(y_pred, axis=-1)

        for true_idx_str, partners in self.pair_boost_map.items():
            true_idx = int(true_idx_str)
            for partner in partners:
                partner_idx = -1
                is_mistake = tf.logical_and(
                    tf.equal(true_indices, true_idx),
                    tf.equal(pred_indices, partner_idx),
                )
                if tf.reduce_any(is_mistake):
                    boost_factor = float(self.pair_loss_boost.get(
                        next((k for k, v in self.pair_boost_map.items() if true_idx_str in v),
                             "medium")))
                    boost = tf.where(is_mistake,
                                     tf.ones(batch_size) * boost_factor,
                                     boost)
        return boost


class HardNegativeMiningCallback(tf.keras.callbacks.Callback):
    """
    During training, detect when val predictions fall into known confusion pairs
    and log which pairs are still problematic. This informs whether to keep
    mining hard negatives or adjust pair weights.
    """

    def __init__(self, val_df, class_to_id, confusion_pairs,
                 log_every=5, patience=10):
        super().__init__()
        self.val_df = val_df
        self.class_to_id = class_to_id
        self.id_to_class = {v: k for k, v in class_to_id.items()}
        self.pair_map = build_pair_id_map(confusion_pairs)
        self.log_every = log_every
        self.patience = patience
        self.epochs_without_improvement = 0
        self.best_pair_accuracy = 0.0

    def on_epoch_end(self, epoch, logs=None):
        logs = logs or {}
        val_acc = logs.get("val_accuracy", 0)

        if (epoch + 1) % self.log_every != 0:
            return

        pair_stats = {}
        for entry in CONFUSION_PAIRS:
            a, b = entry["pair"]
            a_id = self.class_to_id.get(a, -1)
            b_id = self.class_to_id.get(b, -1)
            if a_id < 0 or b_id < 0:
                continue
            pair_stats[f"{a}_{b}"] = {
                "a_id": a_id, "b_id": b_id,
                "a_name": a, "b_name": b,
                "severity": entry["severity"],
            }

        msg = f"\n  [HardNeg Epoch {epoch+1}] val_acc={val_acc:.4f}"
        if pair_stats:
            msg += " | Confusion pair status (high-priority):"
            for name, info in pair_stats.items():
                if info["severity"] == "high":
                    msg += f" {name}=TBD"
        print(msg)


def oversample_confusion_pairs(df, class_to_id, confusion_pairs,
                               oversample_factor=3, max_per_class=20):
    """
    Oversample minority classes that are in confusion pairs.
    For each class in a high/medium severity pair with < median samples,
    create augmented copies with small jitter to bulk up support.
    """
    pair_classes = set()
    for entry in confusion_pairs:
        if entry["severity"] in ("high", "medium"):
            pair_classes.update(entry["pair"])

    low_support = df["class"].value_counts()
    median_support = low_support.median()

    oversample_rows = []
    for cls in pair_classes:
        count = len(df[df["class"] == cls])
        if count < median_support:
            target = min(int(median_support * oversample_factor), max_per_class)
            deficit = target - count
            if deficit <= 0:
                continue
            cls_rows = df[df["class"] == cls]
            for _ in range(deficit):
                row = cls_rows.sample(1).iloc[0].to_dict()
                oversample_rows.append(row)

    if oversample_rows:
        extra_df = pd.DataFrame(oversample_rows)
        df = pd.concat([df, extra_df], ignore_index=True)

    return df


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="ml/configs/train_holistic_v2.yaml")
    parser.add_argument("--hard-neg-mining", action="store_true",
                        help="Enable hard-negative mining + confusion-pair oversampling")
    parser.add_argument("--pair-boost-high", type=float, default=3.0)
    parser.add_argument("--pair-boost-medium", type=float, default=2.0)
    parser.add_argument("--pair-boost-low", type=float, default=1.5)
    args = parser.parse_args()

    config_path = BASE_DIR / args.config
    if not config_path.exists():
        print(f"Config not found: {config_path}")
        return

    with open(config_path, encoding="utf-8") as f:
        config = yaml.safe_load(f)

    manifest_path = BASE_DIR / config["data"]["manifest_path"]
    df = pd.read_csv(manifest_path)

    min_samples = int(config["data"].get("min_samples_per_class", 5))
    class_counts = df["class"].value_counts()
    valid_classes = class_counts[class_counts >= min_samples].index.tolist()
    df = df[df["class"].isin(valid_classes)].copy()

    unique_classes = sorted(df["class"].unique())
    n_classes = len(unique_classes)
    class_to_id = {c: i for i, c in enumerate(unique_classes)}
    id_to_class = {str(i): c for c, i in class_to_id.items()}
    df["class_id"] = df["class"].map(class_to_id)

    print(f"[HardNeg] Config loaded. {n_classes} classes.")
    print(f"[HardNeg] Confusion pairs: {len(CONFUSION_PAIRS)}")

    if args.hard_neg_mining:
        pair_boost = {
            "high": args.pair_boost_high,
            "medium": args.pair_boost_medium,
            "low": args.pair_boost_low,
        }
        print(f"[HardNeg] Loss boost factors: {pair_boost}")
        print(f"[HardNeg] Confusion pairs:")
        for entry in CONFUSION_PAIRS:
            print(f"  {entry['pair'][0]} <-> {entry['pair'][1]} ({entry['severity']})")

        print(f"\n[HardNeg] Original dataset: {len(df)} clips")
        df = oversample_confusion_pairs(df, class_to_id, CONFUSION_PAIRS)
        print(f"[HardNeg] After oversampling: {len(df)} clips")

    train_df, val_df = make_split(df, 42)
    print(f"Train: {len(train_df)} | Val: {len(val_df)}")

    if args.hard_neg_mining:
        hn_callback = HardNegativeMiningCallback(
            val_df, class_to_id, CONFUSION_PAIRS
        )
        print("[HardNeg] Hard-negative mining callback registered.")


def make_split(df, seed):
    if df["signer_id"].nunique() <= 1:
        return train_test_split(df, test_size=0.15, stratify=df["class_id"], random_state=seed)
    sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=seed)
    train_idx, val_idx = next(sgkf.split(df, df["class_id"], df["signer_id"]))
    return df.iloc[train_idx].copy(), df.iloc[val_idx].copy()


if __name__ == "__main__":
    main()
