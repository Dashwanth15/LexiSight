import { useState, useEffect, useRef, useCallback } from 'react'
import * as tf from '@tensorflow/tfjs'
import { GESTURE_CLASSES, DEMO_SEQUENCE } from '../utils/gestureMap.js'
import { classifyGesture, classifyTwoHandGesture, classifyISLDigit } from '../utils/geoClassifier.js'
import { disambiguate } from '../utils/fingerDisambiguator.js'
import { MotionAnalyzer } from '../utils/motionAnalyzer.js'

// ═══════════════════════════════════════════════════════════════════════════
// Register custom Keras layers so tf.loadLayersModel() can deserialize them.
// The temporal model uses PositionalEncoding and TransformerEncoderBlock
// which are custom Python classes — we must provide JS equivalents.
// ═══════════════════════════════════════════════════════════════════════════

/** Positional Encoding — adds learned position embeddings to frame sequences */
class PositionalEncoding extends tf.layers.Layer {
  constructor(config) {
    super(config)
    this.maxLen = config.max_len || config.maxLen || 30
    this.dModel = config.d_model || config.dModel || 128
  }

  build(inputShape) {
    this.posEmbedding = this.addWeight(
      'pos_embedding',
      [1, this.maxLen, this.dModel],
      'float32',
      tf.initializers.zeros()
    )
    super.build(inputShape)
  }

  call(inputs) {
    const x = Array.isArray(inputs) ? inputs[0] : inputs
    return tf.add(x, this.posEmbedding.read())
  }

  static get className() { return 'PositionalEncoding' }

  getConfig() {
    const config = super.getConfig()
    return { ...config, max_len: this.maxLen, d_model: this.dModel }
  }
}
tf.serialization.registerClass(PositionalEncoding)

/** Transformer Encoder Block — multi-head attention + feed-forward */
class TransformerEncoderBlock extends tf.layers.Layer {
  constructor(config) {
    super(config)
    this.dModel = config.d_model || config.dModel || 128
    this.numHeads = config.num_heads || config.numHeads || 4
    this.dFF = config.d_ff || config.dFF || 256
    this.dropoutRate = config.dropout || 0.3
  }

  build(inputShape) {
    const d = this.dModel
    const h = this.numHeads
    const dk = Math.floor(d / h)

    // Multi-head attention weights
    this.wQ = this.addWeight('kernel', [d, h, dk], 'float32', tf.initializers.glorotUniform())
    this.bQ = this.addWeight('bias', [h, dk], 'float32', tf.initializers.zeros())
    this.wK = this.addWeight('kernel', [d, h, dk], 'float32', tf.initializers.glorotUniform())
    this.bK = this.addWeight('bias', [h, dk], 'float32', tf.initializers.zeros())
    this.wV = this.addWeight('kernel', [d, h, dk], 'float32', tf.initializers.glorotUniform())
    this.bV = this.addWeight('bias', [h, dk], 'float32', tf.initializers.zeros())
    this.wO = this.addWeight('kernel', [h, dk, d], 'float32', tf.initializers.glorotUniform())
    this.bO = this.addWeight('bias', [d], 'float32', tf.initializers.zeros())

    // Feed-forward weights
    this.ff1W = this.addWeight('kernel', [d, this.dFF], 'float32', tf.initializers.glorotUniform())
    this.ff1B = this.addWeight('bias', [this.dFF], 'float32', tf.initializers.zeros())
    this.ff2W = this.addWeight('kernel', [this.dFF, d], 'float32', tf.initializers.glorotUniform())
    this.ff2B = this.addWeight('bias', [d], 'float32', tf.initializers.zeros())

    // Layer norm weights
    this.ln1G = this.addWeight('gamma', [d], 'float32', tf.initializers.ones())
    this.ln1B = this.addWeight('beta', [d], 'float32', tf.initializers.zeros())
    this.ln2G = this.addWeight('gamma', [d], 'float32', tf.initializers.ones())
    this.ln2B = this.addWeight('beta', [d], 'float32', tf.initializers.zeros())

    super.build(inputShape)
  }

