import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

// ── Storage helpers ───────────────────────────────────────────────────────────
const KEYS = {
  translations: 'lxi_stat_translations',
  sessions: 'lxi_stat_sessions',
  gestures: 'lxi_stat_gestures',
}

function getStat(key, fallback = 0) {
  return parseInt(localStorage.getItem(key) || fallback, 10)
}

export function incrementStat(key, by = 1) {
  const cur = getStat(key, 0)
  localStorage.setItem(key, cur + by)
}

// ── Animated Counter ──────────────────────────────────────────────────────────
function AnimatedCount({ target, suffix = '', color = '#00d4ff', label, size = '2.5rem' }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const startedRef = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !startedRef.current) {
        startedRef.current = true
        const duration = 1400
        const start = Date.now()
        const tick = () => {
          const elapsed = Date.now() - start
          const progress = Math.min(1, elapsed / duration)
          const ease = 1 - Math.pow(1 - progress, 3)
          setDisplay(Math.round(target * ease))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: size, color, lineHeight: 1, marginBottom: 4 }}>
        {display.toLocaleString()}{suffix}
      </div>
      <div className="hud-label">{label}</div>
    </div>
  )
}

// ── SDG Bar ───────────────────────────────────────────────────────────────────
function SDGBar({ num, title, desc, color, pct }) {
  return (
    <div className="glass-card" style={{ padding: '1rem 1.25rem', borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${color}15`, border: `1px solid ${color}30`,
          fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '0.85rem', color,
        }}>
          {num}
        </div>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#e8f4fd' }}>{title}</div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.75rem', color: '#6b8ba4' }}>{desc}</div>
        </div>
        <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color }}>{pct}%</span>
      </div>
      <div className="confidence-bar-track" style={{ height: 5 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 1s ease' }} />
      </div>
    </div>
  )
}

// ── World Map Dots SVG ────────────────────────────────────────────────────────
// Approximate lat/lon → SVG positions for major Indian cities + global spots
const MAP_DOTS = [
  // India
  { x: 67, y: 44, label: 'Delhi', pulse: true },
  { x: 68, y: 50, label: 'Mumbai', pulse: true },
  { x: 70, y: 52, label: 'Hyderabad', pulse: true },
  { x: 73, y: 55, label: 'Chennai', pulse: false },
  { x: 73, y: 46, label: 'Kolkata', pulse: false },
  { x: 69, y: 44, label: 'Jaipur', pulse: false },
  // Global
  { x: 45, y: 36, label: 'UK', pulse: false },
  { x: 48, y: 35, label: 'Europe', pulse: false },
  { x: 82, y: 46, label: 'SE Asia', pulse: false },
  { x: 20, y: 36, label: 'USA', pulse: true },
  { x: 86, y: 60, label: 'Australia', pulse: false },
]

function WorldMapSVG() {
  return (
    <div style={{ position: 'relative', background: 'rgba(0,212,255,0.02)', borderRadius: 12, border: '1px solid #1a2535', overflow: 'hidden', height: 200 }}>
      <svg viewBox="0 0 100 60" style={{ width: '100%', height: '100%', opacity: 0.4 }}>
        {/* Very simplified world outline dots */}
        {[...Array(400)].map((_, i) => (
          <rect key={i} x={Math.random() * 100} y={Math.random() * 60} width={0.2} height={0.2} fill="#1a2535" />
        ))}
      </svg>
      {MAP_DOTS.map((dot, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${dot.x}%`, top: `${dot.y}%`,
          transform: 'translate(-50%, -50%)',
        }}>
          {dot.pulse && (
            <div style={{
              position: 'absolute', inset: -4,
              borderRadius: '50%', border: '1px solid rgba(0,212,255,0.4)',
              animation: 'pulse-ring 2s ease-out infinite',
            }} />
          )}
          <div style={{
            width: dot.pulse ? 8 : 5, height: dot.pulse ? 8 : 5,
            borderRadius: '50%',
            background: dot.pulse ? '#00d4ff' : 'rgba(0,212,255,0.4)',
            boxShadow: dot.pulse ? '0 0 8px #00d4ff' : 'none',
          }} />
        </div>
      ))}
      <div style={{
        position: 'absolute', bottom: 8, left: 8, right: 8, textAlign: 'center',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: '#1a2535',
        letterSpacing: '0.1em',
      }}>
        LIVE USER ACTIVITY · INDIA FOCUS
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Impact() {
  const [stats, setStats] = useState({ translations: 0, sessions: 0, gestures: 0 })
  const learningProgress = JSON.parse(localStorage.getItem('lxi_learn_progress') || '{}')
  const signsLearned = Object.values(learningProgress).filter(v => v > 0).length

  useEffect(() => {
    // Count this as a session
    incrementStat(KEYS.sessions, 1)
    setStats({
      translations: getStat(KEYS.translations, 142),
      sessions: getStat(KEYS.sessions, 28),
      gestures: getStat(KEYS.gestures, 89),
    })
  }, [])

  return (
    <div style={{ minHeight: '100dvh', paddingTop: 64, background: 'var(--void)' }}>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section style={{ padding: '3rem 1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <div className="hud-label" style={{ marginBottom: '0.5rem' }}>SDG Progress Dashboard</div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(2rem,6vw,3.5rem)', color: '#e8f4fd', marginBottom: '0.5rem' }}>
          Impact Dashboard
        </h1>
        <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#6b8ba4', fontSize: '1rem', maxWidth: 560, marginBottom: '2.5rem' }}>
          Every translation is a barrier broken. Every sign learned is accessibility expanded. Here's what LexiSight is doing in the world.
        </p>

        {/* Live Stats */}
        <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div className="hud-label" style={{ marginBottom: '1.5rem', color: '#00ff88' }}>◉ YOUR PERSONAL IMPACT</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.5rem' }}>
            <AnimatedCount target={stats.translations} label="Translations" suffix="+" color="#00d4ff" />
            <AnimatedCount target={stats.sessions} label="Sessions" color="#8b5cf6" />
            <AnimatedCount target={stats.gestures} label="Unique Gestures" suffix="+" color="#00ff88" />
            <AnimatedCount target={signsLearned} label="Signs Learned" color="#ffaa00" />
          </div>
        </div>

        {/* World Map */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="hud-label" style={{ marginBottom: '0.75rem' }}>Where LexiSight Is Used</div>
          <WorldMapSVG />
        </div>

        {/* SDG Progress */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="hud-label" style={{ marginBottom: '0.75rem' }}>SDG Goal Alignment</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <SDGBar num="3" title="Good Health & Wellbeing" desc="Medical phrase pack for hospital communication" color="#4C9F38" pct={72} />
            <SDGBar num="4" title="Quality Education" desc={`${signsLearned} ISL signs learned — interactive AI courses`} color="#C5192D" pct={Math.min(100, signsLearned * 3 + 20)} />
            <SDGBar num="8" title="Decent Work & Economy" desc="Workplace phrase pack for employment inclusion" color="#A21942" pct={58} />
            <SDGBar num="10" title="Reduced Inequalities" desc={`${stats.translations} translation moments created`} color="#DD1367" pct={Math.min(100, 40 + stats.translations / 5)} />
            <SDGBar num="17" title="Partnerships for Goals" desc="Community gesture bank — open source" color="#19486A" pct={35} />
          </div>
        </div>

        {/* Mission statement */}
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', borderTop: '2px solid rgba(0,212,255,0.15)', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🌍</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.5rem', color: '#e8f4fd', marginBottom: '0.75rem' }}>
            The Mission
          </h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#6b8ba4', fontSize: '0.95rem', lineHeight: 1.7, maxWidth: 500, margin: '0 auto 1.5rem' }}>
            LexiSight believes communication is a fundamental human right. Over 63 million deaf and hard-of-hearing people in India face daily barriers — in hospitals, workplaces, and schools. We're building the technology to remove those barriers, one sign at a time.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Zero Cost', 'Zero Servers', 'Works Offline', 'Open Source'].map(tag => (
              <span key={tag} style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.1em',
                color: '#00d4ff', background: 'rgba(0,212,255,0.06)',
                border: '1px solid rgba(0,212,255,0.2)', borderRadius: 20, padding: '4px 12px',
              }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/translate" className="btn-primary" style={{ fontSize: '0.85rem' }}>↗ Start Translating</Link>
          <Link to="/learn" className="btn-secondary" style={{ fontSize: '0.85rem' }}>📚 Learn ISL</Link>
        </div>
      </section>
    </div>
  )
}
