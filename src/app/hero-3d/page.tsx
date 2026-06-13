'use client'

// ============================================================================
// /hero-3d — 3D HERO COMPARISON (for Ana to pick a direction)
// ============================================================================
// THREE genuinely-3D hero backdrops, all on a plain <canvas> with hand-rolled
// perspective projection — ZERO new dependencies (no Three.js bundle). Toggle
// between them with the pills at the top. Locked ocean→mint palette, static
// colours, mouse-parallax, reduced-motion aware.
//
//   1. Globe   — rotating constellation sphere (the "matching network" motif)
//   2. Star    — a faceted 3D North-Star gem, shaded + orbited by verified nodes
//   3. Field   — an undulating 3D point-landscape drifting toward the viewer
//
// Throwaway review page. The chosen renderer becomes the homepage hero backdrop.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ShapiLogo from '@/components/ShapiLogo'

const OCEAN = '#38BDF8'
const MINT = '#34D399'
const VIOLET = '#9D8CFF'

type Variant = 'globe' | 'star' | 'field'

const VARIANTS: { id: Variant; label: string; blurb: string }[] = [
  { id: 'globe', label: '1 · Constellation globe', blurb: 'A rotating sphere of connected nodes — the “verified network / matching” motif.' },
  { id: 'star', label: '2 · Faceted North-Star', blurb: 'Our logo as a real 3D faceted gem, catching light, orbited by verified nodes.' },
  { id: 'field', label: '3 · Data landscape', blurb: 'An undulating field of points drifting toward you — calm, premium, ambient.' },
]

