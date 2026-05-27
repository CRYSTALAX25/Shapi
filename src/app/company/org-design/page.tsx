'use client'

// Target-State Org Design — Tier B premium deliverable (STRATEGY §16).
//
// CEO/COO inputs: current team composition, strategy, AI integration plan
// (+ optional growth target + country). AI returns a target operating model:
// teams, headcount glide path, dependencies, growth milestones, risks and a
// 70%-confidence cost envelope.

import { useState } from 'react'
import Link from 'next/link'

type TargetTeam = {
  team?: string
  purpose?: string
  headcount?: { now?: number; year_1?: number; year_2?: number }
  roles?: string[]
  reports_to?: string
}
type Dependency = { from?: string; to?: string; why?: string }
type CostEnvelope = {
  y1_low?: number
  y1_high?: number
  y2_low?: number
  y2_high?: number
  currency?: string
  drivers?: string[]
}
type OrgDesign = {
  summary?: string
  target_org?: TargetTeam[]
  dependencies?: Dependency[]
  growth_path?: { y1?: string[]; y2?: string[] }
  risk_areas?: string[]
  cost_envelope?: CostEnvelope
  sources?: string
}

function formatMoney(n: number | undefined, currency: string): string {
  if (typeof n !== 'number' || !isFinite(n)) return '—'
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${currency} ${Math.round(n / 1000)}k`
  return `${currency} ${n}`
}

export default function OrgDesignPage() {
  const [currentTeam, setCurrentTeam] = useState('')
  const [strategy, setStrategy] = useState('')
  const [aiPlan, setAiPlan] = useState('')
  const [growthTarget, setGrowthTarget] = useState('')
  const [country, setCountry] = useState('')

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [design, setDesign] = useState<OrgDesign | null>(null)

  const run = async () => {
    if (!currentTeam.trim() || !strategy.trim() || !aiPlan.trim()) {
      setErr('Current team, strategy and AI integration plan are required.')
      return
    }
    setLoading(true); setErr(''); setDesign(null)
    try {
      const res = await fetch('/api/company/org-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_team_composition: currentTeam.trim(),
          strategy: strategy.trim(),
          ai_integration_plan: aiPlan.trim(),
          growth_target: growthTarget.trim() || undefined,
          country: country.trim() || undefined,
        }),
      })
      // Defensive parsing — a 504 returns HTML, not JSON.
      const raw = await res.text()
      let d: { success?: boolean; design?: OrgDesign; error?: string } = {}
      try { d = JSON.parse(raw) } catch {
        setErr((res.status === 504 || /timeout|gateway/i.test(raw))
          ? 'The org design took too long to generate — tap again, it usually works on the second try.'
          : `Server error (${res.status}) — try again in a moment.`)
        return
      }
      if (!res.ok || !d.design) {
        setErr(d.error || 'Could not build the org design. Try again.')
        return
      }
      setDesign(d.design)
    } catch {
      setErr('Connection dropped — try again.')
    } finally {
      setLoading(false)
    }
  }

  const cardStyle = { background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }
  const labelCls = 'text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider'
  const inputCls = 'w-full mt-1 rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50'
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }

  const currency = design?.cost_envelope?.currency || 'USD'

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
          Target-state org design
        </h1>
        <p className="text-[#A6A6B4] text-sm mb-6 max-w-2xl">
          Given where you&apos;re going + how AI fits, here&apos;s the team you&apos;ll need by year 2.
        </p>

        {!design && (
          <div className="space-y-4">
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className={`${labelCls} mb-3`}>1 — Your team today</p>
              <p className="text-[#7E7E8E] text-[11px] mb-2">Roles + counts. No names, no salaries.</p>
              <textarea
                value={currentTeam}
                onChange={e => setCurrentTeam(e.target.value)}
                placeholder="e.g. 8 engineers, 2 designers, 1 PM, 3 sales, 1 ops lead. CEO + CTO."
                rows={4}
                className={inputCls}
                style={inputStyle}
              />
            </div>

            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className={`${labelCls} mb-3`}>2 — Strategy (where you&apos;re going)</p>
              <textarea
                value={strategy}
                onChange={e => setStrategy(e.target.value)}
                placeholder="e.g. Launch in UAE Q3, hit $5M ARR by end of year 2, expand to KSA + Egypt. B2B SaaS, enterprise mid-market."
                rows={4}
                className={inputCls}
                style={inputStyle}
              />
            </div>

            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className={`${labelCls} mb-3`}>3 — AI integration plan (how AI fits)</p>
              <textarea
                value={aiPlan}
                onChange={e => setAiPlan(e.target.value)}
                placeholder="e.g. AI handles tier-1 support + analytics; engineering uses Claude Code at 70% adoption; sales uses AI SDR for outbound; ops stays human."
                rows={4}
                className={inputCls}
                style={inputStyle}
              />
            </div>

            <div className="rounded-2xl p-5" style={cardStyle}>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Growth target (optional)</label>
                  <input
                    value={growthTarget}
                    onChange={e => setGrowthTarget(e.target.value)}
                    placeholder="e.g. $5M ARR by year 2 / 40-person team"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className={labelCls}>Country (optional)</label>
                  <input
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    placeholder="e.g. UAE, Saudi Arabia, UK"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {err && <p className="text-[#FB7185] text-sm">{err}</p>}

            <button
              onClick={run}
              disabled={loading || !currentTeam.trim() || !strategy.trim() || !aiPlan.trim()}
              className="w-full py-4 rounded-full font-black text-white text-sm disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE, #FB7185)' }}
            >
              {loading ? 'Designing your year-2 org…' : 'Design my target org →'}
            </button>
            <p className="text-[#7E7E8E] text-[11px] text-center">
              ~30 seconds. 70%-confidence cost bands. Variance drivers named in-text.
            </p>
          </div>
        )}

        {design && (
          <div className="space-y-5">
            {/* Hero summary */}
            <div className="rounded-2xl p-6" style={{
              background: 'linear-gradient(135deg, rgba(106,168,245,0.10), rgba(240,140,174,0.10))',
              border: '1px solid rgba(240,140,174,0.30)',
            }}>
              <p className={`${labelCls} mb-2`}>The honest read</p>
              <p className="text-[#F4F4F7] text-lg leading-snug font-bold">
                {design.summary || '—'}
              </p>
            </div>

            {/* Target org — one card per team */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className={`${labelCls} mb-3`}>1 — Target org</p>
              {(design.target_org?.length ?? 0) === 0 ? (
                <p className="text-[#7E7E8E] text-xs">No teams returned.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {design.target_org!.map((t, i) => {
                    const hc = t.headcount || {}
                    return (
                      <div
                        key={i}
                        className="rounded-xl p-4"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-[#F4F4F7] font-black text-sm">{t.team || '—'}</p>
                          {t.reports_to && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{ background: 'rgba(106,168,245,0.15)', color: '#6AA8F5' }}
                            >
                              ↗ {t.reports_to}
                            </span>
                          )}
                        </div>
                        {t.purpose && (
                          <p className="text-[#A6A6B4] text-xs leading-relaxed mb-3">{t.purpose}</p>
                        )}

                        {/* Inline headcount stat bar */}
                        <div className="flex items-center gap-1 mb-3">
                          {[
                            { label: 'Now', value: hc.now },
                            { label: 'Y1', value: hc.year_1 },
                            { label: 'Y2', value: hc.year_2 },
                          ].map((s, j) => (
                            <div
                              key={j}
                              className="flex-1 rounded-lg px-2 py-1.5 text-center"
                              style={{
                                background: j === 2 ? 'rgba(251,113,133,0.12)' : 'rgba(255,255,255,0.04)',
                                border: j === 2 ? '1px solid rgba(251,113,133,0.30)' : '1px solid rgba(255,255,255,0.06)',
                              }}
                            >
                              <p className="text-[9px] text-[#7E7E8E] font-bold uppercase tracking-wider">{s.label}</p>
                              <p
                                className="text-base font-black"
                                style={{ color: j === 2 ? '#FB7185' : '#F4F4F7' }}
                              >
                                {typeof s.value === 'number' ? s.value : '—'}
                              </p>
                            </div>
                          ))}
                        </div>

                        {(t.roles?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {t.roles!.map((r, k) => (
                              <span
                                key={k}
                                className="text-[10px] px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(167,139,250,0.12)', color: '#A78BFA' }}
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Dependencies — arrow rows */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className={`${labelCls} mb-3`}>2 — Inter-team dependencies</p>
              {(design.dependencies?.length ?? 0) === 0 ? (
                <p className="text-[#7E7E8E] text-xs">No dependencies returned.</p>
              ) : (
                <div className="space-y-2">
                  {design.dependencies!.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-lg p-3"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(34,211,238,0.15)', color: '#22D3EE' }}
                        >
                          {d.from || '—'}
                        </span>
                        <span className="text-[#7E7E8E] text-sm">→</span>
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(167,139,250,0.15)', color: '#A78BFA' }}
                        >
                          {d.to || '—'}
                        </span>
                      </div>
                      {d.why && <p className="text-[#A6A6B4] text-xs leading-relaxed">{d.why}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Growth path — 2 columns */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className={`${labelCls} mb-3`}>3 — Growth path</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'rgba(106,168,245,0.08)', border: '1px solid rgba(106,168,245,0.25)' }}
                >
                  <p className="text-[#6AA8F5] text-xs font-black uppercase tracking-wider mb-2">Year 1</p>
                  <ul className="space-y-1.5">
                    {(design.growth_path?.y1 ?? []).map((m, i) => (
                      <li key={i} className="flex gap-2 text-[#C7C7D1] text-xs leading-relaxed">
                        <span className="text-[#6AA8F5]">→</span>
                        <span>{m}</span>
                      </li>
                    ))}
                    {(design.growth_path?.y1?.length ?? 0) === 0 && (
                      <li className="text-[#7E7E8E] text-xs">No Y1 milestones returned.</li>
                    )}
                  </ul>
                </div>
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.25)' }}
                >
                  <p className="text-[#FB7185] text-xs font-black uppercase tracking-wider mb-2">Year 2</p>
                  <ul className="space-y-1.5">
                    {(design.growth_path?.y2 ?? []).map((m, i) => (
                      <li key={i} className="flex gap-2 text-[#C7C7D1] text-xs leading-relaxed">
                        <span className="text-[#FB7185]">→</span>
                        <span>{m}</span>
                      </li>
                    ))}
                    {(design.growth_path?.y2?.length ?? 0) === 0 && (
                      <li className="text-[#7E7E8E] text-xs">No Y2 milestones returned.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Risks */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className={`${labelCls} mb-3`}>4 — Risk areas</p>
              {(design.risk_areas?.length ?? 0) === 0 ? (
                <p className="text-[#7E7E8E] text-xs">No risks returned.</p>
              ) : (
                <ul className="space-y-2">
                  {design.risk_areas!.map((r, i) => (
                    <li
                      key={i}
                      className="rounded-lg p-3 flex gap-3 items-start"
                      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.20)' }}
                    >
                      <span className="text-[#FBBF24] text-sm flex-shrink-0">⚠</span>
                      <p className="text-[#C7C7D1] text-xs leading-relaxed">{r}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Cost envelope */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className={`${labelCls} mb-3`}>5 — Cost envelope (fully-loaded, 70% confidence band)</p>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <div
                  className="rounded-xl p-4 text-center"
                  style={{ background: 'rgba(106,168,245,0.08)', border: '1px solid rgba(106,168,245,0.25)' }}
                >
                  <p className="text-[10px] text-[#7E7E8E] font-bold uppercase tracking-wider mb-1">Year 1</p>
                  <p className="text-xl md:text-2xl font-black" style={{ color: '#6AA8F5' }}>
                    {formatMoney(design.cost_envelope?.y1_low, currency)} – {formatMoney(design.cost_envelope?.y1_high, currency)}
                  </p>
                </div>
                <div
                  className="rounded-xl p-4 text-center"
                  style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.25)' }}
                >
                  <p className="text-[10px] text-[#7E7E8E] font-bold uppercase tracking-wider mb-1">Year 2</p>
                  <p className="text-xl md:text-2xl font-black" style={{ color: '#FB7185' }}>
                    {formatMoney(design.cost_envelope?.y2_low, currency)} – {formatMoney(design.cost_envelope?.y2_high, currency)}
                  </p>
                </div>
              </div>
              {(design.cost_envelope?.drivers?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider mb-1.5">Variance drivers</p>
                  <ul className="space-y-1">
                    {design.cost_envelope!.drivers!.map((d, i) => (
                      <li key={i} className="text-[#C7C7D1] text-xs leading-relaxed flex gap-2">
                        <span className="text-[#A78BFA]">·</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Sources footer */}
            <p className="text-[#7E7E8E] text-[10px] leading-relaxed">
              Sources: <span className="text-[#A6A6B4]">{design.sources || 'Mercer / Glassdoor / Anthropic+OpenAI published API pricing / Shapi platform data'}</span>
            </p>

            <button
              onClick={() => { setDesign(null); setErr('') }}
              className="w-full py-3 rounded-full font-bold text-sm border border-white/[0.12] text-[#C7C7D1] hover:bg-white/[0.04]"
            >
              Run another design
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
