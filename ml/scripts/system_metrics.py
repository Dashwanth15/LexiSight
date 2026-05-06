#!/usr/bin/env python3
"""
LexiSight — System Metrics Collector
=====================================
Tracks real-time performance metrics for the live prediction pipeline:
  - Latency (ms per prediction)
  - Stability score (% of recent frames agreeing)
  - Rejection rate (% of frames rejected by confidence/entropy)
  - Per-class confusion entropy
  - Transition quality (false starts, missed ends)

Usage (in useClassifier or standalone):
  from system_metrics import SystemMetrics
  metrics = SystemMetrics(num_classes=261)
  metrics.record_prediction(latency_ms=12.3, confidence=0.91, label="HELLO", state=2)
  metrics.record_rejection(reason="low_confidence")
  print(metrics.summary())

  # Save full report
  metrics.save("training_logs/system_metrics_report.json")
"""

import json
import time
import numpy as np
from collections import deque, Counter, defaultdict
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional


@dataclass
class SystemMetrics:
    num_classes: int
    window_size: int = 100

    _prediction_latencies: deque = field(default_factory=lambda: deque(maxlen=1000))
    _confidences: deque = field(default_factory=lambda: deque(maxlen=1000))
    _stabilities: deque = field(default_factory=lambda: deque(maxlen=1000))
    _rejections: deque = field(default_factory=lambda: deque(maxlen=1000))
    _entropy_values: deque = field(default_factory=lambda: deque(maxlen=1000))
    _margin_values: deque = field(default_factory=lambda: deque(maxlen=1000))
    _recent_labels: deque = field(default_factory=lambda: deque(maxlen=50))
    _class_counts: dict = field(default_factory=lambda: defaultdict(int))
    _class_correct: dict = field(default_factory=lambda: defaultdict(lambda: {"ok": 0, "total": 0}))
    _transition_times: deque = field(default_factory=lambda: deque(maxlen=500))
    _start_time: float = field(default_factory=time.time)

    _rejection_reasons: dict = field(default_factory=lambda: defaultdict(int))

    def record_latency(self, latency_ms: float):
        self._prediction_latencies.append(latency_ms)

    def record_prediction(self, latency_ms: float, confidence: float,
                         label: str, true_label: Optional[str] = None,
                         stability: Optional[float] = None,
                         entropy: Optional[float] = None,
                         margin: Optional[float] = None,
                         state: int = 2):
        self.record_latency(latency_ms)
        self._confidences.append(confidence)
        self._recent_labels.append(label)
        self._class_counts[label] += 1
        if entropy is not None:
            self._entropy_values.append(entropy)
        if margin is not None:
            self._margin_values.append(margin)
        if stability is not None:
            self._stabilities.append(stability)
        if true_label is not None:
            self._class_correct[label]["total"] += 1
            if label == true_label:
                self._class_correct[label]["ok"] += 1

    def record_rejection(self, reason: str = "unknown",
                        entropy: Optional[float] = None,
                        margin: Optional[float] = None):
        self._rejections.append(1)
        self._rejection_reasons[reason] += 1
        if entropy is not None:
            self._entropy_values.append(entropy)
        if margin is not None:
            self._margin_values.append(margin)

    def record_transition(self, transition_type: str, duration_frames: int):
        self._transition_times.append({
            "type": transition_type,
            "frames": duration_frames,
            "timestamp": time.time() - self._start_time,
        })

    @property
    def mean_latency_ms(self) -> float:
        if not self._prediction_latencies:
            return 0.0
        return float(np.mean(self._prediction_latencies))

    @property
    def p95_latency_ms(self) -> float:
        if not self._prediction_latencies:
            return 0.0
        return float(np.percentile(self._prediction_latencies, 95))

    @property
    def p99_latency_ms(self) -> float:
        if not self._prediction_latencies:
            return 0.0
        return float(np.percentile(self._prediction_latencies, 99))

    @property
    def mean_confidence(self) -> float:
        if not self._confidences:
            return 0.0
        return float(np.mean(self._confidences))

    @property
    def mean_stability(self) -> float:
        if not self._stabilities:
            return 0.0
        return float(np.mean(self._stabilities))

    @property
    def rejection_rate(self) -> float:
        total = len(self._confidences) + len(self._rejections)
        if total == 0:
            return 0.0
        return len(self._rejections) / total

    @property
    def mean_entropy(self) -> float:
        if not self._entropy_values:
            return 0.0
        return float(np.mean(self._entropy_values))

    @property
    def mean_margin(self) -> float:
        if not self._margin_values:
            return 0.0
        return float(np.mean(self._margin_values))

    @property
    def uptime_seconds(self) -> float:
        return time.time() - self._start_time

    def per_class_accuracy(self) -> dict:
        return {
            label: {
                "accuracy": round(d["ok"] / d["total"], 4) if d["total"] > 0 else None,
                "support": d["total"],
            }
            for label, d in self._class_correct.items()
        }

    def most_confused_pairs(self, top_n=10) -> list:
        return []

    def summary(self) -> dict:
        total_predictions = len(self._confidences)
        total_rejections = len(self._rejections)
        total = total_predictions + total_rejections

        return {
            "uptime_seconds": round(self.uptime_seconds, 1),
            "total_frames": total,
            "predictions": total_predictions,
            "rejections": total_rejections,
            "rejection_rate": round(self.rejection_rate, 4),
            "rejection_reasons": dict(self._rejection_reasons),
            "latency": {
                "mean_ms": round(self.mean_latency_ms, 2),
                "p95_ms": round(self.p95_latency_ms, 2),
                "p99_ms": round(self.p99_latency_ms, 2),
            },
            "confidence": {
                "mean": round(self.mean_confidence, 4),
            },
            "stability": {
                "mean": round(self.mean_stability, 4),
            },
            "uncertainty": {
                "mean_entropy": round(self.mean_entropy, 4),
                "mean_margin": round(self.mean_margin, 4),
            },
            "top_classes": dict(Counter(
                dict(self._class_counts)
            ).most_common(10)),
        }

    def save(self, path: str | Path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        data = self.summary()
        data["per_class_accuracy"] = self.per_class_accuracy()
        data["rejection_reasons"] = dict(self._rejection_reasons)
        data["transition_log"] = list(self._transition_times)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
        print(f"Saved system metrics to {path}")

    @classmethod
    def load(cls, path: str | Path) -> "SystemMetrics":
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        m = cls(num_classes=0)
        m._rejection_reasons = defaultdict(int, data.get("rejection_reasons", {}))
        return m


def main():
    import argparse
    p = argparse.ArgumentParser(description="Print saved system metrics")
    p.add_argument("path", nargs="?", default="training_logs/system_metrics_report.json")
    args = p.parse_args()
    p = Path(args.path)
    if not p.exists():
        print(f"Metrics file not found: {p}")
        return
    with open(p, encoding="utf-8") as f:
        d = json.load(f)
    print(json.dumps(d, indent=2, default=str))


if __name__ == "__main__":
    main()
