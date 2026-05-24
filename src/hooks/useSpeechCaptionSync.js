// useSpeechCaptionSync.js — Publishes/subscribes speech caption text via Convex signaling
// Reuses signaling.sendSignal / getSignals (type: "speech-caption") for realtime updates.
import { useCallback, useMemo, useRef } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

const CAPTION_STALE_MS = 6000
const PUBLISH_THROTTLE_MS = 200

function parseSpeechCaptionSignal(signal) {
  try {
    const { stable = '', interim = '', timestamp = 0 } = JSON.parse(signal.data)
    return { stable, interim, timestamp }
  } catch {
    return { stable: '', interim: '', timestamp: 0 }
  }
}

/**
 * Syncs realtime speech captions to the remote peer.
 * @param {{ roomId?: string, userId: string, enabled: boolean, subscribe?: boolean }} options
 */
export default function useSpeechCaptionSync({
  roomId,
  userId,
  enabled,
  subscribe = true,
}) {
  const sendSignal = useMutation(api.signaling.sendSignal)
  const lastPublishRef = useRef({ at: 0 })
  const lastStableRef = useRef('')
  const lastInterimRef = useRef('')

  const signals = useQuery(
    api.signaling.getSignals,
    subscribe && roomId && userId ? { roomId, userId } : 'skip'
  )

  const remoteSpeechCaption = useMemo(() => {
    if (!signals?.length) return { stable: '', interim: '' }

    const peerCaptions = signals
      .filter((s) => s.type === 'speech-caption')
      .sort((a, b) => b.createdAt - a.createdAt)

    const latest = peerCaptions[0]
    if (!latest) return { stable: '', interim: '' }

    const parsed = parseSpeechCaptionSignal(latest)
    if (
      Date.now() - latest.createdAt > CAPTION_STALE_MS &&
      !parsed.interim
    ) {
      return { stable: '', interim: '' }
    }
    return parsed
  }, [signals])

  const publishSpeechCaption = useCallback(
    async ({ stable = '', interim = '' }) => {
      if (!enabled || !roomId || !userId) return
      const now = Date.now()

      const isStableChanged = stable !== lastStableRef.current
      const isInterimChanged = interim !== lastInterimRef.current

      // If nothing has changed, do not publish
      if (!isStableChanged && !isInterimChanged) return

      // Throttle interim updates to 200ms, but publish stable changes immediately
      if (!isStableChanged && now - lastPublishRef.current.at < PUBLISH_THROTTLE_MS) {
        return
      }

      lastStableRef.current = stable
      lastInterimRef.current = interim
      lastPublishRef.current.at = now

      try {
        await sendSignal({
          roomId,
          fromUserId: userId,
          type: 'speech-caption',
          data: JSON.stringify({
            userId,
            stable,
            interim,
            timestamp: now
          }),
        })
      } catch (err) {
        console.warn('[useSpeechCaptionSync] publish failed:', err)
      }
    },
    [enabled, roomId, userId, sendSignal]
  )

  const clearSpeechCaptions = useCallback(async () => {
    if (!roomId || !userId) return
    try {
      await sendSignal({
        roomId,
        fromUserId: userId,
        type: 'speech-caption',
        data: JSON.stringify({ userId, stable: '', interim: '', timestamp: Date.now() }),
      })
    } catch (err) {
      console.warn('[useSpeechCaptionSync] clear failed:', err)
    }
  }, [roomId, userId, sendSignal])

  return {
    remoteSpeechCaption,
    publishSpeechCaption,
    clearSpeechCaptions,
  }
}
