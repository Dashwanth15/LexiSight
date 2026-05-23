// useSpeechCaptions.js — Production subtitle engine v5
// FAST SPEECH FIX | SMART BUFFERING | RESPONSIVENESS FIX | WATCHDOG SYSTEM | PERFORMANCE FIX
import { useState, useEffect, useRef, useCallback } from 'react'

// RECOGNITION FIX: resolve API once at module level
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

// RECOGNITION FIX: preferred languages for Indian-accent recognition
const LANG_PREFERENCE = ['en-IN', 'en-US']

// STABILITY FIX: lowered — Chrome often returns 0.0 confidence on valid speech
const CONFIDENCE_THRESHOLD = 0.08

// FAST SPEECH FIX: reduced from 120ms → 60ms for snappier interim display
// At 60ms the browser still batches renders but words appear almost instantly
const INTERIM_DEBOUNCE_MS = 60

// SMART BUFFERING: reduced from 220ms → 150ms so finals appear faster
const COMMIT_DELAY_MS = 150

// STABILITY FIX: how long finalized text stays visible after speech ends
const FINAL_PERSIST_MS = 5000

// STABILITY FIX: max chars in rolling final buffer
const FINAL_BUFFER_MAX = 280

// WATCHDOG SYSTEM: if no onresult fires within this window while shouldRun is true,
// force-restart recognition. Catches Chrome silently dying without firing onend.
const WATCHDOG_INTERVAL_MS = 3000
const WATCHDOG_STALE_THRESHOLD_MS = 6000

// ─── ADAPTIVE SILENCE CONFIG ───────────────────────────────────────────────────
// SMART BUFFERING: adaptive silence detection based on measured speech rate
// Instead of a fixed lock, we track words-per-second and adjust dynamically:
//   fast speech  (>3 wps)  → 800ms  lock  (speaker is rapid, commit quickly)
//   normal speech (1-3 wps) → 1400ms lock  (natural pace)
//   slow speech  (<1 wps)   → 2200ms lock  (speaker is deliberate, wait longer)
const SILENCE_LOCK_FAST   = 800
const SILENCE_LOCK_NORMAL = 1400
const SILENCE_LOCK_SLOW   = 2200

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function dedupeWords(text) {
  return text
    .trim()
    .replace(/\b(\w+)(\s+\1){1,}/gi, '$1')
    .replace(/\s{2,}/g, ' ')
}

