import { useState, useEffect, useRef, useCallback } from 'react'
import * as tf from '@tensorflow/tfjs'
import { useSettings } from './useSettings.jsx'
import { GESTURE_CLASSES, DEMO_SEQUENCE } from '../utils/gestureMap.js'
import { classifyGesture, classifyTwoHandGesture, classifyISLDigit } from '../utils/geoClassifier.js'
import { disambiguate } from '../utils/fingerDisambiguator.js'
import { MotionAnalyzer } from '../utils/motionAnalyzer.js'
import { OnsetDetector } from '../utils/onsetDetector.js'
import { PoseStabilityDetector } from '../utils/poseStability.js'
import { telemetry } from '../utils/observability.js'
import { recordUncertainEvent } from '../services/passiveCollector.js'
// Register custom Keras layers for the temporal transformer model
import '../utils/customLayers.js'

function dist2D(a, b) {
  if (!a || !b) return 999.0
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

const TEMPORAL_MODEL_PATH = '/model/tfjs_model/model.json'
const TEMPORAL_LABEL_MAP = '/model/label_map.json'
const TEMPORAL_CALIBRATION = '/model/calibration_temperature.json'
const STATIC_MODEL_PATH = '/model/static_tfjs_model/model.json'
const STATIC_LABEL_MAP = '/model/static_label_map.json'

const SEQ_LEN = 30
const BUFFER_SIZE = 30
const PREDICT_EVERY_N = 4
const PREVIEW_MIN_FRAMES = 24
const PREVIEW_CONFIDENCE = 0.45
const CONF_SMOOTH_WINDOW = 10
const CONF_SMOOTH_THRESHOLD = 0.6
const LOCK_FRAMES = 18
const MOTION_WINDOW = 8
const MOTION_THRESHOLD = 0.015
const MOTION_SUSTAINED = 3
const STABILITY_WINDOW = 6
const STABILITY_RATIO = 0.6
const CONFIRM_FRAMES = 5
const CONFIDENCE_THRESHOLD_WORD = 0.60
const CONFIDENCE_THRESHOLD_STATIC = 0.75
const MARGIN_LOW = 0.12
const MARGIN_HIGH = 0.35
const REJECTION_RATE_WINDOW = 30
const ENTROPY_THRESHOLD = null  // null = auto-compute from nClasses

const PredictionState = { CONFIDENT: 2, UNCERTAIN: 1, UNKNOWN: 0 }

const SignState = { IDLE: 0, TRANSITION: 1, WORD: 2, CONFIRMING: 3 }

function computeEntropy(probs) {
  const filtered = probs.filter(p => p > 1e-12)
  if (!filtered.length) return 0
  return -filtered.reduce((s, p) => s + p * Math.log(p), 0)
}

function padSequenceBuffer(buf) {
  if (buf.length >= BUFFER_SIZE) return buf
  if (buf.length === 0) return buf
  const padded = [...buf]
  while (padded.length < BUFFER_SIZE) {
    padded.unshift(padded[0])
  }
  return padded
}

function computeMargin(probs) {
  const s = [...probs].sort((a, b) => b - a)
  return s.length < 2 ? 1.0 : s[0] - s[1]
}

function classifyState(probs, nClasses) {
  const margin = computeMargin(probs)
  const entropy = computeEntropy(probs)
  const entropyThresh = ENTROPY_THRESHOLD !== null ? ENTROPY_THRESHOLD : Math.log(nClasses) / 2
  if (margin < MARGIN_LOW || entropy > entropyThresh) return PredictionState.UNKNOWN
  if (margin > MARGIN_HIGH && entropy < entropyThresh) return PredictionState.CONFIDENT
  return PredictionState.UNCERTAIN
}

function buildTopK(probs, labelMap, k = 3) {
  return probs
    .map((p, i) => ({ label: labelMap[String(i)] || `class_${i}`, confidence: p }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, k)
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0)
  const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0)) + 1e-8
  const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0)) + 1e-8
  return dot / (na * nb)
}


class MotionDetector {
  constructor() {
    this.velHistory = []
    this.sustainedCount = 0
    this.lastFeatures = null
    this._buffer = []
  }

  update(features) {
    const flat = Array.from(features.slice ? features : features)
    if (this.lastFeatures) {
      const delta = Math.sqrt(
        flat.reduce((s, v, i) => s + (v - this.lastFeatures[i]) ** 2, 0)
      )
      this.velHistory.push(delta)
      if (this.velHistory.length > MOTION_WINDOW) this.velHistory.shift()
    }
    this.lastFeatures = flat

    if (this.velHistory.length < 3) return false
    const recent = this.velHistory.slice(-MOTION_SUSTAINED)
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length
    const moving = avg > MOTION_THRESHOLD
    this.sustainedCount = moving
      ? Math.min(this.sustainedCount + 1, MOTION_SUSTAINED)
      : Math.max(this.sustainedCount - 1, 0)
    return this.sustainedCount >= MOTION_SUSTAINED
  }

