'use client'

import { useState } from 'react'
import Link from 'next/link'
import SpinePrefillBanner, { useSpinePrefill } from '@/components/SpinePrefillBanner'

type Stage = 'pre-seed' | 'seed' | 'series-a' | 'growth' | 'enterprise'

type Hire = {
  role?: string
  why?: string
  level?: 'junior' | 'mid' | 'senior' | string
  perm_or_temp?: 'perm' | 'temp' | 'fractional' | string
}

type Plan = {
  summary?: string
  perm_vs_temp_vs_fractional?: {
    perm_pct?: number
    temp_pct?: number
    fractional_pct?: number
    why?: string
  }
  next_3_hires?: Hire[]
  monthly_comp_estimate?: {
    currency?: string
    low?: number
    high?: number
    note?: string
  }
  risks_to_watch?: string[]
  quick_wins?: string[]
}

const STAGES: { value: Stage; label: string }[] = [
  { value: 'pre-seed', label: 'Pre-seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series-a', label: 'Series A' },
  { value: 'growth', label: 'Growth' },
  { value: 'enterprise', label: 'Enterprise' },
]

export default function HiringPlanPage() {
  const [industry, setIndustry] = useState('')
  const [country, setCountry] = useState('')
  const [stage, setStage] = useState<Stage>('seed')
  const [burn, setBurn] = useState('')
  const [headcount, setHeadcount] = useState('')

  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  // Planned/vacant seats from the spine — the company's own hiring list. Sent
  // to the API so the plan sequences THESE rather than inventing roles.
  const [plannedHires, setPlannedHires] = useState('')

  // Spine pre-fill — same pattern as Workforce Snapshot. industry/country/
  // headcount derive cleanly from the spine. Burn + stage stay manual
  // (we don't track those yet). Planned/vacant seats feed the hiring list so
  // we sequence roles the company already decided to fill (the spine IS the
  // roadmap) instead of asking them to retype roles.
  const { spine, applied: spineApplied, apply: applySpine } = useSpinePrefill()
  const handleApplySpine = () => {
    if (!spine) return
    if (spine.industry) setIndustry(spine.industry)
    if (spine.country) setCountry(spine.country)
    if (spine.counts.activeSeats > 0) setHeadcount(String(spine.counts.activeSeats))
    if (spine.openSeats && spine.openSeats.length > 0) {
      setPlannedHires(
        spine.openSeats
          .map(s => `${s.seniority ? `${s.seniority} ` : ''}${s.title}${s.dept ? ` · ${s.dept}` : ''} [${s.status}]`)
          .join(', ')
      )
    }
    applySpine()
  }

  const submit = async () => {
    if (!industry.trim() || !country.trim()) {
      setErr('Add your industry and country first.')
      return
    }
    setLoading(true); setErr(''); setPlan(null)
    try {
      const payload: Record<string, unknown> = {
        industry: industry.trim(),
        country: country.trim(),
        stage,
      }
      const burnN = parseFloat(burn)
      if (!isNaN(burnN) && burnN > 0) payload.monthly_burn_budget = burnN
      const hcN = parseInt(headcount, 10)
      if (!isNaN(hcN) && hcN >= 0) payload.headcount_today = hcN
      if (plannedHires.trim()) payload.planned_hires = plannedHires.trim()

      const res = await fetch('/api/company/hiring-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      // Defensive parse — Vercel timeouts return HTML, not JSON.
      const raw = await res.text()
      let d: { plan?: Plan; error?: string } = {}
      try { d = JSON.parse(raw) } catch {
        setErr((res.status === 504 || /timeout|gateway/i.test(raw))
          ? 'Took too long — tap again, it usually works on the second try.'
          : `Server error (${res.status}) — try again in a moment.`)
        return
      }
      if (!res.ok || !d.plan) { setErr(d.error || 'Could not build that plan'); return }
      setPlan(d.plan)
    } catch {
      setErr('Connection dropped — try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full mt-1 rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50'
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
  const labelCls = 'text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider'
  const cardStyle = { background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 })

  const split = plan?.perm_vs_temp_vs_fractional
  const perm = Math.max(0, Math.min(100, split?.perm_pct ?? 0))
  const temp = Math.max(0, Math.min(100, split?.temp_pct ?? 0))
  const fractional = Math.max(0, Math.min(100, split?.fractional_pct ?? 0))

  const hireLevelColor = (level?: string) => {
    const l = (level || '').toLowerCase()
    if (l === 'senior') return '#F08CAE'
    if (l === 'mid') return '#6AA8F5'
    return '#34D399' // junior / default
  }
  const modeColor = (mode?: string) => {
    const m = (mode || '').toLowerCase()
    if (m === 'perm') return '#6AA8F5'
    if (m === 'temp') return '#FBBF24'
    if (m === 'fractional') return '#F08CAE'
    return '#7E7E8E'
  }

  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-4xl mx-auto">
        <Link
          href="/"
          className="font-black text-xl tracking-tighter"
          style={{
            background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)',
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

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">
        <h1
          className="text-3xl md:text-4xl font-black tracking-tighter mb-2"
          style={{ color: '#FB7185' }}
        >
          Plan your hiring
        </h1>
        <p className="text-[#A6A6B4] text-sm mb-6">
          Tell us your industry, country, stage and budget — we&apos;ll return a perm/temp/fractional split, the next 3 hires, and a 70%-confidence monthly comp band.
        </p>

        <SpinePrefillBanner
          spine={spine}
          applied={spineApplied}
          onApply={handleApplySpine}
          fieldsLabel="Industry, country, and current headcount"
        />

        {/* Inputs */}
        <div className="rounded-2xl p-5 mb-6" style={cardStyle}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Industry</label>
              <input
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                placeholder="e.g. fintech, e-commerce, healthtech"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder="e.g. UAE, UK, USA"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className={labelCls}>Stage</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {STAGES.map(s => {
                const active = stage === s.value
                return (
                  <button
                    key={s.value}
                    onClick={() => setStage(s.value)}
                    className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                    style={
                      active
                        ? {
                            background: 'rgba(106,168,245,0.15)',
                            color: '#6AA8F5',
                            border: '1px solid rgba(106,168,245,0.45)',
                          }
                        : {
                            background: 'rgba(255,255,255,0.05)',
                            color: '#A6A6B4',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }
                    }
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <div>
              <label className={labelCls}>Monthly burn budget (optional)</label>
              <input
                value={burn}
                onChange={e => setBurn(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 60000"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls}>Headcount today (optional)</label>
              <input
                value={headcount}
                onChange={e => setHeadcount(e.target.value)}
                inputMode="numeric"
                placeholder="e.g. 6"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Planned hires from the spine — shown only once the user pulls in
              their org spine and it has open (planned/vacant) seats. Editable
              so they can trim or add before generating. This list IS their
              hiring roadmap; the plan sequences it instead of inventing roles. */}
          {spineApplied && plannedHires && (
            <div className="mt-4">
              <label className={labelCls}>
                On your hiring roadmap{' '}
                <span className="text-[#34D399] normal-case font-bold">· from your org spine</span>
              </label>
              <textarea
                value={plannedHires}
                onChange={e => setPlannedHires(e.target.value)}
                rows={2}
                className={inputCls}
                style={inputStyle}
              />
              <p className="text-[#7E7E8E] text-[11px] mt-1">Planned / vacant seats from your spine. We&apos;ll sequence these — edit to trim or add.</p>
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading || !industry.trim() || !country.trim()}
            className="mt-5 w-full sm:w-auto px-6 py-3 rounded-full font-black text-sm text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}
          >
            {loading ? 'Building your plan…' : '🚀 Plan my next hires'}
          </button>
          {err && <p className="text-[#F58E9A] text-xs mt-3">{err}</p>}
        </div>

        {plan && (
          <div className="space-y-5">
            {/* Summary */}
            {plan.summary && (
              <div
                className="rounded-2xl p-5"
                style={{
                  background: 'rgba(240,140,174,0.10)',
                  border: '1px solid rgba(240,140,174,0.30)',
                }}
              >
                <p className="text-[#F08CAE] text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  Shapi&apos;s read
                </p>
                <p className="text-[#F4F4F7] text-sm leading-relaxed">{plan.summary}</p>
              </div>
            )}

            {/* Perm / Temp / Fractional split */}
            {split && (
              <div className="rounded-2xl p-5" style={cardStyle}>
                <p className={`${labelCls} mb-3`}>⚖️ Perm / temp / fractional split</p>

                {/* Stacked bar */}
                <div
                  className="flex w-full h-3 rounded-full overflow-hidden mb-4"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <div style={{ width: `${perm}%`, background: '#6AA8F5' }} />
                  <div style={{ width: `${temp}%`, background: '#FBBF24' }} />
                  <div style={{ width: `${fractional}%`, background: '#F08CAE' }} />
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: 'rgba(106,168,245,0.10)',
                      border: '1px solid rgba(106,168,245,0.25)',
                    }}
                  >
                    <p className={labelCls}>Perm</p>
                    <p className="text-sm font-black mt-0.5" style={{ color: '#6AA8F5' }}>
                      {perm}%
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: 'rgba(251,191,36,0.10)',
                      border: '1px solid rgba(251,191,36,0.25)',
                    }}
                  >
                    <p className={labelCls}>Temp</p>
                    <p className="text-sm font-black mt-0.5" style={{ color: '#FBBF24' }}>
                      {temp}%
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: 'rgba(240,140,174,0.10)',
                      border: '1px solid rgba(240,140,174,0.25)',
                    }}
                  >
                    <p className={labelCls}>Fractional</p>
                    <p className="text-sm font-black mt-0.5" style={{ color: '#F08CAE' }}>
                      {fractional}%
                    </p>
                  </div>
                </div>

                {split.why && (
                  <p className="text-[#A6A6B4] text-xs leading-relaxed">{split.why}</p>
                )}
              </div>
            )}

            {/* Next 3 hires */}
            {plan.next_3_hires && plan.next_3_hires.length > 0 && (
              <div>
                <p className={`${labelCls} mb-2`}>🎯 Your next 3 hires</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {plan.next_3_hires.slice(0, 3).map((h, i) => {
                    const lc = hireLevelColor(h.level)
                    const mc = modeColor(h.perm_or_temp)
                    return (
                      <div key={i} className="rounded-2xl p-4" style={cardStyle}>
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase"
                            style={{ background: `${lc}26`, color: lc }}
                          >
                            {h.level || 'mid'}
                          </span>
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase"
                            style={{ background: `${mc}26`, color: mc }}
                          >
                            {h.perm_or_temp || 'perm'}
                          </span>
                        </div>
                        <p className="text-[#F4F4F7] font-bold text-sm mb-1">{h.role}</p>
                        {h.why && (
                          <p className="text-[#A6A6B4] text-xs leading-relaxed">{h.why}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Monthly comp */}
            {plan.monthly_comp_estimate && (
              <div
                className="rounded-2xl p-5"
                style={{
                  background: 'rgba(106,168,245,0.08)',
                  border: '1px solid rgba(106,168,245,0.25)',
                }}
              >
                <p className="text-[#6AA8F5] text-[10px] font-bold uppercase tracking-wider mb-2">
                  💸 Monthly comp burden — 70% confidence band (3 hires combined)
                </p>
                <p className="text-2xl md:text-3xl font-black tracking-tighter text-[#F4F4F7]">
                  {plan.monthly_comp_estimate.currency || '$'}{' '}
                  {fmt(plan.monthly_comp_estimate.low ?? 0)}
                  <span className="text-[#7E7E8E] mx-2">–</span>
                  {plan.monthly_comp_estimate.currency || '$'}{' '}
                  {fmt(plan.monthly_comp_estimate.high ?? 0)}
                </p>
                {plan.monthly_comp_estimate.note && (
                  <p className="text-[#A6A6B4] text-xs mt-2">
                    {plan.monthly_comp_estimate.note}
                  </p>
                )}
                <p className="text-[#7E7E8E] text-[10px] mt-3 leading-relaxed">
                  Sources: <span className="text-[#A6A6B4]">Mercer · PayScale · Numbeo cost-of-living · Glassdoor public ratings · Shapi platform data</span>
                </p>
              </div>
            )}

            {/* Risks + quick wins */}
            {((plan.risks_to_watch?.length ?? 0) > 0 ||
              (plan.quick_wins?.length ?? 0) > 0) && (
              <div className="grid sm:grid-cols-2 gap-3">
                {plan.risks_to_watch && plan.risks_to_watch.length > 0 && (
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: 'rgba(245,142,154,0.08)',
                      border: '1px solid rgba(245,142,154,0.20)',
                    }}
                  >
                    <p className="text-[#F58E9A] text-[10px] font-bold uppercase tracking-wider mb-2">
                      ⚠️ Risks to watch
                    </p>
                    <ul className="space-y-1.5">
                      {plan.risks_to_watch.map((r, i) => (
                        <li key={i} className="text-[#C7C7D1] text-xs flex gap-2">
                          <span style={{ color: '#F58E9A' }}>•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {plan.quick_wins && plan.quick_wins.length > 0 && (
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: 'rgba(52,211,153,0.08)',
                      border: '1px solid rgba(52,211,153,0.20)',
                    }}
                  >
                    <p className="text-[#34D399] text-[10px] font-bold uppercase tracking-wider mb-2">
                      ⚡ Quick wins
                    </p>
                    <ul className="space-y-1.5">
                      {plan.quick_wins.map((w, i) => (
                        <li key={i} className="text-[#C7C7D1] text-xs flex gap-2">
                          <span style={{ color: '#34D399' }}>•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <p className="text-[#7E7E8E] text-[10px] leading-relaxed pt-2 border-t border-white/[0.08]">
              Sources: <span className="text-[#A6A6B4]">Mercer · PayScale · Numbeo cost-of-living · Glassdoor public ratings · government labour statistics · Shapi platform data</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
