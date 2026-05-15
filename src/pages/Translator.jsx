import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useMediaPipe } from '../hooks/useMediaPipe.js'
import { useClassifier } from '../hooks/useClassifier.js'
import { useSpeechSynth } from '../hooks/useSpeechSynth.js'
import { useSpeechRecog } from '../hooks/useSpeechRecog.js'
import { usePhotoMode } from '../hooks/usePhotoMode.js'
import { useVideoMode } from '../hooks/useVideoMode.js'
import { useSettings } from '../hooks/useSettings.jsx'
import { useTranslation } from '../hooks/useTranslation.js'
import { PredictionSmoother, SentenceBuilder } from '../utils/smoothing.js'
import { DEMO_SEQUENCE } from '../utils/gestureMap.js'
import HandOverlay from '../components/HandOverlay.jsx'
import ConfidenceWaveform from '../components/ConfidenceWaveform.jsx'
import ConfidenceTopK from '../components/ConfidenceTopK.jsx'
// REMOVED: HandAvatar — replaced Speech→Sign with Speech→Word
import VoiceSelector from '../components/VoiceSelector.jsx'
import PhotoTranslator from '../components/PhotoTranslator.jsx'
import VideoTranslator from '../components/VideoTranslator.jsx'
import { toast } from '../components/ToastNotif.jsx'
import { PHRASE_PACKS } from '../data/phrasePacks.js'

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
  settings,
}) {
  return (
    <div
      className="relative rounded-xl overflow-hidden w-full"
      style={{
        // Aspect-ratio based sizing: fills width, height scales to perfect 16:9.
        // Previously used a hardcoded height which caused 4:3 streams to be
        // object-cover cropped and zoomed-in. With 1280x720 + 16:9 this matches exactly.
        aspectRatio: '16 / 9',
        maxHeight: height ? height * 1.5 : 480,
        minHeight: compact ? 180 : 220,
        background: '#000',
        border: handDetected
          ? '1.5px solid rgba(0,255,136,0.5)'
          : '1.5px solid var(--border)',
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
        className="absolute inset-0 w-full h-full"
        style={{
          objectFit: 'cover',
          // Mirror so user sees natural selfie view
          transform: 'scaleX(-1)',
          opacity: isReady ? 1 : 0,
          transition: 'opacity 0.5s ease',
          zIndex: 1,
          display: 'block',
          // Prevent browser from applying bilinear softening on the video texture
          imageRendering: 'auto',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      />

      {/* ── Hand skeleton on top of video ──────────────────────── */}
      {isReady && settings.handOverlay !== false && (
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
              <p className="text-xs font-dm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
                Allow camera access in browser settings, then refresh.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-dm" style={{ color: 'var(--text-secondary)' }}>Camera not started</p>
              <button
                className="btn-primary"
                style={{ minHeight: 44 }}
                onClick={onEnable}
                aria-label="Enable webcam"
              >
                Enable Camera
              </button>
              <p className="text-xs font-dm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
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
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
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
                background: 'var(--surface)',
                border: '1px solid var(--border)',
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
                      color: isSel ? 'var(--cyan)' : 'var(--text-secondary)',
                      borderBottom: i < availableCameras.length - 1 ? '1px solid var(--border)' : 'none',
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
  const { settings } = useSettings()
  const { t } = useTranslation()
  const [mode, setMode] = useState('word') // 'word', 'letter', 'number'
  // JS-based layout switch — only ONE CameraPanel in DOM at a time
  const isDesktop = useIsDesktop()

  const [activeTab, setActiveTab] = useState('sign')
  const [inputMode, setInputMode] = useState('live') // 'live', 'photo', 'video'
  const [demoMode, setDemoMode] = useState(false)
  const demoIntervalRef = useRef(null)
  const [showCameraMenu, setShowCameraMenu] = useState(false)

  const [currentPrediction, setCurrentPrediction] = useState(null)
  const [detectionLog, setDetectionLog] = useState([])
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [sentence, setSentence] = useState('')
  const lastAddedRef = useRef(null)

  // REMOVED: animSpeed, avatarGesture, wordTimerRef — no longer needed for Speech→Word

  const noHandRef = useRef(0)
  const [showHandPrompt, setShowHandPrompt] = useState(false)

  const mediapipe = useMediaPipe()
  const classifier = useClassifier()
  const synth = useSpeechSynth()
  const recognition = useSpeechRecog()
  const photoMode = usePhotoMode()
  const videoMode = useVideoMode()

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
      setSentence(sentenceBuilder.addWord(smoothed.label))
      if (autoSpeak) synth.speak(smoothed.label)
      toast.success(`Detected: ${smoothed.label}`, 1200)

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

  // ── Photo/Video mode detection handling ─────────────────────
  useEffect(() => {
    // Handle detection from Photo mode
    if (inputMode === 'photo' && photoMode.currentSign && photoMode.currentSign.label !== lastAddedRef.current) {
      lastAddedRef.current = photoMode.currentSign.label
      setCurrentPrediction(photoMode.currentSign)
      const now = new Date().toLocaleTimeString('en-IN', { hour12: false })
      setDetectionLog(prev => [{ label: photoMode.currentSign.label, confidence: photoMode.currentSign.confidence, time: now }, ...prev.slice(0, 29)])
      setSentence(sentenceBuilder.addWord(photoMode.currentSign.label))
      if (autoSpeak) synth.speak(photoMode.currentSign.label)
      toast.success(`Detected: ${photoMode.currentSign.label}`, 1200)
    }

    // Handle detection from Video mode
    if (inputMode === 'video' && videoMode.currentSign && videoMode.currentSign.label !== lastAddedRef.current) {
      lastAddedRef.current = videoMode.currentSign.label
      setCurrentPrediction(videoMode.currentSign)
      const now = new Date().toLocaleTimeString('en-IN', { hour12: false })
      setDetectionLog(prev => [{ label: videoMode.currentSign.label, confidence: videoMode.currentSign.confidence, time: now }, ...prev.slice(0, 29)])
      setSentence(sentenceBuilder.addWord(videoMode.currentSign.label))
      if (autoSpeak) synth.speak(videoMode.currentSign.label)
    }
  }, [photoMode.currentSign, videoMode.currentSign, inputMode, autoSpeak, synth])

  // ── Reset last detected when switching modes ──────────────────
  useEffect(() => {
    lastAddedRef.current = null
    setCurrentPrediction(null)
    setDetectionLog([])
    setSentence('')
    sentenceBuilder.clear()
  }, [inputMode])
  useEffect(() => {
    if (demoMode) {
      demoIntervalRef.current = setInterval(() => {
        setCurrentPrediction(prev => {
          const idx = ((DEMO_SEQUENCE.findIndex(g => g.label === prev?.label) + 1) || 0) % DEMO_SEQUENCE.length
          const g = DEMO_SEQUENCE[idx]
          const now = new Date().toLocaleTimeString('en-IN', { hour12: false })
          setDetectionLog(p => [{ label: g.label, confidence: g.confidence, time: now }, ...p.slice(0, 29)])
          if (autoSpeak) synth.speak(g.label)
          setSentence(p => `${p} ${g.label}`.trim())
          return g
        })
      }, 2000)
    } else {
      clearInterval(demoIntervalRef.current)
    }
    return () => clearInterval(demoIntervalRef.current)
  }, [demoMode, autoSpeak])

  // REMOVED: Word queue → avatar effect — replaced with Speech→Word display

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

  // NEW: Copy transcript to clipboard (must be before early return)
  const handleCopyTranscript = useCallback(() => {
    const text = recognition.transcript?.trim()
    if (!text) {
      toast.info('Nothing to copy yet')
      return
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      toast.success('Transcript copied!')
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      toast.success('Transcript copied!')
    }
  }, [recognition.transcript])

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
        borderColor: 'var(--border)',
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
            background: classifier.status === 'ready' ? '#00ff88' : classifier.status === 'geometric' ? 'var(--cyan)' : '#ffaa00',
            boxShadow: `0 0 4px ${classifier.status === 'ready' ? '#00ff88' : classifier.status === 'geometric' ? 'var(--cyan)' : '#ffaa00'}`,
            flexShrink: 0,
          }} />
        <span style={{ color: 'var(--text-secondary)' }}>{t('mdl_status')}</span>
        <select
          value={classifier.mode}
          onChange={(e) => classifier.setMode(e.target.value)}
          style={{
            background: 'transparent',
            color: classifier.status === 'ready' || classifier.status === 'geometric' ? 'var(--cyan)' : '#ffaa00',
            border: 'none',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            outline: 'none',
            cursor: 'pointer',
            padding: 0,
            appearance: 'none',
          }}
        >
          <option value="number" style={{ background: 'var(--surface)' }}>Geo Fallback</option>
          <option value="letter" style={{ background: 'var(--surface)' }}>v2 (Static)</option>
          <option value="word" style={{ background: 'var(--surface)' }}>v3 (Temporal)</option>
        </select>
        {classifier.status === 'loading' && <span style={{ color: '#ffaa00', marginLeft: 4 }}>{classifier.progress}%</span>}
      </div>

      <span style={{ color: 'var(--border)' }}>│</span>

      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
        {t('fps_label')}<span style={{ color: mediapipe.fps > 20 ? '#00ff88' : mediapipe.fps > 0 ? '#ffaa00' : 'var(--text-secondary)' }}>{mediapipe.fps}</span>
      </span>

      <span style={{ color: 'var(--border)' }}>│</span>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full"
          style={{
            background: mediapipe.handDetected ? '#00ff88' : '#2a3545',
            boxShadow: mediapipe.handDetected ? '0 0 6px #00ff88' : 'none',
            animation: mediapipe.handDetected ? 'node-pulse 1s ease-in-out infinite' : 'none',
            flexShrink: 0,
          }} />
        <span style={{ color: mediapipe.handDetected ? '#00ff88' : 'var(--text-secondary)' }}>
          {mediapipe.handDetected ? 'HAND ✓' : 'NO HAND'}
        </span>
      </div>

      {demoMode && (
        <>
          <span style={{ color: 'var(--border)' }}>│</span>
          <span style={{ color: '#ffaa00', flexShrink: 0 }}>⚡ DEMO</span>
        </>
      )}

      {mediapipe.isReady && mediapipe.availableCameras.length > 0 && (
        <div className="ml-auto shrink-0 hidden sm:flex items-center gap-1">
          <span style={{ color: 'var(--text-secondary)' }}>CAM:</span>
          <span style={{ color: 'var(--cyan)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            style={{ borderColor: 'transparent', borderTopColor: 'var(--cyan)', borderRightColor: '#8b5cf6', animation: 'spin-slow 1s linear infinite' }} />
          <h2 className="text-xl font-syne font-bold" style={{ color: 'var(--text-primary)' }}>{t('status_loading')}</h2>
          <div>
            <div className="flex justify-between mb-1">
              <span className="hud-label">Progress</span>
              <span style={{ color: 'var(--cyan)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{classifier.progress}%</span>
            </div>
            <div className="confidence-bar-track" style={{ height: 6 }}>
              <div className="confidence-bar-fill high" style={{ width: `${classifier.progress}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No model? Demo Mode activates automatically.</p>
        </div>
      </div>
    )
  }

  // ══ Shared UI blocks ════════════════════════════════════════

  const PredictionBlock = (
    <div className="flex items-end gap-3">
      <div className="flex-1 min-w-0">
        <div className="hud-label mb-1">{t('detected_gesture')}</div>
        <div
          className="font-dm font-black leading-none"
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
        <div className="hud-label mb-1">{t('sentence_builder')}</div>
        <div className="text-sm font-dm break-words" style={{ color: 'var(--text-primary)' }}>{sentence}</div>
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
          }}>{typeof navigator !== 'undefined' && navigator.share ? 'Share' : t('btn_copy')}
        </button>
        <button className="btn-primary" style={{ padding: '5px 10px', fontSize: '0.73rem' }}
          onClick={() => handleSpeak(sentence)}>{t('btn_speak')}</button>
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
        ? <span style={{ color: 'var(--border)' }}>No detections yet...</span>
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="hud-label mr-2">ISOLATION MODE:</span>
        <button className={classifier.mode === 'word' ? 'btn-primary' : 'btn-secondary'} 
          onClick={() => classifier.setMode('word')} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>Word</button>
        <button className={classifier.mode === 'letter' ? 'btn-primary' : 'btn-secondary'} 
          onClick={() => classifier.setMode('letter')} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>Letter</button>
        <button className={classifier.mode === 'number' ? 'btn-primary' : 'btn-secondary'} 
          onClick={() => classifier.setMode('number')} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>Number</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="toggle">
          <input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} aria-label="Auto speak" />
          <span className="toggle-slider" />
        </label>
        <span className="text-xs font-dm" style={{ color: 'var(--text-secondary)' }}>Auto Speak</span>
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
      <div className="mt-2 hud-label">{recognition.isListening ? t('status_listening') || '● Listening...' : t('mic_prompt') || 'Tap mic to speak'}</div>
    </div>
  )

  // NEW: Enhanced transcript for Speech→Word — larger, more accessible
  const TranscriptBlock = (
    <div>
      <div className="hud-label mb-1.5">{t('live_transcript') || 'Live Transcript'}</div>
      <div
        className="glass-card rounded-xl"
        style={{
          fontFamily: 'DM Sans, sans-serif',
          padding: '16px 18px',
          minHeight: 80,
          maxHeight: 200,
          overflowY: 'auto',
          lineHeight: 1.6,
        }}
      >
        {!recognition.transcript && !recognition.interimTranscript
          ? <span style={{ color: '#2a3545', fontSize: '1rem' }}>{t('transcript_prompt') || 'Start speaking — text appears here'}</span>
          : (
            <>
              <span style={{ color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 500 }}>{recognition.transcript}</span>
              <span style={{ color: '#8b5cf6', fontSize: '1.05rem', fontStyle: 'italic', opacity: 0.8 }}>{recognition.interimTranscript}</span>
            </>
          )}
      </div>
    </div>
  )

  // NEW: Latest spoken word display — large, animated, accessibility-focused
  const LatestWordBlock = (
    <div
      className="flex flex-col items-center justify-center rounded-xl"
      style={{
        background: recognition.lastFinalChunk
          ? 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(0,212,255,0.05))'
          : 'rgba(8,13,20,0.5)',
        border: recognition.lastFinalChunk ? '1px solid rgba(139,92,246,0.3)' : '1px solid var(--border)',
        minHeight: 140,
        padding: '28px 20px',
        transition: 'all 0.4s ease',
      }}
    >
      {recognition.lastFinalChunk ? (
        <div
          key={recognition.wordCount}
          className="font-syne font-bold text-center"
          style={{
            fontSize: 'clamp(1.4rem, 4vw, 2.4rem)',
            color: 'var(--text-primary)',
            textShadow: '0 0 24px rgba(139,92,246,0.25)',
            lineHeight: 1.35,
            maxWidth: '100%',
            wordBreak: 'break-word',
            animation: 'fadeSlideUp 0.35s ease-out',
          }}
        >
          {recognition.lastFinalChunk}
        </div>
      ) : (
        <div className="text-center" style={{ color: '#2a3545' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>💬</div>
          <div className="text-sm font-dm" style={{ color: '#3a4555' }}>{t('latest_word_prompt') || 'Spoken words appear here'}</div>
        </div>
      )}
    </div>
  )



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
            style={{ width: '55%', background: 'var(--obsidian)', borderRight: '1px solid var(--border)' }}
          >
            <div className="scan-line" />
            <div className="panel-title">{t('panel_sign_detection') || 'Sign Detection'}</div>

            {/* ─── Input Mode Selector ────────────────────────────── */}
            <div className="flex items-center gap-1.5 p-1.5 rounded-lg" style={{ background: 'var(--border)', width: 'fit-content' }}>
              {[
                { mode: 'live', icon: '📹', label: t('mode_live') || 'Live' },
                { mode: 'photo', icon: '📷', label: t('mode_photo') || 'Photo' },
                { mode: 'video', icon: '🎬', label: t('mode_video') || 'Video' },
              ].map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setInputMode(mode)}
                  className="text-xs font-dm transition-all duration-200"
                  style={{
                    padding: '5px 12px',
                    borderRadius: '5px',
                    background: inputMode === mode ? 'var(--cyan)' : 'transparent',
                    color: inputMode === mode ? '#020408' : 'var(--text-secondary)',
                    fontWeight: inputMode === mode ? 'bold' : 'normal',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  title={`${label} mode`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* THE input panel on desktop (Live, Photo, or Video) */}
            {inputMode === 'live' && <CameraPanel {...camProps} settings={settings} height={320} />}
            {inputMode === 'photo' && <PhotoTranslator 
              photoUrl={photoMode.photoUrl}
              isLoaded={photoMode.isLoaded}
              isProcessing={photoMode.isProcessing}
              currentSign={photoMode.currentSign}
              onUpload={photoMode.handlePhotoUpload}
              onReset={photoMode.resetPhoto}
            />}
            {inputMode === 'video' && <VideoTranslator 
              videoUrl={videoMode.videoUrl}
              isLoaded={videoMode.isLoaded}
              isPlaying={videoMode.isPlaying}
              isProcessing={videoMode.isProcessing}
              progress={videoMode.progress}
              currentSign={videoMode.currentSign}
              onPlay={videoMode.handlePlay}
              onPause={videoMode.handlePause}
              videoRef={videoMode.videoRef}
              onUpload={videoMode.handleVideoUpload}
              onReset={videoMode.resetVideo}
            />}

            {PredictionBlock}
            <ConfidenceWaveform confidence={currentPrediction?.confidence || 0} isActive={!!currentPrediction} />
            {SentenceBlock}

            {/* Quick Phrase Tabs */}
            <div className="mt-2">
              <div className="hud-label mb-1">{t('quick_phrase_add') || 'Quick Phrase Add'}</div>
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
              <div className="hud-label">{t('detection_log') || 'Detection Log'}</div>
              <button className="btn-danger" style={{ padding: '3px 8px', fontSize: '0.65rem' }} onClick={handleClearLog}>Clear</button>
            </div>
            {DetectionLog}

            <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              {SignControls}
            </div>
          </div>

          {/* Gutter */}
          <div className="relative flex items-center justify-center shrink-0" style={{ width: 24, background: 'var(--void)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent,rgba(0,212,255,0.05) 50%,transparent)' }} />
            <div className="flex flex-col items-center gap-2 z-10">
              <div className="w-1 h-1 rounded-full" style={{ background: 'var(--cyan)', boxShadow: '0 0 4px var(--cyan)' }} />
              <div className="w-px h-10" style={{ background: 'linear-gradient(to bottom,transparent,var(--cyan)40,transparent)' }} />
              <div className="w-1 h-1 rounded-full" style={{ background: '#8b5cf6', boxShadow: '0 0 4px #8b5cf6' }} />
            </div>
          </div>

          {/* RIGHT: Speech → Word */}
          <div className="flex flex-col gap-3 p-5 xl:p-6 overflow-y-auto" style={{ flex: 1, background: 'var(--obsidian)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'block', width: 3, height: 14, background: '#8b5cf6', borderRadius: 2, boxShadow: '0 0 8px #8b5cf6' }} />
              <span className="font-syne font-bold tracking-widest uppercase" style={{ color: '#8b5cf6', fontSize: '0.75rem', letterSpacing: '0.2em' }}>
                {t('mode_speech_word') || 'Speech → Word'}
              </span>
            </div>
            {MicBlock}
            {TranscriptBlock}
            {LatestWordBlock}
            <div className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" style={{ fontSize: '0.8rem', minHeight: 36 }} onClick={recognition.clear}>Clear</button>
                <button className="btn-primary flex-1" style={{ fontSize: '0.8rem', minHeight: 36 }} onClick={handleCopyTranscript}>📋 Copy</button>
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
                {/* ─── Input Mode Selector (Mobile) ────────────────────── */}
                <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--border)', width: 'fit-content' }}>
                  {[
                    { mode: 'live', icon: '📹', label: 'Live' },
                    { mode: 'photo', icon: '📷', label: 'Photo' },
                    { mode: 'video', icon: '🎬', label: 'Video' },
                  ].map(({ mode, icon, label }) => (
                    <button
                      key={mode}
                      onClick={() => setInputMode(mode)}
                      className="text-xs font-dm transition-all duration-200"
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        background: inputMode === mode ? 'var(--cyan)' : 'transparent',
                        color: inputMode === mode ? '#020408' : 'var(--text-secondary)',
                        fontWeight: inputMode === mode ? 'bold' : 'normal',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>

                {/* THE input panel on mobile (Live, Photo, or Video) */}
                {inputMode === 'live' && <CameraPanel {...camProps} settings={settings} height={240} compact />}
                {inputMode === 'photo' && <PhotoTranslator 
                  photoUrl={photoMode.photoUrl}
                  isLoaded={photoMode.isLoaded}
                  isProcessing={photoMode.isProcessing}
                  currentSign={photoMode.currentSign}
                  onUpload={photoMode.handlePhotoUpload}
                  onReset={photoMode.resetPhoto}
                />}
                {inputMode === 'video' && <VideoTranslator 
                  videoUrl={videoMode.videoUrl}
                  isLoaded={videoMode.isLoaded}
                  isPlaying={videoMode.isPlaying}
                  isProcessing={videoMode.isProcessing}
                  progress={videoMode.progress}
                  currentSign={videoMode.currentSign}
                  onPlay={videoMode.handlePlay}
                  onPause={videoMode.handlePause}
                  videoRef={videoMode.videoRef}
                  onUpload={videoMode.handleVideoUpload}
                  onReset={videoMode.resetVideo}
                />}
                
                {PredictionBlock}
                <ConfidenceWaveform confidence={currentPrediction?.confidence || 0} isActive={!!currentPrediction} compact />
                {SentenceBlock}
                {SignControls}
                <div className="terminal-log" style={{ maxHeight: 90 }}>
                  {detectionLog.length === 0
                    ? <span style={{ color: 'var(--border)' }}>No detections yet</span>
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
                {LatestWordBlock}
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1 justify-center" style={{ minHeight: 44 }} onClick={recognition.clear}>Clear</button>
                  <button className="btn-primary flex-1 justify-center" style={{ minHeight: 44 }} onClick={handleCopyTranscript}>📋 Copy</button>
                </div>
                {SpeechError}
              </>
            )}
          </div>

          {/* Tab Bar */}
          <div
            className="flex border-t shrink-0"
            style={{ background: 'var(--obsidian)', borderColor: 'var(--border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {[
              { tab: 'sign', icon: '✋', label: 'Sign → Speech', color: 'var(--cyan)' },
              { tab: 'speech', icon: '🎤', label: 'Speech → Word', color: '#8b5cf6' },
            ].map(({ tab, icon, label, color }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all duration-200 cursor-pointer"
                style={{
                  color: activeTab === tab ? color : 'var(--text-secondary)',
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
