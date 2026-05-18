// NEW CODE — Call Room page for 1-to-1 WebRTC video/audio calls
// Isolated from existing AI pipelines — does NOT import any classifier/mediapipe hooks
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import useWebRTC from '../hooks/useWebRTC.js'

// ─── Browser support check ─────────────────────────────────
function checkBrowserSupport() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return 'Your browser does not support camera/microphone access.'
  }
  if (!window.RTCPeerConnection) {
    return 'Your browser does not support WebRTC peer connections.'
  }
  return null
}

// ─── Video component with auto-play ─────────────────────────
function VideoView({ stream, muted = false, label, isLocal = false }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '4/3',
      background: '#0a0f18',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid rgba(26, 37, 53, 0.8)',
    }}>
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: isLocal ? 'scaleX(-1)' : 'none',
            pointerEvents: 'auto',
          }}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(0, 212, 255, 0.08)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}>
            📷
          </div>
          <span className="hud-label" style={{ color: '#4a5e73' }}>
            {isLocal ? 'Camera off' : 'Waiting for peer...'}
          </span>
        </div>
      )}
      {label && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          padding: '4px 10px',
          background: 'rgba(2, 4, 8, 0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: 6,
          border: '1px solid rgba(26, 37, 53, 0.6)',
        }}>
          <span className="hud-label" style={{ fontSize: '0.6rem', color: '#00d4ff' }}>
            {label}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Connection status badge ────────────────────────────────
function ConnectionBadge({ state }) {
  const config = {
    idle: { color: '#6b8ba4', bg: 'rgba(107,139,164,0.1)', label: 'IDLE', icon: '○' },
    connecting: { color: '#ffaa00', bg: 'rgba(255,170,0,0.1)', label: 'CONNECTING', icon: '◌' },
    connected: { color: '#00ff88', bg: 'rgba(0,255,136,0.1)', label: 'CONNECTED', icon: '●' },
    failed: { color: '#ff3366', bg: 'rgba(255,51,102,0.1)', label: 'FAILED', icon: '✕' },
    closed: { color: '#6b8ba4', bg: 'rgba(107,139,164,0.1)', label: 'DISCONNECTED', icon: '○' },
  }

  const { color, bg, label, icon } = config[state] || config.idle

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 12px',
      background: bg,
      border: `1px solid ${color}33`,
      borderRadius: 20,
    }}>
      <span style={{
        color,
        fontSize: 10,
        animation: state === 'connecting' ? 'spin-slow 2s linear infinite' : 'none',
      }}>
        {icon}
      </span>
      <span className="hud-label" style={{ color, fontSize: '0.55rem' }}>
        {label}
      </span>
    </div>
  )
}

