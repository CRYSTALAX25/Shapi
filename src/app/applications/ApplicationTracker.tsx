'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CANDIDATE_PARAMS = ['Compensation', 'Role & responsibilities', 'Company & trust', 'Growth & progression', 'Culture & work-life']
const STAGE_ORDER = ['matched', 'shortlisted', 'interviewing', 'offer', 'hired']
const STAGE_LABEL: Record<string, string> = { matched: 'Matched', shortlisted: 'Shortlisted', interviewing: 'Interviewing', offer: 'Offer', hired: 'Hired', passed: 'Passed' }

type Role = { id: string; title: string; location: string | null; salary_min: number | null; salary_max: number | null; salary_currency: string | null; engagement_type: string | null }
type Interview = { scheduled_at: string | null; video_platform: string | null; meeting_link: string | null; location: string | null; status: string | null }
type Feedback = { rating: number | null; move_forward: boolean | null; notes: string | null }
type App = { id: string; role_id: string; stage: string; candidate_scorecard: Record<string, number> | null; role: Role | null; company_name: string; interview: Interview | null; feedback: Feedback | null }

const PLATFORM_LABEL: Record<string, string> = { google_meet: 'Google Meet', zoom: 'Zoom', teams: 'Teams', in_person: 'In person', other: 'Video' }
function fmtWhen(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function avg(sc: Record<string, number> | null): number | null {
  if (!sc) return null
  const vals = CANDIDATE_PARAMS.map(p => sc[p]).filter(v => typeof v === 'number')
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

export default function ApplicationTracker({ applications }: { applications: App[] }) {
  const router = useRouter()
  const [scoring, setScoring] = useState<string | null>(null)
  const [feedbacking, setFeedbacking] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const save = async (role_id: string, scorecard: Record<string, number>) => {
    setBusy(role_id)
    await fetch('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id, candidate_scorecard: scorecard }) })
    setBusy(null); setScoring(null)
    router.refresh()
  }

  const saveFeedback = async (role_id: string, fb: { rating: number; move_forward: boolean; notes: string }) => {
    setBusy(role_id)
    await fetch('/api/interview-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id, ...fb }) })
    setBusy(null); setFeedbacking(null)
    router.refresh()
  }

  // Rank by the candidate's own score (their preference) — highest first
  const sorted = [...applications].sort((a, b) => (avg(b.candidate_scorecard) ?? -1) - (avg(a.candidate_scorecard) ?? -1))

  return (
    <div className="space-y-4">
      {sorted.map((a, idx) => {
        const score = avg(a.candidate_scorecard)
        const isScoring = scoring === a.role_id
        const isFeedbacking = feedbacking === a.role_id
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

            {/* Booked interview */}
            {a.interview?.scheduled_at && (
              <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <div>
                  <p className="text-[#7C3AED] text-sm font-bold">📅 Interview · {fmtWhen(a.interview.scheduled_at)}</p>
                  <p className="text-[#8A8A99] text-xs">
                    {a.interview.video_platform === 'in_person'
                      ? (a.interview.location ? `📍 ${a.interview.location}` : 'In person')
                      : PLATFORM_LABEL[a.interview.video_platform || 'other'] || 'Video call'}
                  </p>
                </div>
                {a.interview.video_platform !== 'in_person' && a.interview.meeting_link && (
                  <a href={a.interview.meeting_link} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 text-white text-xs font-black px-4 py-2 rounded-full" style={{ background: 'linear-gradient(135deg,#06B6D4,#7C3AED)' }}>
                    Join call →
                  </a>
                )}
              </div>
            )}

            {/* Post-interview feedback (candidate) */}
            {a.interview?.scheduled_at && (
              isFeedbacking ? (
                <CandidateFeedbackEditor initial={a.feedback} busy={busy === a.role_id} onCancel={() => setFeedbacking(null)} onSave={fb => saveFeedback(a.role_id, fb)} />
              ) : (
                <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  {a.feedback && (a.feedback.rating != null || a.feedback.move_forward != null) ? (
                    <p className="text-sm font-bold" style={{ color: '#059669' }}>Your feedback: {a.feedback.rating != null ? `${a.feedback.rating}/5` : '—'}{a.feedback.move_forward != null ? ` · ${a.feedback.move_forward ? 'Keen to continue' : 'Not for me'}` : ''}</p>
                  ) : (
                    <p className="text-[#3F3F4E] text-sm">How did the interview go? Your feedback stays private and helps us improve matches.</p>
                  )}
                  <button onClick={() => setFeedbacking(a.role_id)} className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                    {a.feedback ? 'Edit' : 'Give feedback'}
                  </button>
                </div>
              )
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

function CandidateFeedbackEditor({ initial, onSave, onCancel, busy }: { initial: Feedback | null; onSave: (fb: { rating: number; move_forward: boolean; notes: string }) => void; onCancel: () => void; busy: boolean }) {
  const [rating, setRating] = useState<number>(initial?.rating ?? 0)
  const [forward, setForward] = useState<boolean | null>(initial?.move_forward ?? null)
  const [notes, setNotes] = useState(initial?.notes || '')
  return (
    <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: '#F7F8FB', border: '1px solid rgba(14,14,26,0.08)' }}>
      <p className="text-[#3F3F4E] text-sm font-bold">How did the interview go?</p>
      <div>
        <p className="text-[#5A5A6E] text-xs font-semibold mb-1">Your rating</p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setRating(n)} className="flex-1 text-xs font-bold rounded-lg py-1.5"
              style={rating === n ? { background: 'linear-gradient(135deg,#06B6D4,#7C3AED)', color: '#fff' } : { background: '#fff', border: '1px solid rgba(14,14,26,0.10)', color: '#8A8A99' }}>{n}</button>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => setForward(true)} className="flex-1 text-xs font-bold rounded-lg py-2"
          style={forward === true ? { background: 'rgba(16,185,129,0.15)', color: '#059669', border: '1px solid rgba(16,185,129,0.4)' } : { background: '#fff', border: '1px solid rgba(14,14,26,0.10)', color: '#8A8A99' }}>Keen to continue</button>
        <button onClick={() => setForward(false)} className="flex-1 text-xs font-bold rounded-lg py-2"
          style={forward === false ? { background: 'rgba(225,29,72,0.12)', color: '#E11D48', border: '1px solid rgba(225,29,72,0.4)' } : { background: '#fff', border: '1px solid rgba(14,14,26,0.10)', color: '#8A8A99' }}>Not for me</button>
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Anything you'd flag? (private)"
        style={{ background: '#fff', border: '1px solid rgba(14,14,26,0.10)', borderRadius: 10, padding: '8px 10px', fontSize: 13, width: '100%', color: '#0E0E1A', resize: 'vertical' }} />
      <div className="flex gap-2">
        <button onClick={() => onSave({ rating, move_forward: forward ?? false, notes })} disabled={busy || rating === 0}
          className="flex-1 text-sm font-black text-white rounded-full py-2.5 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#06B6D4,#7C3AED)' }}>{busy ? 'Saving…' : 'Save feedback'}</button>
        <button onClick={onCancel} className="text-sm font-bold rounded-full py-2.5 px-4" style={{ background: 'rgba(14,14,26,0.04)', color: '#8A8A99' }}>Cancel</button>
      </div>
    </div>
  )
}