  get velocity() {
    return this.velHistory.length
      ? this.velHistory.reduce((a, b) => a + b, 0) / this.velHistory.length
      : 0
  }

  reset() {
    this.velHistory = []
    this.sustainedCount = 0
    this.lastFeatures = null
  }
}


class TemporalSmoother {
  constructor() {
    this.history = []
    this.lastConfirmed = null
    this.lockFrames = 0
    this.framesSinceLast = 0
    this.state = SignState.IDLE
    this.unconfirmed = []
    this._embeddings = []
  }

  add(raw) {
    if (!raw) {
      this.framesSinceLast++
      if (this.framesSinceLast > 45) {
        this.lastConfirmed = null
        this.history = []
        this.state = SignState.IDLE
        this.unconfirmed = []
      }
      return this.lastConfirmed
    }

    this.framesSinceLast = 0

    if (this.lockFrames > 0) {
      if (
        raw.confidence > 0.92 &&
        this.lastConfirmed &&
        raw.label !== this.lastConfirmed.label
      ) {
        this.lockFrames = Math.min(this.lockFrames, 5)
      }
      this.lockFrames--
      return this.lastConfirmed
    }

    this.unconfirmed.push(raw)
    if (this.unconfirmed.length > STABILITY_WINDOW) this.unconfirmed.shift()

    const votes = {}
    for (const p of this.unconfirmed) {
      if (p.confidence > 0.5) {
        votes[p.label] = (votes[p.label] || 0) + p.confidence
      }
    }
    const labels = Object.keys(votes)
    if (!labels.length) return this.lastConfirmed

    labels.sort((a, b) => votes[b] - votes[a])
    const winner = labels[0]
    const winScore = votes[winner] / this.unconfirmed.length

    if (winScore > CONF_SMOOTH_THRESHOLD) {
      const confirmed = {
        ...raw,
        label: winner,
        confidence: winScore,
        smoothed: true,
        historyLength: this.history.length,
        stability: winScore,
      }
      if (!this.lastConfirmed || winner !== this.lastConfirmed.label) {
        this.lastConfirmed = confirmed
        this.lockFrames = LOCK_FRAMES
        this.state = SignState.CONFIRMING
        this.unconfirmed = []
        return this.lastConfirmed
      }
    }

    return this.lastConfirmed
  }

  reset() {
    this.history = []
    this.lastConfirmed = null
    this.lockFrames = 0
    this.framesSinceLast = 0
    this.state = SignState.IDLE
    this.unconfirmed = []
    this._embeddings = []
  }

  get stability() {
    if (this.history.length < 3) return 0
    const labels = this.history.map(p => p.label)
    const mode = labels.sort(
      (a, b) => labels.filter(v => v === a).length - labels.filter(v => v === b).length
    ).pop()
    return labels.filter(v => v === mode).length / labels.length
  }

  get isLocked() {
    return this.lockFrames > 0
  }
}


class OOSDetector {
  constructor(nClasses, embeddingDim = 192) {
    this.nClasses = nClasses
    this.embeddingDim = embeddingDim
    this.classCentroids = {}
    this.classCount = 0
    this._embeddings = []
    this._labels = []
    this.oosThreshold = 0.55
    this.minSupport = 3
  }

  update(embedding, label) {
    this._embeddings.push(Array.from(embedding))
    this._labels.push(label)
    this._update_centroids()
  }

  _update_centroids() {
    const groups = {}
    for (let i = 0; i < this._labels.length; i++) {
      const l = this._labels[i]
      if (!groups[l]) groups[l] = []
      groups[l].push(this._embeddings[i])
    }
    this.classCentroids = {}
    for (const [label, vecs] of Object.entries(groups)) {
      if (vecs.length < this.minSupport) continue
      const centroid = vecs[0].map((_, ci) =>
        vecs.reduce((s, v) => s + v[ci], 0) / vecs.length
      )
      this.classCentroids[label] = centroid
    }
    this.classCount = Object.keys(this.classCentroids).length
  }

  isOOS(probs, nClasses) {
    const topIdx = probs.indexOf(Math.max(...probs))
    const topProb = probs[topIdx]
    const entropy = computeEntropy(probs)
    const margin = computeMargin(probs)
    const topEntropy = Math.log(nClasses)
    if (entropy > topEntropy * 0.7) return true
    if (margin < 0.05) return true
    if (topProb < 0.25) return true
    return false
  }

