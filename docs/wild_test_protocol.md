# Wild Test Recording Protocol v2

## Purpose
Measures **real-world generalization** — completely unseen signers, devices, lighting, and backgrounds.
All other evaluations (seen split, unseen split) measure in-distribution accuracy. Only this measures out-of-distribution robustness.

## ⚠️ Critical Rule
**Wild test data must NEVER touch training or validation. Record it fresh after all training is done.**

## Signer Requirements

### Minimum: 3 people
- Must NOT appear in the training manifest (any signer_id or session)
- Different demographics: skin tones, hand sizes, ages
- No prior sign language ML experience (naive signers are more realistic)

### Recommended: 5+ people
More signers = more robust wild accuracy estimate.

## Recording Setup

### Per Signer — Equipment
| Item | Recommendation |
|------|---------------|
| Camera | Smartphone front-facing, no stabilizer |
| Distance | ~40–60 cm from signer |
| Resolution | 720p minimum, 1080p preferred |
| tripod | Optional — handheld is intentionally harder |

### Per Signer — Environments (record each sign in ALL environments)
1. **Daylight**: natural window light, plain wall background
2. **Indoor**: artificial LED/tubelight, cluttered background
3. **Alternate**: different room, different time of day

### Per Signer — Hand Conditions
1. Dominant hand (natural)
2. Non-dominant hand (mirror if right-handed signer recorded right-hand data)

## Signs to Record

### Priority 1 — Core (all 26 letters + 10 digits = 36)
Letters A–Z, digits 0–9.

### Priority 2 — Top Words (from model confusion analysis)
From the worst-performing classes and known confusion pairs:

| Word | Why priority |
|------|-------------|
| EXTRA | 0% accuracy (hardest class) |
| BROTHER / SISTER | confused pair — record both |
| PAINT / KEY | confused pair — record both |
| PHOTOGRAPH / PEN | confused pair — record both |
| SATURDAY / BLACK | confused pair — record both |
| PAPER / LETTER | confused pair — record both |
| MONTH / YEAR | confused pair — record both |
| BOY / GIRL | confused pair — record both |
| THANK YOU | below 85% in seen split |
| TELEPHONE | below 85% in seen split |

### Priority 3 — Fill remaining
Any word from the top-50 ISL dictionary not yet covered.

## Recording Instructions

### Per Sign
1. Start screen recording (or have assistant record)
2. Perform the sign clearly for **2 seconds**, hold steady
3. Stop recording
4. **Wait 1 second** before next repetition
5. Repeat **5 times per sign per signer per environment**
6. Rest 30 seconds between environment changes

### Naming Convention
```
wild_test/
└── signer_01/           ← real person, not in training
    ├── A/
    │   ├── daylight_01.npy
    │   ├── daylight_02.npy
    │   ├── indoor_01.npy
    │   └── indoor_02.npy
    ├── BROTHER/
    │   ├── daylight_01.npy
    │   └── ...
    ├── SISTER/
    └── ...
```

## Post-Recording Processing

After recording videos:
```bash
# Process through MediaPipe Holistic extractor
python ml/scripts/extract_holistic.py \
    --input wild_test/signer_01/ \
    --output ml/data_processed/wild_test/signer_01/
```

Then run evaluation:
```bash
python ml/scripts/eval_advanced.py \
    --checkpoint training_logs/holistic_v2_best.keras \
    --manifest ml/data_processed/manifest_holistic_include.csv \
    --output training_logs/eval_wild_final.json
```

## Metrics to Report

| Metric | Target | Pass/Fail |
|--------|--------|-----------|
| Wild Top-1 Accuracy | ≥ 80% | ≥ 80% = pass |
| Wild Top-3 Accuracy | ≥ 90% | ≥ 90% = pass |
| Per-signer consistency | ±5% across signers | No signer < 70% |
| Lighting gap | Daylight vs Indoor < 5% | < 5% = robust |
| Priority pair accuracy | ≥ 75% each | Lower = confusion not fixed |

## Signer Checklist (print and use)

```
Signer: _______________  Date: _______________
Device: _______________  Camera: _____________

[ ] Daylight, plain background — all 36 letters + 10 digits
[ ] Daylight, plain background — Priority 2 words (BROTHER, SISTER, etc.)
[ ] Indoor, cluttered background — all 36 letters + 10 digits
[ ] Indoor, cluttered background — Priority 2 words
[ ] Notes: _________________________________________________
```

## Expected Output
- **Minimum**: 3 signers × 36 classes × 2 environments × 5 reps = **1,080 clips**
- **Recommended**: 5 signers × 50 classes × 3 environments × 5 reps = **3,750 clips**
