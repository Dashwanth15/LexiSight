import { useEffect, useRef } from 'react'

const PARTICLE_COUNT = 80
const CONNECTION_DISTANCE = 140
const MAX_CONNECTIONS = 5

function createParticle(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r: Math.random() * 2 + 1,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.02 + Math.random() * 0.02,
    opacity: 0.4 + Math.random() * 0.4,
  }
}

export default function ParticleCanvas({ className = '' }) {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const animRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let w = canvas.offsetWidth
    let h = canvas.offsetHeight
    canvas.width = w
    canvas.height = h

    // Init particles
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => createParticle(w, h))

    const handleResize = () => {
      w = canvas.offsetWidth
      h = canvas.offsetHeight
      canvas.width = w
      canvas.height = h
    }

    window.addEventListener('resize', handleResize)

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      const particles = particlesRef.current

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        let connections = 0

        for (let j = i + 1; j < particles.length && connections < MAX_CONNECTIONS; j++) {
          const q = particles[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.2
            ctx.beginPath()
            ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.stroke()
            connections++
          }
        }
      }

      // Draw + update particles
      for (const p of particles) {
        p.pulse += p.pulseSpeed
        const r = p.r + Math.sin(p.pulse) * 0.8

        // Outer glow
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4)
        gradient.addColorStop(0, `rgba(0, 212, 255, ${p.opacity * 0.3})`)
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0)')
        ctx.beginPath()
        ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 212, 255, ${p.opacity})`
        ctx.fill()

        // Move
        p.x += p.vx
        p.y += p.vy

        // Wrap around
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ opacity: 0.7 }}
    />
  )
}
