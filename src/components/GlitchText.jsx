import { useState, useEffect, useRef } from 'react'

export default function GlitchText({ text, className = '', style = {}, tag: Tag = 'span' }) {
  const [glitching, setGlitching] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    const scheduleGlitch = () => {
      timerRef.current = setTimeout(() => {
        setGlitching(true)
        setTimeout(() => {
          setGlitching(false)
          scheduleGlitch()
        }, 400)
      }, 6000 + Math.random() * 4000)
    }

    scheduleGlitch()
    return () => clearTimeout(timerRef.current)
  }, [])

  return (
    <Tag
      className={`relative inline-block ${className}`}
      style={style}
      data-text={text}
    >
      <span style={{ visibility: 'visible' }}>{text}</span>

      {/* Glitch layer 1 */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          color: 'var(--cyan)',
          opacity: glitching ? 1 : 0,
          transform: glitching ? 'translate(-3px, 1px)' : 'translate(0)',
          clipPath: glitching ? 'polygon(0 20%, 100% 20%, 100% 45%, 0 45%)' : 'none',
          transition: glitching ? 'none' : 'opacity 0.1s',
          pointerEvents: 'none',
        }}
      >
        {text}
      </span>

      {/* Glitch layer 2 */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          color: 'var(--violet)',
          opacity: glitching ? 0.8 : 0,
          transform: glitching ? 'translate(3px, -1px)' : 'translate(0)',
          clipPath: glitching ? 'polygon(0 60%, 100% 60%, 100% 80%, 0 80%)' : 'none',
          transition: glitching ? 'none' : 'opacity 0.1s',
          pointerEvents: 'none',
        }}
      >
        {text}
      </span>
    </Tag>
  )
}
