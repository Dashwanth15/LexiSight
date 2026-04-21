export default function VoiceSelector({ voices, selectedVoice, onSelect, className = '' }) {
  if (!voices || voices.length === 0) return null

  // Group: Indian English first, then other English, then rest
  const indVoices = voices.filter(v => v.lang === 'en-IN')
  const enVoices = voices.filter(v => v.lang.startsWith('en') && v.lang !== 'en-IN')
  const otherVoices = voices.filter(v => !v.lang.startsWith('en'))

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="hud-label">Voice</span>
      <select
        value={selectedVoice?.name || ''}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full text-sm rounded-lg px-3 py-2 outline-none cursor-pointer"
        style={{
          background: '#0d1520',
          border: '1px solid #1a2535',
          color: '#e8f4fd',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '0.8rem',
        }}
        aria-label="Select speech synthesis voice"
      >
        {indVoices.length > 0 && (
          <optgroup label="🇮🇳 Indian English">
            {indVoices.map(v => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </optgroup>
        )}
        {enVoices.length > 0 && (
          <optgroup label="English">
            {enVoices.map(v => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </optgroup>
        )}
        {otherVoices.length > 0 && (
          <optgroup label="Other">
            {otherVoices.map(v => (
              <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  )
}
