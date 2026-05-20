import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import ToastNotif from './components/ToastNotif.jsx'
import OnboardingModal from './components/OnboardingModal.jsx'
import PWAInstallBanner from './components/PWAInstallBanner.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import Landing from './pages/Landing.jsx'
import { ClassifierProvider } from './contexts/ClassifierContext.jsx'
import PageLoader from './components/PageLoader.jsx'

// Enforce a minimum 800ms loading time so the terminal animation is visible
const lazyWithDelay = (importFunc, delay = 800) => 
  lazy(() => Promise.all([
    importFunc(),
    new Promise(resolve => setTimeout(resolve, delay))
  ]).then(([module]) => module))

// Lazy load heavy pages
const Translator = lazyWithDelay(() => import('./pages/Translator.jsx'))
const About = lazyWithDelay(() => import('./pages/About.jsx'))
const Train = lazyWithDelay(() => import('./pages/Train.jsx'))
const Learn = lazyWithDelay(() => import('./pages/Learn.jsx'))
const Impact = lazyWithDelay(() => import('./pages/Impact.jsx'))
const Dictionary = lazyWithDelay(() => import('./pages/Dictionary.jsx'))
const Community = lazyWithDelay(() => import('./pages/Community.jsx'))
const Settings = lazyWithDelay(() => import('./pages/Settings.jsx'))
// NEW CODE — 3D Avatar dashboard page
const Avatar3D = lazyWithDelay(() => import('./pages/Avatar3D.jsx'))
// NEW CODE — WebRTC calling room (isolated from AI pipelines)
const CallRoom = lazyWithDelay(() => import('./pages/CallRoom.jsx'))

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    // Only show splash once per session
    return !sessionStorage.getItem('lxi_splash_shown')
  })

  useEffect(() => {
    if (!sessionStorage.getItem('lxi_session_counted')) {
      const cur = parseInt(localStorage.getItem('lxi_stat_sessions') || '28', 10)
      localStorage.setItem('lxi_stat_sessions', cur + 1)
      sessionStorage.setItem('lxi_session_counted', 'true')
    }
  }, [])

  const handleSplashFinished = () => {
    setShowSplash(false)
    sessionStorage.setItem('lxi_splash_shown', 'true')
  }

  // FIX — ClassifierProvider inside BrowserRouter but OUTSIDE Suspense
  // so lazy-loaded pages can access the context immediately.
  return (
    <BrowserRouter>
      {showSplash && <SplashScreen onFinished={handleSplashFinished} />}
      <ClassifierProvider>
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--void)' }}>
          <Navbar />
          <OnboardingModal />
          <PWAInstallBanner />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/translate" element={<Translator />} />
              <Route path="/about" element={<About />} />
              <Route path="/train" element={<Train />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/impact" element={<Impact />} />
              <Route path="/dictionary" element={<Dictionary />} />
              <Route path="/community" element={<Community />} />
              <Route path="/settings" element={<Settings />} />
              {/* NEW CODE — 3D Avatar route */}
              <Route path="/avatar3d" element={<Avatar3D />} />
              {/* NEW CODE — Call room route */}
              <Route path="/room/:roomCode?" element={<CallRoom />} />
              <Route path="*" element={<Landing />} />
            </Routes>
          </Suspense>
        </div>
        <ToastNotif />
      </ClassifierProvider>
    </BrowserRouter>
  )
}