// ─── Main CallRoom page ─────────────────────────────────────
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

  const browserError = checkBrowserSupport()

  // Convex mutations
  const createRoomMutation = useMutation(api.rooms.createRoom)
  const joinRoomMutation = useMutation(api.rooms.joinRoom)
  const leaveRoomMutation = useMutation(api.rooms.leaveRoom)

  // INTEGRATION POINT — Reactive room query
  const room = useQuery(
    api.rooms.getRoom,
    currentRoomCode ? { roomCode: currentRoomCode } : 'skip'
  )

  // WebRTC hook
  const {
    localStream,
    remoteStream,
    connectionState,
    mediaError,
    startCall,
    endCall,
    toggleAudio,
    toggleVideo,
    isAudioEnabled,
    isVideoEnabled,
  } = useWebRTC(
    currentRoomCode,
    user?.id || '',
    room?._id || null
  )

  // ─── Auto-join from URL ───────────────────────────────────
  useEffect(() => {
    if (urlRoomCode && isSignedIn && user && !isInRoom) {
      handleJoinRoom(urlRoomCode)
    }
  }, [urlRoomCode, isSignedIn, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auto-start call when second participant joins ─────────
  useEffect(() => {
    if (
      room &&
      room.participants.length === 2 &&
      isInRoom &&
      connectionState === 'idle' &&
      user
    ) {
      // The room owner initiates the call
      const isOwner = room.ownerId === user.id
      if (isOwner) {
        startCall()
      }
    }
  }, [room?.participants?.length, isInRoom, connectionState, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Create room handler ──────────────────────────────────
  const handleCreateRoom = useCallback(async () => {
    if (!user) return
    setIsCreating(true)
    setError(null)

    try {
      const { roomCode } = await createRoomMutation({
        userId: user.id,
        userName: user.fullName || user.primaryEmailAddress?.emailAddress || 'User',
      })

      setCurrentRoomCode(roomCode)
      setIsInRoom(true)
      navigate(`/room/${roomCode}`, { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to create room')
    } finally {
      setIsCreating(false)
    }
  }, [user, createRoomMutation, navigate])

  // ─── Join room handler ────────────────────────────────────
  const handleJoinRoom = useCallback(async (code) => {
    const roomCode = (code || joinInput).trim().toLowerCase()
    if (!roomCode || !user) return

    setIsJoining(true)
    setError(null)

    try {
      await joinRoomMutation({
        roomCode,
        userId: user.id,
        userName: user.fullName || user.primaryEmailAddress?.emailAddress || 'User',
      })

      setCurrentRoomCode(roomCode)
      setIsInRoom(true)
      if (!urlRoomCode) {
        navigate(`/room/${roomCode}`, { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Failed to join room')
    } finally {
      setIsJoining(false)
    }
  }, [user, joinInput, joinRoomMutation, navigate, urlRoomCode])

  // ─── Leave room handler ───────────────────────────────────
  const handleLeaveRoom = useCallback(async () => {
    await endCall()

    if (currentRoomCode && user) {
      try {
        await leaveRoomMutation({
          roomCode: currentRoomCode,
          userId: user.id,
        })
      } catch (err) {
        console.error('Failed to leave room:', err)
      }
    }

    setIsInRoom(false)
    setCurrentRoomCode('')
    setError(null)
    navigate('/room', { replace: true })
  }, [currentRoomCode, user, endCall, leaveRoomMutation, navigate])

  // ─── Copy room link ───────────────────────────────────────
  const copyRoomLink = useCallback(() => {
    const link = `${window.location.origin}/room/${currentRoomCode}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [currentRoomCode])

  // ─── Loading state ────────────────────────────────────────
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

  // ─── Not signed in ────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <div style={{
        minHeight: '100vh', background: '#020408', paddingTop: 80,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="glass-card" style={{ padding: 40, textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.4rem', marginBottom: 8, color: '#e8f4fd' }}>
            Sign in Required
          </h2>
          <p style={{ color: '#6b8ba4', fontSize: '0.9rem', lineHeight: 1.6 }}>
            You need to sign in to create or join a call room.
          </p>
        </div>
      </div>
    )
  }

  // ─── Browser not supported ────────────────────────────────
  if (browserError) {
    return (
      <div style={{
        minHeight: '100vh', background: '#020408', paddingTop: 80,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="glass-card" style={{ padding: 40, textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.4rem', marginBottom: 8, color: '#e8f4fd' }}>
            Browser Not Supported
          </h2>
          <p style={{ color: '#6b8ba4', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {browserError}
          </p>
        </div>
      </div>
    )
  }

  // ─── Pre-call lobby ───────────────────────────────────────
  if (!isInRoom) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#020408',
        paddingTop: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 16px 40px',
      }}>
        <div style={{ maxWidth: 480, width: '100%' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 30px rgba(0, 212, 255, 0.15)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="1.5">
                <path d="M15.05 5A5 5 0 0119 8.95M15.05 1A9 9 0 0123 8.94M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
              </svg>
            </div>
            <h1 style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '1.8rem',
              fontWeight: 700,
              color: '#e8f4fd',
              marginBottom: 8,
            }}>
              Video Call
            </h1>
            <p style={{ color: '#6b8ba4', fontSize: '0.9rem' }}>
              Create a room or join an existing one
            </p>
          </div>

          {/* Create Room */}
          <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
            <h3 className="panel-title" style={{ marginBottom: 16 }}>Create Room</h3>
            <p style={{ color: '#6b8ba4', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>
              Start a new 1-to-1 call room. Share the code with someone to connect.
            </p>
            <button
              className="btn-primary"
              onClick={handleCreateRoom}
              disabled={isCreating}
              style={{ width: '100%', justifyContent: 'center', minHeight: 44 }}
            >
              {isCreating ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2" style={{
                    borderColor: 'transparent', borderTopColor: '#00d4ff',
                    animation: 'spin-slow 1s linear infinite', display: 'inline-block',
                  }} />
                  Creating...
                </>
              ) : (
                <>📞 Create Room</>
              )}
            </button>
          </div>

          {/* Join Room */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 className="panel-title" style={{ marginBottom: 16 }}>Join Room</h3>
            <p style={{ color: '#6b8ba4', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>
              Enter a room code to join an existing call.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                placeholder="Enter room code..."
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(26, 37, 53, 0.8)',
                  borderRadius: 8,
                  color: '#e8f4fd',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.9rem',
                  letterSpacing: '0.1em',
                  outline: 'none',
                }}
                maxLength={6}
              />
              <button
                className="btn-primary"
                onClick={() => handleJoinRoom()}
                disabled={!joinInput.trim() || isJoining}
                style={{ minHeight: 44, whiteSpace: 'nowrap' }}
              >
                {isJoining ? '...' : 'Join'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 16,
              padding: '12px 16px',
              background: 'rgba(255, 51, 102, 0.1)',
              border: '1px solid rgba(255, 51, 102, 0.3)',
              borderRadius: 8,
              color: '#ff3366',
              fontSize: '0.85rem',
              fontFamily: 'DM Sans, sans-serif',
            }}>
              ⚠ {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── In-call view ─────────────────────────────────────────
  const peerName = room?.participants?.find((p) => p.userId !== user?.id)?.userName
  const isWaiting = room?.participants?.length === 1

  return (
    <div style={{
      minHeight: '100vh',
      background: '#020408',
      paddingTop: 72,
      padding: '72px 16px 24px',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Top bar: room info + status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#e8f4fd',
            }}>
              Room
            </h2>
            <code style={{
              padding: '4px 12px',
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: 6,
              color: '#00d4ff',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.9rem',
              letterSpacing: '0.15em',
            }}>
              {currentRoomCode}
            </code>
            <button
              onClick={copyRoomLink}
              title="Copy room link"
              style={{
                padding: '4px 10px',
                background: copied ? 'rgba(0, 255, 136, 0.1)' : 'rgba(0, 212, 255, 0.05)',
                border: `1px solid ${copied ? 'rgba(0, 255, 136, 0.3)' : 'rgba(26, 37, 53, 0.8)'}`,
                borderRadius: 6,
                color: copied ? '#00ff88' : '#6b8ba4',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
                transition: 'all 0.2s ease',
              }}
            >
              {copied ? '✓ Copied' : '📋 Copy Link'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ConnectionBadge state={connectionState} />
          </div>
        </div>

        {/* Media error */}
        {mediaError && (
          <div style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: 'rgba(255, 170, 0, 0.1)',
            border: '1px solid rgba(255, 170, 0, 0.3)',
            borderRadius: 8,
            color: '#ffaa00',
            fontSize: '0.85rem',
          }}>
            ⚠ {mediaError}
          </div>
        )}

        {/* Waiting notice */}
        {isWaiting && (
          <div style={{
            marginBottom: 16,
            padding: '16px 20px',
            background: 'rgba(0, 212, 255, 0.05)',
            border: '1px solid rgba(0, 212, 255, 0.15)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{
              display: 'inline-block',
              width: 10, height: 10, borderRadius: '50%',
              border: '2px solid #00d4ff',
              borderTopColor: 'transparent',
              animation: 'spin-slow 1s linear infinite',
            }} />
            <div>
              <span style={{ color: '#e8f4fd', fontSize: '0.9rem', fontWeight: 500 }}>
                Waiting for someone to join...
              </span>
              <span style={{ color: '#6b8ba4', fontSize: '0.8rem', display: 'block', marginTop: 2 }}>
                Share the room code <strong style={{ color: '#00d4ff' }}>{currentRoomCode}</strong> with your partner
              </span>
            </div>
          </div>
        )}

        {/* Video grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: remoteStream && !isWaiting ? '1fr 1fr' : '1fr',
          gap: 16,
          marginBottom: 24,
        }}>
          {/* Local video */}
          <VideoView
            stream={localStream}
            muted={true}
            label={`You${user?.fullName ? ` · ${user.fullName}` : ''}`}
            isLocal={true}
          />

          {/* Remote video */}
          {(!isWaiting || remoteStream) && (
            <VideoView
              stream={remoteStream}
              muted={false}
              label={peerName || 'Peer'}
              isLocal={false}
            />
          )}
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          {/* Toggle video */}
          <button
            onClick={toggleVideo}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: isVideoEnabled ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255, 51, 102, 0.15)',
              border: `1px solid ${isVideoEnabled ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255, 51, 102, 0.3)'}`,
              color: isVideoEnabled ? '#00d4ff' : '#ff3366',
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            {isVideoEnabled ? '📹' : '🚫'}
          </button>

          {/* Toggle audio */}
          <button
            onClick={toggleAudio}
            title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: isAudioEnabled ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255, 51, 102, 0.15)',
              border: `1px solid ${isAudioEnabled ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255, 51, 102, 0.3)'}`,
              color: isAudioEnabled ? '#00d4ff' : '#ff3366',
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            {isAudioEnabled ? '🎤' : '🔇'}
          </button>

          {/* Leave call */}
          <button
            onClick={handleLeaveRoom}
            className="btn-danger"
            style={{
              padding: '10px 24px',
              minHeight: 48,
              borderRadius: 24,
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            ✕ Leave Call
          </button>
        </div>

        {/* Participants */}
        {room && room.participants.length > 0 && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <span className="hud-label" style={{ fontSize: '0.55rem' }}>
              Participants: {room.participants.map((p) => p.userName).join(' · ')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
