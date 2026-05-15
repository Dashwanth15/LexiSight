import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

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
  const [phase, setPhase] = useState('terminal') // terminal → silence → done
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
    let idx = 0
    function advance() {
      if (idx < LEFT_LINES.length) {
        setActiveIdx(idx)
        idx++
        addTimer(advance, 520)
      } else {
        addTimer(() => setPhase('silence'), 300)
      }
    }
    addTimer(advance, 400)

    // Right-side typewriter
    let rIdx = 0
    function typeRight() {
      if (rIdx <= RIGHT_FULL.length) {
        setRightText(RIGHT_FULL.slice(0, rIdx))
        rIdx++
        addTimer(typeRight, 28)
      }
    }
    addTimer(typeRight, 500)

    // Progress bar
    progressIntervalRef.current = setInterval(() => {
      setLoadingProgress(prev => {
        const target = ((idx + 1) / LEFT_LINES.length) * 100
        return prev < target ? prev + 2 : target
      })
    }, 50)

    // Cycle sign facts
    const factInterval = setInterval(() => {
      setCurrentFact(prev => (prev + 1) % SIGN_LANGUAGE_FACTS.length)
    }, 2000)
    timerRefs.current.push(
      setTimeout(() => clearInterval(factInterval), MIN_LOADING_TIME + 4000)
    )
  }, [addTimer])

  /* ── Phase 2: Zoom-through reveal ── */
  useEffect(() => {
    if (phase !== 'silence') return

    // 1. Start zoom animation
    setSilenceGrow(true)

    // 2. At ~1s the text fills the screen — punch the bg out to transparent
    //    so the home page is visible through letter gaps
    addTimer(() => {
      setBgTransparent(true)
    }, 1000)

    // 3. Slightly after, switch to outline text so the home page shows THROUGH letters
    addTimer(() => {
      setTextOutline(true)
    }, 1120)

    // 4. After the zoom animation finishes, unmount the splash entirely
    addTimer(() => {
      setIsDone(true)
      onFinished?.()
    }, 3800)
  }, [phase, addTimer, onFinished])

  if (isDone) return null

  const scrollOffset = Math.max(0, activeIdx - 2) * LINE_HEIGHT

  return (
    <>
      {/* ── Keyframe injections ── */}
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
        {/* ── Terminal Phase ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#4B3BCE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Courier New', monospace",
            opacity: phase === 'terminal' ? 1 : 0,
            transition: 'opacity 0.35s ease',
            overflow: 'hidden',
          }}
        >
          {/* Left scrolling lines */}
          <div
            style={{
              position: 'absolute',
              left: '7%',
              top: '50%',
              transform: 'translateY(-50%)',
              height: 200,
              overflow: 'hidden',
              maskImage:
                'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
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
              {LEFT_LINES.map((text, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    letterSpacing: '0.13em',
                    whiteSpace: 'nowrap',
                    padding: i === activeIdx ? '2px 8px' : '2px 0',
                    color: i === activeIdx ? '#fff' : 'rgba(255,255,255,0.35)',
                    background:
                      i === activeIdx ? 'rgba(255,255,255,0.18)' : 'transparent',
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

          {/* Right typewriter */}
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
              color: 'rgba(255,255,255,0.25)',
              lineHeight: 1.85,
            }}
          >
            {rightText}
          </div>

          {/* Corner markers */}
          <div style={{ position: 'absolute', top: 24, left: 24, width: 18, height: 18, borderTop: '2px solid rgba(255,255,255,0.15)', borderLeft: '2px solid rgba(255,255,255,0.15)' }} />
          <div style={{ position: 'absolute', top: 24, right: 24, width: 18, height: 18, borderTop: '2px solid rgba(255,255,255,0.15)', borderRight: '2px solid rgba(255,255,255,0.15)' }} />
          <div style={{ position: 'absolute', bottom: 24, left: 24, width: 18, height: 18, borderBottom: '2px solid rgba(255,255,255,0.15)', borderLeft: '2px solid rgba(255,255,255,0.15)' }} />
          <div style={{ position: 'absolute', bottom: 24, right: 24, width: 18, height: 18, borderBottom: '2px solid rgba(255,255,255,0.15)', borderRight: '2px solid rgba(255,255,255,0.15)' }} />

          {/* Progress bar */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.08)' }}>
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

          {/* Sign language facts */}
          <div
            style={{
              position: 'absolute',
              bottom: 30,
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.7)',
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
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)'
              e.currentTarget.style.filter = 'brightness(1.2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateX(-50%) scale(1)'
              e.currentTarget.style.filter = 'brightness(1)'
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12, animation: 'bounce-y 1.2s ease-in-out infinite, pulse-ring 2s ease-out infinite', cursor: 'pointer', transition: 'all 0.3s ease' }}>
              {SIGN_LANGUAGE_FACTS[currentFact].emoji}
            </div>
            <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: 6, fontSize: 12, textShadow: '0 0 8px rgba(255,255,255,0.5)', animation: 'fade-in 0.5s ease-out' }}>
              {SIGN_LANGUAGE_FACTS[currentFact].sign}
            </div>
            <div style={{ fontSize: 9, marginBottom: 4, opacity: 0.9, lineHeight: 1.4 }}>
              {SIGN_LANGUAGE_FACTS[currentFact].description}
            </div>
            <div style={{ fontSize: 8, fontStyle: 'italic', opacity: 0.7, marginBottom: 8 }}>
              "{SIGN_LANGUAGE_FACTS[currentFact].meaning}"
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
              {SIGN_LANGUAGE_FACTS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 4, height: 4,
                    borderRadius: '50%',
                    background: i === currentFact ? '#fff' : 'rgba(255,255,255,0.3)',
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 7, opacity: 0.6, textAlign: 'center', fontStyle: 'italic', animation: 'fade-in 0.8s ease-out' }}>
              Click to explore • {currentFact + 1}/{SIGN_LANGUAGE_FACTS.length}
            </div>
          </div>
        </div>

        {/* ── Silence / Zoom-through Phase ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Background punches out to transparent so home page shows through gaps
            background: bgTransparent ? 'transparent' : '#0d0d0d',
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
              color: textOutline ? 'transparent' : '#ffffff',
              WebkitTextStroke: textOutline ? '3px #ffffff' : '0px transparent',
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