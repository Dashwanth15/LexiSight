#!/usr/bin/env python3
"""
LexiSight Inference Utilities
=============================
Post-inference processing for the temporal model:
  - Temperature scaling (calibrated confidence)
  - Entropy-based unknown/open-set detection
  - Margin-based uncertainty detection
  - Prediction state classification

Usage (from any Python script or training script):
  from inference_utils import apply_temperature, compute_entropy,
                               classify_prediction, PredictionState
"""

import numpy as np
from enum import IntEnum
from dataclasses import dataclass
from typing import Optional


class PredictionState(IntEnum):
    CONFIDENT = 2
    UNCERTAIN = 1
    UNKNOWN = 0


@dataclass
class ProcessedPrediction:
    label: str
    confidence: float
    topK: list
    state: PredictionState
    entropy: float
    margin: float
    temperature: float
    rejected: bool


# ── Temperature scaling ──────────────────────────────────────────────────────

def apply_temperature(logits: np.ndarray, temperature: float = 1.0) -> np.ndarray:
    """
    Apply temperature scaling to logits before softmax.
    T > 1 : softens predictions (reduces overconfidence)
    T < 1 : sharpens predictions
    T = 1 : standard softmax
    """
    if temperature <= 0:
        raise ValueError(f"Temperature must be positive, got {temperature}")
    return logits / temperature


def softmax(logits: np.ndarray) -> np.ndarray:
    exps = np.exp(logits - logits.max())
    return exps / exps.sum()


def calibrated_softmax(logits: np.ndarray, temperature: float = 1.0) -> np.ndarray:
    """Temperature-scaled softmax."""
    return softmax(logits / temperature)


# ── Uncertainty metrics ───────────────────────────────────────────────────────

def compute_entropy(probs: np.ndarray, base: float = 2.0) -> float:
    """
    Shannon entropy of a probability distribution.
    Higher entropy = more uncertain.
    Max entropy for C classes = log(C) (uniform distribution).
    Returns value in [0, log(C)].
    """
    probs = np.asarray(probs)
    probs = probs[probs > 1e-12]
    if len(probs) == 0:
        return 0.0
    return -np.sum(probs * np.log(probs) / np.log(base))


def compute_margin(probs: np.ndarray) -> float:
    """
    Margin = P_top1 - P_top2.
    Large margin = confident (top prediction is clear winner).
    Small margin = uncertain (top2 is close behind).
    Returns 0 if only 1 class.
    """
    probs = np.sort(probs)[::-1]
    if len(probs) < 2:
        return 1.0
    return float(probs[0] - probs[1])


def compute_topK_margin(probs: np.ndarray, k: int = 3) -> float:
    """Average gap between consecutive top-K predictions."""
    topk = np.sort(probs)[::-1][:k]
    if len(topk) < 2:
        return 1.0
    return float(np.mean(topk[:-1] - topk[1:]))


# ── Unknown / OOD detection ─────────────────────────────────────────────────

def detect_unknown_entropy(probs: np.ndarray, n_classes: int,
                           entropy_threshold: Optional[float] = None) -> bool:
    """
    Flag prediction as unknown based on high entropy.
    If threshold not provided, use log(n_classes)/2 as adaptive threshold.
    """
    if entropy_threshold is None:
        entropy_threshold = np.log(n_classes) / 2.0
    return compute_entropy(probs) > entropy_threshold


def detect_unknown_margin(probs: np.ndarray, margin_threshold: float = 0.15) -> bool:
    """Flag prediction as unknown based on small margin between top predictions."""
    return compute_margin(probs) < margin_threshold


def detect_unknown_combined(probs: np.ndarray, n_classes: int,
                             margin_threshold: float = 0.12,
                             entropy_threshold: Optional[float] = None) -> bool:
    """
    Combined unknown detection: reject if EITHER signal is triggered.
    More robust than either alone.
    """
    ent_unknown = detect_unknown_entropy(probs, n_classes, entropy_threshold)
    margin_unknown = detect_unknown_margin(probs, margin_threshold)
    return ent_unknown or margin_unknown


# ── Prediction state classification ─────────────────────────────────────────

def classify_prediction_state(probs: np.ndarray, n_classes: int,
                              margin_low: float = 0.12,
                              margin_high: float = 0.35,
                              entropy_threshold: Optional[float] = None
                              ) -> PredictionState:
    """
    Classify a prediction into one of three confidence states:

    CONFIDENT  — high margin (> margin_high) AND entropy below threshold
                 → model is sure, show the prediction
    UNCERTAIN  — margin in [margin_low, margin_high]
                 → model is unsure, show top-3 suggestions
    UNKNOWN    — margin < margin_low OR high entropy
                 → model doesn't know, show "Try again" / ignore
    """
    margin = compute_margin(probs)
    entropy = compute_entropy(probs)

    if entropy_threshold is None:
        entropy_threshold = np.log(n_classes) / 2.0

    if margin < margin_low or entropy > entropy_threshold:
        return PredictionState.UNKNOWN
    if margin > margin_high and entropy < entropy_threshold:
        return PredictionState.CONFIDENT
    return PredictionState.UNCERTAIN


