import { useEffect, useState } from 'react'

/**
 * OnboardingModal
 * First-time user tutorial — 4 animated slides
 * Persists via localStorage flag 'lxi_onboarded'
 */

const SLIDES = [
  {
    icon: '🤟',
    title: 'Welcome to LexiSight',
    subtitle: 'SDG 10 · Reduced Inequalities',
    body: '63 million deaf and hard-of-hearing Indians face daily communication barriers. LexiSight is a free, offline AI translator — no servers, no cost, no barriers.',
    color: '#00d4ff',
    cta: 'Get Started →',
  },
  {
    icon: '✋',
    title: 'Sign → Speech',
    subtitle: 'Step 1: Enable your camera',
    body: 'Show an ISL hand gesture to the camera. The AI reads 21 hand landmarks in real-time and recognizes your sign — then speaks it out in Indian English.',
    color: '#00ff88',
    cta: 'Next →',
  },
  {
    icon: '🎤',
    title: 'Speech → Sign',
    subtitle: 'Step 2: Speak into mic',
    body: 'Tap the microphone, say any word. An animated hand avatar will sign it back to you in ISL — perfect for learning and communicating.',
    color: '#8b5cf6',
    cta: 'Next →',
  },
  {
    icon: '📚',
    title: 'Learn & Explore',
    subtitle: 'Courses, Dictionary, Impact',
    body: 'Learn ISL with interactive courses, browse the visual dictionary, earn XP, and see the real-world impact you\'re part of. 100% free, always.',
    color: '#ffaa00',
    cta: 'Start Translating ↗',
  },
]

export default function OnboardingModal() {
  const [visible, setVisible] = useState(false)
  const [slide, setSlide] = useState(0)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem('lxi_onboarded')
    if (!done) {
      setTimeout(() => setVisible(true), 800)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem('lxi_onboarded', '1')
    setVisible(false)
  }

  const next = () => {
    if (slide === SLIDES.length - 1) { dismiss(); return }
    setAnimating(true)
    setTimeout(() => { setSlide(s => s + 1); setAnimating(false) }, 200)
  }

  if (!visible) return null

  const s = SLIDES[slide]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(2,4,8,0.92)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        animation: 'fade-in 0.4s ease',
      }}
      onClick={e => e.target === e.currentTarget && dismiss()}
    >
      <div
        style={{
          background: '#080d14',
          border: `1px solid ${s.color}30`,
          borderRadius: 20,
          maxWidth: 440,
          width: '100%',
          padding: '2rem',
          boxShadow: `0 0 80px ${s.color}15`,
          transform: animating ? 'scale(0.97)' : 'scale(1)',
          opacity: animating ? 0 : 1,
          transition: 'transform 0.2s, opacity 0.2s',
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: '1.5rem' }}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              onClick={() => setSlide(i)}
              style={{
                flex: i === slide ? 3 : 1,
                height: 3,
                borderRadius: 2,
                background: i === slide ? s.color : '#1a2535',
                transition: 'flex 0.3s, background 0.3s',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: `${s.color}12`,
          border: `1px solid ${s.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.8rem', marginBottom: '1rem',
          boxShadow: `0 0 20px ${s.color}20`,
        }}>
          {s.icon}
        </div>

        {/* SDG badge */}
        <div style={{
          display: 'inline-block',
          fontSize: '0.6rem', letterSpacing: '0.15em',
          fontFamily: 'JetBrains Mono, monospace',
          color: s.color, background: `${s.color}10`,
          border: `1px solid ${s.color}25`,
          borderRadius: 20, padding: '2px 10px',
          marginBottom: '0.75rem', textTransform: 'uppercase',
        }}>
          {s.subtitle}
        </div>

        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: '#e8f4fd', marginBottom: '0.75rem' }}>
          {s.title}
        </h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.9rem', color: '#6b8ba4', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {s.body}
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={dismiss}
            style={{ background: 'transparent', border: 'none', color: '#1a2535', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: '4px 8px' }}
          >
            Skip
          </button>
          <button
            onClick={next}
            style={{
              background: `linear-gradient(135deg, ${s.color}20, ${s.color}10)`,
              border: `1px solid ${s.color}40`,
              borderRadius: 8, color: s.color,
              fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
              fontSize: '0.9rem', padding: '10px 24px', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {s.cta}
          </button>
        </div>
      </div>
    </div>
  )
}
