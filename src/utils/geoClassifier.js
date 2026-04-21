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

/** All 4 fingertips spread wide (open hand) */
function isSpread(lm) {
  return tipDist(lm, 8, 20) > 0.22
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
  return { label, confidence, topK: topK.slice(0, 4) }
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

  // ── Open hand (all 5) ───────────────────────────────────────
  if (T && I && M && R && P) {
    if (spread) return make('HELLO',  0.93, ['5', 'OPEN', 'STOP'])
    return           make('STOP',    0.85, ['HELLO', '5', 'OPEN'])
  }

  // ── 4 fingers up, thumb across ────────────────────────────
  if (!T && I && M && R && P) return make('4', 0.82, ['B', 'FOUR', 'NO'])

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
