// useTemporalClassifier.js — Call-safe bridge to static + temporal TF.js models (local inference)
import { useCallback, useEffect } from 'react'
import { useSharedClassifier } from '../contexts/ClassifierContext.jsx'
import { classifyGesture, classifyISLDigit } from '../utils/geoClassifier.js'

const STATIC_CONF_MIN = 0.42
const TEMPORAL_CONF_MIN = 0.42
const GEO_CONF_MIN = 0.35

const INFERENCE_READY = new Set(['ready', 'continuous', 'geometric'])

/**
 * Word mode → temporal buffer (predictContinuous).
 * Letter / Number → static path (predict), same as Translator live tab.
 */
export default function useTemporalClassifier({ enabled = false } = {}) {
  const classifier = useSharedClassifier()
  const isolationMode = classifier.mode

  useEffect(() => {
    if (!enabled) {
      classifier.stopContinuous?.()
      classifier.resetBuffer?.()
      return
    }

    if (!INFERENCE_READY.has(classifier.status)) return

    if (isolationMode === 'word') {
      classifier.startContinuous?.()
    } else {
      classifier.stopContinuous?.()
      classifier.resetBuffer?.()
    }

    return () => {
      classifier.stopContinuous?.()
      classifier.resetBuffer?.()
    }
  }, [enabled, classifier.status, isolationMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const runFrame = useCallback(
    (landmarks, rawLandmarks, rawLandmarks2, landmarks2) => {
      if (!enabled || !landmarks || landmarks.length !== 63) return null
      if (!rawLandmarks || rawLandmarks.length !== 21) return null
      if (!INFERENCE_READY.has(classifier.status)) return null

      const mode = classifier.mode

      // ── Letter / Number (Translator isolation — uses predict(), not continuous) ──
      if (mode === 'letter' || mode === 'number') {
        try {
          const pred = classifier.predict(
            landmarks,
            rawLandmarks,
            rawLandmarks2,
            landmarks2
          )
          if (pred?.label && !pred.rejected) {
            return { ...pred, source: pred.source || mode }
          }
        } catch (e) {
          console.warn('[useTemporalClassifier] predict error:', e)
        }
        if (mode === 'number') {
          try {
            const digit = classifyISLDigit(rawLandmarks)
            if (digit?.label) return { ...digit, source: 'geometric' }
          } catch {}
        }
        return null
      }

      // ── Word mode (dynamic signs + temporal buffer) ──
      try {
        const geo = classifyGesture(rawLandmarks)
        if (geo?.label && (geo.confidence ?? 0) >= GEO_CONF_MIN) {
          return { ...geo, source: 'geometric' }
        }
      } catch (e) {
        console.warn('[useTemporalClassifier] geometric error:', e)
      }

      try {
        const temporal = classifier.predictContinuous(
          landmarks,
          rawLandmarks,
          landmarks2
        )
        if (
          temporal &&
          !temporal.rejected &&
          temporal.label &&
          (temporal.confidence ?? 0) >= TEMPORAL_CONF_MIN
        ) {
          return { ...temporal, source: temporal.source || 'temporal' }
        }

        const staticPred = classifier.predictStatic(landmarks, rawLandmarks, {
          jitterCount: 4,
          jitterScale: 0.02,
          confThreshold: STATIC_CONF_MIN,
        })
        if (
          staticPred &&
          !staticPred.rejected &&
          staticPred.label &&
          (staticPred.confidence ?? 0) >= STATIC_CONF_MIN
        ) {
          return { ...staticPred, source: staticPred.source || 'static' }
        }

        const geoLate = classifyGesture(rawLandmarks)
        if (geoLate?.label) return { ...geoLate, source: 'geometric' }

        if (temporal?.label) return temporal
        if (staticPred?.label) return staticPred
      } catch (e) {
        console.warn('[useTemporalClassifier] ML inference error:', e)
        const geoFallback = classifyGesture(rawLandmarks)
        if (geoFallback?.label) return { ...geoFallback, source: 'geometric' }
      }

      return null
    },
    [enabled, classifier]
  )

  const isModelReady = INFERENCE_READY.has(classifier.status)

  return {
    runFrame,
    status: classifier.status,
    mode: isolationMode,
    progress: classifier.progress,
    errorMsg: classifier.errorMsg,
    isModelReady,
    getBufferProgress: classifier.getBufferProgress,
    resetBuffer: classifier.resetBuffer,
    retry: classifier.retry,
  }
}