  reset() {
    this._embeddings = []
    this._labels = []
    this.classCentroids = {}
  }
}


class SystemMetricsCollector {
  constructor() {
    this.latencies = []
    this.confidences = []
    this.stabilities = []
    this.rejections = []
    this.totalFrames = 0
    this.startTime = Date.now()
  }

  record(latencyMs, confidence, stability, rejected, reason) {
    this.latencies.push(latencyMs)
    if (this.confidences.length < 1000) this.confidences.push(confidence)
    if (this.stabilities.length < 1000) this.stabilities.push(stability || 0)
    if (rejected) this.rejections.push(reason || 'unknown')
    this.totalFrames++
  }

  summary() {
    const n = this.latencies.length
    const sorted = [...this.latencies].sort((a, b) => a - b)
    const total = this.totalFrames
    const rej = this.rejections.length
    return {
      uptime_s: ((Date.now() - this.startTime) / 1000).toFixed(1),
      total_frames: total,
      predictions: n,
      rejections: rej,
      rejection_rate: total > 0 ? (rej / total).toFixed(4) : 0,
      latency_mean_ms: n > 0 ? (sorted.reduce((a, b) => a + b, 0) / n).toFixed(2) : 0,
      latency_p95_ms: n > 0 ? sorted[Math.floor(n * 0.95)].toFixed(2) : 0,
      latency_p99_ms: n > 0 ? sorted[Math.floor(n * 0.99)].toFixed(2) : 0,
      confidence_mean: this.confidences.length
        ? (this.confidences.reduce((a, b) => a + b, 0) / this.confidences.length).toFixed(4)
        : 0,
      stability_mean: this.stabilities.length
        ? (this.stabilities.reduce((a, b) => a + b, 0) / this.stabilities.length).toFixed(4)
        : 0,
    }
  }
}


