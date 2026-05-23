import { useState, useEffect, useRef } from 'react'

/* ═══════════════════════════════════════════════════════════════════
   PageLoader — Mini terminal animation for lazy-loaded page transitions.
   A faster, compact version of the "Silence Ends Here" splash,
   designed to play in ~2s while React loads the next chunk.
   ═══════════════════════════════════════════════════════════════════ */

const LINES = [
  '// ROUTING NEURAL PATHWAYS...',
  '// LOADING SIGN MODULE...',
  '// DECODING GESTURES...',
  '// BRIDGING COMMUNICATION...',
  '// ACTIVATING AI MODELS...',
  '// SYNCING INTERFACE...',
  '// RENDERING COMPONENTS...',
]

const RIGHT_TEXT = '// LOADING EXPERIENCE. TRANSLATING SILENCE...'

const INTERACTIVE_SIGNS = [
  { emoji: '🤟', label: 'I Love You', color: '#ff6b9d' },
  { emoji: '👋', label: 'Namaste/Hello', color: '#4ecdc4' },
  { emoji: '👍', label: 'Good/Yes', color: '#45b7d1' },
  { emoji: '🙏', label: 'Thank You/Dhanyavad', color: '#96ceb4' },
  { emoji: '✌️', label: 'Peace/Shanti', color: '#a29bfe' },
  { emoji: '🤙', label: 'Call Me/Bulao', color: '#ffeaa7' },
]

const MIN_LOADING_TIME = 800

