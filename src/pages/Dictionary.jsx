import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation.js'
import libraryManifest from '../data/islVideoLibrary.slim.json'

const PAGE_SIZE = 24
const ACCENT = 'var(--green)'
const ALL_ITEMS = (libraryManifest.items ?? []).filter(
  (item) => item.source === 'INCLUDE' && !String(item.id).startsWith('cislr_'),
)

function formatLabel(label) {
  return String(label || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function videoSrc(path) {
  if (!path) return ''
  return encodeURI(path.startsWith('/') ? path : `/${path}`)
}

const VideoCard = memo(function VideoCard({ item, onOpen }) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '240px 0px', threshold: 0.01 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <button
      type="button"
      ref={ref}
      onClick={() => onOpen(item)}
      className="glass-card"
      style={{
        padding: 0,
        border: '1px solid var(--border)',
        borderTop: `2px solid color-mix(in srgb, ${ACCENT} 35%, transparent)`,
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = `0 12px 32px color-mix(in srgb, ${ACCENT} 12%, transparent)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 11',
          background: 'var(--surface)',
          overflow: 'hidden',
        }}
      >
        {inView ? (
          <video
            src={videoSrc(item.video)}
            muted
            loop
            playsInline
            preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
            onMouseLeave={(e) => {
              e.currentTarget.pause()
              e.currentTarget.currentTime = 0
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.7rem',
            }}
          >
            …
          </div>
        )}
        <span
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            fontSize: '0.7rem',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: ACCENT,
            background: 'color-mix(in srgb, var(--void) 75%, transparent)',
            border: `1px solid color-mix(in srgb, ${ACCENT} 40%, transparent)`,
            borderRadius: 20,
            padding: '5px 10px',
          }}
        >
          {t('dict_click_learn')}
        </span>
      </div>
      <div style={{ padding: '1rem 1.15rem 1.15rem' }}>
        <div
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)',
            color: 'var(--text-primary)',
            lineHeight: 1.2,
            marginBottom: 8,
          }}
        >
          {formatLabel(item.label)}
        </div>
        <div
          style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '0.88rem',
            color: 'var(--text-secondary)',
            textTransform: 'capitalize',
          }}
        >
          {formatLabel(item.category)}
        </div>
      </div>
    </button>
  )
})

function LearnModal({ item, onClose }) {
  const { t } = useTranslation()
  const videoRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [item])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={formatLabel(item.label)}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'color-mix(in srgb, var(--void) 55%, transparent)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="glass-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 96vw)',
          padding: 0,
          overflow: 'hidden',
          borderTop: `2px solid color-mix(in srgb, ${ACCENT} 45%, transparent)`,
        }}
      >
        <video
          ref={videoRef}
          src={videoSrc(item.video)}
          controls
          autoPlay
          loop
          playsInline
          style={{ width: '100%', display: 'block', background: '#000', maxHeight: 'min(75vh, 560px)', objectFit: 'contain' }}
        />
        <div style={{ padding: '1.25rem 1.5rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <h2
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 900,
                fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              {formatLabel(item.label)}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-secondary)',
                width: 36,
                height: 36,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            {formatLabel(item.category)}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/translate" className="btn-primary" style={{ fontSize: '0.85rem', flex: 1, textAlign: 'center', minWidth: 140 }}>
              {t('dict_go_translator')} →
            </Link>
            <Link to="/learn" className="btn-secondary" style={{ fontSize: '0.85rem', flex: 1, textAlign: 'center', minWidth: 140 }}>
              {t('dict_btn_learn')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dictionary() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 200)
    return () => clearTimeout(id)
  }, [query])

  const categories = useMemo(() => {
    const set = new Set()
    ALL_ITEMS.forEach((item) => {
      if (item.category) set.add(item.category)
    })
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))]
  }, [])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [debouncedQuery, category])

  const filtered = useMemo(() => {
    let list = ALL_ITEMS
    if (category !== 'all') {
      list = list.filter((item) => item.category === category)
    }
    if (debouncedQuery) {
      list = list.filter((item) => {
        const label = formatLabel(item.label).toLowerCase()
        const cat = formatLabel(item.category).toLowerCase()
        return label.includes(debouncedQuery) || cat.includes(debouncedQuery)
      })
    }
    return list
  }, [category, debouncedQuery])

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const hasMore = visibleCount < filtered.length

  const openItem = useCallback((item) => setSelected(item), [])
  const closeModal = useCallback(() => setSelected(null), [])

  return (
    <div style={{ minHeight: '100dvh', paddingTop: 64, background: 'var(--void)' }}>
      <section style={{ padding: '2.5rem 1.5rem 3rem', maxWidth: 1440, margin: '0 auto' }}>
        <div className="hud-label" style={{ marginBottom: '0.5rem' }}>
          ISL Video Library
        </div>
        <h1
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(2rem, 5vw, 3.25rem)',
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--cyan) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '0.5rem',
          }}
        >
          {t('dict_title')}
        </h1>
        <p
          style={{
            fontFamily: 'DM Sans, sans-serif',
            color: 'var(--text-secondary)',
            fontSize: '1rem',
            maxWidth: 560,
            marginBottom: '1.75rem',
            lineHeight: 1.55,
          }}
        >
          {t('dict_subtitle_video')}
        </p>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('dict_search_placeholder')}
          aria-label={t('dict_search_placeholder')}
          style={{
            width: '100%',
            maxWidth: 560,
            background: 'var(--obsidian)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '12px 16px',
            color: 'var(--text-primary)',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '0.95rem',
            outline: 'none',
            marginBottom: '1rem',
          }}
        />

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'nowrap',
            overflowX: 'auto',
            paddingBottom: 8,
            marginBottom: '1rem',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {categories.map((cat) => {
            const active = category === cat
            const label = cat === 'all' ? t('dict_category_all') : formatLabel(cat)
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                style={{
                  flexShrink: 0,
                  background: active ? `color-mix(in srgb, ${ACCENT} 15%, transparent)` : 'transparent',
                  border: `1px solid ${active ? ACCENT : 'var(--border)'}`,
                  borderRadius: 20,
                  padding: '6px 14px',
                  color: active ? ACCENT : 'var(--text-secondary)',
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="hud-label" style={{ marginBottom: '1rem' }}>
          {t('dict_showing')} {visible.length.toLocaleString()} / {filtered.length.toLocaleString()}
        </div>

        {visible.length > 0 ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1.35rem',
              }}
            >
              {visible.map((item) => (
                <VideoCard key={item.id} item={item} onOpen={openItem} />
              ))}
            </div>
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  style={{ fontSize: '0.9rem', padding: '10px 28px' }}
                >
                  {t('dict_load_more')} ({Math.min(PAGE_SIZE, filtered.length - visibleCount)} more)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔍</div>
            <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)' }}>
              {t('dict_none')}
              {query ? ` "${query}"` : ''}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setCategory('all')
              }}
              className="btn-secondary"
              style={{ marginTop: '1rem', fontSize: '0.8rem' }}
            >
              {t('dict_btn_clear')}
            </button>
          </div>
        )}

        <div
          style={{
            marginTop: '3rem',
            textAlign: 'center',
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link to="/learn" className="btn-primary" style={{ fontSize: '0.85rem' }}>
            {t('dict_btn_learn')} →
          </Link>
          <Link to="/translate" className="btn-secondary" style={{ fontSize: '0.85rem' }}>
            {t('dict_go_translator')} →
          </Link>
        </div>
      </section>

      {selected && <LearnModal item={selected} onClose={closeModal} />}
    </div>
  )
}