export default function Hero3DCompare() {
  const [variant, setVariant] = useState<Variant>('globe')
  const active = VARIANTS.find((v) => v.id === variant)!

  return (
    <main className="relative min-h-screen overflow-hidden" style={{ background: '#060609' }}>
      <Canvas3D variant={variant} />

      {/* variant switcher */}
      <div className="relative z-20 flex flex-col items-center gap-2 px-6 pt-6">
        <div
          className="flex flex-wrap justify-center gap-1.5 rounded-full p-1.5"
          style={{ background: 'rgba(13,12,20,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              onClick={() => setVariant(v.id)}
              className="rounded-full px-4 py-2 text-xs font-bold transition-all"
              style={
                variant === v.id
                  ? { background: `linear-gradient(135deg, ${OCEAN}, ${MINT})`, color: '#06121a' }
                  : { color: 'rgba(255,255,255,0.6)' }
              }
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className="max-w-md text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {active.blurb}
        </p>
      </div>

      {/* foreground hero content */}
      <section className="relative z-10 flex min-h-[calc(100vh-7rem)] flex-col items-center justify-center px-6 text-center">
        <div className="mb-7" style={{ filter: 'drop-shadow(0 10px 40px rgba(56,189,248,0.5))' }}>
          <ShapiLogo size={76} variant="mark" title="Shapi" />
        </div>

        <h1 className="text-5xl font-black leading-[0.95] tracking-tighter md:text-[80px]" style={{ color: '#fff' }}>
          <span className="block">Stop guessing.</span>
          <span className="block">
            Hire what&apos;s{' '}
            <span
              style={{
                background: `linear-gradient(135deg, ${OCEAN}, ${MINT})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              proven.
            </span>
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed md:text-xl" style={{ color: 'rgba(255,255,255,0.6)' }}>
          The verification layer for hiring. References sourced independently,
          skills proven with evidence, companies carrying a real trust score.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup?type=candidate"
            className="rounded-full px-8 py-4 text-sm font-black text-white transition-transform hover:scale-[1.04]"
            style={{ background: `linear-gradient(135deg, ${OCEAN}, ${MINT})`, boxShadow: '0 12px 32px rgba(56,189,248,0.34)' }}
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

        <p className="mt-14 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          3D hero options · tell me which (or none) ·{' '}
          <Link href="/" className="underline" style={{ color: OCEAN }}>
            back to current home
          </Link>
        </p>
      </section>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas3D — one canvas, three renderers selected by `variant`.
// ─────────────────────────────────────────────────────────────────────────────
function Canvas3D({ variant }: { variant: Variant }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
      tmx = (e.clientX / window.innerWidth - 0.5) * 0.6
      tmy = (e.clientY / window.innerHeight - 0.5) * 0.6
    }
    window.addEventListener('mousemove', onMove)

    const render =
      variant === 'globe' ? makeGlobe() : variant === 'star' ? makeStar() : makeField()

    let t = 0, raf = 0
    function frame() {
      t += reduce ? 0 : 1
      mx += (tmx - mx) * 0.05
      my += (tmy - my) * 0.05
      ctx.clearRect(0, 0, W, H)
      render(ctx, W, H, t, mx, my)
      raf = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
    }
  }, [variant])

  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-1/2 h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.14) 0%, transparent 65%)', filter: 'blur(14px)' }}
        />
        <div
          className="absolute left-[58%] top-[44%] h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.10) 0%, transparent 65%)', filter: 'blur(14px)' }}
        />
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
    </>
  )
}

type Renderer = (ctx: CanvasRenderingContext2D, W: number, H: number, t: number, mx: number, my: number) => void

// rotate a point around Y then X
function rot(p: { x: number; y: number; z: number }, ay: number, ax: number) {
  const cy = Math.cos(ay), sy = Math.sin(ay)
  let x = p.x * cy - p.z * sy
  let z = p.x * sy + p.z * cy
  const cx = Math.cos(ax), sx = Math.sin(ax)
  const y = p.y * cx - z * sx
  z = p.y * sx + z * cx
  return { x, y, z }
}

// ---- Variant 1: constellation globe ----
function makeGlobe(): Renderer {
  const N = 150, R = 1
  const pts: { x: number; y: number; z: number; mint: boolean }[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2
    const rad = Math.sqrt(1 - y * y)
    const th = golden * i
    pts.push({ x: Math.cos(th) * rad * R, y: y * R, z: Math.sin(th) * rad * R, mint: i % 5 === 0 })
  }
  const edges: [number, number][] = []
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++) {
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, dz = pts[i].z - pts[j].z
      if (dx * dx + dy * dy + dz * dz < 0.16) edges.push([i, j])
    }
  return (ctx, W, H, t, mx, my) => {
    const cx = W / 2, cy = H / 2, scale = Math.min(W, H) * 0.42, focal = 3
    const ay = t * 0.0016 + mx, ax = -my * 0.8
    const proj = pts.map((p) => {
      const r = rot(p, ay, ax)
      const persp = focal / (focal + r.z)
      return { sx: cx + r.x * scale * persp, sy: cy + r.y * scale * persp, depth: (r.z + R) / (2 * R), persp, mint: p.mint }
    })
    for (const [i, j] of edges) {
      const a = proj[i], b = proj[j], d = (a.depth + b.depth) / 2
      ctx.strokeStyle = `rgba(56,189,248,${0.04 + d * 0.13})`
      ctx.lineWidth = 0.6 * ((a.persp + b.persp) / 2)
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke()
    }
    const order = proj.map((_, i) => i).sort((i, j) => proj[i].depth - proj[j].depth)
    for (const i of order) {
      const p = proj[i], rad = (1.1 + p.depth * 2.4) * p.persp, alpha = 0.25 + p.depth * 0.7
      ctx.beginPath(); ctx.arc(p.sx, p.sy, rad, 0, Math.PI * 2)
      ctx.fillStyle = p.mint ? `rgba(52,211,153,${alpha})` : `rgba(56,189,248,${alpha})`
      ctx.shadowBlur = p.depth > 0.8 ? 8 * p.persp : 0
      ctx.shadowColor = p.mint ? 'rgba(52,211,153,0.6)' : 'rgba(56,189,248,0.6)'
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }
}

// ---- Variant 2: faceted 3D North-Star gem ----
function makeStar(): Renderer {
  // 8 outer ray tips + 8 inner-waist points alternating, plus front/back apex
  // for a faceted 3D star. Build vertices on a plane, give thickness in z.
  const tips: { x: number; y: number; z: number }[] = []
  const inner: { x: number; y: number; z: number }[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const long = i % 2 === 0 ? 1 : 0.72 // vertical/horizontal longer than diagonals
    tips.push({ x: Math.cos(a) * long, y: Math.sin(a) * long, z: 0 })
    const a2 = a + Math.PI / 8
    inner.push({ x: Math.cos(a2) * 0.22, y: Math.sin(a2) * 0.22, z: 0 })
  }
  const front = { x: 0, y: 0, z: 0.34 }
  const back = { x: 0, y: 0, z: -0.34 }
  // facets: each (tip[i], inner[i], front) and (inner[i], tip[i+1], front) + back mirror
  const facets: { a: typeof front; b: typeof front; c: typeof front }[] = []
  for (let i = 0; i < 8; i++) {
    const ni = (i + 1) % 8
    facets.push({ a: tips[i], b: inner[i], c: front })
    facets.push({ a: inner[i], b: tips[ni], c: front })
    facets.push({ a: tips[i], b: inner[i], c: back })
    facets.push({ a: inner[i], b: tips[ni], c: back })
  }
  const orbit: { ang: number; r: number; tilt: number; mint: boolean }[] = []
  for (let i = 0; i < 14; i++) orbit.push({ ang: (i / 14) * Math.PI * 2, r: 1.5 + (i % 3) * 0.18, tilt: (i % 5) * 0.3, mint: i % 3 === 0 })
  const light = { x: 0.4, y: -0.5, z: 0.76 }

  return (ctx, W, H, t, mx, my) => {
    const cx = W / 2, cy = H / 2, scale = Math.min(W, H) * 0.30, focal = 3.2
    const ay = t * 0.0045 + mx * 1.2, ax = -0.25 + -my
    const P = (p: { x: number; y: number; z: number }) => {
      const r = rot(p, ay, ax)
      const persp = focal / (focal + r.z)
      return { sx: cx + r.x * scale * persp, sy: cy + r.y * scale * persp, z: r.z }
    }
    // orbiting verified nodes (behind)
    for (const o of orbit) {
      const a = o.ang + t * 0.004
      const p = rot({ x: Math.cos(a) * o.r, y: Math.sin(a) * o.r * Math.cos(o.tilt), z: Math.sin(a) * o.r * Math.sin(o.tilt) }, ay * 0.3, ax)
      if (p.z > 0.2) continue // draw only back ones first
      const persp = focal / (focal + p.z)
      ctx.beginPath(); ctx.arc(cx + p.x * scale * persp, cy + p.y * scale * persp, 2.4 * persp, 0, Math.PI * 2)
      ctx.fillStyle = o.mint ? 'rgba(52,211,153,0.5)' : 'rgba(56,189,248,0.5)'
      ctx.fill()
    }
    // star facets, shaded by normal·light, drawn far-to-near
    const shaded = facets.map((f) => {
      const a = P(f.a), b = P(f.b), c = P(f.c)
      // normal via cross product of edges in rotated space
      const ra = rot(f.a, ay, ax), rb = rot(f.b, ay, ax), rc = rot(f.c, ay, ax)
      const ux = rb.x - ra.x, uy = rb.y - ra.y, uz = rb.z - ra.z
      const vx = rc.x - ra.x, vy = rc.y - ra.y, vz = rc.z - ra.z
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl
      const lum = Math.max(0.08, Math.abs(nx * light.x + ny * light.y + nz * light.z))
      return { a, b, c, zc: (ra.z + rb.z + rc.z) / 3, lum }
    }).sort((p, q) => p.zc - q.zc)
    for (const f of shaded) {
      // ocean→mint mix by luminance, brighter facets toward mint-white
      const r = Math.round(56 + (52 - 56) * (1 - f.lum) + 150 * f.lum)
      const g = Math.round(189 + (211 - 189) * f.lum + 40 * f.lum)
      const bl = Math.round(248 + (153 - 248) * f.lum)
      ctx.beginPath(); ctx.moveTo(f.a.sx, f.a.sy); ctx.lineTo(f.b.sx, f.b.sy); ctx.lineTo(f.c.sx, f.c.sy); ctx.closePath()
      ctx.fillStyle = `rgba(${r},${Math.min(g,255)},${Math.max(bl,120)},${0.55 + f.lum * 0.4})`
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.4; ctx.stroke()
    }
    // front orbiting nodes
    for (const o of orbit) {
      const a = o.ang + t * 0.004
      const p = rot({ x: Math.cos(a) * o.r, y: Math.sin(a) * o.r * Math.cos(o.tilt), z: Math.sin(a) * o.r * Math.sin(o.tilt) }, ay * 0.3, ax)
      if (p.z <= 0.2) continue
      const persp = focal / (focal + p.z)
      ctx.beginPath(); ctx.arc(cx + p.x * scale * persp, cy + p.y * scale * persp, 2.8 * persp, 0, Math.PI * 2)
      ctx.fillStyle = o.mint ? 'rgba(52,211,153,0.9)' : 'rgba(56,189,248,0.9)'
      ctx.shadowBlur = 8; ctx.shadowColor = o.mint ? 'rgba(52,211,153,0.7)' : 'rgba(56,189,248,0.7)'
      ctx.fill(); ctx.shadowBlur = 0
    }
  }
}

// ---- Variant 3: undulating data landscape ----
function makeField(): Renderer {
  const COLS = 34, ROWS = 22
  return (ctx, W, H, t, mx, my) => {
    const cx = W / 2, cy = H * 0.46, focal = 2.2
    const ax = 0.62 + my * 0.4 // looking down at the field
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const gx = (c / (COLS - 1) - 0.5) * 4
        const gz = (r / (ROWS - 1)) * 5 - 0.4 - ((t * 0.01) % (5 / ROWS)) // drift toward viewer
        const wave = Math.sin(gx * 1.1 + t * 0.02) * 0.18 + Math.cos(gz * 1.3 - t * 0.022) * 0.18
        const p = rot({ x: gx + mx * 0.5, y: wave - 0.2, z: gz }, 0, ax)
        const zz = p.z + 2.4
        if (zz <= 0.1) continue
        const persp = focal / zz
        const sx = cx + p.x * Math.min(W, H) * 0.5 * persp
        const sy = cy + p.y * Math.min(W, H) * 0.5 * persp
        const depth = Math.max(0, Math.min(1, 1 - gz / 5))
        const rad = 0.6 + depth * 2.2
        const mint = (r + c) % 7 === 0
        ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI * 2)
        ctx.fillStyle = mint
          ? `rgba(52,211,153,${0.15 + depth * 0.6})`
          : `rgba(56,189,248,${0.10 + depth * 0.55})`
        ctx.fill()
      }
    }
  }
}
