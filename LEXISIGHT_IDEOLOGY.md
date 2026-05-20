# LEXISIGHT — THE COMPLETE IDEOLOGY
### A Living Document for Future Reference
**Author:** Navatej (jashvanthh) | **Last Updated:** 2026-05-13

---

> **"Sign Language is NOT only fingers."**
> This single sentence is the philosophical foundation of everything LexiSight is, was, and will become.

---

## TABLE OF CONTENTS

1. [The Origin — Why LexiSight Exists](#1-the-origin)
2. [The Core Philosophy](#2-the-core-philosophy)
3. [The Silent Crisis in Numbers](#3-the-silent-crisis)
4. [Edge AI Philosophy — Privacy by Design](#4-edge-ai-philosophy)
5. [The Landmark Philosophy — Skeleton over Pixels](#5-the-landmark-philosophy)
6. [Version History — The Evolution](#6-version-history)
7. [v1: The Static Foundation](#7-v1-the-static-foundation)
8. [v1 Training — The Overfitting Crisis](#8-v1-training-the-overfitting-crisis)
9. [v2: The Temporal Transformer](#9-v2-the-temporal-transformer)
10. [v2 Training — Fixing the Overfit](#10-v2-training-fixing-the-overfit)
11. [v3: The Multi-Modal Holistic Vision](#11-v3-the-multi-modal-holistic-vision)
12. [The 690-Dimension Feature Space](#12-the-690-dimension-feature-space)
13. [Dataset Strategy — INCLUDE & CISLR](#13-dataset-strategy)
14. [The Data Pipeline — From Video to Tensor](#14-the-data-pipeline)
15. [The Manifest System](#15-the-manifest-system)
16. [The Frontend Architecture](#16-the-frontend-architecture)
17. [The Real-Time Inference Loop](#17-the-real-time-inference-loop)
18. [The 20-Point Audit Framework](#18-the-20-point-audit-framework)
19. [Honest Assessment — Where We Stand](#19-honest-assessment)
20. [The Bottlenecks, Ranked Honestly](#20-the-bottlenecks-ranked)
21. [What v3 Actually Needs to Become Real](#21-what-v3-needs)
22. [The Product Vision — Deployment Targets](#22-the-product-vision)
23. [The Roadmap — Phases 1 through 5](#23-the-roadmap)
24. [Design Philosophy — The UI/UX Ideology](#24-design-philosophy)
25. [The Real Picture](#25-the-real-picture)

---

## 1. The Origin — Why LexiSight Exists

LexiSight was born from a simple, painful observation:

**63 million Indians with hearing impairment have almost zero technological support.**

- There are fewer than **1,000 certified ISL interpreters** in the entire country.
- That is a ratio of **1 interpreter for every 63,000 Deaf people**.
- **99% of public spaces** — hospitals, banks, schools, government offices — have zero ISL infrastructure.

This is not a technology gap. This is a **human rights failure**.

### The Human Cost

- **Healthcare:** A Deaf patient cannot explain symptoms to a doctor. This leads to misdiagnosis, wrong prescriptions, and in extreme cases, life-threatening medical errors. Imagine being in pain and having no way to tell anyone where it hurts.
- **Education:** Deaf children are systematically excluded from mainstream classrooms. Without a visual-verbal bridge, they fall behind not because they lack intelligence, but because the system was never built for them.
- **Employment:** There is an invisible "Communication Tax" on Deaf workers. They are 5x less likely to find stable employment — not because they cannot do the work, but because interviews, meetings, and daily communication are designed exclusively for hearing people.
- **Social Isolation:** The psychological toll is enormous. When every interaction requires a translator who is rarely available, social life shrinks to a small circle of people who happen to know sign language.

LexiSight exists to break this cycle. Not with expensive hardware. Not with cloud-dependent services. But with a **free, offline, browser-based AI** that turns any phone or laptop into an ISL translator.

The project was built for the **AIESEC Youth Speak Ideathon 2026**, aligned with:
- **SDG 10:** Reduced Inequalities
- **SDG 4:** Quality Education
- **SDG 3:** Good Health and Well-being

---

## 2. The Core Philosophy

### "Sign Language is NOT Only Fingers"

This is the ideological north star. Every architectural decision in LexiSight traces back to this belief.

In natural sign language, meaning is conveyed through a **complex harmony** of:

1. **Handshapes** — The shape and orientation of fingers
2. **Spatial Positioning** — Where the hands are relative to the body (chest, head, waist)
3. **Body Orientation** — Shoulder lean, torso twist, head tilt
4. **Facial Expressions (Non-Manual Markers)** — Raised eyebrows for questions, lip patterns for specific words, head nods for affirmation
5. **Motion Dynamics** — The speed, direction, and arc of hand movement
6. **Lip Movement** — Many signs are disambiguated purely by mouth shape

Most existing sign language recognition systems only track hands. They extract 21 landmarks per hand (42 total), compute coordinates, and feed them to a classifier. This approach works for fingerspelling (A-Z) where meaning truly is in the fingers. But for real ISL words and phrases, it fails fundamentally.

**Example of why hand-only fails:**
- The signs for "SUMMER" and "DRY" share nearly identical handshapes.
- The difference? "SUMMER" involves wiping the forehead (spatial context), while "DRY" involves a downward motion near the chin (different spatial context + lip movement).
- A hand-only model sees the same hand shape and guesses randomly. A holistic model sees the full picture.

This is why v3 of LexiSight integrates:
- **33 Pose Landmarks** (full upper body skeleton)
- **21 Left Hand Landmarks**
- **21 Right Hand Landmarks**
- **40 Face/Lip Landmarks** (focused on the mouth region)
- **Motion Vectors** (frame-to-frame deltas for all of the above)

**Total: 690 dimensions per frame.** This is the mathematical expression of the belief that sign language is a full-body language.

---

## 3. The Silent Crisis in Numbers

| Statistic | Value |
|:---|:---|
| Hearing-impaired individuals in India | **63,000,000+** |
| Certified ISL interpreters nationwide | **< 1,000** |
| Interpreter-to-Deaf ratio | **1 : 63,000** |
| Public spaces with ISL infrastructure | **< 1%** |
| Deaf employment disadvantage | **5x harder** to find stable jobs |
| Healthcare misdiagnosis risk | **Significantly elevated** due to communication barriers |

These numbers are not abstract statistics. Each one represents a real person who cannot communicate with their doctor, cannot follow their teacher, cannot participate in their own job interview.

---

## 4. Edge AI Philosophy — Privacy by Design

LexiSight is built on the philosophy of **"Edge Intelligence."**

### The Three Pillars

1. **No Servers:** The AI lives entirely in your browser. It never sends data to a cloud. There is no backend server processing your video. The model weights are downloaded once and run locally via TensorFlow.js and WebGL.

2. **No Data Leakage:** Your video never leaves your device. LexiSight converts each video frame into landmark coordinates (skeleton dots) instantly and discards the raw frame. We never store, transmit, or log any visual data. This is not a privacy policy — it is an architectural guarantee.

3. **No Costs:** Because we do not maintain servers, we do not incur compute costs. Because we do not incur costs, we do not charge users. LexiSight is and will remain **free**.

### Why This Matters

Cloud-based sign language tools require the user to stream their video to a remote server. This means:
- A stable internet connection (which many rural users do not have)
- Trust that the company will not misuse the video data
- Ongoing server costs that eventually get passed to the user
- Latency that makes real-time conversation impossible

LexiSight rejects all of this. The AI runs on your GPU (via WebGL 2.0), directly inside Chrome, Edge, Safari, or Firefox. Once the page loads, you can go completely offline and the translator still works.

### The Technical Implementation

- **TensorFlow.js (TFJS):** Converts Python-trained Keras models into browser-friendly `model.json` + weight shards.
- **Quantization:** The trained model (~50MB in Python) is quantized to **~0.6MB** for the browser — a tradeoff of ~0.3% accuracy for 80x size reduction.
- **WebGL Backend:** TensorFlow.js uses your device's GPU through WebGL for parallel matrix multiplication. Even a 5-year-old integrated GPU handles inference at 30+ FPS.
- **Progressive Web App (PWA):** LexiSight can be "installed" to your phone's home screen and cached via Service Worker for complete offline use.

---

## 5. The Landmark Philosophy — Skeleton over Pixels

In gesture recognition AI, there are two approaches:

### Approach A: Pixel-Based (Vision Models)
- Feed raw video frames (millions of pixels) into a CNN or Vision Transformer.
- **Pros:** Can learn from any visual cue.
- **Cons:** Massive compute, privacy-invasive, slow, not suitable for edge deployment.

### Approach B: Landmark-Based (Skeleton Models) — Our Choice
- Use MediaPipe to extract a "skeleton" — key points on hands, pose, and face.
- Feed only the coordinates to the model.
- **Pros:** Lightweight (690 numbers vs 2,000,000 pixels), privacy-preserving, blazing fast.
- **Cons:** Depends on MediaPipe's detection quality.

**LexiSight chose Landmarks** because:
- **Privacy:** Skeleton dots cannot reconstruct a face or identity.
- **Speed:** Processing 690 floats is trivially fast vs. a full image tensor.
- **Efficiency:** Runs on a 5-year-old phone without overheating.
- **Generalization:** Landmarks are inherently person-invariant to a degree.

### MediaPipe: The Extraction Engine

Every ~33ms (30 FPS), MediaPipe Holistic processes a camera frame and outputs:
- 33 Pose landmarks (full upper body + hips)
- 21 Left Hand landmarks (wrist, knuckles, fingertips)
- 21 Right Hand landmarks
- 468 Face Mesh landmarks (from which we extract 40 lip-specific points)

Each landmark has (X, Y, Z) coordinates, normalized relative to anatomical reference points (wrist for hands, hip-center for pose, centroid for face).

---

## 6. Version History — The Evolution

| Version | Architecture | Input Dims | Accuracy | Status |
|:---|:---|:---|:---|:---|
| **v1** | Dense Neural Network | 126 | 94.3% | Deployed |
| **v2** | Temporal Transformer | 225 | 95.1% | Deployed |
| **v3** | Multi-Modal Holistic Transformer | 690 | In Progress | Architecture Ready |

- **v1** proved the concept works.
- **v2** proved motion can be captured.
- **v3** is the philosophical completion — capturing the FULL communication context.

---

## 7. v1: The Static Foundation

### What v1 Was
A proof of concept answering: *Can a lightweight neural network, running in a browser, recognize hand shapes from MediaPipe landmarks?* Yes.

### Architecture
- **Model:** Dense Neural Network (5 fully-connected layers)
- **Input:** 126 numbers per frame (21 landmarks × 3 coords × 2 hands)
- **Classes:** 36 (A-Z + 0-9)
- **Training Data:** 71,352 static image extractions
- **Inference Speed:** ~3ms per prediction

### Known Weak Spots

| Class | Accuracy | Issue |
|:---|:---|:---|
| O | 50% | Confused with round shapes |
| M | 67% | Confused with N |
| 6 | 62% | Confused with other digits |

29 out of 36 classes were above 85%. Weak spots are addressed by:
- **Geometric Classifier (`geoClassifier.js`):** Math-based digit classifier — near-perfect for 0-9.
- **Finger Disambiguator (`fingerDisambiguator.js`):** Logic for confused letter pairs (M/N, U/V).

---

## 8. v1 Training — The Overfitting Crisis

### What Happened the First Time

The first temporal model training run revealed **Spatial Memorization** — the model learned WHERE the signer was standing, not WHAT sign they were making.

| Metric | v1 Run |
|:---|:---|
| Training Accuracy | 97-98% |
| Validation Accuracy | **40-50%** |
| Accuracy Gap | **~50%** |
| Training Loss | 0.05 |
| Validation Loss | **2.5+** |

### Root Causes

1. **No Wrist-Relative Normalization:** Raw screen-space coordinates changed based on signer position.
2. **No Scale Normalization:** Closer signers produced larger values than farther ones.
3. **Insufficient Dropout:** Too many parameters, not enough regularization.
4. **No Data Augmentation:** Training data used as-is with no noise, scaling, or temporal jitter.

### The Lesson
A model scoring 97% on training and 40% on validation has learned **nothing useful**. It memorized a specific person's movements in a specific location. It is a person-recognizer, not a sign-recognizer.

---

## 9. v2: The Temporal Transformer

### The Philosophical Shift
Sign language is **motion**. "HELLO" is not a shape — it is the *arc* of a hand moving from the forehead outward. v2 was built to understand time.

### Why Transformer, Not LSTM
LSTMs process one frame at a time, sequentially. They are like reading a book one word at a time and trying to remember page 3.

The **Transformer** looks at the **entire sequence at once** — all 30 frames simultaneously — using **Self-Attention** to decide which frames matter most.

### The Attention Formula

```
Attention(Q, K, V) = softmax((Q × K^T) / √d_k) × V
```

1. **(Q × K^T):** How well does each frame match every other frame?
2. **√d_k:** Scale scores down to prevent explosion
3. **softmax:** Convert to percentages (Frame 15 = 80%, others = 20%)
4. **× V:** Weight actual values by importance
5. **Result:** Mathematical "focus" on the most important moments

### Architecture
1. **Input:** (30 frames × 225 dims) tensor
2. **Projection:** Raw coords → 128-dim mathematical space
3. **Positional Encoding:** Time stamps for frame ordering
4. **Multi-Head Self-Attention:** The "spotlight" mechanism
5. **Feed-Forward Layers:** Process attention-weighted representations
6. **Global Average Pooling:** Compress to single summary vector
7. **Classification Head:** Output probabilities per sign class

---

## 10. v2 Training — Fixing the Overfit

### The Four Fixes

1. **Wrist-Relative Normalization:** All hand landmarks centered on wrist. Position-invariant.
2. **Palm-Size Scaling:** Coordinates divided by max wrist-fingertip distance. Scale-invariant.
3. **Aggressive Dropout (0.3):** 30% of neurons randomly disabled per step.
4. **Data Augmentation:** Gaussian noise, scale jitter (±10%), frame dropout, temporal jitter.

### The Results

| Metric | v1 (Overfit) | v2 (Fixed) |
|:---|:---|:---|
| Training Accuracy | 97-98% | 99.8% |
| Validation Accuracy | 40-50% | **95.1%** |
| Accuracy Gap | ~50% | **4.7%** |
| Training Loss | 0.05 | 0.01 |
| Validation Loss | 2.5+ | 0.18 |
| Top-3 Accuracy | Unknown | 98.0% |
| Top-5 Accuracy | Unknown | 98.5% |

The gap went from **50% to 4.7%**. The difference between memorizing one person and partially learning to read signs.

### The Critical Caveat
The 95.1% was measured with "signer-disjoint splits" — but with only **1.0 unique signers per class**, this split is nominal. The model may still be learning a person, not a language. More on this in the Honest Assessment.

---

## 11. v3: The Multi-Modal Holistic Vision

### Why v3 Exists

v2 works. 95.1% accuracy, 28ms inference, real-time in the browser. But it is still a **hand+pose model**. It sees 33 pose points and 42 hand points. It does not see the face. It does not see the lips. It does not compute motion vectors.

v3 is the architectural expression of the core ideology: **"Sign Language is NOT only fingers."**

### What Changed

| Component | v2 | v3 |
|:---|:---|:---|
| Hand Tracking | 21 landmarks × 2 hands | Same |
| Pose Tracking | 33 landmarks (upper body) | Same |
| Face/Lip Tracking | None | **40 lip landmarks** |
| Motion Vectors | None | **Frame-to-frame deltas for all landmarks** |
| Total Dimensions | 225 per frame | **690 per frame** |
| Frontend MediaPipe | Hands-only API | **Holistic API** (full body + face) |

### The Lip Landmark Selection

From MediaPipe's 468-point Face Mesh, we extract exactly **40 points** focused on the lips:
- 11 outer upper lip points
- 19 outer lower lip points
- 10 inner lip points

These are indices: `[61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 185, 40, 39, 37, 0, 267, 269, 270, 409, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415]`

### Why Lips Matter

In ISL (and most sign languages), certain signs are distinguished **only** by mouth shape:
- Questions are marked by raised eyebrows + specific lip tension
- Negation often involves a head shake + pursed lips
- Many word-level signs have associated "mouthings" (silent pronunciation of the word)

Without lip tracking, these distinctions are invisible to the model.

---

## 12. The 690-Dimension Feature Space

### Feature Layout (Per Frame)

```
Base Features (345 dimensions):
├── Pose:       33 landmarks × 3 coords = 99 dims  (hip-center relative, shoulder-width scaled)
├── Left Hand:  21 landmarks × 3 coords = 63 dims  (wrist-relative, palm-size scaled)
├── Right Hand: 21 landmarks × 3 coords = 63 dims  (wrist-relative, palm-size scaled)
└── Face/Lips:  40 landmarks × 3 coords = 120 dims (centroid-relative, lip-width scaled)

Motion Features (345 dimensions):
├── Pose Delta:       99 dims  (current_frame - previous_frame)
├── Left Hand Delta:  63 dims
├── Right Hand Delta: 63 dims
└── Face/Lips Delta:  120 dims

Total: 345 + 345 = 690 dimensions per frame
```

### Why Motion Vectors Are Critical

Static coordinates tell you WHERE things are. Motion vectors tell you WHERE things are GOING. The sign for "COME" and the sign for "GO" might have identical hand positions at a single moment — but their motion vectors point in opposite directions.

By doubling the feature space with frame-to-frame deltas, we give the model explicit velocity information without requiring it to learn temporal dynamics purely from attention.

### Normalization Strategy

Each landmark group is normalized independently:
- **Pose:** Centered on mid-hip point (average of landmarks 23 and 24), scaled by shoulder width (distance between landmarks 11 and 12)
- **Hands:** Centered on wrist (landmark 0), scaled by max distance from wrist to any fingertip
- **Face/Lips:** Centered on lip centroid (mean of all 40 points), scaled by lip width (distance between corners at indices 0 and 10 of the lip array)

This ensures the model sees **shapes and movements**, not positions and scales.

---

## 13. Dataset Strategy — INCLUDE & CISLR

### INCLUDE Dataset
- **Source:** IIT Madras researchers (Sridhar et al., 2020)
- **Content:** ~4,284 videos covering 278 ISL words across 15 categories
- **Categories:** Adjectives (62), Places (31), Home (27), People (26), Society (23), Days & Time (21), Jobs (16), Colours (11), Clothes (10), Electronics (10), Animals (9), Greetings (9), Transportation (9), Pronouns (8), Seasons (6)
- **Video Formats:** `.mp4`, `.avi`, `.MOV`

### CISLR Dataset
- **Content:** ~7,050 additional videos covering hundreds of everyday phrases
- **Purpose:** Drastically expand vocabulary and add signer diversity

### Static Image Dataset
- **Content:** 71,352 static hand images for A-Z and 0-9
- **Purpose:** Training the v1 Dense model for fingerspelling

### Combined Manifest Stats
- **Total clips:** 71,942+ across 300+ classes
- **Sources:** `include` (590+ clips), `cislr` (7,050+ clips), `static_images` (71,352 clips)

### The Signer Diversity Problem (Critical)
The INCLUDE dataset has approximately **1.0 unique signers per class**. This is the single most critical limitation of the project. More detail in the Honest Assessment section.

---

## 14. The Data Pipeline — From Video to Tensor

### Step 1: Video Extraction (`extract_holistic.py`)
- Scans dataset folder recursively for `.mp4`, `.avi`, `.MOV` files
- Strips number prefixes from folder names (e.g., "1. Loud" → "LOUD")
- Samples **30 evenly spaced frames** from each video
- Runs MediaPipe Holistic on each frame
- Normalizes all landmarks (pose, hands, face) independently
- Computes motion vectors (frame-to-frame deltas)
- Saves as `.npy` array of shape `(30, 690)`
- Filters: Skip if fewer than 5 frames or less than 20% pose detection

### Step 2: Build Manifest (`build_manifest.py`)
- Creates `manifest.csv` — a master catalog listing every `.npy` file with:
  - `clip_path`: File location
  - `class`: Sign name (e.g., "HELLO", "A", "DOCTOR")
  - `source`: Dataset origin ("include", "cislr", "static_images")
  - `signer_id`: Which person performed the sign

### Step 3: Train (`train_holistic.py`)
- Loads `manifest.csv`, splits 85% train / 15% validation
- Signer-disjoint splits (no signer appears in both train and validation)
- 100 epochs with early stopping
- Augmentation: noise, scale jitter, frame dropout

### Step 4: Export (`export_tfjs.py`)
- Converts `.keras` model to `model.json` + weight shards
- Quantized to ~0.6MB
- Outputs to `public/model/` for the browser

---

## 15. The Manifest System

The manifest (`manifest.csv`) is the **library catalog** of the entire dataset.

| clip_path | class | source | signer_id |
|:---|:---|:---|:---|
| include/Greetings/HELLO/MVI_0001.npy | HELLO | include | MVI |
| static_images/A/A_0001.npy | A | static_images | unknown |
| include/People/DOCTOR/MVI_3100.npy | DOCTOR | include | MVI |

Without the manifest, the training script would have to traverse thousands of directories. With it, loading data is a single CSV read.

---

## 16. The Frontend Architecture

### Tech Stack
- **Framework:** React + Vite
- **Styling:** TailwindCSS with OKLCH color system
- **AI Runtime:** TensorFlow.js (WebGL backend)
- **Hand Tracking:** MediaPipe Holistic (CDN-loaded)
- **Speech:** Web Speech API (TTS in Hindi, Tamil, Telugu, English)
- **State:** Custom hooks (`useMediaPipe`, `useClassifier`, `useSettings`)

### Key Components

| Component | Purpose |
|:---|:---|
| `useMediaPipe.js` | Loads MediaPipe Holistic, manages camera, extracts landmarks |
| `useClassifier.js` | Loads TF.js model, runs inference, manages prediction smoothing |
| `useSettings.jsx` | Global settings state with localStorage persistence |
| `Translator.jsx` | Main translation page — camera feed, predictions, sentence builder |
| `PageLoader.jsx` | Cinematic terminal-style loading screen |
| `Navbar.jsx` | Navigation with Settings, Learn, Dictionary, Impact pages |

### The Prediction Smoother
If the AI flickers between predictions, `smoothing.js` waits for **5 consecutive identical predictions** before displaying a word. This eliminates visual noise and makes output reliable.

### Sentence Builder & Grammar Engine
ISL grammar differs from English. The builder rearranges signed words into natural English (e.g., "I → EAT → FOOD" becomes "I am eating food").

---

## 17. The Real-Time Inference Loop

Every frame, the following happens:

```
Camera Frame (33ms)
    ↓
MediaPipe Holistic
    ↓
[33 pose + 21 left hand + 21 right hand + 40 face] landmarks
    ↓
Normalize (wrist-relative, hip-relative, centroid-relative)
    ↓
Compute Motion Vectors (current - previous)
    ↓
Flatten to 690-dim vector
    ↓
Buffer 30 frames → (30, 690) tensor
    ↓
TensorFlow.js Inference (~28ms)
    ↓
Prediction Smoother (5-frame consensus)
    ↓
Display Sign Name + Confidence
```

### Performance Metrics (v2 Baseline)
- **FPS:** 32.4 (camera-limited)
- **Inference Latency:** 28ms (GPU via WebGL)
- **Hand Detection Rate:** 100% (controlled environment)
- **Landmark Jitter:** 0.0113 (very stable)

---

## 18. The 20-Point Audit Framework

The following 20 metrics form the professional audit standard for LexiSight:

### MediaPipe Stability (1-4)
1. **Hand Detection Rate** — `detected_frames / total_frames` (Healthy: >85%)
2. **Landmark Jitter** — Mean frame-to-frame landmark displacement (Lower = better)
3. **Hand Switching Rate** — LEFT/RIGHT label stability across sequence
4. **Missing Landmark Ratio** — `missing_points / total_points`

### Dataset Quality (5-8)
5. **Samples Per Class** — Distribution from min to max
6. **Imbalance Ratio** — `largest_class / smallest_class`
7. **User Diversity** — Unique signers per class
8. **Sequence Length Stats** — Min, max, average frame counts

### Model Behavior (9-12)
9. **Confidence Score Distribution** — Average softmax confidence
10. **Prediction Flicker Rate** — Frame-to-frame prediction instability
11. **Confusion Matrix** — Top confused pairs
12. **Per-Class Accuracy** — Letters vs. Dynamic Words breakdown

### Temporal Analysis (13-14)
13. **Motion Magnitude** — Average displacement across sequence
14. **Gesture Start/End Detection** — Idle frame percentage

### Normalization (15-16)
15. **Wrist Distance Variance** — Consistency of scaling
16. **Coordinate Range** — Verify [-1, 1] bounds

### Advanced (17-20)
17. **Feature Separability** — Inter-class vs. intra-class distance
18. **Occlusion Rate** — Hidden landmark percentage
19. **Confidence Calibration** — Overconfidence measurement
20. **Failure Categorization** — Signer variation vs. occlusion vs. motion blur

---

## 19. Honest Assessment — Where We Stand

### What Is Real

| Metric | Value | Verdict |
|:---|:---|:---|
| MediaPipe Detection Rate | 100% | Excellent (controlled) |
| Landmark Jitter | 0.0113 | Very stable |
| FPS | 32.4 | Camera-limited, acceptable |
| Inference Latency | 28ms | GPU-accelerated, fast |
| Missing Landmarks | 0% | Clean data |
| Data Leakage | None detected | Signer-ID exclusion verified |
| v2 Accuracy | 95.1% | Real achievement — with caveats |

### What Is NOT Real (Yet)

| Metric | Value | Verdict |
|:---|:---|:---|
| Signer Diversity | 1.0 per class | **CRITICAL — Model may have learned a person, not a language** |
| Class Imbalance | 906x | Severe — some classes have 4 samples, others 3,627 |
| Confidence Calibration | 88% accuracy at 95% confidence | Overconfident by ~7 points |
| Low-Light Performance | Fails below 100 lux | Environmental constraint |
| Angle Tolerance | 0-15° only | Narrow operating range |
| Dynamic Failure Rate | 14% | Speed-dependent tracking loss |

### The Signer Diversity Problem — In Full

This is not a tuning problem. It is a **validity problem**.

With 1.0 users per class, the 95.1% accuracy was measured on data from the **same signer** who provided training data. Even with signer-disjoint splits enforced, there is no one left to put in a truly independent validation set.

This means:
- Either the split is nominal (same person, different recordings)
- Or the 95.1% is measured without true signer independence
- Either way, we do not know what happens when a **new human being** stands in front of the camera
- That number could be 95%. It could be 40%. We genuinely do not know.

---

## 20. The Bottlenecks, Ranked Honestly

### 1. Signer Diversity — CRITICAL, BLOCKING
One signer per class means the model has learned **a person, not a language**. Before any product claim, we need a minimum of **5-10 diverse signers per class**. This is a data collection effort, not an ML effort.

### 2. Dataset Imbalance — Serious, Addressable
906x imbalance with some classes at 4 samples is real. But solvable with weighted loss functions, augmentation, and targeted data collection. Well-understood territory.

### 3. Overconfident Calibration — Meaningful, Fixable
88% accuracy at 95% confidence means overconfidence by ~7 points. In a product context, users trust confident predictions. Temperature scaling post-training can fix most of this.

### 4. Environmental Constraints — Real, Scoped
Failing below 100 lux and only working at 0-15° are genuine limitations. But they are fine for a **first product** designed around controlled environments — hospital kiosks, school setups, desktop apps. We don't need to solve arbitrary outdoor signing on day one.

### 5. 14% Dynamic Failure Rate — Acceptable with Caveats
Signer speed dependence is expected. 14% is not catastrophic. Temporal smoothing and adaptive thresholding can reduce this. For a learning tool or guided communication scenario, this is workable.

---

## 21. What v3 Actually Needs to Become Real

### The Data Strategy Must Change

The 690-dimension holistic feature space is the right architectural direction. The re-extraction is the right step. But the data collection strategy needs to change alongside it.

**Cut vocabulary depth. Expand signer breadth.**

Instead of 298 classes with 1 signer → target **80-100 high-value classes with 8-10 signers each**.

This gives:
- Real signer-disjoint validation
- The first **honest** accuracy number
- A foundation to scale vocabulary once generalization is proven

### Why Holistic Features Should Help

The holistic features — pose, lips, motion vectors — should genuinely help with signer independence because they capture more of the **structural invariants** of a sign rather than idiosyncratic hand geometry.

But this hypothesis needs to be **tested with real multi-signer data**, not assumed.

---

## 22. The Product Vision — Deployment Targets

### Immediate Targets (Controlled Environments)
- **Hospital Kiosks:** Fixed camera, controlled lighting, guided interaction
- **School Classrooms:** Teacher-facing setups with consistent positioning
- **Desktop Applications:** Personal use for DHH individuals
- **Learning Tools:** Interactive ISL learning with real-time feedback

### Future Targets (Once Generalization is Proven)
- **Mobile App:** Outdoor use, varying lighting, diverse angles
- **Video Conferencing Integration:** Real-time ISL translation in Zoom/Meet
- **Public Signage:** ISL-aware information displays

---

## 23. The Roadmap — Phases 1 through 5

### Phase 1: Foundation (COMPLETE)
- React + Vite frontend with TensorFlow.js AI core
- MediaPipe HandLandmarker for 21-point hand tracking
- Privacy architecture: process frames, delete instantly

### Phase 2: Data Engineering (COMPLETE)
- Scripts to convert raw videos into normalized landmark arrays
- Ingesting INCLUDE (278 ISL words) and CISLR datasets
- Filtering low-quality detections, building manifest

### Phase 3: ML Development (v1 + v2 COMPLETE, v3 IN PROGRESS)
- Dense Neural Network for static signs (A-Z, 0-9) — v1
- Temporal Transformer for moving words — v2
- Multi-Modal Holistic Transformer with 690-dim features — v3

### Phase 4: Frontend Intelligence (IN PROGRESS)
- Prediction smoother (5-frame consensus) — Done
- ISL-to-English sentence builder — Done
- Multi-lingual TTS (Hindi, Tamil, Telugu) — Done
- Settings engine with localStorage persistence — Done
- Cinematic loading screen — Done
- OKLCH color system and dark mode — Done

### Phase 5: Product Polish (PLANNED)
- Progressive Web App for offline mobile installation
- Impact Dashboard showing "Barriers Broken"
- Multi-signer data collection campaign
- Hospital and school pilot programs
- Continuous sign recognition (sentence-level, not word-level)

---

## 24. Design Philosophy — The UI/UX Ideology

### Premium, Not Minimum Viable

LexiSight is not a prototype that looks like a prototype. The frontend was designed to feel **premium** from the first interaction:

- **OKLCH Color System:** Curated dark mode with perceptually uniform colors — not generic hex values, but scientifically calibrated color coordinates for consistent appearance across displays.
- **Cinematic Loading Screen:** A terminal-style boot sequence that conveys technical sophistication while loading heavy assets (MediaPipe, TF.js models).
- **Status Bar:** Real-time indicators for HAND, POSE, and FACE detection — the user sees what the AI sees.
- **Micro-Animations:** Smooth transitions for prediction displays, mode switches, and camera toggles.

### Accessibility First

The irony of an accessibility tool that is itself inaccessible is unacceptable:
- Multi-language TTS output (not just English)
- High contrast mode for low-vision users
- Keyboard navigation for all controls
- Settings persistence so preferences survive page reloads

---

## 25. The Real Picture

Your engineering foundation is genuinely solid. 100% MediaPipe detection rate, jitter at 0.0113, 32.4 FPS, 28ms inference latency, zero missing landmarks, no data leakage — these are not beginner numbers. The real-time pipeline works. v2 at 95.1% is a real achievement. The architecture isn't the problem.

The problem is exactly one thing, stated clearly in your own report: **1.0 users per class.**

### Why That Single Number Is the Whole Conversation

Everything else in this report — the imbalance ratio, the dynamic failure rate, the overconfidence, the low-light failures — those are real issues but they're solvable engineering problems. The signer diversity issue is different in kind. It's not a tuning problem. It's a validity problem.

Here's what it means concretely: your 95.1% v2 accuracy was measured on data from the same signer who provided training data. With signer-disjoint splits enforced (as your report says), but only 1 user per class, there is no one left to put in the validation set. So either the split is nominal — same person, different recordings — or the 95.1% is measured without true signer independence. Either way, you don't yet know what the model does when a new human being stands in front of the camera. That number could be 95%. It could be 40%. You genuinely don't know, and that's the gap between where you are and where a product needs to be.

The v3 re-extraction is the right move, but only if the new data collection brings in new signers. More data from the same person at 690 dimensions is still a single-signer model with better features.

### The Bottlenecks, Ranked Honestly

1. **Signer diversity — critical, blocking**
One signer per class means the model has learned a person, not a language. Before any product claim can be made, you need a minimum of 5-10 diverse signers per class. This is a data collection effort, not an ML effort.

2. **Dataset imbalance — serious, addressable**
906x imbalance with some classes at 4 samples is real. But this is solvable with weighted loss functions, augmentation, and targeted data collection for underrepresented classes. It won't fix itself but it's well-understood territory.

3. **Overconfident calibration — meaningful, fixable**
88% accuracy at 95% confidence means the model is overconfident by about 7 points. In a product context this matters a lot — users trust confident predictions. Temperature scaling post-training can fix most of this without retraining.

4. **Environmental constraints — real, scoped**
Failing below 100 lux and only working at 0-15 degrees are genuine limitations but they're actually fine for a first product if you design around them. A hospital kiosk, a school setup, a desktop app — these are controlled environments. You don't need to solve arbitrary outdoor signing on day one.

5. **14% dynamic failure rate — acceptable with caveats**
Signer speed dependence is expected and 14% is not catastrophic. Temporal smoothing and adaptive thresholding can reduce this further. For a learning tool or guided communication scenario this is workable.

### What v3 Actually Needs to Become Real

The 690-dimension holistic feature space is the right architectural direction. The re-extraction is the right step. But the data collection strategy needs to change alongside it:

Cut vocabulary depth temporarily and expand signer breadth. Instead of 298 classes with 1 signer, target 80-100 high-value classes with 8-10 signers each. That gives you real signer-disjoint validation and your first honest accuracy number. Once you have that, you'll know whether your architecture is actually working or whether v2's 95.1% was measuring something other than generalization.

The holistic features — pose, lips, motion vectors — should genuinely help with signer independence because they capture more of the structural invariants of a sign rather than idiosyncratic hand geometry. But that hypothesis needs to be tested with real multi-signer data, not assumed.

---

*This document is the single source of truth for what LexiSight believes, what it has built, what it has proven, and what it still needs to prove. Come back to it whenever you need to remember where you stand and where you need to go.*

*63 million Indians are waiting to be heard. LexiSight is the answer — once it learns to listen to more than one person.*

---
**END OF IDEOLOGY DOCUMENT**
**LexiSight | Built for AIESEC Youth Speak Ideathon 2026**

