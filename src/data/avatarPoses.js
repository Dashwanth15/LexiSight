// avatarPoses.js — ISL Hand Gesture Pose Library
// ──────────────────────────────────────────────────────────────────────────────
// Each pose defines finger joint angles in degrees for the 3 joints:
//   [MCP, PIP, DIP]  — metacarpophalangeal, proximal IP, distal IP
//
// Sign conventions applied to the real GLB rig (from observation):
//   Positive  = curl / flex toward palm
//   Negative  = extend / splay open
//   palmRotate = wrist Z-rotation in degrees (positive = tilt right)
//
// ISL sources: general ISL handshape conventions for common vocabulary.
// ──────────────────────────────────────────────────────────────────────────────

export const AVATAR_POSES = {

  // ── Rest / neutral ────────────────────────────────────────────────────────
  idle: {
    thumb: [5, 5, 0], index: [8, 5, 3], middle: [8, 5, 3],
    ring: [10, 6, 3], pinky: [12, 6, 3], palmRotate: 0,
    arm: { lift: 0, roll: 0 }, pos: { x: 0, y: 0, z: 0 },
    duration: 600,
  },

  // ── Common ISL Words ──────────────────────────────────────────────────────

  // HELLO — Open flat palm, fingers straight & slightly fanned, palm faces out
  hello: {
    thumb: [-30, -5, 0], index: [-8, -3, 0], middle: [-5, -2, 0],
    ring: [0, 0, 0], pinky: [5, 2, 0], palmRotate: -5,
    arm: { lift: -4, roll: -8 }, pos: { x: 0, y: 0.22, z: 0 },
    duration: 400,
  },

  // STOP — Flat palm thrust forward, all fingers fully extended upright
  stop: {
    thumb: [-20, -5, 0], index: [-5, -3, 0], middle: [-3, -2, 0],
    ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0,
    arm: { lift: -3, roll: -9 }, pos: { x: 0, y: 0.15, z: -0.1 },
    duration: 300,
  },

  // YES — Closed fist, index-knuckle nod (A-shape + bowing wrist)
  yes: {
    thumb: [20, 10, 5], index: [75, 65, 45], middle: [75, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: 10,
    arm: { lift: 0, roll: 3 }, pos: { x: 0, y: 0.05, z: 0 },
    duration: 350,
  },

  // NO — Index finger points up, waving (index straight, all others curled)
  no: {
    thumb: [25, 12, 5], index: [-8, -3, 0], middle: [80, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: 0,
    pos: { x: 0, y: 0.18, z: 0 },
    duration: 350,
  },

  // THANK YOU — Flat palm from chin moving forward, slight wrist tilt
  thankyou: {
    thumb: [-20, -5, 0], index: [-5, -2, 0], middle: [-3, -2, 0],
    ring: [-2, -1, 0], pinky: [0, 0, 0], palmRotate: 18,
    pos: { x: 0, y: 0.25, z: -0.05 },
    duration: 500,
  },
  'thank you': {
    thumb: [-20, -5, 0], index: [-5, -2, 0], middle: [-3, -2, 0],
    ring: [-2, -1, 0], pinky: [0, 0, 0], palmRotate: 18,
    pos: { x: 0, y: 0.25, z: -0.05 },
    duration: 500,
  },

  // PLEASE — Flat palm in circular motion on chest, fingers relaxed
  please: {
    thumb: [-15, -3, 0], index: [-3, -2, 0], middle: [-2, -1, 0],
    ring: [0, 0, 0], pinky: [2, 1, 0], palmRotate: 22,
    pos: { x: 0, y: 0.08, z: 0 },
    duration: 450,
  },

  // SORRY — Closed fist, circular motion on chest (fist shape)
  sorry: {
    thumb: [28, 15, 8], index: [78, 65, 45], middle: [78, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: 5,
    pos: { x: 0, y: 0.06, z: 0 },
    duration: 400,
  },

  // GOOD — Thumb up, all fingers curled (thumbs-up handshape)
  good: {
    thumb: [-65, -10, 0], index: [78, 65, 45], middle: [80, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: -12,
    pos: { x: 0, y: 0.12, z: 0 },
    duration: 350,
  },

  // BAD — Thumb down (thumb curled inward, fingers loosely curled)
  bad: {
    thumb: [65, 15, 5], index: [78, 65, 45], middle: [80, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: 12,
    pos: { x: 0, y: -0.1, z: 0 },
    duration: 350,
  },

  // HELP — Fist on flat palm (A-handshape lifted): thumb up, compact fist
  help: {
    thumb: [-55, -8, 0], index: [72, 60, 40], middle: [75, 62, 42],
    ring: [78, 62, 42], pinky: [80, 62, 42], palmRotate: 0,
    pos: { x: 0, y: 0.2, z: 0 },
    duration: 400,
  },

  // COME — Beckoning: index finger curved and bent repeatedly
  come: {
    thumb: [10, 5, 0], index: [5, 55, 35], middle: [78, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: -5,
    pos: { x: 0, y: 0.1, z: -0.15 },
    duration: 400,
  },

  // GO — Index finger pointing (pointing handshape, arm extended)
  go: {
    thumb: [15, 8, 3], index: [-8, -3, 0], middle: [80, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: -85,
    pos: { x: 0, y: 0.08, z: -0.18 },
    duration: 350,
  },

  // EAT — Fingers and thumb pinched together at lips (O-shape going to mouth)
  eat: {
    thumb: [15, 32, 18], index: [28, 55, 32], middle: [28, 55, 32],
    ring: [30, 55, 32], pinky: [32, 55, 32], palmRotate: 18,
    pos: { x: 0, y: 0.32, z: -0.05 },
    duration: 450,
  },

  // DRINK — C-shape hand as if holding a cup
  drink: {
    thumb: [-22, -5, 0], index: [32, 5, 0], middle: [32, 5, 0],
    ring: [34, 5, 0], pinky: [36, 5, 0], palmRotate: 28,
    pos: { x: 0, y: 0.30, z: -0.05 },
    duration: 450,
  },

  // WATER — W-handshape: index, middle, ring extended; thumb + pinky curled
  water: {
    thumb: [48, 22, 8], index: [-5, -2, 0], middle: [-3, -2, 0],
    ring: [-3, -2, 0], pinky: [78, 62, 42], palmRotate: 0,
    pos: { x: 0, y: 0.26, z: 0 },
    duration: 400,
  },

  // PAIN — Two index fingers pointing at each other (pointing at the hurt spot)
  pain: {
    thumb: [22, 10, 4], index: [-8, -3, 0], middle: [78, 62, 42],
    ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 5,
    pos: { x: 0, y: 0.1, z: -0.08 },
    duration: 400,
  },

  // SLEEP — Fingers gathered, hand on cheek (bent-O touching face)
  sleep: {
    thumb: [12, 18, 8], index: [22, 18, 8], middle: [22, 18, 8],
    ring: [22, 18, 8], pinky: [25, 18, 8], palmRotate: 32,
    pos: { x: 0.08, y: 0.28, z: 0 },
    duration: 500,
  },

  // SIT — Two fingers pointing down like legs dangling
  sit: {
    thumb: [18, 8, 3],
    index: [5, 72, 42],
    middle: [5, 72, 42],
    ring: [80, 62, 42],
    pinky: [80, 62, 42],
    palmRotate: -12,
    duration: 400,
  },

  // STAND — Two fingers pointing straight down (V-down)
  stand: {
    thumb: [18, 8, 3],
    index: [-5, -2, 0],
    middle: [-3, -2, 0],
    ring: [78, 62, 42],
    pinky: [80, 62, 42],
    palmRotate: 0,
    duration: 400,
  },

  // ── ISL Fingerspelling A–Z ────────────────────────────────────────────────
  // Based on ISL one-handed fingerspelling handshapes

  // A — Fist, thumb on side
  'letter-a': { thumb: [28, 12, 5], index: [78, 65, 45], middle: [78, 65, 45], ring: [80, 65, 45], pinky: [82, 65, 45], palmRotate: 0, duration: 300 },
  // B — Four fingers up, thumb folded across palm
  'letter-b': { thumb: [52, 35, 5], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0, duration: 300 },
  // C — Curved C-shape
  'letter-c': { thumb: [-18, 5, 0], index: [28, 5, 0], middle: [28, 5, 0], ring: [28, 5, 0], pinky: [28, 5, 0], palmRotate: 0, duration: 300 },
  // D — Index up, others and thumb form circle
  'letter-d': { thumb: [22, 22, 5], index: [-5, -2, 0], middle: [68, 52, 32], ring: [68, 52, 32], pinky: [68, 52, 32], palmRotate: 0, duration: 300 },
  // E — Fingers curled, thumb tucked under
  'letter-e': { thumb: [38, 22, 5], index: [52, 62, 42], middle: [52, 62, 42], ring: [52, 62, 42], pinky: [55, 62, 42], palmRotate: 0, duration: 300 },
  // F — Index + thumb circle, other 3 up
  'letter-f': { thumb: [12, 32, 22], index: [32, 62, 32], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0, duration: 300 },
  // G — Index + thumb pointing sideways
  'letter-g': { thumb: [-12, 5, 0], index: [-8, -3, 0], middle: [78, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: -88, duration: 300 },
  // H — Index + middle extended sideways
  'letter-h': { thumb: [18, 8, 3], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: -88, duration: 300 },
  // I — Pinky up (baby-I)
  'letter-i': { thumb: [48, 32, 5], index: [80, 65, 45], middle: [80, 65, 45], ring: [80, 65, 45], pinky: [-5, -2, 0], palmRotate: 0, duration: 300 },
  // J — I with sweep motion (static: same as I)
  'letter-j': { thumb: [48, 32, 5], index: [80, 65, 45], middle: [80, 65, 45], ring: [80, 65, 45], pinky: [-5, -2, 0], palmRotate: -18, duration: 300 },
  // K — Index + middle up, thumb between them
  'letter-k': { thumb: [12, 22, 5], index: [-5, -2, 0], middle: [-3, 22, 5], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  // L — L-shape: index up, thumb out
  'letter-l': { thumb: [-62, 5, 0], index: [-5, -2, 0], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  // M — Three fingers folded over thumb
  'letter-m': { thumb: [38, 22, 5], index: [62, 62, 62], middle: [62, 62, 62], ring: [62, 62, 62], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  // N — Two fingers over thumb
  'letter-n': { thumb: [38, 22, 5], index: [62, 62, 62], middle: [62, 62, 62], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  // O — All fingers curved into O-shape
  'letter-o': { thumb: [-8, 32, 22], index: [28, 42, 22], middle: [28, 42, 22], ring: [28, 42, 22], pinky: [28, 42, 22], palmRotate: 0, duration: 300 },
  // P — Index + middle point down (like K rotated down)
  'letter-p': { thumb: [12, 22, 5], index: [-5, -2, 0], middle: [-3, 32, 5], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: -28, duration: 300 },
  // Q — Index + thumb pointing down
  'letter-q': { thumb: [-12, 5, 0], index: [-3, 32, 5], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: -28, duration: 300 },
  // R — Index + middle crossed
  'letter-r': { thumb: [48, 5, 0], index: [-3, -2, 0], middle: [8, -5, 0], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  // S — Fist, thumb over fingers
  'letter-s': { thumb: [32, 12, 5], index: [72, 62, 42], middle: [72, 62, 42], ring: [72, 62, 42], pinky: [72, 62, 42], palmRotate: 0, duration: 300 },
  // T — Thumb between index + middle
  'letter-t': { thumb: [22, 32, 22], index: [62, 62, 42], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  // U — Index + middle up together
  'letter-u': { thumb: [48, 5, 0], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  // V — V-sign: index + middle spread apart
  'letter-v': { thumb: [48, 5, 0], index: [-8, -2, 0], middle: [8, -2, 0], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  // W — Index + middle + ring up
  'letter-w': { thumb: [48, 5, 0], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  // X — Index finger hook
  'letter-x': { thumb: [48, 5, 0], index: [5, 62, 32], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  // Y — Thumb + pinky out (shaka)
  'letter-y': { thumb: [-28, 5, 0], index: [80, 62, 42], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [-5, -2, 0], palmRotate: 0, duration: 300 },
  // Z — Index traces Z (static: index up pointing)
  'letter-z': { thumb: [48, 5, 0], index: [-5, -2, 0], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },

  // ── ISL Digits 0–9 ────────────────────────────────────────────────────────
  'digit-0': { thumb: [-8, 32, 22], index: [28, 42, 22], middle: [28, 42, 22], ring: [28, 42, 22], pinky: [28, 42, 22], palmRotate: 0, duration: 300 },
  'digit-1': { thumb: [48, 32, 5], index: [-5, -2, 0], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  'digit-2': { thumb: [48, 32, 5], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  'digit-3': { thumb: [-18, 5, 0], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  'digit-4': { thumb: [48, 5, 0], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0, duration: 300 },
  'digit-5': { thumb: [-22, 5, 0], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0, duration: 300 },
  'digit-6': { thumb: [-12, 22, 5], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [80, 62, 42], palmRotate: 0, duration: 300 },
  'digit-7': { thumb: [-12, 22, 5], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [80, 62, 42], pinky: [-3, -2, 0], palmRotate: 0, duration: 300 },
  'digit-8': { thumb: [-12, 22, 5], index: [-5, -2, 0], middle: [80, 62, 42], ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0, duration: 300 },
  'digit-9': { thumb: [18, 32, 22], index: [32, 52, 32], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0, duration: 300 },
}

// Lookup with fallback to idle
export function getPoseForGesture(gesture) {
  if (!gesture) return AVATAR_POSES.idle
  const key = gesture.toLowerCase().replace(/\s+/g, '')
  return AVATAR_POSES[gesture] || AVATAR_POSES[key] || AVATAR_POSES.idle
}
