/**
 * Custom TensorFlow.js layer implementations for the temporal transformer model.
 * Weight shapes match the exact Keras 3 export in model.json.
 * Must be imported BEFORE calling tf.loadLayersModel().
 */
import * as tf from '@tensorflow/tfjs'

// ─── PositionalEncoding ──────────────────────────────────────────────────────
// Weight: pos_embedding [1, max_len, d_model]
class PositionalEncoding extends tf.layers.Layer {
  constructor(config) {
    super(config)
    this.maxLen = config.max_len || config.maxLen || 30
    this.dModel = config.d_model || config.dModel || 128
  }

  build(inputShape) {
    this.posEmbedding = this.addWeight(
      'pos_embedding', [1, this.maxLen, this.dModel],
      'float32', tf.initializers.zeros()
    )
    this.built = true
  }

  call(inputs) {
    const x = Array.isArray(inputs) ? inputs[0] : inputs
    return tf.tidy(() => {
      const seqLen = x.shape[1]
      const pos = this.posEmbedding.read().slice([0, 0, 0], [1, seqLen, this.dModel])
      return x.add(pos)
    })
  }

  computeOutputShape(inputShape) { return inputShape }

  getConfig() {
    return { ...super.getConfig(), max_len: this.maxLen, d_model: this.dModel }
  }

  static get className() { return 'PositionalEncoding' }
}

// ─── TransformerEncoderBlock ─────────────────────────────────────────────────
// Weights per block (16 total, must match model.json order exactly):
//   Q kernel[d,h,hd], Q bias[h,hd], K kernel, K bias, V kernel, V bias,
//   O kernel[h,hd,d], O bias[d],
//   FFN1 kernel[d,dff], FFN1 bias[dff], FFN2 kernel[dff,d], FFN2 bias[d],
//   LN1 gamma[d], LN1 beta[d], LN2 gamma[d], LN2 beta[d]
class TransformerEncoderBlock extends tf.layers.Layer {
  constructor(config) {
    super(config)
    this.dModel = config.d_model || config.dModel || 128
    this.numHeads = config.num_heads || config.numHeads || 4
    this.dFf = config.d_ff || config.dFf || 256
    this.dropoutRate = config.dropout || config.dropoutRate || 0.1
    this.headDim = Math.floor(this.dModel / this.numHeads)
  }

  build(_inputShape) {
    const d = this.dModel, h = this.numHeads, hd = this.headDim, dff = this.dFf
    const gU = tf.initializers.glorotUniform({})
    const z = tf.initializers.zeros()
    const o = tf.initializers.ones()

    // MHA weights — shapes must match Keras export exactly
    this.wQ = this.addWeight('kernel', [d, h, hd], 'float32', gU)
    this.bQ = this.addWeight('bias',   [h, hd],    'float32', z)
    this.wK = this.addWeight('kernel', [d, h, hd], 'float32', gU)
    this.bK = this.addWeight('bias',   [h, hd],    'float32', z)
    this.wV = this.addWeight('kernel', [d, h, hd], 'float32', gU)
    this.bV = this.addWeight('bias',   [h, hd],    'float32', z)
    this.wO = this.addWeight('kernel', [h, hd, d], 'float32', gU)
    this.bO = this.addWeight('bias',   [d],        'float32', z)

    // FFN weights
    this.ffn1W = this.addWeight('kernel', [d, dff],  'float32', gU)
    this.ffn1B = this.addWeight('bias',   [dff],     'float32', z)
    this.ffn2W = this.addWeight('kernel', [dff, d],  'float32', gU)
    this.ffn2B = this.addWeight('bias',   [d],       'float32', z)

    // LayerNorm weights
    this.ln1G = this.addWeight('gamma', [d], 'float32', o)
    this.ln1B = this.addWeight('beta',  [d], 'float32', z)
    this.ln2G = this.addWeight('gamma', [d], 'float32', o)
    this.ln2B = this.addWeight('beta',  [d], 'float32', z)

    this.built = true
  }

