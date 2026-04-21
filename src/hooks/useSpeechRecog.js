import { useState, useEffect, useRef, useCallback } from 'react'
import { wordToGesture } from '../utils/gestureMap.js'

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

export function useSpeechRecog() {
  const recognitionRef = useRef(null)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [currentGesture, setCurrentGesture] = useState(null)
  const [error, setError] = useState(null)
  const [wordQueue, setWordQueue] = useState([])

  const isSupported = Boolean(SpeechRecognition)

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

    recog.onresult = (event) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript + ' '
        } else {
          interim += result[0].transcript
        }
      }

      if (final) {
        setTranscript(prev => prev + final)
        setInterimTranscript('')

        // Map words to gestures
        const words = final.trim().toLowerCase().split(/\s+/)
        const queue = []
        for (const word of words) {
          const gesture = wordToGesture[word]
          if (gesture) queue.push(gesture)
          else if (word.length === 1) queue.push(word.toUpperCase())
        }
        if (queue.length > 0) {
          setWordQueue(queue)
          setCurrentGesture(queue[0])
        }
      } else {
        setInterimTranscript(interim)
      }
    }

    recog.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setError('mic_denied')
      } else if (event.error !== 'no-speech') {
        setError(event.error)
      }
      setIsListening(false)
    }

    recog.onend = () => {
      // Auto-restart if we want to keep listening
      if (isListening) {
        try { recog.start() } catch (e) {}
      }
    }

    recognitionRef.current = recog
  }, [isSupported])

  const start = useCallback(() => {
    if (!recognitionRef.current || isListening) return
    setError(null)
    setInterimTranscript('')
    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch (e) {
      setError(e.message)
    }
  }, [isListening])

  const stop = useCallback(() => {
    if (!recognitionRef.current) return
    recognitionRef.current.stop()
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  const clear = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    setCurrentGesture(null)
    setWordQueue([])
  }, [])

  // Advance word queue
  const nextWord = useCallback(() => {
    setWordQueue(prev => {
      const next = prev.slice(1)
      setCurrentGesture(next[0] || null)
      return next
    })
  }, [])

  return {
    isListening,
    transcript,
    interimTranscript,
    currentGesture,
    wordQueue,
    error,
    isSupported,
    start,
    stop,
    clear,
    nextWord,
  }
}
