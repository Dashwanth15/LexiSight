// Speaker detection hook — uses Web Audio API to detect when audio is active
import { useState, useEffect, useRef } from 'react'

export default function useSpeakerDetect(stream, threshold = 15) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!stream) { setIsSpeaking(false); return }

    const audioTracks = stream.getAudioTracks()
    if (!audioTracks.length || !audioTracks[0].enabled) { setIsSpeaking(false); return }

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.5
      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      ctxRef.current = ctx
      analyserRef.current = analyser
      const dataArr = new Uint8Array(analyser.frequencyBinCount)

      let speakCount = 0
      const check = () => {
        analyser.getByteFrequencyData(dataArr)
        const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length
        if (avg > threshold) {
          speakCount = Math.min(speakCount + 1, 5)
        } else {
          speakCount = Math.max(speakCount - 1, 0)
        }
        setIsSpeaking(speakCount >= 2)
        rafRef.current = requestAnimationFrame(check)
      }
      rafRef.current = requestAnimationFrame(check)
    } catch (e) {
      console.warn('[useSpeakerDetect] AudioContext error:', e)
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (ctxRef.current) ctxRef.current.close().catch(() => {})
    }
  }, [stream, threshold])

  return isSpeaking
}