  call(inputs) {
    const x = Array.isArray(inputs) ? inputs[0] : inputs
    return tf.tidy(() => {
      const [batch, seqLen] = [x.shape[0] || 1, x.shape[1]]
      const h = this.numHeads, hd = this.headDim, d = this.dModel

      // ── Multi-Head Self-Attention ──
      // Project: x[b,s,d] × W[d,h,hd] → [b,s,h,hd], reshape W to [d, h*hd]
      const wQr = this.wQ.read().reshape([d, h * hd])
      const wKr = this.wK.read().reshape([d, h * hd])
      const wVr = this.wV.read().reshape([d, h * hd])
      const bQr = this.bQ.read().reshape([h * hd])
      const bKr = this.bK.read().reshape([h * hd])
      const bVr = this.bV.read().reshape([h * hd])

      const xFlat = x.reshape([-1, d])
      let Q = xFlat.matMul(wQr).add(bQr).reshape([-1, seqLen, h, hd]).transpose([0, 2, 1, 3])
      let K = xFlat.matMul(wKr).add(bKr).reshape([-1, seqLen, h, hd]).transpose([0, 2, 1, 3])
      let V = xFlat.matMul(wVr).add(bVr).reshape([-1, seqLen, h, hd]).transpose([0, 2, 1, 3])

      // Scaled dot-product attention
      const scale = tf.scalar(Math.sqrt(hd))
      const scores = Q.matMul(K.transpose([0, 1, 3, 2])).div(scale)
      const weights = scores.softmax(-1)
      let attnOut = weights.matMul(V) // [b, h, s, hd]

      // Concat heads → output projection
      attnOut = attnOut.transpose([0, 2, 1, 3]).reshape([-1, h * hd])
      const wOr = this.wO.read().reshape([h * hd, d])
      let projected = attnOut.matMul(wOr).add(this.bO.read()).reshape([-1, seqLen, d])

      // Add & LayerNorm 1
      let out = x.add(projected)
      out = this._layerNorm(out, this.ln1G.read(), this.ln1B.read())

      // ── Feed-Forward Network ──
      let ffn = out.reshape([-1, d]).matMul(this.ffn1W.read()).add(this.ffn1B.read()).relu()
      ffn = ffn.matMul(this.ffn2W.read()).add(this.ffn2B.read()).reshape([-1, seqLen, d])

      // Add & LayerNorm 2
      out = out.add(ffn)
      out = this._layerNorm(out, this.ln2G.read(), this.ln2B.read())
      return out
    })
  }

  _layerNorm(x, gamma, beta, eps = 1e-6) {
    const mean = x.mean(-1, true)
    const variance = x.sub(mean).square().mean(-1, true)
    return x.sub(mean).div(variance.add(eps).sqrt()).mul(gamma).add(beta)
  }

  computeOutputShape(inputShape) { return inputShape }

  getConfig() {
    return {
      ...super.getConfig(),
      d_model: this.dModel, num_heads: this.numHeads,
      d_ff: this.dFf, dropout: this.dropoutRate,
    }
  }

  static get className() { return 'TransformerEncoderBlock' }
}

// ─── MultiHeadAttention ──────────────────────────────────────────────────────
class MultiHeadAttention extends tf.layers.Layer {
  constructor(config) {
    super(config)
    this.numHeads = config.num_heads || config.numHeads || 4
    this.keyDim = config.key_dim || config.keyDim || 128
    this.valueDim = config.value_dim || config.valueDim || 128
    this.mhaOutputShape = config.output_shape || config.outputShape || null
  }

