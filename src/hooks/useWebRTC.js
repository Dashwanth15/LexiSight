// WebRTC peer connection hook for 1-to-1 video/audio calls
// Isolated from existing AI pipelines (useClassifier, useMediaPipe, etc.)
import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

// STUN/TURN servers for NAT traversal
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
}

/**
 * useWebRTC — manages the full WebRTC peer connection lifecycle
 *
 * @param {string} roomCode - The room code to connect in
 * @param {string} userId - Current user's Clerk ID
 * @param {string} roomId - Convex room document ID (for signaling)
 * @returns {object} - localStream, remoteStream, connectionState, controls
 */
export default function useWebRTC(roomCode, userId, roomId) {
  // ─── State ────────────────────────────────────────────────
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [connectionState, setConnectionState] = useState('idle')
  const [mediaError, setMediaError] = useState(null)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)

  // ─── Refs ─────────────────────────────────────────────────
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const processedSignalsRef = useRef(new Set())
  const isCleaningUpRef = useRef(false)
  const pendingCandidatesRef = useRef([]) // Buffer ICE candidates before remoteDescription
  const mediaLockRef = useRef(null) // Mutex: prevents concurrent getUserMedia calls

  // Convex mutations
  const sendSignal = useMutation(api.signaling.sendSignal)
  const clearSignals = useMutation(api.signaling.clearSignals)

  // Reactive subscription to incoming signals
  const signals = useQuery(
    api.signaling.getSignals,
    roomId ? { roomId, userId } : 'skip'
  )

  // ─── Acquire local camera + mic (mutex-protected) ─────────
  const startLocalStream = useCallback(async () => {
    // If we already have a live stream, reuse it
    if (localStreamRef.current) {
      const hasLive = localStreamRef.current.getTracks().some(t => t.readyState === 'live')
      if (hasLive) {
        setLocalStream(localStreamRef.current)
        return localStreamRef.current
      }
    }

    // Mutex: if another call is in progress, wait for it
    if (mediaLockRef.current) {
      console.log('[useWebRTC] Waiting for existing media acquisition...')
      return mediaLockRef.current
    }

    const acquire = async () => {
      const attempts = [
        // VIDEO FIX: HD 720p — better quality in the 16:9 container
        {
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        },
        // Attempt 2: basic settings
        { video: true, audio: true },
        // Attempt 3: audio only
        { video: false, audio: true },
      ]

      for (let i = 0; i < attempts.length; i++) {
        try {
          // Small delay on retry to let camera release
          if (i > 0) await new Promise(r => setTimeout(r, 500))

          const stream = await navigator.mediaDevices.getUserMedia(attempts[i])
          localStreamRef.current = stream
          setLocalStream(stream)
          setMediaError(attempts[i].video === false ? 'Camera unavailable — audio only mode' : null)
          setIsAudioEnabled(true)
          setIsVideoEnabled(attempts[i].video !== false)
          console.log('[useWebRTC] Local stream acquired (attempt', i + 1, '):', stream.getTracks().map(t => `${t.kind}:${t.label}`))
          return stream
        } catch (err) {
          console.warn(`[useWebRTC] Media attempt ${i + 1} failed:`, err.name, err.message)
          if (i === attempts.length - 1) {
            // All attempts failed
            if (err.name === 'NotAllowedError') {
              setMediaError('Camera/microphone permission denied. Please allow access and refresh.')
            } else if (err.name === 'NotFoundError') {
              setMediaError('No camera or microphone found.')
            } else if (err.name === 'NotReadableError') {
              setMediaError('Camera is in use by another app/tab. Close other tabs using the camera.')
            } else {
              setMediaError(`Could not access media: ${err.message}`)
            }
            return null
          }
        }
      }
      return null
    }

    // Set the lock and acquire
    mediaLockRef.current = acquire()
    const result = await mediaLockRef.current
    mediaLockRef.current = null
    return result
  }, [])

  // ─── Create peer connection ───────────────────────────────
  const createPeerConnection = useCallback((stream) => {
    // Close existing connection
    if (pcRef.current) {
      try { pcRef.current.close() } catch {}
    }

    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc
    pendingCandidatesRef.current = []

    // Add ALL local tracks to the connection
    if (stream) {
      stream.getTracks().forEach((track) => {
        console.log('[useWebRTC] Adding track to PC:', track.kind, track.label)
        pc.addTrack(track, stream)
      })
    }

    // Handle incoming remote tracks
    const remoteMediaStream = new MediaStream()
    remoteStreamRef.current = remoteMediaStream

    pc.ontrack = (event) => {
      console.log('[useWebRTC] ontrack received:', event.track.kind, event.track.label)
      // Use the first stream from the event, or add track to our stream
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0]
        setRemoteStream(event.streams[0])
      } else {
        remoteMediaStream.addTrack(event.track)
        setRemoteStream(new MediaStream(remoteMediaStream.getTracks()))
      }
    }

    // Send ICE candidates through Convex signaling
    pc.onicecandidate = (event) => {
      if (event.candidate && roomId && !isCleaningUpRef.current) {
        sendSignal({
          roomId,
          fromUserId: userId,
          type: 'ice-candidate',
          data: JSON.stringify(event.candidate.toJSON()),
        }).catch((err) => {
          if (!isCleaningUpRef.current) {
            console.error('[useWebRTC] Failed to send ICE candidate:', err)
          }
        })
      }
    }

    // Track connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      console.log('[useWebRTC] Connection state:', state)
      switch (state) {
        case 'connected':
          setConnectionState('connected')
          break
        case 'failed':
          setConnectionState('failed')
          break
        case 'disconnected':
        case 'closed':
          if (!isCleaningUpRef.current) {
            setConnectionState('closed')
          }
          break
        default:
          break
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log('[useWebRTC] ICE state:', pc.iceConnectionState)
      // If ICE fails, update the connection state
      if (pc.iceConnectionState === 'failed') {
        setConnectionState('failed')
      }
    }

    pc.onnegotiationneeded = async () => {
      // Only the offerer should create offers via negotiationneeded
      // We handle this manually in startCall, so just log
      console.log('[useWebRTC] Negotiation needed (handled manually)')
    }

    return pc
  }, [roomId, userId, sendSignal])

  // ─── Flush buffered ICE candidates ────────────────────────
  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current
    if (!pc || !pc.remoteDescription) return

    const candidates = [...pendingCandidatesRef.current]
    pendingCandidatesRef.current = []

    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(candidate)
        console.log('[useWebRTC] Flushed buffered ICE candidate')
      } catch (err) {
        console.error('[useWebRTC] Error adding buffered ICE candidate:', err)
      }
    }
  }, [])

  // ─── Start call (create offer as room owner) ──────────────
  const startCall = useCallback(async () => {
    if (!roomId || !userId) return

    setConnectionState('connecting')

    // Get local stream
    let stream = localStreamRef.current
    if (!stream || stream.getTracks().every(t => t.readyState === 'ended')) {
      stream = await startLocalStream()
      if (!stream) {
        setConnectionState('failed')
        return
      }
    }

    const pc = createPeerConnection(stream)

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })
      await pc.setLocalDescription(offer)

      await sendSignal({
        roomId,
        fromUserId: userId,
        type: 'offer',
        data: JSON.stringify(pc.localDescription.toJSON()),
      })

      console.log('[useWebRTC] Offer sent successfully')
    } catch (err) {
      console.error('[useWebRTC] Failed to create/send offer:', err)
      setConnectionState('failed')
    }
  }, [roomId, userId, startLocalStream, createPeerConnection, sendSignal])

  // ─── Handle incoming signals ──────────────────────────────
  useEffect(() => {
    if (!signals || signals.length === 0 || !roomId || !userId) return
    if (isCleaningUpRef.current) return

    const handleSignals = async () => {
      for (const signal of signals) {
        // Skip already-processed signals
        if (processedSignalsRef.current.has(signal._id)) continue
        processedSignalsRef.current.add(signal._id)

        try {
          if (signal.type === 'offer') {
            // ── Received an offer — create answer ──
            console.log('[useWebRTC] Processing offer...')
            setConnectionState('connecting')

            // Ensure we have local media
            let stream = localStreamRef.current
            if (!stream || stream.getTracks().every(t => t.readyState === 'ended')) {
              stream = await startLocalStream()
              if (!stream) {
                console.error('[useWebRTC] Cannot answer — no local stream')
                return
              }
            }

            // Create new peer connection for answering
            if (!pcRef.current || pcRef.current.signalingState === 'closed') {
              createPeerConnection(stream)
            }

            const pc = pcRef.current
            const offerDesc = JSON.parse(signal.data)
            await pc.setRemoteDescription(new RTCSessionDescription(offerDesc))

            // Flush any ICE candidates that arrived before the offer
            await flushPendingCandidates()

            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            await sendSignal({
              roomId,
              fromUserId: userId,
              type: 'answer',
              data: JSON.stringify(pc.localDescription.toJSON()),
            })

            console.log('[useWebRTC] Answer sent successfully')

          } else if (signal.type === 'answer') {
            // ── Received an answer ──
            console.log('[useWebRTC] Processing answer...')
            const pc = pcRef.current
            if (pc && pc.signalingState === 'have-local-offer') {
              const answerDesc = JSON.parse(signal.data)
              await pc.setRemoteDescription(new RTCSessionDescription(answerDesc))
              // Flush any buffered ICE candidates
              await flushPendingCandidates()
            } else {
              console.warn('[useWebRTC] Received answer but signaling state is:', pc?.signalingState)
            }

          } else if (signal.type === 'ice-candidate') {
            // ── Received ICE candidate ──
            const pc = pcRef.current
            const candidate = new RTCIceCandidate(JSON.parse(signal.data))

            if (pc && pc.remoteDescription) {
              await pc.addIceCandidate(candidate)
            } else {
              // Buffer the candidate — remoteDescription not set yet
              console.log('[useWebRTC] Buffering ICE candidate (no remoteDescription yet)')
              pendingCandidatesRef.current.push(candidate)
            }
          }
        } catch (err) {
          console.error('[useWebRTC] Signal handling error:', err, signal.type)
        }
      }
    }

    handleSignals()
  }, [signals, roomId, userId, startLocalStream, createPeerConnection, sendSignal, flushPendingCandidates])

  // ─── End call (cleanup) ───────────────────────────────────
  const endCall = useCallback(async () => {
    isCleaningUpRef.current = true

    // Stop all local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop()
        console.log('[useWebRTC] Stopped track:', track.kind)
      })
      localStreamRef.current = null
    }

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }

    // Clear signals in Convex
    if (roomId) {
      try {
        await clearSignals({ roomId })
      } catch (err) {
        console.error('[useWebRTC] Failed to clear signals:', err)
      }
    }

    // Reset state
    setLocalStream(null)
    setRemoteStream(null)
    remoteStreamRef.current = null
    setConnectionState('idle')
    setIsAudioEnabled(true)
    setIsVideoEnabled(true)
    processedSignalsRef.current.clear()
    pendingCandidatesRef.current = []
    isCleaningUpRef.current = false
  }, [roomId, clearSignals])

  // ─── Cleanup on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      isCleaningUpRef.current = true

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      if (pcRef.current) {
        pcRef.current.close()
      }
    }
  }, [])

  // ─── Toggle audio ─────────────────────────────────────────
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
        console.log('[useWebRTC] Audio toggled:', audioTrack.enabled)
      }
    }
  }, [])

  // ─── Toggle video ─────────────────────────────────────────
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
        console.log('[useWebRTC] Video toggled:', videoTrack.enabled)
      }
    }
  }, [])

  return {
    localStream,
    remoteStream,
    connectionState,
    mediaError,
    startCall,
    endCall,
    startLocalStream,
    toggleAudio,
    toggleVideo,
    isAudioEnabled,
    isVideoEnabled,
  }
}
