// SubtitleOverlay.jsx — Production subtitle overlay
// SUBTITLE STABILITY | PERFORMANCE FIX | INTEGRATION POINT
import { useRef, useEffect } from 'react'
import useSpeechCaptions from '../../hooks/useSpeechCaptions.js'

// SUBTITLE STABILITY: CSS injected once at module level
const STYLE_ID = 'lexisight-subtitle-styles'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    @keyframes subtitle-bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
      40%            { transform: translateY(-4px); opacity: 1; }
    }
    @keyframes subtitle-fade-in {
      from { opacity: 0; transform: translateX(-50%) translateY(4px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .subtitle-box {
      position: absolute;
      bottom: 44px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 20;
      max-width: 90%;
      width: max-content;
      text-align: center;
      pointer-events: none;
      animation: subtitle-fade-in 0.18s ease-out both;
      /* SUBTITLE STABILITY: smooth box resize when text grows/shrinks */
      transition: max-width 0.2s ease;
    }
    .subtitle-inner {
      display: inline-block;
      padding: 7px 16px;
      background: rgba(0,0,0,0.76);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 9px;
      border: 1px solid rgba(255,255,255,0.07);
      box-shadow: 0 2px 20px rgba(0,0,0,0.55);
      max-width: 100%;
    }
    .subtitle-final {
      font-family: 'DM Sans', sans-serif;
      font-size: clamp(0.8rem, 2vw, 0.96rem);
      color: #ffffff;
      font-weight: 400;
      line-height: 1.5;
      letter-spacing: 0.01em;
      word-break: break-word;
    }
    .subtitle-interim {
      font-family: 'DM Sans', sans-serif;
      font-size: clamp(0.8rem, 2vw, 0.96rem);
      color: rgba(255,255,255,0.5);
      font-weight: 400;
      line-height: 1.5;
      letter-spacing: 0.01em;
      font-style: italic;
      /* SUBTITLE STABILITY: smooth interim text changes */
      transition: opacity 0.12s ease;
    }
    .subtitle-dot {
      display: inline-block;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgba(0,212,255,0.85);
    }
    .subtitle-error {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 20;
      padding: 4px 12px;
      background: rgba(255,51,102,0.18);
      border: 1px solid rgba(255,51,102,0.35);
      border-radius: 6px;
      color: #ff6688;
      font-family: 'DM Sans', sans-serif;
      font-size: 0.72rem;
      pointer-events: none;
      white-space: nowrap;
    }
  `
  document.head.appendChild(s)
}

/**
 * SubtitleOverlay
 * @param {boolean} enabled    – master on/off
 * @param {boolean} showError  – surface mic / browser errors in UI
 */
export default function SubtitleOverlay({ enabled = true, showError = false }) {
  // SUBTITLE STABILITY: consume 3-layer text from hook
  // stableText  — locked/committed sentence (persists through silence)
  // interimText — live in-progress words (dimmer, italic)
  const { stableText, interimText, isListening, isSupported, error } =
    useSpeechCaptions(enabled)

  if (!isSupported && !showError) return null

  // SUBTITLE STABILITY: show interim only when it adds meaningful new content
  // (avoids double-displaying words that are already locked in stableText)
  const showInterim = interimText && !stableText.endsWith(interimText.trim())
  const showSubtitles = !!(stableText || showInterim)

  return (
    <>
      {/* Accessibility: live region for screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}
      >
        {stableText}
      </div>

      {/* SUBTITLE STABILITY: Visible subtitle box */}
      {showSubtitles && (
        <div className="subtitle-box">
          <div className="subtitle-inner">
            {/* SUBTITLE STABILITY: locked/stable layer — white, solid */}
            {stableText && (
              <span className="subtitle-final">{stableText}</span>
            )}
            {/* SUBTITLE STABILITY: live interim layer — grey, italic, only when distinct */}
            {showInterim && (
              <span className="subtitle-interim">
                {stableText ? ' ' : ''}{interimText}
              </span>
            )}
          </div>
        </div>
      )}

      {/* SUBTITLE STABILITY: Listening pulse — only shown when truly idle */}
      {isListening && !showSubtitles && enabled && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 44,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 11px',
            background: 'rgba(0,0,0,0.52)',
            borderRadius: 20,
          }}
        >
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="subtitle-dot"
              style={{ animation: `subtitle-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      )}

      {/* Error (opt-in) */}
      {showError && error && (
        <div className="subtitle-error">⚠ {error}</div>
      )}
    </>
  )
}
