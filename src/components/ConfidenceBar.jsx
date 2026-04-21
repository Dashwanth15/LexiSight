import { useEffect, useRef } from 'react'

export default function ConfidenceBar({ value = 0, label = '', className = '' }) {
  const fillRef = useRef(null)
  const textRef = useRef(null)
  const animRef = useRef({ current: 0 })

  const pct = Math.max(0, Math.min(1, value)) * 100

  // Determine color tier
  const tier = pct < 40 ? 'low' : pct < 75 ? 'medium' : 'high'

  const colors = {
    low: { from: '#ff3366', to: '#ff6600', glow: 'rgba(255,51,102,0.4)' },
    medium: { from: '#ffaa00', to: '#ffd000', glow: 'rgba(255,170,0,0.4)' },
    high: { from: '#00d4ff', to: '#00ff88', glow: 'rgba(0,255,136,0.5)' },
  }

  const c = colors[tier]

  useEffect(() => {
    const target = pct
    const start = animRef.current.current
    const duration = 300
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(1, elapsed / duration)
      const ease = 1 - Math.pow(1 - progress, 3)
      const val = start + (target - start) * ease
      animRef.current.current = val

      if (fillRef.current) {
        fillRef.current.style.width = `${val}%`
      }
      if (textRef.current) {
        textRef.current.textContent = `${val.toFixed(0)}%`
      }

      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [pct])

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        {label && (
          <span className="hud-label">{label}</span>
        )}
        <span
          ref={textRef}
          className="font-mono text-xs font-semibold"
          style={{ color: c.from, fontFamily: 'JetBrains Mono, monospace' }}
        >
          {pct.toFixed(0)}%
        </span>
      </div>

      {/* Track */}
      <div
        className="relative w-full h-2 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.05)' }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label || 'Confidence'}: ${pct.toFixed(0)}%`}
      >
        {/* Tick marks */}
        {[25, 50, 75].map(tick => (
          <div
            key={tick}
            className="absolute top-0 bottom-0 w-px"
            style={{ left: `${tick}%`, background: 'rgba(255,255,255,0.1)' }}
          />
        ))}

        {/* Fill */}
        <div
          ref={fillRef}
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${c.from}, ${c.to})`,
            backgroundSize: '200% 100%',
            animation: 'liquid-fill 2s linear infinite',
            boxShadow: `0 0 8px ${c.glow}`,
            transition: 'background 0.3s ease',
          }}
        />

        {/* Shimmer */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'liquid-fill 1.5s linear infinite',
          }}
        />
      </div>
    </div>
  )
}
