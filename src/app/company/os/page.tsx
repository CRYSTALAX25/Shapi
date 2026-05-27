'use client'

// Workforce OS — Tier C live monitoring dashboard (STRATEGY §16).
//
// Sits on top of Tier A Workforce Snapshot. Shows the current readiness
// score, a 5-point trend sparkline, open drift alerts (with Ack / Resolve),
// a live counts strip, and an HRIS-integration coming-soon card.
//
// Voice rules: 70%-confidence reads + named drivers. Never "indicative",
// "approximate", or "rough" — the moat is sourced confidence, not hedging.

import { useEffect, useState } from 'react'
import Link from 'next/link'

type TrendPoint = { score: number; when: string }
type Alert = {
  id: string
  kind: string | null
  severity: string | null
  title: string | null
  detail: string | null
  metric_before: number | null
  metric_after: number | null
  status: string | null
  triggered_at: string
  acked_at: string | null
  resolved_at: string | null
}
type OsResponse = {
  success?: boolean
  current_score: number | null
  score_trend: TrendPoint[]
  alerts: Alert[]
  counts: { staffing_recs: number; interviews_week: number; candidates_active: number }
  hris_connected: boolean
  error?: string
}

const SEVERITY_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  info:     { bg: 'rgba(106,168,245,0.10)', border: 'rgba(106,168,245,0.30)', color: '#6AA8F5', label: 'Info' },
  warning:  { bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.30)',  color: '#FBBF24', label: 'Warning' },
  critical: { bg: 'rgba(245,142,154,0.12)', border: 'rgba(245,142,154,0.35)', color: '#F58E9A', label: 'Critical' },
}

const KIND_LABEL: Record<string, string> = {
  readiness_drop: 'Readiness drop',
  team_overload: 'Team overload',
  attrition_risk: 'Attrition risk',
  ai_displacement_signal: 'AI displacement signal',
  cost_overrun: 'Cost overrun',
}

function scoreColor(score: number): string {
  if (score >= 70) return '#34D399' // emerald — on-track
  if (score >= 40) return '#FBBF24' // amber  — needs attention
  return '#F58E9A'                  // coral-red — high-risk
}

// Render a small 5-point trend sparkline. We chose an inline SVG polyline
// (60 × 22 viewBox) over a chart library because:
//   1. 5 points is too few for a library to add value
//   2. zero deps keeps the page server-fast
//   3. we can colour-code the delta vs first point inline (emerald up,
//      coral-red down), which is the actual signal we want the CEO to read
function TrendSparkline({ points }: { points: TrendPoint[] }) {
  if (!points || points.length < 2) {
    return <p className="text-[#7E7E8E] text-[11px]">Trend builds after your next snapshot.</p>
  }
  const w = 120, h = 36, padX = 4, padY = 4
  const scores = points.map(p => p.score)
  const lo = Math.min(...scores)
  const hi = Math.max(...scores)
  const range = Math.max(1, hi - lo)
  const stepX = (w - padX * 2) / (points.length - 1)
  const coords = points.map((p, i) => {
    const x = padX + i * stepX
    const y = h - padY - ((p.score - lo) / range) * (h - padY * 2)
    return { x, y, s: p.score }
  })
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(' ')
  const first = points[0].score
  const last = points[points.length - 1].score
  const delta = last - first
  const deltaColor = delta > 0 ? '#34D399' : delta < 0 ? '#F58E9A' : '#A6A6B4'
  const deltaSign = delta > 0 ? '+' : ''

  return (
    <div className="flex items-center gap-2">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
        <path d={path} fill="none" stroke={deltaColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 2.2 : 1.4}
            fill={i === coords.length - 1 ? deltaColor : 'rgba(255,255,255,0.55)'}
          />
        ))}
      </svg>
      <span className="text-[11px] font-black" style={{ color: deltaColor }}>
        {deltaSign}{delta} pts
      </span>
      <span className="text-[10px] text-[#7E7E8E]">vs {points.length} snapshots ago</span>
    </div>
  )
}

