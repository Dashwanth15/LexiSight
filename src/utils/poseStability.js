/**
 * LexiSight Pose Stability Detector — Static Sign Trigger
 * ═══════════════════════════════════════════════════════
 * Detects when the signer's hand has stopped moving and is
 * holding a pose (e.g. for static letters A-Z).
 * 
 * Works by measuring the variance of wrist position over a short
 * window. If the variance drops below a threshold and holds for
 * N frames, it triggers a static sign detection.
 */

const WINDOW_SIZE = 12
const STABILITY_THRESHOLD = 0.002 // Maximum allowed wrist movement to be considered "stable"
const REQUIRED_STABLE_FRAMES = 5

export class PoseStabilityDetector {
  constructor() {
    this.wristHistory = []
    this.stableFramesCount = 0
    this.isStable = false
  }

  /**
   * Process a frame and return whether the hand is holding a stable pose.
   * @param {Array<{x,y,z}>} landmarks - MediaPipe landmarks
   * @returns {boolean} True if a stable pose is detected
   */
  process(landmarks) {
    if (!landmarks || landmarks.length < 21) {
      this.reset()
      return false
    }

    const wrist = landmarks[0]
    this.wristHistory.push({ x: wrist.x, y: wrist.y })

    if (this.wristHistory.length > WINDOW_SIZE) {
      this.wristHistory.shift()
    }

    if (this.wristHistory.length < WINDOW_SIZE) {
      return false
    }

    // Calculate variance of wrist position
    let sumX = 0, sumY = 0
    for (const p of this.wristHistory) {
      sumX += p.x
      sumY += p.y
    }
    const meanX = sumX / WINDOW_SIZE
    const meanY = sumY / WINDOW_SIZE

    let varX = 0, varY = 0
    for (const p of this.wristHistory) {
      varX += (p.x - meanX) ** 2
      varY += (p.y - meanY) ** 2
    }
    varX /= WINDOW_SIZE
    varY /= WINDOW_SIZE

    // Total spatial variance
    const variance = Math.sqrt(varX + varY)

    if (variance < STABILITY_THRESHOLD) {
      this.stableFramesCount++
    } else {
      this.stableFramesCount = 0
      this.isStable = false
    }

    if (this.stableFramesCount >= REQUIRED_STABLE_FRAMES) {
      this.isStable = true
      return true
    }

    return false
  }

  reset() {
    this.wristHistory = []
    this.stableFramesCount = 0
    this.isStable = false
  }
}
