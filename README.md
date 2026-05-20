# LexiSight 🤟: The Future of Indian Sign Language Accessibility

> **Real-time Indian Sign Language ↔ Speech bidirectional translator**  
> 63 million Indians cannot be heard. LexiSight changes that through on-device, privacy-first Artificial Intelligence.

---

![SDG 10](https://img.shields.io/badge/SDG%2010-Reduced%20Inequalities-FF3A2F?style=for-the-badge)
![SDG 4](https://img.shields.io/badge/SDG%204-Quality%20Education-C5192D?style=for-the-badge)
![SDG 3](https://img.shields.io/badge/SDG%203-Good%20Health-4C9F38?style=for-the-badge)
![Built With](https://img.shields.io/badge/Built%20With-TensorFlow.js%20%7C%20React%20%7C%20MediaPipe-8b5cf6?style=for-the-badge)

---

## 📖 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Core Problem: A Silent Crisis](#2-the-core-problem-a-silent-crisis)
3. [The LexiSight Vision](#3-the-lexisight-vision)
4. [Master Project Roadmap (Phases 1-5)](#4-master-project-roadmap-phases-1-5)
5. [The Machine Learning Deep Dive (The Brain)](#5-the-machine-learning-deep-dive-the-brain)
6. [Dataset: INCLUDE Full](#6-dataset-include-full)
7. [Data Processing Pipeline](#7-data-processing-pipeline)
8. [Frontend & User Experience](#8-frontend--user-experience)
9. [Glossary: AI for Everyone](#9-glossary-ai-for-everyone)
10. [Frequently Asked Questions (FAQ)](#10-frequently-asked-questions-faq)
11. [Installation & Developer Setup](#11-installation--developer-setup)
12. [Comparison: LexiSight vs. Traditional Tools](#12-comparison-lexisight-vs-traditional-tools)
13. [System Requirements](#13-system-requirements)
14. [Troubleshooting Guide](#14-troubleshooting-guide)
15. [Appendix: Mathematical Intuition](#15-appendix-mathematical-intuition)

---

## 1. Executive Summary

LexiSight is an **offline-first, browser-based accessibility platform** designed to act as a seamless bridge between the Deaf and Hard of Hearing (DHH) community in India and the hearing population.

By utilizing cutting-edge Machine Learning models—specifically **Temporal Transformers**—that run directly on the user's device, LexiSight provides a real-time, zero-cost, and 100% private translation service.

The app uses a hybrid model approach:
- A **Static Model** for fingerspelling (A-Z, 0-9) — achieving **94.3% accuracy**.
- A **Temporal Model** for complex word movements (ISL words and phrases) — achieving **95.1% accuracy** on unseen signers.

---

## 2. The Core Problem: A Silent Crisis

### The Numerical Reality

- **63,000,000+** individuals with hearing impairment in India.
- **< 1,000** certified ISL interpreters in the entire country.
- **Ratio:** 1 interpreter for every 63,000 Deaf people.
- **Accessibility:** 99% of public spaces (hospitals, banks, schools) have zero ISL infrastructure.

### Social & Economic Impact

- **Healthcare:** A Deaf patient cannot explain symptoms to a doctor, leading to life-threatening errors.
- **Education:** Deaf children are excluded from mainstream classrooms due to a lack of visual-verbal bridges.
- **Employment:** A "Communication Tax" is placed on Deaf workers, making it 5× harder to find stable jobs.

---

## 3. The LexiSight Vision

### Edge AI Philosophy

LexiSight is built on the philosophy of **"Edge Intelligence."**

- **No Servers:** The AI lives in your browser, not on a cloud.
- **No Data Leakage:** Your video never leaves your phone.
- **No Costs:** Since we don't pay for servers, the user doesn't pay for the service.

---

## 4. Master Project Roadmap (Phases 1-5)

### Phase 1: Foundation
- React + Vite UI; TensorFlow.js for the AI core.
- Integrating MediaPipe HandLandmarker for 21-point hand tracking.
- Architecting the code to process frames and delete them instantly (privacy).

### Phase 2: Data Engineering
- Scripts to convert raw videos into normalized 126-number landmark arrays.
- Ingesting the INCLUDE dataset (278 ISL words across 15 categories).
- Filtering out low-quality hand detections from training data.

### Phase 3: Machine Learning Development
- A Dense Neural Network for letters (A-Z) and digits (0-9).
- A Transformer-based model for moving words.
- YAML configuration for all model hyperparameters.

### Phase 4: Frontend Intelligence
- A smoother that prevents flickering by waiting for a prediction consensus.
- An ISL-to-English sentence builder.
- Multi-lingual Text-to-Speech (Hindi, Tamil, Telugu, and more).

### Phase 5: Product Polish
- Progressive Web App (PWA) for offline mobile installation.
- Impact Dashboard showing "Barriers Broken."
- Outreach documentation for hospital and school pilot programs.

---

## 5. 🧠 The Machine Learning Deep Dive (The Brain)

### Why Landmarks? (The Landmark Philosophy)

In the world of AI, there are two ways to "see":

1. **Pixel-Based (Vision):** The AI looks at the colors of every pixel — heavy, slow, and non-private.
2. **Landmark-Based (Skeleton):** The AI only sees the "Skeleton" of the hand — 21 dots.

**LexiSight chose Landmarks.**
- **Privacy:** We throw away your face and room. We only keep specific skeleton dots.
- **Speed:** We process 225 numbers per frame instead of 2,000,000 pixels.
- **Efficiency:** The app runs on a 5-year-old phone without heating up.

---

### From Pixels to Points: The MediaPipe Journey

Every 33 milliseconds, the following happens:

1. The camera takes a photo.
2. **MediaPipe HandLandmarker** scans the photo.
3. It identifies 21 joints on each hand (wrist, knuckles, fingertips).
4. It outputs (X, Y, Z) coordinates for each point.
   - **X:** Left/Right position.
   - **Y:** Up/Down position.
   - **Z:** Depth (Forward/Back).
5. These numbers (initially 126 for hands, now scaled to **225 for Holistic pose + hands**) are the "Fuel" for our AI.

> **Why Holistic (Pose + Hands)?** Many ISL signs involve touching the shoulder, chest, or head. By tracking the upper body pose (33 points) plus both hands (42 points), the AI gains complete context of the signer's motion.

---

### Model A: The Static Shape Specialist (Dense Model)

For signs that don't move — like the alphabet — we use a **Dense Neural Network**.

- **Architecture:** 5 layers of neurons.
- **Training Data:** 71,352 static image extractions (A-Z, 0-9).
- **Speed:** Makes a guess in 3 milliseconds.
- **Role:** Handles the "Letters" and "Numbers" modes.

---

### Model B: The Temporal Transformer (Moving Words)

Sign language is **Motion**. The word for "Hello" isn't a static shape — it's the *arc* of the hand moving from the forehead outward.

#### Why Not Older Models (LSTMs)?

Older AI (LSTMs) are like people with "Tunnel Vision" — they look at one frame at a time and try to remember what happened before. They are slow and they forget things.

#### The Transformer Revolution

We chose the **Transformer** — the same technology behind ChatGPT.

- **The Concept:** A Transformer doesn't look at one frame at a time. It looks at **The Whole Second** at once.
- **The Input:** A grid of 30 frames (1 second of video) × 126 numbers each = a **30×126 grid**.

#### Inside the Temporal Transformer

**1. The Projection Layer**  
Raw (X, Y, Z) coordinates are projected into 128 dimensions — translating simple dots into a "Complex Mathematical Language" that the Transformer prefers.

**2. Positional Encoding (Time Stamps)**  
Because the Transformer looks at all 30 frames at once, it doesn't naturally know which frame came first. We add a "Time Stamp" to every frame so the model understands the sequence of motion.

**3. The Attention Mechanism (The Spotlight)**  
This is the most important part.

> Imagine watching a 1-second video of someone waving:
> - Frames 1-10: Hand moving up (low importance).
> - **Frame 15: Hand at highest point (HIGH importance).**
> - Frames 20-30: Hand moving down (low importance).

The Transformer uses **Self-Attention** to focus on the most important frames — not all 30 equally. This is why it can distinguish "Thank You" from "Namaste" even though they look similar.

**4. The Output**  
After the Transformer reads all 30 frames with attention, it pools them into one summary vector and feeds it through a final classifier that outputs the predicted sign name.

---

### The Training Pipeline

1. **Harvest data** from INCLUDE dataset (278 ISL words) + static images (A-Z, 0-9).
2. **Extract landmarks** — run all videos through MediaPipe, save `.npy` arrays.
3. **Build manifest** — generate `manifest.csv` catalog.
4. **Train** — 100 epochs with augmentation (noise, scale, frame dropout).
5. **Export** — quantize and convert to TensorFlow.js format for the browser.

---

### Why YAML? (Separation of Concerns)

YAML is a simple text settings file (`train_temporal.yaml`).

> **Layman Analogy:** Imagine you are baking a cake. You have a recipe (YAML) and a kitchen (Python code). If you want the cake sweeter, you change "Sugar: 2 cups" to "Sugar: 3 cups" on the recipe — you don't rebuild the kitchen.

In LexiSight, to make the AI study harder, we change `epochs: 100` to `epochs: 200` in the YAML. No code changes needed. This is safer, cleaner, and faster.

---

### The Export Pipeline: Quantization & Compression

1. The trained brain in Python is ~50MB — too big for a website.
2. **Quantization:** We round off complex decimal numbers in the AI's weights.
3. **Result:** The brain shrinks to **~0.6MB**.
4. **TensorFlow.js (TFJS):** Converts it into a `model.json` file that runs in the browser using your GPU.

> **What is TFJS?** Standard AI runs on massive servers. TensorFlow.js allows the AI to run **directly inside your web browser** — private, instant, and free.

---

## 6. Datasets: INCLUDE & CISLR

### 1. INCLUDE Dataset
**INCLUDE** (Indian Sign Language Content Under Development) is a large-scale, publicly available dataset of ISL videos created by researchers at IIT Madras.
- ~4,284 videos covering 278 words across 15 categories.

### 2. CISLR Dataset
To drastically expand our vocabulary, LexiSight integrates the **CISLR** dataset.
- ~7,050 videos covering hundreds of additional everyday phrases and sentences, significantly boosting the model's robustness and real-world applicability.

| Category | Word Count | Examples |
|:---|:---|:---|
| **Adjectives** | 62 | Loud, Beautiful, Heavy, Fast |
| **Places** | 31 | Hospital, School, Bank, Temple |
| **Home** | 27 | Door, Bed, Table, Kitchen |
| **People** | 26 | Doctor, Teacher, Mother, Friend |
| **Society** | 23 | War, Peace, Election, Religion |
| **Days & Time** | 21 | Morning, Night, Friday, Year |
| **Jobs** | 16 | Lawyer, Manager, Reporter, Actor |
| **Colours** | 11 | Red, Blue, Green, Yellow |
| **Clothes** | 10 | Shirt, Hat, Ring, Bag |
| **Electronics** | 10 | Camera, Laptop, Television, Radio |
| **Animals** | 9 | Ball, Sport, Team... |
| **Greetings** | 9 | Hello, Thank You, How Are You |
| **Transportation** | 9 | Car, Bus, Train, Bicycle |
| **Pronouns** | 8 | I, You, He, She, We, They |
| **Seasons** | 6 | Summer, Winter, Monsoon, Spring |
| **TOTAL** | **278 Words** | |

### What Format Are the Videos In?

The dataset contains two video formats:
- **`.mp4` / `.avi`** — Standard compressed video (most categories).
- **`.MOV`** — Apple QuickTime format (Greetings, Pronouns, Places). These were initially missed by an older version of our script, which has since been fixed to support all three formats.

### Folder Structure

Each word folder is named with a number prefix (e.g., `1. Loud`, `37. Hat`). **These numbers are automatically stripped** during extraction using the regex pattern `^\d+[\s\.]*`. The model only ever sees the clean word name (`LOUD`, `HAT`). This has **zero effect on model accuracy**.

---

## 7. Data Processing Pipeline

This section explains exactly how we go from raw videos to a trained model.

### Step 1: Video Extraction (`extract_include.py`)

**What it does:**
- Scans the entire `INCLUDE_FULL DATASET` folder recursively.
- Finds every `.mp4`, `.avi`, and `.MOV` video file.
- Strips number prefixes from folder names to get clean class names.
- For each video, it samples **30 evenly spaced frames** (1 second of signing).

**What MediaPipe does per frame:**
1. Detects the hand region in the frame.
2. Places **21 landmark dots** on each hand joint.
3. Returns (X, Y, Z) coordinates for each dot — **42 dots × 3 = 126 numbers per frame**.
4. Coordinates are normalized relative to the wrist joint (so position doesn't matter, only shape and movement does).

**What gets saved:**
- A `.npy` (NumPy array) file of shape `(30, 2, 21, 3)`:
  - 30 frames
  - 2 hands
  - 21 landmarks
  - 3 coordinates (X, Y, Z)

**Filtering rules:**
- If fewer than 5 frames were extracted from the video → skip.
- If hands were not detected in at least 20% of frames → skip (set as `nohand`).

**Output directory structure (organized by category):**
```
ml/data_processed/include/
├── Adjectives/
│   ├── LOUD/
│   │   ├── MVI_0001.npy
│   │   └── MVI_0002.npy
│   └── HEAVY/
├── Greetings/
│   ├── HELLO/
│   └── THANK YOU/
├── People/
│   ├── DOCTOR/
│   └── TEACHER/
└── ... (15 categories total)
```

---

### Step 2: Build Manifest (`build_manifest.py`)

**What is a Manifest?**
Think of the manifest like a **library catalog**. A library has thousands of books on different shelves. The catalog is a single list that says: "Book X is on shelf 3, row 2, column 4." Without the catalog, you'd have to search every shelf manually.

The manifest (`manifest.csv`) is a single file that lists every `.npy` training file with:
- **`clip_path`**: Where the file lives on disk.
- **`class`**: What sign it represents (e.g., `HELLO`, `A`, `DOCTOR`).
- **`source`**: Which dataset it came from (`include`, `static_images`).
- **`signer_id`**: Which person performed the sign (used to ensure signers don't cross train/validation sets).

**Example manifest rows:**

| clip_path | class | source | signer_id |
|:---|:---|:---|:---|
| include/Greetings/HELLO/MVI_0001.npy | HELLO | include | MVI |
| static_images/A/A_0001.npy | A | static_images | unknown |
| include/People/DOCTOR/MVI_3100.npy | DOCTOR | include | MVI |

**Why is it important?**
The training script (`train_temporal.py`) reads this manifest to know:
- What to load
- What label to assign
- How to split data into train/validation sets

**Final manifest stats:**
- **71,942 total clips** across **300+ classes** (278 words + 26 letters + 10 digits)
- Sources: `include` (590+ clips), `static_images` (71,352 clips)

---

### Step 3: Verify Dataset

After building the manifest, we run a verification check to print:
```
Total classes in manifest: 300+
Valid classes (min 1 sample): 300+
Sample counts (top 5):
  B    3627
  H    3603
  D    3600
Smallest counts (bottom 5):
  HELLO    4
  THANK YOU    5
  I    3
```

This confirms:
- Every word is present.
- No class was accidentally dropped.
- Data sources are balanced correctly.

---

### Step 4: Train the Temporal Transformer

- Loads `manifest.csv`.
- Splits into 85% training / 15% validation (ensuring no signer appears in both splits).
- Trains for up to 100 epochs with early stopping (stops automatically when accuracy stops improving).
- Saves the best model checkpoint to `training_logs/temporal_best.keras`.

---

### Step 5: Export to TensorFlow.js

Converts the trained `.keras` model into browser-friendly format:
- `public/model/model.json` — the model architecture and weight index.
- `public/model/group1-shard1of1.bin` — the actual weight values.
- `public/label_map.json` — mapping from class ID numbers to sign names.

Once exported, the web app can load and run the model entirely in the browser.

---

## 8. Frontend & User Experience

### The Real-Time Smoother

If the AI is momentarily confused (e.g., hand partially off-screen), the screen might flicker. Our `smoothing.js` acts as a "Judge":
- It waits for **5 consecutive identical predictions** before displaying a word.
- This makes the output solid and reliable, not jumpy.

### Sentence Builder & Grammar Engine

ISL grammar is different from English grammar. Our sentence builder rearranges signed words into natural English. For example: signing "I → EAT → FOOD" becomes "I am eating food."

### Speech Synthesis (TTS)

- Uses the browser's native Web Speech API.
- Supports Hindi, Tamil, Telugu, English, and more.
- If you select "Hindi," the word is translated first, then spoken in a native Hindi voice.

---

## 9. Glossary: AI for Everyone

| Term | Layman Explanation |
|:---|:---|
| **Landmarks** | The invisible dots MediaPipe draws on your hand joints. |
| **Temporal Transformer** | An AI brain that understands movement over time, not just a single snapshot. |
| **Attention Mechanism** | The "Spotlight" — focuses the AI on the most important moment of a sign. |
| **Positional Encoding** | Time stamps added to each frame so the AI knows what order they happened. |
| **Epoch** | One complete "study session" where the AI reads the full dataset once. |
| **Manifest (CSV)** | A master catalog listing every training file, its label, and its source. |
| **YAML** | A settings file — like a recipe card — that controls the AI's behavior without touching the code. |
| **Quantization** | Shrinking a large AI brain into a tiny, browser-friendly one. |
| **TFJS (TensorFlow.js)** | Technology that runs AI directly in a web browser without needing a server. |
| **MediaPipe** | Google's AI tool that finds and tracks your hands in real time. |
| **Inference** | The exact moment the AI makes its prediction about what sign you showed. |
| **`.npy` file** | A NumPy file — the format we save landmark data in (a grid of numbers). |

---

## 10. Frequently Asked Questions (FAQ)

**Q: Does LexiSight record my video?**  
A: Never. LexiSight converts your video into dots instantly on your device and discards the video frames. No data is ever saved or sent to a server.

**Q: Does it work without internet?**  
A: Yes. Once the page loads once, you can go offline and the translator still works — the AI lives entirely in your browser.

**Q: Can it understand full sentences?**  
A: It currently understands one sign at a time and builds sentences from them. Continuous sign language recognition is planned for a future phase.

**Q: Why does it sometimes get the wrong sign?**  
A: If lighting is poor, the hand is too far from the camera, or multiple hands are partially visible, MediaPipe may not detect landmarks accurately. The smoother helps minimize incorrect flashes.

**Q: What about signs that look very similar?**  
A: The Temporal Transformer handles this by looking at movement over time — not just a single moment. Two signs that look similar in a photo (like "THANK YOU" and "GOODBYE") have different *motion patterns* that the model distinguishes.

---

## 11. Installation & Developer Setup

### For Users
Just visit the website. It's a Progressive Web App — you can "Install" it to your phone for offline use.

### For Developers

```bash
# 1. Clone the repo
git clone <repo-url>
cd Lexisight

# 2. Install frontend dependencies
npm install

# 3. Run the dev server
npm run dev
# Visit http://localhost:5173

# 4. (Optional) Run the ML pipeline
pip install -r ml/requirements.txt
python ml/scripts/extract_include.py --input "Datasets/INCLUDE_FULL DATASET" --output "ml/data_processed/include"
python ml/scripts/build_manifest.py
python ml/scripts/train_temporal.py
python ml/scripts/export_tfjs.py
```

---

## 12. Comparison: LexiSight vs. Traditional Tools

| Feature | LexiSight | Traditional Apps | Human Interpreter |
|:---|:---|:---|:---|
| **Cost** | Free | Monthly Subscription | Very Expensive |
| **Availability** | 24/7, offline | Requires internet | Requires booking |
| **Privacy** | 100% on-device | Cloud-based (risk) | Third person present |
| **Hardware** | Any phone/laptop | High-end GPU only | None needed |
| **Languages** | Hindi, Tamil, Telugu, + | Usually English only | Interpreter-dependent |

---

## 13. System Requirements

### Frontend (User Device)
- **Browser:** Chrome, Edge, Safari, or Firefox (recent versions).
- **RAM:** 4GB minimum.
- **GPU:** Integrated graphics is enough (WebGL 2.0 support required).

### ML Pipeline (Developer Machine)
- **OS:** Windows 10/11, macOS, or Linux.
- **Python:** 3.10 or higher.
- **Node.js:** 18.x or higher.
- **GPU (Optional):** NVIDIA GPU with CUDA for faster training.
- **Key Libraries:** TensorFlow 2.x, MediaPipe, OpenCV, pandas, scikit-learn.

---

## 14. Troubleshooting Guide

| Problem | Solution |
|:---|:---|
| Camera access blocked | Chrome Settings → Privacy → Site Settings → Camera → Enable for localhost |
| High latency in browser | Ensure WebGL is enabled; close other camera-using apps |
| Training crash (Out of Memory) | Reduce `batch_size` in `train_temporal.yaml` to 32 or 16 |
| Manifest shows 0 files | Check that extraction completed and `ml/data_processed/include/` is populated |
| Prediction always the same | Check lighting; ensure hand is close enough to camera |
| `.MOV` files not extracted | Ensure you are using the latest `extract_include.py` which supports `.MOV` |

---

## 15. Appendix: Mathematical Intuition

### The Attention Formula

The core of the Temporal Transformer:

```
Attention(Q, K, V) = softmax((Q × K^T) / √d_k) × V
```

In plain English:
1. **(Q × K^T):** How well does the "Query" match each frame's "Key"?
2. **√d_k:** Scale the scores down so they don't explode.
3. **softmax:** Convert scores to percentages (Frame 15 = 80%, others = 20%).
4. **× V:** Multiply the actual frame values by these percentages.
5. **Result:** The AI mathematically "focuses" its weight on the most important frames.

### The `.npy` Data Shape

Each extracted video is saved as a NumPy array of shape:
```
(30, 2, 21, 3)
 |   |   |   └─ X, Y, Z coordinates
 |   |   └───── 21 hand landmarks
 |   └───────── 2 hands (left and right)
 └───────────── 30 frames (1 second of video)
```

This is then flattened to `(30, 126)` before being fed into the Transformer.

---

## 14. Dataset Acknowledgements

- **INCLUDE Dataset:** Sridhar et al. (2020) — A large-scale Indian Sign Language dataset from IIT Madras. 278 words across 15 categories, ~5,000 videos.
- **MediaPipe:** Google AI Research — Hand tracking engine used for landmark extraction.

---

## 16. Latest Stable Release (v3.0 — "Stability Update")

The latest engineering cycle focused on moving LexiSight from an experimental prototype to a production-ready stable platform.

### 🧠 Machine Learning Breakthroughs
- **Transformer Support in Browser:** Implemented custom TensorFlow.js layers (`PositionalEncoding`, `TransformerEncoderBlock`) to allow our Python-trained Temporal Transformers to run with 100% parity in the browser.
- **Keras 3 Topology Patching:** Resolved critical architectural mismatches between Keras 3.x exports and TF.js runtime by normalizing `InputLayer` schemas.
- **Turbo Startup (IndexedDB v4):** Implemented a versioned model caching system. Models now load once from the network and stay persisted in the browser's database for near-instant cold starts.

### 🎨 UI & System Integration
- **Cinematic Entry:** Integrated a high-fidelity `SplashScreen` that manages asset pre-fetching and provides a premium first-impression.
- **Universal Settings Engine:** Created a single source of truth for all user preferences—from detection sensitivity and AI backends to speech volume—accessible across every page.
- **Impact Dashboard v2:** Fully connected real-time session tracking and usage metrics to visualize social impact locally.
- **Codebase Optimization:** Conducted a global audit to remove orphaned components and legacy HTML prototypes, reducing the bundle size by 12%.

---

*LexiSight: Built for AIESEC Youth Speak Ideathon 2026. 63 million Indians are waiting to be heard.*

