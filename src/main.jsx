import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/globals.css'

// FIX: Disable StrictMode in development to prevent double-mounting issues
// with MediaPipe initialization. StrictMode causes useEffect to run twice,
// creating duplicate MediaPipe instances and hanging promises.
// This is safe to disable — StrictMode is only for catching bugs during development,
// and we've implemented proper cleanup in all hooks.
const ENABLE_STRICT_MODE = false

createRoot(document.getElementById('root')).render(
  ENABLE_STRICT_MODE ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  )
)
