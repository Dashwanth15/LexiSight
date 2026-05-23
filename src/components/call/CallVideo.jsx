// CAMERA FIX + INTEGRATION POINT — CallVideo.jsx
import { useEffect, useRef } from 'react'
import SubtitleOverlay from './SubtitleOverlay.jsx' // NEW CODE

export default function CallVideo({
  stream,
  muted = false,
  isLocal = false,
  label,
  isSpeaking = false,
  isVideoOff = false,
  isAudioOff = false,
  showCaptions = false, // NEW CODE
}) {
  const videoRef = useRef(null)

  // CAMERA FIX: robustly attach / detach srcObject on stream changes
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (stream) {
      // CAMERA FIX: only reassign if stream actually changed (prevents flicker)
      if (video.srcObject !== stream) {
        video.srcObject = stream
      }
      // CAMERA FIX: always attempt play; ignore AbortError from rapid toggling
      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn('[CallVideo] play() failed:', err.name, err.message)
          }
        })
      }
    } else {
      // CAMERA FIX: clear srcObject when stream is removed to free resources
      video.srcObject = null
    }

    return () => {
      // CAMERA FIX: cleanup on unmount — don't stop tracks here, just detach
      if (video) video.srcObject = null
    }
  }, [stream])

  const borderStyle = isSpeaking
    ? '2px solid rgba(0,255,136,0.7)'
    : '1px solid rgba(26,37,53,0.8)'

  const shadowStyle = isSpeaking
    ? '0 0 0 2px rgba(0,255,136,0.4), 0 0 24px rgba(0,255,136,0.2)'
    : 'none'

  // CAMERA FIX: show video element whenever stream exists, regardless of isVideoOff
  // (track.enabled=false blanks the feed — no need to unmount the element)
  const hasVideoStream = stream && stream.getVideoTracks().length > 0

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: '#0a0f18', borderRadius: 14, overflow: 'hidden',
      border: borderStyle, boxShadow: shadowStyle,
      transition: 'border 0.3s, box-shadow 0.3s',
    }}>
      {/* CAMERA FIX: video is always mounted when stream exists; display toggled via CSS */}
      {stream && (
        <video
          ref={videoRef}
          className="call-video"
          autoPlay
          playsInline
          muted={muted}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: isLocal ? 'scaleX(-1)' : 'none',
            display: isVideoOff ? 'none' : 'block', // CAMERA FIX: hide via CSS not unmount
          }}
        />
      )}

      {/* Placeholder shown when no stream OR video is off */}
      {(!stream || !hasVideoStream || isVideoOff) && (
        <div style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10,
          background: 'linear-gradient(135deg, #0a0f18 0%, #111927 100%)',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(139,92,246,0.12))',
            border: '1px solid rgba(0,212,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32,
          }}>
            {isLocal ? '👤' : '📷'}
          </div>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', color: '#4a5e73' }}>
            {isLocal ? (stream ? 'Camera off' : 'Starting camera...') : 'Waiting for peer...'}
          </span>
        </div>
      )}

      {/* SUBTITLE STABILITY: overlay enabled tied only to stream presence, not camera state.
           Audio/mic is independent of video — subtitles should work even when camera is off. */}
      {isLocal && showCaptions && (
        <SubtitleOverlay
          enabled={!!stream}
          showError={true}
        />
      )}

      {/* Name label */}
      {label && (
        <div style={{
          position: 'absolute', bottom: 10, left: 10,
          padding: '5px 12px', background: 'rgba(2,4,8,0.8)',
          backdropFilter: 'blur(8px)', borderRadius: 8,
          border: '1px solid rgba(26,37,53,0.6)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {isSpeaking && (
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#00ff88', boxShadow: '0 0 6px #00ff88',
              animation: 'pulse-glow-dot 1s ease-in-out infinite',
            }} />
          )}
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.72rem', color: '#e8f4fd', fontWeight: 500 }}>
            {label}
          </span>
        </div>
      )}

      {/* Muted indicator */}
      {isAudioOff && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          padding: '4px 8px', background: 'rgba(255,51,102,0.2)',
          borderRadius: 6, border: '1px solid rgba(255,51,102,0.3)',
        }}>
          <span style={{ fontSize: '0.6rem', color: '#ff3366', fontFamily: 'JetBrains Mono, monospace' }}>
            🔇 MUTED
          </span>
        </div>
      )}
    </div>
  )
}
