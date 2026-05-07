#!/usr/bin/env python3
"""
LexiSight — Advanced 3-Tier Evaluation Pipeline
================================================
Tier 1 — Seen-User (SeenSplit):     same signer-disjoint split used in training
Tier 2 — Unseen-User (UnseenSplit): completely held-out signer groups
Tier 3 — Wild Test (RealWorld):     different devices, lighting, backgrounds

Metrics per tier:
  - Top-1 / Top-3 / Top-5 accuracy
  - Per-class precision, recall, F1
  - Confusion matrix
  - Confidence distribution
  - Entropy / margin statistics
  - Per-class calibration error (ECE)

Usage:
  python ml/scripts/eval_advanced.py \\
      --checkpoint training_logs/holistic_v2_best.keras \\
      --manifest ml/data_processed/manifest_holistic_include.csv \\
      --output training_logs/eval_3tier_report.json
"""

import argparse
import json
import time
import numpy as np
import pandas as pd
import tensorflow as tf
import yaml
from pathlib import Path
from collections import defaultdict

from sklearn.metrics import (
    accuracy_score, confusion_matrix, classification_report,
    precision_recall_fscore_support, top_k_accuracy_score
)
from sklearn.model_selection import StratifiedGroupKFold, train_test_split

BASE_DIR = Path(__file__).parent.parent.parent
ML_DIR = BASE_DIR / "ml"
SEQ_LEN = 30
HOLISTIC_DIM = 225

import sys
sys.path.insert(0, str(BASE_DIR))
from ml.scripts.inference_utils import (
    compute_entropy, compute_margin,
    calibrated_softmax, process_prediction
)
from ml.models.temporal_v1 import PositionalEncoding, TransformerEncoderBlock


class FocalCategoricalCrossentropy(tf.keras.losses.Loss):
    def __init__(self, gamma=1.5, label_smoothing=0.05, **kwargs):
        super().__init__(**kwargs)
        self.gamma = gamma
        self.label_smoothing = label_smoothing

    def call(self, y_true, y_pred):
        n_classes = tf.cast(tf.shape(y_true)[-1], tf.float32)
        y_true = y_true * (1.0 - self.label_smoothing) + self.label_smoothing / n_classes
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)
        ce = -y_true * tf.math.log(y_pred)
        weight = tf.pow(1.0 - y_pred, self.gamma)
        return tf.reduce_sum(weight * ce, axis=-1)


def set_seed(seed):
    import random
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)


def make_sgkf_split(df, n_splits, seed):
    """Signer-disjoint stratified K-fold."""
    sgkf = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    splits = list(sgkf.split(df, df["class_id"], df["signer_id"]))
    return splits


def load_tensor_batch(df):
    x = np.zeros((len(df), SEQ_LEN, HOLISTIC_DIM), dtype=np.float32)
    y = df["class_id"].to_numpy(dtype=np.int32)
    for i, (_, row) in enumerate(df.iterrows()):
        arr = np.load(ML_DIR / "data_processed" / row["clip_path"]).astype(np.float32)
        x[i] = arr.reshape(SEQ_LEN, HOLISTIC_DIM)
    return x, y


def predict_with_temperature(model, x, temperature=1.0, batch_size=32):
    probs_list = []
    for i in range(0, len(x), batch_size):
        batch = x[i:i+batch_size]
        logits = model.predict(batch, verbose=0)
        if temperature != 1.0:
            logits = logits / temperature
            logits -= logits.max(axis=-1, keepdims=True)
            exp_logits = np.exp(logits - logits.max(axis=-1, keepdims=True))
            probs = exp_logits / exp_logits.sum(axis=-1, keepdims=True)
        else:
            probs = logits
        probs_list.append(probs)
    return np.concatenate(probs_list, axis=0)


def ece_score(y_true, y_pred, confidences, n_bins=15):
    """
    Expected Calibration Error.
    Measures: for each bin of confidence, how close is accuracy to confidence?
    Lower is better.
    """
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    total = len(y_true)

    for i in range(n_bins):
        in_bin = (confidences > bin_boundaries[i]) & (confidences <= bin_boundaries[i+1])
        if in_bin.sum() == 0:
            continue
        accuracy_in_bin = (y_true[in_bin] == y_pred[in_bin]).mean()
        avg_conf_in_bin = confidences[in_bin].mean()
        ece += (in_bin.sum() / total) * abs(accuracy_in_bin - avg_conf_in_bin)

    return float(ece)


