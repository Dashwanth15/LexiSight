/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'void': '#020408',
        'obsidian': '#080d14',
        'surface': '#0d1520',
        'border-dark': '#1a2535',
        'cyan-primary': '#00d4ff',
        'violet-primary': '#8b5cf6',
        'green-neon': '#00ff88',
        'amber-neon': '#ffaa00',
        'red-neon': '#ff3366',
        'text-primary': '#e8f4fd',
        'text-secondary': '#6b8ba4',
        'text-data': '#00d4ff',
      },
      fontFamily: {
        'syne': ['Syne', 'sans-serif'],
        'dm': ['DM Sans', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'scanline': 'scanline 3s linear infinite',
        'glitch': 'glitch 8s infinite',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'node-pulse': 'node-pulse 2s ease-in-out infinite',
        'data-stream': 'data-stream 10s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'count-up': 'count-up 1s ease-out forwards',
        'slide-in-left': 'slide-in-left 0.6s ease-out',
        'slide-in-right': 'slide-in-right 0.6s ease-out',
        'fade-up': 'fade-up 0.5s ease-out',
        'typing': 'typing 3.5s steps(40, end), blink 0.75s step-end infinite',
        'wipe-in': 'wipe-in 0.4s ease-out',
      },
      keyframes: {
        scanline: {
          '0%': { top: '0%' },
          '100%': { top: '100%' }
        },
        glitch: {
          '0%, 92%, 100%': { transform: 'translate(0)', clipPath: 'none', opacity: '1' },
          '93%': { transform: 'translate(-3px, 1px)', clipPath: 'polygon(0 30%, 100% 30%, 100% 50%, 0 50%)', opacity: '0.9' },
          '94%': { transform: 'translate(3px, -1px)', clipPath: 'polygon(0 50%, 100% 50%, 100% 70%, 0 70%)', opacity: '0.9' },
          '95%': { transform: 'translate(0)', clipPath: 'none', opacity: '1' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(2.5)', opacity: '0' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'node-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.7' },
          '50%': { transform: 'scale(1.5)', opacity: '1' }
        },
        'data-stream': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-100%)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-60px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(60px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        'fade-up': {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        typing: {
          'from': { width: '0' },
          'to': { width: '100%' }
        },
        blink: {
          '0%, 100%': { borderColor: 'transparent' },
          '50%': { borderColor: '#00d4ff' }
        },
        'wipe-in': {
          '0%': { clipPath: 'inset(0 100% 0 0)' },
          '100%': { clipPath: 'inset(0 0% 0 0)' }
        }
      },
      boxShadow: {
        'cyan-glow': '0 0 20px rgba(0,212,255,0.4)',
        'violet-glow': '0 0 20px rgba(139,92,246,0.4)',
        'green-glow': '0 0 30px rgba(0,255,136,0.5)',
        'red-glow': '0 0 20px rgba(255,51,102,0.4)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
