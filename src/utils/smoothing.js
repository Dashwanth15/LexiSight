/**
 * PredictionSmoother — prevents prediction flickering
 * Uses a sliding window vote with confidence weighting
 */
export class PredictionSmoother {
  constructor(windowSize = 10, threshold = 0.75) {
    this.history = []
    this.windowSize = windowSize
    this.threshold = threshold
    this.lastConfirmed = null
    this.lockFrames = 0
    this.framesSinceLast = 0
  }

  add(prediction) {
    if (!prediction) {
      this.framesSinceLast++
      if (this.framesSinceLast > 30) {
        this.lastConfirmed = null
        this.history = []
      }
      return this.lastConfirmed
    }

    this.framesSinceLast = 0

    // Release lock early if we see a different strong gesture
    if (this.lockFrames > 0) {
      if (
        prediction.confidence > 0.9 &&
        this.lastConfirmed &&
        prediction.label !== this.lastConfirmed.label
      ) {
        this.lockFrames = Math.min(this.lockFrames, 5)
      }
      this.lockFrames--
      return this.lastConfirmed
    }

    this.history.push(prediction)
    if (this.history.length > this.windowSize) {
      this.history.shift()
    }

    // Weighted vote across window
    const votes = {}
    for (const p of this.history) {
      if (p.confidence > this.threshold) {
        votes[p.label] = (votes[p.label] || 0) + p.confidence
      }
    }

    if (Object.keys(votes).length === 0) return null

    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1])
    const [winnerLabel, winnerScore] = sorted[0]
    const avgConf = winnerScore / this.windowSize

    if (avgConf > this.threshold) {
      const newConfirmed = { label: winnerLabel, confidence: avgConf }
      if (!this.lastConfirmed || winnerLabel !== this.lastConfirmed.label) {
        this.lastConfirmed = newConfirmed
        this.lockFrames = 20 // ~0.67s at 30fps
        return this.lastConfirmed
      }
    }

    return this.lastConfirmed
  }

  reset() {
    this.history = []
    this.lastConfirmed = null
    this.lockFrames = 0
    this.framesSinceLast = 0
  }

  get isLocked() {
    return this.lockFrames > 0
  }

  get stability() {
    if (this.history.length < 3) return 0
    const labels = this.history.map(p => p.label)
    const mode = labels.sort((a, b) =>
      labels.filter(v => v === a).length - labels.filter(v => v === b).length
    ).pop()
    const consistency = labels.filter(v => v === mode).length / labels.length
    return consistency
  }
}

/**
 * Sentence builder — accumulates confirmed gestures into sentences
 */
export class SentenceBuilder {
  constructor(silenceThreshold = 2000) {
    this.words = []
    this.lastWordTime = null
    this.silenceThreshold = silenceThreshold
    this.onSentenceComplete = null
  }

  addWord(word) {
    const now = Date.now()
    if (this.lastWordTime && (now - this.lastWordTime) > this.silenceThreshold) {
      // Silence gap — complete previous sentence if long enough
      if (this.words.length >= 2 && this.onSentenceComplete) {
        this.onSentenceComplete(this.getSentence())
        this.words = []
      }
    }

    // Don't repeat same word twice in a row
    if (this.words.length > 0 && this.words[this.words.length - 1] !== word) {
      this.words.push(word)
    } else if (this.words.length === 0) {
      this.words.push(word)
    }

    this.lastWordTime = now
    return this.getSentence()
  }

  getSentence() {
    return this.words.join(' ')
  }

  clear() {
    this.words = []
    this.lastWordTime = null
  }

  get wordCount() {
    return this.words.length
  }
}
