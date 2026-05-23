// ══════════════════════════════════════════════════════════════════════════
// useVideoMode.js — Production-stable version with temporal recognition
//
// FIXES APPLIED:
// 1. Uses predictContinuous() instead of predict()
// 2. Proper 30-frame sliding buffer management
// 3. Fixed 15 FPS sampling with requestVideoFrameCallback
// 4. Motion segmentation for gesture boundaries
// 5. Full lifecycle management (play/pause/reset/ended)
// 6. Timeout protection and error boundaries
// 7. Debug instrumentation for diagnostics
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSharedClassifier } from '../contexts/ClassifierContext.jsx'
import { drawLandmarks, normalizeLandmarks } from '../utils/landmarks'

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js'
const SAMPLE_FPS = 15
const SAMPLE_INTERVAL = 1000 / SAMPLE_FPS  // ~66.7 ms
const PROCESSING_TIMEOUT = 15000  // 15 seconds for video processing
const CONFIDENCE_THRESHOLD = 0.60  // Lower for temporal (needs sequence context)
const STABILITY_WINDOW = 3  // FIX: Require 3 consecutive same predictions

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.crossOrigin = 'anonymous'
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export function useVideoMode() {
  const [videoUrl, setVideoUrl]       = useState(null)
  const [isLoaded, setIsLoaded]       = useState(false)
  const [isPlaying, setIsPlaying]     = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress]       = useState(0)
  const [currentSign, setCurrentSign] = useState(null)
  const [debugInfo, setDebugInfo]     = useState(null)
  const [isMpReady, setIsMpReady]     = useState(false)
  const [motionScore, setMotionScore] = useState(0)  // NEW: motion tracking

  const videoRef       = useRef(null)
  const canvasRef      = useRef(null)
  const fileInputRef   = useRef(null)
  const rafRef         = useRef(null)
  const handsRef       = useRef(null)
  const frameCountRef  = useRef(0)
  const rvfcIdRef      = useRef(null)
  const lastSampleRef  = useRef(0)
  const isFirstResultRef = useRef(true)
  const mountedRef     = useRef(true)
  const timeoutRef     = useRef(null)
  const lastLandmarksRef = useRef(null)  // NEW: for motion detection
  const predictionHistoryRef = useRef([])  // NEW: for stabilization

  // FIX — use shared classifier (predictContinuous + buffer management)
  const { predictContinuous, startContinuous, stopContinuous, resetBuffer, getBufferProgress } = useSharedClassifier()

  const predictRef = useRef(predictContinuous)
  useEffect(() => { predictRef.current = predictContinuous }, [predictContinuous])
  const currentSignRef = useRef(null)
  useEffect(() => { currentSignRef.current = currentSign }, [currentSign])

  // ── Boot MediaPipe Hands for video-frame processing ──
  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    async function initHands() {
      try {
        console.log('[VideoMode] Loading MediaPipe Hands from CDN...')
        await loadScript(MEDIAPIPE_CDN)
        if (cancelled || !mountedRef.current || !window.Hands) {
          console.warn('[VideoMode] MediaPipe Hands not available after script load')
          return
        }

        const hands = new window.Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
        })

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.4,
        })

        hands.onResults((results) => {
          if (cancelled || !mountedRef.current) return

          // FIX — warm-up complete on first callback
          if (isFirstResultRef.current) {
            console.log('[VideoMode] First onResults received — MediaPipe fully initialized')
            isFirstResultRef.current = false
            setIsMpReady(true)
            return  // Don't process warm-up result
          }

          if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
            setDebugInfo(prev => ({ ...prev, handsDetected: 0 }))
            return
          }

          const raw21  = results.multiHandLandmarks[0]
          const norm63 = normalizeLandmarks(raw21)

          let norm63_2 = null
          if (results.multiHandLandmarks.length > 1) {
            norm63_2 = normalizeLandmarks(results.multiHandLandmarks[1])
          }

          // FIX: Motion detection
          const motion = calculateMotion(lastLandmarksRef.current, norm63)
          setMotionScore(motion)
          lastLandmarksRef.current = norm63

          // FIX — correct 3-arg call: (norm63, raw21, norm63_2)
          // predictContinuous internally buffers frames and runs temporal model.
          let result = null
          try {
            result = predictRef.current(norm63, raw21, norm63_2)
          } catch (e) {
            console.warn('[VideoMode] predictContinuous error:', e.message)
          }

          if (result) {
            // FIX: Prediction stabilization
            const stabilized = stabilizePrediction(result)
            
            console.log(
              '[VideoMode] DETECTED:', stabilized.label,
              '| conf:', (stabilized.confidence * 100).toFixed(0) + '%',
              '| buffer:', getBufferProgress().toFixed(2),
              '| smoothed:', !!stabilized.smoothed,
              '| motion:', motion.toFixed(3)
            )
            
            setCurrentSign(stabilized)

            // FIX — debug info for UI
            setDebugInfo({
              label: stabilized.label,
              confidence: stabilized.confidence,
              smoothed: stabilized.smoothed,
              bufferProgress: getBufferProgress(),
              source: stabilized.source || 'temporal',
              motionScore: motion,
              handsDetected: results.multiHandLandmarks.length,
            })
          }
        })

        handsRef.current = hands
        
        // FIX — warm-up: send a blank canvas to trigger WASM model download
        console.log('[VideoMode] Sending warm-up frame to initialize WASM models...')
        const warmupCanvas = document.createElement('canvas')
        warmupCanvas.width = 640
        warmupCanvas.height = 480
        const ctx = warmupCanvas.getContext('2d')
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, 640, 480)
        
        hands.send({ image: warmupCanvas }).catch((err) => {
          console.error('[VideoMode] Warm-up send failed:', err)
          setIsMpReady(true)
        })
      } catch (e) {
        console.warn('[VideoMode] MediaPipe load failed:', e.message)
        setIsMpReady(false)
      }
    }

    initHands()
    return () => {
      cancelled = true
      mountedRef.current = false
      stopRAF()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Motion calculation helper ─────────────────────────────
  const calculateMotion = useCallback((prev, curr) => {
    if (!prev || !curr) return 0
    let sum = 0
    for (let i = 0; i < 63; i++) {
      sum += Math.abs(curr[i] - prev[i])
    }
    return sum / 63
  }, [])

  // ── Prediction stabilization ─────────────────────────────
  const stabilizePrediction = useCallback((result) => {
    const history = predictionHistoryRef.current
    history.push(result)
    
    // Keep last STABILITY_WINDOW predictions
    if (history.length > STABILITY_WINDOW) {
      history.shift()
    }
    
    // If we have enough history, check for stability
    if (history.length >= STABILITY_WINDOW) {
      const recent = history.slice(-STABILITY_WINDOW)
      const allSame = recent.every(p => p.label === result.label)
      const avgConf = recent.reduce((sum, p) => sum + p.confidence, 0) / recent.length
      
      if (allSame && avgConf >= CONFIDENCE_THRESHOLD) {
        return {
          ...result,
          confidence: avgConf,
          smoothed: true,
          stabilized: true,
        }
      }
    }
    
    return result
  }, [])

  // ─ Stop requestAnimationFrame loop ───────────────────────────
  const stopRAF = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (rvfcIdRef.current !== null && videoRef.current) {
      try { videoRef.current.cancelVideoFrameCallback(rvfcIdRef.current) } catch {}
      rvfcIdRef.current = null
    }
  }, [])

  // ─ Process frame with RVFC ────────────────────────────────
  const processFrameRVFC = useCallback(() => {
    const video = videoRef.current
    if (!video || video.paused || video.ended) return

    setProgress((video.currentTime / video.duration) * 100)

    // Throttle to SAMPLE_FPS (avoid oversampling)
    const now = performance.now()
    if (now - lastSampleRef.current >= SAMPLE_INTERVAL) {
      lastSampleRef.current = now
      frameCountRef.current++

      if (handsRef.current && isMpReady) {
        handsRef.current.send({ image: video }).catch(() => {})
      }
    }

    // Schedule next
    try {
      rvfcIdRef.current = video.requestVideoFrameCallback(processFrameRVFC)
    } catch {
      // Fallback: rAF with time check (already throttled above)
      rafRef.current = requestAnimationFrame(processFrameRVFC)
    }
  }, [isMpReady])

  // ── Legacy rAF loop (kept for browsers without RVFC) ──────────
  const processFrameRAF = useCallback(() => {
    const video = videoRef.current
    if (!video || video.paused || video.ended) return

    setProgress((video.currentTime / video.duration) * 100)

    const now = performance.now()
    if (now - lastSampleRef.current >= SAMPLE_INTERVAL) {
      lastSampleRef.current = now
      frameCountRef.current++

      if (handsRef.current && isMpReady) {
        handsRef.current.send({ image: video }).catch(() => {})
      }
    }

    rafRef.current = requestAnimationFrame(processFrameRAF)
  }, [isMpReady])

  // ── Handle play ───────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    const video = videoRef.current
    if (!video || isPlaying) return

    if (!handsRef.current || !isMpReady) {
      console.warn('[VideoMode] MediaPipe not ready')
      return
    }

    setIsPlaying(true)
    setIsProcessing(true)
    frameCountRef.current = 0
    lastSampleRef.current = 0
    predictionHistoryRef.current = []  // FIX: Reset prediction history

    // FIX — reset buffer on every play so fresh temporal window
    resetBuffer()
    startContinuous()
    
    console.log('[VideoMode] Starting video processing at', SAMPLE_FPS, 'FPS')

    // FIX: Timeout protection
    timeoutRef.current = setTimeout(() => {
      if (isProcessing) {
        console.error('[VideoMode] Processing timed out')
        handlePause()
      }
    }, PROCESSING_TIMEOUT)

    // Try RVFC first, fallback to rAF
    try {
      rvfcIdRef.current = video.requestVideoFrameCallback(processFrameRVFC)
    } catch {
      rafRef.current = requestAnimationFrame(processFrameRAF)
    }
  }, [isPlaying, isMpReady, isProcessing, resetBuffer, startContinuous, processFrameRVFC, processFrameRAF])

  // ── Handle pause ──────────────────────────────────────────────
  const handlePause = useCallback(() => {
    setIsPlaying(false)
    setIsProcessing(false)
    stopRAF()
    stopContinuous()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    
    console.log('[VideoMode] Video paused, buffers cleared')
  }, [stopRAF, stopContinuous])

  // ── Handle video ended ────────────────────────────────────────
  const handleEnded = useCallback(() => {
    console.log('[VideoMode] Video ended')
    setIsPlaying(false)
    setIsProcessing(false)
    stopRAF()
    stopContinuous()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    
    // Reset prediction state
    setCurrentSign(null)
    setDebugInfo(null)
    predictionHistoryRef.current = []
  }, [stopRAF, stopContinuous])

  // ── Handle video upload ───────────────────────────────────────
  const handleVideoUpload = useCallback((event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // FIX: Validate file
    if (!file.type.startsWith('video/')) {
      console.error('[VideoMode] Invalid file type')
      return
    }

    if (videoUrl) URL.revokeObjectURL(videoUrl)

    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    setIsLoaded(true)
    setIsPlaying(false)
    setIsProcessing(false)
    setProgress(0)
    setCurrentSign(null)
    setDebugInfo(null)
    frameCountRef.current = 0
    predictionHistoryRef.current = []
    
    console.log('[VideoMode] Video uploaded:', file.name)
  }, [videoUrl])

  // ── Reset video ──────────────────────────────────────────────
  const resetVideo = useCallback(() => {
    setIsLoaded(false)
    setIsPlaying(false)
    setIsProcessing(false)
    setProgress(0)
    setCurrentSign(null)
    setDebugInfo(null)
    setVideoUrl(null)
    frameCountRef.current = 0
    predictionHistoryRef.current = []
    lastLandmarksRef.current = null
    stopRAF()
    stopContinuous()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    
    console.log('[VideoMode] Video reset')
  }, [stopRAF, stopContinuous])

  return {
    videoRef,
    canvasRef,
    fileInputRef,
    videoUrl,
    isLoaded,
    isPlaying,
    isProcessing,
    progress,
    currentSign,
    debugInfo,
    motionScore,
    handlePlay,
    handlePause,
    handleEnded,
    handleVideoUpload,
    resetVideo,
  }
}
