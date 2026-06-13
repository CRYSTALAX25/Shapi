'use client'

// ============================================================================
// /hero-3d — STANDALONE 3D HERO TEMPLATE (for Ana to compare directions)
// ============================================================================
// A genuinely-3D animated hero, built on a plain <canvas> with hand-rolled 3D
// projection — ZERO new dependencies, no Three.js bundle. A slowly-rotating
// constellation globe (the "matching" motif) wrapped around the North-Star
// mark, in the locked Violet Mint palette (violet #9D8CFF → mint #34D399),
// STATIC colours, no coral, mouse-parallax, reduced-motion aware.
//
// This is a throwaway demo page so the direction can be judged on production.
// If approved, the <ConstellationGlobe> becomes the homepage hero backdrop.
// ============================================================================

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import ShapiLogo from '@/components/ShapiLogo'

const VIOLET = '#9D8CFF'
const MINT = '#34D399'

export default function Hero3DDemo() {
  return (
    <main className="relative min-h-screen overflow-hidden" style={{ background: '#060609' }}>
      <ConstellationGlobe />

      {/* foreground hero content */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-7" style={{ filter: 'drop-shadow(0 10px 40px rgba(157,140,255,0.5))' }}>
          <ShapiLogo size={84} variant="mark" title="Shapi" />
        </div>

        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: MINT }} />
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
            3D hero template · tell me if this is the direction
          </span>
        </div>

        <h1
          className="text-5xl font-black leading-[0.95] tracking-tighter md:text-[84px]"
          style={{ color: '#fff' }}
        >
          <span className="block">Stop guessing.</span>
          <span className="block">
            Hire what&apos;s{' '}
            <span
              style={{
                background: `linear-gradient(135deg, ${VIOLET}, ${MINT})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              proven.
            </span>
          </span>
        </h1>

        <p
          className="mx-auto mt-7 max-w-xl text-lg leading-relaxed md:text-xl"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          The verification layer for hiring. References sourced independently,
          skills proven with evidence, companies carrying a real trust score.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup?type=candidate"
            className="rounded-full px-8 py-4 text-sm font-black text-white transition-transform hover:scale-[1.04]"
            style={{ background: `linear-gradient(135deg, ${VIOLET}, ${MINT})`, boxShadow: '0 12px 32px rgba(157,140,255,0.34)' }}
          >
            Build my verified profile — free
          </Link>
          <Link
            href="/for-companies"
            className="rounded-full px-8 py-4 text-sm font-bold transition-colors"
            style={{ color: '#F4F4F7', border: '1px solid rgba(255,255,255,0.14)' }}
          >
            I&apos;m hiring →
          </Link>
        </div>

        <p className="mt-16 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          ← compare with the current hero at{' '}
          <Link href="/" className="underline" style={{ color: VIOLET }}>
            shapi.io
          </Link>
        </p>
      </section>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ConstellationGlobe — a rotating 3D sphere of nodes + proximity edges, drawn
// with manual perspective projection on a 2D canvas. Violet nodes with mint
// "verified" nodes every few; edges fade with depth. Mouse nudges the tilt.
// ─────────────────────────────────────────────────────────────────────────────
function ConstellationGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // ── build N points on a sphere (fibonacci distribution) ──
    const N = 150
    const R = 1
    const pts: { x: number; y: number; z: number; mint: boolean }[] = []
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2
      const rad = Math.sqrt(1 - y * y)
      const theta = golden * i
      pts.push({
        x: Math.cos(theta) * rad * R,
        y: y * R,
        z: Math.sin(theta) * rad * R,
        mint: i % 5 === 0, // ~1 in 5 is a "verified" mint node — meaningful, not decorative
      })
    }
    // precompute close pairs (edges) once — sphere is rigid so neighbours are fixed
    const edges: [number, number][] = []
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pts[i].x - pts[j].x
        const dy = pts[i].y - pts[j].y
        const dz = pts[i].z - pts[j].z
        if (dx * dx + dy * dy + dz * dz < 0.16) edges.push([i, j])
      }
    }

    let W = 0, H = 0, dpr = 1
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.clientWidth
      H = canvas.clientHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // mouse parallax target
    let mx = 0, my = 0, tmx = 0, tmy = 0
    function onMove(e: MouseEvent) {
      tmx = (e.clientX / window.innerWidth - 0.5) * 0.6
      tmy = (e.clientY / window.innerHeight - 0.5) * 0.6
    }
    window.addEventListener('mousemove', onMove)

    let angle = 0
    let raf = 0
    function frame() {
      angle += reduce ? 0 : 0.0016
      mx += (tmx - mx) * 0.05
      my += (tmy - my) * 0.05

      const cx = W / 2
      const cy = H / 2
      const scale = Math.min(W, H) * 0.42
      const focal = 3

      // rotation: continuous spin around Y + mouse tilt around X
      const ay = angle + mx
      const ax = -my * 0.8
      const cosY = Math.cos(ay), sinY = Math.sin(ay)
      const cosX = Math.cos(ax), sinX = Math.sin(ax)

      const proj = pts.map((p) => {
        // rotate around Y
        let x = p.x * cosY - p.z * sinY
        let z = p.x * sinY + p.z * cosY
        let y = p.y
        // rotate around X
        const y2 = y * cosX - z * sinX
        const z2 = y * sinX + z * cosX
        y = y2; z = z2
        const persp = focal / (focal + z)
        return { sx: cx + x * scale * persp, sy: cy + y * scale * persp, depth: (z + R) / (2 * R), persp, mint: p.mint }
      })

      ctx.clearRect(0, 0, W, H)

      // edges
      for (const [i, j] of edges) {
        const a = proj[i], b = proj[j]
        const d = (a.depth + b.depth) / 2
        ctx.strokeStyle = `rgba(157,140,255,${0.04 + d * 0.13})`
        ctx.lineWidth = 0.6 * ((a.persp + b.persp) / 2)
        ctx.beginPath()
        ctx.moveTo(a.sx, a.sy)
        ctx.lineTo(b.sx, b.sy)
        ctx.stroke()
      }

      // nodes (draw far-to-near for correct overlap)
      const order = proj.map((p, i) => i).sort((i, j) => proj[i].depth - proj[j].depth)
      for (const i of order) {
        const p = proj[i]
        const r = (1.1 + p.depth * 2.4) * p.persp
        const alpha = 0.25 + p.depth * 0.7
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2)
        ctx.fillStyle = p.mint
          ? `rgba(52,211,153,${alpha})`
          : `rgba(157,140,255,${alpha})`
        if (p.depth > 0.8) {
          ctx.shadowBlur = 8 * p.persp
          ctx.shadowColor = p.mint ? 'rgba(52,211,153,0.6)' : 'rgba(157,140,255,0.6)'
        } else {
          ctx.shadowBlur = 0
        }
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
    <>
      {/* soft aurora glows behind the globe */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div
          className="absolute left-1/2 top-1/2 h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(157,140,255,0.16) 0%, transparent 65%)', filter: 'blur(12px)' }}
        />
        <div
          className="absolute left-[58%] top-[42%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.10) 0%, transparent 65%)', filter: 'blur(12px)' }}
        />
      </div>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ width: '100%', height: '100%' }}
        aria-hidden
      />
    </>
  )
}
