// NEW CODE — useAvatarController.js
// ─────────────────────────────────────────────────────────────────────────────
// Bridge between ML prediction output and the 3D avatar animation system.
// Does NOT import or modify any classifier / MediaPipe code.
// Input : prediction object { label, confidence } from useClassifier
// Output: { avatarGesture, isActive, playback, setPlayback, speed, setSpeed }
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'

// Normalize ML label strings to the AVATAR_POSES key format
// e.g. "THANK YOU" → "thankyou", "A" → "letter-a", "1" → "digit-1"
function normalizeToAvatarKey(label) {
  if (!label) return 'idle'
  const l = label.trim().toLowerCase()

  // Single letter A–Z → fingerspelling key
  if (/^[a-z]$/.test(l)) return `letter-${l}`

  // Single digit 0–9 → digit key
  if (/^\d$/.test(l)) return `digit-${l}`

  // Multi-word → collapse spaces, keep lowercase
  return l.replace(/\s+/g, '')
}

export function useAvatarController(prediction) {
  const [avatarGesture, setAvatarGesture] = useState('idle')
  const [isActive, setIsActive]           = useState(false)
  const [playback, setPlayback]           = useState('playing') // 'playing' | 'paused'
  const [speed, setSpeed]                 = useState(1)         // 1 = normal, 0.5 = slow-mo
  const [repeat, setRepeat]               = useState(false)

  // Track last label to avoid unnecessary re-triggers
  const lastLabelRef = useRef(null)

  // Idle timer — reset to idle after 3s of no prediction
  const idleTimerRef = useRef(null)

  useEffect(() => {
    if (!prediction?.label) {
      // Start idle countdown
      idleTimerRef.current = setTimeout(() => {
        setAvatarGesture('idle')
        setIsActive(false)
      }, 3000)
      return () => clearTimeout(idleTimerRef.current)
    }

    clearTimeout(idleTimerRef.current)
    const key = normalizeToAvatarKey(prediction.label)

    if (key !== lastLabelRef.current) {
      lastLabelRef.current = key
      if (playback !== 'paused') {
        setAvatarGesture(key)
        setIsActive(true)
      }
    }
  }, [prediction, playback])

  const togglePlayback = useCallback(() => {
    setPlayback(p => p === 'playing' ? 'paused' : 'playing')
  }, [])

  const toggleSloMo = useCallback(() => {
    setSpeed(s => s === 1 ? 0.5 : 1)
  }, [])

  const toggleRepeat = useCallback(() => {
    setRepeat(r => !r)
  }, [])

  const resetToIdle = useCallback(() => {
    setAvatarGesture('idle')
    setIsActive(false)
    lastLabelRef.current = null
  }, [])

  return {
    avatarGesture,   // string key → used by AvatarScene
    isActive,        // boolean  → drives glow effect
    playback,        // 'playing' | 'paused'
    speed,           // 1 | 0.5
    repeat,          // boolean
    togglePlayback,
    toggleSloMo,
    toggleRepeat,
    resetToIdle,
    setAvatarGesture, // allow direct override (e.g. Learn mode forces a specific sign)
  }
}
