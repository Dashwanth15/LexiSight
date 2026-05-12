import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/* ═══════════════════════════════════════════════════════════════════
   SplashScreen — Enhanced "Silence Ends Here" with Sign Language Learning
   Converted from lexisight_silence_v11.html with sign language facts and dynamic loading.
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
    emoji: '🤟',
    sign: 'I Love You',
    description: 'Combines I, L, and Y signs from American Sign Language',
    meaning: 'Universal gesture of affection and care',
    page: '/translate'
  },
  {
    emoji: '👋',
    sign: 'Hello/Goodbye',
    description: 'Open palm with side-to-side motion',
    meaning: 'Universal greeting across many sign languages',
    page: '/translate'
  },
  {
    emoji: '👍',
    sign: 'Good/Great',
    description: 'Upward thumb with other fingers folded',
    meaning: 'Positive affirmation and approval',
    page: '/learn'
  },
  {
    emoji: '🙏',
    sign: 'Thank You',
    description: 'Flat hands brought together in front of chest',
    meaning: 'Expression of gratitude and appreciation',
    page: '/dictionary'
  },
  {
    emoji: '🤝',
    sign: 'Agreement/Friendship',
    description: 'Interlocked hands or grasped gesture',
    meaning: 'Connection and mutual understanding',
    page: '/community'
  },
  {
    emoji: '📚',
    sign: 'Learning',
    description: 'Open book with signing hands',
    meaning: 'Knowledge acquisition and education',
    page: '/learn'
  },
  {
    emoji: '🎯',
    sign: 'Impact',
    description: 'Target with sign language symbols',
    meaning: 'Making difference in deaf community',
    page: '/impact'
  },
  {
    emoji: '⚙️',
    sign: 'Settings',
    description: 'Gear with accessibility symbols',
    meaning: 'Customize your LexiSight experience',
    page: '/settings'
  }
]

const LINE_HEIGHT = 33 // px per line for scrolling
const MIN_LOADING_TIME = 800 // minimum loading time in ms
const MAX_LOADING_TIME = 3000 // maximum loading time in ms

export default function SplashScreen({ onFinished }) {
  const [phase, setPhase] = useState('terminal') // terminal → silence → logo → done
  const [activeIdx, setActiveIdx] = useState(-1)
  const [rightText, setRightText] = useState('')
  const [silenceGrow, setSilenceGrow] = useState(false)
  const [showLogo, setShowLogo] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const [currentFact, setCurrentFact] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)
  
  const navigate = useNavigate()
  const [startTime] = useState(Date.now())
  const [actualLoadingTime, setActualLoadingTime] = useState(MIN_LOADING_TIME)

  const leftRef = useRef(null)
  const rightIdxRef = useRef(0)
  const timerRefs = useRef([])
  const progressIntervalRef = useRef(null)

  // Cleanup helper
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
        // All lines done → calculate loading time and trigger silence
        const elapsed = Date.now() - startTime
        const remainingTime = Math.max(
          MIN_LOADING_TIME - elapsed,
          Math.random() * (MAX_LOADING_TIME - MIN_LOADING_TIME)
        )
        setActualLoadingTime(remainingTime)
        addTimer(() => setPhase('silence'), Math.max(300, remainingTime / 4))
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

    // Progress bar animation
    progressIntervalRef.current = setInterval(() => {
      setLoadingProgress(prev => {
        const targetProgress = ((idx + 1) / LEFT_LINES.length) * 100
        return prev < targetProgress ? prev + 2 : targetProgress
      })
    }, 50)

    // Cycle through sign language facts
    const factInterval = setInterval(() => {
      setCurrentFact(prev => (prev + 1) % SIGN_LANGUAGE_FACTS.length)
    }, 2000)

    timerRefs.current.push(
      setTimeout(() => clearInterval(factInterval), actualLoadingTime)
    )
  }, [addTimer, startTime, actualLoadingTime])

  /* ── Phase 2: "Silence Ends Here" grow ── */
  useEffect(() => {
    if (phase !== 'silence') return
    setSilenceGrow(true)
    addTimer(() => setShowLogo(true), 1300)
    addTimer(() => setPhase('logo'), 1400)
  }, [phase, addTimer])

  /* ── Phase 3: Logo reveal, then fade out ── */
  useEffect(() => {
    if (phase !== 'logo') return
    const remainingTime = Math.max(800, actualLoadingTime - (Date.now() - startTime))
    addTimer(() => {
      setFadeOut(true)
      addTimer(() => onFinished?.(), 600)
    }, remainingTime)
  }, [phase, addTimer, onFinished, actualLoadingTime, startTime])

  // Scroll the left column as highlight advances
  const scrollOffset = Math.max(0, activeIdx - 2) * LINE_HEIGHT

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        transition: 'opacity 0.5s ease',
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? 'none' : 'auto',
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

        {/* Right typewriter text */}
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

        {/* Decorative corner markers */}
        <div style={{ position: 'absolute', top: 24, left: 24, width: 18, height: 18, borderTop: '2px solid rgba(255,255,255,0.15)', borderLeft: '2px solid rgba(255,255,255,0.15)' }} />
        <div style={{ position: 'absolute', top: 24, right: 24, width: 18, height: 18, borderTop: '2px solid rgba(255,255,255,0.15)', borderRight: '2px solid rgba(255,255,255,0.15)' }} />
        <div style={{ position: 'absolute', bottom: 24, left: 24, width: 18, height: 18, borderBottom: '2px solid rgba(255,255,255,0.15)', borderLeft: '2px solid rgba(255,255,255,0.15)' }} />
        <div style={{ position: 'absolute', bottom: 24, right: 24, width: 18, height: 18, borderBottom: '2px solid rgba(255,255,255,0.15)', borderRight: '2px solid rgba(255,255,255,0.15)' }} />

        {/* Bottom progress bar */}
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

        {/* Sign Language Learning Section */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 10,
            fontFamily: "'Courier New', monospace",
            letterSpacing: '0.1em',
            maxWidth: 280,
            opacity: phase === 'terminal' ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          <div 
            style={{ 
              fontSize: 24, 
              marginBottom: 8, 
              animation: 'bounce-y 1.5s ease-in-out infinite',
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            }}
            onClick={() => {
              const fact = SIGN_LANGUAGE_FACTS[currentFact]
              if (fact.page) {
                navigate(fact.page)
              }
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            {SIGN_LANGUAGE_FACTS[currentFact].emoji}
          </div>
          <div 
            style={{ 
              fontWeight: 'bold', 
              color: '#fff', 
              marginBottom: 4,
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            }}
            onClick={() => {
              const fact = SIGN_LANGUAGE_FACTS[currentFact]
              if (fact.page) {
                navigate(fact.page)
              }
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            {SIGN_LANGUAGE_FACTS[currentFact].sign}
          </div>
          <div 
            style={{ 
              fontSize: 9, 
              marginBottom: 2,
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            }}
            onClick={() => {
              const fact = SIGN_LANGUAGE_FACTS[currentFact]
              if (fact.page) {
                navigate(fact.page)
              }
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            {SIGN_LANGUAGE_FACTS[currentFact].description}
          </div>
          <div 
            style={{ 
              fontSize: 8, 
              fontStyle: 'italic', 
              opacity: 0.7,
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            }}
            onClick={() => {
              const fact = SIGN_LANGUAGE_FACTS[currentFact]
              if (fact.page) {
                navigate(fact.page)
              }
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            {SIGN_LANGUAGE_FACTS[currentFact].meaning}
          </div>
          <div style={{
            fontSize: 7,
            marginTop: 8,
            opacity: 0.6,
            textAlign: 'center',
            fontStyle: 'italic'
          }}>
            Click to explore {SIGN_LANGUAGE_FACTS[currentFact].sign.toLowerCase()}
          </div>
        </div>
      </div>

      {/* ── Silence Phase ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d0d0d',
          opacity: phase === 'silence' || phase === 'logo' ? 1 : 0,
          pointerEvents: phase === 'silence' || phase === 'logo' ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      >
        {/* Growing text */}
        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 900,
            fontStyle: 'italic',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            lineHeight: 1,
            overflow: 'visible',
            animation: silenceGrow
              ? 'splash-grow-font 1.6s cubic-bezier(0.4, 0, 1, 1) forwards'
              : 'none',
            fontSize: silenceGrow ? undefined : '4px',
            opacity: showLogo ? 0 : undefined,
            transition: showLogo ? 'opacity 0.3s ease' : 'none',
          }}
        >
          Silence Ends Here
        </div>

        {/* Logo reveal */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: showLogo ? 1 : 0,
            transition: 'opacity 0.5s ease',
            background: '#0a0a0f',
          }}
        >
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(36px, 8vw, 64px)',
              fontWeight: 900,
              fontStyle: 'italic',
              color: '#fff',
            }}
          >
            Lexi<span style={{ color: '#8b5cf6' }}>Sight</span>
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 11,
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.35)',
              fontFamily: "'Courier New', monospace",
              textTransform: 'uppercase',
            }}
          >
            Bridging Silence Through AI
          </div>

          {/* Subtle loading dots */}
          <div style={{ marginTop: 32, display: 'flex', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: '#8b5cf6',
                  animation: `splash-dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