export default function PageLoader() {
  const [activeIdx, setActiveIdx] = useState(-1)
  const [rightChars, setRightChars] = useState(0)
  const [currentSign, setCurrentSign] = useState(0)
  const [interactiveMode, setInteractiveMode] = useState(false)
  const [clickCount, setClickCount] = useState(0)
  const timerRefs = useRef([])
  const startTime = useRef(Date.now())

  useEffect(() => {
    const elapsed = Date.now() - startTime.current
    const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsed)
    
    // Left side highlight cycle
    let idx = 0
    function advance() {
      if (idx < LINES.length) {
        setActiveIdx(idx)
        idx++
        const id = setTimeout(advance, Math.max(200, remainingTime / LINES.length))
        timerRefs.current.push(id)
      }
    }
    const t1 = setTimeout(advance, 200)
    timerRefs.current.push(t1)

    // Right side typewriter
    let rIdx = 0
    function typeRight() {
      if (rIdx <= RIGHT_TEXT.length) {
        setRightChars(rIdx)
        rIdx++
        const id = setTimeout(typeRight, 20)
        timerRefs.current.push(id)
      }
    }
    const t2 = setTimeout(typeRight, 300)
    timerRefs.current.push(t2)

    // Cycle through interactive signs
    const signInterval = setInterval(() => {
      setCurrentSign(prev => (prev + 1) % INTERACTIVE_SIGNS.length)
    }, 1200)
    timerRefs.current.push(setTimeout(() => clearInterval(signInterval), remainingTime + 1000))

    return () => timerRefs.current.forEach(clearTimeout)
  }, [])

  const scrollOffset = Math.max(0, activeIdx - 1) * 28

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#4B3BCE',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Courier New', monospace",
        position: 'relative',
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
          height: 140,
          overflow: 'hidden',
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            transition: 'transform 0.4s ease',
            transform: `translateY(-${scrollOffset}px)`,
          }}
        >
          {LINES.map((text, i) => (
            <div
              key={i}
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                letterSpacing: '0.13em',
                whiteSpace: 'nowrap',
                padding: i === activeIdx ? '2px 8px' : '2px 0',
                color: i === activeIdx ? '#fff' : 'rgba(255,255,255,0.3)',
                background:
                  i === activeIdx ? 'rgba(255,255,255,0.18)' : 'transparent',
                borderRadius: i === activeIdx ? 2 : 0,
                marginLeft: i === activeIdx ? -8 : 0,
                transition: 'all 0.2s ease',
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
          maxWidth: 180,
          fontSize: 10,
          letterSpacing: '0.09em',
          color: 'rgba(255,255,255,0.25)',
          lineHeight: 1.85,
        }}
      >
        {RIGHT_TEXT.slice(0, rightChars)}
      </div>

      {/* Center interactive sign display */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          zIndex: 2,
          cursor: 'pointer',
        }}
        onClick={() => {
          setClickCount(prev => prev + 1)
          setInteractiveMode(!interactiveMode)
          setCurrentSign(prev => (prev + 1) % INTERACTIVE_SIGNS.length)
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)'
          setInteractiveMode(true)
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          if (clickCount < 3) setInteractiveMode(false)
        }}
      >
        <div
          style={{
            fontSize: 'clamp(48px, 8vw, 72px)',
            animation: interactiveMode ? 'bounce-y 0.8s ease-in-out infinite' : 'splash-dot-pulse 1.5s ease-in-out infinite',
            filter: interactiveMode ? 'brightness(1.2)' : 'brightness(1)',
            transition: 'all 0.3s ease',
            transform: `rotate(${interactiveMode ? clickCount * 15 : 0}deg)`,
          }}
        >
          {INTERACTIVE_SIGNS[currentSign].emoji}
        </div>
        
        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 'clamp(20px, 4vw, 28px)',
            fontWeight: 900,
            fontStyle: 'italic',
            color: INTERACTIVE_SIGNS[currentSign].color,
            opacity: interactiveMode ? 1 : 0.8,
            transition: 'all 0.3s ease',
            textShadow: interactiveMode ? `0 0 20px ${INTERACTIVE_SIGNS[currentSign].color}40` : 'none',
          }}
        >
          Lexi<span style={{ color: 'rgba(255,255,255,0.6)' }}>Sight</span>
        </div>
        
        {interactiveMode && (
          <div
            style={{
              fontSize: 'clamp(12px, 2vw, 16px)',
              color: 'rgba(255,255,255,0.8)',
              fontFamily: "'Courier New', monospace",
              letterSpacing: '0.1em',
              animation: 'fade-in 0.5s ease-out',
              textAlign: 'center',
            }}
          >
            {INTERACTIVE_SIGNS[currentSign].label}
          </div>
        )}
        
        <div style={{ display: 'flex', gap: 8 }}>
          {INTERACTIVE_SIGNS.map((sign, i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: i === currentSign ? sign.color : 'rgba(255,255,255,0.3)',
                animation: i === currentSign ? 'splash-dot-pulse 1s ease-in-out infinite' : 'none',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
        
        {interactiveMode && (
          <div
            style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.5)',
              fontFamily: "'Courier New', monospace",
              letterSpacing: '0.05em',
              marginTop: 8,
              animation: 'fade-in 0.3s ease-out',
            }}
          >
            Click to explore signs • {clickCount} interactions
          </div>
        )}
      </div>

      {/* Corner markers */}
      <div style={{ position: 'absolute', top: 20, left: 20, width: 14, height: 14, borderTop: '2px solid rgba(255,255,255,0.12)', borderLeft: '2px solid rgba(255,255,255,0.12)' }} />
      <div style={{ position: 'absolute', top: 20, right: 20, width: 14, height: 14, borderTop: '2px solid rgba(255,255,255,0.12)', borderRight: '2px solid rgba(255,255,255,0.12)' }} />
      <div style={{ position: 'absolute', bottom: 20, left: 20, width: 14, height: 14, borderBottom: '2px solid rgba(255,255,255,0.12)', borderLeft: '2px solid rgba(255,255,255,0.12)' }} />
      <div style={{ position: 'absolute', bottom: 20, right: 20, width: 14, height: 14, borderBottom: '2px solid rgba(255,255,255,0.12)', borderRight: '2px solid rgba(255,255,255,0.12)' }} />

      {/* Bottom progress bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.06)' }}>
        <div
          style={{
            height: '100%',
            background: 'rgba(255,255,255,0.45)',
            borderRadius: 2,
            transition: 'width 0.35s ease',
            width: `${((activeIdx + 1) / LINES.length) * 100}%`,
          }}
        />
      </div>
    </div>
  )
}
