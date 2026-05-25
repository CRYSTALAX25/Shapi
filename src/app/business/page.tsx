'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Step = { title?: string; detail?: string }
type Blueprint = {
  field?: string; country?: string
  steps?: Step[]; insurance?: string[]; first_clients?: string[]; note?: string
}

// Rough default currency by country keyword (free-text, user can overwrite).
const CURRENCY_HINTS: { match: string[]; code: string }[] = [
  { match: ['uae', 'emirates', 'dubai', 'abu dhabi'], code: 'AED' },
  { match: ['saudi', 'ksa'], code: 'SAR' },
  { match: ['qatar'], code: 'QAR' },
  { match: ['kuwait'], code: 'KWD' },
  { match: ['bahrain'], code: 'BHD' },
  { match: ['oman'], code: 'OMR' },
  { match: ['uk', 'united kingdom', 'britain', 'england'], code: '£' },
  { match: ['usa', 'united states', 'america'], code: '$' },
  { match: ['india'], code: '₹' },
  { match: ['pakistan'], code: 'PKR' },
  { match: ['philippines'], code: '₱' },
  { match: ['egypt'], code: 'EGP' },
  { match: ['europe', 'germany', 'france', 'spain', 'italy', 'eu'], code: '€' },
]

function guessCurrency(country: string): string {
  const c = country.toLowerCase()
  for (const h of CURRENCY_HINTS) if (h.match.some(m => c.includes(m))) return h.code
  return '$'
}

const PHASES = [
  {
    n: 1,
    title: 'Licensing & compliance',
    color: '#6AA8F5',
    points: [
      'Register the business and pick a legal structure (sole trader vs company).',
      'Get the trade licence / permits your field legally requires.',
      'Sort tax registration, a business bank account, and required insurance.',
    ],
  },
  {
    n: 2,
    title: 'Unit economics',
    color: '#F08CAE',
    points: [
      'Know your true cost per job: labour + materials + overhead.',
      'Set a margin that survives slow months — use the calculator above.',
      'Track every quote vs actual cost so your pricing keeps improving.',
    ],
  },
  {
    n: 3,
    title: 'Customer acquisition',
    color: '#F58E9A',
    points: [
      'Win your first 5 clients through your network — then ask for referrals.',
      'List on local marketplaces and keep a simple before/after portfolio.',
      'Collect reviews early; reputation is the cheapest marketing you have.',
    ],
  },
]

