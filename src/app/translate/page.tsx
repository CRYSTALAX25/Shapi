'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { courseSearchUrl } from '@/lib/upskill'

type Course = { name?: string; platform?: string }
type Step = { step: string; why?: string; course?: Course; hours?: number; priority?: string }
type Translation = {
  from_role?: string; from_collar?: string; to_role?: string; to_collar?: string
  track?: 'pivot' | 'shield' | 'cross-collar'
  country?: string; currency?: string
  from_pay_range?: string; to_pay_year1_range?: string; to_pay_year3_range?: string
  current_ai_risk?: number; target_ai_resilience?: number
  salary_year1_change_pct?: number; salary_year3_change_pct?: number; salary_note?: string
  transferable_skills?: string[]; roadmap?: Step[]; total_hours?: number
  business?: { viable?: boolean; note?: string }; insight?: string
}

const PACE: Record<string, { label: string; hpw: number }> = {
  sprint: { label: 'Sprint · ~25h/wk', hpw: 25 },
  steady: { label: 'Steady · ~5h/wk', hpw: 5 },
  bite: { label: 'Bite-size · ~2h/wk', hpw: 2 },
}

const TRACK: Record<string, { label: string; color: string; blurb: string }> = {
  pivot: { label: 'PIVOT', color: '#F58E9A', blurb: 'Moving out of a higher-risk role into something more durable.' },
  shield: { label: 'SHIELD', color: '#6AA8F5', blurb: 'Your trade is AI-resilient — this is about levelling up and earning more, not escaping.' },
  'cross-collar': { label: 'CROSS-COLLAR', color: '#F08CAE', blurb: 'Crossing white ↔ blue using the experience you already have.' },
}

