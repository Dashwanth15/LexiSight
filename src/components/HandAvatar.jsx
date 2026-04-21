import { useEffect, useRef, useState } from 'react'

// ── SVG Hand Avatar with CSS-animated pose system ──────────────────────────────
// Each finger has 3 joints controlled via CSS custom properties
// Pose classes baked into style objects for each ISL gesture

const POSES = {
  // ── Common word poses ──
  idle: {
    thumb: [0, 0, 0],
    index: [0, 0, 0],
    middle: [0, 0, 0],
    ring: [0, 0, 0],
    pinky: [0, 0, 0],
    palmRotate: 0,
  },
  hello: { // Open hand, wide spread
    thumb: [-25, -10, 0],
    index: [-5, 0, 0],
    middle: [0, 0, 0],
    ring: [5, 0, 0],
    pinky: [10, 0, 0],
    palmRotate: 0,
  },
  stop: { // All fingers up, palm forward
    thumb: [-20, -5, 0],
    index: [0, 0, 0],
    middle: [0, 0, 0],
    ring: [0, 0, 0],
    pinky: [0, 0, 0],
    palmRotate: 0,
  },
  yes: { // Thumbs up
    thumb: [-60, -10, 0],
    index: [80, 60, 40],
    middle: [80, 60, 40],
    ring: [80, 60, 40],
    pinky: [80, 60, 40],
    palmRotate: -15,
  },
  no: { // Index finger pointing out, slight wag
    thumb: [0, 0, 0],
    index: [-5, 0, 0],
    middle: [80, 60, 40],
    ring: [80, 60, 40],
    pinky: [80, 60, 40],
    palmRotate: 0,
  },
  thankyou: { // Flat hand, touched to chin
    thumb: [-15, 0, 0],
    index: [0, 0, 0],
    middle: [0, 0, 0],
    ring: [0, 0, 0],
    pinky: [0, 0, 0],
    palmRotate: 15,
  },
  please: { // Flat palm circular motion
    thumb: [-10, 0, 0],
    index: [0, 0, 0],
    middle: [0, 0, 0],
    ring: [0, 0, 0],
    pinky: [0, 0, 0],
    palmRotate: 20,
  },
  sorry: { // Fist rotated on chest
    thumb: [30, 20, 10],
    index: [80, 60, 40],
    middle: [80, 60, 40],
    ring: [80, 60, 40],
    pinky: [80, 60, 40],
    palmRotate: 0,
  },
  good: { // Thumbs up (same as yes)
    thumb: [-60, -10, 0],
    index: [80, 60, 40],
    middle: [80, 60, 40],
    ring: [80, 60, 40],
    pinky: [80, 60, 40],
    palmRotate: -15,
  },
  bad: { // Thumbs down
    thumb: [60, 10, 0],
    index: [80, 60, 40],
    middle: [80, 60, 40],
    ring: [80, 60, 40],
    pinky: [80, 60, 40],
    palmRotate: 15,
  },
  water: { // W handshape
    thumb: [50, 0, 0],
    index: [0, 0, 0],
    middle: [0, 0, 0],
    ring: [0, 0, 0],
    pinky: [80, 60, 40],
    palmRotate: 0,
  },
  food: { // Fingers touching thumb
    thumb: [-10, 20, 0],
    index: [30, 50, 30],
    middle: [30, 50, 30],
    ring: [30, 50, 30],
    pinky: [30, 50, 30],
    palmRotate: 10,
  },
  pain: { // Two index fingers pointing together
    thumb: [0, 0, 0],
    index: [-5, 0, 0],
    middle: [80, 60, 40],
    ring: [80, 60, 40],
    pinky: [80, 60, 40],
    palmRotate: 0,
  },
  help: { // Thumb up on flat palm lifted
    thumb: [-50, -10, 0],
    index: [0, 0, 0],
    middle: [0, 0, 0],
    ring: [0, 0, 0],
    pinky: [0, 0, 0],
    palmRotate: 0,
  },
  come: { // Index finger curl beckoning
    thumb: [0, 0, 0],
    index: [0, 40, 30],
    middle: [80, 60, 40],
    ring: [80, 60, 40],
    pinky: [80, 60, 40],
    palmRotate: 0,
  },
  sit: { // Two fingers bent down (like person sitting)
    thumb: [0, 0, 0],
    index: [0, 70, 40],
    middle: [0, 70, 40],
    ring: [80, 60, 40],
    pinky: [80, 60, 40],
    palmRotate: -10,
  },
  stand: { // Two fingers straight down
    thumb: [0, 0, 0],
    index: [0, 0, 0],
    middle: [0, 0, 0],
    ring: [80, 60, 40],
    pinky: [80, 60, 40],
    palmRotate: 0,
  },
  eat: { // Fingers bunch to mouth
    thumb: [0, 20, 10],
    index: [30, 60, 30],
    middle: [30, 60, 30],
    ring: [30, 60, 30],
    pinky: [30, 60, 30],
    palmRotate: 15,
  },
  drink: { // C shape raised to mouth
    thumb: [-20, -5, 0],
    index: [30, 0, 0],
    middle: [30, 0, 0],
    ring: [30, 0, 0],
    pinky: [30, 0, 0],
    palmRotate: 25,
  },
  sleep: { // Hand to cheek, eyes closed
    thumb: [-10, 0, 0],
    index: [20, 10, 0],
    middle: [20, 10, 0],
    ring: [20, 10, 0],
    pinky: [20, 10, 0],
    palmRotate: 30,
  },
  go: { // Index pointing forward
    thumb: [0, 0, 0],
    index: [-5, 0, 0],
    middle: [80, 60, 40],
    ring: [80, 60, 40],
    pinky: [80, 60, 40],
    palmRotate: -90,
  },

  // ── ISL Letter poses (simplified fingerspelling) ──
  'letter-a': { thumb: [30, 10, 0], index: [80, 60, 40], middle: [80, 60, 40], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: 0 },
  'letter-b': { thumb: [50, 30, 0], index: [0, 0, 0], middle: [0, 0, 0], ring: [0, 0, 0], pinky: [0, 0, 0], palmRotate: 0 },
  'letter-c': { thumb: [-20, 0, 0], index: [25, 0, 0], middle: [25, 0, 0], ring: [25, 0, 0], pinky: [25, 0, 0], palmRotate: 0 },
  'letter-d': { thumb: [20, 20, 0], index: [0, 0, 0], middle: [70, 50, 30], ring: [70, 50, 30], pinky: [70, 50, 30], palmRotate: 0 },
  'letter-e': { thumb: [40, 20, 0], index: [50, 60, 40], middle: [50, 60, 40], ring: [50, 60, 40], pinky: [50, 60, 40], palmRotate: 0 },
  'letter-f': { thumb: [10, 30, 20], index: [30, 60, 30], middle: [0, 0, 0], ring: [0, 0, 0], pinky: [0, 0, 0], palmRotate: 0 },
  'letter-g': { thumb: [-15, 0, 0], index: [-10, 0, 0], middle: [80, 60, 40], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: -90 },
  'letter-h': { thumb: [0, 0, 0], index: [0, 0, 0], middle: [0, 0, 0], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: -90 },
  'letter-i': { thumb: [50, 30, 0], index: [80, 60, 40], middle: [80, 60, 40], ring: [80, 60, 40], pinky: [0, 0, 0], palmRotate: 0 },
  'letter-j': { thumb: [50, 30, 0], index: [80, 60, 40], middle: [80, 60, 40], ring: [80, 60, 40], pinky: [0, 0, 0], palmRotate: -20 },
  'letter-k': { thumb: [10, 20, 0], index: [0, 0, 0], middle: [0, 20, 0], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: 0 },
  'letter-l': { thumb: [-60, 0, 0], index: [0, 0, 0], middle: [80, 60, 40], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: 0 },
  'letter-m': { thumb: [40, 20, 0], index: [60, 60, 60], middle: [60, 60, 60], ring: [60, 60, 60], pinky: [80, 60, 40], palmRotate: 0 },
  'letter-n': { thumb: [40, 20, 0], index: [60, 60, 60], middle: [60, 60, 60], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: 0 },
  'letter-o': { thumb: [-10, 30, 20], index: [25, 40, 20], middle: [25, 40, 20], ring: [25, 40, 20], pinky: [25, 40, 20], palmRotate: 0 },
  'letter-p': { thumb: [10, 20, 0], index: [0, 0, 0], middle: [0, 30, 0], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: -30 },
  'letter-q': { thumb: [-15, 0, 0], index: [0, 30, 0], middle: [80, 60, 40], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: -30 },
  'letter-r': { thumb: [50, 0, 0], index: [0, 0, 0], middle: [5, -5, 0], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: 0 },
  'letter-s': { thumb: [30, 10, 0], index: [70, 60, 40], middle: [70, 60, 40], ring: [70, 60, 40], pinky: [70, 60, 40], palmRotate: 0 },
  'letter-t': { thumb: [20, 30, 20], index: [60, 60, 40], middle: [80, 60, 40], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: 0 },
  'letter-u': { thumb: [50, 0, 0], index: [0, 0, 0], middle: [0, 0, 0], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: 0 },
  'letter-v': { thumb: [50, 0, 0], index: [-5, 0, 0], middle: [5, 0, 0], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: 0 },
  'letter-w': { thumb: [50, 0, 0], index: [0, 0, 0], middle: [0, 0, 0], ring: [0, 0, 0], pinky: [80, 60, 40], palmRotate: 0 },
  'letter-x': { thumb: [50, 0, 0], index: [0, 60, 30], middle: [80, 60, 40], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: 0 },
  'letter-y': { thumb: [-30, 0, 0], index: [80, 60, 40], middle: [80, 60, 40], ring: [80, 60, 40], pinky: [0, 0, 0], palmRotate: 0 },
  'letter-z': { thumb: [50, 0, 0], index: [0, 0, 0], middle: [80, 60, 40], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: 0 },

  // Digit poses
  'digit-0': { thumb: [-10, 30, 20], index: [25, 40, 20], middle: [25, 40, 20], ring: [25, 40, 20], pinky: [25, 40, 20], palmRotate: 0 },
  'digit-1': { thumb: [50, 30, 0], index: [0, 0, 0], middle: [80, 60, 40], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: 0 },
  'digit-2': { thumb: [50, 30, 0], index: [0, 0, 0], middle: [0, 0, 0], ring: [80, 60, 40], pinky: [80, 60, 40], palmRotate: 0 },
  'digit-3': { thumb: [-20, 0, 0], index: [0, 0, 0], middle: [0, 0, 0], ring: [0, 0, 0], pinky: [80, 60, 40], palmRotate: 0 },
  'digit-4': { thumb: [50, 0, 0], index: [0, 0, 0], middle: [0, 0, 0], ring: [0, 0, 0], pinky: [0, 0, 0], palmRotate: 0 },
  'digit-5': { thumb: [-20, 0, 0], index: [0, 0, 0], middle: [0, 0, 0], ring: [0, 0, 0], pinky: [0, 0, 0], palmRotate: 0 },
  'digit-6': { thumb: [-15, 20, 0], index: [0, 0, 0], middle: [0, 0, 0], ring: [0, 0, 0], pinky: [80, 60, 40], palmRotate: 0 },
  'digit-7': { thumb: [-15, 20, 0], index: [0, 0, 0], middle: [0, 0, 0], ring: [80, 60, 40], pinky: [0, 0, 0], palmRotate: 0 },
  'digit-8': { thumb: [-15, 20, 0], index: [0, 0, 0], middle: [80, 60, 40], ring: [0, 0, 0], pinky: [0, 0, 0], palmRotate: 0 },
  'digit-9': { thumb: [15, 30, 20], index: [30, 50, 30], middle: [0, 0, 0], ring: [0, 0, 0], pinky: [0, 0, 0], palmRotate: 0 },
}

