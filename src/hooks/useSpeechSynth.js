import { useState, useEffect, useCallback, useRef } from 'react'

export function useSpeechSynth() {
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(null)
  const [speaking, setSpeaking] = useState(false)
  const utteranceRef = useRef(null)

  useEffect(() => {
    const loadVoices = () => {
      const allVoices = speechSynthesis.getVoices()
      setVoices(allVoices)

      // Prefer en-IN voices
      const indianVoice = allVoices.find(v => v.lang === 'en-IN') ||
                          allVoices.find(v => v.lang.startsWith('en-')) ||
                          allVoices[0]

      const saved = localStorage.getItem('lexisight-voice')
      if (saved) {
        const savedVoice = allVoices.find(v => v.name === saved)
        setSelectedVoice(savedVoice || indianVoice)
      } else {
        setSelectedVoice(indianVoice)
      }
    }

    loadVoices()
    speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  const speak = useCallback((text, options = {}) => {
    if (!text || !('speechSynthesis' in window)) return
    speechSynthesis.cancel()

    const utt = new SpeechSynthesisUtterance(text)
    utt.voice = selectedVoice
    utt.lang = selectedVoice?.lang || 'en-IN'
    utt.rate = options.rate || 0.95
    utt.pitch = options.pitch || 1.0
    utt.volume = options.volume || 1.0

    utt.onstart = () => setSpeaking(true)
    utt.onend = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)

    utteranceRef.current = utt
    speechSynthesis.speak(utt)
  }, [selectedVoice])

  const stop = useCallback(() => {
    speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const changeVoice = useCallback((voiceName) => {
    const voice = voices.find(v => v.name === voiceName)
    setSelectedVoice(voice)
    localStorage.setItem('lexisight-voice', voiceName)
  }, [voices])

  const isSupported = 'speechSynthesis' in window

  return { speak, stop, speaking, voices, selectedVoice, changeVoice, isSupported }
}
