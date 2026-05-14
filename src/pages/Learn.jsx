import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { LESSON_PLAN, getTotalSigns, getTotalXP } from '../data/lessonPlan.js'
import { useMediaPipe } from '../hooks/useMediaPipe.js'
import { useSharedClassifier } from '../contexts/ClassifierContext.jsx' // FIX — shared
import HandOverlay from '../components/HandOverlay.jsx'
import HandAvatar from '../components/HandAvatar.jsx'

// ── Progress Storage ─────────────────────────────────────────────────────────
const STORAGE_KEY = 'lxi_learn_progress'

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ── XP Ring ──────────────────────────────────────────────────────────────────
function XPRing({ xp, maxXP, color, size = 64 }) {
  const r = (size / 2) - 6
  const circ = 2 * Math.PI * r
  const pct = Math.min(1, xp / maxXP)
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  )
}

// ── Chapter Card ─────────────────────────────────────────────────────────────
function ChapterCard({ chapter, progress, onSelect }) {
  const totalSigns = chapter.lessons.reduce((a, l) => a + l.signs.length, 0)
  const doneSigns = chapter.lessons.reduce((a, l) =>
    a + l.signs.filter(s => progress[`${chapter.id}-${s.word}`] >= s.passingScore).length, 0)
  const pct = totalSigns > 0 ? doneSigns / totalSigns : 0
  const isComplete = pct >= 1

  return (
    <div
      onClick={() => onSelect(chapter)}
      className="glass-card"
      style={{
        padding: '1.5rem', cursor: 'pointer',
        borderTop: `2px solid ${chapter.color}40`,
        transition: 'transform 0.2s, box-shadow 0.2s',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
    >
      {isComplete && (
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: '1rem' }}>✅</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <XPRing xp={doneSigns} maxXP={totalSigns} color={chapter.color} size={56} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
          }}>
            {chapter.icon}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#e8f4fd' }}>
            {chapter.title}
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: chapter.color, marginTop: 2 }}>
            {doneSigns}/{totalSigns} signs · {chapter.xpReward} XP
          </div>
        </div>
      </div>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.82rem', color: '#6b8ba4', marginBottom: '0.75rem' }}>
        {chapter.description}
      </p>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: chapter.color, borderRadius: 2, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ marginTop: '0.75rem' }}>
        <span style={{
          fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: '0.8rem',
          color: chapter.color, background: `${chapter.color}10`,
          border: `1px solid ${chapter.color}30`, borderRadius: 20,
          padding: '4px 12px',
        }}>
          {isComplete ? '🎉 Complete! Review' : pct > 0 ? `Continue (${(pct * 100).toFixed(0)}%)` : 'Start →'}
        </span>
      </div>
    </div>
  )
}

