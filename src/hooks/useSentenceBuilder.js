// useSentenceBuilder.js — React hook wrapper for gloss → sentence accumulation
import { useRef, useCallback, useState } from 'react'
import { SentenceBuilder } from '../utils/smoothing.js'

/**
 * @param {{ silenceThreshold?: number }} options
 */
export default function useSentenceBuilder(options = {}) {
  const { silenceThreshold = 1800, onSentenceComplete } = options
  const builderRef = useRef(null)
  if (!builderRef.current) {
    builderRef.current = new SentenceBuilder(silenceThreshold)
  }
  builderRef.current.onSentenceComplete = onSentenceComplete || null

  const [sentence, setSentence] = useState('')
  const [interimWord, setInterimWord] = useState('')

  const addWord = useCallback((word) => {
    if (!word) return builderRef.current.getSentence()
    const next = builderRef.current.addWord(word)
    setSentence(next)
    setInterimWord('')
    return next
  }, [])

  const setPendingWord = useCallback((word) => {
    setInterimWord(word || '')
  }, [])

  const clear = useCallback(() => {
    builderRef.current.clear()
    setSentence('')
    setInterimWord('')
  }, [])

  const getDisplay = useCallback(() => {
    const base = builderRef.current.getSentence()
    if (!interimWord) return base
    return base ? `${base} ${interimWord}` : interimWord
  }, [interimWord])

  const getSentence = useCallback(() => builderRef.current.getSentence(), [])

  return {
    sentence,
    interimWord,
    addWord,
    setPendingWord,
    clear,
    getDisplay,
    getSentence,
    wordCount: builderRef.current.wordCount,
  }
}