function cleanTranscript(text) {
  if (!text) return ''
  let t = text.trim()
  t = t.replace(/\b(um|uh|hmm|ah|err|uhh|mmm|hm)\b/gi, '')
  t = t.replace(/\b[a-zA-Z]-+\b/g, '')
  t = t.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// ─── PUNCTUATION ENGINE ─────────────────────────────────────────────────────

// PUNCTUATION ENGINE: spoken word → symbol map
const SPOKEN_PUNCTUATION = [
  [/\bfull stop\b/gi,        '.'],
  [/\bperiod\b/gi,           '.'],
  [/\bdot\b/gi,              '.'],
  [/\bcomma\b/gi,            ','],
  [/\bquestion mark\b/gi,    '?'],
  [/\bexclamation mark\b/gi, '!'],
  [/\bexclamation point\b/gi,'!'],
  [/\bcolon\b/gi,            ':'],
  [/\bsemicolon\b/gi,        ';'],
  [/\bsemi colon\b/gi,       ';'],
  [/\bhyphen\b/gi,           '-'],
  [/\bdash\b/gi,             '—'],
  [/\bslash\b/gi,            '/'],
  [/\bopen bracket\b/gi,     '('],
  [/\bclose bracket\b/gi,    ')'],
  [/\bopen parenthesis\b/gi, '('],
  [/\bclose parenthesis\b/gi,')'],
  [/\bnew line\b/gi,         '\n'],
]

// PUNCTUATION ENGINE: convert spoken punctuation words into actual symbols
function applySpokenPunctuation(text) {
  if (!text) return text
  let t = text
  for (const [pattern, symbol] of SPOKEN_PUNCTUATION) {
    t = t.replace(pattern, symbol)
  }
  return t
}

// TRANSCRIPT CLEANUP: fix spacing around punctuation marks
// "hello , world" → "hello, world"   |   "hello ." → "hello."
function cleanPunctuationSpacing(text) {
  if (!text) return text
  let t = text
  // Remove space before punctuation
  t = t.replace(/\s+([.,!?;:\)\]])/g, '$1')
  // Ensure space after punctuation (except before another punctuation or end)
  t = t.replace(/([.,!?;:])([A-Za-z])/g, '$1 $2')
  // Remove space after opening brackets
  t = t.replace(/([\(\[])\s+/g, '$1')
  // Collapse duplicate punctuation: ".." → "."  "!!" → "!"
  t = t.replace(/([.!?,;:]){2,}/g, '$1')
  // Fix multiple spaces
  t = t.replace(/\s{2,}/g, ' ')
  return t.trim()
}

// SMART FORMATTING: capitalize first letter of each sentence
function capitalizeAfterPunctuation(text) {
  if (!text) return text
  // Capitalize first char
  let t = text.charAt(0).toUpperCase() + text.slice(1)
  // Capitalize after sentence-ending punctuation
  t = t.replace(/([.!?])\s+([a-z])/g, (_, p, c) => p + ' ' + c.toUpperCase())
  return t
}

// SMART FORMATTING: interrogative words that signal a question
const QUESTION_STARTERS = /^(what|where|when|who|why|how|is|are|do|does|did|can|could|would|should|will|shall|have|has|had|isn't|aren't|don't|doesn't|didn't|won't|wouldn't|couldn't|shouldn't)\b/i

// SMART FORMATTING: add terminal punctuation to finalized sentences
// Only applied to stable/final text (never to interim — it's still in progress)
function smartPunctuate(text) {
  if (!text) return text
  let t = text.trim()
  // Skip if already has terminal punctuation
  if (/[.!?,;:\)]$/.test(t)) return t
  // Check if sentence looks like a question
  // Split on sentence boundaries and check the last sentence
  const sentences = t.split(/(?<=[.!?])\s+/)
  const last = sentences[sentences.length - 1].trim()
  if (QUESTION_STARTERS.test(last)) {
    return t + '?'
  }
  // Default: add period
  return t + '.'
}

// PUNCTUATION ENGINE: full formatting pipeline for FINAL/STABLE text
// Applies spoken punctuation + cleanup + smart punctuation + capitalization
function formatFinal(text) {
  if (!text) return ''
  let t = applySpokenPunctuation(text)
  t = cleanPunctuationSpacing(t)
  t = smartPunctuate(t)
  t = capitalizeAfterPunctuation(t)
  return t
}

// PUNCTUATION ENGINE: lightweight pipeline for INTERIM text
// Only applies spoken punctuation + spacing — no terminal punctuation (still in progress)
function formatInterim(text) {
  if (!text) return ''
  let t = applySpokenPunctuation(text)
  t = cleanPunctuationSpacing(t)
  t = capitalizeAfterPunctuation(t)
  return t
}

function mergeTranscripts(oldText, newText) {
  if (!oldText) return newText
  if (!newText) return oldText
  const oldWords = oldText.trim().split(/\s+/)
  const newWords = newText.trim().split(/\s+/)
  // SMART BUFFERING: scan up to 8 words for overlap (up from 6)
  const maxOverlap = Math.min(oldWords.length, newWords.length, 8)
  for (let len = maxOverlap; len > 0; len--) {
    if (oldWords.slice(-len).join(' ').toLowerCase() === newWords.slice(0, len).join(' ').toLowerCase()) {
      return [...oldWords, ...newWords.slice(len)].join(' ')
    }
  }
  return (oldText.trim() + ' ' + newText.trim()).trim()
}

// PERFORMANCE FIX: trim to FINAL_BUFFER_MAX at a word boundary
function trimBuffer(text) {
  if (text.length <= FINAL_BUFFER_MAX) return text
  const sliced = text.slice(-FINAL_BUFFER_MAX)
  const firstSpace = sliced.indexOf(' ')
  return firstSpace > 0 ? sliced.slice(firstSpace + 1) : sliced
}

// PERFORMANCE FIX: skip state update only for cosmetically identical final text
// NOT used for interim anymore — interim always updates (see FAST SPEECH FIX below)
function isSimilarEnough(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  if (b.startsWith(a) || a.startsWith(b)) return false
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  let matches = 0
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) matches++
  }
  return (matches / longer.length) > 0.85
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export default function useSpeechCaptions(enabled = true) {
  const [stableText,  setStableText]  = useState('')
  const [finalText,   setFinalText]   = useState('')
  const [interimText, setInterimText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [error,       setError]       = useState(null)

  // DEBUG MODE — toggled with Ctrl+Shift+D
  const [debugEnabled, setDebugEnabled] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('lxi_subtitle_debug') === 'true'
  )
  const [debugLogs,    setDebugLogs]    = useState([])
  const [silenceMs,    setSilenceMs]    = useState(0)
  const [restartCount, setRestartCount] = useState(0)
  // WATCHDOG SYSTEM: expose speech rate to debug panel
  const [speechRate,   setSpeechRate]   = useState(0)

  // ─── Refs ─────────────────────────────────────────────────────────────────
  const recognitionRef    = useRef(null)
  const shouldRunRef      = useRef(false)
  const mountedRef        = useRef(true)
  const sessionIdRef      = useRef(0)
  const restartCountRef   = useRef(0)
  const langIndexRef      = useRef(0)
  const restartTimerRef   = useRef(null)
  const clearFinalTimer   = useRef(null)
  const interimDebounce   = useRef(null)
  const commitTimer       = useRef(null)
  const silenceLockTimer  = useRef(null)
  const watchdogTimer     = useRef(null)
  const lastFinalRef      = useRef('')
  const lastInterimRef    = useRef('')
  const pendingFinalRef   = useRef('')
  const lastSpeechTimeRef = useRef(Date.now())

  // SMART BUFFERING: speech rate tracking
  // We maintain a rolling window of result timestamps to compute words-per-second
  const resultTimestampsRef = useRef([])  // [{time, wordCount}]
  const speechRateRef       = useRef(0)   // current wps (words per second)

  const MAX_RESTARTS = 100
  const isSupported  = !!SpeechRecognitionAPI

  // ─── Mount guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // ─── Safe state wrappers ──────────────────────────────────────────────────
  const safeSet   = useCallback((s, v)  => { if (mountedRef.current) s(v) },   [])
  const safeSetFn = useCallback((s, fn) => { if (mountedRef.current) s(fn) },  [])

  // ─── SMART BUFFERING: adaptive silence lock ───────────────────────────────
  // Returns the current silence-lock duration based on measured speech rate
  const getSilenceLockMs = useCallback(() => {
    const rate = speechRateRef.current
    if (rate > 3)  return SILENCE_LOCK_FAST     // fast talker → commit quickly
    if (rate >= 1) return SILENCE_LOCK_NORMAL   // normal pace
    return SILENCE_LOCK_SLOW                     // slow/deliberate → wait longer
  }, [])

  // SMART BUFFERING: record a speech event and update rolling wps
  const recordSpeechEvent = useCallback((wordCount) => {
    const now = Date.now()
    resultTimestampsRef.current.push({ time: now, wordCount })
    // Keep only last 5 seconds of data
    const cutoff = now - 5000
    resultTimestampsRef.current = resultTimestampsRef.current.filter(e => e.time > cutoff)
    // Calculate words per second over the window
    const entries = resultTimestampsRef.current
    if (entries.length < 2) {
      speechRateRef.current = wordCount > 0 ? 1.5 : 0 // assume normal if only 1 sample
      return
    }
    const totalWords = entries.reduce((sum, e) => sum + e.wordCount, 0)
    const windowMs = entries[entries.length - 1].time - entries[0].time
    speechRateRef.current = windowMs > 0 ? (totalWords / (windowMs / 1000)) : 0
  }, [])

  // ─── Debug helpers ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        setDebugEnabled(prev => {
          const next = !prev
          localStorage.setItem('lxi_subtitle_debug', String(next))
          return next
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!debugEnabled) return
    const id = setInterval(() => {
      if (!mountedRef.current) return
      setSilenceMs(Math.max(0, Date.now() - lastSpeechTimeRef.current))
      setSpeechRate(Math.round(speechRateRef.current * 10) / 10)
    }, 100)
    return () => clearInterval(id)
  }, [debugEnabled])

  const addDebugLog = useCallback((type, text, confidence = null) => {
    if (!mountedRef.current) return
    setDebugLogs(prev => {
      const entry = { id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toLocaleTimeString(), type, text, confidence }
      return [entry, ...prev].slice(0, 12)
    })
  }, [])

  // ─── Stop ─────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    shouldRunRef.current = false
    sessionIdRef.current += 1

    clearTimeout(restartTimerRef.current)
    clearTimeout(clearFinalTimer.current)
    clearTimeout(interimDebounce.current)
    clearTimeout(commitTimer.current)
    clearTimeout(silenceLockTimer.current)
    clearInterval(watchdogTimer.current)

    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }

    safeSet(setIsListening, false)
    safeSet(setInterimText, '')
    lastInterimRef.current = ''
    resultTimestampsRef.current = []
    speechRateRef.current = 0
  }, [safeSet])

  // ─── Start ────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      safeSet(setError, 'Speech recognition not supported. Use Chrome or Edge.')
      return
    }

    // Abort any existing session
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }

    shouldRunRef.current    = true
    restartCountRef.current = 0
    lastFinalRef.current    = ''
    lastInterimRef.current  = ''
    pendingFinalRef.current = ''
    resultTimestampsRef.current = []
    speechRateRef.current = 0

    safeSet(setError,       null)
    safeSet(setStableText,  '')
    safeSet(setFinalText,   '')
    safeSet(setInterimText, '')
    safeSet(setRestartCount, 0)

    // ── launch ──────────────────────────────────────────────────────────────
    const launch = () => {
      if (!shouldRunRef.current || !mountedRef.current) return
      if (restartCountRef.current >= MAX_RESTARTS) {
        safeSet(setError, 'Captions paused — too many restarts. Refresh to retry.')
        safeSet(setIsListening, false)
        return
      }

      sessionIdRef.current += 1
      const mySession = sessionIdRef.current

      recognitionRef.current = null

      const recognition = new SpeechRecognitionAPI()
      recognitionRef.current = recognition

      recognition.continuous      = true
      recognition.interimResults  = true
      recognition.maxAlternatives = 3
      recognition.lang            = LANG_PREFERENCE[langIndexRef.current % LANG_PREFERENCE.length]

      // ── onstart ───────────────────────────────────────────────────────────
      recognition.onstart = () => {
        if (sessionIdRef.current !== mySession) return
        if (!mountedRef.current) return
        safeSet(setIsListening, true)
        safeSet(setError, null)
        lastSpeechTimeRef.current = Date.now()
        addDebugLog('▶ started', `lang: ${recognition.lang}`)

        // WATCHDOG SYSTEM: start watchdog that monitors recognition health
        // If no onresult fires within WATCHDOG_STALE_THRESHOLD_MS while we
        // should be running, force a restart. This catches Chrome silently dying.
        clearInterval(watchdogTimer.current)
        watchdogTimer.current = setInterval(() => {
          if (sessionIdRef.current !== mySession || !mountedRef.current) {
            clearInterval(watchdogTimer.current)
            return
          }
          if (!shouldRunRef.current) {
            clearInterval(watchdogTimer.current)
            return
          }
          const staleMs = Date.now() - lastSpeechTimeRef.current
          if (staleMs > WATCHDOG_STALE_THRESHOLD_MS) {
            addDebugLog('🐕 watchdog', `stale ${Math.round(staleMs / 1000)}s — restarting`)
            // Force-end the recognition; onend will handle the restart
            try { recognition.abort() } catch {}
          }
        }, WATCHDOG_INTERVAL_MS)
      }

      // ── onresult ──────────────────────────────────────────────────────────
      recognition.onresult = (event) => {
        if (sessionIdRef.current !== mySession) return
        if (!shouldRunRef.current || !mountedRef.current) return

        lastSpeechTimeRef.current = Date.now()
        let newFinal   = ''
        let newInterim = ''
        let wordCount  = 0

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]

          if (result.isFinal) {
            let bestAlt = result[0]
            for (let a = 1; a < result.length; a++) {
              if ((result[a].confidence || 0) > (bestAlt.confidence || 0)) bestAlt = result[a]
            }
            if ((bestAlt.confidence || 0) < CONFIDENCE_THRESHOLD) {
              addDebugLog('✗ low-conf', bestAlt.transcript, bestAlt.confidence)
              continue
            }
            const cleaned = formatFinal(cleanTranscript(dedupeWords(bestAlt.transcript)))
            if (!cleaned) continue
            if (cleaned.trim() === lastFinalRef.current.trim()) continue
            newFinal += cleaned + ' '
            wordCount += cleaned.split(/\s+/).length
            addDebugLog('✓ final', cleaned, bestAlt.confidence)
          } else {
            const transcript = result[0]?.transcript || ''
            newInterim += transcript
            wordCount += transcript.split(/\s+/).filter(Boolean).length
          }
        }

        // SMART BUFFERING: record this speech event for wps calculation
        recordSpeechEvent(wordCount)

        // PAUSE HANDLING: cancel pending silence lock on new speech
        clearTimeout(silenceLockTimer.current)

        // ── Commit final result ────────────────────────────────────────────
        if (newFinal) {
          clearTimeout(commitTimer.current)
          clearTimeout(interimDebounce.current)
          pendingFinalRef.current = newFinal

          commitTimer.current = setTimeout(() => {
            if (sessionIdRef.current !== mySession || !mountedRef.current) return
            const toCommit = pendingFinalRef.current
            if (!toCommit) return
            pendingFinalRef.current = ''
            lastFinalRef.current = toCommit.trim()

            safeSetFn(setFinalText, prev => {
              const next = trimBuffer(mergeTranscripts(prev, toCommit))
              return isSimilarEnough(prev, next) ? prev : next
            })
            safeSetFn(setStableText, prev => trimBuffer(mergeTranscripts(prev, toCommit)))

            lastInterimRef.current = ''
            safeSet(setInterimText, '')

            clearTimeout(clearFinalTimer.current)
            clearFinalTimer.current = setTimeout(() => {
              if (!mountedRef.current) return
              safeSet(setFinalText,  '')
              safeSet(setStableText, '')
              lastFinalRef.current = ''
            }, FINAL_PERSIST_MS)
          }, COMMIT_DELAY_MS)
        }

        // ── Handle interim result ──────────────────────────────────────────
        if (newInterim) {
          // SMART BUFFERING: adaptive silence lock — uses measured speech rate
          const lockMs = getSilenceLockMs()
          silenceLockTimer.current = setTimeout(() => {
            if (sessionIdRef.current !== mySession || !mountedRef.current) return
            const currentInterim = lastInterimRef.current
            if (!currentInterim) return
            const locked = formatFinal(cleanTranscript(dedupeWords(currentInterim)))
            if (!locked) return
            addDebugLog('⏸ silence-lock', `${locked} (${lockMs}ms)`)

            safeSetFn(setStableText, prev => trimBuffer(mergeTranscripts(prev, locked)))
            safeSetFn(setFinalText,  prev => trimBuffer(mergeTranscripts(prev, locked)))
            lastFinalRef.current   = locked
            lastInterimRef.current = ''
            safeSet(setInterimText, '')

            clearTimeout(clearFinalTimer.current)
            clearFinalTimer.current = setTimeout(() => {
              if (!mountedRef.current) return
              safeSet(setFinalText,  '')
              safeSet(setStableText, '')
              lastFinalRef.current = ''
            }, FINAL_PERSIST_MS)
          }, lockMs)

          // FAST SPEECH FIX: REMOVED the isSimilarEnough guard on interim updates.
          // During fast speech, each interim adds 1-2 words → ~90% similar to previous.
          // The old guard was skipping these updates, making words visually disappear.
          // Now we ALWAYS update interim text. The debounce alone controls render rate.
          if (newInterim !== lastInterimRef.current) {
            lastInterimRef.current = newInterim
            clearTimeout(interimDebounce.current)
            interimDebounce.current = setTimeout(() => {
              if (sessionIdRef.current !== mySession || !mountedRef.current) return
              safeSet(setInterimText, formatInterim(dedupeWords(newInterim)))
            }, INTERIM_DEBOUNCE_MS)
          }
        }
      }

      // ── onerror ───────────────────────────────────────────────────────────
      recognition.onerror = (event) => {
        if (sessionIdRef.current !== mySession) return
        if (event.error === 'no-speech' || event.error === 'aborted') return

        addDebugLog('⚠ error', event.error)

        if (event.error === 'not-allowed') {
          safeSet(setError, 'Mic permission denied. Enable mic access for captions.')
          shouldRunRef.current = false
          safeSet(setIsListening, false)
          clearInterval(watchdogTimer.current)
          return
        }

        if (event.error === 'network' || event.error === 'service-not-allowed') {
          langIndexRef.current = (langIndexRef.current + 1) % LANG_PREFERENCE.length
          addDebugLog('↻ lang-switch', LANG_PREFERENCE[langIndexRef.current % LANG_PREFERENCE.length])
        }
      }

      // ── onend ─────────────────────────────────────────────────────────────
      recognition.onend = () => {
        if (sessionIdRef.current !== mySession) return
        if (!mountedRef.current) return

        safeSet(setIsListening, false)
        clearInterval(watchdogTimer.current)

        if (!shouldRunRef.current) {
          clearTimeout(interimDebounce.current)
          clearTimeout(silenceLockTimer.current)
          clearTimeout(commitTimer.current)
          safeSet(setInterimText, '')
          lastInterimRef.current = ''
          addDebugLog('■ stopped', 'manual')
          return
        }

        // RESPONSIVENESS FIX: aggressive restart — only 100ms base delay
        // so recognition comes back almost instantly after Chrome auto-ends
        restartCountRef.current += 1
        if (restartCountRef.current % 10 === 0) restartCountRef.current = 1
        safeSet(setRestartCount, restartCountRef.current)

        // FAST SPEECH FIX: reduced restart delay — 100ms base + 80ms per restart, max 1.5s
        // Faster recovery means less time with dead recognition during active speech
        const delay = Math.min(100 + restartCountRef.current * 80, 1500)
        addDebugLog('↻ restart', `#${restartCountRef.current} in ${delay}ms`)

        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(launch, delay)
      }

      // ── start recognition ──────────────────────────────────────────────────
      try {
        recognition.start()
      } catch (err) {
        addDebugLog('✗ start-fail', err.message)
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(launch, 400)
      }
    }

    launch()
  }, [safeSet, safeSetFn, addDebugLog, getSilenceLockMs, recordSpeechEvent]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Sync with enabled prop ───────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => {
      if (enabled) start()
      else stop()
    }, 0)
    return () => {
      clearTimeout(id)
      stop()
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(() => {
    if (shouldRunRef.current) stop()
    else start()
  }, [start, stop])

  return {
    stableText,
    finalText,
    interimText,
    isListening,
    isSupported,
    error,
    toggle,
    // DEBUG MODE
    debugEnabled,
    debugLogs,
    silenceMs,
    restartCount,
    speechRate,
  }
}
