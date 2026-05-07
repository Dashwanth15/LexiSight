import { useState, useEffect, useRef, useCallback } from 'react'
import * as tf from '@tensorflow/tfjs'
import { GESTURE_CLASSES, DEMO_SEQUENCE } from '../utils/gestureMap.js'
import { classifyGesture, classifyTwoHandGesture, classifyISLDigit } from '../utils/geoClassifier.js'
import { disambiguate } from '../utils/fingerDisambiguator.js'

const TEMPORAL_MODEL_PATH = '/model/tfjs_model/model.json'
const TEMPORAL_LABEL_MAP = '/model/label_map.json'
const TEMPORAL_CALIBRATION = '/model/calibration_temperature.json'
const STATIC_MODEL_PATH = '/model/static_tfjs_model/model.json'
const STATIC_LABEL_MAP = '/model/static_label_map.json'

const SEQ_LEN = 30
const BUFFER_SIZE = 30
const PREDICT_EVERY_N = 4
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

const PredictionState = { CONFIDENT: 2, UNCERTAIN: 1, UNKNOWN: 0 }

const SignState = { IDLE: 0, TRANSITION: 1, WORD: 2, CONFIRMING: 3 }

function computeEntropy(probs) {
  const filtered = probs.filter(p => p > 1e-12)
  if (!filtered.length) return 0
  return -filtered.reduce((s, p) => s + p * Math.log(p), 0)
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
  const modelsRef = useRef({ temporal: null, static: null })
  const labelMapsRef = useRef({ temporal: null, static: null })
  const calibrationRef = useRef({ temporal: 1.0, static: 1.0 })

  const bufferRef = useRef([])
  const temporalFrameCountRef = useRef(0)
  const lastTemporalResultRef = useRef(null)
  const smootherRef = useRef(new TemporalSmoother())
  const motionRef = useRef(new MotionDetector())
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
      const [temporalResult, temporalLabels, calibrationData, staticResult, staticLabels] =
        await Promise.allSettled([
          tf.loadLayersModel(TEMPORAL_MODEL_PATH).then(m => ({ model: m, ok: true })).catch(() => ({ model: null, ok: false })),
          fetch(TEMPORAL_LABEL_MAP).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(TEMPORAL_CALIBRATION).then(r => r.ok ? r.json() : null).catch(() => ({ temperature: 1.0 })),
          tf.loadLayersModel(STATIC_MODEL_PATH).then(m => ({ model: m, ok: true })).catch(() => ({ model: null, ok: false })),
          fetch(STATIC_LABEL_MAP).then(r => r.ok ? r.json() : null).catch(() => null),
        ])

      modelsRef.current = { temporal: temporalResult.model, static: staticResult.model }
      labelMapsRef.current = { temporal: temporalLabels, static: staticLabels }
      calibrationRef.current = {
        temporal: calibrationData?.temperature ?? 1.0,
        static: 1.0,
      }

      if (modelsRef.current.temporal) {
        oosRef.current = new OOSDetector(
          Object.keys(temporalLabels || {}).length || 263
        )
      }

      setProgress(100)
      if (!temporalResult.model && !staticResult.model) {
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

  const _predictTemporal = useCallback((seqBuffer, labelMap, temp, nClasses) => {
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

      if (topConf < CONFIDENCE_THRESHOLD_WORD) {
        return null
      }

      const rawResult = {
        label: topK[0]?.label || 'UNKNOWN',
        confidence: topConf,
        topK,
        state,
        rejected: state === PredictionState.UNKNOWN,
        probs,
      }

      const oosSignal = oosRef.current?.isOOS(probs, nClasses) ?? false
      if (oosSignal) {
        return { ...rawResult, state: PredictionState.UNKNOWN, rejected: true, oos: true }
      }

      lastTemporalResultRef.current = rawResult
      const smoothed = smootherRef.current.add(rawResult)

      if (smoothed) {
        const smoothState = classifyState([smoothed.confidence, 1 - smoothed.confidence], nClasses)
        setPredictionState(smoothState)
        return smoothed
      }

      setPredictionState(state)
      return rawResult
    })
  }, [])

  const predict = useCallback((landmarks, rawLandmarks, rawLandmarks2, landmarks2) => {
    if (isDemoMode || status === 'demo') return null
    if (isContinuousRef.current) return null

    const t0 = performance.now()

    if (rawLandmarks && rawLandmarks.length === 21 && mode === 'number') {
      const r = classifyISLDigit(rawLandmarks)
      metricsRef.current.record(performance.now() - t0, r?.confidence || 0, null, !r, 'geometric')
      return r
    }

    if (rawLandmarks2 && rawLandmarks2.length === 21) {
      const r = classifyTwoHandGesture(rawLandmarks, rawLandmarks2)
      metricsRef.current.record(performance.now() - t0, r?.confidence || 0, null, !r, 'two_hand')
      return r
    }

    if (status === 'geometric') {
      if (!rawLandmarks || rawLandmarks.length !== 21) return null
      const r = classifyGesture(rawLandmarks)
      metricsRef.current.record(performance.now() - t0, r?.confidence || 0, null, !r, 'geometric')
      return r
    }

    if (!landmarks || landmarks.length !== 63) return null

    if (mode === 'letter') {
      const model = modelsRef.current.static
      const labelMap = labelMapsRef.current.static
      const temp = calibrationRef.current.static
      if (!model || !labelMap) {
        const r = classifyGesture(rawLandmarks)
        metricsRef.current.record(performance.now() - t0, r?.confidence || 0, null, !r, 'geometric')
        return r
      }
      return tf.tidy(() => {
        const input = tf.tensor2d([landmarks])
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
        if (topConf < CONFIDENCE_THRESHOLD_STATIC) {
          metricsRef.current.record(performance.now() - t0, topConf, null, true, 'low_conf')
          return null
        }
        const result = {
          label: topK[0]?.label || 'UNKNOWN',
          confidence: topConf,
          topK,
          state,
          rejected: state === PredictionState.UNKNOWN,
        }
        metricsRef.current.record(performance.now() - t0, topConf, null, false, null)
        return disambiguate(result, rawLandmarks)
      })
    }

    if (mode === 'word') {
      const labelMap = labelMapsRef.current.temporal
      const temp = calibrationRef.current.temporal
      const nClasses = labelMap ? Object.keys(labelMap).length : 263

      const frame = new Float32Array(126)
      frame.set(landmarks, 0)
      if (landmarks2 && landmarks2.length === 63) frame.set(landmarks2, 63)

      bufferRef.current.push(Array.from(frame))
      if (bufferRef.current.length > BUFFER_SIZE) bufferRef.current.shift()

      if (bufferRef.current.length < BUFFER_SIZE) return null

      temporalFrameCountRef.current++
      if (temporalFrameCountRef.current % PREDICT_EVERY_N !== 0 && lastTemporalResultRef.current) {
        const s = smootherRef.current.add(lastTemporalResultRef.current)
        metricsRef.current.record(performance.now() - t0, s?.confidence || 0, s?.stability || 0, !s, 'smoothing')
        return s
      }

      const result = _predictTemporal(bufferRef.current, labelMap, temp, nClasses)
      metricsRef.current.record(
        performance.now() - t0,
        result?.confidence || 0,
        smootherRef.current.stability,
        !result || result.rejected,
        !result ? 'null_result' : null
      )
      return result
    }

    return null
  }, [_predictTemporal, isDemoMode, status, mode])

  const predictContinuous = useCallback((landmarks, rawLandmarks, landmarks2) => {
    if (!landmarks || landmarks.length !== 63) return null
    const t0 = performance.now()

    const labelMap = labelMapsRef.current.temporal
    const temp = calibrationRef.current.temporal
    const nClasses = labelMap ? Object.keys(labelMap).length : 263

    const frame = new Float32Array(126)
    frame.set(landmarks, 0)
    if (landmarks2?.length === 63) frame.set(landmarks2, 63)

    const isMotion = motionRef.current.update(frame)
    bufferRef.current.push(Array.from(frame))
    if (bufferRef.current.length > BUFFER_SIZE) bufferRef.current.shift()

    if (bufferRef.current.length < BUFFER_SIZE) return null

    const smoother = smootherRef.current

    if (smoother.state === SignState.IDLE) {
      if (isMotion) {
        smoother.state = SignState.TRANSITION
        smoother.unconfirmed = []
      }
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
      if (!isMotion) {
        smoother.reset()
        smoother.state = SignState.IDLE
      }
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
  }, [_predictTemporal])

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
    smootherRef.current.reset()
    smootherRef.current.state = SignState.IDLE
    setStatus('continuous')
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
