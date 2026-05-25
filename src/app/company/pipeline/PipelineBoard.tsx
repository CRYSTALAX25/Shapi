'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const COMPANY_PARAMS = ['Skills & experience', 'Communication', 'Culture / team fit', 'Motivation & drive', 'Growth potential']
const STAGES = [
  { key: 'matched', label: 'Interested', color: '#F08CAE' },
  { key: 'shortlisted', label: 'Shortlisted', color: '#6AA8F5' },
  { key: 'interviewing', label: 'Interviewing', color: '#F08CAE' },
  { key: 'offer', label: 'Offer', color: '#FBBF24' },
  { key: 'hired', label: 'Hired', color: '#6AA8F5' },
  { key: 'passed', label: 'Passed', color: '#7E7E8E' },
]

type Candidate = { id: string; full_name: string | null; headline: string | null; location: string | null; verification_tier: string | null; completion_pct: number | null }
type Interview = { scheduled_at: string | null; video_platform: string | null; meeting_link: string | null; location: string | null; status: string | null }
type Feedback = { rating: number | null; move_forward: boolean | null; notes: string | null }
type App = {
  id: string
  candidate_id: string
  stage: string
  company_scorecard: Record<string, number> | null
  candidate: Candidate | null
  interview: Interview | null
  feedback: Feedback | null
  reliability: { avg: number; count: number } | null
}

const PLATFORM_LABEL: Record<string, string> = { google_meet: 'Google Meet', zoom: 'Zoom', teams: 'Teams', in_person: 'In person', other: 'Video' }

