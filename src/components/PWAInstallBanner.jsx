import { useState, useEffect } from 'react'

/**
 * PWAInstallBanner
 * Shows a dismissable install banner when the browser fires beforeinstallprompt
 */
export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState(null)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem('lxi_pwa_dismissed'))

  useEffect(() => {
    if (dismissed) return
    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [dismissed])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const result = await prompt.userChoice
    if (result.outcome === 'accepted') {
      setVisible(false)
      localStorage.setItem('lxi_pwa_dismissed', '1')
    }
  }

  const dismiss = () => {
    setVisible(false)
    setDismissed(true)
    localStorage.setItem('lxi_pwa_dismissed', '1')
  }

  if (!visible || dismissed) return null

  return (
    <div
      style={{
        position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9998,
        background: '#080d14',
        border: '1px solid rgba(0,212,255,0.3)',
        borderRadius: 14,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        maxWidth: 360, width: 'calc(100vw - 2rem)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.1)',
        animation: 'slide-up-fade 0.4s ease',
      }}
    >
      <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>📱</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: '#e8f4fd' }}>
          Install LexiSight
        </div>
        <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.75rem', color: '#6b8ba4', marginTop: 2 }}>
          Works offline · Zero data usage
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={dismiss} style={{ background: 'transparent', border: 'none', color: '#1a2535', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'DM Sans, sans-serif' }}>Later</button>
        <button
          onClick={install}
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(139,92,246,0.15))',
            border: '1px solid rgba(0,212,255,0.4)',
            borderRadius: 8, color: '#00d4ff',
            fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
            fontSize: '0.8rem', padding: '6px 14px', cursor: 'pointer',
          }}
        >
          Install
        </button>
      </div>
    </div>
  )
}
