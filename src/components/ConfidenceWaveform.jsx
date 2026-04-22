import { useEffect, useRef } from 'react'

/**
 * ConfidenceWaveform
 * Real-time scrolling confidence timeline — like an audio waveform for gesture AI
 */
export default function ConfidenceWaveform({ confidence = 0, isActive = false }) {
  const canvasRef = useRef(null)
  const historyRef = useRef(Array(120).fill(0))
  const animRef = useRef(null)

  useEffect(() => {
    historyRef.current.push(confidence)
    if (historyRef.current.length > 120) historyRef.current.shift()
  }, [confidence])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // Background grid
      ctx.strokeStyle = 'rgba(26,37,53,0.5)'
      ctx.lineWidth = 0.5
      for (let i = 0; i <= 4; i++) {
        const y = (H / 4) * i
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }

      // Threshold line at 75%
      ctx.strokeStyle = 'rgba(255,170,0,0.3)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(0, H * 0.25)
      ctx.lineTo(W, H * 0.25)
      ctx.stroke()
      ctx.setLineDash([])

      const history = historyRef.current
      const step = W / (history.length - 1)

      // Gradient fill under waveform
      const gradient = ctx.createLinearGradient(0, 0, 0, H)
      gradient.addColorStop(0, isActive ? 'rgba(0,255,136,0.2)' : 'rgba(0,212,255,0.1)')
      gradient.addColorStop(1, 'transparent')

      ctx.beginPath()
      ctx.moveTo(0, H)
      history.forEach((val, i) => {
        const x = i * step
        const y = H - val * H
        if (i === 0) ctx.lineTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.lineTo(W, H)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()

      // Waveform line
      ctx.beginPath()
      ctx.lineWidth = 1.5
      history.forEach((val, i) => {
        const x = i * step
        const y = H - val * H
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })

      const lastVal = history[history.length - 1]
      const lineColor = lastVal > 0.85 ? '#00ff88' : lastVal > 0.6 ? '#ffaa00' : '#ff3366'
      ctx.strokeStyle = isActive ? lineColor : '#1a2535'
      ctx.stroke()

      // Current value dot
      const lastX = (history.length - 1) * step
      const lastY = H - lastVal * H
      ctx.beginPath()
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
      ctx.fillStyle = isActive ? lineColor : '#1a2535'
      ctx.shadowColor = isActive ? lineColor : 'transparent'
      ctx.shadowBlur = isActive ? 8 : 0
      ctx.fill()
      ctx.shadowBlur = 0

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [isActive])

  return (
    <div style={{ position: 'relative' }}>
      <div className="hud-label mb-1" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Confidence Timeline</span>
        <span style={{ color: confidence > 0.85 ? '#00ff88' : confidence > 0.6 ? '#ffaa00' : '#ff3366' }}>
          {(confidence * 100).toFixed(0)}%
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={52}
        style={{
          width: '100%',
          height: 52,
          borderRadius: 8,
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid #1a2535',
          display: 'block',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: '0.55rem', color: '#1a2535', fontFamily: 'JetBrains Mono, monospace' }}>120 frames ago</span>
        <span style={{ fontSize: '0.55rem', color: '#1a2535', fontFamily: 'JetBrains Mono, monospace' }}>now</span>
      </div>
    </div>
  )
}
