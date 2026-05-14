// ── Translation Service with Grammar Correction and Auto-Punctuation ──────────────────────

class TranslationService {
  constructor(settings) {
    this.settings = settings
    this.currentSentence = []
    this.lastPrediction = null
    this.lastPredictionTime = 0
    this.history = []
    this.duplicateFilter = new Set()
  }

  // Grammar correction patterns
  grammarPatterns = [
    // Subject-verb agreement corrections
    { pattern: /\bI\s+(\w+)(?:ed|s)\b/gi, replacement: 'I $1', description: 'I verb correction' },
    { pattern: /\b(\w+)s?\s+I\s+(\w+)s?\b/gi, replacement: '$1 I $2', description: 'Subject-verb order' },
    
    // Common ISL to English corrections
    { pattern: /\bI\s+(FOOD|WATER|BOOK|PEN)\s+(EAT|DRINK|READ|WRITE)\b/gi, replacement: 'I $2 $1', description: 'Object-verb order' },
    { pattern: /\b(I|YOU|HE|SHE|WE|THEY)\s+(WANT|NEED|LIKE|LOVE)\s+(FOOD|WATER|HELP)\b/gi, replacement: '$1 $2 $3', description: 'Standard word order' },
    
    // Tense corrections
    { pattern: /\b(I|YOU|WE|THEY)\s+(\w+)ing\b/gi, replacement: '$1 are $2ing', description: 'Present continuous' },
    { pattern: /\b(HE|SHE|IT)\s+(\w+)ing\b/gi, replacement: '$1 is $2ing', description: 'Present continuous 3rd person' },
    
    // Article corrections
    { pattern: /\b(I|YOU|HE|SHE|WE|THEY)\s+(WANT|NEED|HAVE|GOT)\s+(A|AN)\s+(\w+)\b/gi, replacement: '$1 $2 $3 $4', description: 'Article placement' },
    
    // Question formation
    { pattern: /\b(WHAT|WHERE|WHEN|WHY|HOW)\s+(YOU|I|WE|THEY)\s+(\w+)\b/gi, replacement: '$1 do $2 $3', description: 'Question formation' },
  ]

  // Apply grammar correction based on settings
  applyGrammarCorrection(text) {
    if (!this.settings.grammarCorrection) return text

    let corrected = text
    
    this.grammarPatterns.forEach(({ pattern, replacement }) => {
      corrected = corrected.replace(pattern, replacement)
    })

    return corrected
  }

  // Apply auto-punctuation based on settings
  applyAutoPunctuation(text) {
    if (!this.settings.autoPunctuation) return text

    let punctuated = text

    // Add period at the end if missing
    if (!punctuated.match(/[.!?]$/)) {
      punctuated += '.'
    }

    // Add commas after introductory words
    punctuated = punctuated.replace(/\b(Hello|Hi|Hey|Well|So|Now|Then|Actually|Basically)\s+/gi, '$1, ')

    // Add commas in lists
    punctuated = punctuated.replace(/(\w+)\s+(\w+)\s+(and|or)\s+/gi, '$1, $2 $3 ')

    // Capitalize first letter
    punctuated = punctuated.charAt(0).toUpperCase() + punctuated.slice(1)

    return punctuated
  }

  // Filter duplicates based on settings
  filterDuplicates(word) {
    if (!this.settings.duplicateFilter) return true

    const now = Date.now()
    const cooldown = this.settings.predictionCooldown * 1000

    // Check if same word was predicted recently
    if (this.lastPrediction === word && (now - this.lastPredictionTime) < cooldown) {
      return false
    }

    // Check if word is in duplicate filter set
    if (this.duplicateFilter.has(word)) {
      return false
    }

    return true
  }

  // Build sentence based on settings
  buildSentence(word) {
    if (!this.settings.sentenceBuilder) {
      return this.applyGrammarCorrection(this.applyAutoPunctuation(word))
    }

    // Add word to current sentence
    this.currentSentence.push(word)

    // Check if sentence should end (based on common sentence patterns)
    const shouldEndSentence = this.shouldEndSentence(word)
    
    if (shouldEndSentence || this.currentSentence.length >= 10) {
      const sentence = this.currentSentence.join(' ')
      this.currentSentence = []
      
      return this.applyGrammarCorrection(this.applyAutoPunctuation(sentence))
    }

    return null // Sentence not complete yet
  }

