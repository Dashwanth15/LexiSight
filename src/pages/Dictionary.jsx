import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation.js'
import { ISL_DICTIONARY, DICTIONARY_CATEGORIES, searchDictionary } from '../data/islDictionary.js'

// ── Finger Diagram ───────────────────────────────────────────────────────────
function FingerDiagram({ fingers = {}, color = 'var(--cyan)', size = 48 }) {
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
            background: isUp ? color : isPartial ? `color-mix(in srgb, ${color} 70%, transparent)` : 'var(--glass-border)',
            border: `1px solid ${isUp ? color : 'var(--glass-border)'}`,
            boxShadow: isUp ? `0 0 8px color-mix(in srgb, ${color} 50%, transparent)` : 'none',
            transition: 'all 0.3s ease',
          }} />
        )
      })}
    </div>
  )
}

// ── Dictionary Card ──────────────────────────────────────────────────────────
function DictCard({ item, onTry }) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const CATEGORY_COLORS = {
    alphabet: 'var(--cyan)', numbers: '#00ff88', greetings: '#8b5cf6',
    medical: '#ff3366', emergency: '#ffaa00', common: 'var(--cyan)',
  }
  const color = CATEGORY_COLORS[item.category] || 'var(--cyan)'

  return (
    <div
      className="glass-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '1rem',
        borderTop: `2px solid color-mix(in srgb, ${color} 30%, transparent)`,
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? `0 8px 30px color-mix(in srgb, ${color} 10%, transparent)` : 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
        display: 'flex', flexDirection: 'column', gap: 8, cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '1.4rem' }}>{item.emoji}</span>
        <span style={{
          fontSize: '0.6rem', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em',
          color, background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
          borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase',
        }}>
          {item.category}
        </span>
      </div>

      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.3rem', color: 'var(--text-primary)' }}>
        {item.label}
      </div>

      <div style={{ marginBottom: 4 }}>
        <FingerDiagram fingers={item.fingers} color={color} size={40} />
      </div>

      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, flex: 1 }}>
        {item.description}
      </p>

      {hovered && (
        <button
          onClick={() => onTry(item)}
          style={{
            background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
            borderRadius: 6, color, fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
            fontSize: '0.75rem', padding: '5px 12px', cursor: 'pointer',
            width: '100%', marginTop: 4,
          }}
        >
          {t('dict_btn_try')} →
        </button>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Dictionary() {
  const { t } = useTranslation()
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
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(2rem,6vw,3.5rem)', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          {t('dict_title')}
        </h1>
        <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 500, marginBottom: '2rem' }}>
          {t('dict_subtitle')}
        </p>

        {/* Search */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('dict_search_placeholder')}
            style={{
              flex: 1, minWidth: 200,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '10px 16px',
              color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', fontSize: '0.9rem',
              outline: 'none',
            }}
            aria-label="Search ISL dictionary"
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DICTIONARY_CATEGORIES.map(cat => {
              const themeColors = {
                all: 'var(--text-primary)',
                alphabet: 'var(--cyan)',
                numbers: 'var(--green)',
                greetings: 'var(--violet)',
                medical: 'var(--red)',
                emergency: 'var(--amber)',
                common: 'var(--cyan)'
              }
              const catColor = themeColors[cat.id] || cat.color
              const isActive = category === cat.id
              
              return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                style={{
                  background: isActive ? `color-mix(in srgb, ${catColor} 15%, transparent)` : 'transparent',
                  border: `1px solid ${isActive ? catColor : 'var(--border)'}`,
                  borderRadius: 20, padding: '6px 14px',
                  color: isActive ? catColor : 'var(--text-secondary)',
                  fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat.label}
              </button>
            )})}
          </div>
        </div>

        {/* Result count */}
        <div className="hud-label" style={{ marginBottom: '1rem' }}>
          {results.length} {t('dict_found')}
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
            <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)' }}>{t('dict_none')} "{query}"</p>
            <button onClick={() => { setQuery(''); setCategory('all') }} className="btn-secondary" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
              {t('dict_btn_clear')}
            </button>
          </div>
        )}

        {/* Bottom CTA */}
        <div style={{ marginTop: '3rem', textAlign: 'center', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/learn" className="btn-primary" style={{ fontSize: '0.85rem' }}>{t('dict_btn_learn')} →</Link>
          <Link to="/translate" className="btn-secondary" style={{ fontSize: '0.85rem' }}>↗ {t('nav_translate')}</Link>
        </div>
      </section>
    </div>
  )
}
