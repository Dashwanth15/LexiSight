import { useEffect, useRef, useCallback } from 'react'

export default function ConfidenceTopK({ topK = [], className = '' }) {
  if (!topK || topK.length === 0) return null

  return (
    <div className={`space-y-1.5 ${className}`}>
      <span className="hud-label">Top Predictions</span>
      <div className="space-y-2">
        {topK.slice(0, 3).map((item, i) => {
          const pct = Math.round((item.confidence || 0) * 100)
          const isTop = i === 0
          return (
            <div key={item.label} className="flex items-center gap-3">
              <span
                className="font-mono text-xs w-20 truncate shrink-0"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: isTop ? '#00d4ff' : '#6b8ba4',
                  fontSize: '0.7rem',
                }}
              >
                {item.label}
              </span>
              <div
                className="flex-1 h-1 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    background: isTop
                      ? 'linear-gradient(90deg, #8b5cf6, #00d4ff)'
                      : 'rgba(107, 139, 164, 0.4)',
                  }}
                />
              </div>
              <span
                className="font-mono text-xs w-10 text-right shrink-0"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: isTop ? '#00d4ff' : '#6b8ba4',
                  fontSize: '0.65rem',
                }}
              >
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
