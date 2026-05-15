import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../hooks/useSettings.jsx'
import ParticleCanvas from '../components/ParticleCanvas.jsx'
import GlitchText from '../components/GlitchText.jsx'
import { useTranslation } from '../hooks/useTranslation.js'

function CountUpStat({ value, label, color }) {
  const ref = useRef(null)
  const [started, setStarted] = useState(false)
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true) },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    const numMatch = value.match(/[\d.]+/)
    if (!numMatch) { setDisplay(value); return }
    const num = parseFloat(numMatch[0])
    const suffix = value.replace(numMatch[0], '')
    const duration = 1500
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(1, elapsed / duration)
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(num * ease)
      setDisplay(`${current}${suffix}`)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [started, value])

  return (
    <div ref={ref} className="text-center animate-slide-up">
      <div
        className="font-syne font-black mb-2"
        style={{
          color,
          fontSize: 'clamp(2rem, 8vw, 3.5rem)',
          lineHeight: 1,
        }}
      >
        {display}
      </div>
      <div className="hud-label" style={{ fontSize: 'clamp(0.55rem, 1.5vw, 0.65rem)' }}>{label}</div>
    </div>
  )
}

export default function Landing() {
  const { t } = useTranslation()
  const { settings } = useSettings()

  const taglines = [
    t('tagline_1'),
    t('tagline_2'),
  ]

  const stats = [
    { value: '63M+', label: t('stat_affected'), color: 'var(--cyan)' },
    { value: '100%', label: t('stat_free'), color: 'var(--green)' },
    { value: '0', label: t('stat_local'), color: 'var(--violet)' },
  ]

  const steps = [
    {
      icon: '◈',
      title: t('step_1_title'),
      desc: t('step_1_desc'),
      color: 'var(--cyan)',
    },
    {
      icon: '⬡',
      title: t('step_2_title'),
      desc: t('step_2_desc'),
      color: 'var(--violet)',
    },
    {
      icon: '◎',
      title: t('step_3_title'),
      desc: t('step_3_desc'),
      color: 'var(--green)',
    },
  ]

  const [typeText, setTypeText] = useState('')
  const [lineIdx, setLineIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  // Reset typewriter when language changes
  useEffect(() => {
    setTypeText('')
    setLineIdx(0)
    setCharIdx(0)
  }, [settings.uiLanguage])

  useEffect(() => {
    if (lineIdx >= taglines.length) return
    const line = taglines[lineIdx]
    if (charIdx < line.length) {
      const t = setTimeout(() => {
        setTypeText(prev => prev + line[charIdx])
        setCharIdx(c => c + 1)
      }, 38)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => {
        if (lineIdx < taglines.length - 1) {
          setTypeText(prev => prev + '\n')
          setLineIdx(l => l + 1)
          setCharIdx(0)
        }
      }, 600)
      return () => clearTimeout(t)
    }
  }, [charIdx, lineIdx])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--void)' }}>

      {/* ── HERO ─────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <ParticleCanvas />

        {/* Radial gradient */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(139,92,246,0.06) 0%, transparent 70%)' }} />

        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-12 max-w-6xl mx-auto">

          {/* SDG Badge */}
          {/* SDG Badge — Fixed overlap by moving to right and increasing spacing */}
          <div className={`flex justify-end mb-24 transition-all duration-700 ${visible ? 'animate-slide-up' : 'opacity-0'}`}>
            <div
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full"
              style={{ background: 'var(--void)', border: '1px solid var(--cyan)' }}
            >
              <span className="text-xs" style={{ color: 'var(--cyan)' }}>◉</span>
              <span
                className="font-mono font-semibold tracking-widest hidden sm:inline"
                style={{ color: 'var(--cyan)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}
              >
                SDG 3 · 4 · 8 · 10 · 17
              </span>
              <span
                className="font-mono font-semibold tracking-widest sm:hidden"
                style={{ color: 'var(--cyan)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}
              >
                SDG MULTI
              </span>
              <span
                style={{
                  background: 'var(--cyan)', color: 'var(--void)',
                  borderRadius: 4, padding: '1px 6px',
                  fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.6rem',
                }}
              >
                AIESEC 2026
              </span>
            </div>
          </div>

          {/* Main title — responsive clamp */}
          <div className={`mb-6 sm:mb-8 transition-all duration-700 delay-100 ${visible ? 'animate-slide-up' : 'opacity-0'}`}>
            <h1
              className="block tracking-tighter font-syne font-black mb-4 sm:mb-8"
              style={{
                fontSize: 'clamp(4rem, 18vw, 12rem)',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}
            >
              <GlitchText text={t('app_name_part1')} />
            </h1>
            <div className="flex items-end gap-2 sm:gap-4" style={{ marginLeft: 'clamp(0.5rem, 2vw, 3rem)' }}>
              <span
                className="block tracking-tighter font-syne font-black"
                style={{
                  fontSize: 'clamp(4rem, 18vw, 12rem)',
                  color: 'transparent',
                  WebkitTextStroke: 'clamp(1px, 0.3vw, 2px) var(--cyan)',
                  textShadow: 'var(--glow-cyan)',
                  lineHeight: 1.1,
                }}
              >
                {t('app_name_part2')}
              </span>
              <div className="mb-2 sm:mb-4 md:mb-6">
                <div
                  className="w-2 h-2 sm:w-3 sm:h-3 rounded-full mb-1"
                  style={{ background: 'var(--green)', boxShadow: '0 0 12px var(--green)' }}
                />
                <div className="hud-label" style={{ fontSize: '0.55rem' }}>ISL</div>
              </div>
            </div>
          </div>

          {/* Tagline typing */}
          <div className={`mb-8 transition-all duration-700 delay-200 ${visible ? 'animate-slide-up' : 'opacity-0'}`}>
            <p
              className="font-dm font-light max-w-xl"
              style={{
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-line',
                borderRight: lineIdx < taglines.length ? '2px solid var(--cyan)' : '2px solid transparent',
                animation: 'typing-cursor 0.75s step-end infinite',
                fontSize: 'clamp(1rem, 3vw, 1.5rem)',
              }}
            >
              <span style={{ color: 'var(--text-primary)' }}>{typeText.split('\n')[0]}</span>
              {typeText.includes('\n') && (
                <><br /><span style={{ color: 'var(--cyan)' }}>{typeText.split('\n')[1]}</span></>
              )}
            </p>
          </div>

          {/* CTA Buttons */}
          <div
            className={`flex flex-wrap gap-3 sm:gap-4 mb-10 sm:mb-16 transition-all duration-700 delay-300 ${visible ? 'animate-slide-up' : 'opacity-0'}`}
          >
            <Link
              to="/translate"
              className="btn-primary"
              style={{ padding: 'clamp(10px,2vw,14px) clamp(18px,4vw,32px)', fontSize: 'clamp(0.8rem,2vw,0.95rem)', minHeight: 48 }}
              aria-label="Start translating Indian Sign Language"
            >
              <span>↗</span> {t('btn_start_translating') || 'Start Translating'}
            </Link>
            <div className="flex gap-2 sm:gap-3 flex-wrap">
              <Link
                to="/about"
                className="btn-secondary"
                style={{ padding: 'clamp(8px,1.5vw,12px) clamp(14px,2.5vw,20px)', minHeight: 40, fontSize: '0.8rem' }}
              >
                {t('btn_how_it_works') || 'How It Works'}
              </Link>
              <Link
                to="/learn"
                className="btn-secondary"
                style={{ padding: 'clamp(8px,1.5vw,12px) clamp(14px,2.5vw,20px)', minHeight: 40, fontSize: '0.8rem' }}
              >
                📚 {t('btn_learn_isl') || 'Learn ISL'}
              </Link>
              <Link
                to="/impact"
                className="btn-secondary"
                style={{ padding: 'clamp(8px,1.5vw,12px) clamp(14px,2.5vw,20px)', minHeight: 40, fontSize: '0.8rem' }}
              >
                🌍 {t('nav_impact') || 'Impact'}
              </Link>
              <Link
                to="/dictionary"
                className="btn-secondary"
                style={{ padding: 'clamp(8px,1.5vw,12px) clamp(14px,2.5vw,20px)', minHeight: 40, fontSize: '0.8rem' }}
              >
                📖 {t('nav_dictionary') || 'Dictionary'}
              </Link>
            </div>
          </div>

          {/* Two preview cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-3xl">
            {/* Sign → Speech */}
            <div
              className="glass-card p-4 sm:p-5 animate-float"
              style={{ animationDuration: '3.5s' }}
            >
              <div className="scan-line" />
              <div className="panel-title mb-3">Sign → Speech</div>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}
                >
                  <span style={{ color: 'var(--cyan)', fontSize: '1.3rem' }}>✋</span>
                </div>
                <div>
                  <div className="font-syne font-black text-glow-green" style={{ fontSize: 'clamp(1.2rem,4vw,1.8rem)' }}>HELLO</div>
                  <div className="hud-label mt-1">97% confidence</div>
                </div>
              </div>
              <div className="confidence-bar-track mt-3">
                <div className="confidence-bar-fill high" style={{ width: '97%' }} />
              </div>
            </div>

            {/* Speech → Sign */}
            <div
              className="glass-card p-4 sm:p-5 animate-float"
              style={{ animationDelay: '0.5s', animationDuration: '4s' }}
            >
              <div className="panel-title mb-3">Speech → Sign</div>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center relative shrink-0"
                  style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)' }}
                >
                  <span style={{ fontSize: '1.1rem' }}>🎤</span>
                  <div className="absolute inset-0 rounded-full"
                    style={{ border: '1px solid rgba(139,92,246,0.3)', animation: 'pulse-ring 2s ease-out infinite' }} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-dm truncate" style={{ color: 'var(--text-primary)' }}>"Thank you very much"</div>
                  <div className="hud-label mt-1">Live transcript</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {['THANK', 'YOU', 'VERY', 'MUCH'].map((w, i) => (
                  <span key={w} className={`word-chip ${i === 0 ? 'active' : ''}`} style={{ fontSize: '0.7rem', padding: '3px 8px' }}>{w}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce-y">
          <div className="hud-label" style={{ fontSize: '0.55rem' }}>Scroll</div>
          <div className="w-px h-6 sm:h-8" style={{ background: 'linear-gradient(to bottom, var(--cyan), transparent)' }} />
        </div>
      </section>

      {/* ── STATS ─────────────────── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-12" style={{ background: 'var(--obsidian)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-4 sm:gap-8">
            {stats.map(s => <CountUpStat key={s.label} {...s} />)}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 relative overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <div className="hud-label mb-3 sm:mb-4">System Overview</div>
            <h2
              className="font-syne font-black"
              style={{ fontSize: 'clamp(1.8rem, 6vw, 3.5rem)', color: 'var(--text-primary)' }}
            >
              {t('btn_how_it_works') || 'How It Works'}
            </h2>
            <p className="mt-3 sm:mt-4 font-dm max-w-xl mx-auto px-4" style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>
              Three steps from hand to voice — all running locally in your browser.
            </p>
          </div>

          <div className="relative">
            {/* Connecting line — hidden on mobile */}
            <div
              className="absolute top-14 left-16 right-16 h-px hidden md:block"
              style={{ background: 'linear-gradient(90deg, var(--cyan)22, var(--violet)66, var(--green)22)' }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className="glass-card p-5 sm:p-6 text-center hover:scale-105 transition-transform duration-300"
                  style={{ borderTop: `2px solid ${step.color}40` }}
                >
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full mx-auto mb-4 sm:mb-5 flex items-center justify-center"
                    style={{
                      background: `${step.color}10`,
                      border: `1px solid ${step.color}40`,
                      boxShadow: `0 0 20px ${step.color}20`,
                      color: step.color,
                      fontSize: '1.4rem',
                    }}
                  >
                    {step.icon}
                  </div>
                  <h3 className="font-syne font-bold mb-2 sm:mb-3" style={{ color: 'var(--text-primary)', fontSize: 'clamp(0.95rem, 2vw, 1.1rem)' }}>
                    {step.title}
                  </h3>
                  <p className="font-dm leading-relaxed" style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.8rem, 1.5vw, 0.875rem)' }}>
                    {step.desc}
                  </p>
                  <div className="mt-3 sm:mt-4 hud-label" style={{ color: step.color }}>Step {i + 1}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── DEMO VIDEO ─────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 relative overflow-hidden" style={{ background: 'var(--void)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <div className="hud-label mb-3 sm:mb-4">See LexiSight in Action</div>
            <h2
              className="font-syne font-black"
              style={{ fontSize: 'clamp(1.8rem, 6vw, 3.5rem)', color: 'var(--text-primary)' }}
            >
              90-Second Demo
            </h2>
          </div>
          
          <div className="relative aspect-video rounded-2xl overflow-hidden glass-card flex items-center justify-center" style={{ border: '1px solid rgba(0,212,255,0.3)', boxShadow: '0 0 40px rgba(0,212,255,0.1)' }}>
            <div className="absolute inset-0 bg-[var(--surface)] flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 cursor-pointer hover:scale-110 transition-transform" style={{ background: 'var(--cyan)', color: 'var(--void)' }}>
                <span style={{ fontSize: '24px', marginLeft: '4px' }}>▶</span>
              </div>
              <p className="font-syne text-[var(--text-primary)] font-bold text-lg">LexiSight Platform Demo</p>
              <p className="hud-label mt-2">Coming Soon</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ─────────────────── */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-12" style={{ background: 'var(--obsidian)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <div
            className="inline-block mb-4 sm:mb-6 px-3 sm:px-4 py-2 rounded-full font-mono text-xs tracking-widest"
            style={{
              background: 'rgba(0,255,136,0.06)',
              border: '1px solid rgba(0,255,136,0.2)',
              color: 'var(--green)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 'clamp(0.55rem, 1.5vw, 0.7rem)',
            }}
          >
            ◉ READY TO TRANSLATE
          </div>
          <h2
            className="font-syne font-black mb-5 sm:mb-6"
            style={{ fontSize: 'clamp(1.8rem, 6vw, 3.5rem)', color: 'var(--text-primary)' }}
          >
            Break the silence.<br />
            <span style={{ color: 'var(--cyan)' }}>Start now.</span>
          </h2>
          <Link
            to="/translate"
            className="btn-primary inline-flex"
            style={{
              padding: 'clamp(12px,2vw,16px) clamp(24px,5vw,40px)',
              fontSize: 'clamp(0.85rem,2vw,1rem)',
              minHeight: 52,
            }}
            aria-label="Open LexiSight translator"
          >
            {t('nav_translate') || 'Open Translator'}
          </Link>
        </div>
      </section>

      {/* ── FOOTER ─────────────────── */}
      <footer className="py-8 sm:py-10 px-4 sm:px-6 lg:px-12 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <span className="font-syne font-bold text-base sm:text-lg" style={{ color: 'var(--text-primary)' }}>LexiSight</span>
            <span className="hud-label hidden sm:inline">Built for AIESEC Youth Speak Ideathon 2026</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6 flex-wrap justify-center">
            <span className="hud-label">Zero server • Zero cost • Works offline</span>
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)' }}
            >
              <span style={{ color: 'var(--cyan)', fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace' }}>SDG 3,4,8,10,17</span>
            </div>
            <Link to="/community" style={{ color: 'var(--violet)', fontSize: '0.75rem', fontFamily: 'DM Sans, sans-serif', textDecoration: 'none' }}>
              Gesture Bank
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
