import { useState, useEffect, useRef, useCallback } from 'react'
import * as tf from '@tensorflow/tfjs'
import { GESTURE_CLASSES, DEMO_SEQUENCE } from '../utils/gestureMap.js'
import { classifyGesture } from '../utils/geoClassifier.js'

const MODEL_PATH = '/model/tfjs_model/model.json'
const LABEL_MAP_PATH = '/model/label_map.json'
const SCALER_PATH = '/model/scaler.json'

export function useClassifier() {
  const modelRef = useRef(null)
  const scalerRef = useRef(null)
  const labelMapRef = useRef(null)
  const demoIndexRef = useRef(0)
  const [status, setStatus] = useState('idle') // idle | loading | ready | error | demo | geometric
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

      // Warmup inference
      const dummy = tf.zeros([1, 63])
      await model.predict(dummy).data()
      dummy.dispose()

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
   * Returns { label, confidence, topK }
   */
  const predict = useCallback((landmarks, rawLandmarks) => {
    if (isDemoMode || status === 'demo') return null

    if (status === 'geometric') {
      if (!rawLandmarks || rawLandmarks.length !== 21) return null
      return classifyGesture(rawLandmarks)
    }

    if (!modelRef.current || !scalerRef.current || !labelMapRef.current) return null
    if (!landmarks || landmarks.length !== 63) return null

    return tf.tidy(() => {
      let normalized = landmarks

      // Apply StandardScaler if available
      if (scalerRef.current?.mean && scalerRef.current?.scale) {
        const { mean, scale } = scalerRef.current
        normalized = landmarks.map((v, i) => (v - mean[i]) / (scale[i] || 1))
      }

      const input = tf.tensor2d([normalized])
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

      return { label, confidence, topK }
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
    numClasses: labelMapRef.current ? Object.keys(labelMapRef.current).length : GESTURE_CLASSES.length,
    retry,
  }
}