def tier_report(name, y_true, probs, labels, temperature=1.0):
    """Generate full metrics for one tier."""
    if temperature != 1.0:
        calibrated_probs = calibrated_softmax(probs, temperature)
    else:
        calibrated_probs = probs

    y_pred = calibrated_probs.argmax(axis=1)
    confidences = calibrated_probs.max(axis=1)

    top1_acc = accuracy_score(y_true, y_pred)
    top3_acc = top_k_accuracy_score(y_true, calibrated_probs, k=3, labels=range(len(labels)))
    top5_acc = top_k_accuracy_score(y_true, calibrated_probs, k=5, labels=range(len(labels)))

    prec, rec, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=range(len(labels)), average=None, zero_division=0
    )
    macro_f1 = precision_recall_fscore_support(
        y_true, y_pred, average="macro", zero_division=0
    )[2]
    weighted_f1 = precision_recall_fscore_support(
        y_true, y_pred, average="weighted", zero_division=0
    )[2]

    ece = ece_score(y_true, y_pred, confidences)

    entropies = np.array([compute_entropy(p) for p in calibrated_probs])
    margins = np.array([compute_margin(p) for p in calibrated_probs])

    correct_mask = y_true == y_pred
    conf_correct = confidences[correct_mask]
    conf_wrong = confidences[~correct_mask]
    margin_correct = margins[correct_mask]
    margin_wrong = margins[~correct_mask]

    cm = confusion_matrix(y_true, y_pred, labels=range(len(labels)))

    per_class = {}
    for i, label in enumerate(labels):
        support = int((y_true == i).sum())
        correct = int(((y_true == i) & (y_pred == i)).sum())
        acc = correct / support if support > 0 else 0.0
        per_class[label] = {
            "support": support,
            "correct": correct,
            "accuracy": round(acc, 4),
            "precision": round(float(prec[i]), 4),
            "recall": round(float(rec[i]), 4),
            "f1": round(float(f1[i]), 4),
            "avg_confidence": round(float(confidences[y_true == i].mean()), 4) if support > 0 else None,
        }

    below_85 = [label for label in labels
                if per_class[label]["support"] > 0 and per_class[label]["accuracy"] < 0.85]

    return {
        "tier": name,
        "n_samples": int(len(y_true)),
        "n_classes": len(labels),
        "top1_accuracy": round(float(top1_acc), 4),
        "top3_accuracy": round(float(top3_acc), 4),
        "top5_accuracy": round(float(top5_acc), 4),
        "macro_f1": round(float(macro_f1), 4),
        "weighted_f1": round(float(weighted_f1), 4),
        "ece": round(float(ece), 4),
        "confidence": {
            "mean": round(float(confidences.mean()), 4),
            "correct_mean": round(float(conf_correct.mean()), 4) if len(conf_correct) > 0 else None,
            "wrong_mean": round(float(conf_wrong.mean()), 4) if len(conf_wrong) > 0 else None,
            "min": round(float(confidences.min()), 4),
            "max": round(float(confidences.max()), 4),
        },
        "margin": {
            "mean": round(float(margins.mean()), 4),
            "correct_mean": round(float(margin_correct.mean()), 4) if len(margin_correct) > 0 else None,
            "wrong_mean": round(float(margin_wrong.mean()), 4) if len(margin_wrong) > 0 else None,
        },
        "entropy": {
            "mean": round(float(entropies.mean()), 4),
            "correct_mean": round(float(entropies[correct_mask].mean()), 4) if correct_mask.sum() > 0 else None,
            "wrong_mean": round(float(entropies[~correct_mask].mean()), 4) if (~correct_mask).sum() > 0 else None,
        },
        "classes_below_85": below_85,
        "per_class": per_class,
    }


