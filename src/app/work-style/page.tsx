'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QUESTIONS, DIMENSIONS, styleLabel, scoreWorkStyle } from '@/lib/work-style'

const SCALE = [
  { v: 1, label: 'Strongly disagree' },
  { v: 2, label: 'Disagree' },
  { v: 3, label: 'Neutral' },
  { v: 4, label: 'Agree' },
  { v: 5, label: 'Strongly agree' },
]

export default function WorkStylePage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState('')

  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === QUESTIONS.length

  const submit = async () => {
    setSaving(true)
    setError('')
    const res = await fetch('/api/work-style', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    })
    const d = await res.json().catch(() => ({}))
    setSaving(false)
    if (res.ok && d.work_style) setDone(d.work_style.scores)
    else setError(d.error || 'Could not save — try again')
  }

  // Local preview if they want to see before save (uses same scorer)
  const previewScores = done || (allAnswered ? scoreWorkStyle(answers) : null)

  return (
    <div className="min-h-screen bg-[#F1F2F7] text-[#0E0E1A]">
      <style>{`.gradient-border-card { background: linear-gradient(#ffffff,#ffffff) padding-box, linear-gradient(135deg, rgba(34,211,238,0.12), rgba(139,92,246,0.12)) border-box; border: 1px solid transparent; box-shadow: 0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05); }`}</style>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(14,14,26,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <nav className="relative z-10 px-6 py-4 border-b border-[#0E0E1A]/[0.08] flex items-center justify-between max-w-3xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#A78BFA,#22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/profile" className="text-[#8A8A99] text-sm hover:text-[#3F3F4E]">Profile</Link>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-8 pb-20">
        <h1 className="text-3xl font-black mb-2">Work-style check</h1>
        <p className="text-[#5A5A6E] text-sm mb-1">Optional · ~2 minutes. How you <em>prefer</em> to work — added to your profile as a self-assessment (◆ Shapi-assessed).</p>
        <p className="text-[#8A8A99] text-xs mb-6">There are no right answers. Be honest — it helps companies see fit, not just skills.</p>

        {done ? (
          <div className="gradient-border-card rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-[#0E0E1A] font-black text-lg">Your Work Style</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#EDE9FE', color: '#6D28D9' }}>◆ Shapi-assessed</span>
            </div>
            {DIMENSIONS.map(d => (
              <ScoreBar key={d.key} dim={d} score={done[d.key] ?? 50} />
            ))}
            <Link href="/profile" className="block text-center mt-5 py-3 rounded-xl font-black text-sm" style={{ background: 'linear-gradient(135deg,#22D3EE,#A78BFA)', color: '#060609' }}>
              View on your profile →
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {QUESTIONS.map((q, i) => (
                <div key={q.id} className="gradient-border-card rounded-2xl p-4">
                  <p className="text-[#0E0E1A] text-sm font-bold mb-3">{i + 1}. {q.text}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {SCALE.map(s => {
                      const active = answers[q.id] === s.v
                      return (
                        <button key={s.v} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: s.v }))}
                          className="flex-1 min-w-[80px] py-2 rounded-lg text-[11px] font-bold transition-colors"
                          style={{
                            background: active ? 'rgba(34,211,238,0.15)' : 'rgba(14,14,26,0.04)',
                            color: active ? '#0891B2' : '#5A5A6E',
                            border: `1px solid ${active ? 'rgba(34,211,238,0.4)' : 'rgba(14,14,26,0.08)'}`,
                          }}>
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {previewScores && !done && (
              <div className="gradient-border-card rounded-2xl p-5 mb-6">
                <p className="text-[#5A5A6E] text-xs font-bold uppercase tracking-wider mb-3">Preview</p>
                {DIMENSIONS.map(d => <ScoreBar key={d.key} dim={d} score={previewScores[d.key] ?? 50} />)}
              </div>
            )}

            {error && <p className="text-[#E11D48] text-xs mb-3">{error}</p>}
            <button onClick={submit} disabled={!allAnswered || saving}
              className="w-full py-3.5 rounded-xl font-black text-sm transition-opacity disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#22D3EE,#A78BFA)', color: '#060609' }}>
              {saving ? 'Saving…' : allAnswered ? 'Save to my profile' : `Answer all ${QUESTIONS.length} (${answeredCount} done)`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ScoreBar({ dim, score }: { dim: { key: string; poleA: string; poleB: string; blurb: string }; score: number }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-[#5A5A6E]">{dim.poleB}</span>
        <span className="text-[#0E0E1A] font-bold">{styleLabel(dim, score)}</span>
        <span className="text-[#5A5A6E]">{dim.poleA}</span>
      </div>
      <div className="relative h-2 rounded-full" style={{ background: 'rgba(14,14,26,0.04)' }}>
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full" style={{ left: `calc(${score}% - 6px)`, background: 'linear-gradient(135deg,#22D3EE,#A78BFA)' }} />
      </div>
    </div>
  )
}
