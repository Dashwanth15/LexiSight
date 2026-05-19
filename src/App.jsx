import { lazy, Suspense, useEffect } from 'react'
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
<<<<<<< HEAD
            {/* NEW CODE — 3D Avatar route */}
            <Route path="/avatar3d" element={<Avatar3D />} />
=======
            {/* NEW CODE — Call room route */}
            <Route path="/room/:roomCode?" element={<CallRoom />} />
>>>>>>> 6233111f5041b0c3b15dd59e4772a1c57cfd3704
            <Route path="*" element={<Landing />} />
          </Routes>
        </Suspense>
        <ToastNotif />
      </ClassifierProvider>
    </BrowserRouter>
  )
}