function getPoseForGesture(gesture) {
  if (!gesture) return POSES.idle
  const key = gesture.toLowerCase().replace(' ', '')
  return POSES[gesture] || POSES[key] || POSES.idle
}

// Finger SVG path builder
function Finger({ joints = [0, 0, 0], x, y, color = '#8b5cf6', length = 28, width = 7, label = '' }) {
  const [j1, j2, j3] = joints
  const rad = (deg) => (deg * Math.PI) / 180

  // Segment positions using joint rotations
  const seg1End = {
    x: x + Math.sin(rad(j1)) * length,
    y: y - Math.cos(rad(j1)) * length,
  }
  const seg2End = {
    x: seg1End.x + Math.sin(rad(j1 + j2)) * (length * 0.75),
    y: seg1End.y - Math.cos(rad(j1 + j2)) * (length * 0.75),
  }
  const seg3End = {
    x: seg2End.x + Math.sin(rad(j1 + j2 + j3)) * (length * 0.6),
    y: seg2End.y - Math.cos(rad(j1 + j2 + j3)) * (length * 0.6),
  }

  const tipColor = '#00ff88'

  return (
    <g>
      {/* Joint 1-2 */}
      <line x1={x} y1={y} x2={seg1End.x} y2={seg1End.y}
        stroke={color} strokeWidth={width} strokeLinecap="round" />
      {/* Joint 2-3 */}
      <line x1={seg1End.x} y1={seg1End.y} x2={seg2End.x} y2={seg2End.y}
        stroke={color} strokeWidth={width * 0.85} strokeLinecap="round" />
      {/* Joint 3-tip */}
      <line x1={seg2End.x} y1={seg2End.y} x2={seg3End.x} y2={seg3End.y}
        stroke={color} strokeWidth={width * 0.7} strokeLinecap="round" />

      {/* Tip circle */}
      <circle cx={seg3End.x} cy={seg3End.y} r={width * 0.45}
        fill={tipColor}
        style={{ filter: 'drop-shadow(0 0 4px #00ff88)' }} />
    </g>
  )
}

