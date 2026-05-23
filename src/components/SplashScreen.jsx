import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation.js'

/* ═══════════════════════════════════════════════════════════════════
   SplashScreen — "Silence Ends Here" zooms through the screen,
   letters blast past the viewport revealing the home page beneath.
   No fade. Just pure kinetic zoom-through.
   ═══════════════════════════════════════════════════════════════════ */

const LEFT_LINES = [
  "// YOU'RE ABOUT TO BRIDGE THE SILENCE...",
  '// INITIALIZING NEURAL INTERFACE...',
  '// DECRYPTING HAND PATTERNS...',
  '// SYNCHRONIZING REAL-TIME AI...',
  '// TRANSMITTING SIGN SIGNALS...',
  '// UNLOCKING GESTURE DIMENSIONS...',
  '// CALIBRATING SIGN MODELS...',
  '// LOADING ISL DATASET...',
]

const RIGHT_FULL =
  '// HANG TIGHT. THE AI MODELS ARE LOADING. THE SIGN INTELLIGENCE IS WORTH THE WAIT...'

const SIGN_LANGUAGE_FACTS = [
  {
    emoji: '🙏',
    sign: 'Namaste',
    description: 'Hands together with slight bow',
    meaning: 'Traditional Indian greeting and respect',
    page: '/translate'
  },
  {
    emoji: '🤟',
    sign: 'I Love You',
    description: 'Combined gesture in ISL context',
    meaning: 'Universal expression of affection',
    page: '/translate'
  },
  {
    emoji: '👍',
    sign: 'Accha/Badhiya',
    description: 'Thumbs up gesture',
    meaning: 'Good/Excellent in Indian context',
    page: '/learn'
  },
  {
    emoji: '🙏',
    sign: 'Dhanyavad',
    description: 'Hands together in gratitude',
    meaning: 'Thank you in Hindi/Sanskrit',
    page: '/dictionary'
  },
  {
    emoji: '🤝',
    sign: 'Milaap',
    description: 'Handshake or joined hands',
    meaning: 'Unity and connection in Indian culture',
    page: '/community'
  },
  {
    emoji: '✌️',
    sign: 'Shanti',
    description: 'Peace sign with two fingers',
    meaning: 'Peace and harmony in Sanskrit',
    page: '/impact'
  },
  {
    emoji: '👋',
    sign: 'Pranam',
    description: 'Raised hand with fingers together',
    meaning: 'Respectful greeting in Indian tradition',
    page: '/learn'
  },
  {
    emoji: '🤙',
    sign: 'Aao/Bulao',
    description: 'Call me gesture with thumb and pinky',
    meaning: 'Come/Call in Hindi context',
    page: '/settings'
  }
]

const LINE_HEIGHT = 33
const MIN_LOADING_TIME = 1000

