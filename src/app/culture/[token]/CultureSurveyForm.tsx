'use client'

import { useState } from 'react'

type Scale = 1 | 2 | 3 | 4 | 5 | null

const SCALE_LABELS: Record<Exclude<Scale, null>, string> = {
  1: 'Never',
  2: 'Rarely',
  3: 'Sometimes',
  4: 'Usually',
  5: 'Always',
}

function ScaleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: Scale
  onChange: (v: Scale) => void
}) {
  return (
    <div className="mb-6">
      <p className="text-[#F4F4F7] font-bold text-base mb-1">{label}</p>
      <p className="text-[#7E7E8E] text-xs mb-3">{description}</p>
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
                background: active ? 'rgba(251,113,133,0.18)' : 'rgba(255,255,255,0.04)',
                border: active
                  ? '1px solid rgba(251,113,133,0.55)'
                  : '1px solid rgba(255,255,255,0.08)',
                color: active ? '#FB7185' : '#C7C7D1',
                fontWeight: active ? 900 : 600,
                cursor: 'pointer',
              }}
              aria-pressed={active}
            >
              <span className="block text-lg leading-none">{n}</span>
              <span className="block text-[10px] mt-1 opacity-80">{SCALE_LABELS[n]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function CultureSurveyForm({
  token,
  companyName,
}: {
  token: string
  companyName: string
}) {
  const [paidOnTime, setPaidOnTime] = useState<Scale>(null)
  const [realHours, setRealHours] = useState<Scale>(null)
  const [managerQuality, setManagerQuality] = useState<Scale>(null)
  const [periodWorked, setPeriodWorked] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const ready = paidOnTime !== null && realHours !== null && managerQuality !== null

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
          paid_on_time: paidOnTime,
          real_hours: realHours,
          manager_quality: managerQuality,
          period_worked: periodWorked.trim() || null,
          notes: notes.trim() || null,
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
      <div className="rounded-2xl p-6 mt-2" style={{
        background: 'rgba(52,211,153,0.06)',
        border: '1px solid rgba(52,211,153,0.25)',
      }}>
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
      <ScaleRow
        label="Paid on time"
        description="How reliably did salary land on its scheduled date?"
        value={paidOnTime}
        onChange={setPaidOnTime}
      />
      <ScaleRow
        label="Real hours respected"
        description="Did the hours you actually worked match what was agreed?"
        value={realHours}
        onChange={setRealHours}
      />
      <ScaleRow
        label="Manager quality"
        description="How good was your direct manager — clarity, feedback, support?"
        value={managerQuality}
        onChange={setManagerQuality}
      />

      <div className="mb-5">
        <label className="block text-[#F4F4F7] font-bold text-sm mb-2">
          When did you work there?
        </label>
        <input
          type="text"
          value={periodWorked}
          onChange={e => setPeriodWorked(e.target.value)}
          placeholder="e.g. 2020–2023, or current"
          className="w-full rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#F4F4F7',
            outline: 'none',
          }}
        />
      </div>

      <div className="mb-6">
        <label className="block text-[#F4F4F7] font-bold text-sm mb-2">
          Anything else worth saying? <span className="text-[#7E7E8E] font-normal">(optional, 1–2 sentences)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder="Kept it short and concrete — what someone joining should know."
          className="w-full rounded-xl px-4 py-3 text-sm resize-none"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#F4F4F7',
            outline: 'none',
          }}
        />
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 mb-4 text-sm"
          style={{
            background: 'rgba(251,113,133,0.08)',
            border: '1px solid rgba(251,113,133,0.3)',
            color: '#FB7185',
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!ready || submitting}
        className="w-full rounded-full py-4 text-sm font-black tracking-tight transition-all"
        style={{
          background: ready && !submitting
            ? 'linear-gradient(135deg,#FB7185,#F08CAE)'
            : 'rgba(255,255,255,0.06)',
          color: ready && !submitting ? '#0E0E13' : '#7E7E8E',
          cursor: ready && !submitting ? 'pointer' : 'not-allowed',
          border: 'none',
        }}
      >
        {submitting ? 'Submitting…' : 'Submit anonymously →'}
      </button>

      <p className="text-[#5C5C6A] text-[11px] mt-4 leading-relaxed text-center">
        Your IP is recorded only to flag obvious manipulation (the company submitting on your behalf).
        Your individual answers are never shown to {companyName}.
      </p>
    </form>
  )
}
