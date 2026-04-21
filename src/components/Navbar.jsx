import { useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import GlitchText from './GlitchText.jsx'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/translate', label: 'Translate' },
  { to: '/about', label: 'About' },
  { to: '/train', label: 'Train' },
]

export default function Navbar() {
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isActive = useCallback((to) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }, [location.pathname])

  // Close drawer on any nav
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
        <div className="w-full flex items-center px-4 sm:px-6 lg:px-10">

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
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="relative px-3 lg:px-4 py-2 rounded-lg text-sm font-dm font-medium transition-all duration-300 no-underline"
                style={{
                  color: isActive(to) ? '#00d4ff' : '#6b8ba4',
                  background: isActive(to) ? 'rgba(0,212,255,0.07)' : 'transparent',
                }}
              >
                {label}
                {isActive(to) && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                    style={{ background: '#00d4ff', boxShadow: '0 0 6px #00d4ff' }}
                  />
                )}
              </Link>
            ))}
            <Link
              to="/translate"
              className="ml-3 btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.8rem', minHeight: 38 }}
              onClick={handleNav}
              aria-label="Start translating"
            >
              <span>↗</span> Start
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2 ml-2 rounded-lg cursor-pointer transition-all duration-200"
            style={{
              background: drawerOpen ? 'rgba(0,212,255,0.06)' : 'transparent',
              border: drawerOpen ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent',
              minWidth: 44,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={drawerOpen}
          >
            <span
              className="block transition-all duration-300"
              style={{
                width: 20,
                height: 2,
                background: '#00d4ff',
                transform: drawerOpen ? 'rotate(45deg) translate(3px, 3px)' : 'none',
                borderRadius: 2,
              }}
            />
            <span
              className="block transition-all duration-300"
              style={{
                width: 20,
                height: 2,
                background: '#00d4ff',
                opacity: drawerOpen ? 0 : 1,
                borderRadius: 2,
              }}
            />
            <span
              className="block transition-all duration-300"
              style={{
                width: 20,
                height: 2,
                background: '#00d4ff',
                transform: drawerOpen ? 'rotate(-45deg) translate(3px, -3px)' : 'none',
                borderRadius: 2,
              }}
            />
          </button>
        </div>
      </nav>

      {/* Mobile/Tablet Drawer */}
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{
            background: 'rgba(2,4,8,0.8)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            pointerEvents: drawerOpen ? 'all' : 'none',
            opacity: drawerOpen ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
          onClick={handleNav}
        />

        {/* Slide panel */}
        <div
          className="fixed top-0 right-0 bottom-0 z-50 md:hidden flex flex-col pt-20 px-5 gap-2"
          style={{
            width: 'min(280px, 80vw)',
            background: '#080d14',
            borderLeft: '1px solid #1a2535',
            transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
            paddingBottom: 'env(safe-area-inset-bottom, 24px)',
          }}
        >
          {/* Nav items */}
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={handleNav}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl no-underline transition-all duration-200"
              style={{
                color: isActive(to) ? '#00d4ff' : '#6b8ba4',
                background: isActive(to) ? 'rgba(0,212,255,0.07)' : 'transparent',
                borderLeft: isActive(to) ? '3px solid #00d4ff' : '3px solid transparent',
                fontSize: '1rem',
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 500,
                minHeight: 52,
              }}
            >
              {label}
            </Link>
          ))}

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #1a2535' }}>
            <Link
              to="/translate"
              onClick={handleNav}
              className="btn-primary w-full justify-center"
              style={{ minHeight: 52, fontSize: '0.95rem' }}
            >
              ↗ Start Translating
            </Link>
          </div>

          {/* Bottom branding */}
          <div className="mt-auto pb-4">
            <p className="hud-label text-center" style={{ fontSize: '0.55rem' }}>LexiSight · SDG 10 · AIESEC 2026</p>
          </div>
        </div>
      </>
    </>
  )
}
