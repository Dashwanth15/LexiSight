// avatarPoses.js — ISL Hand Gesture Pose Library
// ──────────────────────────────────────────────────────────────────────────────
// Each pose defines:
//
//  FINGER JOINTS (angles in degrees, per joint [MCP, PIP, DIP]):
//    Positive  = curl / flex toward palm
//    Negative  = extend / splay open
//    palmRotate = wrist Z-rotation in degrees
//
//  FULL ARM CHAIN (armChain — drives deltoid → upper_arm → forearm):
//    These are LOCAL-space Euler XYZ rotations (degrees) applied ON TOP of
//    the rest-quaternion of each bone.
//
//    deltoidX/Y/Z    — shoulder blade / deltoid bone
//      Z: negative lifts the right arm UP from T-pose;  positive for left arm (mirrored)
//      Y: negative swings right arm FORWARD
//    upperArmX/Y/Z   — bicep / upper arm bone
//      Z: further lifts and positions elbow
//    forearmX/Y/Z    — inner forearm (elbow bend)
//      X: positive = elbow bends (forearm lifts toward face)
//    forearmExtZ     — outer forearm / wrist roll
//
//  The HumanAvatar rig automatically mirrors armChain for the LEFT arm
//  by flipping the signs of Y and Z rotation components.
//
// ISL sources: general ISL handshape conventions for common vocabulary.
// ──────────────────────────────────────────────────────────────────────────────

// ── Shared arm presets ────────────────────────────────────────────────────────
const REST_ARM = {
  deltoidX: 0, deltoidY: 0, deltoidZ: 0,
  upperArmX: 0, upperArmY: 0, upperArmZ: 0,
  forearmX: 0, forearmY: 0, forearmZ: 0,
  forearmExtZ: 0,
}

// Standard ISL signing position:
// Arm raised to chin/chest height, slightly in front of body, elbow bent ~90°
const SIGN_ARM = {
  deltoidX:  0, deltoidY: -18, deltoidZ: -52,
  upperArmX: 0, upperArmY:  0, upperArmZ: -22,
  forearmX: 25, forearmY:   0, forearmZ:   0,
  forearmExtZ: 0,
}

// Low signing position — hand at chest/waist level
const LOW_SIGN_ARM = {
  deltoidX:  0, deltoidY: -10, deltoidZ: -35,
  upperArmX: 0, upperArmY:  0, upperArmZ: -15,
  forearmX: 18, forearmY:   0, forearmZ:   0,
  forearmExtZ: 0,
}

// High signing position — hand at face/head level
const HIGH_SIGN_ARM = {
  deltoidX:  0, deltoidY: -22, deltoidZ: -68,
  upperArmX: 0, upperArmY:  0, upperArmZ: -28,
  forearmX: 30, forearmY:   0, forearmZ:   0,
  forearmExtZ: 0,
}

// Forward thrust — arm extended more forward
const FORWARD_ARM = {
  deltoidX:  0, deltoidY: -28, deltoidZ: -50,
  upperArmX: 0, upperArmY: -10, upperArmZ: -18,
  forearmX: 10, forearmY:   0, forearmZ:   0,
  forearmExtZ: 0,
}

