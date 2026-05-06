#!/usr/bin/env python3
"""
LexiSight  --  Targeted Data Collection Planner
============================================
Based on the 3-tier evaluation results, this identifies EXACTLY which classes
need more data, how much, and what kind of variation to collect.

Weak classes below 85% in seen split + unmeasured classes:
  - 26 classes below 85% accuracy
  - 12 classes had zero val support (need measurement first)

Usage:
  python ml/scripts/plan_targeted_data.py
"""

import json
import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent

WEAK_CLASSES = {
    "EXTRA":      {"support": 8,  "accuracy": 0.00, "severity": "critical", "confusions": ["COURT","SHORT","MARKET"]},
    "LOCK":       {"support": 1,  "accuracy": 0.00, "severity": "critical", "confusions": ["TELEPHONE"]},
    "PHOTOGRAPH": {"support": 3,  "accuracy": 0.33, "severity": "high",     "confusions": ["PEN"]},
    "SATURDAY":   {"support": 5,  "accuracy": 0.40, "severity": "high",     "confusions": ["BLACK","JOB"]},
    "BATHROOM":   {"support": 2,  "accuracy": 0.50, "severity": "high",     "confusions": ["PENCIL"]},
    "BEAUTIFUL":  {"support": 2,  "accuracy": 0.50, "severity": "high",     "confusions": ["EXTRA"]},
    "HARD":       {"support": 2,  "accuracy": 0.50, "severity": "medium",   "confusions": ["GROUND"]},
    "I":          {"support": 2,  "accuracy": 0.50, "severity": "medium",   "confusions": ["YOU"]},
    "PAPER":      {"support": 5,  "accuracy": 0.60, "severity": "high",     "confusions": ["LETTER","LOCK"]},
    "BROTHER":    {"support": 6,  "accuracy": 0.67, "severity": "high",     "confusions": ["SISTER"]},
    "MONTH":      {"support": 3,  "accuracy": 0.67, "severity": "medium",   "confusions": ["YEAR"]},
    "SAD":        {"support": 3,  "accuracy": 0.67, "severity": "medium",   "confusions": ["TRAIN"]},
    "SUMMER":     {"support": 3,  "accuracy": 0.67, "severity": "medium",   "confusions": ["GIRL","JOB"]},
    "YOUNG":      {"support": 3,  "accuracy": 0.67, "severity": "medium",   "confusions": ["COLOUR"]},
    "PAINT":      {"support": 8,  "accuracy": 0.75, "severity": "medium",   "confusions": ["KEY"]},
    "CLOTHING":   {"support": 4,  "accuracy": 0.75, "severity": "medium",   "confusions": ["DRESS"]},
    "DEAD":       {"support": 4,  "accuracy": 0.75, "severity": "medium",   "confusions": ["DIRTY"]},
    "GIFT":       {"support": 4,  "accuracy": 0.75, "severity": "medium",   "confusions": ["CARD"]},
    "RESTAURANT": {"support": 4,  "accuracy": 0.75, "severity": "medium",   "confusions": ["UGLY"]},
    "BOY":        {"support": 5,  "accuracy": 0.80, "severity": "medium",   "confusions": ["GIRL"]},
    "JOB":        {"support": 5,  "accuracy": 0.80, "severity": "medium",   "confusions": ["SUMMER"]},
    "SMALL LITTLE": {"support": 5, "accuracy": 0.80, "severity": "medium",  "confusions": ["HEALTHY"]},
    "TELEPHONE":  {"support": 5,  "accuracy": 0.80, "severity": "medium",   "confusions": ["BAG"]},
    "THANK YOU":  {"support": 5,  "accuracy": 0.80, "severity": "medium",   "confusions": ["SCHOOL"]},
    "THURSDAY":   {"support": 5,  "accuracy": 0.80, "severity": "medium",   "confusions": ["PEN"]},
    "COURT":      {"support": 6,  "accuracy": 0.83, "severity": "low",      "confusions": ["SECRETARY"]},
}

UNMEASURED_CLASSES = [
    "CARD", "CLEAN", "DIRTY", "DOG", "HEAVY", "HIGH",
    "MALE", "NEWSPAPER", "SCIENCE", "THICK", "TODAY", "WEDNESDAY",
]

