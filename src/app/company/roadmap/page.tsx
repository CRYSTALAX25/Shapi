'use client'

import { useState } from 'react'
import Link from 'next/link'

type HiringPriority = { role?: string; why?: string; urgency?: string }
type ReskillVsHire = { skill?: string; recommendation?: 'reskill' | 'hire' | string; why?: string }
type AiRisk = { role_or_function?: string; risk?: 'low' | 'medium' | 'high' | string; why?: string; action?: string }
type Step = { step?: string }
type Roadmap = {
  hiring_priorities?: HiringPriority[]
  reskill_vs_hire?: ReskillVsHire[]
  ai_risk?: AiRisk[]
  next_90_days?: Step[]
  generated_at?: string
}

const URGENCY_COLOR: Record<string, string> = {
  'now': '#FB7185',
  'next quarter': '#FBBF24',
  'next 6-12 months': '#22D3EE',
}

const RISK_COLOR: Record<string, string> = {
  low: '#34D399',
  medium: '#FBBF24',
  high: '#FB7185',
}

export default function CompanyRoadmap() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const generate = async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/company/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      // Defensive parsing — a 504 returns HTML, not JSON.
      const raw = await res.text()
      let d: { success?: boolean; roadmap?: Roadmap; error?: string } = {}
      try { d = JSON.parse(raw) } catch {
        setErr((res.status === 504 || /timeout|gateway/i.test(raw))
          ? 'The roadmap took too long to generate — tap again, it usually works on the second try.'
          : `Server error (${res.status}) — try again in a moment.`)
        return
      }
      if (!res.ok || !d.roadmap) {
        setErr(d.error || 'Could not build the roadmap. Try again.')
        return
      }
      setRoadmap(d.roadmap)
    } catch {
      setErr('Connection dropped — try again.')
    } finally {
      setLoading(false)
    }
  }

  const cardStyle = { background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }
  const labelCls = 'text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider'

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
        <h1
          className="text-3xl md:text-4xl font-black tracking-tighter mb-2"
          style={{ color: '#FB7185' }}
        >
          Hiring Roadmap
        </h1>
        <p className="text-[#A6A6B4] text-sm mb-6 max-w-2xl">
          A strategic read of who you should hire next, where to reskill instead, what AI risk you carry, and the next 90 days. Synthesised from your industry, your open roles, and Shapi&apos;s platform data.
        </p>

        {!roadmap && (
          <div className="rounded-2xl p-6 mb-6" style={cardStyle}>
            <p className="text-[#C7C7D1] text-sm mb-4 leading-relaxed">
              Generate a fresh roadmap from your company profile and your open roles. Takes ~30 seconds.
            </p>
            <button
              onClick={generate}
              disabled={loading}
              className="px-6 py-3 rounded-full font-black text-sm text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #22D3EE, #A78BFA)' }}
            >
              {loading ? 'Building your roadmap…' : 'Generate Hiring Roadmap'}
            </button>
            {err && <p className="text-[#FB7185] text-xs mt-3">{err}</p>}
          </div>
        )}

        {roadmap && (
          <div className="space-y-5">
            {/* 1. Hiring priorities */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className={`${labelCls} mb-3`}>1 — Hiring priorities</p>
              {(roadmap.hiring_priorities?.length ?? 0) === 0 ? (
                <p className="text-[#7E7E8E] text-xs">No priorities returned.</p>
              ) : (
                <div className="space-y-2.5">
                  {roadmap.hiring_priorities!.map((p, i) => {
                    const uc = URGENCY_COLOR[(p.urgency || '').toLowerCase()] || '#A6A6B4'
                    return (
                      <div
                        key={i}
                        className="rounded-xl p-3.5"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className="text-[#F4F4F7] font-bold text-sm">{p.role || '—'}</p>
                          {p.urgency && (
                            <span
                              className="text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{ background: `${uc}26`, color: uc }}
                            >
                              {p.urgency}
                            </span>
                          )}
                        </div>
                        {p.why && <p className="text-[#A6A6B4] text-xs leading-relaxed">{p.why}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 2. Reskill vs hire */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className={`${labelCls} mb-3`}>2 — Reskill vs hire</p>
              {(roadmap.reskill_vs_hire?.length ?? 0) === 0 ? (
                <p className="text-[#7E7E8E] text-xs">No recommendations returned.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {roadmap.reskill_vs_hire!.map((r, i) => {
                    const isReskill = (r.recommendation || '').toLowerCase() === 'reskill'
                    const rc = isReskill ? '#34D399' : '#A78BFA'
                    const label = isReskill ? 'Reskill' : 'Hire'
                    return (
                      <div
                        key={i}
                        className="rounded-xl p-3.5"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: `${rc}26`, color: rc }}
                          >
                            {label}
                          </span>
                          <p className="text-[#F4F4F7] font-bold text-sm">{r.skill || '—'}</p>
                        </div>
                        {r.why && <p className="text-[#A6A6B4] text-xs leading-relaxed">{r.why}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 3. AI risk */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className={`${labelCls} mb-3`}>3 — AI risk in your team</p>
              {(roadmap.ai_risk?.length ?? 0) === 0 ? (
                <p className="text-[#7E7E8E] text-xs">No risk items returned.</p>
              ) : (
                <div className="space-y-2.5">
                  {roadmap.ai_risk!.map((a, i) => {
                    const rc = RISK_COLOR[(a.risk || '').toLowerCase()] || '#A6A6B4'
                    return (
                      <div
                        key={i}
                        className="rounded-xl p-3.5"
                        style={{ background: `${rc}10`, border: `1px solid ${rc}33` }}
                      >
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className="text-[#F4F4F7] font-bold text-sm">{a.role_or_function || '—'}</p>
                          {a.risk && (
                            <span
                              className="text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap uppercase"
                              style={{ background: `${rc}26`, color: rc }}
                            >
                              {a.risk} risk
                            </span>
                          )}
                        </div>
                        {a.why && <p className="text-[#A6A6B4] text-xs leading-relaxed mb-1.5">{a.why}</p>}
                        {a.action && (
                          <p className="text-xs leading-relaxed">
                            <span className="text-[#7E7E8E] font-bold">Action: </span>
                            <span className="text-[#C7C7D1]">{a.action}</span>
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 4. Next 90 days */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className={`${labelCls} mb-3`}>4 — Next 90 days</p>
              {(roadmap.next_90_days?.length ?? 0) === 0 ? (
                <p className="text-[#7E7E8E] text-xs">No steps returned.</p>
              ) : (
                <ol className="space-y-2">
                  {roadmap.next_90_days!.map((s, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black"
                        style={{ background: 'rgba(34,211,238,0.15)', color: '#22D3EE' }}
                      >
                        {i + 1}
                      </span>
                      <p className="text-[#C7C7D1] text-sm leading-relaxed pt-0.5">{s.step || '—'}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-[#7E7E8E] text-[11px]">
                {roadmap.generated_at
                  ? `Generated ${new Date(roadmap.generated_at).toLocaleString()}`
                  : 'Generated just now'}
                {' · '}Confidence-banded read; variance drivers flagged in-text.
              </p>
              <button
                onClick={generate}
                disabled={loading}
                className="text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-40"
                style={{
                  background: 'rgba(34,211,238,0.12)',
                  color: '#22D3EE',
                  border: '1px solid rgba(34,211,238,0.25)',
                }}
              >
                {loading ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
            <p className="text-[#7E7E8E] text-[10px] leading-relaxed">
              Sources: <span className="text-[#A6A6B4]">Mercer · Glassdoor public ratings · Anthropic/OpenAI published API pricing · BLS/government labour statistics · Shapi platform data</span>
            </p>
            {err && <p className="text-[#FB7185] text-xs">{err}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
