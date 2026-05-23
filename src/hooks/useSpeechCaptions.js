// useSpeechCaptions.js — Production-optimized subtitle engine
// SUBTITLE STABILITY | AUDIO OPTIMIZATION | PERFORMANCE FIX
import { useState, useEffect, useRef, useCallback } from 'react'

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

// SUBTITLE STABILITY: preferred lang order for Indian-accent recognition
const LANG_PREFERENCE = ['en-IN', 'en-US']

// SUBTITLE STABILITY: min confidence to accept a final result (0–1)
const CONFIDENCE_THRESHOLD = 0.25

// SUBTITLE STABILITY: debounce window for interim display updates (ms)
// Higher = fewer flicker-inducing renders during fast speech
const INTERIM_DEBOUNCE_MS = 160

// SUBTITLE STABILITY: silence window before an interim sentence is locked (ms)
// Mirrors Google Meet's ~500ms sentence-finalization heuristic
const SILENCE_LOCK_MS = 500

// SUBTITLE STABILITY: delay before a SpeechRecognition "final" is committed to DOM (ms)
// Lets interim visually catch up so there's no visible blank gap between interim→final
const COMMIT_DELAY_MS = 350

// SUBTITLE STABILITY: how long finalized text stays visible after silence (ms)
const FINAL_PERSIST_MS = 3500

// SUBTITLE STABILITY: max chars to keep in rolling final buffer
const FINAL_BUFFER_MAX = 220

// AUDIO OPTIMIZATION: mic constraints for cleanest speech signal
const MIC_CONSTRAINTS = {
  audio: {
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 16000,
  },
}

// SUBTITLE STABILITY: collapse runs of the same word ("hello hello hello" → "hello")
function dedupeWords(text) {
  return text
    .trim()
    .replace(/\b(\w+)(\s+\1){2,}/gi, '$1') // 3+ repeats → 1
    .replace(/\s{2,}/g, ' ')
}

// SUBTITLE STABILITY: basic punctuation / capitalisation cleanup
function cleanTranscript(text) {
  if (!text) return ''
  let t = text.trim()
  t = t.charAt(0).toUpperCase() + t.slice(1)
  t = t.replace(/\s+(um|uh|hmm)\s*$/i, '')
  return t
}

// SUBTITLE STABILITY: similarity guard — returns true only when strings are >85% similar
// AND neither is a prefix of the other (accumulating speech must always render).
function isSimilarEnough(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  // If either string extends the other (word accumulation), always treat as different
  if (b.startsWith(a) || a.startsWith(b)) return false
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  let matches = 0
  const minLen = shorter.length
  for (let i = 0; i < minLen; i++) {
    if (shorter[i] === longer[i]) matches++
  }
  return (matches / longer.length) > 0.85
}

/**
 * useSpeechCaptions
 * @param {boolean} enabled - master switch
 * @returns {{ displayText, interimText, finalText, isListening, isSupported, error, toggle }}
 */
