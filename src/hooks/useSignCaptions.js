// useSignCaptions.js — Local sign → text pipeline for calls (MediaPipe + TF.js, browser-only)
import { useEffect, useRef, useCallback, useState } from 'react'
import useMediaPipeStream from './useMediaPipeStream.js'
import useTemporalClassifier from './useTemporalClassifier.js'
import usePredictionSmoother from './usePredictionSmoother.js'
import useSentenceBuilder from './useSentenceBuilder.js'
import { useSharedClassifier } from '../contexts/ClassifierContext.jsx'

const SEND_THROTTLE_MS = 120
const INFERENCE_INTERVAL_MS = 100
const INFERENCE_INTERVAL_BOTH_MS = 180
const WORD_COOLDOWN_MS = 700
const MIN_CONFIDENCE = 0.38

function formatLabel(label) {
  if (!label || label === 'UNKNOWN') return ''
  return label.replace(/_/g, ' ').trim()
}

/**
 * @param {{
 *   enabled: boolean,
 *   localStream: MediaStream | null,
 *   localVideoEl?: HTMLVideoElement | null,
 *   onCaptionUpdate?: (payload: { stable: string, interim: string }) => void,
 *   onSpeak?: (text: string) => void,
 *   signToSpeech?: boolean,
 *   connectionState?: string,
 *   lowPower?: boolean,
 * }} options
 */
export default function useSignCaptions({
  enabled,
  localStream,
  localVideoEl = null,
  onCaptionUpdate,
  onSpeak,
  signToSpeech = false,
  connectionState = 'idle',
  lowPower = false,
} = {}) {
  const onSpeakRef = useRef(onSpeak)
  onSpeakRef.current = onSpeak

  const sharedClassifier = useSharedClassifier()
  const mediapipe = useMediaPipeStream()
  const classifier = useTemporalClassifier({ enabled })
  const smoother = usePredictionSmoother({ windowSize: 6, threshold: 0.62 })
  const sentence = useSentenceBuilder({
    silenceThreshold: 1800,
    onSentenceComplete: (text) => {
      if (signToSpeech && onSpeakRef.current && text) onSpeakRef.current(text)
    },
  })

  const [stableText, setStableText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [confidence, setConfidence] = useState(0)
  const [lastDetected, setLastDetected] = useState('')

  const lastLabelRef = useRef(null)
  const lastWordTimeRef = useRef(0)
  const lastSendRef = useRef(0)
  const inferTimerRef = useRef(null)
  const smootherRef = useRef(smoother)
  const sentenceRef = useRef(sentence)
  const classifierRef = useRef(classifier)
  const mediapipeRef = useRef(mediapipe)

  smootherRef.current = smoother
  sentenceRef.current = sentence
  classifierRef.current = classifier
  mediapipeRef.current = mediapipe

  useEffect(() => {
    const onVisibility = () => setIsPaused(document.hidden)
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const publishCaption = useCallback(
    (stable, interim) => {
      setStableText(stable)
      setInterimText(interim)
      const now = Date.now()
      if (!onCaptionUpdate || now - lastSendRef.current < SEND_THROTTLE_MS) return
      lastSendRef.current = now
      onCaptionUpdate({ stable, interim })
    },
    [onCaptionUpdate]
  )

  useEffect(() => {
    if (!enabled || !localStream) {
      mediapipe.detach()
      setIsActive(false)
      return
    }

    let cancelled = false
    ;(async () => {
      const ok = await mediapipe.attachStream(localStream, localVideoEl)
      if (!cancelled) setIsActive(ok)
    })()

    return () => {
      cancelled = true
      mediapipe.detach()
      setIsActive(false)
    }
  }, [enabled, localStream, localVideoEl]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (enabled) return
    smoother.reset()
    sentence.clear()
    lastLabelRef.current = null
    setStableText('')
    setInterimText('')
    setConfidence(0)
    setLastDetected('')
    publishCaption('', '')
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset pipeline when isolation mode changes (word ↔ letter ↔ number)
  useEffect(() => {
    if (!enabled) return
    smoother.reset()
    sentence.clear()
    lastLabelRef.current = null
    lastWordTimeRef.current = 0
    sharedClassifier.resetBuffer?.()
    setStableText('')
    setInterimText('')
    setLastDetected('')
    publishCaption('', '')
  }, [sharedClassifier.mode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const modelsOk = classifier.isModelReady || classifier.status === 'loading'
    if (!enabled || !mediapipe.isReady || isPaused || !modelsOk) {
      if (inferTimerRef.current) clearInterval(inferTimerRef.current)
      return
    }

    const interval = lowPower ? INFERENCE_INTERVAL_BOTH_MS : INFERENCE_INTERVAL_MS

    const tick = () => {
      try {
        const mp = mediapipeRef.current
        const clf = classifierRef.current
        const sm = smootherRef.current
        const sb = sentenceRef.current
        const snap = mp.getSnapshot()

        if (!snap.handDetected || !snap.landmarks || !snap.rawLandmarks) {
          sb.setPendingWord('')
          setConfidence(0)
          setLastDetected('')
          publishCaption(sb.getSentence(), '')
          return
        }

        const raw = clf.runFrame(
          snap.landmarks,
          snap.rawLandmarks,
          snap.rawLandmarks2,
          snap.landmarks2
        )

        if (!raw?.label) {
          setConfidence(0)
          return
        }

        const conf = raw.confidence ?? 0
        setConfidence(conf)
        const pending = formatLabel(raw.label)
        setLastDetected(pending)
        sb.setPendingWord(pending)

        publishCaption(sb.getSentence(), pending)

        if (conf < MIN_CONFIDENCE) return

        const confirmed = sm.add(raw)
        if (confirmed?.label && confirmed.label !== lastLabelRef.current) {
          const now = Date.now()
          if (now - lastWordTimeRef.current < WORD_COOLDOWN_MS) return
          lastWordTimeRef.current = now
          lastLabelRef.current = confirmed.label

          const word = formatLabel(confirmed.label)
          const nextStable = sb.addWord(word)
          publishCaption(nextStable, '')
        }
      } catch (e) {
        console.warn('[useSignCaptions] tick error:', e)
      }
    }

    inferTimerRef.current = setInterval(tick, interval)
    return () => clearInterval(inferTimerRef.current)
  }, [
    enabled,
    mediapipe.isReady,
    isPaused,
    classifier.isModelReady,
    classifier.status,
    lowPower,
    publishCaption,
  ])

  const displayText = (stableText + (interimText ? ` ${interimText}` : '')).trim()

  return {
    stableText,
    interimText,
    displayText,
    confidence,
    lastDetected,
    isActive: isActive && enabled && !isPaused,
    isPaused,
    isReady: mediapipe.isReady && (classifier.isModelReady || classifier.status === 'geometric'),
    isLoading: enabled && classifier.status === 'loading',
    handDetected: mediapipe.handDetected,
    bufferProgress: classifier.getBufferProgress?.() ?? 0,
    error: mediapipe.error || classifier.errorMsg,
    videoRef: mediapipe.videoRef,
    connectionState,
    isolationMode: classifier.mode,
  }
}