  // Determine if sentence should end
  shouldEndSentence(word) {
    const sentenceEnders = ['thankyou', 'please', 'sorry', 'goodbye', 'hello', 'help', 'water', 'food', 'bathroom', 'doctor']
    return sentenceEnders.includes(word.toLowerCase())
  }

  // Process translation with all settings applied
  processTranslation(prediction, confidence) {
    const { confidenceThreshold, continuousMode, translationHistory } = this.settings

    // Check confidence threshold
    if (confidence < confidenceThreshold) {
      return null
    }

    const word = prediction.toLowerCase().trim()

    // Filter duplicates
    if (!this.filterDuplicates(word)) {
      return null
    }

    // Update last prediction
    this.lastPrediction = word
    this.lastPredictionTime = Date.now()

    // Add to duplicate filter temporarily
    this.duplicateFilter.add(word)
    setTimeout(() => this.duplicateFilter.delete(word), this.settings.predictionCooldown * 1000)

    // Build sentence or return single word
    const result = this.buildSentence(word)

    // Add to history if enabled
    if (translationHistory && result) {
      this.addToHistory(result, confidence, prediction)
    }

    return {
      text: result || word,
      isCompleteSentence: !!result,
      confidence,
      original: prediction,
      timestamp: new Date().toISOString()
    }
  }

  // Add to translation history
  addToHistory(text, confidence, original) {
    const entry = {
      text,
      confidence,
      original,
      timestamp: new Date().toISOString(),
      id: Date.now()
    }

    this.history.unshift(entry)

    // Limit history size
    const maxLength = this.settings.historyLength === 500 ? Infinity : this.settings.historyLength
    this.history = this.history.slice(0, maxLength)

    // Save to localStorage
    try {
      localStorage.setItem('lxi_translation_history', JSON.stringify(this.history))
    } catch (e) {
      console.warn('Failed to save translation history:', e)
    }
  }

  // Get translation history
  getHistory() {
    return this.history
  }

  // Clear history
  clearHistory() {
    this.history = []
    try {
      localStorage.removeItem('lxi_translation_history')
    } catch (e) {
      console.warn('Failed to clear translation history:', e)
    }
  }

  // Load history from localStorage
  loadHistory() {
    try {
      const stored = localStorage.getItem('lxi_translation_history')
      if (stored) {
        this.history = JSON.parse(stored)
      }
    } catch (e) {
      console.warn('Failed to load translation history:', e)
    }
  }

  // Auto-clear sentence if idle
  startAutoClearTimer() {
    if (!this.settings.sentenceAutoClear) return

    this.clearTimer = setTimeout(() => {
      if (this.currentSentence.length > 0) {
        const incomplete = this.currentSentence.join(' ')
        this.currentSentence = []
        return this.applyGrammarCorrection(this.applyAutoPunctuation(incomplete))
      }
    }, this.settings.sentenceClearTimer * 1000)
  }

  // Reset auto-clear timer
  resetAutoClearTimer() {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer)
    }
    this.startAutoClearTimer()
  }

  // Emergency phrases processing
  processEmergencyPhrase(phrase) {
    const emergencyPhrases = this.settings.emergencyPhrases.map(p => p.toLowerCase())
    
    if (emergencyPhrases.includes(phrase.toLowerCase())) {
      return {
        text: phrase.toUpperCase() + '!',
        isEmergency: true,
        priority: 'high',
        timestamp: new Date().toISOString()
      }
    }

    return null
  }

  // Continuous mode processing
  processContinuousMode(predictions) {
    if (!this.settings.continuousMode) {
      return null
    }

    // Process multiple predictions for continuous conversation
    const results = predictions
      .map(p => this.processTranslation(p.label, p.confidence))
      .filter(Boolean)

    if (results.length === 0) return null

    return {
      text: results.map(r => r.text).join(' '),
      predictions: results,
      timestamp: new Date().toISOString()
    }
  }

  // Update settings
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings }
  }
}

// Create singleton instance
let translationServiceInstance = null

export function getTranslationService(settings) {
  if (!translationServiceInstance) {
    translationServiceInstance = new TranslationService(settings)
  } else {
    translationServiceInstance.updateSettings(settings)
  }
  return translationServiceInstance
}

export default TranslationService
