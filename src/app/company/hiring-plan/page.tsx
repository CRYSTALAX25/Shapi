'use client'

import { useState } from 'react'
import Link from 'next/link'

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
    'w-full mt-1 rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#FB7185]/50'
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
    if (l === 'senior') return '#A78BFA'
    if (l === 'mid') return '#22D3EE'
    return '#34D399' // junior / default
  }
  const modeColor = (mode?: string) => {
    const m = (mode || '').toLowerCase()
    if (m === 'perm') return '#22D3EE'
    if (m === 'temp') return '#FBBF24'
    if (m === 'fractional') return '#A78BFA'
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
            background: 'linear-gradient(135deg,#22D3EE,#A78BFA)',
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
          Tell us your industry, country, stage and rough budget — we&apos;ll suggest a perm/temp/fractional split, the next 3 hires, and an approx monthly comp burden.
        </p>

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
                            background: 'rgba(251,113,133,0.15)',
                            color: '#FB7185',
                            border: '1px solid rgba(251,113,133,0.45)',
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

          <button
            onClick={submit}
            disabled={loading || !industry.trim() || !country.trim()}
            className="mt-5 w-full sm:w-auto px-6 py-3 rounded-full font-black text-sm text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#22D3EE,#A78BFA)' }}
          >
            {loading ? 'Building your plan…' : '🚀 Plan my next hires'}
          </button>
          {err && <p className="text-[#FB7185] text-xs mt-3">{err}</p>}
        </div>

        {plan && (
          <div className="space-y-5">
            {/* Summary */}
            {plan.summary && (
              <div
                className="rounded-2xl p-5"
                style={{
                  background: 'rgba(251,113,133,0.10)',
                  border: '1px solid rgba(251,113,133,0.30)',
                }}
              >
                <p className="text-[#FB7185] text-[10px] font-bold uppercase tracking-wider mb-1.5">
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
                  <div style={{ width: `${perm}%`, background: '#22D3EE' }} />
                  <div style={{ width: `${temp}%`, background: '#FBBF24' }} />
                  <div style={{ width: `${fractional}%`, background: '#A78BFA' }} />
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: 'rgba(34,211,238,0.10)',
                      border: '1px solid rgba(34,211,238,0.25)',
                    }}
                  >
                    <p className={labelCls}>Perm</p>
                    <p className="text-sm font-black mt-0.5" style={{ color: '#22D3EE' }}>
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
                      background: 'rgba(167,139,250,0.10)',
                      border: '1px solid rgba(167,139,250,0.25)',
                    }}
                  >
                    <p className={labelCls}>Fractional</p>
                    <p className="text-sm font-black mt-0.5" style={{ color: '#A78BFA' }}>
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
                  background: 'rgba(34,211,238,0.08)',
                  border: '1px solid rgba(34,211,238,0.25)',
                }}
              >
                <p className="text-[#22D3EE] text-[10px] font-bold uppercase tracking-wider mb-2">
                  💸 Approx monthly comp burden (3 hires combined)
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
                    ⚠️ {plan.monthly_comp_estimate.note}
                  </p>
                )}
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
                      background: 'rgba(251,113,133,0.08)',
                      border: '1px solid rgba(251,113,133,0.20)',
                    }}
                  >
                    <p className="text-[#FB7185] text-[10px] font-bold uppercase tracking-wider mb-2">
                      ⚠️ Risks to watch
                    </p>
                    <ul className="space-y-1.5">
                      {plan.risks_to_watch.map((r, i) => (
                        <li key={i} className="text-[#C7C7D1] text-xs flex gap-2">
                          <span style={{ color: '#FB7185' }}>•</span>
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

            <p className="text-[#7E7E8E] text-[11px] leading-relaxed pt-2 border-t border-white/[0.08]">
              ⚠️ All figures are approximate, based on model knowledge — confirm against live market data before committing.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