export default function WorkforceOsPage() {
  const [data, setData] = useState<OsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/company/os', { cache: 'no-store' })
      const raw = await res.text()
      let d: OsResponse | { error?: string } = { error: '' }
      try { d = JSON.parse(raw) } catch {
        setErr(`Server error (${res.status}) — try refreshing.`)
        return
      }
      if (!res.ok) {
        setErr((d as { error?: string }).error || 'Could not load Workforce OS.')
        return
      }
      setData(d as OsResponse)
    } catch {
      setErr('Connection dropped — try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateAlertStatus = async (id: string, status: 'acked' | 'resolved') => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/company/os/alerts/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const raw = await res.text()
      let d: { success?: boolean; error?: string } = {}
      try { d = JSON.parse(raw) } catch {
        setErr(`Server error (${res.status}) — try again.`)
        return
      }
      if (!res.ok) {
        setErr(d.error || 'Could not update — try again.')
        return
      }
      // Optimistically drop the alert from the open list.
      setData(prev => prev ? { ...prev, alerts: prev.alerts.filter(a => a.id !== id) } : prev)
    } catch {
      setErr('Connection dropped — try again.')
    } finally {
      setBusyId(null)
    }
  }

  const cardStyle = { background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }
  const labelCls = 'text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider'

  const score = data?.current_score ?? null
  const trend = data?.score_trend ?? []
  const alerts = data?.alerts ?? []
  const counts = data?.counts ?? { staffing_recs: 0, interviews_week: 0, candidates_active: 0 }

  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-5xl mx-auto">
        <Link
          href="/"
          className="font-black text-xl tracking-tighter"
          style={{
            background: 'linear-gradient(135deg, #22D3EE, #A78BFA)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          shapi
        </Link>
        <Link href="/company/dashboard" className="text-[#A6A6B4] text-sm hover:text-[#F4F4F7]">
          ← Dashboard
        </Link>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-20">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-2" style={{ color: '#FB7185' }}>
              Workforce OS — live
            </h1>
            <p className="text-[#A6A6B4] text-sm max-w-2xl">
              Continuous monitoring of your team&apos;s future-readiness. Drift alerts when something changes.
            </p>
          </div>
          <span
            className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5"
            style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399', border: '1px solid rgba(52,211,153,0.30)' }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#34D399' }} />
            Live
          </span>
        </div>

        {err && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(245,142,154,0.08)', border: '1px solid rgba(245,142,154,0.25)' }}>
            <p className="text-[#F58E9A] text-sm">{err}</p>
          </div>
        )}

        {loading ? (
          <p className="text-[#7E7E8E] text-sm">Loading your Workforce OS…</p>
        ) : (
          <div className="space-y-4">

            {/* ── Hero: current readiness ring + trend sparkline ─────────── */}
            <div className="rounded-2xl p-6 flex items-center gap-6 flex-wrap" style={cardStyle}>
              {score === null ? (
                <div className="flex-1 min-w-0">
                  <p className={`${labelCls} mb-2`}>No Workforce Snapshot yet</p>
                  <p className="text-[#C7C7D1] text-sm leading-relaxed mb-3">
                    Run your first Workforce Snapshot to seed the OS. The score, sub-scores, AI risk heatmap and
                    quick-wins all flow back here automatically — and drift alerts start watching the moment you have
                    two snapshots on file.
                  </p>
                  <Link
                    href="/company/workforce-snapshot"
                    className="inline-block text-xs font-black px-4 py-2 rounded-full text-white"
                    style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}
                  >
                    Run Workforce Snapshot →
                  </Link>
                </div>
              ) : (
                <>
                  <div className="relative flex-shrink-0 w-28 h-28">
                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                      <circle cx="56" cy="56" r="48" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="10" />
                      <circle
                        cx="56" cy="56" r="48" fill="none"
                        stroke={scoreColor(score)}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 48}
                        strokeDashoffset={2 * Math.PI * 48 * (1 - score / 100)}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-black" style={{ color: scoreColor(score) }}>{score}</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`${labelCls} mb-1`}>Workforce Future Readiness Score</p>
                    <p className="text-[#F4F4F7] text-base font-black mb-2">
                      {score >= 70 ? 'On track' : score >= 40 ? 'Needs attention' : 'High risk'}
                    </p>
                    <TrendSparkline points={trend} />
                    <p className="text-[#7E7E8E] text-[11px] mt-2 leading-relaxed">
                      70%-confidence read. Drivers: snapshot inputs, market shifts, your platform activity.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* ── Open alerts ────────────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className={labelCls}>Open alerts</p>
                <span className="text-[#7E7E8E] text-[11px]">{alerts.length} open</span>
              </div>
              {alerts.length === 0 ? (
                <div className="rounded-2xl p-5" style={cardStyle}>
                  <p className="text-[#C7C7D1] text-sm leading-relaxed">
                    Nothing&apos;s drifted. The OS keeps watching — you&apos;ll see a card here the moment readiness slips,
                    a role&apos;s AI exposure shifts, or your team load crosses capacity.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map(a => {
                    const sev = (a.severity || 'info').toLowerCase()
                    const s = SEVERITY_STYLE[sev] || SEVERITY_STYLE.info
                    const kindKey = (a.kind || '').toLowerCase()
                    const kindLabel = KIND_LABEL[kindKey] || (a.kind || 'Signal')
                    const isBusy = busyId === a.id
                    const showDelta =
                      typeof a.metric_before === 'number' && typeof a.metric_after === 'number'
                    return (
                      <div
                        key={a.id}
                        className="rounded-2xl p-5"
                        style={{ background: s.bg, border: `1px solid ${s.border}` }}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider"
                              style={{ background: `${s.color}26`, color: s.color }}
                            >
                              {s.label}
                            </span>
                            <span
                              className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(255,255,255,0.06)', color: '#C7C7D1' }}
                            >
                              {kindLabel}
                            </span>
                          </div>
                          {showDelta && (
                            <span className="text-[11px] text-[#A6A6B4]">
                              <span className="text-[#7E7E8E]">{a.metric_before}</span>
                              <span className="mx-1.5">→</span>
                              <span className="font-black" style={{ color: s.color }}>{a.metric_after}</span>
                            </span>
                          )}
                        </div>

                        {a.title && (
                          <p className="text-[#F4F4F7] font-bold text-base mb-2 leading-snug">{a.title}</p>
                        )}
                        {a.detail && (
                          <p className="text-[#C7C7D1] text-sm leading-relaxed mb-3">{a.detail}</p>
                        )}

                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.08] flex-wrap">
                          <p className="text-[#7E7E8E] text-[10px]">
                            Triggered {new Date(a.triggered_at).toLocaleString()}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateAlertStatus(a.id, 'acked')}
                              disabled={isBusy}
                              className="text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-40"
                              style={{
                                background: 'rgba(106,168,245,0.12)',
                                color: '#6AA8F5',
                                border: '1px solid rgba(106,168,245,0.30)',
                              }}
                            >
                              {isBusy ? '…' : 'Ack'}
                            </button>
                            <button
                              onClick={() => updateAlertStatus(a.id, 'resolved')}
                              disabled={isBusy}
                              className="text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-40"
                              style={{
                                background: 'rgba(52,211,153,0.12)',
                                color: '#34D399',
                                border: '1px solid rgba(52,211,153,0.30)',
                              }}
                            >
                              {isBusy ? '…' : 'Resolve'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Live counts strip ─────────────────────────────────────── */}
            <div>
              <p className={`${labelCls} mb-2`}>Live counts</p>
              <div className="grid grid-cols-3 gap-2">
                <Link
                  href="/company/staffing"
                  className="rounded-2xl p-4 hover:bg-white/[0.02] transition-colors"
                  style={cardStyle}
                >
                  <p className="text-[10px] text-[#A6A6B4]">Staffing recs open</p>
                  <p className="text-2xl font-black mt-1" style={{ color: '#F08CAE' }}>{counts.staffing_recs}</p>
                </Link>
                <div className="rounded-2xl p-4" style={cardStyle}>
                  <p className="text-[10px] text-[#A6A6B4]">Interviews this week</p>
                  <p className="text-2xl font-black mt-1" style={{ color: '#6AA8F5' }}>{counts.interviews_week}</p>
                </div>
                <div className="rounded-2xl p-4" style={cardStyle}>
                  <p className="text-[10px] text-[#A6A6B4]">Candidates active</p>
                  <p className="text-2xl font-black mt-1" style={{ color: '#34D399' }}>{counts.candidates_active}</p>
                </div>
              </div>
            </div>

            {/* ── HRIS integration coming soon ──────────────────────────── */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div>
                  <p className={`${labelCls} mb-1`}>HRIS integration</p>
                  <p className="text-[#F4F4F7] text-sm font-bold">Pipe live headcount, comp bands, exits and openings straight into the OS.</p>
                </div>
                <span
                  className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider"
                  style={{ background: 'rgba(251,191,36,0.12)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.30)' }}
                >
                  Enterprise beta
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {['Workday', 'BambooHR', 'Personio', 'Rippling'].map(name => (
                  <div
                    key={name}
                    className="rounded-lg px-3 py-3 text-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <p className="text-[#C7C7D1] text-xs font-bold">{name}</p>
                    <p className="text-[#7E7E8E] text-[10px] mt-0.5">Coming soon</p>
                  </div>
                ))}
              </div>
              <a
                href="mailto:ana.vbarber@gmail.com?subject=Shapi%20Workforce%20OS%20-%20enterprise%20beta%20invite"
                className="inline-block text-xs font-black px-4 py-2 rounded-full text-white"
                style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}
              >
                Request invite to enterprise beta →
              </a>
              <p className="text-[#7E7E8E] text-[11px] mt-3 leading-relaxed">
                Drivers for the beta queue: HRIS in use, headcount, geographic spread. We let in 10 companies at a time so each integration ships clean.
              </p>
            </div>

            {/* ── Sources footer ─────────────────────────────────────────── */}
            <p className="text-[#7E7E8E] text-[10px] leading-relaxed pt-2 text-center">
              Synthesised from your Workforce Snapshot history + staffing recommendations + interview activity.
              Sources: <span className="text-[#A6A6B4]">Mercer · Glassdoor · Anthropic/OpenAI published API pricing · Shapi platform data.</span>
            </p>

          </div>
        )}
      </div>
    </div>
  )
}
