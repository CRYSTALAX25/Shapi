'use client'

// Tier A Workforce Snapshot — the launch wedge (STRATEGY §16).
//
// CEO/CHRO lands here, gives 6 inputs (no confidential data), and gets back
// a one-page report with the headline Workforce Future Readiness Score, a
// risk heatmap, top at-risk roles with 5-way recommendations, AI integration
// cost estimates, and a 30-day quick-wins list. Anyone can run it (no auth
// required) — signed-in companies get it logged to their account.

import { useState } from 'react'
import Link from 'next/link'

type RoleRow = { role: string; dept: string; count: string }

type Report = {
  readiness_score: number
  verdict: 'high-risk' | 'needs-attention' | 'on-track'
  headline: string
  sub_scores: Record<string, number>
  ai_risk_heatmap: {
    high_risk_count: number
    medium_risk_count: number
    low_risk_count: number
    high_risk_summary: string
  }
  top_at_risk_roles: Array<{ role: string; why: string; recommendation: string }>
  ai_integration_estimates: Array<{
    use_case: string
    build_buy_partner: string
    why: string
    cost_range_year_1: string
    talent_gap: string
    timeline_months: string
    roi_gate: string
  }>
  quick_wins: string[]
  raise_score_to: { target_in_12_months: number; biggest_levers: string[] }
  honest_caveats: string
}

const AI_MATURITY = [
  { value: 'experimenting', label: 'Experimenting' },
  { value: 'piloting', label: 'Piloting' },
  { value: 'scaling', label: 'Scaling' },
  { value: 'mature', label: 'Mature' },
]
const OPERATING_MODELS = [
  { value: 'centralised', label: 'Centralised' },
  { value: 'decentralised', label: 'Decentralised' },
  { value: 'agile-pod', label: 'Agile Pod' },
  { value: 'skills-marketplace', label: 'Skills Marketplace' },
  { value: 'hybrid-ai', label: 'Hybrid Human + AI' },
  { value: 'outcome-based', label: 'Outcome-Based' },
  { value: 'hybrid', label: 'Hybrid / mixed' },
]
const SIZES = ['<10', '10-50', '50-200', '200-1000', '1000+']

function recColor(rec: string): { bg: string; color: string; label: string } {
  switch (rec) {
    case 'protect': return { bg: 'rgba(52,211,153,0.15)', color: '#34D399', label: 'Protect' }
    case 'augment': return { bg: 'rgba(106,168,245,0.15)', color: '#6AA8F5', label: 'Augment' }
    case 'reskill': return { bg: 'rgba(251,191,36,0.15)', color: '#FBBF24', label: 'Reskill' }
    case 'redeploy': return { bg: 'rgba(240,140,174,0.15)', color: '#F08CAE', label: 'Redeploy' }
    case 'replace': return { bg: 'rgba(245,142,154,0.18)', color: '#F58E9A', label: 'Replace' }
    default: return { bg: 'rgba(255,255,255,0.06)', color: '#A6A6B4', label: rec }
  }
}

function scoreColor(score: number): string {
  if (score >= 70) return '#34D399' // green — on-track
  if (score >= 40) return '#FBBF24' // amber — needs attention
  return '#F58E9A' // red — high-risk
}