export default function SplashScreen({ onFinished }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState('terminal') // terminal → silence → done

  const LEFT_LINES_LOCAL = [
    `// ${t('splash_line_1')}`,
    `// ${t('splash_line_2')}`,
    `// ${t('splash_line_3')}`,
    `// ${t('splash_line_4')}`,
    '// CALIBRATING SIGN MODELS...',
    '// ACCESSING GESTURE LAYERS...',
  ]
  const RIGHT_FULL_LOCAL = `// ${t('splash_loading_text')}`
  const [activeIdx, setActiveIdx] = useState(-1)
  const [rightText, setRightText] = useState('')
  const [silenceGrow, setSilenceGrow] = useState(false)
  const [bgTransparent, setBgTransparent] = useState(false)
  const [textOutline, setTextOutline] = useState(false)
  const [currentFact, setCurrentFact] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isDone, setIsDone] = useState(false)

  const navigate = useNavigate()
  const [startTime] = useState(Date.now())

  const leftRef = useRef(null)
  const timerRefs = useRef([])
  const progressIntervalRef = useRef(null)

  const addTimer = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms)
    timerRefs.current.push(id)
    return id
  }, [])

  useEffect(() => {
    return () => {
      timerRefs.current.forEach(clearTimeout)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [])

  /* ── Phase 1: Terminal highlight sequence ── */
  useEffect(() => {
    if (phase !== 'terminal') return
    const interval = setInterval(() => {
      setActiveIdx(i => {
        if (i < LEFT_LINES_LOCAL.length - 1) return i + 1
        clearInterval(interval)
        return i
      })
    }, 520)
    
    addTimer(() => setPhase('silence'), 300 + (LEFT_LINES_LOCAL.length * 520))

    // Progress bar
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        const target = 100
        return prev < target ? prev + 2 : target
      })
    }, 50)
    timerRefs.current.push(progressInterval)

    // Cycle sign facts
    const factInterval = setInterval(() => {
      setCurrentFact(prev => (prev + 1) % SIGN_LANGUAGE_FACTS.length)
    }, 2000)
    timerRefs.current.push(factInterval)

    return () => clearInterval(interval)
  }, [phase, addTimer, LEFT_LINES_LOCAL.length])

  // Right terminal typewrite
  useEffect(() => {
    if (phase !== 'terminal') return
    let i = 0
    const interval = setInterval(() => {
      setRightText(RIGHT_FULL_LOCAL.slice(0, i))
      i++
      if (i > RIGHT_FULL_LOCAL.length) clearInterval(interval)
    }, 30)
    return () => clearInterval(interval)
  }, [phase, RIGHT_FULL_LOCAL])

  /* ── Phase 2: Zoom-through reveal ── */
  useEffect(() => {
    if (phase !== 'silence') return

    setSilenceGrow(true)

    addTimer(() => {
      setBgTransparent(true)
    }, 1000)

    addTimer(() => {
      setTextOutline(true)
    }, 1120)

    addTimer(() => {
      setIsDone(true)
      onFinished?.()
    }, 3800)
  }, [phase, addTimer, onFinished])

  if (isDone) return null

  const scrollOffset = Math.max(0, activeIdx - 2) * LINE_HEIGHT

  return (
    <>
      <style>{`
        @keyframes splash-zoom-blast {
          0%   { transform: scale(0.001); opacity: 1; }
          18%  { transform: scale(0.9);   opacity: 1; }
          30%  { transform: scale(1.05);  opacity: 1; }
          45%  { transform: scale(1.1);   opacity: 1; }
          100% { transform: scale(120);   opacity: 1; }
        }

        @keyframes bounce-y {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-6px); }
        }

        @keyframes pulse-ring {
          0%   { filter: drop-shadow(0 0 4px rgba(255,255,255,0.2)); }
          50%  { filter: drop-shadow(0 0 14px rgba(255,255,255,0.5)); }
          100% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.2)); }
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          pointerEvents: phase === 'silence' && bgTransparent ? 'none' : 'auto',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--splash-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Courier New', monospace",
            opacity: phase === 'terminal' ? 1 : 0,
            transition: 'opacity 0.35s ease',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '7%',
              top: '50%',
              transform: 'translateY(-50%)',
              height: 200,
              overflow: 'hidden',
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
            }}
          >
            <div
              ref={leftRef}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 11,
                transition: 'transform 0.5s ease',
                transform: `translateY(-${scrollOffset}px)`,
              }}
            >
              {LEFT_LINES_LOCAL.map((text, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    letterSpacing: '0.13em',
                    whiteSpace: 'nowrap',
                    padding: i === activeIdx ? '2px 8px' : '2px 0',
                    color: i === activeIdx ? 'var(--splash-text)' : 'var(--text-secondary)',
                    background: i === activeIdx ? 'var(--glass-border)' : 'transparent',
                    borderRadius: i === activeIdx ? 2 : 0,
                    marginLeft: i === activeIdx ? -8 : 0,
                    transition: 'all 0.25s ease',
                  }}
                >
                  {text}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              right: '6%',
              top: '50%',
              transform: 'translateY(-50%)',
              textAlign: 'right',
              maxWidth: 210,
              fontSize: 10,
              letterSpacing: '0.09em',
              color: 'var(--text-secondary)',
              lineHeight: 1.85,
            }}
          >
            {rightText}
          </div>

          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'var(--border)' }}>
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
                borderRadius: 2,
                transition: 'width 0.4s ease',
                width: `${loadingProgress}%`,
                boxShadow: '0 0 10px rgba(139, 92, 246, 0.5)',
              }}
            />
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 30,
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              color: 'var(--splash-text)',
              fontSize: 10,
              fontFamily: "'Courier New', monospace",
              letterSpacing: '0.1em',
              maxWidth: 320,
              opacity: phase === 'terminal' ? 1 : 0,
              transition: 'opacity 0.3s ease',
              cursor: 'pointer',
            }}
            onClick={() => {
              const fact = SIGN_LANGUAGE_FACTS[currentFact]
              if (fact.page) navigate(fact.page)
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12, animation: 'bounce-y 1.2s ease-in-out infinite, pulse-ring 2s ease-out infinite' }}>
              {SIGN_LANGUAGE_FACTS[currentFact].emoji}
            </div>
            <div style={{ fontWeight: 'bold', color: 'var(--splash-text)', marginBottom: 6, fontSize: 12, animation: 'fade-in 0.5s ease-out' }}>
              {SIGN_LANGUAGE_FACTS[currentFact].sign}
            </div>
            <div style={{ fontSize: 9, marginBottom: 4, opacity: 0.9 }}>
              {SIGN_LANGUAGE_FACTS[currentFact].description}
            </div>
            <div style={{ fontSize: 8, fontStyle: 'italic', opacity: 0.7, marginBottom: 8 }}>
              "{SIGN_LANGUAGE_FACTS[currentFact].meaning}"
            </div>
            <div style={{ fontSize: 7, opacity: 0.6, textAlign: 'center', fontStyle: 'italic', animation: 'fade-in 0.8s ease-out' }}>
              Click to explore • {currentFact + 1}/{SIGN_LANGUAGE_FACTS.length}
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Background punches out to transparent so home page shows through gaps
            background: bgTransparent ? 'transparent' : 'var(--splash-bg-end)',
            transition: 'background 0.18s ease',
            opacity: phase === 'silence' ? 1 : 0,
            pointerEvents: phase === 'silence' ? 'auto' : 'none',
            // Only transition opacity on entry, not during zoom
            ...(phase !== 'silence' && { transition: 'opacity 0.3s ease' }),
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontWeight: 900,
              fontStyle: 'italic',
              whiteSpace: 'nowrap',
              lineHeight: 1,
              userSelect: 'none',

              // When bg is transparent, switch to outline so home page shows THROUGH letters
              color: textOutline ? 'transparent' : 'var(--splash-text)',
              WebkitTextStroke: textOutline ? '3px var(--splash-text)' : '0px transparent',
              transition: 'color 0.12s ease, -webkit-text-stroke 0.12s ease',

              // Responsive font size — fills ~80% of viewport width
              fontSize: 'clamp(2rem, 9vw, 8rem)',

              // The blast: starts as a tiny dot, fills screen, rockets past it
              animation: silenceGrow
                ? 'splash-zoom-blast 3.6s cubic-bezier(0.22, 1, 0.36, 1) forwards'
                : 'none',
            }}
          >
            Silence Ends Here
          </div>
        </div>
      </div>
    </>
  )
}