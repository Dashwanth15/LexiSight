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

export function usePhotoMode() {
  const [photoUrl, setPhotoUrl] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentSign, setCurrentSign] = useState(null)

  const imageRef     = useRef(null)
  const canvasRef    = useRef(null)
  const fileInputRef = useRef(null)
  const handsRef     = useRef(null)
  const mpReadyRef   = useRef(false)

  // useClassifier returns predict, predictContinuous, etc.
  const { predict } = useClassifier()

  // ── Boot our own MediaPipe Hands for static-image processing ──
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
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5,
        })

        hands.onResults((results) => {
          if (cancelled) return

          if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
            setCurrentSign(null)
            setIsProcessing(false)
            return
          }

          // Draw skeleton onto canvas (cosmetic only)
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

          let raw21_2  = null
          let norm63_2 = null
          if (results.multiHandLandmarks.length > 1) {
            raw21_2  = results.multiHandLandmarks[1]
            norm63_2 = normalizeLandmarks(raw21_2)
          }

          // predict(landmarks63, rawLandmarks21, rawLandmarks2_21, landmarks2_63)
          const result = predict(norm63, raw21, raw21_2, norm63_2)
          if (result) setCurrentSign(result)
          setIsProcessing(false)
        })

        handsRef.current  = hands
        mpReadyRef.current = true
      } catch (e) {
        console.warn('LexiSight PhotoMode: MediaPipe load failed —', e.message)
        mpReadyRef.current = false
      }
    }

    initHands()
    return () => { cancelled = true }
  }, [predict])

  const processImage = useCallback(() => {
    const image = imageRef.current
    if (!image || !handsRef.current || !mpReadyRef.current) return
    setIsProcessing(true)
    handsRef.current.send({ image })
  }, [])

  const handlePhotoUpload = useCallback((event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (photoUrl) URL.revokeObjectURL(photoUrl)

    const url = URL.createObjectURL(file)
    setPhotoUrl(url)
    setIsLoaded(true)
    setCurrentSign(null)

    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      // Give React a tick to commit the img element before sending
      setTimeout(() => processImage(), 100)
    }
    img.crossOrigin = 'anonymous'
    img.src = url
  }, [photoUrl, processImage])

  const resetPhoto = useCallback(() => {
    setIsLoaded(false)
    setIsProcessing(false)
    setCurrentSign(null)
    setPhotoUrl(null)
    imageRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl)
    }
  }, [photoUrl])

  return {
    imageRef,
    canvasRef,
    fileInputRef,
    photoUrl,
    isLoaded,
    isProcessing,
    currentSign,
    handlePhotoUpload,
    resetPhoto,
  }
}
