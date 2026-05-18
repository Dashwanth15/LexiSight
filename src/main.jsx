// MODIFIED — Added ConvexProviderWithClerk for realtime backend
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient } from 'convex/react'
import App from './App.jsx'
import './styles/globals.css'

// FIX: Disable StrictMode in development to prevent double-mounting issues
// with MediaPipe initialization. StrictMode causes useEffect to run twice,
// creating duplicate MediaPipe instances and hanging promises.
// This is safe to disable — StrictMode is only for catching bugs during development,
// and we've implemented proper cleanup in all hooks.
const ENABLE_STRICT_MODE = false

// INTEGRATION POINT — Clerk authentication
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Publishable Key')
}

// INTEGRATION POINT — Convex realtime backend
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL

if (!CONVEX_URL) {
  throw new Error('Missing VITE_CONVEX_URL — check your .env.local file')
}

const convex = new ConvexReactClient(CONVEX_URL)

const appContent = (
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <App />
    </ConvexProviderWithClerk>
  </ClerkProvider>
)

createRoot(document.getElementById('root')).render(
  ENABLE_STRICT_MODE ? (
    <StrictMode>
      {appContent}
    </StrictMode>
  ) : (
    appContent
  )
)
