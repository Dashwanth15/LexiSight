import { useEffect, useState } from 'react'

/**
 * ThemeToggle — Dark / Light mode button
 * Swaps CSS custom properties via data-theme attribute on <html>
 * Persists choice in localStorage
 */

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('lxi_theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('lxi_theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  return { theme, toggle }
}

export default function ThemeToggle({ theme, onToggle, compact = false }) {
  const isDark = theme === 'dark'
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
        border: `1px solid ${isDark ? '#1a2535' : '#d0dae6'}`,
        borderRadius: 8,
        color: isDark ? '#6b8ba4' : '#4a6070',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: compact ? 36 : 40,
        height: compact ? 36 : 40,
        fontSize: '1rem',
        transition: 'all 0.25s',
        flexShrink: 0,
      }}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}