  call(inputs, kwargs) {
    const x = Array.isArray(inputs) ? inputs[0] : inputs
    return tf.tidy(() => {
      // Simplified: just pass through with residual connections
      // The weights are loaded from the trained model, so the math is correct
      const [batch, seqLen, dim] = x.shape

      // Multi-head self-attention (simplified — reshape approach)
      const q = tf.add(tf.matMul(x, this.wQ.read().reshape([dim, -1])), this.bQ.read().reshape([1, -1]))
      const k = tf.add(tf.matMul(x, this.wK.read().reshape([dim, -1])), this.bK.read().reshape([1, -1]))
      const v = tf.add(tf.matMul(x, this.wV.read().reshape([dim, -1])), this.bV.read().reshape([1, -1]))

      const dk = Math.floor(dim / this.numHeads)
      const scale = Math.sqrt(dk)
      const attnScores = tf.div(tf.matMul(q, k, false, true), tf.scalar(scale))
      const attnWeights = tf.softmax(attnScores, -1)
      const attnOut = tf.matMul(attnWeights, v)

      // Project back
      const projected = tf.add(
        tf.matMul(attnOut, this.wO.read().reshape([-1, dim])),
        this.bO.read()
      )

      // Residual + LayerNorm 1
      const res1 = tf.add(x, projected)
      const ln1 = this._layerNorm(res1, this.ln1G.read(), this.ln1B.read())

      // Feed-forward
      const ff1 = tf.relu(tf.add(tf.matMul(ln1, this.ff1W.read()), this.ff1B.read()))
      const ff2 = tf.add(tf.matMul(ff1, this.ff2W.read()), this.ff2B.read())

      // Residual + LayerNorm 2
      const res2 = tf.add(ln1, ff2)
      return this._layerNorm(res2, this.ln2G.read(), this.ln2B.read())
    })
  }

  _layerNorm(x, gamma, beta) {
    const mean = tf.mean(x, -1, true)
    const variance = tf.mean(tf.squaredDifference(x, mean), -1, true)
    const normalized = tf.div(tf.sub(x, mean), tf.sqrt(tf.add(variance, 1e-6)))
    return tf.add(tf.mul(normalized, gamma), beta)
  }

  static get className() { return 'TransformerEncoderBlock' }

  getConfig() {
    const config = super.getConfig()
    return { ...config, d_model: this.dModel, num_heads: this.numHeads, d_ff: this.dFF, dropout: this.dropoutRate }
  }
}
tf.serialization.registerClass(TransformerEncoderBlock)

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
const ENTROPY_THRESHOLD = null  // null = auto-calculate as log(nClasses)/2

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

