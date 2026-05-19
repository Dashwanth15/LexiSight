// NEW CODE — WebRTC peer connection hook for 1-to-1 video/audio calls
// Isolated from existing AI pipelines (useClassifier, useMediaPipe, etc.)
import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

// STUN servers for NAT traversal (free, public)
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
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
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [connectionState, setConnectionState] = useState('idle') // idle | connecting | connected | failed | closed
  const [mediaError, setMediaError] = useState(null)

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const makingOfferRef = useRef(false)
  const processedSignalsRef = useRef(new Set())
  const isCleaningUpRef = useRef(false)

  // Convex mutations
  const sendSignal = useMutation(api.signaling.sendSignal)
  const clearSignals = useMutation(api.signaling.clearSignals)

  // INTEGRATION POINT — Reactive subscription to incoming signals
  const signals = useQuery(
    api.signaling.getSignals,
    roomId ? { roomId, userId } : 'skip'
  )

  // ─── Get local media stream ───────────────────────────────
  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      localStreamRef.current = stream
      setLocalStream(stream)
      setMediaError(null)
      return stream
    } catch (err) {
      console.error('[useWebRTC] Media access error:', err)
      if (err.name === 'NotAllowedError') {
        setMediaError('Camera/microphone permission denied. Please allow access in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setMediaError('No camera or microphone found on this device.')
      } else if (err.name === 'NotReadableError') {
        setMediaError('Camera/microphone is already in use by another application.')
      } else {
        setMediaError(`Could not access media: ${err.message}`)
      }
      return null
    }
  }, [])

  // ─── Create peer connection ───────────────────────────────
  const createPeerConnection = useCallback((stream) => {
    if (pcRef.current) {
      pcRef.current.close()
    }

    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    // Add local tracks to the connection
    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })
    }

    // Handle remote stream
    const remoteMediaStream = new MediaStream()
    setRemoteStream(remoteMediaStream)

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        remoteMediaStream.addTrack(track)
      })
      // Force re-render by creating new reference
      setRemoteStream(new MediaStream(remoteMediaStream.getTracks()))
    }

    // Send ICE candidates to Convex
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

    // Track connection state
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      console.log('[useWebRTC] Connection state:', state)
      if (state === 'connected') {
        setConnectionState('connected')
      } else if (state === 'failed') {
        setConnectionState('failed')
      } else if (state === 'disconnected' || state === 'closed') {
        setConnectionState('closed')
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log('[useWebRTC] ICE state:', pc.iceConnectionState)
    }

    return pc
  }, [roomId, userId, sendSignal])

  // ─── Start call (create offer) ─────────────────────────────
  const startCall = useCallback(async () => {
    if (!roomId || !userId) return

    setConnectionState('connecting')

    const stream = await startLocalStream()
    if (!stream) return

    const pc = createPeerConnection(stream)

    try {
      makingOfferRef.current = true
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      await sendSignal({
        roomId,
        fromUserId: userId,
        type: 'offer',
        data: JSON.stringify(pc.localDescription.toJSON()),
      })

      console.log('[useWebRTC] Offer sent')
    } catch (err) {
      console.error('[useWebRTC] Failed to create offer:', err)
      setConnectionState('failed')
    } finally {
      makingOfferRef.current = false
    }
  }, [roomId, userId, startLocalStream, createPeerConnection, sendSignal])

  // ─── Handle incoming signals ──────────────────────────────
  useEffect(() => {
    if (!signals || signals.length === 0 || !roomId || !userId) return
    if (isCleaningUpRef.current) return

    const handleSignals = async () => {
      for (const signal of signals) {
        // Skip already-processed signals (prevents infinite loops)
        if (processedSignalsRef.current.has(signal._id)) continue
        processedSignalsRef.current.add(signal._id)

        try {
          if (signal.type === 'offer') {
            console.log('[useWebRTC] Received offer')
            setConnectionState('connecting')

            // Get local stream if not already available
            let stream = localStreamRef.current
            if (!stream) {
              stream = await startLocalStream()
              if (!stream) return
            }

            // Create peer connection if needed
            if (!pcRef.current || pcRef.current.connectionState === 'closed') {
              createPeerConnection(stream)
            }

            const pc = pcRef.current
            const offerDesc = JSON.parse(signal.data)
            await pc.setRemoteDescription(new RTCSessionDescription(offerDesc))

            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            await sendSignal({
              roomId,
              fromUserId: userId,
              type: 'answer',
              data: JSON.stringify(pc.localDescription.toJSON()),
            })

            console.log('[useWebRTC] Answer sent')
          } else if (signal.type === 'answer') {
            console.log('[useWebRTC] Received answer')
            const pc = pcRef.current
            if (pc && pc.signalingState !== 'stable') {
              const answerDesc = JSON.parse(signal.data)
              await pc.setRemoteDescription(new RTCSessionDescription(answerDesc))
            }
          } else if (signal.type === 'ice-candidate') {
            const pc = pcRef.current
            if (pc && pc.remoteDescription) {
              const candidate = new RTCIceCandidate(JSON.parse(signal.data))
              await pc.addIceCandidate(candidate)
            }
          }
        } catch (err) {
          console.error('[useWebRTC] Signal handling error:', err)
        }
      }
    }

    handleSignals()
  }, [signals, roomId, userId, startLocalStream, createPeerConnection, sendSignal])

  // ─── End call (cleanup) ───────────────────────────────────
  const endCall = useCallback(async () => {
    isCleaningUpRef.current = true

    // Stop all local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
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
    setConnectionState('idle')
    processedSignalsRef.current.clear()
    makingOfferRef.current = false
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

  // ─── Toggle audio/video ───────────────────────────────────
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        // Force re-render
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
      }
    }
  }, [])

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
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
    isAudioEnabled: localStreamRef.current?.getAudioTracks()[0]?.enabled ?? true,
    isVideoEnabled: localStreamRef.current?.getVideoTracks()[0]?.enabled ?? true,
  }
}
