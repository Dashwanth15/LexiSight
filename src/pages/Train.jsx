import { useState, useRef, useCallback, useEffect } from 'react'
import { useMediaPipe } from '../hooks/useMediaPipe.js'
import HandOverlay from '../components/HandOverlay.jsx'
import { toast } from '../components/ToastNotif.jsx'

export default function Train() {
  const [step, setStep] = useState(1) // 1=label, 2=record, 3=done
  const [gestureName, setGestureName] = useState('')
  const [samplesCollected, setSamplesCollected] = useState(0)
  const [collectedData, setCollectedData] = useState([]) // {label, landmarks}[]
  const [isRecording, setIsRecording] = useState(false)
  const [trainingLog, setTrainingLog] = useState([])
  const samplesRef = useRef([])
  const recordIntervalRef = useRef(null)
  const TARGET_SAMPLES = 50

  const mediapipe = useMediaPipe()

  // Auto-collect landmarks while recording
  useEffect(() => {
    if (isRecording && mediapipe.landmarks && mediapipe.handDetected) {
      samplesRef.current.push([...mediapipe.landmarks])
      const count = samplesRef.current.length
      setSamplesCollected(count)

      if (count >= TARGET_SAMPLES) {
        stopRecording(true)
      }
    }
  }, [mediapipe.landmarks, isRecording])

  const startRecording = useCallback(async () => {
    if (!mediapipe.isReady) {
      await mediapipe.initialize()
    }
    samplesRef.current = []
    setSamplesCollected(0)
    setIsRecording(true)
    toast.info(`Recording "${gestureName}" — hold your gesture!`)
  }, [mediapipe, gestureName])

  const stopRecording = useCallback((auto = false) => {
    setIsRecording(false)
    if (samplesRef.current.length >= 10) {
      const newEntry = {
        label: gestureName.toUpperCase(),
        landmarks: samplesRef.current,
        count: samplesRef.current.length,
        timestamp: new Date().toLocaleTimeString(),
      }
      setCollectedData(prev => [...prev, newEntry])
      setStep(3)
      toast.success(`Collected ${samplesRef.current.length} samples for "${gestureName}"`)
    } else {
      toast.warning('Not enough samples. Make sure your hand is visible and hold the gesture.')
    }
  }, [gestureName])

  const downloadData = useCallback(() => {
    const data = {
      gestures: collectedData.map(g => ({ label: g.label, samples: g.landmarks })),
      meta: { collected: new Date().toISOString(), totalSamples: collectedData.reduce((a, x) => a + x.count, 0) }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lexisight-training-data-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Training data downloaded!')
  }, [collectedData])

  const resetAll = useCallback(() => {
    setStep(1)
    setGestureName('')
    setSamplesCollected(0)
    setCollectedData([])
    setIsRecording(false)
    samplesRef.current = []
  }, [])

  const pct = (samplesCollected / TARGET_SAMPLES) * 100

  return (
    <div className="min-h-screen pt-16 px-6 lg:px-12 py-12" style={{ background: 'var(--void)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <div className="hud-label mb-3">Custom Gesture Training</div>
          <h1 className="text-4xl md:text-5xl font-syne font-black mb-3" style={{ color: 'var(--text-primary)' }}>
            Train New Gestures
          </h1>
          <p className="text-base font-dm" style={{ color: 'var(--text-secondary)' }}>
            Record your own custom gestures to extend the classifier.
            Collected data can be used with the Python training pipeline.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-4 mb-10">
          {[['01', 'Name Gesture'], ['02', 'Record Samples'], ['03', 'Save & Continue']].map(([num, label], i) => {
            const s = i + 1
            const isActive = step === s
            const isDone = step > s
            return (
              <div key={num} className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-mono font-bold"
                  style={{
                    background: isDone ? 'var(--green)' : isActive ? 'color-mix(in srgb, var(--cyan) 20%, transparent)' : 'var(--glass-bg)',
                    border: `1px solid ${isDone ? 'var(--green)' : isActive ? 'var(--cyan)' : 'var(--border)'}`,
                    color: isDone ? 'var(--void)' : isActive ? 'var(--cyan)' : 'var(--text-secondary)',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {isDone ? '✓' : num}
                </div>
                <span className="text-xs font-dm hidden sm:block" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</span>
                {i < 2 && <div className="w-8 h-px" style={{ background: 'var(--border)' }} />}
              </div>
            )
          })}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Controls */}
          <div className="space-y-6">
            {/* Step 1: Name */}
            {step === 1 && (
              <div className="glass-card p-6 space-y-4">
                <div className="hud-label">Step 1: Name Your Gesture</div>
                <div>
                  <label className="text-sm font-dm mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                    Gesture Label
                  </label>
                  <input
                    type="text"
                    value={gestureName}
                    onChange={e => setGestureName(e.target.value.toUpperCase())}
                    placeholder="e.g. NAMASTE, LOVE, OK"
                    className="w-full px-4 py-3 rounded-lg outline-none text-sm font-syne font-bold"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--cyan)',
                      fontFamily: 'Syne, sans-serif',
                    }}
                    onKeyDown={e => e.key === 'Enter' && gestureName.trim() && setStep(2)}
                    aria-label="Enter gesture name"
                  />
                </div>
                <button
                  className="btn-primary w-full justify-center"
                  disabled={!gestureName.trim()}
                  onClick={() => setStep(2)}
                  aria-label="Proceed to recording step"
                >
                  Next → Set Up Camera
                </button>
              </div>
            )}

            {/* Step 2: Record */}
            {step === 2 && (
              <div className="glass-card p-6 space-y-4">
                <div className="hud-label">Step 2: Record "{gestureName}"</div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-dm" style={{ color: 'var(--text-secondary)' }}>Samples</span>
                    <span className="font-mono text-sm" style={{ color: 'var(--cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {samplesCollected} / {TARGET_SAMPLES}
                    </span>
                  </div>
                  <div className="confidence-bar-track">
                    <div
                      className="confidence-bar-fill high"
                      style={{ width: `${pct}%`, transition: 'width 0.1s linear' }}
                    />
                  </div>
                </div>

                <div className="text-sm font-dm" style={{ color: 'var(--text-secondary)' }}>
                  {isRecording
                    ? '● Recording... hold your gesture steady!'
                    : 'Click record and hold your gesture in front of the camera.'}
                </div>

                <div className="flex gap-3">
                  {!isRecording ? (
                    <button
                      className="btn-primary flex-1 justify-center"
                      onClick={startRecording}
                      aria-label="Start recording gesture samples"
                    >
                      ● Start Recording
                    </button>
                  ) : (
                    <button
                      className="btn-danger flex-1 justify-center"
                      onClick={() => stopRecording(false)}
                      aria-label="Stop recording"
                    >
                      ⏹ Stop
                    </button>
                  )}
                  <button className="btn-secondary" onClick={() => setStep(1)} aria-label="Go back to naming step">←</button>
                </div>
              </div>
            )}

            {/* Step 3: Done */}
            {step === 3 && (
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span style={{ color: 'var(--green)', fontSize: '1.5rem' }}>✓</span>
                  <div>
                    <div className="hud-label">Samples Collected</div>
                    <div className="text-xl font-syne font-bold" style={{ color: 'var(--green)' }}>
                      {gestureName}: {samplesRef.current.length} samples
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    className="btn-primary flex-1 justify-center"
                    onClick={() => { setStep(1); setGestureName(''); setSamplesCollected(0); samplesRef.current = [] }}
                    aria-label="Record another gesture"
                  >
                    + Add Another
                  </button>
                </div>
              </div>
            )}

            {/* Collected gestures list */}
            {collectedData.length > 0 && (
              <div className="glass-card p-5">
                <div className="hud-label mb-3">Recorded Gestures ({collectedData.length})</div>
                <div className="space-y-2">
                  {collectedData.map((g, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span style={{ color: 'var(--green)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>✓</span>
                        <span className="font-syne font-bold" style={{ color: 'var(--text-primary)' }}>{g.label}</span>
                      </div>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {g.count} samples
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-4">
                  <button className="btn-primary flex-1 justify-center" style={{ fontSize: '0.85rem' }}
                    onClick={downloadData} aria-label="Download training data as JSON">
                    ↓ Download JSON
                  </button>
                  <button className="btn-secondary" onClick={resetAll} aria-label="Reset all recorded data">Reset</button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Webcam */}
          <div className="space-y-4">
            <div
              className="relative rounded-xl overflow-hidden"
              style={{
                height: 300,
                background: 'var(--obsidian)',
                border: mediapipe.handDetected ? '1.5px solid color-mix(in srgb, var(--green) 40%, transparent)' : '1.5px solid var(--border)',
              }}
            >
              {!mediapipe.isReady ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <span className="text-4xl">📷</span>
                  <button className="btn-primary" onClick={mediapipe.initialize}
                    aria-label="Enable webcam for training">Enable Camera</button>
                </div>
              ) : (
                <>
                  <video ref={mediapipe.videoRef} className="absolute inset-0 w-full h-full object-cover"
                    autoPlay playsInline muted style={{ transform: 'scaleX(-1)' }} />
                  <HandOverlay
                    rawLandmarks={mediapipe.rawLandmarks}
                    handDetected={mediapipe.handDetected}
                    confidence={isRecording && mediapipe.handDetected ? 0.9 : 0}
                    videoRef={mediapipe.videoRef}
                  />
                </>
              )}

              {/* Recording indicator */}
              {isRecording && (
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full"
                  style={{ background: 'color-mix(in srgb, var(--red) 20%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)' }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--red)', animation: 'node-pulse 0.5s ease-in-out infinite' }} />
                  <span className="text-xs font-mono" style={{ color: 'var(--red)', fontFamily: 'JetBrains Mono, monospace' }}>REC</span>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="glass-card p-4">
              <div className="hud-label mb-3">Instructions</div>
              <ol className="space-y-2 text-sm font-dm" style={{ color: 'var(--text-secondary)' }}>
                {[
                  'Enable camera and position your hand clearly',
                  'Enter the gesture label (e.g. NAMASTE)',
                  'Click Record and hold the gesture steady',
                  '50 samples collected → download JSON',
                  'Run python scripts/train_model.py with your new data',
                ].map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-mono shrink-0" style={{ color: 'var(--violet)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>{String(i + 1).padStart(2, '0')}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
