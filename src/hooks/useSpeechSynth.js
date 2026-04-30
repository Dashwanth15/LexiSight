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

  const [targetLang, setTargetLang] = useState('en-IN')
  const LANG_OPTIONS = [
    { code: 'en-IN', label: 'English (Indian)' },
    { code: 'hi-IN', label: 'Hindi (हिन्दी)' },
    { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
    { code: 'te-IN', label: 'Telugu (తెలుగు)' },
    { code: 'mr-IN', label: 'Marathi (मराठी)' },
    { code: 'bn-IN', label: 'Bengali (বাংলা)' },
  ]

  const speakTranslated = useCallback(async (text, options = {}) => {
    if (!text || !('speechSynthesis' in window)) return
    
    let textToSpeak = text
    let voiceToUse = selectedVoice

    if (targetLang !== 'en-IN') {
      try {
        setSpeaking(true)
        const langPair = `en|${targetLang.split('-')[0]}` // e.g. en|hi
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`)
        const data = await res.json()
        if (data && data.responseData && data.responseData.translatedText) {
          textToSpeak = data.responseData.translatedText
        }
        
        // Find a voice for this language
        voiceToUse = voices.find(v => v.lang === targetLang || v.lang.startsWith(targetLang.split('-')[0])) || selectedVoice
      } catch (err) {
        console.warn('Translation failed, falling back to English', err)
      }
    }

    speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(textToSpeak)
    utt.voice = voiceToUse
    utt.lang = targetLang
    utt.rate = options.rate || 0.95
    utt.pitch = options.pitch || 1.0
    utt.volume = options.volume || 1.0

    utt.onstart = () => setSpeaking(true)
    utt.onend = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)

    utteranceRef.current = utt
    speechSynthesis.speak(utt)
  }, [selectedVoice, targetLang, voices])

  const isSupported = 'speechSynthesis' in window

  return { 
    speak: speakTranslated, 
    stop, 
    speaking, 
    voices, 
    selectedVoice, 
    changeVoice, 
    targetLang,
    setTargetLang,
    LANG_OPTIONS,
    isSupported 
  }
}
