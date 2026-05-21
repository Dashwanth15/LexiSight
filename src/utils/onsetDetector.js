/**
 * LexiSight Onset Detector — Dynamic Sign Boundary Detection
 * ═══════════════════════════════════════════════════════════════
 * Replaces the fixed 30-frame ring buffer with intelligent sign
 * boundary detection using Exponential Moving Average (EMA) of
 * wrist/hand velocity.
 *
 * Instead of inferring on arbitrary 30-frame slices (chimera signs),
 * this detector:
 *   1. Waits for motion energy to cross a dynamic threshold → sign starts
 *   2. Records all frames during the sign
 *   3. Detects when motion drops → sign ended
 *   4. Resamples the complete sign to exactly SEQ_LEN frames
 *   5. Returns the clean, complete sign for inference
 *
 * The EMA threshold adapts automatically to different signers.
 * Performance: O(1) per frame.
 */

const SEQ_LEN = 30
const EMA_ALPHA = 0.15
const THRESHOLD_K = 2.0
const MIN_SIGN_FRAMES = 8
const MAX_SIGN_FRAMES = 90
const END_PATIENCE = 4
const WARMUP_FRAMES = 10

const OnsetState = { IDLE: 0, SIGNING: 1, ENDING: 2 }

export class OnsetDetector {
  constructor() {
    this.state = OnsetState.IDLE
    this.emaEnergy = 0
    this.emaVariance = 0.0001
    this.signFrames = []
    this.lastWrist = null
    this.endCounter = 0
    this.totalFrames = 0
    this.lastEnergy = 0
  }

  /**
   * Process one frame. Returns a complete sign buffer (resampled to SEQ_LEN)
   * when a sign boundary is detected, or null if still collecting/waiting.
   *
   * @param {Float32Array|Array} featureFrame - 126-dim feature vector
   * @param {Array<{x,y,z}>} rawLandmarks - Raw MediaPipe landmarks
   * @returns {Array<Array<number>>|null}
   */
  process(featureFrame, rawLandmarks) {
    this.totalFrames++
    const energy = this._computeEnergy(rawLandmarks)
    this.lastEnergy = energy

    // Update EMA baseline and variance
    this.emaEnergy = EMA_ALPHA * energy + (1 - EMA_ALPHA) * this.emaEnergy
    const diff = energy - this.emaEnergy
    this.emaVariance = EMA_ALPHA * (diff * diff) + (1 - EMA_ALPHA) * this.emaVariance

    const sigma = Math.sqrt(Math.max(this.emaVariance, 1e-8))
    const threshold = this.emaEnergy + THRESHOLD_K * sigma

    if (this.totalFrames < WARMUP_FRAMES) return null

    switch (this.state) {
      case OnsetState.IDLE:
        if (energy > threshold) {
          this.state = OnsetState.SIGNING
          this.signFrames = [Array.from(featureFrame)]
          this.endCounter = 0
        }
        return null

      case OnsetState.SIGNING:
        this.signFrames.push(Array.from(featureFrame))

        if (energy < threshold) {
          this.endCounter++
          if (this.endCounter >= END_PATIENCE) {
            return this._finalize()
          }
        } else {
          this.endCounter = 0
        }

        if (this.signFrames.length >= MAX_SIGN_FRAMES) {
          return this._finalize()
        }
        return null

      case OnsetState.ENDING:
        this.state = OnsetState.IDLE
        this.signFrames = []
        this.endCounter = 0
        return null

      default:
        return null
    }
  }

  _computeEnergy(rawLandmarks) {
    if (!rawLandmarks || rawLandmarks.length < 21) {
      this.lastWrist = null
      return 0
    }
    const wrist = rawLandmarks[0]
    if (!this.lastWrist) {
      this.lastWrist = { x: wrist.x, y: wrist.y }
      return 0
    }
    const dx = wrist.x - this.lastWrist.x
    const dy = wrist.y - this.lastWrist.y
    this.lastWrist = { x: wrist.x, y: wrist.y }
    return Math.sqrt(dx * dx + dy * dy)
  }

  _finalize() {
    const frames = this.signFrames
    this.state = OnsetState.ENDING
    this.signFrames = []
    this.endCounter = 0

    if (frames.length < MIN_SIGN_FRAMES) return null
    return this._resample(frames, SEQ_LEN)
  }

  /**
   * Resample variable-length sequence to exactly targetLen frames
   * using linear interpolation. Handles fast/slow signers.
   */
  _resample(frames, targetLen) {
    const n = frames.length
    if (n === targetLen) return frames

    const result = []
    for (let i = 0; i < targetLen; i++) {
      const t = (i / (targetLen - 1)) * (n - 1)
      const lo = Math.floor(t)
      const hi = Math.min(lo + 1, n - 1)
      const frac = t - lo
      const interpolated = frames[lo].map((val, idx) =>
        val * (1 - frac) + frames[hi][idx] * frac
      )
      result.push(interpolated)
    }
    return result
  }

  get isSigning() { return this.state === OnsetState.SIGNING }
  get energy() { return this.lastEnergy }
  get currentThreshold() {
    const sigma = Math.sqrt(Math.max(this.emaVariance, 1e-8))
    return this.emaEnergy + THRESHOLD_K * sigma
  }

  reset() {
    this.state = OnsetState.IDLE
    this.emaEnergy = 0
    this.emaVariance = 0.0001
    this.signFrames = []
    this.lastWrist = null
    this.endCounter = 0
    this.totalFrames = 0
    this.lastEnergy = 0
  }
}
