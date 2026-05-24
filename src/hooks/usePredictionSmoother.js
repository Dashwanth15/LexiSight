// usePredictionSmoother.js — React hook wrapper for gesture prediction smoothing
import { useRef, useCallback, useState } from 'react'
import { PredictionSmoother } from '../utils/smoothing.js'

/**
 * @param {{ windowSize?: number, threshold?: number }} options
 */
export default function usePredictionSmoother(options = {}) {
  const { windowSize = 8, threshold = 0.72 } = options
  const smootherRef = useRef(null)
  if (!smootherRef.current) {
    smootherRef.current = new PredictionSmoother(windowSize, threshold)
  }

  const [lastConfirmed, setLastConfirmed] = useState(null)

  const add = useCallback((prediction) => {
    const confirmed = smootherRef.current.add(prediction)
    if (confirmed) setLastConfirmed(confirmed)
    return confirmed
  }, [])

  const reset = useCallback(() => {
    smootherRef.current.reset()
    setLastConfirmed(null)
  }, [])

  return {
    add,
    reset,
    lastConfirmed,
    isLocked: smootherRef.current.isLocked,
    stability: smootherRef.current.stability,
  }
}
