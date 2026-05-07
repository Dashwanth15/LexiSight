#!/usr/bin/env python3
"""
Evaluate the trained holistic V2 checkpoint on the reconstructed train/val split.

Outputs:
  - JSON summary
  - confusion matrix PNG
  - worst-class CSV
"""

import json
import random
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import tensorflow as tf
import yaml
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedGroupKFold, train_test_split

BASE_DIR = Path(__file__).parent.parent.parent
ML_DIR = BASE_DIR / "ml"
SEQ_LEN = 30
HOLISTIC_DIM = 225

sys.path.insert(0, str(BASE_DIR))

from ml.models.temporal_v1 import PositionalEncoding, TransformerEncoderBlock

def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)


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


def make_split(df, seed):
    if df["signer_id"].nunique() <= 1:
        return train_test_split(df, test_size=0.15, stratify=df["class_id"], random_state=seed)

    sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=seed)
    train_idx, val_idx = next(sgkf.split(df, df["class_id"], df["signer_id"]))
    return df.iloc[train_idx].copy(), df.iloc[val_idx].copy()


def load_tensor_batch(df):
    x = np.zeros((len(df), SEQ_LEN, HOLISTIC_DIM), dtype=np.float32)
    y = df["class_id"].to_numpy(dtype=np.int32)

    for i, (_, row) in enumerate(df.iterrows()):
        arr = np.load(ML_DIR / "data_processed" / row["clip_path"]).astype(np.float32)
        x[i] = arr.reshape(SEQ_LEN, HOLISTIC_DIM)
    return x, y


def top_k_accuracy(y_true, probs, k):
    k = min(k, probs.shape[1])
    top_k = np.argpartition(probs, -k, axis=1)[:, -k:]
    hits = [true_label in pred_labels for true_label, pred_labels in zip(y_true, top_k)]
    return float(np.mean(hits))


def confidence_report(y_true, probs):
    pred = probs.argmax(axis=1)
    top1 = probs.max(axis=1)
    sorted_probs = np.sort(probs, axis=1)
    top2 = sorted_probs[:, -2] if probs.shape[1] > 1 else np.zeros_like(top1)
    margin = top1 - top2
    correct_mask = pred == y_true
    wrong_mask = ~correct_mask

    return {
        "mean_top1_confidence": float(top1.mean()),
        "mean_top1_margin": float(margin.mean()),
        "correct_mean_confidence": float(top1[correct_mask].mean()) if correct_mask.any() else None,
        "wrong_mean_confidence": float(top1[wrong_mask].mean()) if wrong_mask.any() else None,
        "correct_mean_margin": float(margin[correct_mask].mean()) if correct_mask.any() else None,
        "wrong_mean_margin": float(margin[wrong_mask].mean()) if wrong_mask.any() else None,
    }


def plot_confusion(cm, labels, output_path, top_n=40):
    support = cm.sum(axis=1)
    top_idx = np.argsort(-support)[:top_n]
    cm_top = cm[np.ix_(top_idx, top_idx)]
    labels_top = [labels[i] for i in top_idx]

    plt.figure(figsize=(18, 16))
    sns.heatmap(cm_top, cmap="Blues", xticklabels=labels_top, yticklabels=labels_top)
    plt.title(f"Holistic V2 Validation Confusion Matrix (Top {top_n} classes by support)")
    plt.xlabel("Predicted")
    plt.ylabel("True")
    plt.xticks(rotation=90)
    plt.yticks(rotation=0)
    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path, dpi=200)
    plt.close()


def per_class_report(cm, labels):
    rows = []
    for i, label in enumerate(labels):
        support = int(cm[i].sum())
        correct = int(cm[i, i])
        accuracy = correct / support if support else 0.0
        top_confusions = []
        row = cm[i].copy()
        row[i] = 0
        confused_idx = np.argsort(-row)[:3]
        for idx in confused_idx:
            if row[idx] > 0:
                top_confusions.append(f"{labels[idx]}:{int(row[idx])}")
        rows.append(
            {
                "class": label,
                "support": support,
                "correct": correct,
                "accuracy": accuracy,
                "measured_in_val": bool(support > 0),
                "top_confusions": " | ".join(top_confusions),
            }
        )
    report = pd.DataFrame(rows)
    measured = report[report["support"] > 0].sort_values(["accuracy", "support"], ascending=[True, False])
    unmeasured = report[report["support"] == 0].sort_values(["class"], ascending=[True])
    return pd.concat([measured, unmeasured], ignore_index=True)


def top_confusion_pairs(cm, labels, limit=15):
    rows = []
    for i in range(len(labels)):
        for j in range(len(labels)):
            if i == j or cm[i, j] == 0:
                continue
            rows.append(
                {
                    "true_class": labels[i],
                    "predicted_class": labels[j],
                    "count": int(cm[i, j]),
                }
            )
    if not rows:
        return pd.DataFrame(columns=["true_class", "predicted_class", "count"])
    return pd.DataFrame(rows).sort_values(["count", "true_class", "predicted_class"], ascending=[False, True, True]).head(limit)