// ── Practice Mode ────────────────────────────────────────────────────────────
function PracticeSign({ sign, chapter, onPass, onSkip, mediapipe, classifier }) {
  const [score, setScore] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [passed, setPassed] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const lastCheckRef = useRef(0)

  // Score the current gesture every 500ms
  useEffect(() => {
    if (passed || !mediapipe.handDetected || !mediapipe.landmarks) return
    const now = Date.now()
    if (now - lastCheckRef.current < 500) return
    lastCheckRef.current = now

    const result = classifier.predict(mediapipe.landmarks, mediapipe.rawLandmarks)
    if (!result) return

    const isTarget = result.label === sign.word
    const conf = isTarget ? result.confidence : 0

    setAttempts(a => a + 1)
    setScore(conf)

    if (isTarget && conf >= sign.passingScore) {
      setPassed(true)
      setFeedback('🎉 Perfect! Great job!')
      setTimeout(() => onPass(conf), 1500)
    } else if (result.confidence > 0.6) {
      setFeedback(`Detected: ${result.label} — keep trying!`)
    } else {
      setFeedback('Show your hand clearly to the camera')
    }
  }, [mediapipe.landmarks, mediapipe.handDetected, passed, sign, classifier, onPass])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Target sign display */}
      <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', borderTop: `2px solid ${chapter.color}40`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: chapter.color, letterSpacing: '0.15em', marginBottom: 12 }}>
          MAKE THIS SIGN
        </div>
        <HandAvatar gesture={sign.word} isActive={true} animSpeed={1} className="h-28 mb-3" />
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(2.5rem,8vw,4rem)', color: chapter.color,
          textShadow: `0 0 40px ${chapter.color}50`, lineHeight: 1, marginBottom: 8 }}>
          {sign.word}
        </div>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: '#e8f4fd', marginBottom: 4 }}>
          {sign.instruction}
        </p>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: '#6b8ba4' }}>
          💡 {sign.tip}
        </p>
      </div>

      {/* Score bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="hud-label">Match Score</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem',
            color: score >= sign.passingScore ? '#00ff88' : score > 0.4 ? '#ffaa00' : '#6b8ba4' }}>
            {(score * 100).toFixed(0)}% / {(sign.passingScore * 100).toFixed(0)}% needed
          </span>
        </div>
        <div className="confidence-bar-track">
          <div className={`confidence-bar-fill ${score >= sign.passingScore ? 'high' : score > 0.4 ? 'medium' : 'low'}`}
            style={{ width: `${score * 100}%` }} />
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem',
          fontFamily: 'DM Sans, sans-serif',
          background: passed ? 'rgba(0,255,136,0.08)' : 'rgba(0,212,255,0.06)',
          border: `1px solid ${passed ? 'rgba(0,255,136,0.2)' : 'rgba(0,212,255,0.15)'}`,
          color: passed ? '#00ff88' : '#6b8ba4',
        }}>
          {feedback}
        </div>
      )}

      {/* Camera hint */}
      {!mediapipe.isReady && (
        <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={mediapipe.initialize}>
          📷 Enable Camera to Practice
        </button>
      )}

      <button className="btn-secondary" style={{ justifyContent: 'center', fontSize: '0.8rem' }} onClick={onSkip}>
        Skip this sign →
      </button>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Learn() {
  const [progress, setProgress] = useState(loadProgress)
  const [activeChapter, setActiveChapter] = useState(null)
  const [activeLesson, setActiveLesson] = useState(null)
  const [signIdx, setSignIdx] = useState(0)
  const [lessonDone, setLessonDone] = useState(false)

  const mediapipe = useMediaPipe()
  const classifier = useSharedClassifier() // FIX — shared

  const totalXP = Object.values(progress).filter(v => v > 0).length * 10

  const startLesson = useCallback((chapter, lesson) => {
    setActiveChapter(chapter)
    setActiveLesson(lesson)
    setSignIdx(0)
    setLessonDone(false)
    mediapipe.initialize()
  }, [mediapipe])

  const handlePass = useCallback((conf) => {
    const key = `${activeChapter.id}-${activeLesson.signs[signIdx].word}`
    const updated = { ...progress, [key]: conf }
    setProgress(updated)
    saveProgress(updated)

    if (signIdx < activeLesson.signs.length - 1) {
      setSignIdx(i => i + 1)
    } else {
      setLessonDone(true)
    }
  }, [activeChapter, activeLesson, signIdx, progress])

  const handleSkip = useCallback(() => {
    if (signIdx < activeLesson.signs.length - 1) setSignIdx(i => i + 1)
    else setLessonDone(true)
  }, [activeLesson, signIdx])

  // Chapter select view
  if (!activeLesson) {
    return (
      <div style={{ minHeight: '100dvh', paddingTop: 64, background: 'var(--void)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <div className="hud-label" style={{ marginBottom: '0.5rem' }}>SDG 4 · Quality Education</div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(2rem,6vw,3.5rem)', color: '#e8f4fd', marginBottom: '0.5rem' }}>
              Learn ISL
            </h1>
            <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#6b8ba4', fontSize: '1rem' }}>
              Interactive AI-scored lessons. Show the sign — the AI judges you. Earn XP, track progress.
            </p>
          </div>

          {/* XP Bar */}
          <div className="glass-card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '1.5rem' }}>⭐</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#e8f4fd' }}>Total XP</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: '#ffaa00' }}>{totalXP} / {getTotalSigns() * 10}</span>
              </div>
              <div className="confidence-bar-track" style={{ height: 6 }}>
                <div className="confidence-bar-fill high" style={{ width: `${Math.min(100, (totalXP / (getTotalSigns() * 10)) * 100)}%` }} />
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#6b8ba4' }}>SIGNS</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.4rem', color: '#00d4ff' }}>
                {Object.values(progress).filter(v => v > 0).length}
              </div>
            </div>
          </div>

          {/* Chapter Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {LESSON_PLAN.map(chapter => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                progress={progress}
                onSelect={ch => {
                  setActiveChapter(ch)
                  startLesson(ch, ch.lessons[0])
                }}
              />
            ))}
          </div>

          {/* Footer nudge */}
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <Link to="/translate" className="btn-secondary" style={{ fontSize: '0.85rem' }}>
              ← Back to Translator
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Lesson done screen
  if (lessonDone) {
    return (
      <div style={{ minHeight: '100dvh', paddingTop: 64, background: 'var(--void)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div className="glass-card" style={{ maxWidth: 420, width: '100%', padding: '2rem', textAlign: 'center', borderTop: `2px solid ${activeChapter.color}40` }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: activeChapter.color, letterSpacing: '0.15em', marginBottom: '0.5rem' }}>LESSON COMPLETE</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.8rem', color: '#e8f4fd', marginBottom: '0.5rem' }}>{activeLesson.title}</h2>
          <p style={{ fontFamily: 'DM Sans, sans-serif', color: '#6b8ba4', fontSize: '0.9rem', marginBottom: '1.5rem' }}>+{activeLesson.signs.length * 10} XP earned!</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeChapter.lessons.indexOf(activeLesson) < activeChapter.lessons.length - 1 && (
              <button className="btn-primary" style={{ justifyContent: 'center' }}
                onClick={() => {
                  const nextIdx = activeChapter.lessons.indexOf(activeLesson) + 1
                  startLesson(activeChapter, activeChapter.lessons[nextIdx])
                }}>
                Next Lesson →
              </button>
            )}
            <button className="btn-secondary" style={{ justifyContent: 'center' }} onClick={() => { setActiveLesson(null); setActiveChapter(null) }}>
              Back to Chapters
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Active practice
  const currentSign = activeLesson.signs[signIdx]
  return (
    <div style={{ minHeight: '100dvh', paddingTop: 64, background: 'var(--void)' }}>
      {/* Progress bar */}
      <div style={{ height: 3, background: '#1a2535' }}>
        <div style={{ height: '100%', width: `${((signIdx) / activeLesson.signs.length) * 100}%`, background: activeChapter.color, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: Camera + overlay */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="hud-label" style={{ color: activeChapter.color }}>{activeChapter.title} · {activeLesson.title}</div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', color: '#6b8ba4', marginTop: 2 }}>
                Sign {signIdx + 1} of {activeLesson.signs.length}
              </div>
            </div>
            <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              onClick={() => { setActiveLesson(null); setActiveChapter(null) }}>
              ← Exit
            </button>
          </div>

          {classifier.status === 'geometric' && (
            <div style={{ background: 'rgba(255, 170, 0, 0.1)', border: '1px solid rgba(255, 170, 0, 0.4)', borderRadius: 8, padding: '10px 14px', color: '#ffaa00', fontSize: '0.75rem', fontFamily: 'DM Sans, sans-serif' }}>
              <strong>⚠ ML Model Not Found!</strong> Using geometric fallback. Detection will be very poor until you <Link to="/train" style={{textDecoration:'underline'}}>train the Neural Network</Link>.
            </div>
          )}

          {/* Camera */}
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000',
            border: `1.5px solid ${mediapipe.handDetected ? activeChapter.color + '60' : '#1a2535'}`,
            aspectRatio: '4/3' }}>
            <video ref={mediapipe.videoRef} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }} />
            {mediapipe.isReady && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <HandOverlay rawLandmarks={mediapipe.rawLandmarks} handDetected={mediapipe.handDetected} confidence={0} videoRef={mediapipe.videoRef} />
              </div>
            )}
            {!mediapipe.isReady && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <span style={{ fontSize: '2rem' }}>📷</span>
                <button className="btn-primary" onClick={mediapipe.initialize}>Enable Camera</button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Practice UI */}
        <PracticeSign
          sign={currentSign}
          chapter={activeChapter}
          onPass={handlePass}
          onSkip={handleSkip}
          mediapipe={mediapipe}
          classifier={classifier}
        />
      </div>
    </div>
  )
}