COLLECTION_TIERS = [
    {"name": "CRITICAL", "min_samples": 15, "variations": 3, "signers": 5},
    {"name": "HIGH",     "min_samples": 10, "variations": 2, "signers": 4},
    {"name": "MEDIUM",   "min_samples": 8,  "variations": 2, "signers": 3},
    {"name": "LOW",      "min_samples": 5,  "variations": 1, "signers": 2},
]

VARIATION_TYPES = [
    {"id": "fast",      "description": "Fast signing speed", "reps": 3},
    {"id": "slow",      "description": "Slow deliberate speed", "reps": 3},
    {"id": "close",     "description": "Hand close to camera (zoomed)", "reps": 2},
    {"id": "far",       "description": "Hand far from camera", "reps": 2},
    {"id": "left",      "description": "Left-hand dominant (mirror if right)", "reps": 3},
    {"id": "angled",    "description": "Side angle, not frontal", "reps": 2},
    {"id": "daylight",  "description": "Natural daylight lighting", "reps": 2},
    {"id": "indoor",    "description": "Indoor artificial lighting", "reps": 2},
]

FOCUS_PAIRS = [
    {"class_a": "BROTHER",    "class_b": "SISTER",    "focus": "arm rotation angle differentiation"},
    {"class_a": "PAINT",      "class_b": "KEY",        "focus": "finger spread vs pinch shape"},
    {"class_a": "PHOTOGRAPH", "class_b": "PEN",        "focus": "whole hand circle vs finger grip"},
    {"class_a": "SATURDAY",   "class_b": "BLACK",     "focus": "handshape + movement direction"},
    {"class_a": "BOY",        "class_b": "GIRL",       "focus": "facial context if available"},
    {"class_a": "PAPER",      "class_b": "LETTER",     "focus": "flat hand vs slight curve"},
    {"class_a": "MONTH",      "class_b": "YEAR",       "focus": "circular vs linear movement"},
    {"class_a": "SUMMER",     "class_b": "JOB",        "focus": "open S vs O handshape"},
    {"class_a": "COURT",      "class_b": "SECRETARY",  "focus": "C hand orientation"},
    {"class_a": "TELEPHONE",  "class_b": "BAG",        "focus": "hand shape vs placement"},
]