export default function useSpeechCaptions(enabled = true) {
  // PERFORMANCE FIX: three-layer text state:
  //   stableText — locked sentence (silence-finalized or API-final)
  //   finalText  — rolling committed finals
  //   interimText — live unconfirmed words
  const [stableText, setStableText]   = useState('')
  const [finalText, setFinalText]     = useState('')
  const [interimText, setInterimText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [error, setError]             = useState(null)

  const recognitionRef    = useRef(null)
  const shouldRunRef      = useRef(enabled)
  const restartCountRef   = useRef(0)
  const restartTimerRef   = useRef(null)
  const clearFinalTimer   = useRef(null)
  const interimDebounce   = useRef(null)
  const commitTimer       = useRef(null)   // SUBTITLE STABILITY: delayed final commit
  const silenceLockTimer  = useRef(null)   // SUBTITLE STABILITY: silence-based sentence lock
  // SUBTITLE STABILITY: track last committed final so we don't double-append
  const lastFinalRef      = useRef('')
  // SUBTITLE STABILITY: track last interim to suppress identical re-renders
  const lastInterimRef    = useRef('')
  // SUBTITLE STABILITY: pending final waiting for COMMIT_DELAY_MS to elapse
  const pendingFinalRef   = useRef('')
  const langIndexRef      = useRef(0)

  const MAX_RESTARTS = 60

  const isSupported = !!SpeechRecognitionAPI

  // AUDIO OPTIMIZATION: acquire optimised mic stream once
  const micStreamRef = useRef(null)
  const acquireMic = useCallback(async () => {
    if (micStreamRef.current) return micStreamRef.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
      micStreamRef.current = stream
      return stream
    } catch {
      // fallback — recognition will use default device
      return null
    }
  }, [])

  const releaseMic = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    shouldRunRef.current = false
    clearTimeout(restartTimerRef.current)
    clearTimeout(clearFinalTimer.current)
    clearTimeout(interimDebounce.current)
    clearTimeout(commitTimer.current)
    clearTimeout(silenceLockTimer.current)
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
    releaseMic()
    setIsListening(false)
    setInterimText('')
  }, [releaseMic])

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition not supported. Use Chrome or Edge.')
      return
    }
    shouldRunRef.current = true
    restartCountRef.current = 0
    lastFinalRef.current = ''
    lastInterimRef.current = ''
    pendingFinalRef.current = ''
    setError(null)
    setStableText('')
    setFinalText('')
    setInterimText('')

    const launch = async () => {
      if (!shouldRunRef.current) return
      if (restartCountRef.current >= MAX_RESTARTS) {
        setError('Captions paused after too many restarts. Refresh to retry.')
        setIsListening(false)
        return
      }

      // SUBTITLE STABILITY: destroy previous instance before creating new one
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch {}
        recognitionRef.current = null
      }

      // AUDIO OPTIMIZATION: warm up mic (result ignored — just for constraints)
      await acquireMic()

      const recognition = new SpeechRecognitionAPI()
      recognitionRef.current = recognition

      // INTEGRATION POINT: recognition configuration
      recognition.continuous      = true
      recognition.interimResults  = true
      recognition.maxAlternatives = 3
      recognition.lang            = LANG_PREFERENCE[langIndexRef.current % LANG_PREFERENCE.length]

      recognition.onstart = () => {
        setIsListening(true)
        setError(null)
      }

      // SUBTITLE STABILITY: core result handler
      recognition.onresult = (event) => {
        let newFinal   = ''
        let newInterim = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]

          if (result.isFinal) {
            // SUBTITLE STABILITY: pick highest-confidence alternative
            let bestAlt = result[0]
            for (let a = 1; a < result.length; a++) {
              if ((result[a].confidence || 0) > (bestAlt.confidence || 0)) bestAlt = result[a]
            }
            if ((bestAlt.confidence || 0) < CONFIDENCE_THRESHOLD) continue
            const cleaned = cleanTranscript(dedupeWords(bestAlt.transcript))
            if (!cleaned) continue
            if (cleaned === lastFinalRef.current.trim()) continue
            newFinal += cleaned + ' '
          } else {
            const interimBest = result[result.length - 1] || result[0]
            newInterim += interimBest.transcript
          }
        }

        // SUBTITLE STABILITY: silence-lock — cancel any pending lock when new speech arrives
        clearTimeout(silenceLockTimer.current)

        // ── FINAL RESULT ────────────────────────────────────────────────────────
        if (newFinal) {
          // SUBTITLE STABILITY: cancel any prior pending commit
          clearTimeout(commitTimer.current)
          clearTimeout(interimDebounce.current)
          pendingFinalRef.current = newFinal

          // SUBTITLE STABILITY: delayed commit — keeps interim visible briefly
          // so there's no blank-gap flash between interim disappearing and final appearing
          commitTimer.current = setTimeout(() => {
            const toCommit = pendingFinalRef.current
            if (!toCommit) return
            pendingFinalRef.current = ''
            lastFinalRef.current = toCommit.trim()

            setFinalText(prev => {
              const combined = (prev + ' ' + toCommit).trim()
              const next = combined.length > FINAL_BUFFER_MAX
                ? combined.slice(-FINAL_BUFFER_MAX)
                : combined
              // SUBTITLE STABILITY: skip state update if text is cosmetically identical
              if (isSimilarEnough(prev, next)) return prev
              return next
            })

            // SUBTITLE STABILITY: promote to stable (locked) sentence
            setStableText(prev => {
              const combined = (prev + ' ' + toCommit).trim()
              return combined.length > FINAL_BUFFER_MAX ? combined.slice(-FINAL_BUFFER_MAX) : combined
            })

            lastInterimRef.current = ''
            setInterimText('')

            // SUBTITLE STABILITY: persistence timer — clear after silence
            clearTimeout(clearFinalTimer.current)
            clearFinalTimer.current = setTimeout(() => {
              setFinalText('')
              setStableText('')
              lastFinalRef.current = ''
            }, FINAL_PERSIST_MS)
          }, COMMIT_DELAY_MS)
        }

        // ── INTERIM RESULT ───────────────────────────────────────────────────────
        if (newInterim) {
          // SUBTITLE STABILITY: silence-based sentence lock
          // If the user pauses for SILENCE_LOCK_MS while we have interim text,
          // promote it to stable so it stops flickering during the pause.
          silenceLockTimer.current = setTimeout(() => {
            const currentInterim = lastInterimRef.current
            if (!currentInterim) return
            const locked = cleanTranscript(dedupeWords(currentInterim))
            if (!locked) return
            // Promote interim → stable (frozen display), clear live interim
            setStableText(prev => {
              const combined = (prev + ' ' + locked).trim()
              return combined.length > FINAL_BUFFER_MAX ? combined.slice(-FINAL_BUFFER_MAX) : combined
            })
            setFinalText(prev => {
              const combined = (prev + ' ' + locked).trim()
              return combined.length > FINAL_BUFFER_MAX ? combined.slice(-FINAL_BUFFER_MAX) : combined
            })
            lastFinalRef.current = locked
            lastInterimRef.current = ''
            setInterimText('')
            // Persistence timer after silence-lock
            clearTimeout(clearFinalTimer.current)
            clearFinalTimer.current = setTimeout(() => {
              setFinalText('')
              setStableText('')
              lastFinalRef.current = ''
            }, FINAL_PERSIST_MS)
          }, SILENCE_LOCK_MS)

          // SUBTITLE STABILITY: similarity guard — skip render if text barely changed
          if (!isSimilarEnough(newInterim, lastInterimRef.current)) {
            lastInterimRef.current = newInterim
            clearTimeout(interimDebounce.current)
            interimDebounce.current = setTimeout(() => {
              setInterimText(dedupeWords(newInterim))
            }, INTERIM_DEBOUNCE_MS)
          }
        }
      }

      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return

        if (event.error === 'not-allowed') {
          setError('Microphone permission denied. Enable mic access to use captions.')
          shouldRunRef.current = false
          setIsListening(false)
          return
        }

        // SUBTITLE STABILITY: rotate lang on network/service errors
        if (event.error === 'network' || event.error === 'service-not-allowed') {
          langIndexRef.current = (langIndexRef.current + 1) % LANG_PREFERENCE.length
        }

        console.warn('[useSpeechCaptions] error:', event.error)
      }

      recognition.onend = () => {
        setIsListening(false)
        // SUBTITLE STABILITY: clear stale interim on session end
        clearTimeout(interimDebounce.current)
        clearTimeout(silenceLockTimer.current)
        clearTimeout(commitTimer.current)
        setInterimText('')
        lastInterimRef.current = ''

        if (!shouldRunRef.current) return

        // SUBTITLE STABILITY: controlled backoff — resets after 5 consecutive ends
        restartCountRef.current += 1
        if (restartCountRef.current % 5 === 0) {
          // reset count to avoid hitting the cap from silent no-speech cycles
          restartCountRef.current = 0
        }
        const delay = Math.min(200 + restartCountRef.current * 100, 1500)
        restartTimerRef.current = setTimeout(launch, delay)
      }

      try {
        recognition.start()
      } catch (err) {
        console.error('[useSpeechCaptions] start failed:', err)
        // SUBTITLE STABILITY: retry after brief pause on start failure
        restartTimerRef.current = setTimeout(launch, 800)
      }
    }

    launch()
  }, [acquireMic]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync with enabled prop
  useEffect(() => {
    if (enabled) {
      start()
    } else {
      stop()
    }
    return stop
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // PERFORMANCE FIX: toggle without recreating callbacks
  const toggle = useCallback(() => {
    if (shouldRunRef.current) stop()
    else start()
  }, [start, stop])

  return { stableText, finalText, interimText, isListening, isSupported, error, toggle }
}
