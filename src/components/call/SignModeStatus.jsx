// SignModeStatus.jsx — Active sign-mode indicators for call accessibility UX
export default function SignModeStatus({
  isActive,
  isLoading,
  handDetected,
  confidence = 0,
  bufferProgress = 0,
  isolationMode = 'word',
}) {
  if (!isActive && !isLoading && !handDetected) return null

  const confPct = Math.round(confidence * 100)
  const bufPct = Math.round(bufferProgress * 100)

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: 'rgba(255, 193, 7, 0.12)',
          border: '1px solid rgba(255, 193, 7, 0.35)',
          borderRadius: 20,
        }}
      >
        <span style={{ fontSize: '0.75rem' }} aria-hidden>🤟</span>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.52rem',
            fontWeight: 700,
            color: '#ffc107',
            letterSpacing: '0.1em',
          }}
        >
          {isLoading ? 'LOADING MODELS' : `SIGN · ${isolationMode.toUpperCase()}`}
        </span>
      </div>

      {!isLoading && (
        <div
          style={{
            padding: '4px 10px',
            background: 'rgba(0, 0, 0, 0.45)',
            borderRadius: 8,
            border: `1px solid ${handDetected ? 'rgba(0, 255, 136, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.5rem',
            color: handDetected ? '#00ff88' : 'rgba(255,255,255,0.35)',
            letterSpacing: '0.06em',
          }}
        >
          {handDetected
            ? confidence > 0
              ? `HANDS · ${confPct}%`
              : 'HANDS · TRACKING'
            : 'SHOW HANDS'}
          {isolationMode === 'word' && bufPct > 0 && bufPct < 100 ? ` · BUF ${bufPct}%` : ''}
        </div>
      )}
    </div>
  )
}
