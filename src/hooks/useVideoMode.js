import { useState, useEffect, useRef, useCallback } from 'react'
import { useClassifier } from './useClassifier'
import { drawLandmarks, normalizeLandmarks } from '../utils/landmarks'

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js'

/** Load a CDN script exactly once */
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

  const videoRef     = useRef(null)
  const canvasRef    = useRef(null)
  const fileInputRef = useRef(null)
  const rafRef       = useRef(null)
  const handsRef     = useRef(null)
  const mpReadyRef   = useRef(false)

  const { predictContinuous, startContinuous, stopContinuous } = useClassifier()

  // ── Boot our own MediaPipe Hands for video-frame processing ───
  useEffect(() => {
    let cancelled = false

    async function initHands() {
      try {
        await loadScript(MEDIAPIPE_CDN)
        if (cancelled || !window.Hands) return

        const hands = new window.Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`,
        })

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.65,
          minTrackingConfidence: 0.5,
        })

        hands.onResults((results) => {
          if (cancelled) return
          if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) return

          // Draw skeleton onto optional canvas (cosmetic)
          const canvas = canvasRef.current
          if (canvas && results.image) {
            const ctx = canvas.getContext('2d')
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)
            drawLandmarks(ctx, results.multiHandLandmarks, results.multiHandedness)
          }

          // ── Build args the same way Translator.jsx does ──────────
          // raw21  = raw MediaPipe landmark objects (21 per hand)
          // norm63 = normalized flat 63-number array
          const raw21  = results.multiHandLandmarks[0]
          const norm63 = normalizeLandmarks(raw21)

          let norm63_2 = null
          if (results.multiHandLandmarks.length > 1) {
            norm63_2 = normalizeLandmarks(results.multiHandLandmarks[1])
          }

          // predictContinuous(landmarks63, rawLandmarks21, landmarks2_63)
          const result = predictContinuous(norm63, raw21, norm63_2)
          if (result && result.label !== currentSign?.label) {
            setCurrentSign(result)
          }
        })

        handsRef.current  = hands
        mpReadyRef.current = true
      } catch (e) {
        console.warn('LexiSight VideoMode: MediaPipe load failed —', e.message)
        mpReadyRef.current = false
      }
    }

    initHands()
    return () => { cancelled = true }
  }, [predictContinuous, currentSign])

  // ── Frame-by-frame processing loop ────────────────────────────
  const processFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.paused || video.ended) {
      setIsPlaying(false)
      if (video?.ended) {
        setIsProcessing(false)
        stopContinuous()
      }
      return
    }

    setProgress((video.currentTime / video.duration) * 100)

    if (handsRef.current && mpReadyRef.current) {
      // Fire-and-forget — results come back via onResults callback
      handsRef.current.send({ image: video }).catch(() => {})
    }

    rafRef.current = requestAnimationFrame(processFrame)
  }, [stopContinuous])

  const handlePlay = useCallback(() => {
    const video = videoRef.current
    if (!video || isPlaying) return
    setIsPlaying(true)
    setIsProcessing(true)
    startContinuous()
    video.play()
      .then(() => {
        rafRef.current = requestAnimationFrame(processFrame)
      })
      .catch((err) => {
        console.error('LexiSight VideoMode: video.play() error —', err)
        setIsPlaying(false)
        setIsProcessing(false)
      })
  }, [isPlaying, startContinuous, processFrame])

  const handlePause = useCallback(() => {
    const video = videoRef.current
    if (!video || !isPlaying) return
    video.pause()
    setIsPlaying(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [isPlaying])

  const handleVideoUpload = useCallback((event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (videoUrl) URL.revokeObjectURL(videoUrl)

    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    setIsLoaded(true)
    setIsPlaying(false)
    setIsProcessing(false)
    setProgress(0)
    setCurrentSign(null)
  }, [videoUrl])

  const resetVideo = useCallback(() => {
    handlePause()
    const video = videoRef.current
    if (video) {
      video.currentTime = 0
      setProgress(0)
      setCurrentSign(null)
    }
  }, [handlePause])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

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
    handlePlay,
    handlePause,
    handleVideoUpload,
    resetVideo,
  }
}
