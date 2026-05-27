'use client'

import { useState } from 'react'
import Link from 'next/link'

type Report = {
  score: number
  verdict: 'safe' | 'caution' | 'high-risk'
  why: string
  tasks_at_risk: string[]
  tasks_resilient: string[]
  augment_with_ai: string[]
  redesign_suggestion: string
}

const verdictMeta = (v: Report['verdict']) => {
  if (v === 'safe') return { color: '#34D399', label: 'AI-resilient', emoji: '🛡️' }
  if (v === 'caution') return { color: '#FBBF24', label: 'Needs redesign', emoji: '⚠️' }
  return { color: '#F58E9A', label: 'High automation risk', emoji: '🔴' }
}

export default function RoleAIProof() {
  const [title, setTitle] = useState('')
  const [country, setCountry] = useState('')
  const [description, setDescription] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const run = async () => {
    if (!title.trim() || !description.trim()) {
      setErr('Add the role title and paste the job description.')
      return
    }
    setLoading(true); setErr(''); setReport(null)
    try {
      const res = await fetch('/api/role/ai-proof', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, country }),
      })
      const raw = await res.text()
      let d: Partial<Report> & { error?: string } = {}
      try { d = JSON.parse(raw) } catch {
        setErr((res.status === 504 || /timeout|gateway/i.test(raw))
          ? 'Took too long — try again, it usually works on the second attempt.'
          : `Server error (${res.status}) — try again in a moment.`)
        return
      }
      if (!res.ok || typeof d.score !== 'number') { setErr(d.error || 'Could not score that role'); return }
      setReport(d as Report)
    } catch { setErr('Connection dropped — try again.') } finally { setLoading(false) }
  }

  const meta = report ? verdictMeta(report.verdict) : null
  const pct = report ? Math.round((report.score / 10) * 100) : 0

  const inputCls = 'w-full mt-1 rounded-lg px-3 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/50'
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
  const labelCls = 'text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider'
  const cardStyle = { background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }

  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7]">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/company/dashboard" className="text-[#A6A6B4] text-sm hover:text-[#F4F4F7]">← Dashboard</Link>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-20">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-3" style={{ color: '#FB7185' }}>Is this role AI-proof?</h1>
        <p className="text-[#A6A6B4] text-base mb-8 max-w-2xl">Paste a job description and we&apos;ll score how AI-resistant the role is — and where to augment vs redesign.</p>

        <div className="rounded-2xl p-5 mb-6" style={cardStyle}>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>Role title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Customer Success Manager"
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls}>Country (optional)</label>
              <input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. UAE, UK, USA"
                className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Job description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Paste the full JD — responsibilities, day-to-day tasks, requirements…"
              rows={10}
              className={`${inputCls} resize-y min-h-[200px]`} style={inputStyle} />
          </div>
          <button onClick={run} disabled={loading || !title.trim() || !description.trim()}
            className="mt-4 w-full sm:w-auto px-6 py-3 rounded-full font-black text-sm text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
            {loading ? 'Reading the role…' : 'Score this role →'}
          </button>
          {err && <p className="text-[#F58E9A] text-xs mt-3">{err}</p>}
        </div>

        {report && meta && (
          <div className="space-y-5">
            {/* Score card */}
            <div className="rounded-2xl p-6" style={{ background: '#16161F', border: `1px solid ${meta.color}55` }}>
              <div className="flex items-baseline gap-3 mb-3">
                <p className="text-6xl font-black" style={{ color: meta.color }}>{report.score}<span className="text-2xl text-[#7E7E8E]">/10</span></p>
                <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ background: `${meta.color}26`, color: meta.color }}>{meta.emoji} {meta.label}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
              </div>
              {report.why && <p className="text-[#C7C7D1] text-sm leading-relaxed">{report.why}</p>}
            </div>

            {/* Tasks at risk + resilient */}
            <div className="grid sm:grid-cols-2 gap-4">
              {report.tasks_at_risk?.length > 0 && (
                <div className="rounded-2xl p-5" style={cardStyle}>
                  <p className="text-[#F58E9A] text-[10px] font-bold uppercase tracking-wider mb-2">🤖 Tasks AI can do</p>
                  <ul className="space-y-1.5">{report.tasks_at_risk.map((t, i) => <li key={i} className="text-[#C7C7D1] text-xs leading-relaxed">• {t}</li>)}</ul>
                </div>
              )}
              {report.tasks_resilient?.length > 0 && (
                <div className="rounded-2xl p-5" style={cardStyle}>
                  <p className="text-[#34D399] text-[10px] font-bold uppercase tracking-wider mb-2">🛡️ Tasks AI can&apos;t</p>
                  <ul className="space-y-1.5">{report.tasks_resilient.map((t, i) => <li key={i} className="text-[#C7C7D1] text-xs leading-relaxed">• {t}</li>)}</ul>
                </div>
              )}
            </div>

            {/* Augment with AI */}
            {report.augment_with_ai?.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: 'rgba(106,168,245,0.08)', border: '1px solid rgba(106,168,245,0.2)' }}>
                <p className="text-[#6AA8F5] text-[10px] font-bold uppercase tracking-wider mb-2">⚡ Augment with AI</p>
                <ul className="space-y-1.5">{report.augment_with_ai.map((s, i) => <li key={i} className="text-[#C7C7D1] text-xs leading-relaxed flex gap-2"><span className="text-[#6AA8F5]">•</span><span>{s}</span></li>)}</ul>
              </div>
            )}

            {/* Redesign */}
            {report.redesign_suggestion && (
              <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.10), rgba(251,191,36,0.08))', border: '1px solid rgba(167,139,250,0.25)' }}>
                <p className="text-[#A78BFA] text-[10px] font-bold uppercase tracking-wider mb-2">🧬 Redesign suggestion</p>
                <p className="text-[#F4F4F7] text-sm leading-relaxed">{report.redesign_suggestion}</p>
              </div>
            )}

            <p className="text-[#7E7E8E] text-[10px] leading-relaxed">
              Sources: <span className="text-[#A6A6B4]">Anthropic/OpenAI published model capabilities · WEF Future of Jobs · O*NET task taxonomy · Shapi platform data</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