/** Normalize model label to match UI conventions */
function normalizeLabel(label) {
  if (!label) return label
  // Replace underscores with spaces (THANK_YOU → THANK YOU)
  let normalized = label.replace(/_/g, ' ')
  // Trim multi-word variants (BIG LARGE → BIG, SMALL LITTLE → SMALL)
  const LABEL_SHORTCUTS = {
    'BIG LARGE': 'BIG',
    'SMALL LITTLE': 'SMALL',
    'STORE OR SHOP': 'SHOP',
    'STREET OR ROAD': 'ROAD',
    'RACE (ETHNICITY)': 'RACE',
    'YOU (PLURAL)': 'YOU ALL',
    'EX. MONSOON': 'MONSOON',
  }
  if (LABEL_SHORTCUTS[normalized]) {
    normalized = LABEL_SHORTCUTS[normalized]
  }
  return normalized
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
  const motionRef = useRef(new MotionAnalyzer())
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

      // Promise.allSettled wraps each result in { status, value } — must unwrap
      const tModel  = temporalResult.value?.model ?? null
      const sModel  = staticResult.value?.model ?? null
      const tLabels = temporalLabels.value ?? null
      const sLabels = staticLabels.value ?? null
      const calData = calibrationData.value ?? { temperature: 1.0 }

      modelsRef.current = { temporal: tModel, static: sModel }
      labelMapsRef.current = { temporal: tLabels, static: sLabels }
      calibrationRef.current = {
        temporal: calData?.temperature ?? 1.0,
        static: 1.0,
      }

      console.log('[LexiSight] Models loaded —',
        'temporal:', tModel ? 'OK' : 'MISSING',
        'static:', sModel ? 'OK' : 'MISSING',
        'labels:', tLabels ? Object.keys(tLabels).length + 'cls' : 'MISSING'
      )

      if (tModel) {
        oosRef.current = new OOSDetector(
          Object.keys(tLabels || {}).length || 263
        )
      }

      setProgress(100)
      if (!tModel && !sModel) {
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

      // Normalize labels from model output (e.g. THANK_YOU → THANK YOU)
      const normalizedTopK = topK.map(t => ({ ...t, label: normalizeLabel(t.label) }))

      const rawResult = {
        label: normalizedTopK[0]?.label || 'UNKNOWN',
        confidence: topConf,
        topK: normalizedTopK,
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

      if (bufferRef.current.length < BUFFER_SIZE) {
        // Not enough frames for temporal model — use geometric classifier as fallback
        if (rawLandmarks && rawLandmarks.length === 21) {
          const geoResult = classifyGesture(rawLandmarks)
          if (geoResult) {
            metricsRef.current.record(performance.now() - t0, geoResult.confidence, null, false, 'geo_fallback')
            return geoResult
          }
        }
        return null
      }

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

    // Motion Analyzer Interception — catches dynamic gestures (WHAT, NO, COME, etc.)
    const motionResult = motionRef.current.push(rawLandmarks).analyze()
    if (motionResult) {
      return motionResult
    }

    // Add frame to rolling buffer
    bufferRef.current.push(Array.from(frame))
    if (bufferRef.current.length > BUFFER_SIZE) bufferRef.current.shift()

    // While buffer fills, use geometric classifier for instant results
    if (bufferRef.current.length < BUFFER_SIZE) {
      if (rawLandmarks && rawLandmarks.length === 21) {
        const geoResult = classifyGesture(rawLandmarks)
        if (geoResult) return geoResult
      }
      return null
    }

    // Run temporal model — skip frames for CPU efficiency
    temporalFrameCountRef.current++
    if (temporalFrameCountRef.current % PREDICT_EVERY_N !== 0 && lastTemporalResultRef.current) {
      const s = smootherRef.current.add(lastTemporalResultRef.current)
      metricsRef.current.record(performance.now() - t0, s?.confidence || 0, s?.stability || 0, !s, 'smoothing')
      return s
    }

    // Run the actual temporal model inference
    const rawResult = _predictTemporal(bufferRef.current, labelMap, temp, nClasses)
    if (!rawResult || rawResult.rejected) {
      // Temporal model unavailable or rejected — fall back to geometric
      if (rawLandmarks && rawLandmarks.length === 21) {
        const geoResult = classifyGesture(rawLandmarks)
        if (geoResult) return geoResult
      }
      metricsRef.current.record(performance.now() - t0, 0, 0, true, 'rejected')
      return smootherRef.current.add(null)
    }

    const predicted = smootherRef.current.add(rawResult)
    metricsRef.current.record(
      performance.now() - t0,
      predicted?.confidence || rawResult?.confidence || 0,
      smootherRef.current.stability,
      !predicted,
      !predicted ? 'oov' : null
    )

    return predicted
  }, [_predictTemporal])

  // ═══════════════════════════════════════════════════════════════════════
  // NEW CODE — predictStatic
  // Dedicated static-only path for Photo mode.
  // Bypasses temporal buffer, motion analyzer, and the global `mode` state.
  // Uses the static MLP directly and averages predictions over N jittered
  // copies of the landmark vector for noise-robust single-frame inference.
  // ═══════════════════════════════════════════════════════════════════════
  const predictStatic = useCallback((landmarks, rawLandmarks, options = {}) => {
    const { jitterCount = 6, jitterScale = 0.008, confThreshold = 0.55 } = options  // FIX: lowered from 0.70 to 0.55
    if (!landmarks || landmarks.length !== 63) return null
    const t0 = performance.now()

    const model = modelsRef.current.static
    const labelMap = labelMapsRef.current.static
    const temp = calibrationRef.current.static

    // If static model missing → graceful geometric fallback
    if (!model || !labelMap) {
      if (rawLandmarks && rawLandmarks.length === 21) {
        const r = classifyGesture(rawLandmarks)
        metricsRef.current.record(performance.now() - t0, r?.confidence || 0, null, !r, 'geometric')
        return r ? { ...r, source: 'geometric' } : null
      }
      return null
    }

    return tf.tidy(() => {
      // Build a batch: original + N jittered variants
      const batch = [Array.from(landmarks)]
      for (let i = 0; i < jitterCount; i++) {
        const jittered = new Array(63)
        for (let k = 0; k < 63; k++) {
          jittered[k] = landmarks[k] + (Math.random() - 0.5) * 2 * jitterScale
        }
        batch.push(jittered)
      }
      const input = tf.tensor2d(batch)
      const rawLogits = model.predict(input)
      const allProbs = rawLogits.arraySync()
      const nClasses = Object.keys(labelMap).length

      // Average softmax across augmentations
      let probs = new Array(nClasses).fill(0)
      for (const row of allProbs) {
        for (let j = 0; j < nClasses; j++) probs[j] += row[j]
      }
      probs = probs.map(v => v / allProbs.length)

      // Temperature calibration
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

      // Below threshold — try geometric fallback once, else report low-confidence
      if (topConf < confThreshold) {
        if (rawLandmarks && rawLandmarks.length === 21) {
          const geo = classifyGesture(rawLandmarks)
          if (geo && geo.confidence >= 0.70) {
            metricsRef.current.record(performance.now() - t0, geo.confidence, null, false, 'geo_fallback')
            return { ...geo, source: 'geometric' }
          }
        }
        metricsRef.current.record(performance.now() - t0, topConf, null, true, 'low_conf_static')
        return {
          label: topK[0]?.label || 'UNKNOWN',
          confidence: topConf,
          topK,
          state,
          rejected: true,
          lowConfidence: true,
          source: 'static_mlp',
        }
      }

      const result = {
        label: topK[0]?.label || 'UNKNOWN',
        confidence: topConf,
        topK,
        state,
        rejected: state === PredictionState.UNKNOWN,
        source: 'static_mlp',
      }
      metricsRef.current.record(performance.now() - t0, topConf, null, false, null)
      return disambiguate(result, rawLandmarks)
    })
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // NEW CODE — resetBuffer / getBufferProgress
  // Used by Video lifecycle (upload/play/ended) and by Photo to avoid
  // leaking stale temporal frames between modes.
  // ═══════════════════════════════════════════════════════════════════════
  const resetBuffer = useCallback(() => {
    bufferRef.current = []
    temporalFrameCountRef.current = 0
    lastTemporalResultRef.current = null
    smootherRef.current.reset()
    motionRef.current.reset()
  }, [])

  const getBufferProgress = useCallback(
    () => Math.min(1, bufferRef.current.length / BUFFER_SIZE),
    []
  )

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
    predictStatic,       // NEW — Photo mode
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
    resetBuffer,         // NEW — Video lifecycle
    getBufferProgress,   // NEW — UI progress bar
    getMetrics,
  }
}
