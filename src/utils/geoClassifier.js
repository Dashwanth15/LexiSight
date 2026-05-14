/**
 * LexiSight Geometric ISL Gesture Classifier
 * ════════════════════════════════════════════
 * Works directly from MediaPipe Hands raw landmarks (21 points).
 * No trained model required — uses finger extension geometry.
 *
 * Landmark indices (MediaPipe Hands):
 *   0  = Wrist
 *   1-4  = Thumb  (CMC, MCP, IP, TIP)
 *   5-8  = Index  (MCP, PIP, DIP, TIP)
 *   9-12 = Middle (MCP, PIP, DIP, TIP)
 *  13-16 = Ring   (MCP, PIP, DIP, TIP)
 *  17-20 = Pinky  (MCP, PIP, DIP, TIP)
 *
 * Coordinates: x,y in [0,1] normalized; y=0 at top, increases downward.
 */

// ── Utility helpers ──────────────────────────────────────────────────────────

function dist2D(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

/** A finger is considered "extended" when its tip is clearly above its PIP joint */
function isExtended(lm, tipIdx, pipIdx, thresh = 0.025) {
  return lm[tipIdx].y < lm[pipIdx].y - thresh
}

/** Strict extension — larger gap required (reduces false positives) */
function isExtendedStrict(lm, tipIdx, pipIdx) {
  return lm[tipIdx].y < lm[pipIdx].y - 0.05
}

/** Finger is definitively curled — tip below or level with PIP */
function isCurled(lm, tipIdx, pipIdx) {
  return lm[tipIdx].y > lm[pipIdx].y - 0.01
}

/** Thumb extension: tip is far from index MCP (works for both hands) */
function thumbExtended(lm) {
  return dist2D(lm[4], lm[5]) > 0.07
}

/** Thumb pointing upward (tip above IP joint) */
function thumbPointingUp(lm) {
  return lm[4].y < lm[3].y - 0.02
}

/** Distance between two fingertips */
function tipDist(lm, a, b) {
  return dist2D(lm[a], lm[b])
}

/** Index and middle form a wide V (spread > 4cm equivalent) */
function isVShape(lm) {
  return tipDist(lm, 8, 12) > 0.04
}

/** All 4 fingertips spread wide (open hand) — HELLO needs a VERY wide spread */
function isSpread(lm) {
  return tipDist(lm, 8, 20) > 0.28  // FIX: raised from 0.22 to 0.28 to reduce HELLO false positives
}

/** Index tip nearly touches thumb tip (O round shape) */
function isOTouch(lm) {
  return tipDist(lm, 4, 8) < 0.06
}

/** All fingers tightly curled (fist) */
function isFist(lm) {
  const t = !thumbExtended(lm)
  const i = !isExtended(lm, 8, 6)
  const m = !isExtended(lm, 12, 10)
  const r = !isExtended(lm, 16, 14)
  const p = !isExtended(lm, 20, 18)
  return t && i && m && r && p
}

/** Build a result object matching the ML classifier output shape */
function make(label, confidence, alternates = []) {
  const topK = [{ label, confidence }]
  alternates.forEach((alt, i) => {
    topK.push({ label: alt, confidence: Math.max(0.01, confidence - 0.15 - i * 0.06) })
  })
  return { label, confidence, topK: topK.slice(0, 4), source: 'geo' }
}

// ════════════════════════════════════════════════════════════════════════════
// ISL DIGIT CLASSIFIER — Pure geometry, bypasses ML entirely.
//
// Digits 0–9 have unambiguous finger configurations in ISL.
// The ML model confuses them because they share spatial structure.
// Geometry is the ground truth here — no training data can beat it.
//
// Called BEFORE the ML model in useClassifier.js so the ML never
// gets a chance to incorrectly classify a digit.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Classify ISL digits 0–9 from raw MediaPipe landmarks.
 * Returns a result object or null if the hand pose is not a clear digit.
 *
 * @param {Array<{x,y,z}>} lm — 21 MediaPipe landmarks
 */
export function classifyISLDigit(lm) {
  if (!lm || lm.length < 21) return null

  // Finger states — using two thresholds:
  // ext = "probably extended" (loose), extS = "definitely extended" (strict)
  const I_ext  = isExtended(lm, 8, 6)
  const M_ext  = isExtended(lm, 12, 10)
  const R_ext  = isExtended(lm, 16, 14)
  const P_ext  = isExtended(lm, 20, 18)
  const T_ext  = thumbExtended(lm)

  const I_curl = isCurled(lm, 8, 6)
  const M_curl = isCurled(lm, 12, 10)
  const R_curl = isCurled(lm, 16, 14)
  const P_curl = isCurled(lm, 20, 18)

  const extCount = [I_ext, M_ext, R_ext, P_ext].filter(Boolean).length

  // ── 5: All four fingers + thumb clearly up (open hand) ──────────────────
  if (T_ext && I_ext && M_ext && R_ext && P_ext) {
    return make('5', 0.95, ['HELLO', 'STOP'])
  }

  // ── 4: All four fingers up, thumb NOT extended ───────────────────────────
  if (!T_ext && I_ext && M_ext && R_ext && P_ext) {
    return make('4', 0.94, ['B'])
  }

  // ── 3: Index + Middle + Ring UP, pinky down ─────────────────────────────
  // This is the KEY rule that fixes the 2 vs 3 confusion.
  if (I_ext && M_ext && R_ext && P_curl) {
    return make('3', 0.95, ['W'])
  }

  // ── 2: Index + Middle UP, ring definitively CURLED ──────────────────────
  // Ring must be CLEARLY curled — not just "not extended"
  if (I_ext && M_ext && R_curl && P_curl) {
    return make('2', 0.95, ['V', 'PEACE'])
  }

  // ── 1: Only index UP, all others curled ─────────────────────────────────
  if (I_ext && M_curl && R_curl && P_curl) {
    return make('1', 0.95, ['D', 'POINT'])
  }

  // ── 0: O-shape — index tip touches thumb tip, all fingers bent ──────────
  if (isOTouch(lm) && !I_ext && !M_ext && !R_ext && !P_ext) {
    return make('0', 0.92, ['O'])
  }

  // ── 6: Pinky tip touches thumb, index + middle + ring up ────────────────
  if (tipDist(lm, 20, 4) < 0.09 && I_ext && M_ext && R_ext) {
    return make('6', 0.91, ['W'])
  }

  // ── 7: Middle tip touches thumb, index + ring + pinky free/up ──────────
  if (tipDist(lm, 12, 4) < 0.09 && I_ext && !M_ext) {
    return make('7', 0.89, ['8'])
  }

  // ── 8: Index tip bends toward thumb (index DIP close to thumb) ──────────
  if (tipDist(lm, 8, 4) < 0.09 && !I_ext && M_ext) {
    return make('8', 0.87, ['9', '7'])
  }

  // ── 9: Index tip touches thumb (like OK), other fingers curled ──────────
  if (tipDist(lm, 8, 4) < 0.07 && !M_ext && !R_ext && !P_ext) {
    return make('9', 0.88, ['0', 'OK'])
  }

  // No clear digit pattern detected
  return null
}

// ── Main classifier ──────────────────────────────────────────────────────────

/**
 * Classify a hand gesture from raw MediaPipe Hands landmarks.
 * @param {Array<{x:number, y:number, z:number}>} lm - 21 landmarks
 * @returns {{ label: string, confidence: number, topK: Array }} | null
 */
export function classifyGesture(lm) {
  if (!lm || lm.length < 21) return null

  // ── Finger state booleans ─────────────────────────────────────
  const T = thumbExtended(lm)       // Thumb
  const I = isExtended(lm, 8, 6)    // Index
  const M = isExtended(lm, 12, 10)  // Middle
  const R = isExtended(lm, 16, 14)  // Ring
  const P = isExtended(lm, 20, 18)  // Pinky

  // ── Extra features ────────────────────────────────────────────
  const spread  = isSpread(lm)
  const vShape  = isVShape(lm)
  const oTouch  = isOTouch(lm)
  const thumbUp = thumbPointingUp(lm)
  const fist    = isFist(lm)

  const extCount = [T, I, M, R, P].filter(Boolean).length

  // ══ Gesture Rules (priority order) ═══════════════════════════

  // ── FIX: 4 fingers up, thumb across — check BEFORE open-hand/HELLO ──
  // A 4-finger pose is often misclassified as HELLO because spread is wide.
  // Check 4-finger FIRST so it takes priority.
  if (!T && I && M && R && P) return make('4', 0.88, ['B', 'FOUR', 'NO'])

  // ── Open hand (all 5) ───────────────────────────────────────
  if (T && I && M && R && P) {
    if (spread) return make('HELLO',  0.93, ['5', 'OPEN', 'STOP'])
    return           make('STOP',    0.85, ['HELLO', '5', 'OPEN'])
  }

  // ── Thumb + pinky → I Love You / Y ───────────────────────
  if (T && !I && !M && !R && P)  return make('ILY',  0.90, ['Y', 'ROCK', 'LOVE'])

  // ── Thumb + index + middle + ring → 4 ────────────────────
  if (T && I && M && R && !P)    return make('4',    0.78, ['THREE', 'W'])

  // ── Index + middle + ring up → W / 3 / WATER ─────────────
  if (!T && I && M && R && !P)   return make('W',    0.80, ['3', 'THREE', 'WATER'])

  // ── Thumb + index only → L ────────────────────────────────
  if (T && I && !M && !R && !P)  return make('L',    0.88, ['GUN', 'POINT', '1'])

  // ── Index + middle → V or 2 ──────────────────────────────
  if (!T && I && M && !R && !P) {
    if (vShape) return make('V',    0.88, ['PEACE', 'VICTORY', '2'])
    return           make('2',     0.80, ['V', 'PEACE', 'TWO'])
  }

  // ── Index + middle touching thumb → pinch / OK gesture ─────
  // Previously labeled as NO, but ISL NO is a dynamic wag (handled by MotionAnalyzer).
  // This static pinch shape is closer to O or a tap gesture.
  if (!R && !P && dist2D(lm[8], lm[4]) < 0.12 && dist2D(lm[12], lm[4]) < 0.12) {
      return make('O', 0.78, ['OK', 'TAP', 'PINCH'])
  }

  // ── Index only → 1 / D ───────────────────────────────────
  if (!T && I && !M && !R && !P) return make('1',    0.85, ['D', 'POINT', 'INDEX'])

  // ── Pinky only → I ───────────────────────────────────────
  if (!T && !I && !M && !R && P)  return make('I',   0.82, ['PINKY', 'BABY'])

  // ── Middle only ───────────────────────────────────────────
  if (!T && !I && M && !R && !P)  return make('D',   0.68, ['MIDDLE'])

  // ── Thumb + pinky + index → 3 ────────────────────────────
  if (T && I && !M && !R && P)    return make('3',   0.75, ['THREE', 'FAMILY'])

  // ── Thumb only ───────────────────────────────────────────
  if (T && !I && !M && !R && !P) {
    if (thumbUp) return make('GOOD', 0.90, ['YES', 'A', 'THUMBSUP'])
    return             make('A',    0.75, ['S', 'GOOD', 'FIST'])
  }

  // ── O shape (index meets thumb) ──────────────────────────
  if (oTouch && !M && !R && !P)   return make('O',   0.85, ['ZERO', 'C', 'OK'])

  // ── Full fist → A / S / YES ──────────────────────────────
  if (fist)                        return make('A',   0.72, ['S', 'YES', 'FIST'])

  // ── Thumb + index + middle → 3 ────────────────────────────
  if (T && I && M && !R && !P)    return make('3',   0.76, ['THREE', 'W', 'WATER'])

  // ── Ring + pinky (no others) ─────────────────────────────
  if (!T && !I && !M && R && P)   return make('U',   0.68, ['R', 'TOGETHER'])

  // ── Index + pinky (horns) ────────────────────────────────
  if (!T && I && !M && !R && P)   return make('ROCK', 0.78, ['HORNS', 'U'])

  return null
}

// ── Two-Hand Gesture Classifier ──────────────────────────────────────────────

/**
 * Classify two-hand ISL signs from two MediaPipe hand landmark sets.
 * Called BEFORE the single-hand ML model — takes priority when both hands visible.
 *
 * @param {Array} lm1  - Primary hand landmarks (21 points {x,y,z})
 * @param {Array} lm2  - Secondary hand landmarks (21 points, may be null)
 * @returns {{ label, confidence, topK }} | null
 */
export function classifyTwoHandGesture(lm1, lm2) {
  if (!lm1 || lm1.length < 21 || !lm2 || lm2.length < 21) return null

  const wristDist = dist2D(lm1[0], lm2[0])
  const handsClose = wristDist < 0.35
  const handsVeryClose = wristDist < 0.18

  const I1 = isExtended(lm1, 8, 6)
  const I2 = isExtended(lm2, 8, 6)
  const fist1 = isFist(lm1)
  const fist2 = isFist(lm2)
  const oTouch1 = isOTouch(lm1)
  const oTouch2 = isOTouch(lm2)
  const flat1 = isExtended(lm1, 8, 6) && isExtended(lm1, 12, 10) && isExtended(lm1, 16, 14)
  const flat2 = isExtended(lm2, 8, 6) && isExtended(lm2, 12, 10) && isExtended(lm2, 16, 14)

  // ── FRIEND: both index fingers hooked ────────────────────────────────────
  if (I1 && I2 && handsClose && !isExtended(lm1, 12, 10) && !isExtended(lm2, 12, 10)) {
    const tipDist = dist2D(lm1[8], lm2[8])
    if (tipDist < 0.12) {
      // Differentiate X from FRIEND based on wrist layout
      // Usually X is crossed index fingers, resembling a cross.
      return make('X', 0.85, ['FRIEND', 'CROSS'])
    }
  }

  // ── TOGETHER: both fists close ────────────────────────────────────────────
  if (fist1 && fist2 && handsVeryClose) return make('TOGETHER', 0.80, ['WITH', 'FRIEND'])

  // ── FAMILY: both O-hands spread outward ──────────────────────────────────
  if (oTouch1 && oTouch2 && handsClose) return make('FAMILY', 0.82, ['GROUP', 'TOGETHER'])

  // ── MORE: both flat-O tips touching ──────────────────────────────────────
  if (oTouch1 && oTouch2 && handsVeryClose) return make('MORE', 0.79, ['AGAIN', 'EXTRA'])

  // ── MEET: both index fingers pointing together ────────────────────────────
  if (I1 && I2 && handsClose && dist2D(lm1[8], lm2[8]) < 0.08)
    return make('MEET', 0.76, ['HI', 'GREET'])

  // ── SCHOOL: both flat hands clapping ─────────────────────────────────────
  if (flat1 && flat2 && handsVeryClose) return make('SCHOOL', 0.75, ['CLASS', 'LEARN'])

  // ── LOVE: crossed fists on chest ─────────────────────────────────────────
  if (fist1 && fist2 && wristDist < 0.25) return make('LOVE', 0.74, ['HUG', 'CARE'])

  return null
}