// ── Pose Library ──────────────────────────────────────────────────────────────
export const AVATAR_POSES = {

  // ── Rest / neutral ──────────────────────────────────────────────────────────
  idle: {
    thumb: [5, 5, 0], index: [8, 5, 3], middle: [8, 5, 3],
    ring: [10, 6, 3], pinky: [12, 6, 3], palmRotate: 0,
    arm: { lift: 0, roll: 0 }, pos: { x: 0, y: 0, z: 0 },
    bodyRotateX: 0, bodyRotateY: 0,
    armChain: REST_ARM,
    duration: 600,
  },

  // ── Common ISL Words ────────────────────────────────────────────────────────

  // HELLO — Open flat palm, fingers straight & slightly fanned, palm faces out
  hello: {
    thumb: [-30, -5, 0], index: [-8, -3, 0], middle: [-5, -2, 0],
    ring: [0, 0, 0], pinky: [5, 2, 0], palmRotate: -5,
    arm: { lift: -4, roll: -8 }, pos: { x: 0, y: 0.22, z: 0 },
    bodyRotateX: 0, bodyRotateY: -5,
    armChain: { ...HIGH_SIGN_ARM, deltoidY: -15, forearmExtZ: -8 },
    duration: 400,
  },

  // STOP — Flat palm thrust forward, all fingers fully extended upright
  stop: {
    thumb: [-20, -5, 0], index: [-5, -3, 0], middle: [-3, -2, 0],
    ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0,
    arm: { lift: -3, roll: -9 }, pos: { x: 0, y: 0.15, z: -0.1 },
    armChain: { ...SIGN_ARM, deltoidY: -28, upperArmZ: -15, forearmX: 12, forearmExtZ: 0 },
    duration: 300,
  },

  // YES — Closed fist, index-knuckle nod (A-shape + bowing wrist)
  yes: {
    thumb: [20, 10, 5], index: [75, 65, 45], middle: [75, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: 10,
    arm: { lift: 0, roll: 3 }, pos: { x: 0, y: 0.05, z: 0 },
    armChain: { ...SIGN_ARM, forearmExtZ: 10 },
    duration: 350,
  },

  // NO — Index finger points up, waving (index straight, all others curled)
  no: {
    thumb: [25, 12, 5], index: [-8, -3, 0], middle: [80, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: 0,
    pos: { x: 0, y: 0.18, z: 0 },
    arm: { lift: -5, roll: 5 },
    bodyRotateX: 0, bodyRotateY: 5,
    armChain: { ...SIGN_ARM, deltoidZ: -58, deltoidY: -12 },
    duration: 350,
  },

  // THANK YOU — Flat palm from chin moving forward
  thankyou: {
    thumb: [-20, -5, 0], index: [-5, -2, 0], middle: [-3, -2, 0],
    ring: [-2, -1, 0], pinky: [0, 0, 0], palmRotate: 18,
    pos: { x: 0, y: 0.25, z: -0.05 },
    arm: { lift: 0, roll: 0 },
    bodyRotateX: 10, bodyRotateY: 0,
    armChain: { ...HIGH_SIGN_ARM, forearmExtZ: 18 },
    duration: 500,
  },
  'thank you': {
    thumb: [-20, -5, 0], index: [-5, -2, 0], middle: [-3, -2, 0],
    ring: [-2, -1, 0], pinky: [0, 0, 0], palmRotate: 18,
    pos: { x: 0, y: 0.25, z: -0.05 },
    arm: { lift: 0, roll: 0 },
    bodyRotateX: 10, bodyRotateY: 0,
    armChain: { ...HIGH_SIGN_ARM, forearmExtZ: 18 },
    duration: 500,
  },

  // PLEASE — Flat palm in circular motion on chest
  please: {
    thumb: [-15, -3, 0], index: [-3, -2, 0], middle: [-2, -1, 0],
    ring: [0, 0, 0], pinky: [2, 1, 0], palmRotate: 22,
    pos: { x: 0, y: 0.08, z: 0 },
    arm: { lift: 0, roll: 0 },
    bodyRotateX: 5, bodyRotateY: 0,
    armChain: { ...LOW_SIGN_ARM, forearmExtZ: 22 },
    duration: 450,
  },

  // SORRY — Closed fist, circular motion on chest
  sorry: {
    thumb: [28, 15, 8], index: [78, 65, 45], middle: [78, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: 5,
    pos: { x: 0, y: 0.06, z: 0 },
    arm: { lift: 0, roll: 5 },
    bodyRotateX: 8, bodyRotateY: 0,
    armChain: { ...LOW_SIGN_ARM, forearmExtZ: 5 },
    duration: 400,
  },

  // GOOD — Thumb up (thumbs-up handshape)
  good: {
    thumb: [-65, -10, 0], index: [78, 65, 45], middle: [80, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: -12,
    pos: { x: 0, y: 0.12, z: 0 },
    arm: { lift: -10, roll: -12 },
    armChain: { ...SIGN_ARM, deltoidZ: -55, forearmExtZ: -12 },
    duration: 350,
  },

  // BAD — Thumb down
  bad: {
    thumb: [65, 15, 5], index: [78, 65, 45], middle: [80, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: 12,
    pos: { x: 0, y: -0.1, z: 0 },
    arm: { lift: 5, roll: 12 },
    armChain: { ...LOW_SIGN_ARM, deltoidZ: -30, forearmExtZ: 12 },
    duration: 350,
  },

  // HELP — Fist on flat palm (A-handshape lifted)
  help: {
    thumb: [-55, -8, 0], index: [72, 60, 40], middle: [75, 62, 42],
    ring: [78, 62, 42], pinky: [80, 62, 42], palmRotate: 0,
    pos: { x: 0, y: 0.2, z: 0 },
    arm: { lift: -8, roll: 0 },
    armChain: { ...SIGN_ARM, deltoidZ: -60 },
    duration: 400,
  },

  // COME — Beckoning: index finger curved and bent
  come: {
    thumb: [10, 5, 0], index: [5, 55, 35], middle: [78, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: -5,
    pos: { x: 0, y: 0.1, z: -0.15 },
    arm: { lift: -5, roll: -5 },
    bodyRotateX: 0, bodyRotateY: 10,
    armChain: { ...FORWARD_ARM, forearmExtZ: -5 },
    duration: 400,
  },

  // GO — Index finger pointing forward
  go: {
    thumb: [15, 8, 3], index: [-8, -3, 0], middle: [80, 65, 45],
    ring: [80, 65, 45], pinky: [80, 65, 45], palmRotate: -85,
    pos: { x: 0, y: 0.08, z: -0.18 },
    arm: { lift: -3, roll: -85 },
    bodyRotateX: 0, bodyRotateY: -20,
    armChain: { ...FORWARD_ARM, forearmExtZ: -85 },
    duration: 350,
  },

  // EAT — Fingers and thumb pinched together (O-shape going to mouth)
  eat: {
    thumb: [15, 32, 18], index: [28, 55, 32], middle: [28, 55, 32],
    ring: [30, 55, 32], pinky: [32, 55, 32], palmRotate: 18,
    pos: { x: 0, y: 0.32, z: -0.05 },
    arm: { lift: -8, roll: 18 },
    armChain: { ...HIGH_SIGN_ARM, forearmExtZ: 18 },
    duration: 450,
  },

  // DRINK — C-shape hand as if holding a cup
  drink: {
    thumb: [-22, -5, 0], index: [32, 5, 0], middle: [32, 5, 0],
    ring: [34, 5, 0], pinky: [36, 5, 0], palmRotate: 28,
    pos: { x: 0, y: 0.30, z: -0.05 },
    arm: { lift: -10, roll: 28 },
    armChain: { ...HIGH_SIGN_ARM, forearmExtZ: 28 },
    duration: 450,
  },

  // WATER — W-handshape: index, middle, ring extended
  water: {
    thumb: [48, 22, 8], index: [-5, -2, 0], middle: [-3, -2, 0],
    ring: [-3, -2, 0], pinky: [78, 62, 42], palmRotate: 0,
    pos: { x: 0, y: 0.26, z: 0 },
    arm: { lift: -6, roll: 0 },
    armChain: { ...SIGN_ARM },
    duration: 400,
  },

  // PAIN — Index fingers pointing at each other
  pain: {
    thumb: [22, 10, 4], index: [-8, -3, 0], middle: [78, 62, 42],
    ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 5,
    pos: { x: 0, y: 0.1, z: -0.08 },
    arm: { lift: -3, roll: 5 },
    armChain: { ...SIGN_ARM, deltoidY: -25, forearmX: 15 },
    duration: 400,
  },

  // SLEEP — Fingers gathered, hand on cheek
  sleep: {
    thumb: [12, 18, 8], index: [22, 18, 8], middle: [22, 18, 8],
    ring: [22, 18, 8], pinky: [25, 18, 8], palmRotate: 32,
    pos: { x: 0.08, y: 0.28, z: 0 },
    arm: { lift: -8, roll: 32 },
    armChain: { ...HIGH_SIGN_ARM, forearmExtZ: 32 },
    duration: 500,
  },

  // SIT — Two fingers pointing down like legs dangling
  sit: {
    thumb: [18, 8, 3], index: [5, 72, 42], middle: [5, 72, 42],
    ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: -12,
    arm: { lift: 5, roll: -12 },
    armChain: { ...LOW_SIGN_ARM, forearmExtZ: -12 },
    duration: 400,
  },

  // STAND — Two fingers pointing straight down (V-down)
  stand: {
    thumb: [18, 8, 3], index: [-5, -2, 0], middle: [-3, -2, 0],
    ring: [78, 62, 42], pinky: [80, 62, 42], palmRotate: 0,
    arm: { lift: -4, roll: 0 },
    armChain: { ...LOW_SIGN_ARM },
    duration: 400,
  },

  // ── ISL Fingerspelling A–Z ──────────────────────────────────────────────────
  // All letters use the signing arm position (arm raised, elbow bent)

  'letter-a': { thumb: [28, 12, 5], index: [78, 65, 45], middle: [78, 65, 45], ring: [80, 65, 45], pinky: [82, 65, 45], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-b': { thumb: [52, 35, 5], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-c': { thumb: [-18, 5, 0], index: [28, 5, 0], middle: [28, 5, 0], ring: [28, 5, 0], pinky: [28, 5, 0], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-d': { thumb: [22, 22, 5], index: [-5, -2, 0], middle: [68, 52, 32], ring: [68, 52, 32], pinky: [68, 52, 32], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-e': { thumb: [38, 22, 5], index: [52, 62, 42], middle: [52, 62, 42], ring: [52, 62, 42], pinky: [55, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-f': { thumb: [12, 32, 22], index: [32, 62, 32], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-g': { thumb: [-12, 5, 0], index: [-8, -3, 0], middle: [78, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: -88, arm: { lift: -5, roll: -88 }, armChain: { ...SIGN_ARM, forearmExtZ: -88 }, duration: 300 },
  'letter-h': { thumb: [18, 8, 3], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: -88, arm: { lift: -5, roll: -88 }, armChain: { ...SIGN_ARM, forearmExtZ: -88 }, duration: 300 },
  'letter-i': { thumb: [48, 32, 5], index: [80, 65, 45], middle: [80, 65, 45], ring: [80, 65, 45], pinky: [-5, -2, 0], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-j': { thumb: [48, 32, 5], index: [80, 65, 45], middle: [80, 65, 45], ring: [80, 65, 45], pinky: [-5, -2, 0], palmRotate: -18, arm: { lift: -5, roll: -18 }, armChain: { ...SIGN_ARM, forearmExtZ: -18 }, duration: 300 },
  'letter-k': { thumb: [12, 22, 5], index: [-5, -2, 0], middle: [-3, 22, 5], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-l': { thumb: [-62, 5, 0], index: [-5, -2, 0], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-m': { thumb: [38, 22, 5], index: [62, 62, 62], middle: [62, 62, 62], ring: [62, 62, 62], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-n': { thumb: [38, 22, 5], index: [62, 62, 62], middle: [62, 62, 62], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-o': { thumb: [-8, 32, 22], index: [28, 42, 22], middle: [28, 42, 22], ring: [28, 42, 22], pinky: [28, 42, 22], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-p': { thumb: [12, 22, 5], index: [-5, -2, 0], middle: [-3, 32, 5], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: -28, arm: { lift: -5, roll: -28 }, armChain: { ...SIGN_ARM, forearmExtZ: -28 }, duration: 300 },
  'letter-q': { thumb: [-12, 5, 0], index: [-3, 32, 5], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: -28, arm: { lift: -5, roll: -28 }, armChain: { ...SIGN_ARM, forearmExtZ: -28 }, duration: 300 },
  'letter-r': { thumb: [48, 5, 0], index: [-3, -2, 0], middle: [8, -5, 0], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-s': { thumb: [32, 12, 5], index: [72, 62, 42], middle: [72, 62, 42], ring: [72, 62, 42], pinky: [72, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-t': { thumb: [22, 32, 22], index: [62, 62, 42], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-u': { thumb: [48, 5, 0], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-v': { thumb: [48, 5, 0], index: [-8, -2, 0], middle: [8, -2, 0], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-w': { thumb: [48, 5, 0], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-x': { thumb: [48, 5, 0], index: [5, 62, 32], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-y': { thumb: [-28, 5, 0], index: [80, 62, 42], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [-5, -2, 0], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'letter-z': { thumb: [48, 5, 0], index: [-5, -2, 0], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },

  // ── ISL Digits 0–9 ──────────────────────────────────────────────────────────
  'digit-0': { thumb: [-8, 32, 22], index: [28, 42, 22], middle: [28, 42, 22], ring: [28, 42, 22], pinky: [28, 42, 22], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'digit-1': { thumb: [48, 32, 5], index: [-5, -2, 0], middle: [80, 62, 42], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'digit-2': { thumb: [48, 32, 5], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [80, 62, 42], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'digit-3': { thumb: [-18, 5, 0], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'digit-4': { thumb: [48, 5, 0], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'digit-5': { thumb: [-22, 5, 0], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'digit-6': { thumb: [-12, 22, 5], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [80, 62, 42], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'digit-7': { thumb: [-12, 22, 5], index: [-5, -2, 0], middle: [-3, -2, 0], ring: [80, 62, 42], pinky: [-3, -2, 0], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'digit-8': { thumb: [-12, 22, 5], index: [-5, -2, 0], middle: [80, 62, 42], ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
  'digit-9': { thumb: [18, 32, 22], index: [32, 52, 32], middle: [-3, -2, 0], ring: [-3, -2, 0], pinky: [-3, -2, 0], palmRotate: 0, arm: { lift: -5, roll: 0 }, armChain: { ...SIGN_ARM }, duration: 300 },
}

// Lookup with fallback to idle
export function getPoseForGesture(gesture) {
  if (!gesture) return AVATAR_POSES.idle
  const key = gesture.toLowerCase().replace(/\s+/g, '')
  return AVATAR_POSES[gesture] || AVATAR_POSES[key] || AVATAR_POSES.idle
}
