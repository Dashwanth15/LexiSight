import { lazy, Suspense, useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import ToastNotif from './components/ToastNotif.jsx'
import OnboardingModal from './components/OnboardingModal.jsx'
import PWAInstallBanner from './components/PWAInstallBanner.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import PageLoader from './components/PageLoader.jsx'
import Landing from './pages/Landing.jsx'

// Lazy load heavy pages with 2.5s minimum delay for cinematic transition
const delay = (ms) => new Promise(r => setTimeout(r, ms))
const delayedLazy = (importFn) => lazy(() =>
  Promise.all([importFn(), delay(2500)]).then(([mod]) => mod)
)

const Translator = delayedLazy(() => import('./pages/Translator.jsx'))
const About = delayedLazy(() => import('./pages/About.jsx'))
const Train = delayedLazy(() => import('./pages/Train.jsx'))
const Learn = delayedLazy(() => import('./pages/Learn.jsx'))
const Impact = delayedLazy(() => import('./pages/Impact.jsx'))
const Dictionary = delayedLazy(() => import('./pages/Dictionary.jsx'))
const Community = delayedLazy(() => import('./pages/Community.jsx'))
const Settings = delayedLazy(() => import('./pages/Settings.jsx'))

export default function App() {
  const [splashDone, setSplashDone] = useState(() => {
    return sessionStorage.getItem('lxi_splash_shown') === 'true'
  })

  const handleSplashFinished = useCallback(() => {
    setSplashDone(true)
    sessionStorage.setItem('lxi_splash_shown', 'true')
  }, [])

  useEffect(() => {
    if (!sessionStorage.getItem('lxi_session_counted')) {
      const cur = parseInt(localStorage.getItem('lxi_stat_sessions') || '28', 10)
      localStorage.setItem('lxi_stat_sessions', cur + 1)
      sessionStorage.setItem('lxi_session_counted', 'true')
    }
  }, [])

  // Show ONLY splash screen until it completes
  if (!splashDone) {
    return (
      <BrowserRouter>
        <SplashScreen onFinished={handleSplashFinished} />
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
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
          <Route path="*" element={<Landing />} />
        </Routes>
      </Suspense>
      <ToastNotif />
    </BrowserRouter>
  )
}
