import { useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SignInButton, UserButton, SignedIn, SignedOut } from '@clerk/clerk-react'
import GlitchText from './GlitchText.jsx'
import ThemeToggle, { useTheme } from './ThemeToggle.jsx'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/translate', label: 'Translate' },
  { to: '/learn', label: 'Learn', badge: 'NEW' },
  { to: '/dictionary', label: 'Dictionary', badge: 'NEW' },
  { to: '/avatar3d', label: '3D Avatar', badge: '3D' }, // NEW CODE
  { to: '/impact', label: 'Impact' },
  { to: '/community', label: 'Community' },
  { to: '/room', label: 'Call', badge: 'LIVE' },   // NEW CODE — WebRTC call room link
  { to: '/about', label: 'About' },
]

export default function Navbar() {
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { theme, toggle } = useTheme()

  const isActive = useCallback((to) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }, [location.pathname])

  const handleNav = () => setDrawerOpen(false)

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center"
        style={{
          background: 'rgba(2, 4, 8, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(26, 37, 53, 0.8)',
        }}
      >
        <div className="w-full flex items-center px-4 sm:px-6 lg:px-8">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 sm:gap-3 mr-auto no-underline" onClick={handleNav}>
            <div
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center shrink-0"
              style={{ borderColor: 'rgba(0,212,255,0.4)', boxShadow: '0 0 12px rgba(0,212,255,0.25)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <ellipse cx="12" cy="12" rx="10" ry="6" stroke="#00d4ff" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="3" fill="#00d4ff" />
                <circle cx="12" cy="12" r="1.5" fill="#020408" />
                <line x1="2" y1="12" x2="5" y2="12" stroke="#00d4ff" strokeWidth="1.5" />
                <line x1="19" y1="12" x2="22" y2="12" stroke="#00d4ff" strokeWidth="1.5" />
              </svg>
            </div>
            <GlitchText
              text="LexiSight"
              className="text-base sm:text-lg font-bold font-syne tracking-tight"
              style={{ color: '#e8f4fd' }}
            />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label, badge }) => (
              <Link
                key={to}
                to={to}
                className="relative px-3 py-2 rounded-lg text-sm font-dm font-medium transition-all duration-300 no-underline flex items-center gap-1.5"
                style={{
                  color: isActive(to) ? '#00d4ff' : '#6b8ba4',
                  background: isActive(to) ? 'rgba(0,212,255,0.07)' : 'transparent',
                  fontSize: '0.82rem',
                }}
              >
                {label}
                {badge && (
                  <span style={{
                    fontSize: '0.5rem', letterSpacing: '0.08em',
                    background: 'rgba(0,255,136,0.15)', color: '#00ff88',
                    border: '1px solid rgba(0,255,136,0.3)', borderRadius: 20,
                    padding: '1px 5px', fontFamily: 'JetBrains Mono, monospace',
                  }}>{badge}</span>
                )}
                {isActive(to) && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                    style={{ background: '#00d4ff', boxShadow: '0 0 6px #00d4ff' }}
                  />
                )}
              </Link>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
              <ThemeToggle theme={theme} onToggle={toggle} compact />
              <SignedOut>
                <SignInButton mode="modal">
                  <button
                    className="btn-primary"
                    style={{ padding: '7px 14px', fontSize: '0.78rem', minHeight: 36, cursor: 'pointer' }}
                  >
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton
                  appearance={{
                    elements: { avatarBox: { width: 32, height: 32 } }
                  }}
                />
              </SignedIn>
              <Link
                to="/translate"
                className="btn-primary"
                style={{ padding: '7px 14px', fontSize: '0.78rem', minHeight: 36 }}
                onClick={handleNav}
                aria-label="Start translating"
              >
                <span>↗</span> Translate
              </Link>
            </div>
          </div>

          {/* Mobile: theme + hamburger */}
          <div className="lg:hidden flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={toggle} compact />
            <button
              className="flex flex-col gap-1.5 p-2 rounded-lg cursor-pointer transition-all duration-200"
              style={{
                background: drawerOpen ? 'rgba(0,212,255,0.06)' : 'transparent',
                border: drawerOpen ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent',
                minWidth: 44, minHeight: 44,
                alignItems: 'center', justifyContent: 'center',
              }}
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={drawerOpen}
            >
              {[0, 1, 2].map(i => (
                <span key={i} className="block transition-all duration-300" style={{
                  width: 20, height: 2, background: '#00d4ff', borderRadius: 2,
                  transform: i === 0 && drawerOpen ? 'rotate(45deg) translate(3px, 3px)' : i === 2 && drawerOpen ? 'rotate(-45deg) translate(3px, -3px)' : 'none',
                  opacity: i === 1 && drawerOpen ? 0 : 1,
                }} />
              ))}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <>
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{
            background: 'rgba(2,4,8,0.8)', backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            pointerEvents: drawerOpen ? 'all' : 'none',
            opacity: drawerOpen ? 1 : 0, transition: 'opacity 0.3s ease',
          }}
          onClick={handleNav}
        />

        <div
          className="fixed top-0 right-0 bottom-0 z-50 lg:hidden flex flex-col pt-20 px-5 gap-1"
          style={{
            width: 'min(300px, 85vw)', background: '#080d14',
            borderLeft: '1px solid #1a2535',
            transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
            paddingBottom: 'env(safe-area-inset-bottom, 24px)',
            overflowY: 'auto',
          }}
        >
          {NAV_LINKS.map(({ to, label, badge }) => (
            <Link
              key={to}
              to={to}
              onClick={handleNav}
              className="flex items-center gap-3 px-4 py-3 rounded-xl no-underline transition-all duration-200"
              style={{
                color: isActive(to) ? '#00d4ff' : '#6b8ba4',
                background: isActive(to) ? 'rgba(0,212,255,0.07)' : 'transparent',
                borderLeft: isActive(to) ? '3px solid #00d4ff' : '3px solid transparent',
                fontSize: '0.95rem', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                minHeight: 48,
              }}
            >
              {label}
              {badge && (
                <span style={{
                  fontSize: '0.5rem', background: 'rgba(0,255,136,0.15)', color: '#00ff88',
                  border: '1px solid rgba(0,255,136,0.3)', borderRadius: 20,
                  padding: '1px 5px', fontFamily: 'JetBrains Mono, monospace',
                }}>{badge}</span>
              )}
            </Link>
          ))}

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #1a2535' }}>
            <Link
              to="/translate"
              onClick={handleNav}
              className="btn-primary w-full justify-center"
              style={{ minHeight: 48, fontSize: '0.9rem' }}
            >
              ↗ Start Translating
            </Link>
          </div>

          <div className="mt-auto pt-4 pb-4">
            <p className="hud-label text-center" style={{ fontSize: '0.55rem' }}>LexiSight · SDG 3,4,8,10,17 · AIESEC 2026</p>
          </div>
        </div>
      </>
    </>
  )
}
