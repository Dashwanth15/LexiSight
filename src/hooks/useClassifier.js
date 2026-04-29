import { useState, useEffect, useRef, useCallback } from 'react'
import * as tf from '@tensorflow/tfjs'
import { GESTURE_CLASSES, DEMO_SEQUENCE } from '../utils/gestureMap.js'
import { classifyGesture, classifyTwoHandGesture, classifyISLDigit } from '../utils/geoClassifier.js'
import { disambiguate } from '../utils/fingerDisambiguator.js'

const MODEL_PATH = '/model/tfjs_model/model.json'
const LABEL_MAP_PATH = '/model/label_map.json'
const SCALER_PATH = '/model/scaler.json'

export function useClassifier() {
  const modelRef = useRef(null)
  const scalerRef = useRef(null)
  const labelMapRef = useRef(null)
  const isTemporalRef = useRef(false)
  const sequenceBufferRef = useRef([]) // 30-frame ring buffer
  const temporalFrameCountRef = useRef(0)
  const lastTemporalResultRef = useRef(null)
  const demoIndexRef = useRef(0)
  const [status, setStatus] = useState('idle') // idle | loading | ready | error | demo | geometric
  const [mode, setMode] = useState('word') // 'word' | 'letter'
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState(null)
  const [isDemoMode, setIsDemoMode] = useState(false)

  useEffect(() => {
    loadModel()
  }, [])

  async function loadModel() {
    setStatus('loading')
    setProgress(10)

    try {
      // Try loading from cache first
      await tf.ready()
      setProgress(25)

      const [model, labelMap, scaler] = await Promise.all([
        tf.loadLayersModel(MODEL_PATH).catch(() => null),
        fetch(LABEL_MAP_PATH).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(SCALER_PATH).then(r => r.ok ? r.json() : null).catch(() => null),
      ])

      setProgress(80)

      if (!model || !labelMap) {
        console.warn('LexiSight: Model not found, switching to Geometric Classifier fallback')
        setStatus('geometric')
        return
      }

      modelRef.current = model
      labelMapRef.current = labelMap
      scalerRef.current = scaler
      
      // Auto-detect if temporal model (shape: [null, 30, 126]) or static (shape: [null, 63])
      const inputShape = model.inputs[0].shape
      isTemporalRef.current = inputShape && inputShape.length === 3 && inputShape[1] === 30

      // Warmup inference
      try {
        const dummyShape = isTemporalRef.current ? [1, 30, 126] : [1, 63]
        const dummy = tf.zeros(dummyShape)
        await model.predict(dummy).data()
        dummy.dispose()
      } catch (wErr) {
        console.warn('Warmup failed (likely shape mismatch), skipping.', wErr)
      }

      setProgress(100)
      setStatus('ready')
    } catch (err) {
      console.error('Model load error:', err)
      setStatus('geometric')
      setErrorMsg('Model not found — running Geometric Classifier fallback')
    }
  }

  /**
   * Run prediction on landmarks
   * @param {Array} landmarks      - Normalized 63-feature vector (primary hand)
   * @param {Array} rawLandmarks   - Raw MediaPipe landmarks (primary hand)
   * @param {Array} rawLandmarks2  - Raw MediaPipe landmarks (secondary hand, optional)
   * Returns { label, confidence, topK }
   */
  const predict = useCallback((landmarks, rawLandmarks, rawLandmarks2 = null, landmarks2 = null) => {
    if (isDemoMode || status === 'demo') return null

    // ── Priority 1: two-hand geometric check ─────────────────────────────────
    if (rawLandmarks2 && rawLandmarks2.length === 21) {
      const twoHandResult = classifyTwoHandGesture(rawLandmarks, rawLandmarks2)
      if (twoHandResult) return twoHandResult
    }

    // ── Priority 2: ISL digit geometric classifier ───────────────────────────
    // Digits 0–9 are 100% geometrically deterministic.
    // The ML model confuses them (2↔3, 6↔7, etc.) because of training overlap.
    // Geometry IS the ground truth for digits — always runs before ML.
    if (rawLandmarks && rawLandmarks.length === 21) {
      const digitResult = classifyISLDigit(rawLandmarks)
      if (digitResult) return digitResult
    }

    // ── Priority 2.5: Mode override ──────────────────────────────────────────
    // If user selected Letter mode, but we have a temporal (Word) model, use geometric
    if (mode === 'letter' && isTemporalRef.current) {
      if (!rawLandmarks || rawLandmarks.length !== 21) return null
      return classifyGesture(rawLandmarks)
    }
    // If user selected Word mode, but we have a static (Letter) model, use geometric for the few words it knows
    if (mode === 'word' && !isTemporalRef.current && status !== 'geometric') {
      if (rawLandmarks && rawLandmarks.length === 21) {
        const geo = classifyGesture(rawLandmarks)
        if (geo && geo.label.length > 1) return geo // Words are typically > 1 char
      }
    }

    // ── Priority 3: single-hand geometric fallback ────────────────────────────
    if (status === 'geometric') {
      if (!rawLandmarks || rawLandmarks.length !== 21) return null
      return classifyGesture(rawLandmarks)
    }

    // ── Priority 3: ML model ─────────────────────────────────────────────────
    if (!modelRef.current || !labelMapRef.current) return null
    if (!landmarks || landmarks.length !== 63) return null

    // Manage temporal sequence buffer
    if (isTemporalRef.current) {
      // Build 126-feature frame: [hand1(63), hand2(63)]
      const frame = new Float32Array(126)
      frame.set(landmarks, 0)
      if (landmarks2 && landmarks2.length === 63) {
        frame.set(landmarks2, 63)
      } else {
        frame.set(new Float32Array(63), 63) // zeros for missing second hand
      }
      
      // Update ring buffer
      sequenceBufferRef.current.push(frame)
      if (sequenceBufferRef.current.length > 30) {
        sequenceBufferRef.current.shift()
      }
      
      // Wait until buffer is full before predicting temporal words
      if (sequenceBufferRef.current.length < 30) return null
      
      // Throttle temporal inference to every 5 frames
      temporalFrameCountRef.current++
      if (temporalFrameCountRef.current % 5 !== 0 && lastTemporalResultRef.current) {
        return lastTemporalResultRef.current
      }
    }

    return tf.tidy(() => {
      let input
      
      if (isTemporalRef.current) {
        // Temporal Model: shape [1, 30, 126]
        const seqTensor = tf.tensor2d(sequenceBufferRef.current, [30, 126])
        input = seqTensor.expandDims(0)
      } else {
        // Static Model: shape [1, 63]
        let normalized = landmarks
        // Apply StandardScaler if available (old model only)
        if (scalerRef.current?.mean && scalerRef.current?.scale) {
          const { mean, scale } = scalerRef.current
          normalized = landmarks.map((v, i) => (v - mean[i]) / (scale[i] || 1))
        }
        input = tf.tensor2d([normalized])
      }

      const output = modelRef.current.predict(input)
      const probs = Array.from(output.dataSync())

      const maxIdx = probs.indexOf(Math.max(...probs))
      const confidence = probs[maxIdx]
      const label = labelMapRef.current[String(maxIdx)] || GESTURE_CLASSES[maxIdx] || 'UNKNOWN'

      // Top-3
      const indexed = probs.map((p, i) => ({
        label: labelMapRef.current[String(i)] || GESTURE_CLASSES[i] || String(i),
        confidence: p
      }))
      const topK = indexed.sort((a, b) => b.confidence - a.confidence).slice(0, 3)

      const mlResult = { label, confidence, topK }

      // ── Priority 4: Geometric disambiguator ──────────────────────────────
      // Overrides ML for known confused pairs (2↔3, M↔N, O↔6, U↔R, 7↔8)
      // using deterministic finger curl geometry. No-op for other gestures.
      const finalResult = isTemporalRef.current ? mlResult : disambiguate(mlResult, rawLandmarks)
      
      if (isTemporalRef.current) {
        lastTemporalResultRef.current = finalResult
      }
      
      return finalResult
    })
  }, [isDemoMode, status])

  /**
   * Demo mode: returns next gesture in sequence
   */
  const predictDemo = useCallback(() => {
    const gesture = DEMO_SEQUENCE[demoIndexRef.current % DEMO_SEQUENCE.length]
    demoIndexRef.current++
    return {
      ...gesture,
      topK: [
        gesture,
        { label: DEMO_SEQUENCE[(demoIndexRef.current + 1) % DEMO_SEQUENCE.length].label, confidence: 0.05 },
        { label: DEMO_SEQUENCE[(demoIndexRef.current + 2) % DEMO_SEQUENCE.length].label, confidence: 0.02 },
      ]
    }
  }, [])

  const retry = useCallback(() => {
    setIsDemoMode(false)
    setErrorMsg(null)
    loadModel()
  }, [])

  return {
    predict,
    predictDemo,
    status,
    progress,
    isDemoMode,
    errorMsg,
    mode,
    setMode,
    isTemporal: isTemporalRef.current,
    numClasses: labelMapRef.current ? Object.keys(labelMapRef.current).length : GESTURE_CLASSES.length,
    retry,
  }
}
