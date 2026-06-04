'use client'

// Tier A Workforce Snapshot — the launch wedge (STRATEGY §16).
//
// CEO/CHRO lands here, gives 6 inputs (no confidential data), and gets back
// a one-page report with the headline Workforce Future Readiness Score, a
// risk heatmap, top at-risk roles with 5-way recommendations, AI integration
// cost estimates, and a 30-day quick-wins list. Anyone can run it (no auth
// required) — signed-in companies get it logged to their account.

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

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
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0E0E13]" />}>
      <WorkforceSnapshotInner />
    </Suspense>
  )
}

function WorkforceSnapshotInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // ?first=true is set when the user arrives here straight from
  // /company/onboarding. Suppresses the back-to-dashboard escape, and on
  // report-generation auto-redirects to /company/dashboard?snapshot=done so
  // the dashboard can throw the Growth trial toast at peak intent.
  const isFirstRun = searchParams.get('first') === 'true'

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

  // Spine pre-fill state — fetched once on mount. If the company has built
  // their org spine, we can populate industry/size/country/roles from there
  // and the user only has to answer aiMaturity + opModel + useCases. This
  // is the v4 data-loop value prop in action: "fill the spine once, every
  // tool reads from it."
  type SpinePrefill = {
    hasSpine: boolean
    industry: string
    size: string
    country: string
    roles: RoleRow[]
    counts: { locations: number; teams: number; seats: number; activeSeats: number; vacantSeats: number }
  }
  const [spine, setSpine] = useState<SpinePrefill | null>(null)
  const [spineApplied, setSpineApplied] = useState(false)
  useEffect(() => {
    fetch('/api/company/spine/snapshot-prefill')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.hasSpine) setSpine(d) })
      .catch(() => { /* user might not have a spine yet — silent */ })
  }, [])

  const applySpine = () => {
    if (!spine) return
    if (spine.industry) setIndustry(spine.industry)
    if (spine.size) setSize(spine.size)
    if (spine.country) setCountry(spine.country)
    if (spine.roles.length > 0) setRoles(spine.roles)
    setSpineApplied(true)
  }

  // Restore a previously-generated report + the inputs that produced it from
  // localStorage so the user doesn't lose their work after clicking an
  // upsell CTA + hitting browser back. Cleared on explicit "Run another
  // snapshot" — OR when the URL has ?first=true (fresh post-onboarding
  // visit; any leftover report would be from a different company / test
  // session and would confuse a new user).
  const [restored, setRestored] = useState(false)
  useEffect(() => {
    try {
      if (isFirstRun) {
        localStorage.removeItem('shapi-snapshot')
        setRestored(true)
        return
      }
      const raw = localStorage.getItem('shapi-snapshot')
      if (!raw) { setRestored(true); return }
      const saved = JSON.parse(raw) as {
        inputs?: { industry?: string; size?: string; country?: string; aiMaturity?: string; opModel?: string; roles?: RoleRow[]; useCases?: string[] }
        report?: Report
        savedAt?: string
      }
      if (saved.inputs) {
        if (saved.inputs.industry) setIndustry(saved.inputs.industry)
        if (saved.inputs.size) setSize(saved.inputs.size)
        if (saved.inputs.country) setCountry(saved.inputs.country)
        if (saved.inputs.aiMaturity) setAiMaturity(saved.inputs.aiMaturity)
        if (saved.inputs.opModel) setOpModel(saved.inputs.opModel)
        if (Array.isArray(saved.inputs.roles) && saved.inputs.roles.length > 0) setRoles(saved.inputs.roles)
        if (Array.isArray(saved.inputs.useCases) && saved.inputs.useCases.length > 0) setUseCases(saved.inputs.useCases)
      }
      if (saved.report) setReport(saved.report)
    } catch { /* corrupt localStorage — ignore */ }
    setRestored(true)
  }, [])

  // Continuous auto-save: any change to inputs OR a generated report writes
  // through to localStorage. Skipped until the restore-from-storage pass has
  // completed so we don't immediately overwrite saved data with default
  // empty state on first mount.
  useEffect(() => {
    if (!restored) return
    try {
      localStorage.setItem('shapi-snapshot', JSON.stringify({
        inputs: { industry, size, country, aiMaturity, opModel, roles, useCases },
        report,
        savedAt: new Date().toISOString(),
      }))
    } catch { /* quota exceeded / private mode — proceed without persistence */ }
  }, [restored, industry, size, country, aiMaturity, opModel, roles, useCases, report])

  const updateRole = (i: number, key: keyof RoleRow, value: string) => {
    setRoles(prev => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)))
  }
  const addRole = () => setRoles(prev => [...prev, { role: '', dept: '', count: '' }])
  const removeRole = (i: number) => setRoles(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)

  // Bulk-paste: tab- or comma-separated rows from any spreadsheet.
  // Format per line: role[, dept[, count]] — flexible. Auto-detects a header
  // row (Ana's testing: CSV with column headers was being parsed as a "role"
  // called "Role" with no count). The header heuristic looks for the literal
  // tokens "role", "title", "position", "department", "dept", or "count" in
  // any case in the first line.
  const [bulkText, setBulkText] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const importBulk = () => {
    let lines = bulkText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    // Strip a header row if line 1 looks like column labels.
    if (lines.length > 0) {
      const first = lines[0].toLowerCase()
      const looksLikeHeader = /\b(role|title|position|department|dept|count|headcount|fte)\b/.test(first)
        && !/\d/.test(first.replace(/[,;\t]/g, ''))
      if (looksLikeHeader) lines = lines.slice(1)
    }
    const parsed: RoleRow[] = []
    for (const line of lines) {
      // split on tab first (paste from Excel/Sheets), fall back to commas
      const parts = (line.includes('\t') ? line.split('\t') : line.split(',')).map(s => s.trim())
      const role = parts[0] || ''
      if (!role) continue
      const dept = parts[1] || ''
      const countRaw = parts[2] || '1'
      const count = countRaw.replace(/[^0-9]/g, '') || '1'
      parsed.push({ role, dept, count })
    }
    if (parsed.length === 0) return
    // Replace whatever was there with the imported set (keeps the form sane).
    setRoles(parsed)
    setBulkText('')
    setBulkOpen(false)
  }
  const onCsvFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => { setBulkText(String(reader.result || '')); setBulkOpen(true) }
    reader.readAsText(file)
  }
  // Download a populated template so users see the exact format we expect
  // before they edit. Header row is detected and stripped on import, so the
  // template is purely educational — it can't break the parse.
  const downloadTemplate = () => {
    const csv = [
      'Role,Department,Count',
      'Operations Director,Operations,1',
      'Software Engineer,Engineering,4',
      'Customer Success Manager,Customer Success,2',
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'shapi-roles-template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

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
      // Vercel returns an HTML 504 (not JSON) when a function hits its
      // max-duration cap. Detect that explicitly so the user sees a useful
      // message instead of a generic "connection dropped" string.
      let d: { success?: boolean; report?: Report; error?: string } = {}
      try { d = JSON.parse(raw) } catch {
        if (res.status === 504 || /timeout|gateway/i.test(raw)) {
          setErr('The analysis took a bit too long — usually works on the second go. Tap Show me again.')
        } else if (res.status >= 500) {
          setErr(`Snapshot engine hit a snag (${res.status}). Try once more — if it keeps failing, the team has been notified.`)
        } else {
          setErr('Something interrupted the connection — please try again.')
        }
        return
      }
      if (d.error) { setErr(d.error); return }
      if (d.report) {
        setReport(d.report)
        // Persist the report + the inputs that produced it so a navigation
        // to /company/pricing (or anywhere) followed by browser-back doesn't
        // wipe the work.
        try {
          localStorage.setItem('shapi-snapshot', JSON.stringify({
            inputs: { industry, size, country, aiMaturity, opModel, roles, useCases },
            report: d.report,
            savedAt: new Date().toISOString(),
          }))
        } catch { /* quota or disabled — proceed without persistence */ }
      }
      else setErr('Could not build the snapshot — try again.')
    } catch (e) {
      console.warn('[workforce-snapshot] client error:', e)
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
        {/* Hide the Dashboard escape during the forced first-run flow — the
            Snapshot is the wedge experience, we want them through it. */}
        {!isFirstRun && (
          <Link href="/company/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1]">← Dashboard</Link>
        )}
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

            {/* Spine pre-fill banner — only when the company has built any
                part of the org spine. Click to populate industry/size/
                country/roles from /company/spine. Proves the data-loop value
                prop: one source of truth, every tool reads from it. */}
            {spine?.hasSpine && (
              <div
                className="rounded-2xl p-4"
                style={{
                  background: spineApplied ? 'rgba(52,211,153,0.08)' : 'rgba(106,168,245,0.08)',
                  border: `1px solid ${spineApplied ? 'rgba(52,211,153,0.30)' : 'rgba(106,168,245,0.30)'}`,
                }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-black mb-0.5" style={{ color: spineApplied ? '#34D399' : '#6AA8F5' }}>
                      {spineApplied ? '✓ Filled from your org spine' : '✨ Use your org spine data'}
                    </p>
                    <p className="text-xs text-[#A6A6B4]">
                      {spine.counts.locations} location{spine.counts.locations === 1 ? '' : 's'} ·{' '}
                      {spine.counts.teams} team{spine.counts.teams === 1 ? '' : 's'} ·{' '}
                      {spine.counts.activeSeats} filled / {spine.counts.vacantSeats} vacant seats.
                      {spineApplied ? ' You can still edit anything below.' : ' Industry, size, country and roles will pre-fill.'}
                    </p>
                  </div>
                  {!spineApplied && (
                    <button
                      type="button"
                      onClick={applySpine}
                      className="text-xs font-black px-4 py-2 rounded-full whitespace-nowrap"
                      style={{ background: '#6AA8F5', color: '#fff' }}
                    >
                      Pre-fill now
                    </button>
                  )}
                </div>
              </div>
            )}

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
                <p className="text-[#7E7E8E] text-[11px] mt-2">Pick the closest, or pick &quot;Hybrid&quot; — the Strategic Workforce Plan can map per-BU.</p>
              </div>
            </div>

            <div className="rounded-2xl p-5" style={cardStyle}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-1">Roles in your org (optional, anonymised counts only)</p>
                  <p className="text-[#7E7E8E] text-[11px]">No names, no salaries. Type one row at a time, OR paste from a spreadsheet / upload a CSV.</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <button type="button" onClick={() => setBulkOpen(o => !o)}
                    className="text-[#6AA8F5] text-[10px] font-bold border border-[#6AA8F5]/30 px-2.5 py-1 rounded-full hover:border-[#6AA8F5]/60 transition-colors whitespace-nowrap">
                    {bulkOpen ? 'Close paste' : '📋 Paste rows'}
                  </button>
                  <label className="text-[#F08CAE] text-[10px] font-bold border border-[#F08CAE]/30 px-2.5 py-1 rounded-full hover:border-[#F08CAE]/60 transition-colors cursor-pointer whitespace-nowrap">
                    📄 Upload CSV
                    <input type="file" accept=".csv,text/csv,text/plain" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) onCsvFile(f); e.currentTarget.value = '' }} />
                  </label>
                  <button type="button" onClick={downloadTemplate}
                    className="text-[#C7C7D1] text-[10px] font-bold border border-white/[0.12] px-2.5 py-1 rounded-full hover:text-[#F4F4F7] hover:border-white/[0.30] transition-colors whitespace-nowrap"
                    title="Download a populated CSV showing the exact format we expect">
                    ↓ Download template
                  </button>
                </div>
              </div>

              {bulkOpen && (
                <div className="mb-3 rounded-lg p-3" style={{ background: 'rgba(106,168,245,0.06)', border: '1px solid rgba(106,168,245,0.18)' }}>
                  <p className="text-[#A6A6B4] text-[10px] mb-1.5">One role per line. Format: <strong className="text-[#C7C7D1]">role, dept, count</strong> — comma or tab separated. Header row is fine to leave in; we&apos;ll skip empty ones.</p>
                  <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={5}
                    placeholder="Engineer, Tech, 5&#10;Designer, Product, 1&#10;Sales Rep, GTM, 2"
                    className="w-full rounded-lg px-3 py-2 text-xs text-[#F4F4F7] placeholder-[#7E7E8E] outline-none font-mono"
                    style={inputStyle} />
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={importBulk} disabled={!bulkText.trim()}
                      className="text-[10px] font-black px-3 py-1.5 rounded-full text-white disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
                      Import {bulkText.trim() ? `${bulkText.split(/\r?\n/).filter(l => l.trim()).length} rows` : ''}
                    </button>
                    <button type="button" onClick={() => { setBulkText(''); setBulkOpen(false) }}
                      className="text-[10px] font-bold px-3 py-1.5 rounded-full text-[#7E7E8E] border border-white/[0.10] hover:text-[#C7C7D1]">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

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

            {/* CUT 1 from master Section 1: removed the standalone "AI use
                cases" free-text box. AI-exposure is now derived automatically
                per role/seat by the engine — a vague manual box added a
                confusing step + produced vague output. The useCases state
                stays in code (defaulted to empty) so the API payload contract
                doesn't change; the engine just sees no use cases and falls
                back to "common 2-3 for this industry". */}

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
                <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-3">🛠 AI integration build vs buy</p>
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
                <p className="text-[#7E7E8E] text-[10px] mt-3 leading-relaxed">
                  Sources: <span className="text-[#A6A6B4]">Anthropic/OpenAI published API pricing · AWS/GCP/Azure published cloud rates · Mercer · Shapi platform data</span>
                </p>
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

            {/* CTA 1 — Growth trial (the SaaS upsell). 14-day trial = peak
                intent moment. They just saw their AI-risk heatmap; the
                Hiring Roadmap turns that diagnosis into action. */}
            <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(106,168,245,0.14), rgba(52,211,153,0.10))', border: '1px solid rgba(106,168,245,0.40)' }}>
              <div className="flex items-start gap-3.5">
                <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg,#6AA8F5,#34D399)' }}>🚀</div>
                <div className="flex-1">
                  <p className="text-[#F4F4F7] font-black text-base mb-1">Turn this report into a hiring plan</p>
                  <p className="text-[#A6A6B4] text-sm mb-3 leading-relaxed">
                    You&apos;ve seen the gaps. <strong className="text-[#F4F4F7]">Growth ($799/mo)</strong> unlocks the full Hiring Roadmap, AI-shortlisted candidates per role, and salary benchmarks for every at-risk role above.
                  </p>
                  <div className="flex flex-wrap gap-3 items-center">
                    {/* target=_blank so the user keeps the Snapshot visible
                        while exploring pricing — backbutton-wipes-data was a
                        real complaint in testing. */}
                    <Link href="/company/pricing?plan=growth&trial=14" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-black text-white"
                      style={{ background: 'linear-gradient(135deg,#6AA8F5,#34D399)' }}>
                      Start free 14-day trial →
                    </Link>
                    <span className="text-[#7E7E8E] text-[11px]">Card on file via Stripe. No charge for 14 days. Cancel anytime.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA 2 — Strategic Workforce Plan (enterprise consulting tier).
                Distinct buyer + ask; kept as the secondary, premium-bookable
                path. Internally "Tier B" in pricing config / comments. */}
            <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg, rgba(106,168,245,0.10), rgba(240,140,174,0.10))', border: '1px solid rgba(240,140,174,0.30)' }}>
              <p className="text-[#F4F4F7] font-black text-base mb-1">Want the full Strategic Workforce Plan?</p>
              <p className="text-[#A6A6B4] text-sm mb-4">1 / 3 / 5 / 10-year operating-model diagnostic, per-BU mapping, scenario modelling, execution playbook, talent sourced from our verified pool.</p>
              <Link href="/book-call?topic=strategic-plan" className="inline-block px-6 py-3 rounded-full font-black text-sm" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', color: '#fff' }}>
                Book a strategy call →
              </Link>
            </div>

            {/* During the first-run flow, primary action is "Done — to my
                dashboard"; the Growth trial CTA above is the upsell. Otherwise
                show the existing "Run another snapshot" button. */}
            {isFirstRun ? (
              <button
                onClick={() => router.push('/company/dashboard?snapshot=done')}
                className="w-full py-3 rounded-full font-black text-sm text-white hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
                Take me to my dashboard →
              </button>
            ) : (
              <button
                onClick={() => {
                  setReport(null)
                  setErr('')
                  try { localStorage.removeItem('shapi-snapshot') } catch {}
                }}
                className="w-full py-3 rounded-full font-bold text-sm border border-white/[0.12] text-[#C7C7D1] hover:bg-white/[0.04]">
                Run another snapshot
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
