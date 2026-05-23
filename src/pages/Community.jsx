import { Link } from 'react-router-dom'
import { PHRASE_PACKS } from '../data/phrasePacks.js'
import { useTranslation } from '../hooks/useTranslation.js'

const FEATURED_SIGNS = [
  { word: 'NAMASTE', submitter: 'Priya K.', city: 'Chennai', upvotes: 42, status: 'approved', emoji: '🙏' },
  { word: 'RUPEE', submitter: 'Arjun M.', city: 'Bangalore', upvotes: 38, status: 'approved', emoji: '💰' },
  { word: 'RAILWAY', submitter: 'Sunita R.', city: 'Mumbai', upvotes: 31, status: 'review', emoji: '🚂' },
  { word: 'DOSA', submitter: 'Kumar T.', city: 'Hyderabad', upvotes: 27, status: 'review', emoji: '🫓' },
  { word: 'AUTO', submitter: 'Deepa S.', city: 'Delhi', upvotes: 19, status: 'pending', emoji: '🛺' },
  { word: 'CHAI', submitter: 'Ravi N.', city: 'Pune', upvotes: 15, status: 'pending', emoji: '🍵' },
]

const STATUS_STYLE = {
  approved: { color: '#00ff88', bg: 'rgba(0,255,136,0.08)', label: '✓ Approved' },
  review: { color: '#ffaa00', bg: 'rgba(255,170,0,0.08)', label: '⏳ In Review' },
  pending: { color: 'var(--text-secondary)', bg: 'rgba(107,139,164,0.06)', label: '○ Pending' },
}

export default function Community() {
  const { t } = useTranslation()
  return (
    <div style={{ minHeight: '100dvh', paddingTop: 64, background: 'var(--void)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 1.5rem' }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div className="hud-label" style={{ marginBottom: '0.5rem' }}>SDG 17 · Partnerships for the Goals</div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(2rem,6vw,3.5rem)', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {t('comm_title')}
          </h1>
          <p style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 560 }}>
            {t('comm_subtitle')}
          </p>
        </div>

        {/* ── Stats bar ──────────────────────────────────────────── */}
        <div className="glass-card" style={{ padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { n: '6', label: t('comm_stats_signs'), color: 'var(--cyan)' },
            { n: '172', label: t('comm_stats_votes'), color: '#00ff88' },
            { n: '2', label: t('comm_stats_approved'), color: '#8b5cf6' },
            { n: 'Open', label: t('comm_stats_source'), color: '#ffaa00' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', flex: 1, minWidth: 80 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.6rem', color: s.color }}>{s.n}</div>
              <div className="hud-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

          {/* ── Featured Signs ──────────────────────────────────── */}
          <div>
            <div className="hud-label" style={{ marginBottom: '0.75rem' }}>{t('comm_featured_title')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {FEATURED_SIGNS.map((sign, i) => {
                const st = STATUS_STYLE[sign.status]
                return (
                  <div key={i} className="glass-card" style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: '1.4rem', flexShrink: 0 }}>{sign.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{sign.word}</div>
                      <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        by {sign.submitter} · {sign.city}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', color: st.color, background: st.bg, border: `1px solid ${st.color}25`, borderRadius: 20, padding: '2px 8px' }}>
                        {st.label}
                      </span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                        ▲ {sign.upvotes}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── How to Contribute ───────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="hud-label" style={{ marginBottom: '0' }}>{t('comm_how_title')}</div>

            {[
              { step: '01', title: 'Record the Sign', desc: 'Go to the Train page. Name your gesture label and record 50 samples using your webcam.', icon: '📷', color: 'var(--cyan)' },
              { step: '02', title: 'Download JSON', desc: 'Click "Download JSON" — this exports your hand landmark data, not any video or images.', icon: '📦', color: '#8b5cf6' },
              { step: '03', title: 'Open a GitHub Issue', desc: 'Submit your JSON file + a description of the ISL sign on the GitHub repository.', icon: '🔗', color: '#00ff88' },
              { step: '04', title: 'Community Review', desc: 'Community members verify the sign against ISL standards. Approved signs get merged into the model.', icon: '✅', color: '#ffaa00' },
            ].map(s => (
              <div key={s.step} className="glass-card" style={{ padding: '1rem', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: `${s.color}12`,
                  border: `1px solid ${s.color}30`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '1rem', flexShrink: 0,
                }}>{s.icon}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: s.color }}>{s.step}</span>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{s.title}</span>
                  </div>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.desc}</p>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Link to="/train" className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem' }}>
                📷 {t('btn_record_sign') || 'Record a Sign'}
              </Link>
              <a
                href="https://github.com/jashvanthh/Lexisight/issues/new"
                target="_blank" rel="noopener noreferrer"
                className="btn-secondary"
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem', textDecoration: 'none' }}
              >
                🔗 {t('btn_submit_github') || 'Submit GitHub'}
              </a>
            </div>
          </div>
        </div>

        {/* ── Phrase Packs ──────────────────────────────────────── */}
        <div style={{ marginTop: '3rem' }}>
          <div className="hud-label" style={{ marginBottom: '0.75rem' }}>Built-In Domain Phrase Packs</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {PHRASE_PACKS.map(pack => (
              <div key={pack.id} className="glass-card" style={{ padding: '1.25rem', borderTop: `2px solid ${pack.color}30` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: '1.4rem' }}>{pack.icon}</span>
                  <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{pack.label}</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: pack.color }}>{pack.sdgLabel}</div>
                  </div>
                </div>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 10 }}>{pack.description}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {pack.phrases.slice(0, 5).map(ph => (
                    <span key={ph.word} style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem',
                      color: pack.color, background: `${pack.color}08`,
                      border: `1px solid ${pack.color}20`, borderRadius: 4, padding: '2px 6px',
                    }}>
                      {ph.word}
                    </span>
                  ))}
                  {pack.phrases.length > 5 && (
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>+{pack.phrases.length - 5} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
