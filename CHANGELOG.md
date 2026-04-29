# Changelog

All notable changes to LexiSight will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `ml/` top-level directory with structured ML pipeline
- `ml/configs/class_merge.yaml` — canonical vocabulary mapping across datasets
- `ml/configs/train_temporal.yaml` — temporal model hyperparameters
- `ml/eval/metrics.json` — machine-readable accuracy metrics (README reads this)
- `ml/requirements.txt` — complete Python dependencies
- `docs/` directory for architecture docs and protocols
- `CHANGELOG.md` — this file

### Changed
- Repo restructured: training scripts moved from `scripts/` → `ml/scripts/`
- `hand_landmarker.task` moved from `scripts/` → `ml/assets/`
- `.gitignore` expanded for new `ml/data/`, `ml/data_processed/` paths
- `run_pipeline.ps1` updated for new directory layout
- `README.md` rewritten with honest accuracy metrics from `metrics.json`

### Removed
- `generate_twohand_synthetic.py.DELETED` — synthetic two-hand mirroring was scientifically invalid
- `__deprecated_twohand_warning.md` — no longer needed after full removal

### Fixed
- README no longer claims "97%+ accuracy" — now reports honest 93.9% val with caveats

## [0.93.0] - 2026-04-28

### Added
- Dense ResNet v3.1 model (36 static classes: A-Z, 0-9)
- Two-phase training: hybrid (real+synthetic) → real-only fine-tune
- Auto-fix ladder (A→B→C→D) for iterative accuracy improvement
- Geometric digit classifier (`geoClassifier.js`) bypassing ML for digits 0-9
- Finger disambiguator (`fingerDisambiguator.js`) for confused letter pairs
- Prediction smoother with 10-frame sliding window
- Speech-to-Sign 3D hand avatar for ~50 words
- Full React app: Translator, Learn, Dictionary, Impact, Community pages
- PWA configuration with service worker caching
- Video dataset processor for large-scale extraction

### Known Issues
- 7 classes below 85% accuracy (O at 50%, M at 67%)
- No wild test set — all metrics are on studio-quality data
- Word-level signs hardcoded as geometric rules, not ML
- Single-frame model cannot learn motion-based signs
