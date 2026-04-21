// MediaPipe hand skeleton connections (landmark index pairs)
export const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm
  [5, 9], [9, 13], [13, 17],
]

// Landmark types for coloring
export const LANDMARK_TYPES = {
  WRIST: [0],
  THUMB: [1, 2, 3, 4],
  INDEX_TIP: [8],
  MIDDLE_TIP: [12],
  RING_TIP: [16],
  PINKY_TIP: [20],
  KNUCKLES: [5, 6, 7, 9, 10, 11, 13, 14, 15, 17, 18, 19],
  FINGERTIPS: [4, 8, 12, 16, 20],
}

/**
 * Normalize 21 landmarks relative to wrist (landmark 0)
 * Returns flat array of 63 numbers [x0,y0,z0, x1,y1,z1, ...]
 */
export function normalizeLandmarks(landmarks) {
  const wrist = landmarks[0]
  const norm = []

  // Find max distance for scale normalization
  let maxDist = 0
  for (const lm of landmarks) {
    const dx = lm.x - wrist.x
    const dy = lm.y - wrist.y
    const dz = (lm.z || 0) - (wrist.z || 0)
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (dist > maxDist) maxDist = dist
  }

  const scale = maxDist > 0 ? maxDist : 1

  for (const lm of landmarks) {
    norm.push(
      (lm.x - wrist.x) / scale,
      (lm.y - wrist.y) / scale,
      ((lm.z || 0) - (wrist.z || 0)) / scale
    )
  }

  return norm
}

/**
 * Convert normalized landmark to canvas pixel coordinates
 */
export function landmarkToCanvas(lm, width, height) {
  return {
    x: lm.x * width,
    y: lm.y * height,
  }
}

/**
 * Calculate bounding box of hand for quality scoring
 */
export function handBoundingBox(landmarks) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x
    if (lm.y < minY) minY = lm.y
    if (lm.x > maxX) maxX = lm.x
    if (lm.y > maxY) maxY = lm.y
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/**
 * Score hand quality: centered (0-1), size (0-1)
 */
export function scoreHandQuality(landmarks) {
  const bbox = handBoundingBox(landmarks)
  const cx = (bbox.minX + bbox.maxX) / 2
  const cy = (bbox.minY + bbox.maxY) / 2

  // Center score: how close to frame center
  const centerScore = 1 - Math.sqrt(
    Math.pow(cx - 0.5, 2) + Math.pow(cy - 0.5, 2)
  ) * 2

  // Size score: hand should fill ~20-60% of frame
  const sizeRatio = bbox.width * bbox.height
  const sizeScore = sizeRatio > 0.04 && sizeRatio < 0.5 ? 1 : 0.5

  // Visibility: wrist should not be at edge
  const visScore = (bbox.minX > 0.02 && bbox.maxX < 0.98 &&
                    bbox.minY > 0.02 && bbox.maxY < 0.98) ? 1 : 0.5

  return {
    center: Math.max(0, Math.min(1, centerScore)),
    size: sizeScore,
    visibility: visScore,
    overall: (centerScore + sizeScore + visScore) / 3,
  }
}