export default function WorkforceSnapshot() {
  const [industry, setIndustry] = useState('')
  const [size, setSize] = useState('')
  const [country, setCountry] = useState('')
  const [aiMaturity, setAiMaturity] = useState('')
  const [opModel, setOpModel] = useState('')
  const [roles, setRoles] = useState<RoleRow[]>([{ role: '', dept: '', count: '' }])
  const [useCases, setUseCases] = useState<string[]>(['', '', ''])

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [report, setReport] = useState<Report | null>(null)

  const updateRole = (i: number, key: keyof RoleRow, value: string) => {
    setRoles(prev => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)))
  }
  const addRole = () => setRoles(prev => [...prev, { role: '', dept: '', count: '' }])
  const removeRole = (i: number) => setRoles(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)

  const run = async () => {
    if (!industry.trim() || !size.trim()) {
      setErr('Industry and company size are required.')
      return
    }
    setLoading(true); setErr(''); setReport(null)
    try {
      const rolesPayload = roles
        .filter(r => r.role.trim())
        .map(r => ({ role: r.role.trim(), dept: r.dept.trim() || undefined, count: parseInt(r.count || '1', 10) || 1 }))
      const useCasesPayload = useCases.map(u => u.trim()).filter(Boolean)
      const res = await fetch('/api/company/workforce-snapshot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: industry.trim(),
          size,
          country: country.trim(),
          ai_maturity: aiMaturity,
          operating_model: opModel,
          roles: rolesPayload,
          use_cases: useCasesPayload,
        }),
      })
      const raw = await res.text()
      let d: { success?: boolean; report?: Report; error?: string } = {}
      try { d = JSON.parse(raw) } catch { setErr('Connection dropped — try again in a few seconds.'); return }
      if (d.error) { setErr(d.error); return }
      if (d.report) setReport(d.report)
      else setErr('Could not build the snapshot — try again.')
    } catch {
      setErr('Connection dropped — try again in a few seconds.')
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full mt-1 rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50'
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
  const labelCls = 'text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider'
  const cardStyle = { background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }

  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
      <style>{`
        .gradient-border-card { background: linear-gradient(#16161F,#16161F) padding-box, linear-gradient(135deg, rgba(106,168,245,0.15), rgba(240,140,174,0.15)) border-box; border: 1px solid transparent; box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35); }
      `}</style>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/company/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1]">← Dashboard</Link>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-2" style={{ color: '#FB7185' }}>Workforce Snapshot</h1>
          <p className="text-[#A6A6B4] text-sm max-w-2xl">
            How AI-ready is your team? Five inputs, zero confidential data, one honest report — including your <strong className="text-[#F4F4F7]">Workforce Future Readiness Score</strong>, where AI fits in your org, and what it&apos;ll actually cost.
          </p>
        </div>

        {/* ── Intake form ────────────────────────────────────────────── */}
        {!report && (
          <div className="space-y-4">
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-3">About your company</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Industry *</label>
                  <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. consulting, healthcare, retail tech"
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls}>Country</label>
                  <input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. UAE, Saudi Arabia, UK"
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls}>Company size *</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {SIZES.map(s => (
                      <button key={s} onClick={() => setSize(s)}
                        className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                        style={{ background: size === s ? 'rgba(106,168,245,0.18)' : 'rgba(255,255,255,0.05)', color: size === s ? '#6AA8F5' : '#A6A6B4', border: size === s ? '1px solid rgba(106,168,245,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>AI maturity</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {AI_MATURITY.map(m => (
                      <button key={m.value} onClick={() => setAiMaturity(m.value)}
                        className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                        style={{ background: aiMaturity === m.value ? 'rgba(106,168,245,0.18)' : 'rgba(255,255,255,0.05)', color: aiMaturity === m.value ? '#6AA8F5' : '#A6A6B4', border: aiMaturity === m.value ? '1px solid rgba(106,168,245,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <label className={labelCls}>Operating model</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {OPERATING_MODELS.map(o => (
                    <button key={o.value} onClick={() => setOpModel(o.value)}
                      className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                      style={{ background: opModel === o.value ? 'rgba(106,168,245,0.18)' : 'rgba(255,255,255,0.05)', color: opModel === o.value ? '#6AA8F5' : '#A6A6B4', border: opModel === o.value ? '1px solid rgba(106,168,245,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="text-[#7E7E8E] text-[11px] mt-2">Pick the closest, or pick &quot;Hybrid&quot; — Tier B can map per-BU.</p>
              </div>
            </div>

            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-3">Roles in your org (optional, anonymised counts only)</p>
              <p className="text-[#7E7E8E] text-[11px] mb-3">No names, no salaries. Just role + count. Skip this and we&apos;ll give you industry-typical guidance.</p>
              <div className="space-y-2">
                {roles.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={r.role} onChange={e => updateRole(i, 'role', e.target.value)} placeholder="Role title"
                      className="flex-1 rounded-lg px-3 py-2 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none" style={inputStyle} />
                    <input value={r.dept} onChange={e => updateRole(i, 'dept', e.target.value)} placeholder="Dept (optional)"
                      className="w-32 rounded-lg px-3 py-2 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none" style={inputStyle} />
                    <input value={r.count} onChange={e => updateRole(i, 'count', e.target.value)} placeholder="#" inputMode="numeric"
                      className="w-16 rounded-lg px-3 py-2 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none text-center" style={inputStyle} />
                    {roles.length > 1 && (
                      <button onClick={() => removeRole(i)} className="text-[#7E7E8E] hover:text-[#F58E9A] text-sm px-2">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addRole} className="mt-3 text-[#6AA8F5] text-xs font-bold border border-[#6AA8F5]/30 px-3 py-1.5 rounded-full hover:border-[#6AA8F5]/60 transition-colors">+ Add role</button>
            </div>

            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-3">AI use cases under consideration (up to 3)</p>
              <p className="text-[#7E7E8E] text-[11px] mb-3">e.g. &quot;automate customer support tier-1&quot;, &quot;AI co-pilot for our analysts&quot;, &quot;internal search across all docs&quot;</p>
              <div className="space-y-2">
                {useCases.map((u, i) => (
                  <input key={i} value={u} onChange={e => setUseCases(prev => prev.map((x, idx) => idx === i ? e.target.value : x))}
                    placeholder={`Use case ${i + 1} (optional)`}
                    className={inputCls} style={inputStyle} />
                ))}
              </div>
            </div>

            {err && <p className="text-[#F58E9A] text-sm">{err}</p>}

            <button onClick={run} disabled={loading || !industry.trim() || !size}
              className="w-full py-4 rounded-full font-black text-white text-sm disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
              {loading ? 'Building your snapshot…' : 'Get my Workforce Readiness Score →'}
            </button>
            <p className="text-[#7E7E8E] text-[11px] text-center">~30 seconds. Anonymised. Nothing stored beyond what you typed.</p>
          </div>
        )}

        {/* ── Report ─────────────────────────────────────────────────── */}
        {report && (
          <div className="space-y-4">
            {/* Headline score */}
            <div className="gradient-border-card rounded-2xl p-6 flex items-center gap-6">
              <div className="relative flex-shrink-0 w-28 h-28">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                  <circle cx="56" cy="56" r="48" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="10" />
                  <circle cx="56" cy="56" r="48" fill="none" stroke={scoreColor(report.readiness_score)} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 48} strokeDashoffset={2 * Math.PI * 48 * (1 - report.readiness_score / 100)} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-black" style={{ color: scoreColor(report.readiness_score) }}>{report.readiness_score}</span>
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-1">Workforce Future Readiness Score</p>
                <h2 className="text-xl font-black mb-1" style={{ color: scoreColor(report.readiness_score) }}>
                  {report.verdict === 'on-track' ? 'On track' : report.verdict === 'needs-attention' ? 'Needs attention' : 'High risk'}
                </h2>
                <p className="text-[#C7C7D1] text-sm leading-snug">{report.headline}</p>
              </div>
            </div>

            {/* Sub-scores */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-3">Score breakdown</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {Object.entries(report.sub_scores).map(([k, v]) => (
                  <div key={k} className="bg-white/[0.04] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[#C7C7D1] text-xs capitalize">{k.replace(/_/g, ' ').replace('inverse', 'resilience')}</span>
                      <span className="text-sm font-black" style={{ color: scoreColor(v as number) }}>{v}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${v}%`, background: scoreColor(v as number) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI risk heatmap */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-3">AI exposure across your org</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-xl p-3" style={{ background: 'rgba(245,142,154,0.10)', border: '1px solid rgba(245,142,154,0.25)' }}>
                  <p className="text-[10px] text-[#A6A6B4]">High risk</p>
                  <p className="text-xl font-black" style={{ color: '#F58E9A' }}>{report.ai_risk_heatmap.high_risk_count}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)' }}>
                  <p className="text-[10px] text-[#A6A6B4]">Medium</p>
                  <p className="text-xl font-black" style={{ color: '#FBBF24' }}>{report.ai_risk_heatmap.medium_risk_count}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.25)' }}>
                  <p className="text-[10px] text-[#A6A6B4]">Low / resilient</p>
                  <p className="text-xl font-black" style={{ color: '#34D399' }}>{report.ai_risk_heatmap.low_risk_count}</p>
                </div>
              </div>
              <p className="text-[#C7C7D1] text-xs leading-relaxed">{report.ai_risk_heatmap.high_risk_summary}</p>
            </div>

            {/* Top at-risk roles with 5-way recommendation */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-3">Top at-risk roles &amp; what to do</p>
              <div className="space-y-2">
                {report.top_at_risk_roles.map((r, i) => {
                  const rc = recColor(r.recommendation)
                  return (
                    <div key={i} className="bg-white/[0.04] rounded-lg p-3 flex items-start gap-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: rc.bg, color: rc.color }}>{rc.label}</span>
                      <div className="min-w-0">
                        <p className="text-[#F4F4F7] text-sm font-bold">{r.role}</p>
                        <p className="text-[#A6A6B4] text-xs leading-relaxed mt-0.5">{r.why}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* AI integration estimates */}
            {report.ai_integration_estimates.length > 0 && (
              <div className="rounded-2xl p-5" style={cardStyle}>
                <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-3">🛠 AI integration estimates</p>
                <div className="space-y-3">
                  {report.ai_integration_estimates.map((u, i) => (
                    <div key={i} className="bg-white/[0.04] rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-[#F4F4F7] text-sm font-black">{u.use_case}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(106,168,245,0.15)', color: '#6AA8F5' }}>{u.build_buy_partner}</span>
                      </div>
                      <p className="text-[#A6A6B4] text-xs mb-2">{u.why}</p>
                      <div className="grid sm:grid-cols-2 gap-2 text-xs">
                        <div><span className="text-[#7E7E8E]">Cost Y1: </span><span className="text-[#F4F4F7] font-bold">{u.cost_range_year_1}</span></div>
                        <div><span className="text-[#7E7E8E]">Timeline: </span><span className="text-[#F4F4F7] font-bold">{u.timeline_months}</span></div>
                      </div>
                      <p className="text-[#7E7E8E] text-[11px] mt-2"><strong className="text-[#C7C7D1]">Talent gap:</strong> {u.talent_gap}</p>
                      <p className="text-[#7E7E8E] text-[11px] mt-1"><strong className="text-[#C7C7D1]">ROI gate:</strong> {u.roi_gate}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick wins */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-3">⚡ Quick wins (next 30 days)</p>
              <ol className="space-y-2">
                {report.quick_wins.map((w, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-[#F08CAE] text-sm font-black flex-shrink-0">{i + 1}.</span>
                    <p className="text-[#C7C7D1] text-sm leading-relaxed">{w}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* How to raise the score */}
            <div className="gradient-border-card rounded-2xl p-5">
              <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-2">Raise your score</p>
              <p className="text-[#F4F4F7] text-base font-black mb-2">
                Target in 12 months: <span style={{ color: '#34D399' }}>{report.raise_score_to.target_in_12_months}</span>
              </p>
              <ul className="space-y-1.5 mb-4">
                {report.raise_score_to.biggest_levers.map((l, i) => (
                  <li key={i} className="text-[#C7C7D1] text-sm leading-relaxed flex gap-2">
                    <span className="text-[#F08CAE]">→</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
              <div className="bg-white/[0.04] rounded-lg p-3 mt-3">
                <p className="text-[#7E7E8E] text-[11px] italic leading-relaxed">{report.honest_caveats}</p>
              </div>
            </div>

            {/* CTA — Tier B upsell */}
            <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg, rgba(106,168,245,0.10), rgba(240,140,174,0.10))', border: '1px solid rgba(240,140,174,0.30)' }}>
              <p className="text-[#F4F4F7] font-black text-base mb-1">Want the full 5-year plan?</p>
              <p className="text-[#A6A6B4] text-sm mb-4">Operating-model diagnostic, per-BU mapping, scenario modelling, execution playbook, talent sourced from our verified pool.</p>
              <a href="mailto:ana.vbarber@gmail.com?subject=Shapi%20Workforce%20Plan%20-%20design%20partner%20enquiry" className="inline-block px-6 py-3 rounded-full font-black text-sm" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', color: '#fff' }}>
                Book a strategy call →
              </a>
            </div>

            <button onClick={() => { setReport(null); setErr('') }} className="w-full py-3 rounded-full font-bold text-sm border border-white/[0.12] text-[#C7C7D1] hover:bg-white/[0.04]">
              Run another snapshot
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
