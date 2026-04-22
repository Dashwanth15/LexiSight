import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import ToastNotif from './components/ToastNotif.jsx'
import OnboardingModal from './components/OnboardingModal.jsx'
import PWAInstallBanner from './components/PWAInstallBanner.jsx'
import Landing from './pages/Landing.jsx'

// Lazy load heavy pages
const Translator = lazy(() => import('./pages/Translator.jsx'))
const About = lazy(() => import('./pages/About.jsx'))
const Train = lazy(() => import('./pages/Train.jsx'))
const Learn = lazy(() => import('./pages/Learn.jsx'))
const Impact = lazy(() => import('./pages/Impact.jsx'))
const Dictionary = lazy(() => import('./pages/Dictionary.jsx'))
const Community = lazy(() => import('./pages/Community.jsx'))

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
  return (
    <BrowserRouter>
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
          <Route path="*" element={<Landing />} />
        </Routes>
      </Suspense>
      <ToastNotif />
    </BrowserRouter>
  )
}
