import { useEffect, useRef } from 'react'

export const PredictionState = {
  CONFIDENT: 2,
  UNCERTAIN: 1,
  UNKNOWN: 0,
}

const STATE_CONFIG = {
  [PredictionState.CONFIDENT]: {
    label: 'CONFIDENT',
    color: '#00ff88',
    bgColor: 'rgba(0, 255, 136, 0.08)',
    borderColor: 'rgba(0, 255, 136, 0.3)',
    glowColor: 'rgba(0, 255, 136, 0.2)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="#00ff88" strokeWidth="1.5"/>
        <path d="M5.5 8l1.8 1.8L10.5 6" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    description: 'Clear match',
  },
  [PredictionState.UNCERTAIN]: {
    label: 'UNCERTAIN',
    color: '#ffaa00',
    bgColor: 'rgba(255, 170, 0, 0.08)',
    borderColor: 'rgba(255, 170, 0, 0.3)',
    glowColor: 'rgba(255, 170, 0, 0.2)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="#ffaa00" strokeWidth="1.5"/>
        <path d="M8 5.5v3.5" stroke="#ffaa00" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="8" cy="11" r="0.75" fill="#ffaa00"/>
      </svg>
    ),
    description: 'Check suggestions',
  },
  [PredictionState.UNKNOWN]: {
    label: 'UNKNOWN',
    color: '#ff3366',
    bgColor: 'rgba(255, 51, 102, 0.08)',
    borderColor: 'rgba(255, 51, 102, 0.3)',
    glowColor: 'rgba(255, 51, 102, 0.2)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="#ff3366" strokeWidth="1.5"/>
        <path d="M6 6l4 4M10 6l-4 4" stroke="#ff3366" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    description: 'Try again',
  },
}

function ConfidenceArc({ value, state }) {
  const canvasRef = useRef(null)
  const animRef = useRef({ current: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const size = canvas.width
    const cx = size / 2
    const cy = size / 2
    const radius = size / 2 - 4
    const cfg = STATE_CONFIG[state]

    const target = value * 270
    const start = animRef.current.current
    const duration = 400
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(1, elapsed / duration)
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = start + (target - start) * ease
      animRef.current.current = current

      ctx.clearRect(0, 0, size, size)

      ctx.beginPath()
      ctx.arc(cx, cy, radius, (135 * Math.PI) / 180, (405 * Math.PI) / 180)
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.stroke()

      const endAngle = ((135 + current) * Math.PI) / 180
      const gradient = ctx.createLinearGradient(0, 0, size, size)
      gradient.addColorStop(0, cfg.color)
      gradient.addColorStop(1, cfg.color + '80')

      ctx.beginPath()
      ctx.arc(cx, cy, radius, (135 * Math.PI) / 180, endAngle)
      ctx.strokeStyle = gradient
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.stroke()

      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [value, state])

  return (
    <canvas
      ref={canvasRef}
      width={64}
      height={64}
      style={{ display: 'block' }}
    />
  )
}

export default function GestureConfidenceIndicator({
  state = PredictionState.UNKNOWN,
  confidence = 0,
  label = '',
  topK = [],
  entropy = null,
  margin = null,
  stability = null,
  className = '',
}) {
  const cfg = STATE_CONFIG[state] || STATE_CONFIG[PredictionState.UNKNOWN]

  const pct = Math.round((confidence || 0) * 100)

  return (
    <div
      className={`flex flex-col items-center gap-3 ${className}`}
      style={{
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      <div
        className="relative flex flex-col items-center"
        style={{
          background: cfg.bgColor,
          border: `1px solid ${cfg.borderColor}`,
          borderRadius: 16,
          padding: '16px 20px',
          boxShadow: `0 0 24px ${cfg.glowColor}, inset 0 0 16px ${cfg.bgColor}`,
          minWidth: 160,
        }}
      >
        <ConfidenceArc value={confidence} state={state} />

        <div className="flex items-center gap-2 mt-1">
          {cfg.icon}
          <span
            className="text-xs font-bold tracking-widest"
            style={{ color: cfg.color, fontSize: '0.6rem' }}
          >
            {cfg.label}
          </span>
        </div>

        <div className="mt-2 text-center">
          <div
            className="text-lg font-bold truncate max-w-full"
            style={{ color: '#e8f4f8', fontSize: '1.1rem', letterSpacing: '0.05em' }}
          >
            {label || '---'}
          </div>
          <div
            className="text-xs mt-0.5"
            style={{ color: cfg.color, opacity: 0.8 }}
          >
            {pct}% confidence
          </div>
        </div>

        <div
          className="mt-2 text-xs"
          style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.55rem' }}
        >
          {cfg.description}
        </div>
      </div>

      {state === PredictionState.UNCERTAIN && topK && topK.length > 1 && (
        <div
          className="w-full"
          style={{
            background: cfg.bgColor,
            border: `1px solid ${cfg.borderColor}`,
            borderRadius: 12,
            padding: '10px 14px',
          }}
        >
          <div
            className="text-xs font-bold mb-2 tracking-widest"
            style={{ color: cfg.color, fontSize: '0.55rem' }}
          >
            DID YOU MEAN?
          </div>
          <div className="flex flex-col gap-1.5">
            {topK.slice(0, 3).map((item, i) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="text-xs"
                  style={{
                    color: i === 0 ? cfg.color : 'rgba(255,255,255,0.4)',
                    fontWeight: i === 0 ? '600' : '400',
                    fontSize: '0.65rem',
                  }}
                >
                  {item.label}
                </span>
                <div
                  className="flex-1 h-1 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((item.confidence || 0) * 100)}%`,
                      background: i === 0
                        ? `linear-gradient(90deg, ${cfg.color}, ${cfg.color}80)`
                        : 'rgba(255,255,255,0.2)',
                    }}
                  />
                </div>
                <span
                  className="text-xs"
                  style={{
                    color: i === 0 ? cfg.color : 'rgba(255,255,255,0.3)',
                    fontSize: '0.55rem',
                  }}
                >
                  {Math.round((item.confidence || 0) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {state === PredictionState.UNKNOWN && (
        <div
          className="w-full text-center py-2 px-3"
          style={{
            background: cfg.bgColor,
            border: `1px solid ${cfg.borderColor}`,
            borderRadius: 10,
            color: cfg.color,
            fontSize: '0.6rem',
            letterSpacing: '0.08em',
            opacity: 0.75,
          }}
        >
          Show the gesture again or adjust position
        </div>
      )}

      {(entropy !== null || margin !== null || stability !== null) && (
        <div
          className="flex gap-3 text-xs"
          style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.55rem' }}
        >
          {entropy !== null && (
            <span>entropy: {entropy.toFixed(3)}</span>
          )}
          {margin !== null && (
            <span>margin: {margin.toFixed(3)}</span>
          )}
          {stability !== null && (
            <span>stability: {(stability * 100).toFixed(0)}%</span>
          )}
        </div>
      )}
    </div>
  )
}
