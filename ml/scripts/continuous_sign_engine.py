#!/usr/bin/env python3
"""
LexiSight — Continuous Sign Recognition Engine
==============================================
Replaces the single-clip classifier with a live streaming pipeline:

  Live camera stream
       ↓
  Motion detection (hand velocity trigger)
       ↓
  Sliding window buffer (last 30 frames)
       ↓
  Start/end sign detection (velocity profile)
       ↓
  Temporal model prediction
       ↓
  HMM-style state machine (temporal smoothing + stability)
       ↓
  N-gram semantic re-ranking
       ↓
  CONFIDENT / UNCERTAIN / UNKNOWN output

Key concepts:
  - Motion trigger: only run inference when hands are actually moving
  - Start/end detection: detect when a sign begins and ends using velocity
  - Sliding window: always keep last 30 frames, predict every 4 frames
  - HMM state machine: transitions between WORD state, TRANSITION state, IDLE state
  - N-gram LM: re-rank top-3 predictions using bigram transition probabilities
"""

import json
import numpy as np
from collections import deque, Counter
from dataclasses import dataclass, field
from typing import Optional, Callable


class MotionDetector:
    """
    Detects when a sign is in progress using hand velocity.
    Uses a sliding window of recent frame-to-frame landmark deltas.
    """

    def __init__(self, window=8, velocity_threshold=0.015, sustained_frames=3):
        self.window = window
        self.velocity_threshold = velocity_threshold
        self.sustained_frames = sustained_frames
        self.velocity_history = deque(maxlen=window)
        self.sustained_count = 0
        self._last_features = None

    def update(self, features: np.ndarray) -> bool:
        """Return True if motion is detected (sign in progress)."""
        if self._last_features is not None:
            delta = np.linalg.norm(features - self._last_features)
            self.velocity_history.append(delta)
        self._last_features = features.copy()

        if len(self.velocity_history) < 3:
            return False

        recent = list(self.velocity_history)[-self.sustained_frames:]
        avg_velocity = np.mean(recent)
        is_moving = avg_velocity > self.velocity_threshold

        if is_moving:
            self.sustained_count = min(self.sustained_count + 1, self.sustained_frames)
        else:
            self.sustained_count = max(self.sustained_count - 1, 0)

        return self.sustained_count >= self.sustained_frames

    def reset(self):
        self.velocity_history.clear()
        self.sustained_count = 0
        self._last_features = None

    @property
    def velocity(self) -> float:
        if not self.velocity_history:
            return 0.0
        return float(np.mean(list(self.velocity_history)))


