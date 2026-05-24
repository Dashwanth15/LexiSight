// SignCaptionOverlay.jsx — Remote/local sign translation overlay (parallel to speech subtitles)
export default function SignCaptionOverlay({
  stableText = '',
  interimText = '',
  label = 'Sign translation',
}) {
  const display = (
    stableText +
    (interimText && !stableText.endsWith(interimText.trim()) ? ` ${interimText}` : '')
  ).trim()

  if (!display) return null

  return (
    <div
      className="sign-caption-overlay"
      style={{
        position: 'absolute',
        bottom: 56,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 22,
        maxWidth: '88%',
        width: 'max-content',
        pointerEvents: 'none',
        animation: 'fade-in 0.2s ease-out',
      }}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div
        style={{
          padding: '10px 18px',
          background: 'rgba(4, 8, 14, 0.85)',
          backdropFilter: 'blur(14px)',
          borderRadius: 10,
          border: '1px solid rgba(255, 193, 7, 0.4)',
          boxShadow: '0 4px 28px rgba(0, 0, 0, 0.5), 0 0 24px rgba(255, 193, 7, 0.1)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.58rem',
            fontWeight: 700,
            color: '#ffc107',
            letterSpacing: '0.14em',
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span aria-hidden>🤟</span>
          <span>SIGN</span>
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '0.95rem',
            lineHeight: 1.55,
            color: '#fff8e7',
            fontWeight: 500,
          }}
        >
          {stableText && <span>{stableText}</span>}
          {interimText && (
            <span
              style={{
                color: 'rgba(255, 220, 150, 0.7)',
                fontStyle: 'italic',
                marginLeft: stableText ? 8 : 0,
              }}
            >
              {interimText}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
