// CONTROL BAR — Modern floating pill dock
export default function CallControls({
  isAudioEnabled,
  isVideoEnabled,
  isCCEnabled = false,
  isSignModeEnabled = false,
  onToggleAudio,
  onToggleVideo,
  onToggleCC,
  onToggleSignMode,
  onLeave,
}) {
  return (
    <div className="call-ctrl-bar">

      {/* Mic */}
      <div className="call-ctrl-wrap">
        <button
          className={`call-ctrl-btn ${isAudioEnabled ? 'on' : 'off'}`}
          onClick={onToggleAudio}
          title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isAudioEnabled ? (
              <>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </>
            ) : (
              <>
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </>
            )}
          </svg>
        </button>
        <span className="call-ctrl-label">{isAudioEnabled ? 'Mic' : 'Muted'}</span>
      </div>

      {/* Camera */}
      <div className="call-ctrl-wrap">
        <button
          className={`call-ctrl-btn ${isVideoEnabled ? 'on' : 'off'}`}
          onClick={onToggleVideo}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isVideoEnabled ? (
              <>
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </>
            ) : (
              <>
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </>
            )}
          </svg>
        </button>
        <span className="call-ctrl-label">{isVideoEnabled ? 'Camera' : 'Off'}</span>
      </div>

      {/* CONTROL BAR — CC toggle (only shown when onToggleCC provided) */}
      {onToggleCC && (
        <div className="call-ctrl-wrap">
          <button
            className={`call-ctrl-btn ${isCCEnabled ? 'cc-on' : 'cc-off'}`}
            onClick={onToggleCC}
            title={isCCEnabled ? 'Hide captions' : 'Show captions'}
          >
            {/* CC icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="3" />
              <path d="M8 12h.01" strokeWidth="2.5" />
              <path d="M7 12a2 2 0 1 0 2-2" />
              <path d="M15 12h.01" strokeWidth="2.5" />
              <path d="M14 12a2 2 0 1 0 2-2" />
            </svg>
          </button>
          <span className="call-ctrl-label">CC</span>
        </div>
      )}

      {/* Sign language mode — local MediaPipe + ML → captions to peer */}
      {onToggleSignMode && (
        <div className="call-ctrl-wrap">
          <button
            className={`call-ctrl-btn ${isSignModeEnabled ? 'sign-on' : 'sign-off'}`}
            onClick={onToggleSignMode}
            title={isSignModeEnabled ? 'Turn off sign language mode' : 'Turn on sign language mode'}
            aria-pressed={isSignModeEnabled}
          >
            <span style={{ fontSize: '1.15rem', lineHeight: 1 }} aria-hidden>🤟</span>
          </button>
          <span className="call-ctrl-label">{isSignModeEnabled ? 'Sign' : 'Sign'}</span>
        </div>
      )}

      {/* CONTROL BAR — divider before leave */}
      <div className="call-ctrl-divider" aria-hidden="true" />

      {/* Leave */}
      <button className="call-ctrl-btn end" onClick={onLeave} title="Leave call">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91" />
          <line x1="23" y1="1" x2="1" y2="23" />
        </svg>
        Leave
      </button>

    </div>
  )
}
