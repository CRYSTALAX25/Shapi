'use client'

// ============================================================================
// NeuralGlobe — the approved homepage hero backdrop (Ana, 2026-06-13).
// ============================================================================
// A rotating 3D sphere of nodes whose links FIRE like a neural network: signals
// travel node-to-node with glowing comet tails, staggered so activity ripples
// across the whole globe; nodes flash when a signal lands. Conveys intelligence
// + total interconnection ("one unified network — pull a link and it breaks").
//
// Plain <canvas> + hand-rolled perspective projection — ZERO dependencies, no
// Three.js bundle. GPU-cheap (one 2D context), reduced-motion aware, mouse-
// parallax. Sits as an absolute, pointer-events-none, dimmable backdrop; the
// parent supplies a vignette so foreground text stays readable.
// ============================================================================

import { useEffect, useRef } from 'react'

export default function NeuralGlobe({
  opacity = 0.6,
  className = '',
}: {
  opacity?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // ── nodes on a sphere (fibonacci) ──
    const N = 150, R = 1
    const pts: { x: number; y: number; z: number; mint: boolean }[] = []
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2
      const rad = Math.sqrt(1 - y * y)
      const th = golden * i
      pts.push({ x: Math.cos(th) * rad * R, y: y * R, z: Math.sin(th) * rad * R, mint: i % 5 === 0 })
    }
    // ── links + per-edge firing params ──
    const edges: { i: number; j: number; off: number; period: number; mint: boolean }[] = []
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, dz = pts[i].z - pts[j].z
        if (dx * dx + dy * dy + dz * dz < 0.16) {
          const k = edges.length
          edges.push({ i, j, off: (k * 0.61803) % 1, period: 150 + (k % 7) * 42, mint: pts[i].mint || pts[j].mint })
        }
      }
    const FIRE = 0.34
    const act = new Float32Array(N)

    let W = 0, H = 0, dpr = 1
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.clientWidth; H = canvas.clientHeight
      canvas.width = W * dpr; canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    let mx = 0, my = 0, tmx = 0, tmy = 0
    function onMove(e: MouseEvent) {
      tmx = (e.clientX / window.innerWidth - 0.5) * 0.5
      tmy = (e.clientY / window.innerHeight - 0.5) * 0.5
    }
    window.addEventListener('mousemove', onMove)

    function rot(p: { x: number; y: number; z: number }, ay: number, ax: number) {
      const cy = Math.cos(ay), sy = Math.sin(ay)
      let x = p.x * cy - p.z * sy
      let z = p.x * sy + p.z * cy
      const cx = Math.cos(ax), sx = Math.sin(ax)
      const y = p.y * cx - z * sx
      z = p.y * sx + z * cx
      return { x, y, z }
    }

    let t = 0, raf = 0
    function frame() {
      t += reduce ? 0 : 1
      mx += (tmx - mx) * 0.05
      my += (tmy - my) * 0.05
      ctx.clearRect(0, 0, W, H)

      const cx = W / 2, cy = H / 2, scale = Math.min(W, H) * 0.42, focal = 3
      const ay = t * 0.0016 + mx, ax = -my * 0.7
      const proj = pts.map((p) => {
        const r = rot(p, ay, ax)
        const persp = focal / (focal + r.z)
        return { sx: cx + r.x * scale * persp, sy: cy + r.y * scale * persp, depth: (r.z + R) / (2 * R), persp, mint: p.mint }
      })

      for (let n = 0; n < N; n++) act[n] *= 0.9

      for (const e of edges) {
        const a = proj[e.i], b = proj[e.j]
        const d = (a.depth + b.depth) / 2
        ctx.strokeStyle = `rgba(56,189,248,${0.03 + d * 0.1})`
        ctx.lineWidth = 0.6 * ((a.persp + b.persp) / 2)
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke()

        const phase = (t / e.period + e.off) % 1
        if (phase >= FIRE) continue
        const u = phase / FIRE
        const col = e.mint ? '52,211,153' : '56,189,248'
        const u0 = Math.max(0, u - 0.22)
        const x0 = a.sx + (b.sx - a.sx) * u0, y0 = a.sy + (b.sy - a.sy) * u0
        const xu = a.sx + (b.sx - a.sx) * u, yu = a.sy + (b.sy - a.sy) * u
        const g = ctx.createLinearGradient(x0, y0, xu, yu)
        g.addColorStop(0, `rgba(${col},0)`)
        g.addColorStop(1, `rgba(${col},${0.55 + d * 0.4})`)
        ctx.strokeStyle = g
        ctx.lineWidth = 1.3 * ((a.persp + b.persp) / 2)
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xu, yu); ctx.stroke()
        ctx.beginPath(); ctx.arc(xu, yu, 1.6 * ((a.persp + b.persp) / 2), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${col},${0.7 + d * 0.3})`
        ctx.fill()
        if (u > 0.96) act[e.j] = 1
      }

      const order = proj.map((_, i) => i).sort((i, j) => proj[i].depth - proj[j].depth)
      for (const i of order) {
        const p = proj[i], a = act[i]
        const rad = (1.1 + p.depth * 2.4) * p.persp + a * 1.6
        const alpha = Math.min(1, 0.22 + p.depth * 0.7 + a * 0.5)
        ctx.beginPath(); ctx.arc(p.sx, p.sy, rad, 0, Math.PI * 2)
        ctx.fillStyle = p.mint ? `rgba(52,211,153,${alpha})` : `rgba(56,189,248,${alpha})`
        ctx.shadowBlur = (p.depth > 0.8 ? 8 : 0) * p.persp + a * 12
        ctx.shadowColor = p.mint ? 'rgba(52,211,153,0.7)' : 'rgba(56,189,248,0.7)'
        ctx.fill()
      }
      ctx.shadowBlur = 0

      raf = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ opacity }}
      aria-hidden
    />
  )
}