export function useClassifier() {
  const { settings } = useSettings()
  const modelsRef = useRef({ temporal: null, static: null })
  const labelMapsRef = useRef({ temporal: null, static: null })
  const calibrationRef = useRef({ temporal: 1.0, static: 1.0 })

  const bufferRef = useRef([])
  const temporalFrameCountRef = useRef(0)
  const lastTemporalResultRef = useRef(null)
  const smootherRef = useRef(new TemporalSmoother())
  const motionRef = useRef(new MotionAnalyzer())
  const onsetRef = useRef(new OnsetDetector())
  const poseStabilityRef = useRef(new PoseStabilityDetector())
  const oosRef = useRef(null)
  const metricsRef = useRef(new SystemMetricsCollector())
  const embeddingCacheRef = useRef(null)
  const isContinuousRef = useRef(false)

  const demoIndexRef = useRef(0)
  const [status, setStatus] = useState('idle')
  const [mode, setMode] = useState('word')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [predictionState, setPredictionState] = useState(PredictionState.UNKNOWN)

  useEffect(() => {
    loadModels()
  }, [])

  async function loadModels() {
    setStatus('loading')
    setProgress(10)
    try {
      await tf.ready()
      setProgress(20)
      // Clear stale v3 cache from before the model.json Keras3→TFjs patch
      try { await tf.io.removeModel('indexeddb://temporal-model-v3') } catch (_) {}
      try { await tf.io.removeModel('indexeddb://static-model-v3') } catch (_) {}

      const loadCachedModel = async (path, cacheName) => {
        try {
          const cached = await tf.loadLayersModel('indexeddb://' + cacheName)
          console.log(`[LexiSight] Loaded ${cacheName} from IndexedDB cache`)
          return { model: cached, ok: true }
        } catch (e) {
          console.log(`[LexiSight] Cache miss for ${cacheName}, loading from network...`)
          try {
            const fresh = await tf.loadLayersModel(path)
            console.log(`[LexiSight] Loaded ${cacheName} from network OK`)
            try { await fresh.save('indexeddb://' + cacheName) } catch (saveErr) { console.warn('Cache save failed', saveErr) }
            return { model: fresh, ok: true }
          } catch (err) {
            console.error(`[LexiSight] Failed to load model from ${path}:`, err)
            return { model: null, ok: false }
          }
        }
      }

      const [temporalRes, temporalLabelsRes, calibrationDataRes, staticRes, staticLabelsRes] =
        await Promise.allSettled([
          loadCachedModel(TEMPORAL_MODEL_PATH, 'temporal-model-v4'),
          fetch(TEMPORAL_LABEL_MAP).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(TEMPORAL_CALIBRATION).then(r => r.ok ? r.json() : null).catch(() => ({ temperature: 1.0 })),
          loadCachedModel(STATIC_MODEL_PATH, 'static-model-v4'),
          fetch(STATIC_LABEL_MAP).then(r => r.ok ? r.json() : null).catch(() => null),
        ])

      const temporalResult = temporalRes.value || { model: null, ok: false }
      const temporalLabels = temporalLabelsRes.value || null
      const calibrationData = calibrationDataRes.value || { temperature: 1.0 }
      const staticResult = staticRes.value || { model: null, ok: false }
      const staticLabels = staticLabelsRes.value || null

      modelsRef.current = { temporal: temporalResult.model, static: staticResult.model }
      labelMapsRef.current = { temporal: temporalLabels, static: staticLabels }
      calibrationRef.current = {
        temporal: calibrationData?.temperature ?? 1.0,
        static: 1.0,
      }

      console.log('[LexiSight] Model load results:', {
        temporal: !!temporalResult.model,
        static: !!staticResult.model,
        temporalLabels: temporalLabels ? Object.keys(temporalLabels).length + ' classes' : 'null',
        staticLabels: staticLabels ? Object.keys(staticLabels).length + ' classes' : 'null',
      })

      if (modelsRef.current.temporal) {
        oosRef.current = new OOSDetector(
          Object.keys(temporalLabels || {}).length || 263
        )
      }

      setProgress(100)
      if (!temporalResult.model && !staticResult.model) {
        console.warn('[LexiSight] No models loaded — falling back to geometric classifier')
        setStatus('geometric')
        return
      }
      setStatus('ready')
    } catch (err) {
      console.error('Model load error:', err)
      setStatus('geometric')
      setErrorMsg('Model not found — Geometric Classifier fallback')
    }
  }

  const _predictTemporal = useCallback((seqBuffer, labelMap, temp, nClasses, opts = {}) => {
    const { preview = false, minConf = null, skipSmooth = false } = opts
    if (!modelsRef.current.temporal) return null
    return tf.tidy(() => {
      const tensor = tf.tensor2d(seqBuffer, [BUFFER_SIZE, 126])
      const input = tensor.expandDims(0)
      const output = modelsRef.current.temporal.predict(input)
      let probs = Array.from(output.dataSync())

      if (temp !== 1.0) {
        const maxLogit = Math.max(...probs)
        probs = probs.map(p => {
          const scaled = Math.log(Math.max(p, 1e-12)) / temp
          return Math.exp(scaled - maxLogit)
        })
        const sum = probs.reduce((a, b) => a + b, 0)
        probs = probs.map(p => p / sum)
      }

      const state = classifyState(probs, nClasses)
      const topK = buildTopK(probs, labelMap, 3)
      const topConf = topK[0]?.confidence || 0
      const margin = computeMargin(probs)

      const thresh =
        minConf ??
        (preview ? PREVIEW_CONFIDENCE : settings.confidenceThreshold || CONFIDENCE_THRESHOLD_WORD)

      let rejectedByEntropy = false
      if (!preview && telemetry.toggles.entropyGating) {
        const entropy = computeEntropy(probs)
        const entropyLimit = settings.entropyLimit || 2.5

        if (entropy > entropyLimit && topConf >= thresh) {
          telemetry.log(
            'ENTROPY',
            `Rejected overconfident prediction: ${topK[0]?.label} (Conf: ${topConf.toFixed(2)}, Entropy: ${entropy.toFixed(2)} > ${entropyLimit})`
          )
          rejectedByEntropy = true
        } else if (telemetry.enabled && topConf >= thresh) {
          telemetry.log(
            'ENTROPY',
            `Passed: ${topK[0]?.label} (Conf: ${topConf.toFixed(2)}, Entropy: ${entropy.toFixed(2)})`
          )
        }
      }

      if (topConf < thresh || rejectedByEntropy) {
        recordUncertainEvent({
          label: topK[0]?.label,
          confidence: topConf,
          entropy: computeEntropy(probs),
          margin,
          rejectedByEntropy,
          mode,
          preview,
        })
        return preview && topK[0]
          ? {
              label: topK[0].label,
              confidence: topConf,
              topK,
              margin,
              state: PredictionState.UNCERTAIN,
              rejected: true,
              isPreview: true,
              probs,
            }
          : null
      }

      const rawResult = {
        label: topK[0]?.label || 'UNKNOWN',
        confidence: topConf,
        topK,
        margin,
        state,
        rejected: state === PredictionState.UNKNOWN,
        isPreview: preview,
        probs,
      }

      const oosSignal = !preview && (oosRef.current?.isOOS(probs, nClasses) ?? false)
      if (oosSignal) {
        return { ...rawResult, state: PredictionState.UNKNOWN, rejected: true, oos: true }
      }

      lastTemporalResultRef.current = rawResult

      if (skipSmooth || preview) {
        setPredictionState(state)
        return rawResult
      }

      const smoothed = smootherRef.current.add(rawResult)

      if (smoothed) {
        const smoothState = classifyState([smoothed.confidence, 1 - smoothed.confidence], nClasses)
        setPredictionState(smoothState)
        return { ...smoothed, topK: smoothed.topK || topK, margin }
      }

      setPredictionState(state)
      return rawResult
    })
  }, [settings.confidenceThreshold, settings.entropyLimit])
  // ROOT-RELATIVE NORMALIZATION (Spatial Invariance)
  // Subtracts the Wrist (landmark 0) coordinates from all other landmarks
  const normalizeRelative = (flatLandmarks) => {
    if (!flatLandmarks || flatLandmarks.length !== 63) return flatLandmarks
    const normalized = new Float32Array(63)
    const wx = flatLandmarks[0]
    const wy = flatLandmarks[1]
    const wz = flatLandmarks[2]
    
    for (let i = 0; i < 21; i++) {
      normalized[i * 3] = flatLandmarks[i * 3] - wx
      normalized[i * 3 + 1] = flatLandmarks[i * 3 + 1] - wy
      normalized[i * 3 + 2] = flatLandmarks[i * 3 + 2] - wz
    }
    return normalized
  }

  const predict = useCallback((landmarks, rawLandmarks, rawLandmarks2, landmarks2) => {
    if (isDemoMode || status === 'demo') return null
    if (isContinuousRef.current) return null

    // Reset temporal buffers when hands leave the camera frame
    if (!landmarks || landmarks.length !== 63) {
      bufferRef.current = []
      motionRef.current.reset()
      return null
    }

    const t0 = performance.now()

    // ─── 1. NUMBER MODE ──────────────────────────────────────────
    if (mode === 'number') {
      if (rawLandmarks && rawLandmarks.length === 21) {
        const r = classifyISLDigit(rawLandmarks)
        // Strictly only return if the label is indeed a digit
        if (r && ['0','1','2','3','4','5','6','7','8','9'].includes(r.label)) {
          metricsRef.current.record(performance.now() - t0, r.confidence, null, false, 'geometric')
          return r
        }
      }
      return null
    }

    // ─── 2. LETTER MODE ──────────────────────────────────────────
    if (mode === 'letter') {
      // 1. Check dynamic letter gestures (J, Z) via MotionAnalyzer
      if (rawLandmarks && rawLandmarks.length === 21) {
        const motionResult = motionRef.current.push(rawLandmarks).analyze()
        if (motionResult && (motionResult.label === 'J' || motionResult.label === 'Z')) {
          metricsRef.current.record(performance.now() - t0, motionResult.confidence, null, false, 'motion')
          return motionResult
        }
      }

      // 2. Two-hand gestures are strictly ignored in letter mode EXCEPT for 'X'
      if (rawLandmarks && rawLandmarks.length === 21 && rawLandmarks2 && rawLandmarks2.length === 21) {
        // Enforce physical separation check to prevent double-detection of a single hand
        const wristDist = dist2D(rawLandmarks[0], rawLandmarks2[0]);
        if (wristDist >= 0.12) {
          const r = classifyTwoHandGesture(rawLandmarks, rawLandmarks2)
          if (r && r.label === 'X') {
            metricsRef.current.record(performance.now() - t0, r.confidence, null, false, 'two_hand')
            return r
          }
        }
      }

      const model = modelsRef.current.static
      const labelMap = labelMapsRef.current.static
      const temp = calibrationRef.current.static

      if (!model || !labelMap) {
        // Fallback to geometric single-hand gestures, but only return letters (A-Z)
        if (rawLandmarks && rawLandmarks.length === 21) {
          const r = classifyGesture(rawLandmarks)
          if (r && r.label.length === 1 && r.label >= 'A' && r.label <= 'Z') {
            metricsRef.current.record(performance.now() - t0, r.confidence, null, false, 'geometric')
            return r
          }
        }
        return null
      }

      if (!landmarks || landmarks.length !== 63) return null

      return tf.tidy(() => {
        const frame = new Float32Array(126)
        frame.set(normalizeRelative(landmarks), 0)
        if (landmarks2 && landmarks2.length === 63) frame.set(normalizeRelative(landmarks2), 63)
        const input = tf.tensor2d([Array.from(frame)])
        const rawLogits = model.predict(input)
        let probs = Array.from(rawLogits.dataSync())
        if (temp !== 1.0) {
          const maxLogit = Math.max(...probs)
          probs = probs.map(p => {
            const scaled = Math.log(Math.max(p, 1e-12)) / temp
            return Math.exp(scaled - maxLogit)
          })
          const sum = probs.reduce((a, b) => a + b, 0)
          probs = probs.map(p => p / sum)
        }
        const nClasses = labelMap ? Object.keys(labelMap).length : probs.length
        const state = classifyState(probs, nClasses)
        const topK = buildTopK(probs, labelMap, 3)
        const topConf = topK[0]?.confidence || 0
        
        const thresh = settings.confidenceThreshold || CONFIDENCE_THRESHOLD_STATIC
        if (topConf < thresh) {
          metricsRef.current.record(performance.now() - t0, topConf, null, true, 'low_conf')
          return null
        }

        // CRITICAL ISOLATION FILTER: Strictly allow ONLY single letters (A-Z) in letter mode.
        // Ignore any predicted digits or words.
        const label = topK[0]?.label || 'UNKNOWN'
        const isLetter = label.length === 1 && label >= 'A' && label <= 'Z';
        if (!isLetter) {
          metricsRef.current.record(performance.now() - t0, topConf, null, true, 'letter_mode_exclusion')
          return null
        }

        const result = {
          label,
          confidence: topConf,
          topK: topK.filter(item => item.label.length === 1 && item.label >= 'A' && item.label <= 'Z'),
          state,
          rejected: state === PredictionState.UNKNOWN,
        }
        metricsRef.current.record(performance.now() - t0, topConf, null, false, null)
        return disambiguate(result, rawLandmarks)
      })
    }

    // ─── 3. WORD MODE ───────────────────────────────────────────
    if (mode === 'word') {
      // 1. Check two-hand word gestures (exclude 'X' since it's a letter)
      if (rawLandmarks && rawLandmarks.length === 21 && rawLandmarks2 && rawLandmarks2.length === 21) {
        // Enforce physical separation check to prevent double-detection of a single hand
        const wristDist = dist2D(rawLandmarks[0], rawLandmarks2[0]);
        if (wristDist >= 0.12) {
          const r = classifyTwoHandGesture(rawLandmarks, rawLandmarks2)
          if (r && r.label !== 'X') {
            metricsRef.current.record(performance.now() - t0, r.confidence, null, false, 'two_hand')
            return r
          }
        }
      }

      // 2. Check dynamic word gestures via MotionAnalyzer (e.g. WHAT, NO, COME, HELP in standard live view)
      if (rawLandmarks && rawLandmarks.length === 21) {
        const motionResult = motionRef.current.push(rawLandmarks).analyze()
        if (motionResult) {
          // EXCLUDE letters J and Z in Word Mode!
          if (motionResult.label !== 'J' && motionResult.label !== 'Z') {
            metricsRef.current.record(performance.now() - t0, motionResult.confidence, null, false, 'motion')
            return motionResult
          }
        }
      }

      // 3. Check static geometric word gestures as fallback (HELLO, STOP, GOOD, NO, ILY, PEACE, ROCK)
      // Only allow static fallback if the hand is STABLE (velocity is low)
      // to prevent intercepting dynamic gestures in motion!
      if (rawLandmarks && rawLandmarks.length === 21) {
        const motionFeatures = motionRef.current.getFeatures()
        const isMoving = motionFeatures ? motionFeatures.meanVelocity > 0.008 : false
        if (!isMoving) {
          const r = classifyGesture(rawLandmarks)
          // Allow words (length > 1, and not digits)
          if (r && !['0','1','2','3','4','5','6','7','8','9'].includes(r.label) && r.label.length > 1) {
            metricsRef.current.record(performance.now() - t0, r.confidence, null, false, 'geometric')
            return r
          }
        }
      }

      // 4. Run temporal ML model prediction
      if (!modelsRef.current.temporal || !landmarks || landmarks.length !== 63) return null

      const labelMap = labelMapsRef.current.temporal
      const temp = calibrationRef.current.temporal
      const nClasses = labelMap ? Object.keys(labelMap).length : 263

      const frame = new Float32Array(126)
      frame.set(normalizeRelative(landmarks), 0)
      if (landmarks2 && landmarks2.length === 63) frame.set(normalizeRelative(landmarks2), 63)

      bufferRef.current.push(Array.from(frame))
      if (bufferRef.current.length > BUFFER_SIZE) bufferRef.current.shift()

      const bufferFill = bufferRef.current.length / BUFFER_SIZE

      if (bufferRef.current.length < PREVIEW_MIN_FRAMES) {
        return null
      }

      if (bufferRef.current.length < BUFFER_SIZE) {
        const preview = _predictTemporal(padSequenceBuffer(bufferRef.current), labelMap, temp, nClasses, {
          preview: true,
          skipSmooth: true,
        })
        if (preview) {
          const isWord = preview.label.length > 1 || preview.label === 'I'
          if (isWord) {
            metricsRef.current.record(performance.now() - t0, preview.confidence, bufferFill, false, 'preview')
            return { ...preview, bufferFill, isPreview: true }
          }
        }
        return null
      }

      temporalFrameCountRef.current++
      if (temporalFrameCountRef.current % PREDICT_EVERY_N !== 0 && lastTemporalResultRef.current) {
        const live = {
          ...lastTemporalResultRef.current,
          bufferFill: 1,
          isPreview: false,
        }
        const s = smootherRef.current.add(lastTemporalResultRef.current)
        metricsRef.current.record(performance.now() - t0, s?.confidence || live.confidence, s?.stability || 0, !s, 'smoothing')
        return s ? { ...s, topK: s.topK || live.topK, bufferFill: 1 } : live
      }

      const rawResult = _predictTemporal(bufferRef.current, labelMap, temp, nClasses)

      // CRITICAL ISOLATION FILTER: Strictly allow ONLY words in word mode.
      // If the temporal model somehow predicts a single character (like a digit or unrelated single letter), reject it.
      // Note: "I" is a valid word class and has length 1, so we permit "I" specifically.
      if (rawResult) {
        const isWord = rawResult.label.length > 1 || rawResult.label === 'I';
        if (!isWord) {
          metricsRef.current.record(performance.now() - t0, rawResult.confidence, null, true, 'word_mode_exclusion')
          return null
        }
      }

      metricsRef.current.record(
        performance.now() - t0,
        rawResult?.confidence || 0,
        smootherRef.current.stability,
        !rawResult || rawResult.rejected,
        !rawResult ? 'null_result' : null
      )
      if (rawResult) {
        return { ...rawResult, bufferFill: 1, isPreview: false }
      }
      return rawResult
    }

    return null
  }, [_predictTemporal, isDemoMode, status, mode, settings.confidenceThreshold])

  const predictContinuous = useCallback((landmarks, rawLandmarks, landmarks2) => {
    if (!landmarks || landmarks.length !== 63) return null
    const t0 = performance.now()

    const frame = new Float32Array(126)
    frame.set(landmarks, 0)
    if (landmarks2?.length === 63) frame.set(landmarks2, 63)

    // ─── 1. NUMBER MODE ──────────────────────────────────────────
    if (mode === 'number') {
      if (rawLandmarks && rawLandmarks.length === 21) {
        const r = classifyISLDigit(rawLandmarks)
        return r
      }
      return null
    }

    // ─── 2. LETTER MODE ──────────────────────────────────────────
    if (mode === 'letter') {
      let staticResult = null
      if (telemetry.toggles.poseStability) {
        if (poseStabilityRef.current.process(rawLandmarks)) {
          const sModel = modelsRef.current.static
          const sLabelMap = labelMapsRef.current.static
          const sTemp = calibrationRef.current.static
          
          if (sModel && sLabelMap) {
            staticResult = tf.tidy(() => {
              const input = tf.tensor2d([Array.from(frame)])
              const rawLogits = sModel.predict(input)
              let probs = Array.from(rawLogits.dataSync())
              if (sTemp !== 1.0) {
                const maxLogit = Math.max(...probs)
                probs = probs.map(p => Math.exp(Math.log(Math.max(p, 1e-12)) / sTemp - maxLogit))
                const sum = probs.reduce((a, b) => a + b, 0)
                probs = probs.map(p => p / sum)
              }
              const sTopK = buildTopK(probs, sLabelMap, 3)
              if (sTopK[0]?.confidence >= (settings.confidenceThreshold || CONFIDENCE_THRESHOLD_STATIC)) {
                return disambiguate({ label: sTopK[0].label, confidence: sTopK[0].confidence, topK: sTopK }, rawLandmarks)
              }
              return null
            })
          }
          
          if (!staticResult) {
            const r = classifyGesture(rawLandmarks)
            // Keep it to letters
            if (r && r.label.length === 1 && r.label >= 'A' && r.label <= 'Z') {
              staticResult = r
            }
          }
        }
      }

      if (staticResult) {
        telemetry.log('STATIC', `Detected stable static pose: ${staticResult.label}`, staticResult)
        const smoother = smootherRef.current
        if (staticResult.label !== smoother.lastConfirmed?.label) {
          smoother.lockFrames = LOCK_FRAMES
          smoother.state = SignState.CONFIRMING
          smoother.unconfirmed = []
          smoother._sentence = smoother._sentence || []
          smoother._sentence.push(staticResult.label)
        }
        return staticResult
      }
      return null
    }

    // ─── 3. WORD MODE ───────────────────────────────────────────
    if (mode === 'word') {
      const labelMap = labelMapsRef.current.temporal
      const temp = calibrationRef.current.temporal
      const nClasses = labelMap ? Object.keys(labelMap).length : 263

      // Motion Analyzer Interception (rule-based dynamic gestures)
      const motionResult = motionRef.current.push(rawLandmarks).analyze()
      if (motionResult) {
        telemetry.log('MOTION', `Detected dynamic gesture: ${motionResult.label}`)
        const smoother = smootherRef.current
        if (motionResult.label !== smoother.lastConfirmed?.label) {
          smoother.lockFrames = LOCK_FRAMES
          smoother.state = SignState.CONFIRMING
          smoother.unconfirmed = []
          smoother._sentence = smoother._sentence || []
          smoother._sentence.push(motionResult.label)
        }
        return motionResult
      }

      bufferRef.current.push(Array.from(frame))
      if (bufferRef.current.length > BUFFER_SIZE) bufferRef.current.shift()

      if (bufferRef.current.length < BUFFER_SIZE) return null

      const smoother = smootherRef.current

      if (smoother.state === SignState.IDLE) {
        smoother.state = SignState.TRANSITION
        smoother.unconfirmed = []
        return null
      }

      if (smoother.state === SignState.TRANSITION) {
        smoother.unconfirmed = []
        return null
      }

      if (smoother.state === SignState.CONFIRMING) {
        const confirmed = smoother.add(null)
        if (smoother.lockFrames <= 0) {
          smoother.state = SignState.WORD
          const out = {
            ...confirmed,
            sentence: smoother._sentence || [confirmed?.label],
          }
          smoother._sentence = smoother._sentence || []
          smoother._sentence.push(confirmed?.label)
          return out
        }
        return null
      }

      if (smoother.state === SignState.WORD) {
        smoother.reset()
        smoother.state = SignState.IDLE
        return null
      }

      const rawResult = _predictTemporal(bufferRef.current, labelMap, temp, nClasses)
      if (!rawResult || rawResult.rejected) {
        smoother.reset()
        smoother.state = SignState.IDLE
        return null
      }

      const predicted = smoother.add(rawResult)
      if (predicted && predicted !== smoother.lastConfirmed) {
        telemetry.log('SYSTEM', `Temporal inference confirmed: ${predicted.label}`)
        smoother.lockFrames = LOCK_FRAMES
        smoother.state = SignState.CONFIRMING
        smoother.unconfirmed = []
        smoother._sentence = smoother._sentence || []
        smoother._sentence.push(predicted.label)
      }

      metricsRef.current.record(
        performance.now() - t0,
        predicted?.confidence || rawResult?.confidence || 0,
        smoother.stability,
        !predicted,
        !predicted ? 'oov' : null
      )

      return predicted
    }

    return null
  }, [_predictTemporal, mode, settings.confidenceThreshold])

  const predictDemo = useCallback(() => {
    const gesture = DEMO_SEQUENCE[demoIndexRef.current % DEMO_SEQUENCE.length]
    demoIndexRef.current++
    return {
      ...gesture,
      topK: [
        gesture,
        { label: DEMO_SEQUENCE[(demoIndexRef.current + 1) % DEMO_SEQUENCE.length].label, confidence: 0.05 },
        { label: DEMO_SEQUENCE[(demoIndexRef.current + 2) % DEMO_SEQUENCE.length].label, confidence: 0.02 },
      ],
      state: PredictionState.CONFIDENT,
      rejected: false,
    }
  }, [])

  const startContinuous = useCallback(() => {
    isContinuousRef.current = true
    bufferRef.current = []
    motionRef.current.reset()
    poseStabilityRef.current.reset()
    smootherRef.current.reset()
    smootherRef.current.state = SignState.IDLE
    setStatus('continuous')
    telemetry.log('SYSTEM', 'Started continuous mode')
  }, [])

  const stopContinuous = useCallback(() => {
    isContinuousRef.current = false
    const sentence = smootherRef.current._sentence || []
    smootherRef.current.reset()
    bufferRef.current = []
    setStatus('ready')
    return sentence
  }, [])

  const retry = useCallback(() => {
    setIsDemoMode(false)
    setErrorMsg(null)
    smootherRef.current.reset()
    bufferRef.current = []
    loadModels()
  }, [])

  const getMetrics = useCallback(() => metricsRef.current.summary(), [])

  return {
    predict,
    predictContinuous,
    predictDemo,
    status,
    progress,
    isDemoMode,
    errorMsg,
    mode,
    setMode,
    predictionState,
    smoother: smootherRef.current,
    isTemporal: mode === 'word',
    numClasses: 263,
    retry,
    startContinuous,
    stopContinuous,
    getMetrics,
  }
}
