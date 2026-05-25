'use client'

import { useState } from 'react'
import Link from 'next/link'

type Pivot = { to_role?: string; why?: string }
type Report = {
  role?: string; ai_risk?: number; risk_label?: string; verdict?: string
  at_risk_tasks?: string[]; human_strengths?: string[]; pivots?: Pivot[]
}

const riskColor = (n: number) => (n >= 7 ? '#F58E9A' : n >= 4 ? '#F08CAE' : '#6AA8F5')

export default function AIProof() {
  const [role, setRole] = useState('')
  const [about, setAbout] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const run = async () => {
    if (!role.trim()) return
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/ai-proof', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, about }),
      })
      const d = await res.json()
      if (!res.ok) { setErr(d.error || 'Something went wrong'); return }
      setReport(d.report)
    } catch { setErr('Network error — try again') } finally { setLoading(false) }
  }

  const risk = report?.ai_risk ?? 0
  const rc = riskColor(risk)

  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      <nav className="relative z-10 px-6 py-4 flex items-center justify-between max-w-3xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/signup" className="grad-border-cta px-4 py-2 rounded-full text-sm font-black" style={{ background: 'linear-gradient(#0E0E13,#0E0E13) padding-box, linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A) border-box', border: '1.5px solid transparent', color: '#F4F4F7' }}>Get started →</Link>
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-20">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#6AA8F5] animate-pulse" />
            <span className="text-[#A6A6B4] text-xs font-medium">Free · 30 seconds · no signup</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-3" style={{ color: '#FB7185' }}>Is your job AI-proof?</h1>
          <p className="text-[#A6A6B4] text-base max-w-lg mx-auto">Get an honest read on where AI is heading for your role — and the smartest moves to stay ahead.</p>
        </div>

        <div className="rounded-2xl p-5 mb-6" style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }}>
          <input value={role} onChange={e => setRole(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="Your job title (e.g. Plumber, Data Entry Clerk, Marketing Manager)"
            className="w-full rounded-lg px-3 py-3 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
          <input value={about} onChange={e => setAbout(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="Optional: a line on what you actually do day-to-day"
            className="w-full mt-2 rounded-lg px-3 py-3 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
          <button onClick={run} disabled={loading || !role.trim()} className="mt-3 w-full py-3 rounded-full font-black text-sm text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
            {loading ? 'Reading the market…' : 'Check my AI risk →'}
          </button>
          {err && <p className="text-[#F58E9A] text-xs mt-3">{err}</p>}
        </div>

        {report && (
          <div className="space-y-5">
            {/* Risk dial */}
            <div className="rounded-2xl p-6 text-center" style={{ background: '#16161F', border: `1px solid ${rc}55` }}>
              <p className="text-[#7E7E8E] text-xs font-bold uppercase tracking-wider mb-2">{report.role}</p>
              <p className="text-6xl font-black" style={{ color: rc }}>{risk}<span className="text-2xl text-[#7E7E8E]">/10</span></p>
              <p className="text-sm font-black mt-1" style={{ color: rc }}>{report.risk_label} automation risk</p>
              {report.verdict && <p className="text-[#C7C7D1] text-sm leading-relaxed mt-3 max-w-md mx-auto">{report.verdict}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {report.at_risk_tasks && report.at_risk_tasks.length > 0 && (
                <div className="rounded-2xl p-5" style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-[#F58E9A] text-[10px] font-bold uppercase tracking-wider mb-2">⚠️ AI is already doing</p>
                  <ul className="space-y-1.5">{report.at_risk_tasks.map((x, i) => <li key={i} className="text-[#C7C7D1] text-xs">• {x}</li>)}</ul>
                </div>
              )}
              {report.human_strengths && report.human_strengths.length > 0 && (
                <div className="rounded-2xl p-5" style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-[#6AA8F5] text-[10px] font-bold uppercase tracking-wider mb-2">🛡️ AI can&apos;t replace</p>
                  <ul className="space-y-1.5">{report.human_strengths.map((x, i) => <li key={i} className="text-[#C7C7D1] text-xs">• {x}</li>)}</ul>
                </div>
              )}
            </div>

            {report.pivots && report.pivots.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-[#A6A6B4] text-[10px] font-bold uppercase tracking-wider mb-3">🧭 Your smartest next moves</p>
                <div className="space-y-2">
                  {report.pivots.map((p, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <p className="text-[#F4F4F7] font-bold text-sm">{p.to_role}</p>
                      {p.why && <p className="text-[#A6A6B4] text-xs mt-0.5">{p.why}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gated CTA */}
            <div className="rounded-2xl p-6 text-center" style={{ background: 'linear-gradient(135deg, rgba(106,168,245,0.12), rgba(240,140,174,0.10))', border: '1px solid rgba(240,140,174,0.25)' }}>
              <p className="text-[#F4F4F7] font-black text-lg mb-1">Want the full plan?</p>
              <p className="text-[#A6A6B4] text-sm mb-4 max-w-md mx-auto">Build your free Shapi profile to unlock the salary forecast, exact courses with timelines, and live roles hiring for your pivot.</p>
              <Link href="/signup" className="inline-block px-7 py-3 rounded-full font-black text-sm text-white" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
                Get my full pivot plan — free →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
