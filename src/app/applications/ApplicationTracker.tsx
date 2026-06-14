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
          <div key={a.id} className="bg-[#0D0C14] rounded-2xl p-6" style={{ border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)' }}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[#F4F4F7] font-black text-lg">{idx === 0 && score != null ? '⭐ ' : ''}{a.role?.title || 'Role'}</h3>
                  {a.role?.engagement_type && a.role.engagement_type !== 'permanent' && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(56, 189, 248, 0.14)', color: '#38BDF8' }}>{a.role.engagement_type === 'temp' ? 'Temp / Shift' : 'Contract'}</span>
                  )}
                </div>
                <p className="text-[#A6A6B4] text-sm">{a.company_name}{a.role?.location ? ` · ${a.role.location}` : ''}</p>
                {a.role?.salary_min && a.role?.salary_max && (
                  <p className="text-[#38BDF8] text-sm font-bold mt-0.5">{a.role.salary_currency} {a.role.salary_min.toLocaleString()}–{a.role.salary_max.toLocaleString()}</p>
                )}
              </div>
              {score != null && (
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-black" style={{ color: '#38BDF8' }}>{score}</div>
                  <div className="text-[#7E7E8E] text-[10px]">your score</div>
                </div>
              )}
            </div>

            {/* Stage tracker */}
            {passed ? (
              <div className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4" style={{ background: 'rgba(255,255,255,0.05)', color: '#7E7E8E' }}>Not progressed</div>
            ) : (
              <div className="flex items-center gap-1 mb-4">
                {STAGE_ORDER.map((s, i) => (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full" style={{ background: i <= stageIdx ? 'linear-gradient(135deg,#38BDF8, #34D399)' : 'rgba(255,255,255,0.10)' }} />
                      <span className="text-[9px] mt-1 font-semibold" style={{ color: i <= stageIdx ? '#C7C7D1' : '#5C5C6A' }}>{STAGE_LABEL[s]}</span>
                    </div>
                    {i < STAGE_ORDER.length - 1 && <div className="h-0.5 flex-1 mx-1" style={{ background: i < stageIdx ? 'linear-gradient(135deg,#38BDF8, #34D399)' : 'rgba(255,255,255,0.10)' }} />}
                  </div>
                ))}
              </div>
            )}

            {/* Booked interview */}
            {a.interview?.scheduled_at && (
              <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3" style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                <div>
                  <p className="text-[#38BDF8] text-sm font-bold">📅 Interview · {fmtWhen(a.interview.scheduled_at)}</p>
                  <p className="text-[#7E7E8E] text-xs">
                    {a.interview.video_platform === 'in_person'
                      ? (a.interview.location ? `📍 ${a.interview.location}` : 'In person')
                      : PLATFORM_LABEL[a.interview.video_platform || 'other'] || 'Video call'}
                  </p>
                </div>
                {a.interview.video_platform !== 'in_person' && a.interview.meeting_link && (
                  <a href={a.interview.meeting_link} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 text-white text-xs font-black px-4 py-2 rounded-full" style={{ background: 'linear-gradient(135deg,#38BDF8, #34D399)' }}>
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
                <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3" style={{ background: 'rgba(56, 189, 248, 0.07)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                  {a.feedback && (a.feedback.rating != null || a.feedback.move_forward != null) ? (
                    <p className="text-sm font-bold" style={{ color: '#38BDF8' }}>Your feedback: {a.feedback.rating != null ? `${a.feedback.rating}/5` : '—'}{a.feedback.move_forward != null ? ` · ${a.feedback.move_forward ? 'Keen to continue' : 'Not for me'}` : ''}</p>
                  ) : (
                    <p className="text-[#C7C7D1] text-sm">How did the interview go? Your feedback stays private and helps us improve matches.</p>
                  )}
                  <button onClick={() => setFeedbacking(a.role_id)} className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8' }}>
                    {a.feedback ? 'Edit' : 'Give feedback'}
                  </button>
                </div>
              )
            )}

            {/* Scorecard */}
            {isScoring ? (
              <CandidateScoreEditor initial={a.candidate_scorecard} busy={busy === a.role_id} onCancel={() => setScoring(null)} onSave={sc => save(a.role_id, sc)} />
            ) : (
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                {a.candidate_scorecard ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    {CANDIDATE_PARAMS.map(p => a.candidate_scorecard?.[p] != null && (
                      <span key={p} className="text-[11px] text-[#7E7E8E]">{p}: <span className="text-[#C7C7D1] font-bold">{a.candidate_scorecard![p]}/5</span></span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#7E7E8E] text-xs">Score this opportunity to compare it against your others.</p>
                )}
                <button onClick={() => setScoring(a.role_id)} className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(56, 189, 248, 0.10)', color: '#38BDF8' }}>
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
    <div className="space-y-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
      {CANDIDATE_PARAMS.map(p => (
        <div key={p}>
          <p className="text-[#A6A6B4] text-xs font-semibold mb-1">{p}</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setScores(s => ({ ...s, [p]: n }))}
                className="flex-1 text-xs font-bold rounded-lg py-1.5"
                style={scores[p] === n
                  ? { background: 'linear-gradient(135deg,#38BDF8, #34D399)', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#7E7E8E' }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={() => onSave(scores)} disabled={busy} className="flex-1 text-sm font-black text-white rounded-full py-2.5 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#38BDF8, #34D399)' }}>{busy ? 'Saving…' : 'Save score'}</button>
        <button onClick={onCancel} className="text-sm font-bold rounded-full py-2.5 px-4" style={{ background: 'rgba(255,255,255,0.05)', color: '#7E7E8E' }}>Cancel</button>
      </div>
    </div>
  )
}

function CandidateFeedbackEditor({ initial, onSave, onCancel, busy }: { initial: Feedback | null; onSave: (fb: { rating: number; move_forward: boolean; notes: string }) => void; onCancel: () => void; busy: boolean }) {
  const [rating, setRating] = useState<number>(initial?.rating ?? 0)
  const [forward, setForward] = useState<boolean | null>(initial?.move_forward ?? null)
  const [notes, setNotes] = useState(initial?.notes || '')
  return (
    <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-[#C7C7D1] text-sm font-bold">How did the interview go?</p>
      <div>
        <p className="text-[#A6A6B4] text-xs font-semibold mb-1">Your rating</p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setRating(n)} className="flex-1 text-xs font-bold rounded-lg py-1.5"
              style={rating === n ? { background: 'linear-gradient(135deg,#38BDF8, #34D399)', color: '#fff' } : { background: '#0D0C14', border: '1px solid rgba(255,255,255,0.10)', color: '#7E7E8E' }}>{n}</button>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => setForward(true)} className="flex-1 text-xs font-bold rounded-lg py-2"
          style={forward === true ? { background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.4)' } : { background: '#0D0C14', border: '1px solid rgba(255,255,255,0.10)', color: '#7E7E8E' }}>Keen to continue</button>
        <button onClick={() => setForward(false)} className="flex-1 text-xs font-bold rounded-lg py-2"
          style={forward === false ? { background: 'rgba(251, 113, 133, 0.12)', color: '#FB7185', border: '1px solid rgba(251, 113, 133, 0.4)' } : { background: '#0D0C14', border: '1px solid rgba(255,255,255,0.10)', color: '#7E7E8E' }}>Not for me</button>
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Anything you'd flag? (private)"
        style={{ background: '#0D0C14', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '8px 10px', fontSize: 13, width: '100%', color: '#F4F4F7', resize: 'vertical' }} />
      <div className="flex gap-2">
        <button onClick={() => onSave({ rating, move_forward: forward ?? false, notes })} disabled={busy || rating === 0}
          className="flex-1 text-sm font-black text-white rounded-full py-2.5 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#38BDF8, #34D399)' }}>{busy ? 'Saving…' : 'Save feedback'}</button>
        <button onClick={onCancel} className="text-sm font-bold rounded-full py-2.5 px-4" style={{ background: 'rgba(255,255,255,0.05)', color: '#7E7E8E' }}>Cancel</button>
      </div>
    </div>
  )
}