def main():
    print("=" * 60)
    print("  LexiSight  --  Targeted Data Collection Plan")
    print("=" * 60)

    seen_report_path = BASE_DIR / "training_logs" / "eval_3tier_report.json"
    if seen_report_path.exists():
        with open(seen_report_path) as f:
            report = json.load(f)
        print(f"\nSource: {seen_report_path}")
        print(f"Seen tier  --  Top-1: {report['tiers']['seen']['top1_accuracy']:.2%} | "
              f"Macro-F1: {report['tiers']['seen']['macro_f1']:.4f} | "
              f"ECE: {report['tiers']['seen']['ece']:.4f}")

    print(f"\n{'-' * 60}")
    print(f"  PHASE 1 -- CRITICAL ({len([c for c,w in WEAK_CLASSES.items() if w['severity']=='critical'])} classes)")
    print(f"{'-' * 60}")
    for cls, info in WEAK_CLASSES.items():
        if info["severity"] != "critical":
            continue
        tier = COLLECTION_TIERS[0]
        total = tier["signers"] * tier["variations"] * tier["min_samples"]
        print(f"  {cls:20s}  acc={info['accuracy']:.0%}  n={info['support']:2d}  "
              f"-> collect ~{total:3d} clips  variations: {info['confusions']}")

    print(f"\n{'-' * 60}")
    print(f"  PHASE 2  --  HIGH ({len([c for c,w in WEAK_CLASSES.items() if w['severity']=='high'])} classes)")
    print(f"{'-' * 60}")
    for cls, info in WEAK_CLASSES.items():
        if info["severity"] != "high":
            continue
        tier = COLLECTION_TIERS[1]
        total = tier["signers"] * tier["variations"] * tier["min_samples"]
        print(f"  {cls:20s}  acc={info['accuracy']:.0%}  n={info['support']:2d}  "
              f"-> collect ~{total:3d} clips  confusions: {info['confusions']}")

    print(f"\n{'-' * 60}")
    print(f"  PHASE 3  --  MEDIUM + LOW ({len([c for c,w in WEAK_CLASSES.items() if w['severity'] in ('medium','low')])} classes)")
    print(f"{'-' * 60}")
    for cls, info in WEAK_CLASSES.items():
        if info["severity"] not in ("medium", "low"):
            continue
        tier = COLLECTION_TIERS[2] if info["severity"] == "medium" else COLLECTION_TIERS[3]
        total = tier["signers"] * tier["variations"] * tier["min_samples"]
        print(f"  {cls:20s}  acc={info['accuracy']:.0%}  n={info['support']:2d}  "
              f"-> collect ~{total:3d} clips  confusions: {info['confusions']}")

    print(f"\n{'-' * 60}")
    print(f"  PHASE 4  --  UNMEASURED ({len(UNMEASURED_CLASSES)} classes  --  measure first)")
    print(f"{'-' * 60}")
    for cls in UNMEASURED_CLASSES:
        print(f"  {cls:20s}  -> record 15 clips across 3 signers to measure")
        UNMEASURED_CLASSES

    print(f"\n{'-' * 60}")
    print(f"  CONFUSION PAIR FOCUS (hard-negative training targets)")
    print(f"{'-' * 60}")
    for pair in FOCUS_PAIRS:
        print(f"  {pair['class_a']:15s} <-> {pair['class_b']:15s}  | {pair['focus']}")

    print(f"\n{'-' * 60}")
    print(f"  COLLECTION VARIATIONS")
    print(f"{'-' * 60}")
    for v in VARIATION_TYPES:
        print(f"  {v['id']:10s}  {v['description']:40s}  {v['reps']} reps")

    critical_total = sum(
        COLLECTION_TIERS[0]["signers"] * COLLECTION_TIERS[0]["variations"] * COLLECTION_TIERS[0]["min_samples"]
        for cls, info in WEAK_CLASSES.items() if info["severity"] == "critical"
    )
    high_total = sum(
        COLLECTION_TIERS[1]["signers"] * COLLECTION_TIERS[1]["variations"] * COLLECTION_TIERS[1]["min_samples"]
        for cls, info in WEAK_CLASSES.items() if info["severity"] == "high"
    )
    medium_total = sum(
        COLLECTION_TIERS[2]["signers"] * COLLECTION_TIERS[2]["variations"] * COLLECTION_TIERS[2]["min_samples"]
        for cls, info in WEAK_CLASSES.items() if info["severity"] == "medium"
    )
    low_total = sum(
        COLLECTION_TIERS[3]["signers"] * COLLECTION_TIERS[3]["variations"] * COLLECTION_TIERS[3]["min_samples"]
        for cls, info in WEAK_CLASSES.items() if info["severity"] == "low"
    )
    unmeasured_total = len(UNMEASURED_CLASSES) * 15

    print(f"\n{'-' * 60}")
    print(f"  ESTIMATED TOTALS")
    print(f"{'-' * 60}")
    print(f"  Critical:  ~{critical_total:4d} clips")
    print(f"  High:      ~{high_total:4d} clips")
    print(f"  Medium:    ~{medium_total:4d} clips")
    print(f"  Low:       ~{low_total:4d} clips")
    print(f"  Unmeasured:~{unmeasured_total:4d} clips")
    print(f"  ---------------------------------")
    print(f"  TOTAL:     ~{critical_total+high_total+medium_total+low_total+unmeasured_total:4d} clips")

    collection_plan = {
        "weak_classes": WEAK_CLASSES,
        "unmeasured_classes": UNMEASURED_CLASSES,
        "focus_pairs": FOCUS_PAIRS,
        "collection_tiers": COLLECTION_TIERS,
        "variations": VARIATION_TYPES,
        "estimated_totals": {
            "critical": critical_total,
            "high": high_total,
            "medium": medium_total,
            "low": low_total,
            "unmeasured": unmeasured_total,
            "grand_total": critical_total + high_total + medium_total + low_total + unmeasured_total,
        }
    }

    out_path = BASE_DIR / "training_logs" / "targeted_data_plan.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(collection_plan, f, indent=2)
    print(f"\nSaved: {out_path}")


if __name__ == "__main__":
    main()
