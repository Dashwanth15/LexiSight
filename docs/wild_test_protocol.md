# Wild Test Set Recording Protocol

## Purpose
The wild test set measures **real-world accuracy** on unseen signers, lighting, and devices.
Validation accuracy is meaningless without this.

## Requirements

### Signers
- **Minimum 3 people** (ideally 5+)
- Different demographics: skin tones, hand sizes, ages
- Must NOT be the same person who created the training data

### Equipment
- Any smartphone camera (front-facing)
- No tripod required — handheld is intentionally harder
- Screen recording NOT acceptable — must be real camera

### Environments (per signer)
Record each sign in **2 different settings**:
1. **Daylight** — natural light from a window
2. **Indoor** — tubelight/LED, no natural light

### Backgrounds
- At least one recording with a **cluttered background** (desk, bookshelf)
- At least one with a **plain wall**

## Recording Procedure

### Per Sign
1. Start recording (video or use the in-app recorder)
2. Hold the sign steady for **2 seconds**
3. Stop recording
4. Repeat **5 times** per sign per signer

### Signs to Record
Start with the **top 50 most-used classes**:
- All 26 letters (A-Z)
- All 10 digits (0-9)
- Top 14 words: HELLO, THANK_YOU, YES, NO, HELP, WATER, DOCTOR, PAIN, STOP, GOOD, PLEASE, FRIEND, FAMILY, SCHOOL

### Naming Convention
```
wild_test/
├── signer_01/
│   ├── A/
│   │   ├── daylight_plain_01.mp4
│   │   ├── daylight_plain_02.mp4
│   │   ├── indoor_clutter_01.mp4
│   │   └── ...
│   ├── B/
│   └── ...
├── signer_02/
└── signer_03/
```

## Expected Output
- **Total clips**: 3 signers × 50 classes × 5 reps = **750 clips minimum**
- Each clip processed through MediaPipe → saved as `.npy` landmark sequence
- Final output: `ml/data_processed/wild_test/` with same schema as training data

## Metrics to Report
| Metric | How |
|--------|-----|
| Overall accuracy | Correct / Total on wild test |
| Per-class accuracy | Diagonal of confusion matrix |
| Signer generalization | Accuracy per signer (should be similar) |
| Lighting robustness | Daylight vs Indoor accuracy gap |
| Background robustness | Plain vs Cluttered accuracy gap |

## Rules
- Wild test data must **NEVER** be used for training or hyperparameter tuning
- If accuracy on wild test < 80%, the model is not ready for deployment
- Report wild test accuracy prominently in README and metrics.json
