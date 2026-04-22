# LexiSight 🤟

> **Real-time Indian Sign Language ↔ Speech bidirectional translator**  
> 63 million Indians cannot be heard. LexiSight changes that.

![SDG 10](https://img.shields.io/badge/SDG%2010-Reduced%20Inequalities-FF3A2F?style=flat-square)
![SDG 4](https://img.shields.io/badge/SDG%204-Quality%20Education-C5192D?style=flat-square)
![SDG 3](https://img.shields.io/badge/SDG%203-Good%20Health-4C9F38?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-00d4ff?style=flat-square)
![Built With](https://img.shields.io/badge/Built%20With-TensorFlow.js%20%7C%20React%20%7C%20MediaPipe-8b5cf6?style=flat-square)
![AIESEC](https://img.shields.io/badge/AIESEC-Youth%20Speak%20Ideathon%202026-ffaa00?style=flat-square)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤟 **Sign → Speech** | Real-time ISL gesture recognition → spoken Indian English |
| 🎤 **Speech → Sign** | Speak words → animated hand avatar signs back in ISL |
| 📚 **Learn ISL** | Interactive courses: Alphabet, Greetings, Medical, Emergency |
| 📊 **Impact Dashboard** | Live SDG impact stats and global reach visualization |
| 📖 **ISL Dictionary** | Searchable visual reference for 37+ ISL gestures |
| 👥 **Community Bank** | Contribute new signs to expand the vocabulary |
| 🏥 **Phrase Packs** | Domain-specific phrases: Medical, Workplace, Education |
| 📱 **Offline PWA** | Install on any device, works without internet |

## 🧠 How It Works

```
Webcam → MediaPipe (21 landmarks) → Normalize (63 features) → StandardScaler → TF.js Dense NN → Softmax → Speak
```

All processing happens **100% on-device**. No video, audio, or hand data ever leaves your browser.

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/jashvanthh/Lexisight.git
cd Lexisight

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

> **Note**: The ML model files are not included in the repo. The app automatically falls back to a geometric gesture classifier until you train and place your model in `public/model/tfjs_model/`.

## 🤖 Train Your Own Model

```bash
# Install Python dependencies
pip install -r scripts/requirements.txt

# Process dataset (place ISL images in Datasets/)
python scripts/process_dataset.py

# Train the model (exports to public/model/tfjs_model/)
python scripts/train_model.py

# Generate synthetic two-hand training data (optional)
python scripts/generate_twohand_synthetic.py
```

Expected accuracy: **92–97%** on ISL alphabet + common words.

## 🛠️ Tech Stack

| Technology | Role |
|-----------|------|
| React 18 + Vite | UI framework |
| TensorFlow.js | In-browser ML inference |
| MediaPipe Hands | 21-point hand landmark detection |
| Web Speech API | TTS + STT (no API key needed) |
| Tailwind CSS | Styling |
| Vite PWA | Offline-first Progressive Web App |

## 🌍 SDG Alignment

| Goal | How |
|------|-----|
| SDG 3 — Good Health | Medical phrase pack for hospital communication |
| SDG 4 — Quality Education | Interactive ISL learning courses |
| SDG 8 — Decent Work | Workplace phrase pack for employment |
| SDG 10 — Reduced Inequalities | Core translator for 63M deaf Indians |
| SDG 17 — Partnerships | Community gesture contribution system |

## 📁 Project Structure

```
src/
├── components/       # Reusable UI components
├── hooks/            # Custom React hooks (MediaPipe, TF.js, Speech)
├── pages/            # Route pages (Landing, Translator, Learn, Impact, Dictionary)
├── utils/            # Gesture classifiers, landmark normalization
├── data/             # Phrase packs, lesson plans, ISL dictionary data
└── styles/           # Global CSS design system
scripts/
├── process_dataset.py     # Extract landmarks from images
├── train_model.py         # Train + export TF.js model
└── generate_twohand_synthetic.py  # Synthetic two-hand data augmentation
```

## 📄 License

MIT — free to use, modify, and distribute.

---

*Built with ♥ for AIESEC Youth Speak Ideathon 2026 · IIIT Hyderabad*
