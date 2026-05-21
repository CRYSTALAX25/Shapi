'use client'

import { useState } from 'react'
import Link from 'next/link'

const CURRENCIES = ['AED', 'SAR', 'USD', 'GBP', 'EUR', 'QAR', 'KWD']
const EXPERIENCE = ['0–2 years', '3–5 years', '6–10 years', '10+ years']

type Band = { min: number; max: number }
type Estimate = {
  currency: string
  period: string
  primary: Band
  pivot?: { field: string; min: number; max: number }
  rationale: string
}

export default function WorthPage() {
  const [role, setRole] = useState('')
  const [experience, setExperience] = useState('6–10 years')
  const [location, setLocation] = useState('Dubai, UAE')
  const [currency, setCurrency] = useState('AED')
  const [pivotField, setPivotField] = useState('')
  const [showPivot, setShowPivot] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const fmt = (n: number) => n?.toLocaleString()

  const run = async () => {
    if (!role.trim()) { setError('Enter your role to get an estimate.'); return }
    setLoading(true); setError(''); setEstimate(null); setSaveState('idle')
    try {
      const res = await fetch('/api/salary-benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, experience, location, currency, pivotField: showPivot ? pivotField : '' }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Could not estimate right now.'); setLoading(false); return }
      setEstimate(d.estimate)
    } catch {
      setError('Could not estimate right now.')
    }
    setLoading(false)
  }

  const useAsExpectations = async () => {
    if (!estimate) return
    setSaveState('saving')
    const payload = {
      salary_expectations: {
        currency: estimate.currency,
        period: estimate.period || 'month',
        includes_allowances: true,
        flexible: true,
        primary: { track: role.trim(), min: estimate.primary.min, max: estimate.primary.max },
        pivots: estimate.pivot
          ? [{ track: estimate.pivot.field, min: estimate.pivot.min, max: estimate.pivot.max, note: 'from benchmark' }]
          : [],
      },
    }
    const res = await fetch('/api/profile/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (res.status === 401) { window.location.href = '/signup'; return }
    setSaveState(res.ok ? 'saved' : 'idle')
  }

  const cardStyle = { border: '1px solid rgba(14,14,26,0.08)', boxShadow: '0 1px 3px rgba(14,14,26,0.04), 0 12px 30px rgba(14,14,26,0.06)' }

  return (
    <div className="min-h-screen bg-[#F1F2F7] text-[#0E0E1A]">
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(14,14,26,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-5 max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <Link href="/signup" className="text-white text-sm font-bold px-4 py-2 rounded-full" style={{ background: 'linear-gradient(135deg, #06B6D4, #7C3AED)' }}>Get started →</Link>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-8 pb-20">
        <div className="text-center mb-8">
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#7C3AED' }}>Free · 30 seconds</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-3">What you&apos;re worth.</h1>
          <p className="text-[#3F3F4E] text-lg max-w-xl mx-auto">A fair salary band for your role — and, if you&apos;re pivoting, a realistic band for the new field too.</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl p-6 mb-6" style={cardStyle}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8A99] mb-2">Your role</label>
              <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Operations Director"
                className="w-full px-4 py-3 rounded-xl text-sm bg-[#0E0E1A]/[0.03] border border-[#0E0E1A]/[0.08] focus:outline-none focus:border-[#06B6D4]/60" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8A99] mb-2">Experience</label>
                <select value={experience} onChange={e => setExperience(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm bg-[#0E0E1A]/[0.03] border border-[#0E0E1A]/[0.08] focus:outline-none">
                  {EXPERIENCE.map(x => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8A99] mb-2">Location</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Dubai, UAE"
                  className="w-full px-4 py-3 rounded-xl text-sm bg-[#0E0E1A]/[0.03] border border-[#0E0E1A]/[0.08] focus:outline-none focus:border-[#06B6D4]/60" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8A99] mb-2">Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm bg-[#0E0E1A]/[0.03] border border-[#0E0E1A]/[0.08] focus:outline-none">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Pivot toggle */}
            {!showPivot ? (
              <button type="button" onClick={() => setShowPivot(true)} className="text-sm font-bold" style={{ color: '#7C3AED' }}>
                + I&apos;m pivoting into a new field
              </button>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8A8A99] mb-2">Pivoting into</label>
                <input value={pivotField} onChange={e => setPivotField(e.target.value)} placeholder="e.g. UX Design"
                  className="w-full px-4 py-3 rounded-xl text-sm bg-[#0E0E1A]/[0.03] border border-[#0E0E1A]/[0.08] focus:outline-none focus:border-[#7C3AED]/60" />
                <p className="text-[#8A8A99] text-xs mt-1.5">We&apos;ll price your transferable experience fairly — not your senior rate, not nothing.</p>
              </div>
            )}

            {error && <p className="text-[#E11D48] text-sm bg-[#E11D48]/[0.08] border border-[#E11D48]/20 rounded-xl px-4 py-3">{error}</p>}

            <button onClick={run} disabled={loading}
              className="w-full py-4 rounded-full font-black text-sm text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #06B6D4, #7C3AED)' }}>
              {loading ? 'Estimating…' : 'Show me my worth →'}
            </button>
          </div>
        </div>

        {/* Result */}
        {estimate && (
          <div className="bg-white rounded-2xl p-7 mb-6" style={cardStyle}>
            <div className="flex items-center gap-2.5 mb-5">
              <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#06B6D4,#7C3AED)' }} />
              <h2 className="text-xl font-black tracking-tight">Your estimate</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(217,119,6,0.12)', color: '#B45309' }}>ESTIMATE</span>
            </div>

            {/* Primary band */}
            <div className="rounded-xl p-5 mb-3" style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.10), rgba(124,58,237,0.10))', border: '1px solid rgba(6,182,212,0.25)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#0891B2' }}>{role || 'Your field'} · {experience}</p>
              <p className="text-3xl font-black">
                {estimate.currency} {fmt(estimate.primary.min)}–{fmt(estimate.primary.max)}
                <span className="text-base font-bold text-[#8A8A99]"> /{estimate.period === 'year' ? 'yr' : 'mo'}</span>
              </p>
              <p className="text-[#8A8A99] text-xs mt-1">total package · incl. typical allowances</p>
            </div>

            {/* Pivot band */}
            {estimate.pivot && (
              <div className="rounded-xl p-5 mb-3" style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#7C3AED' }}>Pivot · {estimate.pivot.field}</p>
                <p className="text-2xl font-black">
                  {estimate.currency} {fmt(estimate.pivot.min)}–{fmt(estimate.pivot.max)}
                  <span className="text-sm font-bold text-[#8A8A99]"> /{estimate.period === 'year' ? 'yr' : 'mo'}</span>
                </p>
                <p className="text-[#8A8A99] text-xs mt-1">a fair entry band — rises as you build verified experience</p>
              </div>
            )}

            {estimate.rationale && <p className="text-[#3F3F4E] text-sm leading-relaxed mt-4">{estimate.rationale}</p>}
            <p className="text-[#8A8A99] text-xs mt-3">Estimate based on market data — gets sharper as Shapi&apos;s verified placement data grows.</p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button onClick={useAsExpectations} disabled={saveState === 'saving'}
                className="flex-1 py-3.5 rounded-full font-black text-sm text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #06B6D4, #7C3AED)' }}>
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved to your profile' : 'Use these as my expectations →'}
              </button>
              <Link href="/signup" className="flex-1 py-3.5 rounded-full font-bold text-sm text-center text-[#0E0E1A]" style={{ border: '1px solid rgba(14,14,26,0.12)', background: '#fff' }}>
                Build my verified profile →
              </Link>
            </div>
          </div>
        )}

        <p className="text-center text-[#8A8A99] text-xs">
          Want a band employers actually trust? <Link href="/signup" className="font-bold" style={{ color: '#0891B2' }}>Get verified on Shapi</Link>.
        </p>
      </div>
    </div>
  )
}