  build(inputShape) {
    if (!inputShape) return
    const isListOfShapes = Array.isArray(inputShape) && Array.isArray(inputShape[0])
    const shape = isListOfShapes ? inputShape[0] : inputShape
    if (!shape) return
    const dModel = shape[shape.length - 1]
    if (dModel === undefined || dModel === null) return

    const h = this.numHeads
    const hd = this.keyDim
    const gU = tf.initializers.glorotUniform({})
    const z = tf.initializers.zeros()

    this.wQ = this.addWeight('query/kernel', [dModel, h, hd], 'float32', gU)
    this.bQ = this.addWeight('query/bias',   [h, hd],        'float32', z)
    this.wK = this.addWeight('key/kernel',   [dModel, h, hd], 'float32', gU)
    this.bK = this.addWeight('key/bias',     [h, hd],        'float32', z)
    this.wV = this.addWeight('value/kernel', [dModel, h, this.valueDim], 'float32', gU)
    this.bV = this.addWeight('value/bias',   [h, this.valueDim],        'float32', z)
    
    this.wO = this.addWeight('attention_output/kernel', [h, this.valueDim, dModel], 'float32', gU)
    this.bO = this.addWeight('attention_output/bias',   [dModel],                  'float32', z)

    this.built = true
  }

  call(inputs) {
    let query, value, key
    if (Array.isArray(inputs)) {
      query = inputs[0]
      value = inputs[1] || query
      key = inputs[2] || value
    } else {
      query = inputs
      value = inputs
      key = inputs
    }

    return tf.tidy(() => {
      const seqLen = query.shape[1]
      const h = this.numHeads
      const hd = this.keyDim
      const dModel = query.shape[2]

      const qFlat = query.reshape([-1, dModel])
      const kFlat = key.reshape([-1, dModel])
      const vFlat = value.reshape([-1, dModel])

      const wQr = this.wQ.read().reshape([dModel, h * hd])
      const wKr = this.wK.read().reshape([dModel, h * hd])
      const wVr = this.wV.read().reshape([dModel, h * this.valueDim])

      const bQr = this.bQ.read().reshape([h * hd])
      const bKr = this.bK.read().reshape([h * hd])
      const bVr = this.bV.read().reshape([h * this.valueDim])

      let Q = qFlat.matMul(wQr).add(bQr).reshape([-1, seqLen, h, hd]).transpose([0, 2, 1, 3])
      let K = kFlat.matMul(wKr).add(bKr).reshape([-1, seqLen, h, hd]).transpose([0, 2, 1, 3])
      let V = vFlat.matMul(wVr).add(bVr).reshape([-1, seqLen, h, this.valueDim]).transpose([0, 2, 1, 3])

      const scale = tf.scalar(Math.sqrt(hd))
      const scores = Q.matMul(K.transpose([0, 1, 3, 2])).div(scale)
      const weights = scores.softmax(-1)
      let attnOut = weights.matMul(V)

      attnOut = attnOut.transpose([0, 2, 1, 3]).reshape([-1, h * this.valueDim])

      const wOr = this.wO.read().reshape([h * this.valueDim, dModel])
      const projected = attnOut.matMul(wOr).add(this.bO.read()).reshape([-1, seqLen, dModel])

      return projected
    })
  }

  computeOutputShape(inputShape) {
    const isListOfShapes = Array.isArray(inputShape) && Array.isArray(inputShape[0])
    const shape = isListOfShapes ? inputShape[0] : inputShape
    return shape
  }

  getConfig() {
    return {
      ...super.getConfig(),
      num_heads: this.numHeads,
      key_dim: this.keyDim,
      value_dim: this.valueDim,
      output_shape: this.mhaOutputShape,
    }
  }

  static get className() { return 'MultiHeadAttention' }
}

// ─── Register ────────────────────────────────────────────────────────────────
tf.serialization.registerClass(PositionalEncoding)
tf.serialization.registerClass(TransformerEncoderBlock)
tf.serialization.registerClass(MultiHeadAttention)

export { PositionalEncoding, TransformerEncoderBlock, MultiHeadAttention }

