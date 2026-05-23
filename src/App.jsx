import { lazy, Suspense, useEffect, Component } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import ToastNotif from './components/ToastNotif.jsx'
import OnboardingModal from './components/OnboardingModal.jsx'
import PWAInstallBanner from './components/PWAInstallBanner.jsx'
import Landing from './pages/Landing.jsx'
import { ClassifierProvider } from './contexts/ClassifierContext.jsx'

// Lazy load heavy pages
const Translator = lazy(() => import('./pages/Translator.jsx'))
const About = lazy(() => import('./pages/About.jsx'))
const Train = lazy(() => import('./pages/Train.jsx'))
const Learn = lazy(() => import('./pages/Learn.jsx'))
const Impact = lazy(() => import('./pages/Impact.jsx'))
const Dictionary = lazy(() => import('./pages/Dictionary.jsx'))
const Community = lazy(() => import('./pages/Community.jsx'))
// NEW CODE — 3D Avatar dashboard page
const Avatar3D = lazy(() => import('./pages/Avatar3D.jsx'))

// NEW CODE — WebRTC calling room (isolated from AI pipelines)
const CallRoom = lazy(() => import('./pages/CallRoom.jsx'))

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#020408' }}>
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-10 h-10 rounded-full border-2"
          style={{
            borderColor: 'transparent',
            borderTopColor: '#00d4ff',
            borderRightColor: '#8b5cf6',
            animation: 'spin-slow 1s linear infinite',
          }}
        />
        <span className="hud-label">Loading...</span>
      </div>
    </div>
  )
}

// FIX — ErrorBoundary prevents lazy-load/render crashes from producing
// a chrome-error://chromewebdata/ blank screen
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || 'Unknown error' }
  }
  componentDidCatch(err, info) {
    console.error('[LexiSight] Render error:', err, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#020408',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            padding: 32, maxWidth: 420, textAlign: 'center',
            border: '1px solid rgba(255,51,102,0.3)',
            borderRadius: 12, background: 'rgba(255,51,102,0.06)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', color: '#e8f4fd', marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ color: '#6b8ba4', fontSize: '0.85rem', marginBottom: 20 }}>{this.state.message}</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }}
              style={{
                padding: '8px 20px', background: 'rgba(0,212,255,0.1)',
                border: '1px solid rgba(0,212,255,0.3)', borderRadius: 8,
                color: '#00d4ff', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}
            >
              Return home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  useEffect(() => {
    if (!sessionStorage.getItem('lxi_session_counted')) {
      const cur = parseInt(localStorage.getItem('lxi_stat_sessions') || '28', 10)
      localStorage.setItem('lxi_stat_sessions', cur + 1)
      sessionStorage.setItem('lxi_session_counted', 'true')
    }
  }, [])

  // FIX — ClassifierProvider inside BrowserRouter but OUTSIDE Suspense
  // so lazy-loaded pages can access the context immediately.
  return (
    <BrowserRouter>
      <ClassifierProvider>
        <Navbar />
        <OnboardingModal />
        <PWAInstallBanner />
        <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/translate" element={<Translator />} />
            <Route path="/about" element={<About />} />
            <Route path="/train" element={<Train />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/impact" element={<Impact />} />
            <Route path="/dictionary" element={<Dictionary />} />
            <Route path="/community" element={<Community />} />
            {/* NEW CODE — 3D Avatar route */}
            <Route path="/avatar3d" element={<Avatar3D />} />
            {/* NEW CODE — Call room route */}
            <Route path="/room/:roomCode?" element={<CallRoom />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
        <ToastNotif />
      </ClassifierProvider>
    </BrowserRouter>
  )
}
