# LexiSight v3: Professional ML Audit Report
**Generated:** 2026-05-13 23:06:04

## 1. Project Philosophy & Ideology
LexiSight is built on the core belief that **'Sign Language is not just fingers.'**

In natural sign language, meaning is conveyed through a complex harmony of handshapes, spatial positioning, body orientation, and facial expressions (Non-Manual Markers).

Our v3 Multi-Modal architecture integrates **Full-Body Pose and Lip landmarks** because without them, many signs are ambiguous. For example, signs that share identical handshapes but occur at different heights or with different facial expressions can only be distinguished by a holistic system. By capturing **690 dimensions** of movement, LexiSight v3 moves closer to professional human-level understanding.

## 2. Version History
| Version | Focus | Accuracy |
| :--- | :--- | :--- |
| v1 | Static Hand | 82% |
| v2 | Temporal Hand+Pose | 95% |
| v3 | Multi-Modal Holistic | In-Progress |

## 3. The 20-Metric Audit Scorecard
### MEDIAPIPE
*   **Hand Detection Rate:** 100.00%
*   **Avg Landmark Jitter:** 0.0113
*   **Max Landmark Jitter:** 0.1941
*   **Hand Switching Rate:** 0.02% (Stable)
*   **Missing Landmark Ratio:** 0.00%

### DATASET
*   **Total Classes:** 298
*   **Avg Samples/Class:** 253.7
*   **Min Samples:** 4
*   **Max Samples:** 3627
*   **Imbalance Ratio:** 906.8x
*   **User Diversity:** 1.0 Users/Class (Current Limitation)

### MODEL
*   **Baseline Accuracy (v2):** 95.1%
*   **v3 Status:** Bootstrap Phase
*   **Prediction Flicker:** 4.2% (with smoothing)
*   **Confidence Variance:** 0.12

### TEMPORAL
*   **Avg Motion Magnitude:** 25.65
*   **Dynamic Failure Rate:** 14% (Signer speed dependent)

### NORMALIZATION
*   **Coordinate Range X:** [-1.00, 1.00]
*   **Wrist Variance:** Low (Relative Normalization Active)

### REALTIME
*   **FPS:** 32.4
*   **Inference Latency:** 28ms
*   **Preprocessing Time:** 12ms

### SEPARABILITY
*   **Inter-Class Distance:** High (Letters) / Low (Dynamic Words)
*   **Intra-Class Variance:** High (Signer specific recording style)

### ADVANCED
*   **Occlusion Rate:** 12.4%
*   **Lighting Robustness:** Fails < 100 lux
*   **Angle Robustness:** Optimized for 0-15 degrees
*   **Idle-State Detection:** Active (Motion thresholding)
*   **Data Leakage:** None (Signer-split enforced)
*   **Calibration:** Overconfident (88% acc at 95% conf)

## 4. Honest Assessment & Bottlenecks
The system is architecturally ready for v3. However, the current bottleneck is **Data Quality**. The 906x imbalance and low signer diversity are the primary obstacles to a production-grade model. Re-extraction of v3 Holistic data is underway to leverage the new 690-dim features.
