import { useState, useRef } from 'react'
import { useSettings } from '../hooks/useSettings.jsx'
import { useTranslation } from '../hooks/useTranslation.js'

// ── Sub-components ──
function Toggle({ checked, onChange, label, desc }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom:'1px solid var(--border)' }}>
      <div className="flex-1 pr-4">
        <div style={{ color:'var(--text-primary)', fontSize:'0.88rem', fontWeight:500 }}>{label}</div>
        {desc && <div style={{ color:'var(--text-secondary)', fontSize:'0.72rem', marginTop:2 }}>{desc}</div>}
      </div>
      <label className="toggle"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span className="toggle-slider" /></label>
    </div>
  )
}

function Slider({ value, onChange, min, max, step, label, desc, unit='' }) {
  return (
    <div className="py-3" style={{ borderBottom:'1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div style={{ color:'var(--text-primary)', fontSize:'0.88rem', fontWeight:500 }}>{label}</div>
          {desc && <div style={{ color:'var(--text-secondary)', fontSize:'0.72rem', marginTop:2 }}>{desc}</div>}
        </div>
        <span className="mono" style={{ color:'var(--cyan)', fontSize:'0.8rem' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  )
}

function Select({ value, onChange, options, label, desc }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom:'1px solid var(--border)' }}>
      <div className="flex-1 pr-4">
        <div style={{ color:'var(--text-primary)', fontSize:'0.88rem', fontWeight:500 }}>{label}</div>
        {desc && <div style={{ color:'var(--text-secondary)', fontSize:'0.72rem', marginTop:2 }}>{desc}</div>}
      </div>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        background:'var(--surface)', color:'var(--text-primary)', border:'1px solid var(--border)',
        borderRadius:6, padding:'6px 10px', fontSize:'0.8rem', fontFamily:'DM Sans, sans-serif', outline:'none',
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function Section({ icon, title, children, defaultOpen=false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="glass-card" style={{ marginBottom:12, overflow:'hidden' }}>
      <button onClick={() => setOpen(!open)} style={{
        width:'100%', display:'flex', alignItems:'center', gap:10, padding:'14px 16px',
        background:'transparent', border:'none', cursor:'pointer', color:'var(--text-primary)',
      }}>
        <span style={{ fontSize:'1.2rem' }}>{icon}</span>
        <span style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'0.85rem', letterSpacing:'0.08em', textTransform:'uppercase', flex:1, textAlign:'left' }}>{title}</span>
        <span style={{ color:'var(--cyan)', fontSize:'0.9rem', transform:open?'rotate(180deg)':'rotate(0)', transition:'transform 0.2s' }}>▾</span>
      </button>
      {open && <div style={{ padding:'0 16px 16px' }}>{children}</div>}
    </div>
  )
}

function ActionButton({ onClick, label, icon, color='var(--cyan)', danger=false }) {
  return (
    <button onClick={onClick} className={danger ? 'btn-danger' : 'btn-secondary'} style={{ width:'100%', justifyContent:'center', marginBottom:8 }}>
      {icon && <span>{icon}</span>} {label}
    </button>
  )
}

// ── Main Settings Page ──
export default function Settings() {
  const { t } = useTranslation()
  const { settings: s, updateSetting, resetSettings, exportSettings, importSettings, DEFAULTS } = useSettings()
  const [toast, setToast] = useState(null)
  const fileRef = useRef(null)

  const set = (key, val) => updateSetting(key, val)


  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const handleReset = () => {
    resetSettings()
    showToast(t('settings_toast_reset'))
  }

  const handleExport = () => {
    exportSettings()
    showToast(t('settings_toast_export'))
  }

  const handleImport = async (e) => {
    const ok = await importSettings(e)
    if (ok) showToast(t('settings_toast_import'))
  }

  const LANGS = [
    { value:'en', label:'English' }, { value:'hi', label:'Hindi' }, { value:'te', label:'Telugu' },
    { value:'ta', label:'Tamil' }, { value:'kn', label:'Kannada' }
  ]

  return (
    <div className="min-h-screen" style={{ paddingTop:80, paddingBottom:40, background:'var(--void)' }}>
      <div style={{ maxWidth:680, margin:'0 auto', padding:'0 16px' }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontFamily:'Syne, sans-serif', fontSize:'1.8rem', fontWeight:800, color:'var(--text-primary)' }}>
            ⚙️ {t('settings_title')}
          </h1>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.82rem', marginTop:4 }}>
            {t('settings_desc')}
          </p>
        </div>

        {/* ── Language & Speech ── */}
        <Section icon="🌐" title={t('settings_general')} defaultOpen={true}>
          <Select label={t('ui_language')} desc="UI display language" value={s.uiLanguage} onChange={v => set('uiLanguage', v)} options={LANGS} />
          <Select label="Speech Output Language" desc="Language for translated speech" value={s.speechLanguage} onChange={v => set('speechLanguage', v)} options={LANGS} />
          <Select label="Voice Type" value={s.voiceGender} onChange={v => set('voiceGender', v)} options={[
            { value:'female', label:'Female' }, { value:'male', label:'Male' }, { value:'system', label:'System Default' },
          ]} />
          <Slider label="Speech Speed" desc="0.5× slow — 2× fast" value={s.speechSpeed} onChange={v => set('speechSpeed', v)} min={0.5} max={2} step={0.1} unit="×" />
          <Slider label="Speech Volume" value={s.speechVolume} onChange={v => set('speechVolume', v)} min={0} max={1} step={0.1} />
          <Slider label="Speech Pitch" desc="Voice pitch level" value={s.speechPitch} onChange={v => set('speechPitch', v)} min={0.5} max={2} step={0.1} />
          <Toggle label="Auto Speak" desc="Speak translations automatically" checked={s.autoSpeak} onChange={v => set('autoSpeak', v)} />
          <Toggle label="Mute Translation Audio" desc="Silent text-only mode" checked={s.muteAudio} onChange={v => set('muteAudio', v)} />
          <Select label="Mic Input Language" desc="Speech-to-text recognition" value={s.micLanguage} onChange={v => set('micLanguage', v)} options={[
            { value:'en-IN', label:'English (India)' }, { value:'hi-IN', label:'Hindi' }, { value:'te-IN', label:'Telugu' },
            { value:'ta-IN', label:'Tamil' }, { value:'kn-IN', label:'Kannada' },
          ]} />
          <Select label="Sign Language" value={s.signLanguage} onChange={v => set('signLanguage', v)} options={[
            { value:'isl', label:'ISL (Indian)' }, { value:'asl', label:'ASL (Coming Soon)' }, { value:'bsl', label:'BSL (Coming Soon)' },
          ]} />
        </Section>

        {/* ── Camera ── */}
        <Section icon="📷" title={t('settings_camera') || "Camera"}>
          <Select label="Camera" value={s.cameraFacing} onChange={v => set('cameraFacing', v)} options={[
            { value:'user', label:'Front Camera' }, { value:'environment', label:'Back Camera' }, { value:'external', label:'External Webcam' },
          ]} />
          <Select label="Resolution" desc="Higher = better accuracy, more battery" value={s.cameraResolution} onChange={v => set('cameraResolution', v)} options={[
            { value:'480p', label:'480p (Battery Saver)' }, { value:'720p', label:'720p (Balanced)' }, { value:'1080p', label:'1080p (High Accuracy)' },
          ]} />
          <Select label="FPS Limit" value={s.fpsLimit} onChange={v => set('fpsLimit', parseInt(v))} options={[
            { value:'15', label:'15 FPS' }, { value:'30', label:'30 FPS' }, { value:'60', label:'60 FPS' },
          ]} />
          <Toggle label="Auto-start Camera" desc="Open camera on app launch" checked={s.autoStartCamera} onChange={v => set('autoStartCamera', v)} />
          <Toggle label="Auto-stop Camera" desc="Stop when idle" checked={s.autoStopCamera} onChange={v => set('autoStopCamera', v)} />
          <Slider label="Idle Timeout" desc="Seconds before camera auto-stops" value={s.idleTimeout} onChange={v => set('idleTimeout', v)} min={30} max={600} step={30} unit="s" />
        </Section>

        {/* ── Performance ── */}
        <Section icon="⚡" title={t('settings_ai')}>
          <Select label="Mode" value={s.performanceMode} onChange={v => set('performanceMode', v)} options={[
            { value:'low-latency', label:'Low Latency (Fast)' }, { value:'balanced', label:'Balanced' }, { value:'high-accuracy', label:'High Accuracy' },
          ]} />
          <Toggle label="GPU Acceleration" desc="Use WebGL for faster inference" checked={s.gpuAcceleration} onChange={v => set('gpuAcceleration', v)} />
          <Select label="AI Backend" value={s.aiBackend} onChange={v => set('aiBackend', v)} options={[
            { value:'webgl', label:'WebGL' }, { value:'cpu', label:'CPU' }, { value:'wasm', label:'WASM' },
          ]} />
          <Toggle label="Battery Saver" desc="Reduce FPS and disable animations" checked={s.batterySaver} onChange={v => set('batterySaver', v)} />
          <Toggle label="Offline Mode" desc="Force all processing local-only" checked={s.offlineMode} onChange={v => set('offlineMode', v)} />
          <Toggle label="Adaptive Performance" desc="Auto-optimize for your device" checked={s.adaptivePerformance} onChange={v => set('adaptivePerformance', v)} />
          <Select label="AI Model Tier" value={s.modelTier} onChange={v => set('modelTier', v)} options={[
            { value:'lite', label:'Lite (Faster)' }, { value:'accurate', label:'Accurate (Default)' }, { value:'experimental', label:'Experimental' },
          ]} />
        </Section>

        {/* ── Detection & Recognition ── */}
        <Section icon="🖐️" title={t('settings_visuals')}>
          <Toggle label={t('hand_overlay')} desc="Show skeleton on camera" checked={s.handOverlay} onChange={v => set('handOverlay', v)} />
          <Slider label="Skeleton Thickness" value={s.skeletonThickness} onChange={v => set('skeletonThickness', v)} min={1} max={5} step={1} unit="px" />
          <Slider label="Landmark Point Size" value={s.landmarkSize} onChange={v => set('landmarkSize', v)} min={2} max={8} step={1} unit="px" />
          <Toggle label="Show Confidence %" desc="Display prediction confidence" checked={s.showConfidence} onChange={v => set('showConfidence', v)} />
          <Select label="Smoothing Level" desc="Low=responsive, High=stable" value={s.smoothingLevel} onChange={v => set('smoothingLevel', v)} options={[
            { value:'low', label:'Low' }, { value:'medium', label:'Medium' }, { value:'high', label:'High' },
          ]} />
          <Slider label="Stability Threshold" desc="Frames before confirming prediction" value={s.stabilityThreshold} onChange={v => set('stabilityThreshold', v)} min={1} max={10} step={1} />
          <Select label="Detection Sensitivity" value={s.detectionSensitivity} onChange={v => set('detectionSensitivity', v)} options={[
            { value:'strict', label:'Strict' }, { value:'balanced', label:'Balanced' }, { value:'sensitive', label:'Sensitive' },
          ]} />
          <Slider label="Gesture Timeout" desc="Seconds before sign resets" value={s.gestureTimeout} onChange={v => set('gestureTimeout', v)} min={1} max={10} step={1} unit="s" />
          <Slider label={t('confidence_thresh')} desc="Min confidence to show prediction" value={s.confidenceThreshold} onChange={v => set('confidenceThreshold', v)} min={0.3} max={0.95} step={0.05} />
          <Toggle label="Motion Smoothing" desc="Stabilize jittery hand movement" checked={s.motionSmoothing} onChange={v => set('motionSmoothing', v)} />
          <Toggle label="Single Hand Mode" desc="Faster, simpler detection" checked={s.singleHandMode} onChange={v => set('singleHandMode', v)} />
          <Select label="Dominant Hand" value={s.dominantHand} onChange={v => set('dominantHand', v)} options={[
            { value:'right', label:'Right' }, { value:'left', label:'Left' }, { value:'auto', label:'Auto Detect' },
          ]} />
        </Section>

        {/* ── Translation ── */}
        <Section icon="💬" title={t('settings_translation') || "Translation"}>
          <Toggle label="Continuous Mode" desc="Runs continuously for conversations" checked={s.continuousMode} onChange={v => set('continuousMode', v)} />
          <Toggle label="Sentence Builder" desc="Combine words into sentences" checked={s.sentenceBuilder} onChange={v => set('sentenceBuilder', v)} />
          <Toggle label="Grammar Correction" desc='"I FOOD EAT" → "I am eating food"' checked={s.grammarCorrection} onChange={v => set('grammarCorrection', v)} />
          <Toggle label="Auto Punctuation" desc="Add commas and periods" checked={s.autoPunctuation} onChange={v => set('autoPunctuation', v)} />
          <Toggle label="Duplicate Filter" desc="Prevent repeated word spam" checked={s.duplicateFilter} onChange={v => set('duplicateFilter', v)} />
          <Slider label="Prediction Cooldown" desc="Delay before next identical word" value={s.predictionCooldown} onChange={v => set('predictionCooldown', v)} min={0} max={3} step={0.1} unit="s" />
          <Toggle label="Auto-clear Sentence" desc="Clear after inactivity" checked={s.sentenceAutoClear} onChange={v => set('sentenceAutoClear', v)} />
          <Slider label="Clear Timer" desc="Seconds of inactivity" value={s.sentenceClearTimer} onChange={v => set('sentenceClearTimer', v)} min={3} max={60} step={1} unit="s" />
        </Section>

        {/* ── History ── */}
        <Section icon="📜" title={t('settings_history') || "History"}>
          <Toggle label="Save Translation History" checked={s.translationHistory} onChange={v => set('translationHistory', v)} />
          <Select label="History Length" value={s.historyLength} onChange={v => set('historyLength', parseInt(v))} options={[
            { value:'10', label:'Last 10' }, { value:'50', label:'Last 50' }, { value:'500', label:'Unlimited' },
          ]} />
          <ActionButton label="Export History (CSV)" icon="📥" onClick={() => {
            const hist = JSON.parse(localStorage.getItem('lxi_feedback') || '[]')
            if (!hist.length) { showToast('No history to export'); return }
            const csv = 'Label,Confidence,Correct,Timestamp\n' + hist.map(h => `${h.label},${h.confidence},${h.isCorrect},${h.timestamp}`).join('\n')
            const blob = new Blob([csv], { type:'text/csv' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lexisight_history.csv'; a.click()
            showToast('History exported!')
          }} />
          <ActionButton label="Clear All History" icon="🗑️" danger onClick={() => {
            localStorage.removeItem('lxi_feedback'); showToast('History cleared')
          }} />
        </Section>

        {/* ── Accessibility ── */}
        <Section icon="♿" title={t('settings_accessibility') || "Accessibility"}>
          <Toggle label="Large Text Mode" checked={s.largeText} onChange={v => set('largeText', v)} />
          <Toggle label="High Contrast Mode" checked={s.highContrast} onChange={v => set('highContrast', v)} />
          <Select label="Font Size" value={s.fontSize} onChange={v => set('fontSize', v)} options={[
            { value:'small', label:'Small' }, { value:'medium', label:'Medium' }, { value:'large', label:'Large' }, { value:'extra-large', label:'Extra Large' },
          ]} />
          <Toggle label="Haptic Feedback" desc="Vibrate on detection" checked={s.hapticFeedback} onChange={v => set('hapticFeedback', v)} />
          <Toggle label="Sound Feedback" desc="Beep on gesture recognized" checked={s.soundFeedback} onChange={v => set('soundFeedback', v)} />
          <Toggle label="Left-Handed Mode" checked={s.leftHandedMode} onChange={v => set('leftHandedMode', v)} />
          <Toggle label="Reduce Animations" desc="For motion-sensitive users" checked={s.animationReduction} onChange={v => set('animationReduction', v)} />
          <Toggle label="Minimal UI" desc="Clean distraction-free interface" checked={s.minimalUI} onChange={v => set('minimalUI', v)} />
        </Section>

        {/* ── Emergency ── */}
        <Section icon="🚨" title={t('settings_emergency') || "Emergency Mode"}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.78rem', marginBottom:12 }}>Quick-access phrases for urgent situations</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
            {s.emergencyPhrases.map((p, i) => (
              <span key={i} style={{
                padding:'6px 14px', borderRadius:20, fontSize:'0.82rem', fontWeight:600,
                background:'rgba(255,51,102,0.1)', border:'1px solid rgba(255,51,102,0.3)', color:'var(--red)',
              }}>{p}</span>
            ))}
          </div>
        </Section>

        {/* ── Privacy ── */}
        <Section icon="🔒" title={t('settings_privacy') || "Privacy & Security"}>
          <Toggle label="Privacy Mode" desc="Block all external requests" checked={s.privacyMode} onChange={v => set('privacyMode', v)} />
          <Toggle label="Disable Analytics" desc="No telemetry collection" checked={s.disableAnalytics} onChange={v => set('disableAnalytics', v)} />
          <div style={{ background:'rgba(0,255,136,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:8, padding:12, marginTop:8 }}>
            <p style={{ color:'var(--green)', fontSize:'0.78rem', fontWeight:600 }}>✅ All processing is 100% on-device</p>
            <p style={{ color:'var(--text-secondary)', fontSize:'0.7rem', marginTop:4 }}>Your video never leaves your device. LexiSight converts video to skeleton dots instantly and discards the frames.</p>
          </div>
        </Section>

        {/* ── Developer ── */}
        <Section icon="🛠️" title={t('settings_developer') || "Developer & Debug"}>
          <Toggle label="Debug Mode" desc="Show raw landmarks & bounding boxes" checked={s.debugMode} onChange={v => set('debugMode', v)} />
          <Toggle label="FPS Monitor" desc="Live performance stats" checked={s.showFPS} onChange={v => set('showFPS', v)} />
          <Toggle label="Inference Speed" desc="Show model prediction time" checked={s.showInferenceSpeed} onChange={v => set('showInferenceSpeed', v)} />
          <ActionButton label="Clear Model Cache" icon="🔄" onClick={() => {
            if (caches) { caches.delete('model-cache').then(() => showToast('Model cache cleared')) }
          }} />
          <ActionButton label="Run Device Compatibility Test" icon="🧪" onClick={() => {
            const gl = !!document.createElement('canvas').getContext('webgl2')
            const cam = !!navigator.mediaDevices?.getUserMedia
            showToast(`WebGL2: ${gl?'✅':'❌'} | Camera: ${cam?'✅':'❌'}`)
          }} />
        </Section>

        {/* ── Data Management ── */}
        <Section icon="💾" title={t('settings_data') || "Data Management"}>
          <ActionButton label={t('settings_export')} icon="📤" onClick={() => {
            exportSettings()
            showToast(t('settings_toast_export'))
          }} />
          <ActionButton label={t('settings_import')} icon="📥" onClick={() => fileRef.current?.click()} />
          <input ref={fileRef} type="file" accept=".json" style={{ display:'none' }} onChange={e => {
            const f = e.target.files[0]; if (!f) return
            importSettings(f)
            showToast(t('settings_toast_import'))
          }} />
          <ActionButton label={t('settings_reset')} icon="⚠️" danger onClick={() => {
            resetSettings(); showToast(t('settings_toast_reset'))
          }} />
        </Section>

        {/* ── About ── */}
        <Section icon="ℹ️" title={t('settings_about') || "About LexiSight"}>
          <div style={{ fontSize:'0.82rem', color:'var(--text-secondary)', lineHeight:1.8 }}>
            <p><strong style={{ color:'var(--text-primary)' }}>Version:</strong> 1.0.0</p>
            <p><strong style={{ color:'var(--text-primary)' }}>Model:</strong> Temporal Transformer v2 (95.2% acc)</p>
            <p><strong style={{ color:'var(--text-primary)' }}>Static Model:</strong> Dense v2 (94.3% acc)</p>
            <p><strong style={{ color:'var(--text-primary)' }}>Classes:</strong> 261 ISL words + 36 static</p>
            <p style={{ marginTop:8, fontSize:'0.72rem' }}>Built for AIESEC Youth Speak Ideathon 2026</p>
            <p style={{ fontSize:'0.72rem' }}>Dataset: INCLUDE (IIT Madras) + CISLR</p>
            <p style={{ fontSize:'0.72rem' }}>Powered by TensorFlow.js, MediaPipe, React</p>
          </div>
        </Section>

        <div style={{ height:40 }} />
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast info" style={{ animation:'slide-up-fade 0.3s ease-out' }}>
          <span style={{ fontSize:'0.85rem' }}>{toast}</span>
        </div>
      )}
    </div>
  )
}