export default function CareerTranslator() {
  const [fromRole, setFromRole] = useState('')
  const [toRole, setToRole] = useState('')
  const [country, setCountry] = useState('')
  const [pace, setPace] = useState<'sprint' | 'steady' | 'bite'>('steady')
  const [t, setT] = useState<Translation | null>(null)
  const [loading, setLoading] = useState(false)
  const [booting, setBooting] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/career/translate')
      .then(r => r.json())
      .then(d => {
        setFromRole(d.from_role || '')
        setCountry(d.country || '')
        if (d.translation) { setT(d.translation); if (d.translation.to_role) setToRole(d.translation.to_role) }
      })
      .catch(() => {})
      .finally(() => setBooting(false))
  }, [])

  const run = async () => {
    if (!toRole.trim()) return
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/career/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_role: fromRole, to_role: toRole, country }),
      })
      const d = await res.json()
      if (!res.ok) { setErr(d.error || 'Could not map that move'); return }
      setT(d.translation)
    } catch { setErr('Network error — try again') } finally { setLoading(false) }
  }

  const weeks = (hours: number) => Math.max(1, Math.ceil(hours / PACE[pace].hpw))
  const y1 = t?.salary_year1_change_pct ?? 0
  const y3 = t?.salary_year3_change_pct ?? 0
  const pct = (n: number) => `${n > 0 ? '+' : ''}${n}%`
  const tr = t?.track ? TRACK[t.track] : null

  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/dashboard" className="text-[#A6A6B4] text-sm hover:text-[#F4F4F7]">← Dashboard</Link>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-2">Career Translator</h1>
        <p className="text-[#A6A6B4] text-sm mb-6">Tell me where you are and where you want to go. I&apos;ll show the money reality, the track, and the fastest path — no jargon.</p>

        {/* From → To */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <div>
              <label className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider">From</label>
              <input value={fromRole} onChange={e => setFromRole(e.target.value)} placeholder={booting ? 'Loading…' : 'Your current role'}
                className="w-full mt-1 rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
            </div>
            <div className="hidden sm:flex items-center justify-center pb-2.5 text-[#6AA8F5] text-xl">→</div>
            <div>
              <label className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider">To</label>
              <input value={toRole} onChange={e => setToRole(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="Role you're curious about"
                className="w-full mt-1 rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
            </div>
          </div>
          <div className="mt-3">
            <label className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider">Country (for accurate local pay)</label>
            <input value={country} onChange={e => setCountry(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="e.g. UAE, Saudi Arabia, UK"
              className="w-full mt-1 rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>
          <button onClick={run} disabled={loading || !toRole.trim()} className="mt-4 w-full sm:w-auto px-6 py-3 rounded-full font-black text-sm text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
            {loading ? 'Mapping your move…' : '🧭 Map my move'}
          </button>
          {err && <p className="text-[#F58E9A] text-xs mt-3">{err}</p>}
        </div>

        {t && (
          <div className="space-y-5">
            {/* Track + insight */}
            <div className="rounded-2xl p-5" style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3 mb-2">
                {tr && <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{ background: `${tr.color}1f`, color: tr.color }}>{tr.label}</span>}
                <p className="text-[#F4F4F7] font-bold text-sm">{t.from_role} → {t.to_role}</p>
              </div>
              {tr && <p className="text-[#7E7E8E] text-xs mb-2">{tr.blurb}</p>}
              {t.insight && <p className="text-[#C7C7D1] text-sm leading-relaxed">{t.insight}</p>}
            </div>

            {/* Financial reality */}
            <div className="rounded-2xl p-5" style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-4">📊 Financial reality{t.country ? ` · ${t.country}` : ''} (vs your pay today)</p>
              {(t.from_pay_range || t.to_pay_year1_range || t.to_pay_year3_range) && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[['Now', t.from_pay_range], ['Year 1', t.to_pay_year1_range], ['Year 3', t.to_pay_year3_range]].map(([lbl, val]) => (
                    <div key={lbl as string} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <p className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider">{lbl}</p>
                      <p className="text-[#F4F4F7] text-sm font-black mt-0.5">{(val as string) || '—'}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-3xl font-black" style={{ color: y1 < 0 ? '#F58E9A' : '#6AA8F5' }}>{pct(y1)}</p>
                  <p className="text-[#7E7E8E] text-xs mt-0.5">Year 1{y1 < 0 ? ' (the dip)' : ''}</p>
                </div>
                <div>
                  <p className="text-3xl font-black" style={{ color: '#6AA8F5' }}>{pct(y3)}</p>
                  <p className="text-[#7E7E8E] text-xs mt-0.5">Year 3 forecast</p>
                </div>
              </div>
              {t.salary_note && <p className="text-[#A6A6B4] text-xs leading-relaxed">💡 {t.salary_note}</p>}
              {(typeof t.current_ai_risk === 'number' || typeof t.target_ai_resilience === 'number') && (
                <div className="flex gap-4 mt-4 pt-4 border-t border-white/[0.08] text-xs">
                  <span className="text-[#7E7E8E]">Current AI risk: <strong style={{ color: '#F58E9A' }}>{t.current_ai_risk}/10</strong></span>
                  <span className="text-[#7E7E8E]">Target resilience: <strong style={{ color: '#6AA8F5' }}>{t.target_ai_resilience}/10</strong></span>
                </div>
              )}
            </div>

            {/* Transferable skills */}
            {t.transferable_skills && t.transferable_skills.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-3">✓ What you already bring</p>
                <div className="flex flex-wrap gap-2">
                  {t.transferable_skills.map((s, i) => (
                    <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(106,168,245,0.12)', color: '#6AA8F5' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Roadmap + pace */}
            {t.roadmap && t.roadmap.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider">📚 Your roadmap</p>
                  <div className="flex gap-1">
                    {(Object.keys(PACE) as Array<keyof typeof PACE>).map(k => (
                      <button key={k} onClick={() => setPace(k as 'sprint' | 'steady' | 'bite')}
                        className="text-[10px] font-bold px-2 py-1 rounded-full transition-colors"
                        style={pace === k ? { background: 'rgba(106,168,245,0.15)', color: '#6AA8F5' } : { background: 'rgba(255,255,255,0.05)', color: '#7E7E8E' }}>
                        {PACE[k].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {t.roadmap.map((s, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[#F4F4F7] font-bold text-sm">{i + 1}. {s.step}</p>
                        {typeof s.hours === 'number' && s.hours > 0 && (
                          <span className="text-[10px] text-[#A6A6B4] flex-shrink-0">⏱️ {s.hours}h · 📅 {weeks(s.hours)}w</span>
                        )}
                      </div>
                      {s.why && <p className="text-[#A6A6B4] text-xs mt-1">{s.why}</p>}
                      {s.course?.name && (
                        <a href={courseSearchUrl(s.course.platform, s.course.name)} target="_blank" rel="noopener noreferrer"
                          className="inline-block mt-2 text-[#6AA8F5] text-xs font-bold hover:underline">⭐ {s.course.name}{s.course.platform ? ` · ${s.course.platform}` : ''} ↗</a>
                      )}
                    </div>
                  ))}
                </div>
                {typeof t.total_hours === 'number' && t.total_hours > 0 && (
                  <p className="text-[#C7C7D1] text-xs font-bold mt-3">⏳ Total: {t.total_hours} study hours · about {weeks(t.total_hours)} weeks at {PACE[pace].label.split('·')[1].trim()}</p>
                )}
              </div>
            )}

            {/* Business */}
            {t.business?.note && (
              <div className="rounded-2xl p-5" style={{ background: 'rgba(240,140,174,0.08)', border: '1px solid rgba(240,140,174,0.2)' }}>
                <p className="text-[#F08CAE] text-[10px] font-bold uppercase tracking-wider mb-1">🏢 Could you run your own business?</p>
                <p className="text-[#C7C7D1] text-sm">{t.business.viable ? '✓ ' : ''}{t.business.note}</p>
                <p className="text-[#7E7E8E] text-[11px] mt-2">Step-by-step business blueprint (licensing, pricing, first clients) coming soon.</p>
              </div>
            )}

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/roles" className="flex-1 text-center px-6 py-3 rounded-full font-black text-sm text-white" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>Find matching roles →</Link>
              <Link href={t.roadmap?.[0]?.step ? `/upskill?skill=${encodeURIComponent(t.roadmap[0].step)}` : '/upskill'} className="flex-1 text-center px-6 py-3 rounded-full font-bold text-sm text-[#F4F4F7]" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>More courses for this move →</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
