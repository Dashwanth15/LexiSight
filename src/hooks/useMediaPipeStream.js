// useMediaPipeStream.js — MediaPipe Hands on existing call <video> (no duplicate decode)
import { useState, useEffect, useRef, useCallback } from 'react'
import { normalizeLandmarks } from '../utils/landmarks.js'

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js'
const FRAME_SKIP = 2

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.crossOrigin = 'anonymous'
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })

async function waitForVideoElement(getVideo, maxMs = 4000) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const el = getVideo()
    if (el && el.readyState >= 1) return el
    await new Promise((r) => setTimeout(r, 50))
  }
  return getVideo()
}

const emptySnapshot = () => ({
  landmarks: null,
  rawLandmarks: null,
  landmarks2: null,
  rawLandmarks2: null,
  handDetected: false,
  hand2Detected: false,
})

/**
 * Attach MediaPipe to an existing WebRTC <video> element (shared with CallVideo).
 */
export default function useMediaPipeStream() {
  const videoRef = useRef(null)
  const externalVideoRef = useRef(null)
  const handsRef = useRef(null)
  const animFrameRef = useRef(null)
  const frameSkipRef = useRef(0)
  const activeRef = useRef(false)
  const snapshotRef = useRef(emptySnapshot())

  const [landmarks, setLandmarks] = useState(null)
  const [rawLandmarks, setRawLandmarks] = useState(null)
  const [landmarks2, setLandmarks2] = useState(null)
  const [rawLandmarks2, setRawLandmarks2] = useState(null)
  const [handDetected, setHandDetected] = useState(false)
  const [hand2Detected, setHand2Detected] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)

  const getVideoEl = useCallback(
    () => externalVideoRef.current || videoRef.current,
    []
  )

  const getSnapshot = useCallback(() => snapshotRef.current, [])

  const stopLoop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }, [])

  const startLoop = useCallback(() => {
    const loop = async () => {
      const video = getVideoEl()
      if (!activeRef.current || !video || !handsRef.current) return
      if (video.readyState >= 2 && !video.paused) {
        frameSkipRef.current++
        if (frameSkipRef.current % FRAME_SKIP === 0) {
          try {
            await handsRef.current.send({ image: video })
          } catch (e) {
            console.warn('[useMediaPipeStream] send failed:', e.message)
          }
        }
      } else if (video.readyState >= 2 && video.paused) {
        video.play().catch(() => {})
      }
      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)
  }, [getVideoEl])

  const attachStream = useCallback(
    async (stream, sharedVideoEl = null) => {
      if (!stream?.getVideoTracks?.().length) {
        setError('no_video_track')
        return false
      }

      stopLoop()
      setError(null)
      setIsReady(false)
      externalVideoRef.current = sharedVideoEl

      try {
        await loadScript(MEDIAPIPE_CDN)
        if (!window.Hands) throw new Error('MediaPipe Hands failed to load')

        if (!handsRef.current) {
          const hands = new window.Hands({
            locateFile: (file) =>
              `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
          })
          hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.55,
            minTrackingConfidence: 0.4,
          })
          hands.onResults((results) => {
            const multi = results.multiHandLandmarks || []
            if (multi.length > 0) {
              const norm = normalizeLandmarks(multi[0])
              const snap = {
                rawLandmarks: multi[0],
                landmarks: norm,
                handDetected: true,
                rawLandmarks2: multi.length > 1 ? multi[1] : null,
                landmarks2: multi.length > 1 ? normalizeLandmarks(multi[1]) : null,
                hand2Detected: multi.length > 1,
              }
              snapshotRef.current = snap
              setRawLandmarks(snap.rawLandmarks)
              setLandmarks(snap.landmarks)
              setHandDetected(true)
              if (multi.length > 1) {
                setRawLandmarks2(snap.rawLandmarks2)
                setLandmarks2(snap.landmarks2)
                setHand2Detected(true)
              } else {
                setRawLandmarks2(null)
                setLandmarks2(null)
                setHand2Detected(false)
              }
            } else {
              snapshotRef.current = emptySnapshot()
              setHandDetected(false)
              setHand2Detected(false)
              setLandmarks(null)
              setRawLandmarks(null)
              setLandmarks2(null)
              setRawLandmarks2(null)
            }
          })
          handsRef.current = hands
        }

        const video = sharedVideoEl || (await waitForVideoElement(getVideoEl))
        if (!video) {
          setError('video_not_ready')
          return false
        }

        if (video.srcObject !== stream) {
          video.srcObject = stream
        }
        video.muted = true
        video.playsInline = true
        try {
          await video.play()
        } catch (e) {
          console.warn('[useMediaPipeStream] play blocked:', e.message)
        }

        await new Promise((resolve) => {
          if (video.readyState >= 2) resolve()
          else video.addEventListener('loadeddata', resolve, { once: true })
        })

        activeRef.current = true
        setIsReady(true)
        startLoop()
        return true
      } catch (err) {
        setError(err.message || 'MediaPipe init failed')
        return false
      }
    },
    [getVideoEl, startLoop, stopLoop]
  )

  const detach = useCallback(() => {
    activeRef.current = false
    stopLoop()
    externalVideoRef.current = null
    snapshotRef.current = emptySnapshot()
    setIsReady(false)
    setHandDetected(false)
    setHand2Detected(false)
    setLandmarks(null)
    setRawLandmarks(null)
    setLandmarks2(null)
    setRawLandmarks2(null)
  }, [stopLoop])

  useEffect(() => () => {
    activeRef.current = false
    stopLoop()
    if (handsRef.current) {
      try {
        handsRef.current.close()
      } catch {}
      handsRef.current = null
    }
  }, [stopLoop])

  return {
    videoRef,
    landmarks,
    rawLandmarks,
    landmarks2,
    rawLandmarks2,
    handDetected,
    hand2Detected,
    isReady,
    error,
    attachStream,
    detach,
    getSnapshot,
  }
}