export default function HandAvatar({ gesture = null, isActive = false, animSpeed = 1, className = '' }) {
  const pose = getPoseForGesture(gesture)
  const prevPoseRef = useRef(pose)
  const [displayPose, setDisplayPose] = useState(pose)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    if (gesture !== null) {
      setTransitioning(true)
      const delay = 50 / animSpeed
      const t = setTimeout(() => {
        setDisplayPose(getPoseForGesture(gesture))
        setTransitioning(false)
      }, delay)
      return () => clearTimeout(t)
    }
  }, [gesture, animSpeed])

  const p = displayPose
  const glowColor = isActive ? '#00ff88' : '#00d4ff'

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ transition: 'opacity 0.15s', opacity: transitioning ? 0.6 : 1 }}
      aria-label={gesture ? `Hand sign for: ${gesture}` : 'Idle hand position'}
    >
      <svg
        width="180"
        height="220"
        viewBox="0 0 180 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: isActive ? `drop-shadow(0 0 12px ${glowColor})` : 'none',
          transform: `rotate(${p.palmRotate}deg)`,
          transition: `transform ${300 / animSpeed}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
        }}
      >
        {/* Palm */}
        <ellipse cx="90" cy="175" rx="36" ry="28"
          fill="#1a2535"
          stroke={isActive ? glowColor : '#1a2535'}
          strokeWidth="1.5"
        />

        {/* Wrist */}
        <rect x="68" y="185" width="44" height="30" rx="10"
          fill="#0d1520"
          stroke={isActive ? `${glowColor}40` : '#1a253540'}
          strokeWidth="1"
        />

        {/* Base knuckle dots */}
        {[55, 70, 87, 104, 118].map((kx, i) => (
          <circle key={i} cx={kx} cy={160} r={3.5} fill="#8b5cf6"
            style={{ filter: 'drop-shadow(0 0 3px #8b5cf6)' }} />
        ))}

        {/* Thumb */}
        <Finger
          joints={p.thumb}
          x={52} y={165}
          color="#8b5cf6" length={22} width={7} label="thumb"
        />

        {/* Index */}
        <Finger
          joints={p.index}
          x={67} y={158}
          color="#8b5cf6" length={30} width={7} label="index"
        />

        {/* Middle */}
        <Finger
          joints={p.middle}
          x={84} y={154}
          color="#8b5cf6" length={33} width={7} label="middle"
        />

        {/* Ring */}
        <Finger
          joints={p.ring}
          x={101} y={156}
          color="#8b5cf6" length={30} width={7} label="ring"
        />

        {/* Pinky */}
        <Finger
          joints={p.pinky}
          x={116} y={162}
          color="#8b5cf6" length={24} width={6} label="pinky"
        />

        {/* Active glow pulse ring */}
        {isActive && (
          <circle cx="90" cy="175" r="42"
            fill="none"
            stroke={glowColor}
            strokeWidth="1"
            opacity="0.3"
            style={{ animation: 'node-pulse 2s ease-in-out infinite' }}
          />
        )}
      </svg>

      {/* Gesture label */}
      {gesture && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <span
            className="font-syne font-bold text-xs tracking-widest uppercase px-3 py-1 rounded-full"
            style={{
              color: isActive ? '#00ff88' : '#00d4ff',
              background: isActive ? 'rgba(0,255,136,0.1)' : 'rgba(0,212,255,0.1)',
              border: `1px solid ${isActive ? 'rgba(0,255,136,0.3)' : 'rgba(0,212,255,0.2)'}`,
            }}
          >
            {gesture}
          </span>
        </div>
      )}
    </div>
  )
}
