'use client'

import { useState } from 'react'
import Link from 'next/link'

type Benchmark = {
  currency?: string
  min?: number
  max?: number
  median?: number
  notes?: string
  sources?: string
}

const LEVELS = ['Junior', 'Mid', 'Senior', 'Lead'] as const
type Level = (typeof LEVELS)[number]

export default function SalaryBenchmark() {
  const [role, setRole] = useState('')
  const [country, setCountry] = useState('')
  const [level, setLevel] = useState<Level | ''>('')

  const [bm, setBm] = useState<Benchmark | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const fmt = (n?: number) =>
    typeof n === 'number'
      ? n.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })
      : '—'

  const submit = async () => {
    if (!role.trim()) { setErr('Add the role first.'); return }
    if (!country.trim()) { setErr('Add the country first.'); return }
    setLoading(true); setErr(''); setBm(null)
    try {
      const res = await fetch('/api/company/salary-benchmark', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, country, level }),
      })
      // Parse defensively — a timeout returns HTML 504, not JSON.
      const raw = await res.text()
      let d: { benchmark?: Benchmark; error?: string } = {}
      try { d = JSON.parse(raw) } catch {
        setErr((res.status === 504 || /timeout|gateway/i.test(raw))
          ? 'Took too long — tap again, it usually works on the second try.'
          : `Server error (${res.status}) — try again in a moment.`)
        return
      }
      if (!res.ok || !d.benchmark) { setErr(d.error || 'Could not build a band — try again.'); return }
      setBm(d.benchmark)
    } catch { setErr('Connection dropped — try again.') } finally { setLoading(false) }
  }

  const inputCls =
    'w-full mt-1 rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50'
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
  const labelCls = 'text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider'
  const cardStyle = { background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }

  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/dashboard" className="text-[#A6A6B4] text-sm hover:text-[#F4F4F7]">← Dashboard</Link>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-2" style={{ color: '#FB7185' }}>Salary benchmark</h1>
        <p className="text-[#A6A6B4] text-sm mb-6">What&apos;s a competitive annual offer for this role in this country? Type the role, the country and (optionally) a level — we&apos;ll suggest an indicative band in local currency. All figures are approximate and vary by company size, equity, visa context and sector.</p>

        {/* Inputs */}
        <div className="rounded-2xl p-5 mb-6" style={cardStyle}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Role</label>
              <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Backend engineer, Marketing manager"
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. UAE, Saudi Arabia, UK"
                className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div className="mt-4">
            <p className={`${labelCls} mb-2`}>Level (optional)</p>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map(l => {
                const active = level === l
                return (
                  <button key={l} type="button"
                    onClick={() => setLevel(active ? '' : l)}
                    className="text-xs font-bold px-3 py-1.5 rounded-full transition-opacity"
                    style={
                      active
                        ? { background: 'rgba(106,168,245,0.20)', color: '#6AA8F5', border: '1px solid rgba(106,168,245,0.45)' }
                        : { background: 'rgba(255,255,255,0.05)', color: '#A6A6B4', border: '1px solid rgba(255,255,255,0.08)' }
                    }>
                    {l}
                  </button>
                )
              })}
            </div>
          </div>

          <button onClick={submit} disabled={loading || !role.trim() || !country.trim()}
            className="mt-5 w-full sm:w-auto px-6 py-3 rounded-full font-black text-sm text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
            {loading ? 'Building band…' : '💰 Get salary band'}
          </button>
          {err && <p className="text-[#F58E9A] text-xs mt-3">{err}</p>}
        </div>

        {/* Result */}
        {bm && (
          <div className="rounded-2xl p-6" style={cardStyle}>
            <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-1">
              Indicative annual band{level ? ` · ${level}` : ''} · {country}
            </p>
            <p className="text-[#F4F4F7] text-sm font-bold mb-4">{role}</p>

            {/* Big band */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
              <span className="text-[#7E7E8E] text-sm font-bold">{bm.currency || ''}</span>
              <span className="text-3xl md:text-4xl font-black tracking-tighter" style={{ color: '#6AA8F5' }}>
                {fmt(bm.min)}
              </span>
              <span className="text-[#7E7E8E] text-2xl font-black">–</span>
              <span className="text-3xl md:text-4xl font-black tracking-tighter" style={{ color: '#6AA8F5' }}>
                {fmt(bm.max)}
              </span>
            </div>

            {/* Median */}
            {typeof bm.median === 'number' && (
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4"
                style={{ background: 'rgba(240,140,174,0.12)', border: '1px solid rgba(240,140,174,0.3)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#F08CAE' }}>Median</span>
                <span className="text-sm font-black" style={{ color: '#F08CAE' }}>{bm.currency || ''} {fmt(bm.median)}</span>
              </div>
            )}

            {/* Notes */}
            {bm.notes && (
              <p className="text-[#C7C7D1] text-sm leading-relaxed mb-3">{bm.notes}</p>
            )}

            {/* Sources / caveat */}
            <p className="text-[#7E7E8E] text-[11px] leading-relaxed pt-3 border-t border-white/[0.08]">
              ⚠️ {bm.sources || 'Indicative range — confirm against your hiring market'}. Approximate figures; varies by company size, equity, visa context and sector.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