@dataclass
class BigramLM:
    """
    Simple bigram language model for ISL sign sequences.
    Stores P(word_i | word_j) and re-ranks model predictions.
    """
    bigram_counts: dict = field(default_factory=dict)
    unigram_counts: dict = field(default_factory=dict)
    vocab: set = field(default_factory=set)
    smoothing: float = 0.1

    def train(self, sentences: list[list[str]]):
        for sentence in sentences:
            for i, word in enumerate(sentence):
                self.vocab.add(word)
                self.unigram_counts[word] = self.unigram_counts.get(word, 0) + 1
                if i > 0:
                    prev = sentence[i - 1]
                    key = (prev, word)
                    self.bigram_counts[key] = self.bigram_counts.get(key, 0) + 1

    def score_sequence(self, words: list[str]) -> float:
        if len(words) == 0:
            return 0.0
        if len(words) == 1:
            uc = self.unigram_counts.get(words[0], 0) + self.smoothing
            total = sum(self.unigram_counts.values()) + self.smoothing * len(self.vocab)
            return uc / total

        score = 0.0
        for i in range(len(words)):
            if i == 0:
                denom = sum(self.unigram_counts.values()) + self.smoothing * len(self.vocab)
                score += (self.unigram_counts.get(words[0], 0) + self.smoothing) / denom
            else:
                key = (words[i - 1], words[i])
                prev_total = self.unigram_counts.get(words[i - 1], 0) + self.smoothing * len(self.vocab)
                bc = self.bigram_counts.get(key, 0) + self.smoothing
                score += bc / prev_total
        return score / len(words)

    def rerank(self, topK: list[dict], prev_word: Optional[str]) -> list[dict]:
        """Re-rank top-K predictions using bigram probability."""
        if not topK or len(topK) <= 1:
            return topK
        if prev_word is None:
            return topK

        scored = []
        for item in topK:
            word = item["label"]
            bigram_prob = 0.0
            if prev_word:
                key = (prev_word, word)
                prev_total = self.unigram_counts.get(prev_word, 0) + self.smoothing * len(self.vocab)
                bigram_prob = self.bigram_counts.get(key, self.smoothing) / prev_total
            combined = 0.7 * item["confidence"] + 0.3 * bigram_prob
            scored.append({**item, "combined_score": combined, "bigram_prob": bigram_prob})
        return sorted(scored, key=lambda x: x["combined_score"], reverse=True)

    def save(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            json.dump({
                "bigram_counts": self.bigram_counts,
                "unigram_counts": self.unigram_counts,
                "vocab": list(self.vocab),
                "smoothing": self.smoothing,
            }, f, indent=2)

    @classmethod
    def load(cls, path: str) -> "BigramLM":
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        lm = cls()
        lm.bigram_counts = d["bigram_counts"]
        lm.unigram_counts = d["unigram_counts"]
        lm.vocab = set(d["vocab"])
        lm.smoothing = d.get("smoothing", 0.1)
        return lm


class ContinuousSignEngine:
    """
    Full continuous sign recognition pipeline.

    State machine:
      IDLE -> (motion detected) -> TRANSITION
      TRANSITION -> (stable prediction) -> CONFIRMING
      CONFIRMING -> (same word confirmed) -> WORD
      WORD -> (no motion) -> IDLE
    """
    def __init__(
        self,
        model_predict_fn: Callable,
        label_map: dict,
        motion_detector: MotionDetector,
        bigram_lm: Optional[BigramLM] = None,
        buffer_size: int = 30,
        predict_every_n_frames: int = 4,
        stability_window: int = 6,
        min_stability_ratio: float = 0.6,
        confirm_frames: int = 5,
        transition_timeout: int = 45,
        confidence_threshold: float = 0.60,
        margin_low: float = 0.12,
    ):
        self.model_predict_fn = model_predict_fn
        self.label_map = label_map
        self.motion_detector = motion_detector
        self.bigram_lm = bigram_lm
        self.buffer_size = buffer_size
        self.predict_every_n_frames = predict_every_n_frames
        self.stability_window = stability_window
        self.min_stability_ratio = min_stability_ratio
        self.confirm_frames = confirm_frames
        self.transition_timeout = transition_timeout
        self.confidence_threshold = confidence_threshold
        self.margin_low = margin_low
        self._buffer = deque(maxlen=buffer_size)
        self._prediction_count = 0
        self._state = 0  # 0
        self._confirmed_word = None
        self._confirm_counter = 0
        self._transition_counter = 0
        self._sentence = []
        self._prev_word = None
        self._unconfirmed = []
        self._last_prediction = None
        self._frame_count = 0

    def _compute_stability(self, predictions: list) -> float:
        if not predictions:
            return 0.0
        labels = [p["label"] for p in predictions]
        most_common = Counter(labels).most_common(1)[0][1]
        return most_common / len(labels)

    def _apply_lm_rerank(self, topK: list, prev: Optional[str]) -> list:
        if not self.bigram_lm:
            return topK
        return self.bigram_lm.rerank(topK, prev)

    def process_frame(self, features: np.ndarray) -> Optional[dict]:
        """
        Process a single frame of landmarks (225 features).
        Returns a confirmed word dict when a sign is recognized, None otherwise.
        """
        self._frame_count += 1
        self._buffer.append(features)

        if len(self._buffer) < self.buffer_size:
            return None

        is_motion = self.motion_detector.update(features)

        if self._state == 0:
            if is_motion:
                self._state = 1
                self._transition_counter = 0
                self._unconfirmed.clear()
            return None

        if self._state == 1:
            self._transition_counter += 1
            self._unconfirmed.clear()
            return None

        if self._state == 3:
            self._confirm_counter += 1
            if self._confirm_counter >= self.confirm_frames:
                self._state = 2
                self._sentence.append(self._confirmed_word)
                self._prev_word = self._confirmed_word
                out = {
                    "word": self._confirmed_word,
                    "sentence": list(self._sentence),
                    "state": "WORD",
                    "frame": self._frame_count,
                }
                if self._last_prediction:
                    out["confidence"] = self._last_prediction.get("confidence")
                    out["topK"] = self._last_prediction.get("topK", [])
                self._confirm_counter = 0
                return out
            return None

        if self._state == 2:
            if not is_motion:
                self._state = 0
                self._confirmed_word = None
                self._confirm_counter = 0
                self._transition_counter = 0
            return None

        return None

    def predict_buffer(self) -> Optional[dict]:
        """Run the model on the current buffer. Call every predict_every_n_frames."""
        if len(self._buffer) < self.buffer_size:
            return None

        buffer_arr = np.array(list(self._buffer), dtype=np.float32)
        buffer_arr = buffer_arr.reshape(1, self.buffer_size, 225)

        try:
            raw = self.model_predict_fn(buffer_arr)
        except Exception:
            return None

        topK = raw.get("topK", [])
        topK = self._apply_lm_rerank(topK, self._prev_word)

        label = topK[0]["label"] if topK else "UNKNOWN"
        confidence = topK[0]["confidence"] if topK else 0.0
        state = raw.get("state", 0)

        self._last_prediction = {
            "label": label,
            "confidence": confidence,
            "topK": topK,
            "state": state,
        }

        is_rejected = (
            confidence < self.confidence_threshold or
            state == 0 or
            (len(topK) >= 2 and (topK[0]["confidence"] - topK[1]["confidence"]) < self.margin_low)
        )

        if is_rejected:
            self._state = 0
            self._transition_counter = 0
            self._unconfirmed.clear()
            return None

        recent = self._unconfirmed[-self.stability_window:]
        recent.append({"label": label, "confidence": confidence})
        stability = self._compute_stability(recent)

        if stability >= self.min_stability_ratio and len(recent) >= self.stability_window:
            self._confirmed_word = label
            self._unconfirmed.clear()
            self._state = 3
            self._confirm_counter = 0

        return self._last_prediction

    def flush(self) -> Optional[dict]:
        """Called when stream ends — emit any unconfirmed word."""
        if self._sentence and self._state == 2:
            return {"sentence": list(self._sentence), "state": "FLUSHED"}
        return None

    def reset(self):
        self._buffer.clear()
        self._sentence.clear()
        self._unconfirmed.clear()
        self._state = 0
        self._confirmed_word = None
        self._confirm_counter = 0
        self._transition_counter = 0
        self._prev_word = None
        self._last_prediction = None
        self._frame_count = 0
        self.motion_detector.reset()


def build_default_bigram_lm() -> BigramLM:
    """Default ISL word-sequence bigram LM.
    These are common ISL phrase patterns for bootstrapping.
    Expand with actual observed sequences from your model.
    """
    sentences = [
        ["HELLO", "HOW", "ARE", "YOU"],
        ["GOOD", "MORNING"],
        ["GOOD", "AFTERNOON"],
        ["GOOD", "EVENING"],
        ["THANK", "YOU"],
        ["MY", "NAME", "IS"],
        ["I", "AM", "FINE"],
        ["WHAT", "IS", "YOUR", "NAME"],
        ["WHERE", "ARE", "YOU", "FROM"],
        ["I", "LIVE", "IN"],
        ["YES", "NO"],
        ["PLEASE", "HELP"],
        ["SORRY", "EXCUSE", "ME"],
        ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
        ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
         "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"],
        ["I", "NEED", "HELP"],
        ["WHERE", "IS", "THE", "BATHROOM"],
        ["HOW", "MUCH", "COST"],
        ["WATER", "FOOD"],
        ["HELP", "POLICE", "EMERGENCY"],
    ]
    lm = BigramLM()
    lm.train(sentences)
    return lm


def main():
    import argparse
    p = argparse.ArgumentParser(description="Build and save ISL bigram LM")
    p.add_argument("--output", default="ml/data_processed/isl_bigram_lm.json")
    args = p.parse_args()

    lm = build_default_bigram_lm()
    lm.save(args.output)
    print(f"Saved bigram LM with {len(lm.vocab)} words, "
          f"{len(lm.bigram_counts)} bigram transitions -> {args.output}")


if __name__ == "__main__":
    main()