def build_tiers(df, labels, class_to_id, seed=42):
    """
    Build three evaluation tiers from a single manifest.
    Tier 1 (Seen): standard signer-disjoint split, same as training
    Tier 2 (Unseen): stricter — leave one signer group out completely
    Tier 3 (Wild):  wild_test directory if it exists
    """
    df = df.copy()
    df["class_id"] = df["class"].map(class_to_id)

    tiers = {}

    if df["signer_id"].nunique() <= 1:
        train_idx, val_idx = train_test_split(
            df.index.tolist(), test_size=0.3, stratify=df["class_id"], random_state=seed
        )
        tier1_df = df.iloc[val_idx].copy()
    else:
        sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=seed)
        train_idx, val_idx = next(sgkf.split(df, df["class_id"], df["signer_id"]))
        tier1_df = df.iloc[val_idx].copy()

    tiers["seen"] = tier1_df

    signer_groups = df["signer_id"].unique()
    if len(signer_groups) >= 3:
        np.random.seed(seed)
        np.random.shuffle(signer_groups)
        n_holdout = max(1, len(signer_groups) // 4)
        unseen_signers = set(signer_groups[:n_holdout])
        tiers["unseen"] = df[df["signer_id"].isin(unseen_signers)].copy()
        print(f"  [Unseen tier] Held out {n_holdout} signers: {unseen_signers}")
    else:
        tiers["unseen"] = pd.DataFrame(columns=df.columns)

    wild_dir = BASE_DIR / "ml" / "data_processed" / "wild_test"
    if wild_dir.exists():
        rows = []
        for cls_dir in sorted(wild_dir.iterdir()):
            if not cls_dir.is_dir():
                continue
            cls = cls_dir.name
            if cls not in class_to_id:
                continue
            for npy in cls_dir.glob("*.npy"):
                rows.append({
                    "clip_path": str(npy.relative_to(BASE_DIR / "ml" / "data_processed")),
                    "class": cls,
                    "class_id": class_to_id[cls],
                    "signer_id": f"wild_{npy.stem}",
                })
        if rows:
            tiers["wild"] = pd.DataFrame(rows)
            print(f"  [Wild tier] {len(rows)} clips across {len(tiers['wild']['class'].unique())} classes")
    else:
        print(f"  [Wild tier] No wild test directory found at {wild_dir}")

    return tiers


def main():
    parser = argparse.ArgumentParser(description="LexiSight 3-tier evaluation")
    parser.add_argument("--checkpoint", default="training_logs/holistic_v2_best.keras")
    parser.add_argument("--manifest", default="ml/data_processed/manifest_holistic_include.csv")
    parser.add_argument("--temperature", type=float, default=1.0,
                        help="Temperature for calibration (1.0 = no calibration)")
    parser.add_argument("--output", default="training_logs/eval_3tier_report.json")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--config", default="ml/configs/train_holistic_v2.yaml")
    args = parser.parse_args()

    set_seed(args.seed)

    config_path = BASE_DIR / args.config
    if config_path.exists():
        with open(config_path, encoding="utf-8") as f:
            config = yaml.safe_load(f)
        min_samples = int(config["data"].get("min_samples_per_class", 5))
    else:
        min_samples = 5

    manifest_path = BASE_DIR / args.manifest
    if not manifest_path.exists():
        print(f"Manifest not found: {manifest_path}")
        return

    df = pd.read_csv(manifest_path)
    class_counts = df["class"].value_counts()
    valid_classes = class_counts[class_counts >= min_samples].index.tolist()
    df = df[df["class"].isin(valid_classes)].copy()

    labels = sorted(df["class"].unique())
    class_to_id = {c: i for i, c in enumerate(labels)}
    id_to_class = {str(i): c for c, i in class_to_id.items()}

    print(f"Manifest: {len(df)} clips, {len(labels)} classes, {df['signer_id'].nunique()} signers")

    print("Loading model...")
    model = tf.keras.models.load_model(
        BASE_DIR / args.checkpoint,
        custom_objects={
            "FocalCategoricalCrossentropy": FocalCategoricalCrossentropy,
            "PositionalEncoding": PositionalEncoding,
            "TransformerEncoderBlock": TransformerEncoderBlock,
        },
        compile=False,
    )
    print("Model loaded.")

    print("Building evaluation tiers...")
    tiers = build_tiers(df, labels, class_to_id, args.seed)

    results = {
        "checkpoint": str(args.checkpoint),
        "temperature": args.temperature,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tiers": {},
    }

    for tier_name, tier_df in tiers.items():
        if len(tier_df) == 0:
            print(f"  Skipping tier '{tier_name}' — no data")
            continue

        print(f"\n  Evaluating tier '{tier_name}' ({len(tier_df)} samples)...")
        x, y = load_tensor_batch(tier_df)
        probs = predict_with_temperature(model, x, temperature=args.temperature)

        tier_result = tier_report(
            name=tier_name,
            y_true=y,
            probs=probs,
            labels=labels,
            temperature=args.temperature,
        )

        results["tiers"][tier_name] = tier_result

        print(f"    Top-1: {tier_result['top1_accuracy']:.2%} | "
              f"Top-3: {tier_result['top3_accuracy']:.2%} | "
              f"Macro-F1: {tier_result['macro_f1']:.4f} | "
              f"ECE: {tier_result['ece']:.4f}")

        if tier_result["classes_below_85"]:
            print(f"    Below 85%: {tier_result['classes_below_85'][:8]}")

    output_path = BASE_DIR / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=str)

    print(f"\nSaved: {output_path}")


if __name__ == "__main__":
    main()