export default function BusinessBlueprint() {
  const [field, setField] = useState('')
  const [country, setCountry] = useState('')

  // Pricing calculator inputs
  const [labour, setLabour] = useState('')
  const [materials, setMaterials] = useState('')
  const [overhead, setOverhead] = useState('20')
  const [margin, setMargin] = useState('30')
  const [currency, setCurrency] = useState('$')
  const [currencyTouched, setCurrencyTouched] = useState(false)

  const [bp, setBp] = useState<Blueprint | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  // Prefill country from career/translate; ignore failures (page works logged-out).
  useEffect(() => {
    fetch('/api/career/translate')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.country) {
          setCountry(d.country)
          if (!currencyTouched) setCurrency(guessCurrency(d.country))
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCountryChange = (v: string) => {
    setCountry(v)
    if (!currencyTouched) setCurrency(guessCurrency(v))
  }

  // Live quote: (labour + materials + overhead) × (1 + margin)
  const labourN = parseFloat(labour) || 0
  const materialsN = parseFloat(materials) || 0
  const overheadN = parseFloat(overhead) || 0
  const marginN = parseFloat(margin) || 0
  const baseCost = labourN + materialsN
  const overheadAmt = baseCost * (overheadN / 100)
  const fullCost = baseCost + overheadAmt
  const quote = fullCost * (1 + marginN / 100)
  const profit = quote - fullCost
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 })

  const getSteps = async () => {
    if (!field.trim() || !country.trim()) {
      setErr('Add your trade and country first.')
      return
    }
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/business', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, country }),
      })
      const d = await res.json()
      if (!res.ok) { setErr(d.error || 'Could not build that blueprint'); return }
      setBp(d.blueprint)
    } catch { setErr('Network error — try again') } finally { setLoading(false) }
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
        <Link href="/translate" className="text-[#A6A6B4] text-sm hover:text-[#F4F4F7]">← Career Translator</Link>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-2">Plan your own business</h1>
        <p className="text-[#A6A6B4] text-sm mb-6">Price your work so it&apos;s sustainable, follow a 3-phase blueprint, then get the exact steps to launch legally in your country.</p>

        {/* (a) Inputs */}
        <div className="rounded-2xl p-5 mb-6" style={cardStyle}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Your trade / field</label>
              <input value={field} onChange={e => setField(e.target.value)} placeholder="e.g. plumbing, catering, web design"
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input value={country} onChange={e => onCountryChange(e.target.value)} placeholder="e.g. UAE, Saudi Arabia, UK"
                className={inputCls} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* (b) Pricing calculator */}
        <div className="rounded-2xl p-5 mb-6" style={cardStyle}>
          <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-1">🧮 Pricing calculator</p>
          <p className="text-[#7E7E8E] text-xs mb-4">What should you charge per job to stay in business? Type your costs — the quote updates live.</p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Labour cost (per job)</label>
              <input value={labour} onChange={e => setLabour(e.target.value)} inputMode="decimal" placeholder="e.g. 200"
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Materials cost (per job)</label>
              <input value={materials} onChange={e => setMaterials(e.target.value)} inputMode="decimal" placeholder="e.g. 120"
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Overhead %</label>
              <input value={overhead} onChange={e => setOverhead(e.target.value)} inputMode="decimal" placeholder="e.g. 20"
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Profit margin %</label>
              <input value={margin} onChange={e => setMargin(e.target.value)} inputMode="decimal" placeholder="e.g. 30"
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Currency label</label>
              <input value={currency} onChange={e => { setCurrency(e.target.value); setCurrencyTouched(true) }} placeholder="e.g. AED, £, $"
                className={inputCls} style={inputStyle} />
            </div>
          </div>

          {/* Formula */}
          <p className="text-[#7E7E8E] text-[11px] mt-4 font-mono leading-relaxed">
            quote = (labour + materials + overhead) × (1 + margin)<br />
            = ({fmt(labourN)} + {fmt(materialsN)} + {fmt(overheadAmt)} overhead) × (1 + {marginN || 0}%)
          </p>

          {/* Live outputs */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <p className={labelCls}>Full cost</p>
              <p className="text-[#F4F4F7] text-sm font-black mt-0.5">{currency} {fmt(fullCost)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <p className={labelCls}>Your profit</p>
              <p className="text-sm font-black mt-0.5" style={{ color: '#F08CAE' }}>{currency} {fmt(profit)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(106,168,245,0.12)', border: '1px solid rgba(106,168,245,0.3)' }}>
              <p className={labelCls}>Quote client</p>
              <p className="text-sm font-black mt-0.5" style={{ color: '#6AA8F5' }}>{currency} {fmt(quote)}</p>
            </div>
          </div>
        </div>

        {/* (c) 3-phase blueprint */}
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          {PHASES.map(p => (
            <div key={p.n} className="rounded-2xl p-5" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full" style={{ background: `${p.color}1f`, color: p.color }}>{p.n}</span>
                <p className="text-[#F4F4F7] font-bold text-sm">{p.title}</p>
              </div>
              <ul className="space-y-2">
                {p.points.map((pt, i) => (
                  <li key={i} className="text-[#A6A6B4] text-xs leading-relaxed flex gap-2">
                    <span style={{ color: p.color }}>•</span><span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* (d) Country-specific steps */}
        <div className="rounded-2xl p-5" style={cardStyle}>
          <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-1">📍 Make it real</p>
          <p className="text-[#7E7E8E] text-xs mb-4">Get the exact licensing, registration body and insurance checklist for your trade in {country.trim() || 'your country'}.</p>
          <button onClick={getSteps} disabled={loading || !field.trim() || !country.trim()}
            className="w-full sm:w-auto px-6 py-3 rounded-full font-black text-sm text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
            {loading ? 'Building your checklist…' : `🚀 Get ${country.trim() || 'country'}-specific steps`}
          </button>
          {err && <p className="text-[#F58E9A] text-xs mt-3">{err}</p>}

          {bp && (
            <div className="mt-5 space-y-4">
              {bp.steps && bp.steps.length > 0 && (
                <div>
                  <p className={`${labelCls} mb-2`}>✓ Steps to launch legally</p>
                  <div className="space-y-2">
                    {bp.steps.map((s, i) => (
                      <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <p className="text-[#F4F4F7] font-bold text-sm">{i + 1}. {s.title}</p>
                        {s.detail && <p className="text-[#A6A6B4] text-xs mt-1 leading-relaxed">{s.detail}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bp.insurance && bp.insurance.length > 0 && (
                <div>
                  <p className={`${labelCls} mb-2`}>🛡️ Insurance & cover</p>
                  <div className="flex flex-wrap gap-2">
                    {bp.insurance.map((s, i) => (
                      <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(106,168,245,0.12)', color: '#6AA8F5' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {bp.first_clients && bp.first_clients.length > 0 && (
                <div>
                  <p className={`${labelCls} mb-2`}>🤝 First clients</p>
                  <ul className="space-y-1.5">
                    {bp.first_clients.map((s, i) => (
                      <li key={i} className="text-[#C7C7D1] text-xs leading-relaxed flex gap-2">
                        <span style={{ color: '#F08CAE' }}>•</span><span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {bp.note && (
                <p className="text-[#A6A6B4] text-xs leading-relaxed pt-2 border-t border-white/[0.08]">💡 {bp.note}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
