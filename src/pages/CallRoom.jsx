import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import useWebRTC from '../hooks/useWebRTC.js'
import useSpeakerDetect from '../hooks/useSpeakerDetect.js'
import CallVideo from '../components/call/CallVideo.jsx'
import CallControls from '../components/call/CallControls.jsx'
import SignCaptionOverlay from '../components/call/SignCaptionOverlay.jsx'
import SignModeStatus from '../components/call/SignModeStatus.jsx'
import SignIsolationMode from '../components/call/SignIsolationMode.jsx'
import { useSharedClassifier } from '../contexts/ClassifierContext.jsx'
import useSpeechCaptions from '../hooks/useSpeechCaptions.js'
import useSignCaptions from '../hooks/useSignCaptions.js'
import useSignCaptionSync from '../hooks/useSignCaptionSync.js'
import useSpeechCaptionSync from '../hooks/useSpeechCaptionSync.js'
import { useSpeechSynth } from '../hooks/useSpeechSynth.js'

function checkBrowserSupport() {
  if (!navigator.mediaDevices?.getUserMedia) return 'Your browser does not support camera/microphone access.'
  if (!window.RTCPeerConnection) return 'Your browser does not support WebRTC peer connections.'
  return null
}

function ConnectionBadge({ state }) {
  const c = {
    idle: { color: '#6b8ba4', label: 'IDLE', icon: '○' },
    connecting: { color: '#ffaa00', label: 'CONNECTING', icon: '◌' },
    connected: { color: '#00ff88', label: 'CONNECTED', icon: '●' },
    failed: { color: '#ff3366', label: 'FAILED', icon: '✕' },
    closed: { color: '#6b8ba4', label: 'DISCONNECTED', icon: '○' },
  }[state] || { color: '#6b8ba4', label: 'IDLE', icon: '○' }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', background: `${c.color}18`,
      border: `1px solid ${c.color}33`, borderRadius: 20,
    }}>
      <span style={{ color: c.color, fontSize: 10,
        animation: state === 'connecting' ? 'spin-slow 2s linear infinite' : 'none',
      }}>{c.icon}</span>
      <span className="hud-label" style={{ color: c.color, fontSize: '0.55rem' }}>{c.label}</span>
    </div>
  )
}

// SETUP PANEL — Device selector row
function DeviceSelect({ icon, label, devices, active }) {
  const name = devices[0]?.label?.replace(/\s*\(.*?\)\s*/g, '').trim() || 'Default'
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{icon}</span>
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.68rem', color: 'rgba(255,255,255,0.38)', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, padding: '10px 14px', gap: 10 }}>
        <span style={{ flex: 1, fontFamily: 'DM Sans, sans-serif', fontSize: '0.84rem', color: '#c8dff0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#00ff88' : 'rgba(255,255,255,0.15)', boxShadow: active ? '0 0 7px #00ff88' : 'none', flexShrink: 0, transition: 'all 0.3s' }} />
        <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.65rem', flexShrink: 0 }}>▾</span>
      </div>
    </div>
  )
}

