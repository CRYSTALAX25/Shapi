'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const COMPANY_PARAMS = ['Skills & experience', 'Communication', 'Culture / team fit', 'Motivation & drive', 'Growth potential']
const STAGES = [
  { key: 'shortlisted', label: 'Shortlisted', color: '#06B6D4' },
  { key: 'interviewing', label: 'Interviewing', color: '#7C3AED' },
  { key: 'offer', label: 'Offer', color: '#D97706' },
  { key: 'hired', label: 'Hired', color: '#059669' },
  { key: 'passed', label: 'Passed', color: '#8A8A99' },
]

type Candidate = { id: string; full_name: string | null; headline: string | null; location: string | null; verification_tier: string | null; completion_pct: number | null }
type App = {
  id: string
  candidate_id: string
  stage: string
  company_scorecard: Record<string, number> | null
  candidate: Candidate | null
}

function avg(sc: Record<string, number> | null): number | null {
  if (!sc) return null
  const vals = COMPANY_PARAMS.map(p => sc[p]).filter(v => typeof v === 'number')
  if (vals.length === 0) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

export default function PipelineBoard({ roleId, roleTitle, applications }: { roleId: string; roleTitle: string; applications: App[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [scoring, setScoring] = useState<string | null>(null)

  const move = async (candidate_id: string, stage: string) => {
    setBusy(candidate_id)
    await fetch('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id: roleId, candidate_id, stage }) })
    setBusy(null)
    router.refresh()
  }

  const saveScore = async (candidate_id: string, scorecard: Record<string, number>) => {
    setBusy(candidate_id)
    await fetch('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id: roleId, candidate_id, company_scorecard: scorecard }) })
    setBusy(null); setScoring(null)
    router.refresh()
  }

  if (applications.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center" style={{ border: '1px solid rgba(14,14,26,0.08)' }}>
        <p className="text-[#0E0E1A] font-bold mb-1">No candidates in the pipeline for {roleTitle}</p>
        <p className="text-[#8A8A99] text-sm mb-4">Shortlist candidates from the Candidates view and they&apos;ll appear here.</p>
        <Link href="/company/dashboard" className="inline-block text-white text-sm font-bold px-5 py-2.5 rounded-full" style={{ background: 'linear-gradient(135deg,#06B6D4,#7C3AED)' }}>Find candidates →</Link>
      </div>
    )
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
      {STAGES.map(stage => {
        const inStage = applications
          .filter(a => a.stage === stage.key)
          .sort((x, y) => (avg(y.company_scorecard) ?? -1) - (avg(x.company_scorecard) ?? -1))
        return (
          <div key={stage.key} className="rounded-2xl p-3" style={{ background: '#fff', border: '1px solid rgba(14,14,26,0.08)' }}>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-black uppercase tracking-wider" style={{ color: stage.color }}>{stage.label}</span>
              <span className="text-[#8A8A99] text-xs font-bold">{inStage.length}</span>
            </div>
            <div className="space-y-2.5">
              {inStage.map((a, idx) => {
                const c = a.candidate
                const score = avg(a.company_scorecard)
                const isScoring = scoring === a.candidate_id
                return (
                  <div key={a.id} className="rounded-xl p-3" style={{ background: '#F7F8FB', border: '1px solid rgba(14,14,26,0.06)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[#0E0E1A] font-bold text-sm truncate">{idx === 0 && score != null ? '🥇 ' : ''}{c?.full_name || 'Candidate'}</p>
                        <p className="text-[#8A8A99] text-[11px] truncate">{c?.headline || '—'}</p>
                      </div>
                      {score != null && (
                        <span className="flex-shrink-0 text-xs font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.12)', color: '#7C3AED' }}>{score}</span>
                      )}
                    </div>

                    {/* Score breakdown when present */}
                    {a.company_scorecard && !isScoring && (
                      <div className="mt-2 space-y-0.5">
                        {COMPANY_PARAMS.map(p => a.company_scorecard?.[p] != null && (
                          <div key={p} className="flex items-center justify-between">
                            <span className="text-[#8A8A99] text-[10px] truncate">{p}</span>
                            <span className="text-[#3F3F4E] text-[10px] font-bold">{a.company_scorecard![p]}/5</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Scorecard editor */}
                    {isScoring && (
                      <ScoreEditor initial={a.company_scorecard} onCancel={() => setScoring(null)} onSave={sc => saveScore(a.candidate_id, sc)} busy={busy === a.candidate_id} />
                    )}

                    {!isScoring && (
                      <div className="flex items-center gap-1.5 mt-2.5">
                        <button onClick={() => setScoring(a.candidate_id)} className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(6,182,212,0.10)', color: '#0891B2' }}>
                          {a.company_scorecard ? 'Edit score' : 'Score'}
                        </button>
                        <Link href={`/candidates/${a.candidate_id}`} className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(14,14,26,0.04)', color: '#3F3F4E' }}>View</Link>
                        <select
                          value={a.stage}
                          disabled={busy === a.candidate_id}
                          onChange={e => move(a.candidate_id, e.target.value)}
                          className="ml-auto text-[11px] font-bold rounded-lg px-1.5 py-1 bg-white"
                          style={{ border: '1px solid rgba(14,14,26,0.12)', color: '#3F3F4E' }}>
                          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
              {inStage.length === 0 && <p className="text-[#B0B0BC] text-[11px] text-center py-3">—</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ScoreEditor({ initial, onSave, onCancel, busy }: { initial: Record<string, number> | null; onSave: (sc: Record<string, number>) => void; onCancel: () => void; busy: boolean }) {
  const [scores, setScores] = useState<Record<string, number>>(initial || {})
  return (
    <div className="mt-2 space-y-2">
      {COMPANY_PARAMS.map(p => (
        <div key={p}>
          <p className="text-[#5A5A6E] text-[10px] font-semibold mb-1">{p}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setScores(s => ({ ...s, [p]: n }))}
                className="flex-1 text-[11px] font-bold rounded py-1"
                style={scores[p] === n
                  ? { background: 'linear-gradient(135deg,#06B6D4,#7C3AED)', color: '#fff' }
                  : { background: '#fff', border: '1px solid rgba(14,14,26,0.12)', color: '#8A8A99' }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(scores)} disabled={busy} className="flex-1 text-[11px] font-black text-white rounded-lg py-1.5 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#06B6D4,#7C3AED)' }}>{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={onCancel} className="text-[11px] font-bold rounded-lg py-1.5 px-3" style={{ background: 'rgba(14,14,26,0.04)', color: '#8A8A99' }}>Cancel</button>
      </div>
    </div>
  )
}
