// MODIFIED — Added ConvexProviderWithClerk for realtime backend
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient } from 'convex/react'
import App from './App.jsx'
import './styles/globals.css'

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </React.StrictMode>,
)