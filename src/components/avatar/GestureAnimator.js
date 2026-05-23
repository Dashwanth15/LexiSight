// GestureAnimator.js — Prediction Stability, Debounce, and Cooldown System
//
// DESIGN:
//   Prevents rapid gesture flickering by requiring:
//   1. STABILITY  — N consecutive frames of the same label
//   2. CONFIDENCE — ML confidence must exceed a threshold
//   3. COOLDOWN   — minimum milliseconds between accepted gesture changes
//
//   This decouples the noisy per-frame ML output from the animation system,
//   giving the avatar smooth, human-like gesture transitions instead of jitter.

// ── Defaults ──────────────────────────────────────────────────────────────────
export const DEBOUNCE_DEFAULTS = {
  stabilityFrames : 4,    // consecutive matching frames before accepting
  minConfidence   : 0.58, // minimum ML confidence to consider a prediction
  cooldownMs      : 380,  // minimum ms between successive gesture changes
}

// ── GestureDebouncer class ────────────────────────────────────────────────────
export class GestureDebouncer {
  /**
   * @param {object} opts
   * @param {number} [opts.stabilityFrames=4]
   * @param {number} [opts.minConfidence=0.58]
   * @param {number} [opts.cooldownMs=380]
   */
  constructor(opts = {}) {
    this.stabilityFrames = opts.stabilityFrames ?? DEBOUNCE_DEFAULTS.stabilityFrames
    this.minConfidence   = opts.minConfidence   ?? DEBOUNCE_DEFAULTS.minConfidence
    this.cooldownMs      = opts.cooldownMs      ?? DEBOUNCE_DEFAULTS.cooldownMs

    this._buf        = []   // recent prediction labels
    this._stable     = 'idle'
    this._lastChange = 0
  }

  /**
   * Feed a new prediction frame.
   * Returns the current STABLE gesture key (unchanged until debounce passes).
   *
   * @param {string|null}  label      - predicted gesture label
   * @param {number}       confidence - confidence 0–1
   * @returns {string}                - stable gesture key
   */
  update(label, confidence) {
    // Low-confidence or null prediction → clear buffer, hold stable gesture
    if (!label || (confidence ?? 0) < this.minConfidence) {
      this._buf = []
      return this._stable
    }

    // Accumulate buffer
    this._buf.push(label)
    if (this._buf.length > this.stabilityFrames) this._buf.shift()

    // Not enough frames yet
    if (this._buf.length < this.stabilityFrames) return this._stable

    // All buffered frames must agree
    const candidate = this._buf[0]
    const isStable  = this._buf.every(g => g === candidate)
    if (!isStable) return this._stable

    // Already showing this gesture — no change needed
    if (candidate === this._stable) return this._stable

    // Enforce cooldown
    const now = Date.now()
    if (now - this._lastChange < this.cooldownMs) return this._stable

    // ✅ Accept the new gesture
    this._stable     = candidate
    this._lastChange = now
    this._buf        = []
    return this._stable
  }

  /** Force-reset to idle (e.g. when camera turns off) */
  reset() {
    this._buf        = []
    this._stable     = 'idle'
    this._lastChange = 0
  }

  /** Current stable gesture without updating */
  get current() { return this._stable }
}
