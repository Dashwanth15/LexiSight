import { useRef, useEffect, useState } from 'react'
import { useTranslation } from '../hooks/useTranslation.js'

const PIPELINE_NODES = [
  { id: 'cam', label: 'Webcam', sub: 'getUserMedia()', x: 60, y: 120, color: '#00d4ff' },
  { id: 'mp', label: 'MediaPipe', sub: 'Hand Landmarks', x: 220, y: 120, color: '#8b5cf6' },
  { id: 'norm', label: 'Normalizer', sub: '63 coords', x: 380, y: 120, color: '#00d4ff' },
  { id: 'scaler', label: 'Scaler', sub: 'StandardScaler', x: 540, y: 120, color: '#8b5cf6' },
  { id: 'tf', label: 'TF.js Model', sub: 'Dense(256→64→N)', x: 700, y: 120, color: '#00ff88' },
  { id: 'out', label: 'Output', sub: 'Softmax + Speak', x: 860, y: 120, color: '#ffaa00' },
]

const TECH_STACK = [
  { name: 'TensorFlow.js', desc: 'In-browser ML inference', color: '#ff6f00', icon: '🧠' },
  { name: 'MediaPipe Hands', desc: '21-point hand landmarks', color: 'var(--cyan)', icon: '✋' },
  { name: 'React 18', desc: 'UI framework', color: '#61dafb', icon: '⚛' },
  { name: 'Vite PWA', desc: 'Offline-first app', color: '#a855f7', icon: '⚡' },
  { name: 'Web Speech API', desc: 'TTS + STT native', color: '#00ff88', icon: '🎤' },
  { name: 'Tailwind CSS', desc: 'Utility-first styling', color: '#38bdf8', icon: '🎨' },
  { name: 'ISL CSLRT', desc: 'Dataset 1: 24 classes', color: 'var(--text-secondary)', icon: '📁' },
  { name: 'ISL Gestures', desc: 'Dataset 2: 37 classes', color: 'var(--text-secondary)', icon: '📁' },
]

function PipelineCanvas() {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const particlesRef = useRef([]) // flowing particles between nodes

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = Math.min(canvas.offsetWidth, 950)
    canvas.height = 220

    // Create flow particles for each edge
    const edges = PIPELINE_NODES.slice(0, -1).map((n, i) => ({
      from: { x: n.x + 45, y: n.y },
      to: { x: PIPELINE_NODES[i + 1].x - 45, y: PIPELINE_NODES[i + 1].y },
      color: n.color,
    }))

    particlesRef.current = edges.flatMap(e =>
      Array.from({ length: 3 }, (_, i) => ({
        edge: e,
        t: i / 3,
        speed: 0.004 + Math.random() * 0.002,
      }))
    )

    const scaleX = canvas.width / 950

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const scale = (x) => x * scaleX

      // Draw edges
      for (const e of edges) {
        ctx.beginPath()
        ctx.moveTo(scale(e.from.x), e.from.y)
        ctx.lineTo(scale(e.to.x), e.to.y)
        ctx.strokeStyle = 'rgba(26, 37, 53, 0.8)'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Draw flow particles
      for (const p of particlesRef.current) {
        p.t = (p.t + p.speed) % 1
        const x = p.edge.from.x + (p.edge.to.x - p.edge.from.x) * p.t
        const y = p.edge.from.y + (p.edge.to.y - p.edge.from.y) * p.t

        ctx.beginPath()
        ctx.arc(scale(x), y, 3, 0, Math.PI * 2)
        ctx.fillStyle = p.edge.color
        ctx.shadowColor = p.edge.color
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // Draw nodes
      const rootStyle = getComputedStyle(document.documentElement)
      const surfaceColor = rootStyle.getPropertyValue('--surface').trim() || '#0d1520'
      const borderColor = rootStyle.getPropertyValue('--border').trim() || 'rgba(255,255,255,0.1)'
      
      const hexToRgba = (hex, alpha) => {
        if (!hex.startsWith('#')) return `rgba(0, 212, 255, ${alpha})`
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        return `rgba(${r}, ${g}, ${b}, ${alpha})`
      }

      for (const node of PIPELINE_NODES) {
        const nx = scale(node.x)
        const ny = node.y

        // Node circle
        ctx.beginPath()
        ctx.arc(nx, ny, 42, 0, Math.PI * 2)
        ctx.fillStyle = surfaceColor
        ctx.strokeStyle = hexToRgba(node.color, 0.4)
        ctx.lineWidth = 1.5
        ctx.fill()
        ctx.stroke()

        // Glow
        ctx.beginPath()
        ctx.arc(nx, ny, 42, 0, Math.PI * 2)
        const grd = ctx.createRadialGradient(nx, ny, 10, nx, ny, 42)
        grd.addColorStop(0, hexToRgba(node.color, 0.15))
        grd.addColorStop(1, hexToRgba(node.color, 0))
        ctx.fillStyle = grd
        ctx.fill()

        // Label
        ctx.fillStyle = node.color
        ctx.font = `bold 11px "JetBrains Mono", monospace`
        ctx.textAlign = 'center'
        ctx.fillText(node.label, nx, ny - 6)

        ctx.fillStyle = 'var(--text-secondary)'
        ctx.font = `9px "DM Sans", sans-serif`
        ctx.fillText(node.sub, nx, ny + 10)
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: 220, maxWidth: '100%' }}
    />
  )
}

