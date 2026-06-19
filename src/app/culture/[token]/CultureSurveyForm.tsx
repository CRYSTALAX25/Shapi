'use client'

import { useState } from 'react'

type Scale = 1 | 2 | 3 | 4 | 5 | null

// The 8 universal statements (asked of everyone). `exit_handled` is appended
// only for past employees. Each is a positive statement rated 1 (strongly
// disagree) → 5 (strongly agree), so the whole rubric aggregates on one scale.
const UNIVERSAL: { key: string; statement: string }[] = [
  { key: 'paid_on_time', statement: 'I was paid on time, every time.' },
  { key: 'real_hours', statement: 'My working hours were respected.' },
  { key: 'manager_quality', statement: 'My direct manager was fair and supportive.' },
  { key: 'promise_kept', statement: 'The job matched what I was promised when I joined.' },
  { key: 'respect_safety', statement: 'I was treated with respect and could raise concerns safely.' },
  { key: 'growth', statement: 'I had real chances to grow and be recognised.' },
  { key: 'fair_treatment', statement: 'People were treated fairly, regardless of background.' },
  { key: 'would_recommend', statement: "I'd recommend working here to someone I respect." },
]

const PAST_ONLY: { key: string; statement: string } = {
  key: 'exit_handled',
  statement: 'When people left or roles were cut, it was handled fairly.',
}

function ScaleRow({
  statement,
  value,
  onChange,
}: {
  statement: string
  value: Scale
  onChange: (v: Scale) => void
}) {
  return (
    <div className="mb-6">
      <p className="text-[#F4F4F7] font-bold text-base mb-3">{statement}</p>
      <div className="grid grid-cols-5 gap-2">
        {([1, 2, 3, 4, 5] as const).map(n => {
          const active = value === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="rounded-xl py-3 px-2 text-center transition-all"
              style={{
                background: active ? 'rgba(56,189,248,0.16)' : 'rgba(255,255,255,0.04)',
                border: active ? '1px solid rgba(56,189,248,0.55)' : '1px solid rgba(255,255,255,0.08)',
                color: active ? '#38BDF8' : '#C7C7D1',
                fontWeight: active ? 900 : 600,
                cursor: 'pointer',
              }}
              aria-pressed={active}
            >
              <span className="block text-lg leading-none">{n}</span>
            </button>
          )
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-[#5C5C6A]">Strongly disagree</span>
        <span className="text-[10px] text-[#5C5C6A]">Strongly agree</span>
      </div>
    </div>
  )
}

export default function CultureSurveyForm({
  token,
  companyName,
  respondentType,
}: {
  token: string
  companyName: string
  respondentType?: 'current' | 'past' | null
}) {
  // exit_handled is only meaningful for someone who has left.
  const dimensions = respondentType === 'past' ? [...UNIVERSAL, PAST_ONLY] : UNIVERSAL

  const [ratings, setRatings] = useState<Record<string, Scale>>({})
  const [periodWorked, setPeriodWorked] = useState('')
  const [improveCulture, setImproveCulture] = useState('')
  const [bestThing, setBestThing] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Ready once all 8 UNIVERSAL statements are answered (exit_handled optional).
  const ready = UNIVERSAL.every(d => ratings[d.key] != null)
  const answeredCount = UNIVERSAL.filter(d => ratings[d.key] != null).length

  const setRating = (key: string, v: Scale) => setRatings(prev => ({ ...prev, [key]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/culture/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...Object.fromEntries(dimensions.map(d => [d.key, ratings[d.key]])),
          period_worked: periodWorked.trim() || null,
          improve_culture: improveCulture.trim() || null,
          best_thing: bestThing.trim() || null,
          consent_ack: true,
        }),
      })
      if (res.status === 410) {
        setError('This link has already been used.')
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Something went wrong. Try again in a moment.')
        return
      }
      setDone(true)
    } catch {
      setError('Network error. Try again in a moment.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div
        className="rounded-2xl p-6 mt-2"
        style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)' }}
      >
        <p className="text-[#34D399] font-black text-xl mb-2">Thank you.</p>
        <p className="text-[#C7C7D1] text-sm leading-relaxed">
          Your response is anonymous and helps every candidate making a decision about {companyName}.
          You can close this tab.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      {dimensions.map(d => (
        <ScaleRow key={d.key} statement={d.statement} value={ratings[d.key] ?? null} onChange={v => setRating(d.key, v)} />
      ))}

      <div className="mb-5">
        <label className="block text-[#F4F4F7] font-bold text-sm mb-2">When did you work there?</label>
        <input
          type="text"
          value={periodWorked}
          onChange={e => setPeriodWorked(e.target.value)}
          placeholder="e.g. 2020–2023, or current"
          className="w-full rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F4F4F7', outline: 'none' }}
        />
      </div>

      <div className="mb-5">
        <label className="block text-[#F4F4F7] font-bold text-sm mb-2">
          What would most improve the culture here? <span className="text-[#7E7E8E] font-normal">(optional)</span>
        </label>
        <textarea
          value={improveCulture}
          onChange={e => setImproveCulture(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder="Honest and constructive — the one change that would matter most."
          className="w-full rounded-xl px-4 py-3 text-sm resize-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F4F4F7', outline: 'none' }}
        />
      </div>

      <div className="mb-6">
        <label className="block text-[#F4F4F7] font-bold text-sm mb-2">
          What&apos;s the best thing about working here? <span className="text-[#7E7E8E] font-normal">(optional)</span>
        </label>
        <textarea
          value={bestThing}
          onChange={e => setBestThing(e.target.value)}
          rows={2}
          maxLength={600}
          placeholder="What someone joining should look forward to."
          className="w-full rounded-xl px-4 py-3 text-sm resize-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F4F4F7', outline: 'none' }}
        />
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 mb-4 text-sm"
          style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.3)', color: '#FB7185' }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!ready || submitting}
        className="w-full rounded-full py-4 text-sm font-black tracking-tight transition-all"
        style={{
          background: ready && !submitting ? 'linear-gradient(135deg,#38BDF8, #34D399)' : 'rgba(255,255,255,0.06)',
          color: ready && !submitting ? '#060609' : '#7E7E8E',
          cursor: ready && !submitting ? 'pointer' : 'not-allowed',
          border: 'none',
        }}
      >
        {submitting ? 'Submitting…' : ready ? 'Submit anonymously →' : `${answeredCount} of ${UNIVERSAL.length} answered`}
      </button>

      <p className="text-[#5C5C6A] text-[11px] mt-4 leading-relaxed text-center">
        Completely anonymous. {companyName} only ever sees the combined averages — never your individual answers,
        and never that you took part.
      </p>
    </form>
  )
}
