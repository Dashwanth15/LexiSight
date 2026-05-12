import { useState, useEffect, useRef } from 'react'

/* ═══════════════════════════════════════════════════════════════════
   PageLoader — Mini terminal animation for lazy-loaded page transitions.
   A faster, compact version of the "Silence Ends Here" splash,
   designed to play in ~2s while React loads the next chunk.
   ═══════════════════════════════════════════════════════════════════ */

const LINES = [
  '// ROUTING NEURAL PATHWAYS...',
  '// LOADING MODULE...',
  '// SYNCING INTERFACE...',
  '// RENDERING COMPONENTS...',
]

const RIGHT_TEXT = '// LOADING VIEW. BRIDGING SILENCE...'

export default function PageLoader() {
  const [activeIdx, setActiveIdx] = useState(-1)
  const [rightChars, setRightChars] = useState(0)
  const timerRefs = useRef([])

  useEffect(() => {
    // Left side highlight cycle
    let idx = 0
    function advance() {
      if (idx < LINES.length) {
        setActiveIdx(idx)
        idx++
        const id = setTimeout(advance, 380)
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
        const id = setTimeout(typeRight, 30)
        timerRefs.current.push(id)
      }
    }
    const t2 = setTimeout(typeRight, 300)
    timerRefs.current.push(t2)

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

      {/* Center pulsing logo */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 'clamp(24px, 5vw, 36px)',
            fontWeight: 900,
            fontStyle: 'italic',
            color: '#fff',
            opacity: 0.9,
            animation: 'splash-dot-pulse 1.5s ease-in-out infinite',
          }}
        >
          Lexi<span style={{ color: 'rgba(255,255,255,0.5)' }}>Sight</span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: '#fff',
                animation: `splash-dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
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
