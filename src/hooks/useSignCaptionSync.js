// useSignCaptionSync.js — Publishes/subscribes sign caption text via Convex signaling
// Reuses deployed signaling.sendSignal / getSignals (type: "sign-caption") so no new
// Convex functions are required before `npx convex dev` deploys signCaptions.js.
import { useCallback, useMemo, useRef } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

const CAPTION_STALE_MS = 8000
const PUBLISH_THROTTLE_MS = 100

function parseSignCaptionSignal(signal) {
  try {
    const { stable = '', interim = '' } = JSON.parse(signal.data)
    return { stable, interim }
  } catch {
    return { stable: '', interim: '' }
  }
}

/**
 * Syncs finalized sign caption text to the remote peer. Only strings are sent.
 * @param {{ roomId?: string, userId: string, enabled: boolean, subscribe?: boolean }} options
 */
export default function useSignCaptionSync({
  roomId,
  userId,
  enabled,
  subscribe = true,
}) {
  const sendSignal = useMutation(api.signaling.sendSignal)
  const lastPublishRef = useRef({ key: '', at: 0 })

  const signals = useQuery(
    api.signaling.getSignals,
    subscribe && roomId && userId ? { roomId, userId } : 'skip'
  )

  const remoteSignCaption = useMemo(() => {
    if (!signals?.length) return { stable: '', interim: '' }

    const peerCaptions = signals
      .filter((s) => s.type === 'sign-caption')
      .sort((a, b) => b.createdAt - a.createdAt)

    const latest = peerCaptions[0]
    if (!latest) return { stable: '', interim: '' }

    const parsed = parseSignCaptionSignal(latest)
    if (
      Date.now() - latest.createdAt > CAPTION_STALE_MS &&
      !parsed.interim
    ) {
      return { stable: '', interim: '' }
    }
    return parsed
  }, [signals])

  const publishCaption = useCallback(
    async ({ stable = '', interim = '' }) => {
      if (!enabled || !roomId || !userId) return
      const key = `${stable}\0${interim}`
      const now = Date.now()
      if (
        key === lastPublishRef.current.key &&
        now - lastPublishRef.current.at < PUBLISH_THROTTLE_MS
      ) {
        return
      }
      lastPublishRef.current = { key, at: now }
      try {
        await sendSignal({
          roomId,
          fromUserId: userId,
          type: 'sign-caption',
          data: JSON.stringify({ stable, interim }),
        })
      } catch (err) {
        console.warn('[useSignCaptionSync] publish failed:', err)
      }
    },
    [enabled, roomId, userId, sendSignal]
  )

  const clearCaptions = useCallback(async () => {
    if (!roomId || !userId) return
    try {
      await sendSignal({
        roomId,
        fromUserId: userId,
        type: 'sign-caption',
        data: JSON.stringify({ stable: '', interim: '' }),
      })
    } catch (err) {
      console.warn('[useSignCaptionSync] clear failed:', err)
    }
  }, [roomId, userId, sendSignal])

  return {
    remoteSignCaption,
    publishCaption,
    clearCaptions,
  }
}
