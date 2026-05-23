// SearchBar.jsx — Glassmorphic Search Input for ISL Dictionary
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react'

export default function SearchBar({ value = '', onChange }) {
  const inputRef = useRef(null)
  const [focused, setFocused] = useState(false)

  // Keyboard shortcut: Ctrl+K or / to focus search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div
      id="isl-search-bar"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: focused
          ? 'rgba(0,212,255,0.06)'
          : 'rgba(8,13,20,0.85)',
        border: `1px solid ${focused ? 'rgba(0,212,255,0.4)' : '#1e293b'}`,
        borderRadius: 12,
        padding: '0 14px',
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(12px)',
        boxShadow: focused ? '0 0 20px rgba(0,212,255,0.1)' : 'none',
      }}
    >
      {/* Search Icon */}
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke={focused ? '#00d4ff' : '#475569'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, transition: 'stroke 0.2s ease' }}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <input
        ref={inputRef}
        id="isl-search-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search signs, letters, numbers..."
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '11px 0',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '0.82rem',
          color: '#e2e8f0',
          letterSpacing: '0.01em',
        }}
      />

      {/* Clear button */}
      {value && (
        <button
          id="isl-search-clear"
          onClick={() => onChange('')}
          style={{
            background: 'rgba(100,116,139,0.15)',
            border: '1px solid rgba(100,116,139,0.2)',
            borderRadius: 6,
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#94a3b8',
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: 0,
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
          title="Clear search"
        >
          ✕
        </button>
      )}

      {/* Keyboard shortcut hint */}
      {!value && !focused && (
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.55rem',
          color: '#334155',
          background: 'rgba(30,41,59,0.6)',
          border: '1px solid #1e293b',
          borderRadius: 4,
          padding: '2px 5px',
          flexShrink: 0,
          letterSpacing: '0.05em',
        }}>
          Ctrl+K
        </span>
      )}
    </div>
  )
}
