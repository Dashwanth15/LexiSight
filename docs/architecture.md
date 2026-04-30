# LexiSight Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (PWA)                            │
│                                                                 │
│  ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐ │
│  │  Webcam   │───▶│ MediaPipe  │───▶│  Model   │───▶│  Speech  │ │
│  │  Stream   │    │  Hands    │    │  (TFJS)  │    │  Output  │ │
│  │ 30fps     │    │ 21 lm/hand│    │ <3MB     │    │  TTS API │ │
│  └──────────┘    └───────────┘    └──────────┘    └──────────┘ │
│                        │                │                       │
│                  ┌─────▼─────┐   ┌──────▼──────┐              │
│                  │ Ring Buffer│   │  Smoother   │              │
│                  │ 30 frames │   │ Vote+Lock   │              │
│                  └───────────┘   └─────────────┘              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Speech-to-Sign Path                                      │  │
│  │  STT API → Word Lookup → 3D Hand Avatar Animation        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## ML Pipeline

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Raw Data     │    │  Landmarks   │    │  Training    │
│  (Images +    │───▶│  Extraction  │───▶│  Pipeline    │
│   Videos)     │    │  MediaPipe   │    │  TensorFlow  │
└──────────────┘    └──────────────┘    └──────────────┘
                                               │
                    ┌──────────────┐    ┌───────▼──────┐
                    │  Browser     │◀───│  TFJS Export  │
                    │  Deployment  │    │  float16      │
                    └──────────────┘    └──────────────┘
```

## Model Evolution

| Version | Architecture | Input | Classes | Size |
|---------|-------------|-------|---------|------|
| v0.93 (current) | Dense ResNet | 63 (single frame) | 36 | 5MB |
| v1.0 (target) | Temporal Transformer | 30×126 (sequence) | 250+ | <2MB |

## Key Design Decisions

1. **Landmark-based, not pixel-based**: Privacy-preserving, tiny model, runs on old phones
2. **Browser-only**: Zero server cost, works offline, no data leaves the device
3. **Two-hand tracking**: MediaPipe already supports it; model input is 126 features
4. **Temporal modeling**: 30-frame window (1 second) captures motion signs
5. **Signer-disjoint evaluation**: The only honest way to measure generalization
