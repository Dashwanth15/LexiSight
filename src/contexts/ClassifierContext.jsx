// ═══════════════════════════════════════════════════════════════════════════
// ClassifierContext — Shared classifier instance
// Without this, every hook that called useClassifier() created its own copy
// of the models (3x downloads) and its own temporal buffer → Photo and
// Video could never share the Live mode state.
// ═══════════════════════════════════════════════════════════════════════════
import { createContext, useContext } from 'react'
import { useClassifier } from '../hooks/useClassifier.js'

const ClassifierContext = createContext(null)

export function ClassifierProvider({ children }) {
  // This is the ONLY place useClassifier() should run in the app.
  const classifier = useClassifier()
  return (
    <ClassifierContext.Provider value={classifier}>
      {children}
    </ClassifierContext.Provider>
  )
}

/** Consumer hook — used by Live / Photo / Video / Learn. */
export function useSharedClassifier() {
  const ctx = useContext(ClassifierContext)
  if (!ctx) {
    throw new Error(
      'useSharedClassifier must be used within <ClassifierProvider>. ' +
      'Wrap your <App /> (see App.jsx).'
    )
  }
  return ctx
}
