'use client'

import { useEffect, useState } from 'react'
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
  const [signedIn, setSignedIn] = useState(false)

  // Detect sign-in (and prefill role/location from their profile) via an authed GET.
  useEffect(() => {
    fetch('/api/career/translate')
      .then(r => { if (!r.ok) return null; setSignedIn(true); return r.json() })
      .then(d => {
        if (!d) return
        if (d.from_role) setRole((cur) => cur || d.from_role)
        if (d.country) setLocation(d.country)
      })
      .catch(() => {})
  }, [])

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

  const cardStyle = { border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)' }

  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-5 max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        {signedIn
          ? <Link href="/dashboard" className="text-[#A6A6B4] text-sm hover:text-[#F4F4F7]">← Dashboard</Link>
          : <Link href="/signup" className="text-white text-sm font-bold px-4 py-2 rounded-full" style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)' }}>Get started →</Link>}
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-8 pb-20">
        <div className="text-center mb-8">
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#F08CAE' }}>Free · 30 seconds</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-3">What you&apos;re worth.</h1>
          <p className="text-[#C7C7D1] text-lg max-w-xl mx-auto">A fair salary band for your role — and, if you&apos;re pivoting, a realistic band for the new field too.</p>
        </div>

        {/* Form */}
        <div className="bg-[#16161F] rounded-2xl p-6 mb-6" style={cardStyle}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#7E7E8E] mb-2">Your role</label>
              <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Operations Director"
                className="w-full px-4 py-3 rounded-xl text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5]/60" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#7E7E8E] mb-2">Experience</label>
                <select value={experience} onChange={e => setExperience(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[#F4F4F7] focus:outline-none">
                  {EXPERIENCE.map(x => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#7E7E8E] mb-2">Location</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Dubai, UAE"
                  className="w-full px-4 py-3 rounded-xl text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5]/60" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#7E7E8E] mb-2">Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[#F4F4F7] focus:outline-none">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Pivot toggle */}
            {!showPivot ? (
              <button type="button" onClick={() => setShowPivot(true)} className="text-sm font-bold" style={{ color: '#F08CAE' }}>
                + I&apos;m pivoting into a new field
              </button>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#7E7E8E] mb-2">Pivoting into</label>
                <input value={pivotField} onChange={e => setPivotField(e.target.value)} placeholder="e.g. UX Design"
                  className="w-full px-4 py-3 rounded-xl text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#F08CAE]/60" />
                <p className="text-[#7E7E8E] text-xs mt-1.5">We&apos;ll price your transferable experience fairly — not your senior rate, not nothing.</p>
              </div>
            )}

            {error && <p className="text-[#F58E9A] text-sm bg-[#F58E9A]/[0.08] border border-[#F58E9A]/20 rounded-xl px-4 py-3">{error}</p>}

            <button onClick={run} disabled={loading}
              className="w-full py-4 rounded-full font-black text-sm text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)' }}>
              {loading ? 'Estimating…' : 'Show me my worth →'}
            </button>
          </div>
        </div>

        {/* Result */}
        {estimate && (
          <div className="bg-[#16161F] rounded-2xl p-7 mb-6" style={cardStyle}>
            <div className="flex items-center gap-2.5 mb-5">
              <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#6AA8F5,#F08CAE)' }} />
              <h2 className="text-xl font-black tracking-tight">Your estimate</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(240,140,174,0.12)', color: '#F08CAE' }}>ESTIMATE</span>
            </div>

            {/* Primary band */}
            <div className="rounded-xl p-5 mb-3" style={{ background: 'linear-gradient(135deg, rgba(106,168,245,0.10), rgba(240,140,174,0.10))', border: '1px solid rgba(106,168,245,0.25)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#6AA8F5' }}>{role || 'Your field'} · {experience}</p>
              <p className="text-3xl font-black">
                {estimate.currency} {fmt(estimate.primary.min)}–{fmt(estimate.primary.max)}
                <span className="text-base font-bold text-[#7E7E8E]"> /{estimate.period === 'year' ? 'yr' : 'mo'}</span>
              </p>
              <p className="text-[#7E7E8E] text-xs mt-1">total package · incl. typical allowances</p>
            </div>

            {/* Pivot band */}
            {estimate.pivot && (
              <div className="rounded-xl p-5 mb-3" style={{ background: 'rgba(240,140,174,0.07)', border: '1px solid rgba(240,140,174,0.2)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#F08CAE' }}>Pivot · {estimate.pivot.field}</p>
                <p className="text-2xl font-black">
                  {estimate.currency} {fmt(estimate.pivot.min)}–{fmt(estimate.pivot.max)}
                  <span className="text-sm font-bold text-[#7E7E8E]"> /{estimate.period === 'year' ? 'yr' : 'mo'}</span>
                </p>
                <p className="text-[#7E7E8E] text-xs mt-1">a fair entry band — rises as you build verified experience</p>
              </div>
            )}

            {estimate.rationale && <p className="text-[#C7C7D1] text-sm leading-relaxed mt-4">{estimate.rationale}</p>}
            <p className="text-[#7E7E8E] text-xs mt-3">Estimate based on market data — gets sharper as Shapi&apos;s verified placement data grows.</p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button onClick={useAsExpectations} disabled={saveState === 'saving'}
                className="flex-1 py-3.5 rounded-full font-black text-sm text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)' }}>
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved to your profile' : 'Use these as my expectations →'}
              </button>
              <Link href={signedIn ? '/profile' : '/signup'} className="flex-1 py-3.5 rounded-full font-bold text-sm text-center text-[#F4F4F7]" style={{ border: '1px solid rgba(255,255,255,0.12)', background: '#16161F' }}>
                {signedIn ? 'View my profile →' : 'Build my verified profile →'}
              </Link>
            </div>
          </div>
        )}

        {!signedIn && (
          <p className="text-center text-[#7E7E8E] text-xs">
            Want a band employers actually trust? <Link href="/signup" className="font-bold" style={{ color: '#6AA8F5' }}>Get verified on Shapi</Link>.
          </p>
        )}
      </div>
    </div>
  )
}