export default function About() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen pt-16" style={{ background: 'var(--void)' }}>

      {/* ── HERO ─────────────────── */}
      <section className="py-24 px-6 lg:px-12">
        <div className="max-w-4xl mx-auto">
          <div className="hud-label mb-4 animate-slide-up">{t('about_hero_title')}</div>
          <h1 className={`text-5xl md:text-7xl font-syne font-black mb-6 leading-tight transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
            style={{ color: 'var(--text-primary)' }}>
            {t('about_hero_h1_1')}<br />
            <span className="text-glow-cyan">{t('about_hero_h1_2')}</span>
          </h1>
          <p className="text-lg font-dm leading-relaxed max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            {t('about_hero_p')}
          </p>
        </div>
      </section>

      {/* ── MISSION ─────────────────── */}
      <section className="py-16 px-6 lg:px-12" style={{ background: 'var(--obsidian)' }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="animate-slide-left">
            <div className="hud-label mb-4">{t('mission_title') || 'SDG 10 Alignment'}</div>
            <h2 className="text-4xl font-syne font-black mb-4" style={{ color: 'var(--text-primary)' }}>
              {t('about_mission_h2')}
            </h2>
            <p className="text-base font-dm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
              {t('about_mission_p')}
            </p>
            <div className="space-y-3">
              {[
                ['Real-time', 'Sub-50ms inference latency'],
                ['Private', '100% on-device, zero data upload'],
                ['Accessible', 'Works on any modern smartphone'],
                ['Free', 'No subscription, no server costs'],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#00ff88', boxShadow: '0 0 4px #00ff88' }} />
                  <span className="text-sm font-dm"><strong style={{ color: 'var(--text-primary)' }}>{title}</strong> — <span style={{ color: 'var(--text-secondary)' }}>{desc}</span></span>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-slide-right">
            {/* SDG badge large */}
            <div
              className="flex flex-col items-center justify-center p-10 rounded-2xl text-center"
              style={{
                background: 'rgba(0,212,255,0.04)',
                border: '1px solid rgba(0,212,255,0.15)',
                boxShadow: '0 0 60px rgba(0,212,255,0.06)',
              }}
            >
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-4xl mb-4 animate-spin-slow"
                style={{
                  background: 'rgba(0,212,255,0.08)',
                  border: '2px solid rgba(0,212,255,0.3)',
                }}
              >
                ⚖
              </div>
              <div className="text-3xl font-syne font-black" style={{ color: 'var(--cyan)' }}>SDG 10</div>
              <div className="text-lg font-dm font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>Reduced Inequalities</div>
              <div className="text-sm font-dm mt-3" style={{ color: 'var(--text-secondary)' }}>
                AIESEC Youth Speak Ideathon 2026<br />IIIT Hyderabad
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PIPELINE DIAGRAM ─────────────────── */}
      <section className="py-20 px-6 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="hud-label mb-4">Architecture</div>
            <h2 className="text-4xl font-syne font-black" style={{ color: 'var(--text-primary)' }}>
              {t('about_pipeline_title') || 'How the AI Pipeline Works'}
            </h2>
            <p className="mt-3 text-sm font-dm" style={{ color: 'var(--text-secondary)' }}>
              Real-time data flow from webcam to spoken word — all in the browser
            </p>
          </div>

          <div
            className="glass-card p-6 overflow-x-auto"
            style={{ borderTop: '2px solid rgba(0,212,255,0.2)' }}
          >
            <PipelineCanvas />
          </div>

          {/* Pipeline steps text */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-6 sm:mt-8">
            {[
              { step: '01', title: 'Webcam Capture', desc: '640×480 video at 30fps via getUserMedia()' },
              { step: '02', title: 'MediaPipe Hands', desc: 'Detects 21 hand landmarks (x,y,z) per frame' },
              { step: '03', title: 'Normalization', desc: 'Scale relative to wrist, produces 63-number vector' },
              { step: '04', title: 'StandardScaler', desc: 'Zero-mean unit-variance (from training)' },
              { step: '05', title: 'TF.js Inference', desc: 'Dense(256→128→64→N) with BatchNorm + Dropout' },
              { step: '06', title: 'Softmax Output', desc: 'Top prediction → Web Speech API → Indian English' },
            ].map(s => (
              <div key={s.step} className="glass-card p-4">
                <div className="font-mono text-xs mb-2" style={{ color: '#8b5cf6', fontFamily: 'JetBrains Mono, monospace' }}>{s.step}</div>
                <div className="text-sm font-syne font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{s.title}</div>
                <div className="text-xs font-dm" style={{ color: 'var(--text-secondary)' }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECH STACK ─────────────────── */}
      <section className="py-20 px-6 lg:px-12" style={{ background: 'var(--obsidian)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="hud-label mb-4">Built With</div>
            <h2 className="text-4xl font-syne font-black" style={{ color: 'var(--text-primary)' }}>{t('about_tech_title') || 'Tech Stack'}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TECH_STACK.map((tech, i) => (
              <div
                key={tech.name}
                className="glass-card p-4 flex flex-col gap-2 hover:scale-105 transition-transform duration-300 cursor-default"
                style={{
                  animationDelay: `${i * 50}ms`,
                  borderTop: `2px solid ${tech.color}30`,
                }}
              >
                <div className="text-2xl">{tech.icon}</div>
                <div className="text-sm font-syne font-bold" style={{ color: 'var(--text-primary)' }}>{tech.name}</div>
                <div className="text-xs font-dm" style={{ color: 'var(--text-secondary)' }}>{tech.desc}</div>
                <div className="w-full h-0.5 rounded-full mt-auto" style={{ background: `${tech.color}30` }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DATASET INFO ─────────────────── */}
      <section className="py-20 px-6 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="hud-label mb-8 text-center">Dataset Strategy</div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'ISL Gesture Images',
                badge: 'PRIMARY',
                stats: [['37 classes', '0-9, A-Z, _'], ['1,500 samples/class', '55,500 total'], ['~2KB per image', 'Normalized gestures']],
                color: 'var(--cyan)',
                desc: 'Full alphabet A-Z plus digits 0-9. Used as the primary training dataset — broad vocabulary coverage.',
              },
              {
                title: 'ISL CSLRT',
                badge: 'SUPPLEMENT',
                stats: [['24 classes', 'Letters A-Y'], ['1,126 samples/class', '27,024 total'], ['~600B per image', 'Skeletal/processed']],
                color: '#8b5cf6',
                desc: 'Supplementary letter dataset adds subject diversity and different capture conditions to improve per-class accuracy.',
              },
            ].map(d => (
              <div key={d.title} className="glass-card p-6" style={{ borderTop: `2px solid ${d.color}40` }}>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-syne font-bold" style={{ color: 'var(--text-primary)' }}>{d.title}</h3>
                  <span className="font-mono text-xs px-2 py-0.5 rounded"
                    style={{ background: `${d.color}15`, color: d.color, border: `1px solid ${d.color}30`, fontFamily: 'JetBrains Mono' }}>
                    {d.badge}
                  </span>
                </div>
                <p className="text-sm font-dm mb-4" style={{ color: 'var(--text-secondary)' }}>{d.desc}</p>
                <div className="space-y-2">
                  {d.stats.map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono' }}>{key}</span>
                      <span style={{ color: d.color, fontFamily: 'JetBrains Mono' }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 lg:px-12 border-t text-center" style={{ borderColor: 'var(--border)' }}>
        <p className="hud-label">Built with ♥ for AIESEC Youth Speak Ideathon 2026 • SDG 10 · Reduced Inequalities</p>
      </footer>
    </div>
  )
}
