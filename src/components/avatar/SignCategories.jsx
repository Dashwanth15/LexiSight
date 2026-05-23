// SignCategories.jsx — Category Tab Selector for ISL Dictionary
// ──────────────────────────────────────────────────────────────────────────────

import { DICTIONARY_CATEGORIES } from './SignLibrary.jsx'

export default function SignCategories({ selected = 'all', onChange }) {
  return (
    <div
      id="isl-category-tabs"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 5,
      }}
    >
      {DICTIONARY_CATEGORIES.map((cat) => {
        const isActive = selected === cat.id
        return (
          <button
            key={cat.id}
            id={`isl-cat-${cat.id}`}
            onClick={() => onChange(cat.id)}
            style={{
              padding: '6px 12px',
              borderRadius: 9,
              fontSize: '0.68rem',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 650,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: isActive
                ? `${cat.color}15`
                : 'rgba(15,23,42,0.6)',
              border: `1px solid ${isActive ? `${cat.color}50` : '#1e293b'}`,
              color: isActive ? cat.color : '#64748b',
              transition: 'all 0.18s ease',
              boxShadow: isActive
                ? `0 0 12px ${cat.color}20`
                : 'none',
              transform: isActive ? 'scale(1.04)' : 'scale(1)',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = `${cat.color}0a`
                e.currentTarget.style.borderColor = `${cat.color}30`
                e.currentTarget.style.color = cat.color
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(15,23,42,0.6)'
                e.currentTarget.style.borderColor = '#1e293b'
                e.currentTarget.style.color = '#64748b'
              }
            }}
          >
            {cat.label}
          </button>
        )
      })}
    </div>
  )
}
