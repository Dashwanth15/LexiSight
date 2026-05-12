import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useMediaPipe } from '../hooks/useMediaPipe.js'
import { useClassifier } from '../hooks/useClassifier.js'
import { useSpeechSynth } from '../hooks/useSpeechSynth.js'
import { useSpeechRecog } from '../hooks/useSpeechRecog.js'
import { PredictionSmoother, SentenceBuilder } from '../utils/smoothing.js'
import { DEMO_SEQUENCE } from '../utils/gestureMap.js'
import HandOverlay from '../components/HandOverlay.jsx'
import ConfidenceWaveform from '../components/ConfidenceWaveform.jsx'
import ConfidenceTopK from '../components/ConfidenceTopK.jsx'
import HandAvatar from '../components/HandAvatar.jsx'
import Hand3D from '../components/Hand3D.jsx'
import VoiceSelector from '../components/VoiceSelector.jsx'
import { toast } from '../components/ToastNotif.jsx'
import { PHRASE_PACKS } from '../data/phrasePacks.js'
import { useSettings } from '../hooks/useSettings.jsx'
import { getTranslationService } from '../services/translationService.js'

const smoother = new PredictionSmoother(10, 0.75)
const sentenceBuilder = new SentenceBuilder(2000)

// ─── Camera Panel — MUST be defined OUTSIDE Translator ──────────────────────
function CameraPanel({
  videoRef,
  rawLandmarks,
  rawLandmarks2,
  handDetected,
  confidence,
  isReady,
  cameraPermission,
  showHandPrompt,
  availableCameras,
  selectedCameraId,
  switchCamera,
  onEnable,
  height,
  compact,
  showCameraMenu,
  setShowCameraMenu,
}) {
  return (
    <div
      className="relative rounded-xl overflow-hidden w-full"
      style={{
        height: height || 300,
        minHeight: compact ? 220 : 280,
        background: '#000',
        border: handDetected
          ? '1.5px solid rgba(0,255,136,0.5)'
          : '1.5px solid #1a2535',
        boxShadow: handDetected ? '0 0 30px rgba(0,255,136,0.08)' : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s',
        flexShrink: 0,
      }}
    >
      {/* ── VIDEO: always in DOM, opacity controlled ─────────────── */}
      {/* This must NEVER conditionally unmount — the stream depends on it */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          transform: 'scaleX(-1)',
          opacity: isReady ? 1 : 0,
          transition: 'opacity 0.5s ease',
          zIndex: 1,
          display: 'block',  /* never display:none — must stay in layout */
        }}
      />

      {/* ── Hand skeleton on top of video ──────────────────────── */}
      {isReady && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
          <HandOverlay
            rawLandmarks={rawLandmarks}
            rawLandmarks2={rawLandmarks2}
            handDetected={handDetected}
            confidence={confidence}
            videoRef={videoRef}
          />
        </div>
      )}

      {/* ── "Not started" overlay ──────────────────────────────── */}
      {!isReady && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center"
          style={{ zIndex: 3 }}
        >
          <span style={{ fontSize: '2.5rem' }}>📷</span>
          {cameraPermission === 'denied' ? (
            <>
              <p className="text-sm font-dm" style={{ color: '#ff3366' }}>Camera access denied</p>
              <p className="text-xs font-dm max-w-xs" style={{ color: '#6b8ba4' }}>
                Allow camera access in browser settings, then refresh.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-dm" style={{ color: '#6b8ba4' }}>Camera not started</p>
              <button
                className="btn-primary"
                style={{ minHeight: 44 }}
                onClick={onEnable}
                aria-label="Enable webcam"
              >
                Enable Camera
              </button>
              <p className="text-xs font-dm max-w-xs" style={{ color: '#6b8ba4' }}>
                Uses your laptop/built-in webcam by default.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Camera switch dropdown ─────────────────────────────── */}
      {isReady && availableCameras.length > 1 && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowCameraMenu(p => !p) }}
            style={{
              background: 'rgba(8,13,20,0.88)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #1a2535',
              color: '#6b8ba4',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: '0.65rem',
              fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer',
              minHeight: 30,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            aria-label="Switch camera"
          >
            📷 Switch
          </button>

          {showCameraMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: '#0d1520',
                border: '1px solid #1a2535',
                borderRadius: 10,
                overflow: 'hidden',
                minWidth: 210,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                zIndex: 20,
              }}
            >
              {availableCameras.map((cam, i) => {
                const isSel = cam.deviceId === selectedCameraId
                const label = cam.label || `Camera ${i + 1}`
                return (
                  <button
                    key={cam.deviceId}
                    onClick={async () => {
                      setShowCameraMenu(false)
                      await switchCamera(cam.deviceId)
                      toast.info(`Switched to: ${label.split('(')[0].trim()}`)
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 14px',
                      fontSize: '0.78rem',
                      fontFamily: 'DM Sans, sans-serif',
                      background: isSel ? 'rgba(0,212,255,0.09)' : 'transparent',
                      color: isSel ? '#00d4ff' : '#6b8ba4',
                      borderBottom: i < availableCameras.length - 1 ? '1px solid #1a2535' : 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {isSel ? '● ' : '○ '}
                    {label.length > 32 ? label.substring(0, 32) + '…' : label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── "Show hand" hint ──────────────────────────────────── */}
      {isReady && showHandPrompt && !handDetected && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            textAlign: 'center',
            padding: '6px',
            background: 'rgba(255,170,0,0.13)',
            color: '#ffaa00',
            fontSize: '0.65rem',
            fontFamily: 'JetBrains Mono, monospace',
            zIndex: 5,
          }}
        >
          ◎ Show your hand to the camera
        </div>
      )}
    </div>
  )
}

// ─── Breakpoint hook ─────────────────────────────────────────────────────────
// Returns true when viewport is ≥ 1024px (Tailwind's lg breakpoint)
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })

  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    setIsDesktop(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isDesktop
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Translator() {
  // JS-based layout switch — only ONE CameraPanel in DOM at a time
  const isDesktop = useIsDesktop()

  const [activeTab, setActiveTab] = useState('sign')
  const [demoMode, setDemoMode] = useState(false)
  const demoIntervalRef = useRef(null)
  const [showCameraMenu, setShowCameraMenu] = useState(false)

  const [currentPrediction, setCurrentPrediction] = useState(null)
  const [detectionLog, setDetectionLog] = useState([])
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [sentence, setSentence] = useState('')
  const lastAddedRef = useRef(null)

  const [animSpeed, setAnimSpeed] = useState(1)
  const [avatarGesture, setAvatarGesture] = useState(null)
  const [use3DHand, setUse3DHand] = useState(true) // Toggle between 2D and 3D hand
  const wordTimerRef = useRef(null)

  const noHandRef = useRef(0)
  const [showHandPrompt, setShowHandPrompt] = useState(false)

  const { settings } = useSettings()
  const mediapipe = useMediaPipe()
  const classifier = useClassifier()
  const synth = useSpeechSynth()
  const recognition = useSpeechRecog()
  const translationService = getTranslationService(settings)

  // Sync settings to hooks
  useEffect(() => {
    if (settings.autoStartCamera && !mediapipe.isReady) {
      mediapipe.initialize(null, { 
        facingMode: settings.cameraFacing, 
        fpsLimit: settings.fpsLimit 
      })
    }
  }, [settings.autoStartCamera])

  useEffect(() => {
    if (classifier.setModeTier) classifier.setModeTier(settings.modelTier)
  }, [settings.modelTier])

  useEffect(() => {
    if (synth.setOptions) {
      synth.setOptions({
        rate: settings.speechSpeed,
        pitch: settings.speechPitch,
        volume: settings.speechVolume
      })
    }
  }, [settings.speechSpeed, settings.speechPitch, settings.speechVolume])

  // Update translation service when settings change
  useEffect(() => {
    translationService.updateSettings(settings)
  }, [settings])


  const isLoading = classifier.status === 'loading'

  // ── Inference ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mediapipe.handDetected || !mediapipe.landmarks) {
      noHandRef.current++
      if (noHandRef.current > 90) setShowHandPrompt(true)
      return
    }
    noHandRef.current = 0
    setShowHandPrompt(false)

    if (demoMode || classifier.isDemoMode || classifier.status === 'demo') return

    // Pass both normalized landmarks array AND raw objects for Geometric fallback
    const raw = classifier.predict(mediapipe.landmarks, mediapipe.rawLandmarks, mediapipe.rawLandmarks2, mediapipe.landmarks2)
    if (!raw) return

    const smoothed = smoother.add(raw)
    if (smoothed && smoothed.label !== lastAddedRef.current) {
      lastAddedRef.current = smoothed.label
      setCurrentPrediction(smoothed)
      const now = new Date().toLocaleTimeString('en-IN', { hour12: false })
      setDetectionLog(prev => [{ label: smoothed.label, confidence: smoothed.confidence, time: now }, ...prev.slice(0, 29)])
      
      // Use translation service for enhanced processing
      const translationResult = translationService.processTranslation(smoothed.label, smoothed.confidence)
      
      if (translationResult) {
        setSentence(prev => {
          const updated = prev ? `${prev} ${translationResult.text}` : translationResult.text
          return translationResult.isCompleteSentence ? updated : prev
        })
        
        if (settings.autoSpeak && !settings.muteAudio) {
          synth.speak(translationResult.text)
        }
        
        toast.success(`Detected: ${translationResult.text}`, 1200)
      } else {
        // Fallback to original behavior
        setSentence(sentenceBuilder.addWord(smoothed.label, { grammar: settings.grammarCorrection }))
        if (settings.autoSpeak && !settings.muteAudio) synth.speak(smoothed.label)
        toast.success(`Detected: ${smoothed.label}`, 1200)
      }

      // Update Impact stats
      const curTrans = parseInt(localStorage.getItem('lxi_stat_translations') || '142', 10)
      localStorage.setItem('lxi_stat_translations', curTrans + 1)
      
      const gesturesSeen = JSON.parse(localStorage.getItem('lxi_seen_gestures') || '{}')
      if (!gesturesSeen[smoothed.label]) {
        gesturesSeen[smoothed.label] = true
        localStorage.setItem('lxi_seen_gestures', JSON.stringify(gesturesSeen))
        const curGestures = parseInt(localStorage.getItem('lxi_stat_gestures') || '89', 10)
        localStorage.setItem('lxi_stat_gestures', curGestures + 1)
      }
    }
  }, [mediapipe.landmarks, mediapipe.handDetected])

  // ── Demo mode ────────────────────────────────────────────────
  useEffect(() => {
    if (demoMode) {
      demoIntervalRef.current = setInterval(() => {
        setCurrentPrediction(prev => {
          const idx = ((DEMO_SEQUENCE.findIndex(g => g.label === prev?.label) + 1) || 0) % DEMO_SEQUENCE.length
          const g = DEMO_SEQUENCE[idx]
          const now = new Date().toLocaleTimeString('en-IN', { hour12: false })
          setDetectionLog(p => [{ label: g.label, confidence: g.confidence, time: now }, ...p.slice(0, 29)])
          
          // Use translation service for demo mode as well
          const translationResult = translationService.processTranslation(g.label, g.confidence)
          
          if (translationResult) {
            setSentence(p => {
              const updated = p ? `${p} ${translationResult.text}` : translationResult.text
              return translationResult.isCompleteSentence ? updated : p
            })
            if (autoSpeak && !settings.muteAudio) synth.speak(translationResult.text)
          } else {
            // Fallback
            setSentence(p => `${p} ${g.label}`.trim())
            if (autoSpeak) synth.speak(g.label)
          }
          
          return g
        })
      }, 2000)
    } else {
      clearInterval(demoIntervalRef.current)
    }
    return () => clearInterval(demoIntervalRef.current)
  }, [demoMode, autoSpeak, settings.muteAudio])

  // ── Word queue → avatar ──────────────────────────────────────
  useEffect(() => {
    if (!recognition.wordQueue?.length) return
    setAvatarGesture(recognition.wordQueue[0])
    wordTimerRef.current = setTimeout(() => recognition.nextWord(), 1200 / animSpeed)
    return () => clearTimeout(wordTimerRef.current)
  }, [recognition.wordQueue, animSpeed])

  const handleStartCamera = useCallback(async () => {
    if (mediapipe.cameraPermission === 'denied') {
      toast.error('Camera blocked. Enable it in browser settings.')
      return
    }
    await mediapipe.initialize()
  }, [mediapipe])

  const handleSpeak = useCallback((text) => {
    if (!text) return
    synth.speak(text)
    toast.info(`Speaking: "${text}"`)
  }, [synth])

  const handleClearLog = useCallback(() => {
    setDetectionLog([])
    setSentence('')
    sentenceBuilder.clear()
    smoother.reset()
    lastAddedRef.current = null
    setCurrentPrediction(null)
  }, [])

  const camProps = {
    videoRef: mediapipe.videoRef,
    rawLandmarks: mediapipe.rawLandmarks,
    rawLandmarks2: mediapipe.rawLandmarks2,
    handDetected: mediapipe.handDetected,
    confidence: currentPrediction?.confidence || 0,
    isReady: mediapipe.isReady,
    cameraPermission: mediapipe.cameraPermission,
    showHandPrompt,
    availableCameras: mediapipe.availableCameras,
    selectedCameraId: mediapipe.selectedCameraId,
    switchCamera: mediapipe.switchCamera,
    onEnable: handleStartCamera,
    showCameraMenu,
    setShowCameraMenu,
  }

  // ── Status bar ───────────────────────────────────────────────
  const StatusBar = (
    <div
      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 overflow-x-auto no-scrollbar border-b shrink-0"
      style={{
        background: 'rgba(2,4,8,0.98)',
        borderColor: '#1a2535',
        fontFamily: 'JetBrains Mono, monospace',
        minHeight: 32,
        fontSize: '0.62rem',
        letterSpacing: '0.05em',
      }}
    >
      {/* Model */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full"
          style={{
            background: classifier.status === 'ready' ? '#00ff88' : classifier.status === 'geometric' ? '#00d4ff' : '#ffaa00',
            boxShadow: `0 0 4px ${classifier.status === 'ready' ? '#00ff88' : classifier.status === 'geometric' ? '#00d4ff' : '#ffaa00'}`,
            flexShrink: 0,
          }} />
        <span style={{ color: '#6b8ba4' }}>
          MDL:<span style={{ color: classifier.status === 'ready' || classifier.status === 'geometric' ? '#00d4ff' : '#ffaa00' }}>
            {classifier.isDemoMode ? 'DEMO' : classifier.status === 'geometric' ? 'GEO_FALLBACK' : classifier.status === 'loading' ? `${classifier.progress}%` : classifier.status === 'ready' ? `${classifier.numClasses}cls` : 'ERR'}
          </span>
        </span>
      </div>

      <span style={{ color: '#1a2535' }}>│</span>

      <span style={{ color: '#6b8ba4', flexShrink: 0 }}>
        FPS:<span style={{ color: mediapipe.fps > 20 ? '#00ff88' : mediapipe.fps > 0 ? '#ffaa00' : '#6b8ba4' }}>{mediapipe.fps}</span>
      </span>

      <span style={{ color: '#1a2535' }}>│</span>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full"
          style={{
            background: mediapipe.handDetected ? '#00ff88' : '#2a3545',
            boxShadow: mediapipe.handDetected ? '0 0 6px #00ff88' : 'none',
            animation: mediapipe.handDetected ? 'node-pulse 1s ease-in-out infinite' : 'none',
            flexShrink: 0,
          }} />
        <span style={{ color: mediapipe.handDetected ? '#00ff88' : '#6b8ba4' }}>
          {mediapipe.handDetected ? 'HAND ✓' : 'NO HAND'}
        </span>
      </div>

      {demoMode && (
        <>
          <span style={{ color: '#1a2535' }}>│</span>
          <span style={{ color: '#ffaa00', flexShrink: 0 }}>⚡ DEMO</span>
        </>
      )}

      {mediapipe.isReady && mediapipe.availableCameras.length > 0 && (
        <div className="ml-auto shrink-0 hidden sm:flex items-center gap-1">
          <span style={{ color: '#6b8ba4' }}>CAM:</span>
          <span style={{ color: '#00d4ff', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mediapipe.availableCameras.find(c => c.deviceId === mediapipe.selectedCameraId)
              ?.label?.split('(')[0]?.trim() || 'Default'}
          </span>
        </div>
      )}
    </div>
  )

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16 px-4" style={{ background: 'var(--void)' }}>
        <div className="text-center space-y-5 max-w-xs w-full">
          <div className="w-14 h-14 rounded-full mx-auto border-2"
            style={{ borderColor: 'transparent', borderTopColor: '#00d4ff', borderRightColor: '#8b5cf6', animation: 'spin-slow 1s linear infinite' }} />
          <h2 className="text-xl font-syne font-bold" style={{ color: '#e8f4fd' }}>Initializing LexiSight</h2>
          <div>
            <div className="flex justify-between mb-1">
              <span className="hud-label">Progress</span>
              <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{classifier.progress}%</span>
            </div>
            <div className="confidence-bar-track" style={{ height: 6 }}>
              <div className="confidence-bar-fill high" style={{ width: `${classifier.progress}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
          <p className="text-xs" style={{ color: '#6b8ba4' }}>No model? Demo Mode activates automatically.</p>
        </div>
      </div>
    )
  }

  // ══ Shared UI blocks ════════════════════════════════════════

  const PredictionBlock = (
    <div className="flex items-end gap-3">
      <div className="flex-1 min-w-0">
        <div className="hud-label mb-1">Detected Gesture</div>
        <div
          className="font-syne font-black leading-none"
          style={{
            fontSize: 'clamp(2.8rem, 5vw, 5rem)',
            color: currentPrediction ? '#00ff88' : '#2a3545',
            textShadow: currentPrediction ? '0 0 30px rgba(0,255,136,0.4)' : 'none',
            minHeight: 64,
            transition: 'color 0.2s, text-shadow 0.2s',
          }}
        >
          {currentPrediction?.label || '—'}
        </div>
      </div>
      {currentPrediction?.topK && (
        <div style={{ width: 176, flexShrink: 0 }}>
          <ConfidenceTopK topK={currentPrediction.topK} />
        </div>
      )}
    </div>
  )

  const SentenceBlock = sentence ? (
    <div className="glass-card-cyan p-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="hud-label mb-1">Sentence</div>
        <div className="text-sm font-dm break-words" style={{ color: '#e8f4fd' }}>{sentence}</div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: '0.73rem' }}
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: 'LexiSight Translation', text: sentence })
                .catch(() => {})
            } else {
              navigator.clipboard?.writeText(sentence)
              toast.success('Copied!')
            }
          }}>{typeof navigator !== 'undefined' && navigator.share ? 'Share' : 'Copy'}
        </button>
        <button className="btn-primary" style={{ padding: '5px 10px', fontSize: '0.73rem' }}
          onClick={() => handleSpeak(sentence)}>Speak</button>
      </div>
    </div>
  ) : null

  const handleFeedback = (isCorrect) => {
    if (!currentPrediction) return
    
    // Save to local storage for now until backend API is ready (Phase 5)
    const feedbackData = JSON.parse(localStorage.getItem('lxi_feedback') || '[]')
    feedbackData.push({
      label: currentPrediction.label,
      confidence: currentPrediction.confidence,
      isCorrect: isCorrect,
      timestamp: new Date().toISOString()
    })
    localStorage.setItem('lxi_feedback', JSON.stringify(feedbackData))
    
    console.log(`Feedback saved locally: ${currentPrediction.label} is ${isCorrect ? 'Correct' : 'Incorrect'}`)
    toast.success('Feedback recorded. Thank you!', 1500)
  }

  const DetectionLog = (
    <div className="terminal-log" style={{ maxHeight: 130 }}>
      {detectionLog.length === 0
        ? <span style={{ color: '#1a2535' }}>No detections yet...</span>
        : detectionLog.map((e, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <span style={{ color: '#1a4535', fontSize: '0.6rem' }}>[{e.time}]</span>
            <span style={{ color: i === 0 ? '#00ff88' : '#4a8a6a', fontWeight: i === 0 ? 700 : 400 }}>{e.label}</span>
            <span style={{ color: '#1a4535', marginLeft: 'auto' }}>{(e.confidence * 100).toFixed(0)}%</span>
            {i === 0 && (
              <div className="flex gap-1 ml-2">
                <button onClick={() => handleFeedback(true)} style={{ padding: '0 4px', fontSize: '0.7rem', color: '#00ff88', border: '1px solid #00ff88', borderRadius: '4px' }}>✓</button>
                <button onClick={() => handleFeedback(false)} style={{ padding: '0 4px', fontSize: '0.7rem', color: '#ff3366', border: '1px solid #ff3366', borderRadius: '4px' }}>✗</button>
              </div>
            )}
          </div>
        ))}
    </div>
  )

  const SignControls = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center" style={{ background: '#1a2535', borderRadius: '8px', padding: '2px', marginRight: '8px' }}>
        <button
          className="text-xs font-dm transition-colors"
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            background: classifier.mode === 'word' ? '#00d4ff' : 'transparent',
            color: classifier.mode === 'word' ? '#020408' : '#6b8ba4',
            fontWeight: classifier.mode === 'word' ? 'bold' : 'normal',
          }}
          onClick={() => classifier.setMode('word')}
        >Word</button>
        <button
          className="text-xs font-dm transition-colors"
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            background: classifier.mode === 'letter' ? '#00d4ff' : 'transparent',
            color: classifier.mode === 'letter' ? '#020408' : '#6b8ba4',
            fontWeight: classifier.mode === 'letter' ? 'bold' : 'normal',
          }}
          onClick={() => classifier.setMode('letter')}
        >Letter</button>
        <button
          className="text-xs font-dm transition-colors"
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            background: classifier.mode === 'number' ? '#00d4ff' : 'transparent',
            color: classifier.mode === 'number' ? '#020408' : '#6b8ba4',
            fontWeight: classifier.mode === 'number' ? 'bold' : 'normal',
          }}
          onClick={() => classifier.setMode('number')}
        >Number</button>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} aria-label="Auto speak" />
        <span className="toggle-slider" />
      </label>
      <span className="text-xs font-dm" style={{ color: '#6b8ba4' }}>Auto Speak</span>
      <button className="btn-primary" style={{ padding: '7px 14px', fontSize: '0.8rem', minHeight: 36 }}
        disabled={!currentPrediction}
        onClick={() => handleSpeak(currentPrediction?.label)}>
        {synth.speaking ? '⏸ Speaking...' : '▶ Speak'}
      </button>
      <VoiceSelector voices={synth.voices} selectedVoice={synth.selectedVoice} onSelect={synth.changeVoice} />
      
      <select 
        value={synth.targetLang}
        onChange={(e) => synth.setTargetLang(e.target.value)}
        className="btn-secondary"
        style={{ padding: '6px 10px', fontSize: '0.75rem', minHeight: 36, backgroundColor: 'rgba(8,13,20,0.88)' }}
      >
        {synth.LANG_OPTIONS.map(opt => (
          <option key={opt.code} value={opt.code}>{opt.label}</option>
        ))}
      </select>

      <button className={demoMode ? 'btn-danger' : 'btn-secondary'}
        style={{ padding: '7px 12px', fontSize: '0.8rem', minHeight: 36 }}
        onClick={() => setDemoMode(d => !d)}>
        {demoMode ? '⏹ Stop Demo' : '⚡ Demo'}
      </button>
      <button className="btn-danger" style={{ padding: '7px 10px', fontSize: '0.75rem', minHeight: 36 }} onClick={handleClearLog}>
        Clear
      </button>
    </div>
  )

  const MicBlock = (
    <div className="flex flex-col items-center py-3">
      <div className="relative" style={{ width: 80, height: 80 }}>
        {recognition.isListening && (
          <>
            <div className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(139,92,246,0.4)', animation: 'pulse-ring 1.5s ease-out infinite' }} />
            <div className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(139,92,246,0.2)', animation: 'pulse-ring 1.5s ease-out infinite', animationDelay: '0.5s' }} />
          </>
        )}
        <button
          onClick={recognition.isListening ? recognition.stop : recognition.start}
          className="absolute inset-0 rounded-full flex items-center justify-center text-2xl cursor-pointer"
          style={{
            background: recognition.isListening ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.08)',
            border: `2px solid ${recognition.isListening ? '#8b5cf6' : 'rgba(139,92,246,0.3)'}`,
            boxShadow: recognition.isListening ? '0 0 30px rgba(139,92,246,0.3)' : 'none',
          }}
          disabled={!recognition.isSupported}
          aria-label={recognition.isListening ? 'Stop listening' : 'Start speech recognition'}
        >
          {recognition.isListening ? '⏹' : '🎤'}
        </button>
      </div>
      <div className="mt-2 hud-label">{recognition.isListening ? '● Listening...' : 'Tap mic to speak'}</div>
    </div>
  )

  const TranscriptBlock = (
    <div>
      <div className="hud-label mb-1.5">Live Transcript</div>
      <div className="glass-card p-3 min-h-16 rounded-xl" style={{ fontFamily: 'DM Sans, sans-serif' }}>
        {!recognition.transcript && !recognition.interimTranscript
          ? <span className="text-sm" style={{ color: '#1a2535' }}>Start speaking — text appears here</span>
          : (
            <>
              <span className="text-sm" style={{ color: '#e8f4fd' }}>{recognition.transcript}</span>
              <span className="text-sm" style={{ color: '#6b8ba4' }}>{recognition.interimTranscript}</span>
            </>
          )}
      </div>
    </div>
  )

  const AvatarBlock = (size = 'h-40') => (
    <div className="flex flex-col">
      {/* Toggle between 2D and 3D hand */}
      <div className="flex justify-center mb-2">
        <div className="flex bg-gray-800 rounded-lg p-1" style={{ background: 'rgba(8,13,20,0.8)' }}>
          <button
            onClick={() => setUse3DHand(false)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              !use3DHand 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            2D Hand
          </button>
          <button
            onClick={() => setUse3DHand(true)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              use3DHand 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            3D Hand
          </button>
        </div>
      </div>
      
      {/* Hand display */}
      <div
        className="flex flex-col items-center justify-center rounded-xl"
        style={{
          background: 'rgba(8,13,20,0.5)',
          border: avatarGesture ? '1px solid rgba(139,92,246,0.3)' : '1px solid #1a2535',
          minHeight: 180,
          flex: 1,
          transition: 'border-color 0.3s',
        }}
      >
        {use3DHand ? (
          <Hand3D 
            gesture={avatarGesture || 'idle'} 
            isActive={!!avatarGesture} 
            width={300}
            height={200}
          />
        ) : (
          <HandAvatar gesture={avatarGesture} isActive={!!avatarGesture} animSpeed={animSpeed} className={size} />
        )}
      </div>
    </div>
  )

  const SpeedBlock = (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="hud-label">Animation Speed</span>
        <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{animSpeed.toFixed(1)}×</span>
      </div>
      <input type="range" min={0.3} max={3} step={0.1} value={animSpeed}
        onChange={e => setAnimSpeed(parseFloat(e.target.value))} aria-label="Animation speed" />
    </div>
  )

  const WordChips = recognition.wordQueue.length > 0 ? (
    <div className="flex flex-wrap gap-1.5">
      {recognition.wordQueue.slice(0, 6).map((w, i) => (
        <span key={`${w}-${i}`} className={`word-chip ${i === 0 ? 'active' : ''}`} style={{ fontSize: '0.75rem' }}>{w}</span>
      ))}
    </div>
  ) : null

  const SpeechError = !recognition.isSupported ? (
    <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(255,51,102,0.08)', border: '1px solid rgba(255,51,102,0.2)', color: '#ff3366' }}>
      ⚠ Speech recognition not supported. Try Chrome or Edge.
    </div>
  ) : null

  // ══════════════════════════════════════════════════════════════
  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100dvh', paddingTop: 64, background: 'var(--void)' }}
      onClick={() => showCameraMenu && setShowCameraMenu(false)}
    >
      {StatusBar}

      {/* ══ DESKTOP LAYOUT (isDesktop = true) ══════════════════ */}
      {isDesktop && (
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

          {/* LEFT: Sign → Speech */}
          <div
            className="relative flex flex-col gap-3 p-5 xl:p-6 overflow-y-auto"
            style={{ width: '55%', background: 'var(--obsidian)', borderRight: '1px solid #1a2535' }}
          >
            <div className="scan-line" />
            <div className="panel-title">Sign Detection</div>

            {/* THE ONE camera panel on desktop */}
            <CameraPanel {...camProps} height={320} />

            {PredictionBlock}
            <ConfidenceWaveform confidence={currentPrediction?.confidence || 0} isActive={!!currentPrediction} />
            {SentenceBlock}

            {/* Quick Phrase Tabs */}
            <div className="mt-2">
              <div className="hud-label mb-1">Quick Phrase Add</div>
              <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto no-scrollbar">
                {PHRASE_PACKS[0].phrases.map(ph => (
                  <button key={ph.word} onClick={() => {
                    setSentence(s => `${s} ${ph.word}`.trim())
                    toast.success('Added phrase')
                  }} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.7rem' }}>
                    + {ph.word}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-1.5 mt-2">
              <div className="hud-label">Detection Log</div>
              <button className="btn-danger" style={{ padding: '3px 8px', fontSize: '0.65rem' }} onClick={handleClearLog}>Clear</button>
            </div>
            {DetectionLog}

            <div className="pt-3" style={{ borderTop: '1px solid #1a2535' }}>
              {SignControls}
            </div>
          </div>

          {/* Gutter */}
          <div className="relative flex items-center justify-center shrink-0" style={{ width: 24, background: 'var(--void)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent,rgba(0,212,255,0.05) 50%,transparent)' }} />
            <div className="flex flex-col items-center gap-2 z-10">
              <div className="w-1 h-1 rounded-full" style={{ background: '#00d4ff', boxShadow: '0 0 4px #00d4ff' }} />
              <div className="w-px h-10" style={{ background: 'linear-gradient(to bottom,transparent,#00d4ff40,transparent)' }} />
              <div className="w-1 h-1 rounded-full" style={{ background: '#8b5cf6', boxShadow: '0 0 4px #8b5cf6' }} />
            </div>
          </div>

          {/* RIGHT: Speech → Sign */}
          <div className="flex flex-col gap-3 p-5 xl:p-6 overflow-y-auto" style={{ flex: 1, background: 'var(--obsidian)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'block', width: 3, height: 14, background: '#8b5cf6', borderRadius: 2, boxShadow: '0 0 8px #8b5cf6' }} />
              <span className="font-syne font-bold tracking-widest uppercase" style={{ color: '#8b5cf6', fontSize: '0.75rem', letterSpacing: '0.2em' }}>
                Speech → Sign
              </span>
            </div>
            {MicBlock}
            {TranscriptBlock}
            {AvatarBlock('h-40 xl:h-48')}
            {WordChips}
            <div className="space-y-3 pt-3" style={{ borderTop: '1px solid #1a2535' }}>
              {SpeedBlock}
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" style={{ fontSize: '0.8rem', minHeight: 36 }} onClick={recognition.clear}>Clear</button>
                <button className="btn-secondary flex-1" style={{ fontSize: '0.8rem', minHeight: 36 }}
                  onClick={() => recognition.transcript && setAvatarGesture(recognition.transcript.trim().split(' ').pop().toUpperCase())}>
                  Repeat
                </button>
              </div>
              {SpeechError}
            </div>
          </div>
        </div>
      )}

      {/* ══ MOBILE / TABLET LAYOUT (isDesktop = false) ═════════ */}
      {!isDesktop && (
        <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">

            {activeTab === 'sign' ? (
              <>
                {/* THE ONE camera panel on mobile */}
                <CameraPanel {...camProps} height={240} compact />
                {PredictionBlock}
                <ConfidenceWaveform confidence={currentPrediction?.confidence || 0} isActive={!!currentPrediction} compact />
                {SentenceBlock}
                {SignControls}
                <div className="terminal-log" style={{ maxHeight: 90 }}>
                  {detectionLog.length === 0
                    ? <span style={{ color: '#1a2535' }}>No detections yet</span>
                    : detectionLog.slice(0, 5).map((e, i) => (
                      <div key={i} className="flex gap-2">
                        <span style={{ color: '#1a4535', fontSize: '0.6rem' }}>{e.time}</span>
                        <span style={{ color: i === 0 ? '#00ff88' : '#4a8a6a' }}>{e.label}</span>
                        <span style={{ color: '#1a4535', marginLeft: 'auto' }}>{(e.confidence * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <>
                {MicBlock}
                {TranscriptBlock}
                {WordChips}
                {AvatarBlock('h-40')}
                {SpeedBlock}
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1 justify-center" style={{ minHeight: 44 }} onClick={recognition.clear}>Clear</button>
                  <button className="btn-secondary flex-1 justify-center" style={{ minHeight: 44 }}
                    onClick={() => recognition.transcript && setAvatarGesture(recognition.transcript.trim().split(' ').pop().toUpperCase())}>
                    Repeat
                  </button>
                </div>
                {SpeechError}
              </>
            )}
          </div>

          {/* Tab Bar */}
          <div
            className="flex border-t shrink-0"
            style={{ background: 'var(--obsidian)', borderColor: '#1a2535', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {[
              { tab: 'sign', icon: '✋', label: 'Sign → Speech', color: '#00d4ff' },
              { tab: 'speech', icon: '🎤', label: 'Speech → Sign', color: '#8b5cf6' },
            ].map(({ tab, icon, label, color }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all duration-200 cursor-pointer"
                style={{
                  color: activeTab === tab ? color : '#6b8ba4',
                  background: activeTab === tab ? `${color}08` : 'transparent',
                  borderTop: activeTab === tab ? `2px solid ${color}` : '2px solid transparent',
                  minHeight: 56,
                }}
                aria-label={label}
              >
                <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{icon}</span>
                <span className="text-xs font-dm" style={{ lineHeight: 1.2 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