def process_prediction(logits: np.ndarray,
                       label_map: dict,
                       temperature: float = 1.0,
                       n_classes: Optional[int] = None,
                       top_k: int = 3,
                       margin_low: float = 0.12,
                       margin_high: float = 0.35) -> ProcessedPrediction:
    """
    Full post-inference processing pipeline.

    1. Apply temperature scaling
    2. Convert to probabilities
    3. Build top-K list
    4. Compute uncertainty signals
    5. Classify into CONFIDENT / UNCERTAIN / UNKNOWN

    Returns a ProcessedPrediction dataclass.
    """
    n_classes = n_classes or len(logits)
    calibrated = calibrated_softmax(np.asarray(logits), temperature)
    sorted_idx = np.argsort(calibrated)[::-1]

    top_indices = sorted_idx[:top_k].tolist()
    top_probs = calibrated[top_indices]

    topK = [
        {"label": label_map.get(str(i), f"class_{i}"), "confidence": float(p)}
        for i, p in zip(top_indices, top_probs)
    ]

    state = classify_prediction_state(
        calibrated, n_classes,
        margin_low=margin_low,
        margin_high=margin_high,
    )

    margin = compute_margin(calibrated)
    entropy = compute_entropy(calibrated)

    return ProcessedPrediction(
        label=topK[0]["label"] if topK else "UNKNOWN",
        confidence=float(topK[0]["confidence"]) if topK else 0.0,
        topK=topK,
        state=state,
        entropy=float(entropy),
        margin=float(margin),
        temperature=temperature,
        rejected=(state == PredictionState.UNKNOWN),
    )


# ── Temperature calibration ──────────────────────────────────────────────────

def fit_temperature(logits: np.ndarray, labels: np.ndarray,
                    init_temp: float = 2.0,
                    lr: float = 0.01,
                    max_iter: int = 200) -> float:
    """
    Fit optimal temperature using NLL loss on a validation set.
    Uses simple gradient descent on the temperature parameter.

    Args:
        logits: (N, C) validation logits
        labels: (N,) true class indices
        init_temp: initial temperature (start soft)
        lr: learning rate
        max_iter: max gradient descent iterations

    Returns:
        Optimal temperature (float)
    """
    logits = np.asarray(logits, dtype=np.float64)
    labels = np.asarray(labels, dtype=np.int32)

    temp = float(init_temp)

    for _ in range(max_iter):
        probs = calibrated_softmax(logits, temp)
        probs = np.clip(probs, 1e-12, 1.0)
        nll = -np.mean(np.log(probs[np.arange(len(labels)), labels]))

        grad = 0.0
        for i in range(len(labels)):
            p = probs[i, labels[i]]
            for c in range(probs.shape[1]):
                pc = probs[i, c]
                if c == labels[i]:
                    grad += (p - 1.0) * logits[i, c]
                else:
                    grad += p * logits[i, c]
        grad /= len(labels)

        temp = max(0.1, temp - lr * grad)

    return temp


# ── Batch processing helpers ─────────────────────────────────────────────────

def batch_process(logits: np.ndarray,
                 label_map: dict,
                 temperature: float = 1.0,
                 n_classes: Optional[int] = None,
                 top_k: int = 3) -> list:
    """
    Process a batch of logits and return a list of ProcessedPredictions.
    logits shape: (batch, n_classes)
    """
    n_classes = n_classes or logits.shape[1]
    results = []
    for row in logits:
        results.append(process_prediction(
            row, label_map, temperature, n_classes, top_k
        ))
    return results


# ── Calibration export ───────────────────────────────────────────────────────

import json
from pathlib import Path

def save_calibration(temperature: float, output_path: str | Path) -> None:
    """Save calibration temperature to a JSON file."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"temperature": temperature}, f, indent=2)


def load_calibration(path: str | Path) -> float:
    """Load calibration temperature from JSON file."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return float(data["temperature"])


# ── CLI for standalone calibration ──────────────────────────────────────────

def main():
    import argparse
    import pandas as pd

    parser = argparse.ArgumentParser(description="Fit temperature scaling for a trained model")
    parser.add_argument("--val-features", required=True, help="Path to validation features .npy (N, C logits or N, features)")
    parser.add_argument("--val-labels", required=True, help="Path to validation labels .npy (N,)")
    parser.add_argument("--temperature-out", default="training_logs/calibration_temperature.json")
    parser.add_argument("--init-temp", type=float, default=2.0)
    parser.add_argument("--lr", type=float, default=0.01)
    parser.add_argument("--max-iter", type=int, default=200)
    args = parser.parse_args()

    print(f"Loading validation data from {args.val_features}")
    X = np.load(args.val_features)
    y = np.load(args.val_labels)
    print(f"Loaded {len(y)} samples, {X.shape[1] if len(X.shape) > 1 else '?'} features/classes")

    # If X is raw features (not logits), use as-is
    # In practice, you would load logits from model.predict()
    # For this script to work standalone, accept that X may be probabilities
    if X.min() >= 0 and X.max() <= 1.0 and X.shape[1] > 1:
        print("Input looks like probabilities — treating as logits via logit transform")
        X = np.log(np.clip(X, 1e-12, 1.0))

    temp = fit_temperature(X, y, init_temp=args.init_temp, lr=args.lr, max_iter=args.max_iter)
    print(f"\nOptimal temperature: {temp:.4f}")

    save_calibration(temp, args.temperature_out)
    print(f"Saved calibration to {args.temperature_out}")


if __name__ == "__main__":
    main()
