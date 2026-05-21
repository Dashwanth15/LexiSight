/**
 * LexiSight Telemetry & Observability
 * ═══════════════════════════════════════════════════════
 * A/B Testing, Feature Toggles, and Pipeline Observability Logger.
 * Allows bypassing fixes individually to isolate what works.
 */

class PipelineTelemetry {
  constructor() {
    this.enabled = typeof window !== 'undefined' && localStorage.getItem('lexi_debug') === 'true'
    this.logs = []
    
    // A/B Toggles — can be switched at runtime
    this.toggles = {
      kalmanFilter: true,
      entropyGating: true,
      onsetDetection: false, // Disabled by default until validation
      poseStability: true,   // For static signs
    }
  }

  enable() {
    this.enabled = true
    if (typeof window !== 'undefined') localStorage.setItem('lexi_debug', 'true')
  }

  disable() {
    this.enabled = false
    if (typeof window !== 'undefined') localStorage.setItem('lexi_debug', 'false')
  }

  toggle(feature, state) {
    if (feature in this.toggles) {
      this.toggles[feature] = state ?? !this.toggles[feature]
      this.log('SYSTEM', `Toggled ${feature} to ${this.toggles[feature]}`)
    }
  }

  log(module, message, data = {}) {
    if (!this.enabled) return

    const entry = {
      timestamp: performance.now(),
      module,
      message,
      data,
    }
    
    this.logs.push(entry)
    
    // Only keep last 1000 logs to prevent memory leaks
    if (this.logs.length > 1000) this.logs.shift()
    
    // Format nicely for console
    const color = this._getColor(module)
    console.log(`%c[${module}]%c ${message}`, `color: ${color}; font-weight: bold`, 'color: inherit', data)
  }

  _getColor(module) {
    switch(module) {
      case 'KALMAN': return '#4ade80' // Green
      case 'ENTROPY': return '#f43f5e' // Rose
      case 'ONSET': return '#3b82f6' // Blue
      case 'STATIC': return '#a855f7' // Purple
      case 'SYSTEM': return '#f59e0b' // Amber
      default: return '#9ca3af'
    }
  }

  clear() {
    this.logs = []
  }
}

export const telemetry = new PipelineTelemetry()

// Expose to window for easy console debugging
if (typeof window !== 'undefined') {
  window.lexiTelemetry = telemetry
}
