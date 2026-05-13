import { useState, useRef, useCallback, useEffect } from 'react'

// FIX: Safe constructor grab — avoids crash in SSR/non-browser
const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

/**
 * useSpeechRecog — Speech-to-Word hook
 * Pure speech recognition → clean text output.
 * No gesture mapping, no animation queue.
 */
export function useSpeechRecog() {
  const recognitionRef = useRef(null)
  // FIX: useRef for isListening so onend closure always sees current value
  const isListeningRef = useRef(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState(null)
  // NEW: Latest finalized chunk for the "latest word" display
  const [lastFinalChunk, setLastFinalChunk] = useState('')
  // NEW: Word count for animation key triggers
  const [wordCount, setWordCount] = useState(0)

  const restartTimerRef = useRef(null)
  const isSupported = Boolean(SpeechRecognition)

  // ── Initialize recognition engine (once) ───────────────────────
  useEffect(() => {
    if (!isSupported) {
      setError('speech_not_supported')
      return
    }

    const recog = new SpeechRecognition()
    recog.continuous = true
    recog.interimResults = true
    recog.lang = 'en-IN'
    recog.maxAlternatives = 1

    // ── onresult ─────────────────────────────────────────────────
    recog.onresult = (event) => {
      let interim = ''
      let finalText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript + ' '
        } else {
          interim += result[0].transcript
        }
      }

      // Show interim results immediately for responsiveness
      if (interim) {
        setInterimTranscript(interim)
      }

      if (finalText.trim()) {
        // FIX: Append final text cleanly (event.resultIndex prevents duplication)
        setTranscript(prev => prev + finalText)
        setInterimTranscript('')
        setLastFinalChunk(finalText.trim())
        setWordCount(prev => prev + finalText.trim().split(/\s+/).length)
      }
    }

    // ── onerror — improved handling ──────────────────────────────
    recog.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('mic_denied')
        isListeningRef.current = false
        setIsListening(false)
      } else if (event.error === 'network') {
        setError('network')
        _scheduleRestart(recog)
      } else if (event.error === 'aborted') {
        _scheduleRestart(recog)
      } else if (event.error !== 'no-speech') {
        setError(event.error)
      }
    }

    // ── onend — FIX: use ref to avoid stale closure ─────────────
    recog.onend = () => {
      if (isListeningRef.current) {
        _scheduleRestart(recog)
      }
    }

    recognitionRef.current = recog

    return () => {
      clearTimeout(restartTimerRef.current)
      try { recog.stop() } catch (e) { /* ignore */ }
    }
  }, [isSupported])

  // ── Safe restart with debounce ─────────────────────────────────
  function _scheduleRestart(recog) {
    clearTimeout(restartTimerRef.current)
    restartTimerRef.current = setTimeout(() => {
      if (isListeningRef.current && recog) {
        try {
          recog.start()
        } catch (e) {
          if (!e.message?.includes('already started')) {
            setTimeout(() => {
              try { recog.start() } catch (_) { /* give up */ }
            }, 500)
          }
        }
      }
    }, 200)
  }

  // ── Start ──────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (!recognitionRef.current || isListeningRef.current) return
    setError(null)
    setInterimTranscript('')
    try {
      recognitionRef.current.start()
      isListeningRef.current = true
      setIsListening(true)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  // ── Stop ───────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (!recognitionRef.current) return
    clearTimeout(restartTimerRef.current)
    isListeningRef.current = false
    setIsListening(false)
    setInterimTranscript('')
    try { recognitionRef.current.stop() } catch (e) { /* ignore */ }
  }, [])

  // ── Clear all state ────────────────────────────────────────────
  const clear = useCallback(() => {
    clearTimeout(restartTimerRef.current)
    if (recognitionRef.current && isListeningRef.current) {
      isListeningRef.current = false
      setIsListening(false)
      try { recognitionRef.current.stop() } catch (e) { /* ignore */ }
    }
    setTranscript('')
    setInterimTranscript('')
    setLastFinalChunk('')
    setWordCount(0)
    setError(null)
  }, [])

  return {
    isListening,
    transcript,
    interimTranscript,
    lastFinalChunk,
    wordCount,
    error,
    isSupported,
    start,
    stop,
    clear,
  }
}
