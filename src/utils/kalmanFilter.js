/**
 * LexiSight Kalman Filter — Missing Landmark Predictor
 * ═══════════════════════════════════════════════════════
 * Predicts hand landmark positions when MediaPipe drops frames
 * due to occlusion, fast movement, or poor lighting.
 *
 * Instead of zero-filling (which creates phantom geometry at the
 * center of the frame), the Kalman filter predicts where each
 * landmark should be based on its prior trajectory.
 *
 * State model per landmark: [x, y, z, vx, vy, vz]
 * Performance: O(21 × 6) = 126 operations per frame — sub-microsecond.
 */

const NUM_LANDMARKS = 21
const MAX_PREDICT_FRAMES = 5  // Stop predicting after this many missed frames

export class LandmarkKalmanFilter {
  constructor() {
    this.states = null          // Per-landmark state {x, y, z, vx, vy, vz, p}
    this.framesSinceUpdate = 0
    this.initialized = false
    this.processNoise = 0.001
    this.measurementNoise = 0.005
  }

  /**
   * Update filter with new observed landmarks from MediaPipe.
   * @param {Array<{x,y,z}>} landmarks - 21 observed landmarks
   */
  update(landmarks) {
    if (!landmarks || landmarks.length < NUM_LANDMARKS) return

    if (!this.initialized) {
      this.states = landmarks.map(lm => ({
        x: lm.x, y: lm.y, z: lm.z || 0,
        vx: 0, vy: 0, vz: 0,
        p: 0.01
      }))
      this.initialized = true
      this.framesSinceUpdate = 0
      return
    }

    for (let i = 0; i < NUM_LANDMARKS; i++) {
      const s = this.states[i]
      const obs = landmarks[i]
      const k = s.p / (s.p + this.measurementNoise)

      // Update velocity (EMA blend)
      s.vx = 0.7 * (obs.x - s.x) + 0.3 * s.vx
      s.vy = 0.7 * (obs.y - s.y) + 0.3 * s.vy
      s.vz = 0.7 * ((obs.z || 0) - s.z) + 0.3 * s.vz

      // Kalman update position
      s.x += k * (obs.x - s.x)
      s.y += k * (obs.y - s.y)
      s.z += k * ((obs.z || 0) - s.z)

      s.p = (1 - k) * s.p + this.processNoise
    }

    this.framesSinceUpdate = 0
  }

  /**
   * Predict landmark positions when MediaPipe drops a frame.
   * @returns {Array<{x,y,z}>|null} Predicted landmarks or null if unreliable
   */
  predict() {
    if (!this.initialized) return null
    this.framesSinceUpdate++
    if (this.framesSinceUpdate > MAX_PREDICT_FRAMES) return null

    const decay = Math.pow(0.85, this.framesSinceUpdate)
    const predicted = this.states.map(s => ({
      x: s.x + s.vx * decay,
      y: s.y + s.vy * decay,
      z: s.z + s.vz * decay,
    }))

    for (const s of this.states) {
      s.p += this.processNoise * this.framesSinceUpdate
    }

    return predicted
  }

  get isReliable() {
    return this.initialized && this.framesSinceUpdate <= MAX_PREDICT_FRAMES
  }

  get missedFrames() {
    return this.framesSinceUpdate
  }

  reset() {
    this.states = null
    this.framesSinceUpdate = 0
    this.initialized = false
  }
}
