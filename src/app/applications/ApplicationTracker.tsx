'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CANDIDATE_PARAMS = ['Compensation', 'Role & responsibilities', 'Company & trust', 'Growth & progression', 'Culture & work-life']
const STAGE_ORDER = ['matched', 'shortlisted', 'interviewing', 'offer', 'hired']
const STAGE_LABEL: Record<string, string> = { matched: 'Matched', shortlisted: 'Shortlisted', interviewing: 'Interviewing', offer: 'Offer', hired: 'Hired', passed: 'Passed' }

type Role = { id: string; title: string; location: string | null; salary_min: number | null; salary_max: number | null; salary_currency: string | null; engagement_type: string | null }
type App = { id: string; role_id: string; stage: string; candidate_scorecard: Record<string, number> | null; role: Role | null; company_name: string }

function avg(sc: Record<string, number> | null): number | null {
  if (!sc) return null
  const vals = CANDIDATE_PARAMS.map(p => sc[p]).filter(v => typeof v === 'number')
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

export default function ApplicationTracker({ applications }: { applications: App[] }) {
  const router = useRouter()
  const [scoring, setScoring] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const save = async (role_id: string, scorecard: Record<string, number>) => {
    setBusy(role_id)
    await fetch('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id, candidate_scorecard: scorecard }) })
    setBusy(null); setScoring(null)
    router.refresh()
  }

  // Rank by the candidate's own score (their preference) — highest first
  const sorted = [...applications].sort((a, b) => (avg(b.candidate_scorecard) ?? -1) - (avg(a.candidate_scorecard) ?? -1))

  return (
    <div className="space-y-4">
      {sorted.map((a, idx) => {
        const score = avg(a.candidate_scorecard)
        const isScoring = scoring === a.role_id
        const passed = a.stage === 'passed'
        const stageIdx = STAGE_ORDER.indexOf(a.stage)
        return (
          <div key={a.id} className="bg-white rounded-2xl p-6" style={{ border: '1px solid rgba(14,14,26,0.08)', boxShadow: '0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05)' }}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[#0E0E1A] font-black text-lg">{idx === 0 && score != null ? '⭐ ' : ''}{a.role?.title || 'Role'}</h3>
                  {a.role?.engagement_type && a.role.engagement_type !== 'permanent' && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(167,139,250,0.14)', color: '#7C3AED' }}>{a.role.engagement_type === 'temp' ? 'Temp / Shift' : 'Contract'}</span>
                  )}
                </div>
                <p className="text-[#5A5A6E] text-sm">{a.company_name}{a.role?.location ? ` · ${a.role.location}` : ''}</p>
                {a.role?.salary_min && a.role?.salary_max && (
                  <p className="text-[#0891B2] text-sm font-bold mt-0.5">{a.role.salary_currency} {a.role.salary_min.toLocaleString()}–{a.role.salary_max.toLocaleString()}</p>
                )}
              </div>
              {score != null && (
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-black" style={{ color: '#7C3AED' }}>{score}</div>
                  <div className="text-[#8A8A99] text-[10px]">your score</div>
                </div>
              )}
            </div>

            {/* Stage tracker */}
            {passed ? (
              <div className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4" style={{ background: 'rgba(14,14,26,0.05)', color: '#8A8A99' }}>Not progressed</div>
            ) : (
              <div className="flex items-center gap-1 mb-4">
                {STAGE_ORDER.map((s, i) => (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full" style={{ background: i <= stageIdx ? 'linear-gradient(135deg,#06B6D4,#7C3AED)' : 'rgba(14,14,26,0.10)' }} />
                      <span className="text-[9px] mt-1 font-semibold" style={{ color: i <= stageIdx ? '#3F3F4E' : '#B0B0BC' }}>{STAGE_LABEL[s]}</span>
                    </div>
                    {i < STAGE_ORDER.length - 1 && <div className="h-0.5 flex-1 mx-1" style={{ background: i < stageIdx ? 'linear-gradient(135deg,#06B6D4,#7C3AED)' : 'rgba(14,14,26,0.10)' }} />}
                  </div>
                ))}
              </div>
            )}

            {/* Scorecard */}
            {isScoring ? (
              <CandidateScoreEditor initial={a.candidate_scorecard} busy={busy === a.role_id} onCancel={() => setScoring(null)} onSave={sc => save(a.role_id, sc)} />
            ) : (
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#0E0E1A]/[0.06]">
                {a.candidate_scorecard ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    {CANDIDATE_PARAMS.map(p => a.candidate_scorecard?.[p] != null && (
                      <span key={p} className="text-[11px] text-[#8A8A99]">{p}: <span className="text-[#3F3F4E] font-bold">{a.candidate_scorecard![p]}/5</span></span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#8A8A99] text-xs">Score this opportunity to compare it against your others.</p>
                )}
                <button onClick={() => setScoring(a.role_id)} className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(6,182,212,0.10)', color: '#0891B2' }}>
                  {a.candidate_scorecard ? 'Edit' : 'Score it'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CandidateScoreEditor({ initial, onSave, onCancel, busy }: { initial: Record<string, number> | null; onSave: (sc: Record<string, number>) => void; onCancel: () => void; busy: boolean }) {
  const [scores, setScores] = useState<Record<string, number>>(initial || {})
  return (
    <div className="space-y-3 pt-3 border-t border-[#0E0E1A]/[0.06]">
      {CANDIDATE_PARAMS.map(p => (
        <div key={p}>
          <p className="text-[#5A5A6E] text-xs font-semibold mb-1">{p}</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setScores(s => ({ ...s, [p]: n }))}
                className="flex-1 text-xs font-bold rounded-lg py-1.5"
                style={scores[p] === n
                  ? { background: 'linear-gradient(135deg,#06B6D4,#7C3AED)', color: '#fff' }
                  : { background: '#F7F8FB', border: '1px solid rgba(14,14,26,0.10)', color: '#8A8A99' }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={() => onSave(scores)} disabled={busy} className="flex-1 text-sm font-black text-white rounded-full py-2.5 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#06B6D4,#7C3AED)' }}>{busy ? 'Saving…' : 'Save score'}</button>
        <button onClick={onCancel} className="text-sm font-bold rounded-full py-2.5 px-4" style={{ background: 'rgba(14,14,26,0.04)', color: '#8A8A99' }}>Cancel</button>
      </div>
    </div>
  )
}
