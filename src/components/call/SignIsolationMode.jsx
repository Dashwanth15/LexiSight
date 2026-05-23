// SignIsolationMode.jsx — Word / Letter / Number isolation (matches Translator)
const MODES = [
  { id: 'word', label: 'Word' },
  { id: 'letter', label: 'Letter' },
  { id: 'number', label: 'Number' },
]

export default function SignIsolationMode({ mode = 'word', onModeChange, disabled = false }) {
  return (
    <div
      className="call-sign-isolation"
      role="group"
      aria-label="Sign isolation mode"
      style={{
        flexShrink: 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: 'rgba(6, 10, 18, 0.85)',
        backdropFilter: 'blur(12px)',
        borderRadius: 10,
        border: '1px solid rgba(255, 193, 7, 0.15)',
      }}
    >
      <span className="hud-label" style={{ marginRight: 4, color: 'rgba(255, 193, 7, 0.75)' }}>
        ISOLATION MODE:
      </span>
      {MODES.map((m) => {
        const active = mode === m.id
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            className={active ? 'btn-primary' : 'btn-secondary'}
            onClick={() => onModeChange(m.id)}
            aria-pressed={active}
            style={{
              padding: '6px 14px',
              fontSize: '0.75rem',
              minHeight: 32,
              opacity: disabled ? 0.45 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              ...(active
                ? {
                    boxShadow: '0 0 12px rgba(255, 193, 7, 0.25)',
                    borderColor: 'rgba(255, 193, 7, 0.5)',
                  }
                : {}),
            }}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