// ─── Main CallRoom ──────────────────────────────────────────
export default function CallRoom() {
  const { roomCode: urlRoomCode } = useParams()
  const navigate = useNavigate()
  const { user, isSignedIn, isLoaded } = useUser()

  const [currentRoomCode, setCurrentRoomCode] = useState(urlRoomCode || '')
  const [joinInput, setJoinInput] = useState('')
  const [isInRoom, setIsInRoom] = useState(false)
  const [error, setError] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [copied, setCopied] = useState(false)
  // CONTROL BAR: CC toggle state
  const [ccEnabled, setCCEnabled] = useState(true)
  const [signModeEnabled, setSignModeEnabled] = useState(false)
  const [signToSpeech, setSignToSpeech] = useState(false)
  // SETUP PANEL: enumerated media devices
  const [devices, setDevices] = useState({ cameras: [], mics: [], speakers: [] })

  // FIX: prevent double auto-join when effect re-fires during Clerk/Convex hydration
  const autoJoinedRef = useRef(false)
  // Shared <video> for sign ML (same element as CallVideo — no duplicate decode)
  const [localVideoEl, setLocalVideoEl] = useState(null)
  const onLocalVideoRef = useCallback((el) => setLocalVideoEl(el), [])

  const browserError = checkBrowserSupport()

  const createRoomMutation = useMutation(api.rooms.createRoom)
  const joinRoomMutation = useMutation(api.rooms.joinRoom)
  const leaveRoomMutation = useMutation(api.rooms.leaveRoom)

  const room = useQuery(api.rooms.getRoom, currentRoomCode ? { roomCode: currentRoomCode } : 'skip')

  const {
    localStream, remoteStream, connectionState, mediaError,
    startCall, endCall, startLocalStream,
    toggleAudio, toggleVideo, isAudioEnabled, isVideoEnabled,
  } = useWebRTC(currentRoomCode, user?.id || '', room?._id || null)

  const synth = useSpeechSynth()
  const sharedClassifier = useSharedClassifier()
  const { remoteSignCaption, publishCaption, clearCaptions } = useSignCaptionSync({
    roomId: room?._id,
    userId: user?.id || '',
    enabled: isInRoom && signModeEnabled,
    subscribe: isInRoom,
  })

  // SPEECH CAPTION SYNC: bidirectional subtitle transmission
  const { remoteSpeechCaption, publishSpeechCaption, clearSpeechCaptions } = useSpeechCaptionSync({
    roomId: room?._id,
    userId: user?.id || '',
    enabled: isInRoom && ccEnabled,
    subscribe: isInRoom,
  })

  // Speaker detection
  const localSpeaking = useSpeakerDetect(localStream, 12)
  const remoteSpeaking = useSpeakerDetect(remoteStream, 10)

  // Auto-join from URL — guarded by ref to prevent double-call during hydration
  useEffect(() => {
    if (urlRoomCode && isSignedIn && user && !isInRoom && !autoJoinedRef.current) {
      autoJoinedRef.current = true
      handleJoinRoom(urlRoomCode)
    }
  }, [urlRoomCode, isSignedIn, user]) // eslint-disable-line

  // Auto-start call when 2 participants are present
  // Owner starts immediately; joiner waits 1.5s for the offer, then initiates if none came
  useEffect(() => {
    if (room?.participants?.length === 2 && isInRoom && connectionState === 'idle' && user) {
      const isOwner = room.ownerId === user.id
      if (isOwner) {
        console.log('[CallRoom] Auto-starting call as owner')
        startCall()
      } else {
        // Joiner: wait a moment for owner's offer, then start if nothing happened
        const timer = setTimeout(() => {
          if (connectionState === 'idle') {
            console.log('[CallRoom] Joiner initiating call (owner offer not received)')
            startCall()
          }
        }, 2000)
        return () => clearTimeout(timer)
      }
    }
  }, [room?.participants?.length, isInRoom, connectionState, user]) // eslint-disable-line

  // Start camera preview when entering room (only if waiting alone)
  useEffect(() => {
    if (isInRoom && !localStream && room?.participants?.length === 1) {
      startLocalStream()
    }
  }, [isInRoom, room?.participants?.length]) // eslint-disable-line

  // SETUP PANEL: enumerate media devices once mic/camera is live
  useEffect(() => {
    if (!isInRoom) return
    navigator.mediaDevices?.enumerateDevices().then(list => {
      setDevices({
        cameras:  list.filter(d => d.kind === 'videoinput'),
        mics:     list.filter(d => d.kind === 'audioinput'),
        speakers: list.filter(d => d.kind === 'audiooutput'),
      })
    }).catch(() => {})
  }, [isInRoom, localStream])

  const handleCreateRoom = useCallback(async () => {
    if (!user) return
    setIsCreating(true); setError(null)
    try {
      const result = await createRoomMutation({
        userId: user.id,
        userName: user.fullName || user.primaryEmailAddress?.emailAddress || 'User',
      })
      // FIX: guard against undefined roomCode before navigating
      const roomCode = result?.roomCode
      if (!roomCode) throw new Error('Server did not return a room code')
      setCurrentRoomCode(roomCode); setIsInRoom(true)
      navigate(`/room/${roomCode}`, { replace: true })
    } catch (err) { setError(err.message || 'Failed to create room') }
    finally { setIsCreating(false) }
  }, [user, createRoomMutation, navigate])

  const handleJoinRoom = useCallback(async (code) => {
    const roomCode = (code || joinInput).trim().toLowerCase()
    if (!roomCode || !user) return
    setIsJoining(true); setError(null)
    try {
      const result = await joinRoomMutation({
        roomCode, userId: user.id,
        userName: user.fullName || user.primaryEmailAddress?.emailAddress || 'User',
      })
      const returnedCode = result?.roomCode || roomCode
      setCurrentRoomCode(returnedCode); setIsInRoom(true)
      // FIX: only navigate if we're not already on the target route
      if (!urlRoomCode || urlRoomCode !== returnedCode) {
        navigate(`/room/${returnedCode}`, { replace: true })
      }
    } catch (err) { setError(err.message || 'Failed to join room') }
    finally { setIsJoining(false) }
  }, [user, joinInput, joinRoomMutation, navigate, urlRoomCode])

  const handleLeaveRoom = useCallback(async () => {
    await endCall()
    if (room?._id) {
      await clearCaptions()
      await clearSpeechCaptions()
    }
    if (currentRoomCode && user) {
      try { await leaveRoomMutation({ roomCode: currentRoomCode, userId: user.id }) }
      catch (err) { console.error('Failed to leave room:', err) }
    }
    setIsInRoom(false); setCurrentRoomCode(''); setError(null)
    navigate('/room', { replace: true })
  }, [currentRoomCode, user, endCall, leaveRoomMutation, navigate, room?._id, clearCaptions, clearSpeechCaptions])

  const copyRoomLink = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${currentRoomCode}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }, [currentRoomCode])

  // CONTROL BAR: CC toggle handler
  const handleToggleCC = useCallback(() => {
    setCCEnabled((v) => !v)
  }, [])

  const handleToggleSignMode = useCallback(() => {
    setSignModeEnabled((v) => {
      const next = !v
      if (!next) {
        if (room?._id) publishCaption({ stable: '', interim: '' })
        sharedClassifier.setMode('word')
        sharedClassifier.stopContinuous?.()
        sharedClassifier.resetBuffer?.()
      }
      return next
    })
  }, [room?._id, publishCaption, sharedClassifier])

  const handleIsolationModeChange = useCallback(
    (mode) => {
      sharedClassifier.setMode(mode)
    },
    [sharedClassifier]
  )

  const handleSignCaptionUpdate = useCallback(
    (payload) => {
      if (isInRoom) publishCaption(payload)
    },
    [isInRoom, publishCaption]
  )

  const handleSignSpeak = useCallback(
    (text) => {
      if (signToSpeech && text) synth.speak(text, { rate: 0.92 })
    },
    [signToSpeech, synth]
  )

  // SUBTITLES: uses system mic via Web Speech API (does not open a second getUserMedia stream)
  const {
    stableText,
    interimText,
    error: ccError,
    isListening: ccListening,
    debugEnabled,
    debugLogs,
    silenceMs,
    restartCount,
    speechRate,
  } = useSpeechCaptions(isInRoom && ccEnabled)

  // PERFORMANCE FIX: memoize subtitleDisplay — only recomputes on text change
  const subtitleDisplay = useMemo(() => {
    const interim = interimText && !stableText.endsWith(interimText.trim()) ? ' ' + interimText : ''
    return (stableText + interim).trim()
  }, [stableText, interimText])

  // SPEECH CAPTION SYNC: publish local captions to remote peer
  useEffect(() => {
    if (!isInRoom || !ccEnabled) return
    publishSpeechCaption({ stable: stableText, interim: interimText })
  }, [stableText, interimText, isInRoom, ccEnabled, publishSpeechCaption])

  // SPEECH CAPTION SYNC: compute remote speech display text
  const remoteSpeechDisplay = useMemo(() => {
    const rs = remoteSpeechCaption || { stable: '', interim: '' }
    const interim = rs.interim && !rs.stable.endsWith(rs.interim.trim()) ? ' ' + rs.interim : ''
    return (rs.stable + interim).trim()
  }, [remoteSpeechCaption])

  // SIGN CAPTIONS: local MediaPipe + TF.js — frames never leave the browser
  const signCaptions = useSignCaptions({
    enabled: isInRoom && signModeEnabled && isVideoEnabled && !!localStream,
    localStream,
    localVideoEl,
    onCaptionUpdate: handleSignCaptionUpdate,
    onSpeak: handleSignSpeak,
    signToSpeech,
    connectionState,
    lowPower: ccEnabled,
  })

  const remoteSignDisplay = (
    remoteSignCaption.stable +
    (remoteSignCaption.interim && !remoteSignCaption.stable.endsWith(remoteSignCaption.interim.trim())
      ? ' ' + remoteSignCaption.interim
      : '')
  ).trim()

  const compactStripText = signModeEnabled
    ? signCaptions.error
      ? `Sign error: ${signCaptions.error}`
      : signCaptions.isLoading
        ? 'Loading sign models…'
        : signCaptions.displayText
          || (signCaptions.lastDetected ? `Detecting: ${signCaptions.lastDetected}` : '')
          || (signCaptions.handDetected ? 'Processing gesture…' : 'Show hands to camera…')
    : ccEnabled
      ? ccError || subtitleDisplay || (ccListening ? 'Listening for speech…' : 'Starting captions…')
      : 'Captions off — toggle CC to enable'

  // ─── Loading ──────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div style={{ minHeight: '100vh', background: '#020408', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="w-10 h-10 rounded-full border-2" style={{
          borderColor: 'transparent', borderTopColor: '#00d4ff', borderRightColor: '#8b5cf6',
          animation: 'spin-slow 1s linear infinite',
        }} />
      </div>
    )
  }

  // ─── Auth gate ────────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <div style={{ minHeight: '100vh', background: '#020408', paddingTop: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-card" style={{ padding: 40, textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.4rem', marginBottom: 8, color: '#e8f4fd' }}>Sign in Required</h2>
          <p style={{ color: '#6b8ba4', fontSize: '0.9rem', lineHeight: 1.6 }}>You need to sign in to create or join a call room.</p>
        </div>
      </div>
    )
  }

  if (browserError) {
    return (
      <div style={{ minHeight: '100vh', background: '#020408', paddingTop: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-card" style={{ padding: 40, textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.4rem', marginBottom: 8, color: '#e8f4fd' }}>Browser Not Supported</h2>
          <p style={{ color: '#6b8ba4', fontSize: '0.9rem', lineHeight: 1.6 }}>{browserError}</p>
        </div>
      </div>
    )
  }

  // ─── Pre-call lobby ───────────────────────────────────────
  if (!isInRoom) {
    return (
      <div style={{ minHeight: '100vh', background: '#020408', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 16px 40px' }}>
        <div style={{ maxWidth: 480, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%', margin: '0 auto 16px',
              background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(139,92,246,0.1))',
              border: '1px solid rgba(0,212,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px rgba(0,212,255,0.15)',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="1.5">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.8rem', fontWeight: 700, color: '#e8f4fd', marginBottom: 8 }}>
              Video Call
            </h1>
            <p style={{ color: '#6b8ba4', fontSize: '0.9rem' }}>Create a room or join an existing one</p>
          </div>

          <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
            <h3 className="panel-title" style={{ marginBottom: 16 }}>Create Room</h3>
            <p style={{ color: '#6b8ba4', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>
              Start a new 1-to-1 call room. Share the code with someone to connect.
            </p>
            <button className="btn-primary" onClick={handleCreateRoom} disabled={isCreating}
              style={{ width: '100%', justifyContent: 'center', minHeight: 44 }}>
              {isCreating ? 'Creating...' : '📞 Create Room'}
            </button>
          </div>

          <div className="glass-card" style={{ padding: 24 }}>
            <h3 className="panel-title" style={{ marginBottom: 16 }}>Join Room</h3>
            <p style={{ color: '#6b8ba4', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>
              Enter a room code to join an existing call.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" value={joinInput} onChange={(e) => setJoinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                placeholder="Enter room code..."
                style={{
                  flex: 1, padding: '10px 14px', background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(26,37,53,0.8)', borderRadius: 8, color: '#e8f4fd',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem',
                  letterSpacing: '0.1em', outline: 'none',
                }}
                maxLength={6}
              />
              <button className="btn-primary" onClick={() => handleJoinRoom()}
                disabled={!joinInput.trim() || isJoining} style={{ minHeight: 44, whiteSpace: 'nowrap' }}>
                {isJoining ? '...' : 'Join'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 16, padding: '12px 16px',
              background: 'rgba(255,51,102,0.1)', border: '1px solid rgba(255,51,102,0.3)',
              borderRadius: 8, color: '#ff3366', fontSize: '0.85rem', fontFamily: 'DM Sans, sans-serif',
            }}>⚠ {error}</div>
          )}
        </div>
      </div>
    )
  }

  // ─── In-call view ─────────────────────────────────────────
  const peerName = room?.participants?.find((p) => p.userId !== user?.id)?.userName
  const isWaiting = !room?.participants || room.participants.length < 2
  const hasRemote = !!remoteStream && !isWaiting

  return (
    <div style={{ height: '100vh', background: '#080c14', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingTop: 64 }}>

      {/* VIDEO UI ── Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 24px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>Room</span>
          <code style={{ padding: '3px 10px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.18)', borderRadius: 6, color: '#00d4ff', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', letterSpacing: '0.15em' }}>{currentRoomCode}</code>
          <button onClick={copyRoomLink} style={{ padding: '3px 10px', background: copied ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${copied ? 'rgba(0,255,136,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 6, color: copied ? '#00ff88' : 'rgba(255,255,255,0.4)', fontSize: '0.68rem', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s', letterSpacing: '0.03em' }}>
            {copied ? '✓ Copied' : '⎘ Copy'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* LIVE indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: 'rgba(0,255,136,0.07)', border: '1px solid rgba(0,255,136,0.18)', borderRadius: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 7px #00ff88', display: 'inline-block', animation: 'pulse-glow-dot 1.5s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', fontWeight: 700, color: '#00ff88', letterSpacing: '0.1em' }}>LIVE</span>
          </div>
          {/* Signal bars */}
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', padding: '3px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20 }}>
            {[4,6,8,10,12].map((h, i) => (
              <div key={i} style={{ width: 3, height: h, background: connectionState === 'connected' ? `rgba(0,212,255,${0.4 + i * 0.12})` : 'rgba(255,255,255,0.15)', borderRadius: 1.5, transition: 'background 0.4s' }} />
            ))}
          </div>
          {/* Encrypted */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: 20 }}>
            <span style={{ fontSize: 9 }}>🔒</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.52rem', color: 'rgba(167,139,250,0.85)', letterSpacing: '0.08em' }}>ENCRYPTED</span>
          </div>
        </div>
      </div>

      {(mediaError || ccError || (signModeEnabled && signCaptions.error)) && (
        <div style={{ margin: '4px 24px', padding: '9px 14px', background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.2)', borderRadius: 8, color: '#ffaa00', fontSize: '0.8rem', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>
          ⚠ {mediaError || ccError || signCaptions.error}
        </div>
      )}

      {/* VIDEO UI ── Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 20px 14px', minHeight: 0, overflow: 'hidden' }}>

        {/* ── VIDEO AREA ── */}
        {hasRemote ? (
          /* ═══ DUAL VIDEO LAYOUT — both users side by side ═══ */
          <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>

            {/* ── REMOTE VIDEO (left) ── */}
            <div style={{
              flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden',
              background: 'linear-gradient(145deg, #0d1522 0%, #080c14 100%)',
              border: `1px solid ${remoteSpeaking ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
              boxShadow: remoteSpeaking ? '0 0 0 2px rgba(0,212,255,0.25), 0 12px 48px rgba(0,0,0,0.7)' : '0 12px 48px rgba(0,0,0,0.6)',
              transition: 'border-color 0.35s, box-shadow 0.4s', minHeight: 0,
            }}>
              <CallVideo stream={remoteStream} muted={false} label={peerName || 'Peer'} isLocal={false} isSpeaking={remoteSpeaking} showCaptions={false} />

              {/* Remote user's speech subtitles — on THEIR video */}
              {ccEnabled && remoteSpeechDisplay && (
                <div style={{
                  position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 20, maxWidth: '88%', width: 'max-content',
                  padding: '8px 18px',
                  background: 'rgba(0,212,255,0.08)', backdropFilter: 'blur(14px)',
                  borderRadius: 10, border: '1px solid rgba(0,212,255,0.15)',
                  textAlign: 'center', animation: 'fade-in 0.25s ease-out',
                }}>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: '#a0d8ef', lineHeight: 1.55, letterSpacing: '0.01em' }}>
                    {remoteSpeechDisplay}
                  </span>
                </div>
              )}

              {/* SIGN — remote peer's translated signs */}
              {remoteSignDisplay && (
                <SignCaptionOverlay
                  stableText={remoteSignCaption.stable}
                  interimText={remoteSignCaption.interim}
                  label="Peer sign translation"
                />
              )}

              {/* Name badge — bottom left */}
              <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 10 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', background: 'rgba(4,8,14,0.65)', backdropFilter: 'blur(12px)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                  {remoteSpeaking && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4ff', boxShadow: '0 0 7px #00d4ff', animation: 'pulse-glow-dot 1s ease-in-out infinite' }} />}
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: '#e8f4fd', fontWeight: 500 }}>{peerName || 'Peer'}</span>
                </div>
              </div>
            </div>

            {/* ── LOCAL VIDEO (right) ── */}
            <div style={{
              flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden',
              background: 'linear-gradient(145deg, #0d1522 0%, #080c14 100%)',
              border: `1px solid ${localSpeaking ? 'rgba(0,255,136,0.4)' : 'rgba(255,255,255,0.06)'}`,
              boxShadow: localSpeaking ? '0 0 0 2px rgba(0,255,136,0.25), 0 12px 48px rgba(0,0,0,0.7)' : '0 12px 48px rgba(0,0,0,0.6)',
              transition: 'border-color 0.35s, box-shadow 0.4s', minHeight: 0,
            }}>
              {signModeEnabled && (
                <SignModeStatus
                  isActive={signCaptions.isActive}
                  isLoading={signCaptions.isLoading}
                  handDetected={signCaptions.handDetected}
                  confidence={signCaptions.confidence}
                  bufferProgress={signCaptions.bufferProgress}
                  isolationMode={signCaptions.isolationMode}
                />
              )}

              <CallVideo
                ref={onLocalVideoRef}
                stream={localStream}
                muted={true}
                label={user?.fullName || 'You'}
                isLocal={true}
                isSpeaking={localSpeaking}
                isVideoOff={!isVideoEnabled}
                isAudioOff={!isAudioEnabled}
                showCaptions={false}
              />

              {/* Your speech subtitles — on YOUR video */}
              {ccEnabled && subtitleDisplay && (
                <div style={{
                  position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 20, maxWidth: '88%', width: 'max-content',
                  padding: '8px 18px',
                  background: 'rgba(4,8,14,0.78)', backdropFilter: 'blur(14px)',
                  borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)',
                  textAlign: 'center', animation: 'fade-in 0.25s ease-out',
                }}>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: '#e8f4fd', lineHeight: 1.55, letterSpacing: '0.01em' }}>
                    {subtitleDisplay}
                  </span>
                </div>
              )}

              {/* SIGN — local sign captions */}
              {signModeEnabled && (signCaptions.displayText || signCaptions.lastDetected) && (
                <div style={{ position: 'absolute', bottom: ccEnabled && subtitleDisplay ? 100 : 56, left: 0, right: 0, zIndex: 23 }}>
                  <SignCaptionOverlay
                    stableText={signCaptions.stableText}
                    interimText={signCaptions.interimText || signCaptions.lastDetected}
                    label="Your sign translation"
                  />
                </div>
              )}

              {/* Name badge — bottom left */}
              <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 10 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', background: 'rgba(4,8,14,0.65)', backdropFilter: 'blur(12px)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                  {localSpeaking && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 7px #00ff88', animation: 'pulse-glow-dot 1s ease-in-out infinite' }} />}
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: '#e8f4fd', fontWeight: 500 }}>You</span>
                </div>
              </div>

              {/* DEBUG MODE PANEL */}
              {debugEnabled && (
                <div style={{
                  position: 'absolute', top: 14, right: 14, zIndex: 30,
                  width: 280, maxWidth: '90%',
                  background: 'rgba(4, 8, 16, 0.94)', backdropFilter: 'blur(16px)',
                  borderRadius: 12, border: '1px solid rgba(0, 212, 255, 0.25)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 10px rgba(0, 212, 255, 0.1)',
                  padding: 14, color: '#e8f4fd', display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.7rem', fontWeight: 700, color: '#00d4ff', letterSpacing: '0.05em' }}>CC DEBUG</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', opacity: 0.5 }}>Active</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ opacity: 0.5 }}>Listening:</span>
                      <span style={{ color: ccListening ? '#00ff88' : '#ffaa00' }}>{ccListening ? 'ON' : 'OFF'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ opacity: 0.5 }}>Silence:</span>
                      <span style={{ color: silenceMs > 1500 ? '#ff3366' : '#00ff88' }}>{silenceMs}ms</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ opacity: 0.5 }}>WPS:</span>
                      <span style={{ color: speechRate > 3 ? '#00d4ff' : speechRate >= 1 ? '#00ff88' : '#ffaa00' }}>{speechRate}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ═══ SINGLE VIDEO PREVIEW — waiting for peer ═══ */
          <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
            <div style={{
              flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden',
              background: 'linear-gradient(145deg, #0d1522 0%, #080c14 100%)',
              border: `1px solid ${localSpeaking ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.06)'}`,
              boxShadow: '0 12px 48px rgba(0,0,0,0.6)', minHeight: 0,
            }}>
              {signModeEnabled && (
                <SignModeStatus
                  isActive={signCaptions.isActive}
                  isLoading={signCaptions.isLoading}
                  handDetected={signCaptions.handDetected}
                  confidence={signCaptions.confidence}
                  bufferProgress={signCaptions.bufferProgress}
                  isolationMode={signCaptions.isolationMode}
                />
              )}

              {/* PREVIEW badge */}
              <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 10, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: localStream ? '#00ff88' : '#ffaa00', boxShadow: localStream ? '0 0 6px #00ff88' : '0 0 6px #ffaa00', display: 'inline-block' }} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.1em' }}>PREVIEW</span>
              </div>

              <CallVideo
                ref={onLocalVideoRef}
                stream={localStream}
                muted={true}
                label={user?.fullName || 'You'}
                isLocal={true}
                isSpeaking={localSpeaking}
                isVideoOff={!isVideoEnabled}
                isAudioOff={!isAudioEnabled}
                showCaptions={false}
              />

              {/* Local subtitles in preview */}
              {ccEnabled && subtitleDisplay && (
                <div style={{
                  position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 20, maxWidth: '82%', width: 'max-content',
                  padding: '8px 18px',
                  background: 'rgba(4,8,14,0.78)', backdropFilter: 'blur(14px)',
                  borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)',
                  textAlign: 'center', animation: 'fade-in 0.25s ease-out',
                }}>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.9rem', color: '#e8f4fd', lineHeight: 1.55 }}>
                    {subtitleDisplay}
                  </span>
                </div>
              )}

              {/* SIGN — local preview */}
              {signModeEnabled && (signCaptions.displayText || signCaptions.lastDetected) && (
                <div style={{ position: 'absolute', bottom: ccEnabled && subtitleDisplay ? 100 : 56, left: 0, right: 0, zIndex: 23 }}>
                  <SignCaptionOverlay
                    stableText={signCaptions.stableText}
                    interimText={signCaptions.interimText || signCaptions.lastDetected}
                    label="Your sign translation"
                  />
                </div>
              )}

              {/* Name + waiting status */}
              <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 10 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', background: 'rgba(4,8,14,0.65)', backdropFilter: 'blur(12px)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                  {localSpeaking && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 7px #00ff88', animation: 'pulse-glow-dot 1s ease-in-out infinite' }} />}
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: '#e8f4fd', fontWeight: 500 }}>You</span>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)' }}>· Waiting for peer</span>
                </div>
              </div>

              {/* Signal bars */}
              <div style={{ position: 'absolute', bottom: 14, right: 14, zIndex: 10, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                {[4,6,9,12,15].map((h, i) => (
                  <div key={i} style={{ width: 3, height: h, background: connectionState === 'connected' ? `rgba(0,212,255,${0.3 + i * 0.14})` : 'rgba(255,255,255,0.14)', borderRadius: 1.5, transition: 'background 0.4s' }} />
                ))}
              </div>
            </div>

            {/* SETUP PANEL ── Right column: shown while waiting */}
            <div style={{ width: 310, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, background: 'rgba(8,13,22,0.92)', backdropFilter: 'blur(20px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', padding: '26px 22px', display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
                <div>
                  <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#e8f4fd', margin: 0, marginBottom: 6 }}>Ready to join?</h2>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.5, margin: 0 }}>Check your setup before entering the meeting.</p>
                </div>
                <DeviceSelect icon="📷" label="Select Camera" devices={devices.cameras} active={!!localStream && isVideoEnabled} />
                <DeviceSelect icon="🎙" label="Select Microphone" devices={devices.mics} active={!!localStream && isAudioEnabled} />
                <DeviceSelect icon="🔊" label="Select Audio Output" devices={devices.speakers} active={true} />
                <div style={{ flex: 1 }} />
                <button
                  onClick={startCall}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 36px rgba(0,100,255,0.65)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,100,255,0.4)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #0055ee, #0099ff)', border: 'none', borderRadius: 10, color: '#fff', fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 24px rgba(0,100,255,0.4)', transition: 'box-shadow 0.25s, transform 0.2s' }}
                >
                  Join Meeting <span style={{ fontSize: '1.1rem' }}>→</span>
                </button>
                {room?.participants?.length > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      {room.participants.map(p => p.userName).join(' · ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sign isolation mode — shown below video when sign mode is on */}
        {signModeEnabled && (
          <SignIsolationMode
            mode={sharedClassifier.mode}
            onModeChange={handleIsolationModeChange}
            disabled={signCaptions.isLoading}
          />
        )}

        {/* CONTROLS ── Floating dock */}
        <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <CallControls
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
            isCCEnabled={ccEnabled}
            isSignModeEnabled={signModeEnabled}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onToggleCC={handleToggleCC}
            onToggleSignMode={handleToggleSignMode}
            onLeave={handleLeaveRoom}
          />
        </div>
      </div>

    </div>
  )
}


