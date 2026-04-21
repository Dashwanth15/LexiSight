import { useState, useEffect, useCallback } from 'react'

let toastId = 0
const listeners = new Set()

// Global toast API
export const toast = {
  show: (message, type = 'info', duration = 3000) => {
    const id = ++toastId
    listeners.forEach(fn => fn({ id, message, type, duration }))
    return id
  },
  success: (msg, dur) => toast.show(msg, 'success', dur),
  error: (msg, dur) => toast.show(msg, 'error', dur || 5000),
  info: (msg, dur) => toast.show(msg, 'info', dur),
  warning: (msg, dur) => toast.show(msg, 'warning', dur),
}

const ICONS = {
  success: '✓',
  error: '✕',
  info: '◈',
  warning: '⚠',
}

const TYPE_COLORS = {
  success: { border: '#00ff88', icon: '#00ff88', bg: 'rgba(0,255,136,0.06)' },
  error: { border: '#ff3366', icon: '#ff3366', bg: 'rgba(255,51,102,0.06)' },
  info: { border: '#00d4ff', icon: '#00d4ff', bg: 'rgba(0,212,255,0.06)' },
  warning: { border: '#ffaa00', icon: '#ffaa00', bg: 'rgba(255,170,0,0.06)' },
}

function ToastItem({ id, message, type, duration, onDismiss }) {
  const colors = TYPE_COLORS[type] || TYPE_COLORS.info
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onDismiss(id), 300)
    }, duration)
    return () => clearTimeout(t)
  }, [id, duration, onDismiss])

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl max-w-sm w-full shadow-2xl"
      style={{
        background: 'rgba(8, 13, 20, 0.95)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${colors.border}40`,
        borderLeft: `3px solid ${colors.border}`,
        backgroundColor: colors.bg,
        animation: exiting ? 'slide-up-fade 0.3s ease-in reverse' : 'slide-up-fade 0.3s ease-out',
        cursor: 'pointer',
      }}
      onClick={() => { setExiting(true); setTimeout(() => onDismiss(id), 300) }}
    >
      <span
        className="text-sm mt-0.5 shrink-0 font-bold"
        style={{ color: colors.icon, fontFamily: 'JetBrains Mono, monospace' }}
      >
        {ICONS[type]}
      </span>
      <span
        className="text-sm leading-relaxed"
        style={{ color: '#e8f4fd', fontFamily: 'DM Sans, sans-serif' }}
      >
        {message}
      </span>
    </div>
  )
}

export default function ToastNotif() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const handler = (t) => {
      setToasts(prev => [...prev.slice(-4), t]) // max 5 toasts
    }
    listeners.add(handler)
    return () => listeners.delete(handler)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-[10000] flex flex-col gap-2 items-end"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map(t => (
        <ToastItem key={t.id} {...t} onDismiss={dismiss} />
      ))}
    </div>
  )
}