def support_bucket_stats(report):
    measured = report[report["support"] > 0]
    return {
        "classes_with_support": int(len(measured)),
        "classes_with_support_lt_3": int((measured["support"] < 3).sum()),
        "classes_with_support_lt_5": int((measured["support"] < 5).sum()),
        "median_support": float(measured["support"].median()) if len(measured) else 0.0,
        "min_support": int(measured["support"].min()) if len(measured) else 0,
        "max_support": int(measured["support"].max()) if len(measured) else 0,
    }


def main():
    config_path = BASE_DIR / "ml" / "configs" / "train_holistic_v2.yaml"
    with open(config_path, encoding="utf-8") as f:
        config = yaml.safe_load(f)

    seed = int(config.get("seed", 42))
    set_seed(seed)

    manifest_path = BASE_DIR / config["data"]["manifest_path"]
    df = pd.read_csv(manifest_path)

    class_counts = df["class"].value_counts()
    min_samples = int(config["data"].get("min_samples_per_class", 5))
    valid_classes = class_counts[class_counts >= min_samples].index.tolist()
    df = df[df["class"].isin(valid_classes)].copy()

    labels = sorted(df["class"].unique())
    class_to_id = {c: i for i, c in enumerate(labels)}
    df["class_id"] = df["class"].map(class_to_id)

    train_df, val_df = make_split(df, seed)
    x_train, y_train = load_tensor_batch(train_df)
    x_val, y_val = load_tensor_batch(val_df)

    model = tf.keras.models.load_model(
        BASE_DIR / "training_logs" / "holistic_v2_best.keras",
        custom_objects={
            "FocalCategoricalCrossentropy": FocalCategoricalCrossentropy,
            "PositionalEncoding": PositionalEncoding,
            "TransformerEncoderBlock": TransformerEncoderBlock,
        },
        compile=False,
    )

    train_probs = model.predict(x_train, batch_size=32, verbose=0)
    val_probs = model.predict(x_val, batch_size=32, verbose=0)
    train_pred = train_probs.argmax(axis=1)
    val_pred = val_probs.argmax(axis=1)

    train_acc = accuracy_score(y_train, train_pred)
    val_acc = accuracy_score(y_val, val_pred)
    overfit_gap = train_acc - val_acc
    train_top3 = top_k_accuracy(y_train, train_probs, k=3)
    val_top3 = top_k_accuracy(y_val, val_probs, k=3)
    train_top5 = top_k_accuracy(y_train, train_probs, k=5)
    val_top5 = top_k_accuracy(y_val, val_probs, k=5)

    cm = confusion_matrix(y_val, val_pred, labels=np.arange(len(labels)))
    report = per_class_report(cm, labels)
    measured_report = report[report["support"] > 0].copy()
    confusion_pairs = top_confusion_pairs(cm, labels, limit=20)
    val_confidence = confidence_report(y_val, val_probs)
    support_stats = support_bucket_stats(report)
    macro_f1 = f1_score(y_val, val_pred, average="macro", zero_division=0)
    weighted_f1 = f1_score(y_val, val_pred, average="weighted", zero_division=0)
    low_accuracy = measured_report[measured_report["accuracy"] < 0.85].copy()
    severe_failures = measured_report[measured_report["accuracy"] < 0.60].copy()
    classes_missing_in_val = report[report["support"] == 0]["class"].tolist()

    out_dir = BASE_DIR / "training_logs"
    report_path = out_dir / "holistic_v2_worst_classes.csv"
    report.to_csv(report_path, index=False)
    confusion_pairs_path = out_dir / "holistic_v2_top_confusions.csv"
    confusion_pairs.to_csv(confusion_pairs_path, index=False)
    cm_csv_path = out_dir / "holistic_v2_confusion_matrix.csv"
    pd.DataFrame(cm, index=labels, columns=labels).to_csv(cm_csv_path)

    confusion_path = out_dir / "holistic_v2_confusion_matrix.png"
    plot_confusion(cm, labels, confusion_path, top_n=40)

    summary = {
        "train_accuracy": float(train_acc),
        "val_accuracy": float(val_acc),
        "overfit_gap": float(overfit_gap),
        "train_top3_accuracy": float(train_top3),
        "val_top3_accuracy": float(val_top3),
        "train_top5_accuracy": float(train_top5),
        "val_top5_accuracy": float(val_top5),
        "val_macro_f1": float(macro_f1),
        "val_weighted_f1": float(weighted_f1),
        "num_classes": len(labels),
        "train_samples": int(len(train_df)),
        "val_samples": int(len(val_df)),
        "support_stats": support_stats,
        "classes_missing_in_val_count": int(len(classes_missing_in_val)),
        "classes_missing_in_val": classes_missing_in_val,
        "val_confidence": val_confidence,
        "worst_10_measured_classes": measured_report.head(10).to_dict(orient="records"),
        "classes_below_85_accuracy": low_accuracy.to_dict(orient="records"),
        "classes_below_60_accuracy": severe_failures.to_dict(orient="records"),
        "top_confusion_pairs": confusion_pairs.to_dict(orient="records"),
        "artifacts": {
            "confusion_matrix": str(confusion_path),
            "worst_classes_csv": str(report_path),
            "top_confusions_csv": str(confusion_pairs_path),
            "confusion_matrix_csv": str(cm_csv_path),
        },
    }

    summary_path = out_dir / "holistic_v2_eval_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