function fmtWhen(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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
  const [booking, setBooking] = useState<string | null>(null)
  const [feedbacking, setFeedbacking] = useState<string | null>(null)

  const saveFeedback = async (candidate_id: string, fb: { rating: number; move_forward: boolean; notes: string }) => {
    setBusy(candidate_id)
    await fetch('/api/interview-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id: roleId, candidate_id, ...fb }) })
    setBusy(null); setFeedbacking(null)
    router.refresh()
  }

  const saveInterview = async (candidate_id: string, iv: { scheduled_at: string; video_platform: string; meeting_link: string; location: string }) => {
    setBusy(candidate_id)
    await fetch('/api/interviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id: roleId, candidate_id, ...iv }) })
    setBusy(null); setBooking(null)
    router.refresh()
  }

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
      <div className="bg-[#16161F] rounded-2xl p-10 text-center" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-[#F4F4F7] font-bold mb-1">No candidates in the pipeline for {roleTitle}</p>
        <p className="text-[#7E7E8E] text-sm mb-4">Shortlist candidates from the Candidates view and they&apos;ll appear here.</p>
        <Link href="/company/dashboard" className="inline-block text-white text-sm font-bold px-5 py-2.5 rounded-full" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)' }}>Find candidates →</Link>
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
          <div key={stage.key} className="rounded-2xl p-3" style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-black uppercase tracking-wider" style={{ color: stage.color }}>{stage.label}</span>
              <span className="text-[#8A8A99] text-xs font-bold">{inStage.length}</span>
            </div>
            <div className="space-y-2.5">
              {inStage.map((a, idx) => {
                const c = a.candidate
                const score = avg(a.company_scorecard)
                const isScoring = scoring === a.candidate_id
                const isBooking = booking === a.candidate_id
                const isFeedbacking = feedbacking === a.candidate_id
                const iv = a.interview
                const fb = a.feedback
                return (
                  <div key={a.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[#F4F4F7] font-bold text-sm truncate">{idx === 0 && score != null ? '🥇 ' : ''}{c?.full_name || 'Candidate'}</p>
                        <p className="text-[#7E7E8E] text-[11px] truncate">{c?.headline || '—'}</p>
                        {a.reliability && a.reliability.count > 0 && (
                          <p className="text-[10px] font-bold mt-0.5" style={{ color: '#6AA8F5' }}>✓ {a.reliability.avg}/5 interview rating ({a.reliability.count})</p>
                        )}
                      </div>
                      {score != null && (
                        <span className="flex-shrink-0 text-xs font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(240,140,174,0.12)', color: '#F08CAE' }}>{score}</span>
                      )}
                    </div>

                    {/* Score breakdown when present */}
                    {a.company_scorecard && !isScoring && (
                      <div className="mt-2 space-y-0.5">
                        {COMPANY_PARAMS.map(p => a.company_scorecard?.[p] != null && (
                          <div key={p} className="flex items-center justify-between">
                            <span className="text-[#7E7E8E] text-[10px] truncate">{p}</span>
                            <span className="text-[#C7C7D1] text-[10px] font-bold">{a.company_scorecard![p]}/5</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Booked interview */}
                    {iv?.scheduled_at && !isScoring && !isBooking && (
                      <div className="mt-2 rounded-lg px-2 py-1.5" style={{ background: 'rgba(240,140,174,0.08)' }}>
                        <p className="text-[11px] font-bold text-[#F08CAE]">📅 {fmtWhen(iv.scheduled_at)}{iv.video_platform ? ` · ${PLATFORM_LABEL[iv.video_platform] || 'Video'}` : ''}</p>
                        {iv.video_platform === 'in_person'
                          ? iv.location && <p className="text-[10px] text-[#7E7E8E]">📍 {iv.location}</p>
                          : iv.meeting_link && <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-[#6AA8F5]">Join call →</a>}
                      </div>
                    )}

                    {/* Scorecard editor */}
                    {isScoring && (
                      <ScoreEditor initial={a.company_scorecard} onCancel={() => setScoring(null)} onSave={sc => saveScore(a.candidate_id, sc)} busy={busy === a.candidate_id} />
                    )}

                    {/* Interview editor */}
                    {isBooking && (
                      <InterviewEditor initial={iv} busy={busy === a.candidate_id} onCancel={() => setBooking(null)} onSave={data => saveInterview(a.candidate_id, data)} />
                    )}

                    {/* Your feedback (summary) */}
                    {fb && (fb.rating != null || fb.move_forward != null) && !isFeedbacking && !isScoring && !isBooking && (
                      <div className="mt-2 rounded-lg px-2 py-1.5" style={{ background: 'rgba(106,168,245,0.08)' }}>
                        <p className="text-[11px] font-bold" style={{ color: '#6AA8F5' }}>
                          Your feedback: {fb.rating != null ? `${fb.rating}/5` : '—'}{fb.move_forward != null ? ` · ${fb.move_forward ? 'Move forward' : 'Pass'}` : ''}
                        </p>
                      </div>
                    )}

                    {/* Feedback editor */}
                    {isFeedbacking && (
                      <FeedbackEditor initial={fb} busy={busy === a.candidate_id} onCancel={() => setFeedbacking(null)} onSave={data => saveFeedback(a.candidate_id, data)} />
                    )}

                    {!isScoring && !isBooking && !isFeedbacking && (
                      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                        <button onClick={() => setScoring(a.candidate_id)} className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(106,168,245,0.10)', color: '#6AA8F5' }}>
                          {a.company_scorecard ? 'Edit score' : 'Score'}
                        </button>
                        <button onClick={() => setBooking(a.candidate_id)} className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(240,140,174,0.10)', color: '#F08CAE' }}>
                          {iv?.scheduled_at ? 'Reschedule' : 'Interview'}
                        </button>
                        <button onClick={() => setFeedbacking(a.candidate_id)} className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(106,168,245,0.10)', color: '#6AA8F5' }}>
                          {fb ? 'Edit feedback' : 'Feedback'}
                        </button>
                        <Link href={`/candidates/${a.candidate_id}`} className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: '#C7C7D1' }}>View</Link>
                        <Link href={`/company/prep/${roleId}/${a.candidate_id}`} className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(240,140,174,0.10)', color: '#F08CAE' }}>Prep brief</Link>
                        <select
                          value={a.stage}
                          disabled={busy === a.candidate_id}
                          onChange={e => move(a.candidate_id, e.target.value)}
                          className="ml-auto text-[11px] font-bold rounded-lg px-1.5 py-1 bg-[#16161F]"
                          style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#C7C7D1' }}>
                          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
              {inStage.length === 0 && <p className="text-[#5C5C6A] text-[11px] text-center py-3">—</p>}
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
          <p className="text-[#A6A6B4] text-[10px] font-semibold mb-1">{p}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setScores(s => ({ ...s, [p]: n }))}
                className="flex-1 text-[11px] font-bold rounded py-1"
                style={scores[p] === n
                  ? { background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)', color: '#fff' }
                  : { background: '#16161F', border: '1px solid rgba(255,255,255,0.12)', color: '#7E7E8E' }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(scores)} disabled={busy} className="flex-1 text-[11px] font-black text-white rounded-lg py-1.5 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)' }}>{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={onCancel} className="text-[11px] font-bold rounded-lg py-1.5 px-3" style={{ background: 'rgba(255,255,255,0.05)', color: '#7E7E8E' }}>Cancel</button>
      </div>
    </div>
  )
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

function InterviewEditor({ initial, onSave, onCancel, busy }: { initial: Interview | null; onSave: (d: { scheduled_at: string; video_platform: string; meeting_link: string; location: string }) => void; onCancel: () => void; busy: boolean }) {
  const [when, setWhen] = useState(toLocalInput(initial?.scheduled_at || null))
  const [platform, setPlatform] = useState(initial?.video_platform || 'google_meet')
  const [link, setLink] = useState(initial?.meeting_link || '')
  const [loc, setLoc] = useState(initial?.location || '')
  const inputStyle = { background: '#16161F', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 8px', fontSize: 11, width: '100%', color: '#F4F4F7' } as const
  return (
    <div className="mt-2 space-y-2">
      <div>
        <p className="text-[#A6A6B4] text-[10px] font-semibold mb-1">Date &amp; time</p>
        <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={inputStyle} />
      </div>
      <div>
        <p className="text-[#A6A6B4] text-[10px] font-semibold mb-1">Where</p>
        <select value={platform} onChange={e => setPlatform(e.target.value)} style={inputStyle}>
          <option value="google_meet">Google Meet</option>
          <option value="zoom">Zoom</option>
          <option value="teams">Teams</option>
          <option value="in_person">In person</option>
          <option value="other">Other video</option>
        </select>
      </div>
      {platform === 'in_person' ? (
        <input value={loc} onChange={e => setLoc(e.target.value)} placeholder="Address / location" style={inputStyle} />
      ) : (
        <input value={link} onChange={e => setLink(e.target.value)} placeholder="Paste meeting link" style={inputStyle} />
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave({ scheduled_at: when ? new Date(when).toISOString() : '', video_platform: platform, meeting_link: link, location: loc })} disabled={busy || !when}
          className="flex-1 text-[11px] font-black text-white rounded-lg py-1.5 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)' }}>{busy ? 'Saving…' : 'Book interview'}</button>
        <button onClick={onCancel} className="text-[11px] font-bold rounded-lg py-1.5 px-3" style={{ background: 'rgba(255,255,255,0.05)', color: '#7E7E8E' }}>Cancel</button>
      </div>
    </div>
  )
}

function FeedbackEditor({ initial, onSave, onCancel, busy }: { initial: Feedback | null; onSave: (d: { rating: number; move_forward: boolean; notes: string }) => void; onCancel: () => void; busy: boolean }) {
  const [rating, setRating] = useState<number>(initial?.rating ?? 0)
  const [forward, setForward] = useState<boolean | null>(initial?.move_forward ?? null)
  const [notes, setNotes] = useState(initial?.notes || '')
  return (
    <div className="mt-2 space-y-2">
      <p className="text-[#A6A6B4] text-[10px] font-semibold">Interview rating</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => setRating(n)} className="flex-1 text-[11px] font-bold rounded py-1"
            style={rating === n ? { background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)', color: '#fff' } : { background: '#16161F', border: '1px solid rgba(255,255,255,0.12)', color: '#7E7E8E' }}>{n}</button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => setForward(true)} className="flex-1 text-[11px] font-bold rounded py-1.5"
          style={forward === true ? { background: 'rgba(106,168,245,0.15)', color: '#6AA8F5', border: '1px solid rgba(106,168,245,0.4)' } : { background: '#16161F', border: '1px solid rgba(255,255,255,0.12)', color: '#7E7E8E' }}>Move forward</button>
        <button onClick={() => setForward(false)} className="flex-1 text-[11px] font-bold rounded py-1.5"
          style={forward === false ? { background: 'rgba(245,142,154,0.12)', color: '#F58E9A', border: '1px solid rgba(245,142,154,0.4)' } : { background: '#16161F', border: '1px solid rgba(255,255,255,0.12)', color: '#7E7E8E' }}>Pass</button>
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Private notes (optional)"
        style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 8px', fontSize: 11, width: '100%', color: '#F4F4F7', resize: 'vertical' }} />
      <div className="flex gap-2">
        <button onClick={() => onSave({ rating, move_forward: forward ?? false, notes })} disabled={busy || rating === 0}
          className="flex-1 text-[11px] font-black text-white rounded-lg py-1.5 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)' }}>{busy ? 'Saving…' : 'Save feedback'}</button>
        <button onClick={onCancel} className="text-[11px] font-bold rounded-lg py-1.5 px-3" style={{ background: 'rgba(255,255,255,0.05)', color: '#7E7E8E' }}>Cancel</button>
      </div>
    </div>
  )
}
