import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ISL_DICTIONARY, DICTIONARY_CATEGORIES, searchDictionary } from '../data/islDictionary.js'

// ── Finger Diagram ───────────────────────────────────────────────────────────
function FingerDiagram({ fingers = {}, color = '#00d4ff', size = 48 }) {
  const names = ['thumb', 'index', 'middle', 'ring', 'pinky']
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: size }}>
      {names.map((name, i) => {
        const state = fingers[name] || 'curl'
        const isUp = state === 'up' || state === 'forward'
        const isPartial = state === 'circle' || state === 'side' || state === 'curve'
        const heights = [size * 0.55, size * 0.85, size, size * 0.9, size * 0.7]
        const h = isUp ? heights[i] : isPartial ? heights[i] * 0.6 : heights[i] * 0.3
        return (
          <div key={name} style={{
            width: 8, height: h, borderRadius: 4,
            background: isUp ? color : isPartial ? `${color}70` : 'rgba(255,255,255,0.08)',
            border: `1px solid ${isUp ? color : 'rgba(255,255,255,0.05)'}`,
            boxShadow: isUp ? `0 0 8px ${color}50` : 'none',
            transition: 'all 0.3s ease',
          }} />
        )
      })}
    </div>
  )
}

// ── Dictionary Card ──────────────────────────────────────────────────────────
function DictCard({ item, onTry }) {
  const [hovered, setHovered] = useState(false)
  const CATEGORY_COLORS = {
    alphabet: '#00d4ff', numbers: '#00ff88', greetings: '#8b5cf6',
    medical: '#ff3366', emergency: '#ffaa00', common: '#00d4ff',
  }
  const color = CATEGORY_COLORS[item.category] || '#00d4ff'

  return (
    <div
      className="glass-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '1rem',
        borderTop: `2px solid ${color}30`,
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? `0 8px 30px ${color}10` : 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
        display: 'flex', flexDirection: 'column', gap: 8, cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '1.4rem' }}>{item.emoji}</span>
        <span style={{
          fontSize: '0.6rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em',
          color, background: `${color}12`, border: `1px solid ${color}25`,
          borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase',
        }}>
          {item.category}
        </span>
      </div>

      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.3rem', color: '#e8f4fd' }}>
        {item.label}
      </div>

      <div style={{ marginBottom: 4 }}>
        <FingerDiagram fingers={item.fingers} color={color} size={40} />
      </div>

      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: '#6b8ba4', lineHeight: 1.4, flex: 1 }}>
        {item.description}
      </p>

      {hovered && (
        <button
          onClick={() => onTry(item)}
          style={{
            background: `${color}12`, border: `1px solid ${color}30`,
            borderRadius: 6, color, fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
            fontSize: '0.75rem', padding: '5px 12px', cursor: 'pointer',
            width: '100%', marginTop: 4,
          }}
        >
          Try this sign →
        </button>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Dictionary() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [results, setResults] = useState(ISL_DICTIONARY)

  useEffect(() => {
    setResults(searchDictionary(query, category))
  }, [query, category])

  const handleTry = (item) => {
    window.open(`/translate?demo=${item.id}`, '_blank')
  }

  return (
    <div style={{ minHeight: '100dvh', paddingTop: 64, background: 'var(--void)' }}>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section style={{ padding: '3rem 1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <div className="hud-label" style={{ marginBottom: '0.5rem' }}>Visual Reference</div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(2rem,6vw,3.5rem)', color: '#e8f4fd', marginBottom: '0.5rem' }}>
          ISL Dictionary
        </h1>
        <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#6b8ba4', fontSize: '1rem', maxWidth: 500, marginBottom: '2rem' }}>
          A visual reference for {ISL_DICTIONARY.length}+ Indian Sign Language gestures. Hover any card to practice it live.
        </p>

        {/* Search */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search signs... (e.g. HELLO, PAIN, A)"
            style={{
              flex: 1, minWidth: 200,
              background: '#0d1520', border: '1px solid #1a2535',
              borderRadius: 10, padding: '10px 16px',
              color: '#e8f4fd', fontFamily: 'DM Sans, sans-serif', fontSize: '0.9rem',
              outline: 'none',
            }}
            aria-label="Search ISL dictionary"
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DICTIONARY_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                style={{
                  background: category === cat.id ? `${cat.color}15` : 'transparent',
                  border: `1px solid ${category === cat.id ? cat.color : '#1a2535'}`,
                  borderRadius: 20, padding: '6px 14px',
                  color: category === cat.id ? cat.color : '#6b8ba4',
                  fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Result count */}
        <div className="hud-label" style={{ marginBottom: '1rem' }}>
          {results.length} sign{results.length !== 1 ? 's' : ''} found
        </div>

        {/* Grid */}
        {results.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
            {results.map(item => (
              <DictCard key={item.id} item={item} onTry={handleTry} />
            ))}
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔍</div>
            <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#6b8ba4' }}>No signs found for "{query}"</p>
            <button onClick={() => { setQuery(''); setCategory('all') }} className="btn-secondary" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
              Clear filters
            </button>
          </div>
        )}

        {/* Bottom CTA */}
        <div style={{ marginTop: '3rem', textAlign: 'center', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/learn" className="btn-primary" style={{ fontSize: '0.85rem' }}>📚 Learn ISL with AI →</Link>
          <Link to="/translate" className="btn-secondary" style={{ fontSize: '0.85rem' }}>↗ Open Translator</Link>
        </div>
      </section>
    </div>
  )
}
