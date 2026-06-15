'use client'

import { useMemo, useState } from 'react'

type Seat = {
  id: string
  title: string
  team_id: string
  person_id: string | null
  status: string
  absorbed_capacity_pct: number | null
}

type Person = { id: string; full_name: string; preferred_name: string | null; status: string }

type Delegation = {
  id: string
  from_seat_id: string
  to_seat_id: string
  activity_id: string | null
  percentage: number
  reason: string | null
  start_date: string
  end_date: string | null
  ai_detected_skills_gained: string[]
  quality_score: number | null
  created_at: string
  updated_at: string
}

const CARD = 'rounded-2xl border p-5'
const CARD_STYLE: React.CSSProperties = { background: '#0D0C14', borderColor: 'rgba(56, 189, 248, 0.18)' }
const HEADING_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }
const BODY_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }
const ACCENT = '#38BDF8'
const CTA_STYLE: React.CSSProperties = { background: '#eef1f6', color: '#060609' }
const INPUT = 'w-full px-3 py-2 rounded-lg text-sm'
const INPUT_STYLE: React.CSSProperties = {
  background: '#060609',
  border: '1px solid rgba(56, 189, 248, 0.20)',
  color: 'rgba(255,255,255,0.9)',
}
const LABEL = 'block text-[10px] font-bold uppercase tracking-wider mb-1'
const LABEL_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function isActive(d: Delegation): boolean {
  return !d.end_date || d.end_date >= today()
}

// Baseline own-workload of a seat. Mirrors the server's computeCapacity():
// stored value if present, else 100 for occupied/active|separating, else 0.
function baselineFor(seat: Seat): number {
  const occupied = !!seat.person_id && (seat.status === 'active' || seat.status === 'separating')
  return seat.absorbed_capacity_pct ?? (occupied ? 100 : 0)
}

function ErrorBanner({ msg, onClear }: { msg: string | null; onClear: () => void }) {
  if (!msg) return null
  return (
    <div
      className="mb-3 p-3 rounded-lg text-xs flex items-start justify-between gap-2"
      style={{ background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.30)', color: '#FB7185' }}
    >
      <span>{msg}</span>
      <button onClick={onClear} className="font-bold">×</button>
    </div>
  )
}

function CapacityBar({ effective }: { effective: number }) {
  const overloaded = effective > 100
  const fill = Math.min(effective, 200) / 2 // 200% maps to full bar width
  const color = overloaded ? '#FB7185' : effective >= 90 ? '#FBBF24' : '#34D399'
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full rounded-full" style={{ width: `${fill}%`, background: color, transition: 'width .2s' }} />
    </div>
  )
}

function seatLabel(seat: Seat, persons: Person[]): string {
  const p = seat.person_id ? persons.find(x => x.id === seat.person_id) : null
  const who = p ? (p.preferred_name || p.full_name) : seat.status === 'vacant' || seat.status === 'planned' ? 'vacant' : '—'
  return `${seat.title} · ${who}`
}

export default function DelegationBoard({
  seats,
  persons,
  initialDelegations,
  planTier,
}: {
  seats: Seat[]
  persons: Person[]
  initialDelegations: Delegation[]
  planTier: string
}) {
  const [delegations, setDelegations] = useState<Delegation[]>(initialDelegations)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Draft delegation form.
  const [fromSeat, setFromSeat] = useState('')
  const [toSeat, setToSeat] = useState('')
  const [pct, setPct] = useState(25)
  const [reason, setReason] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState('')

  const seatById = useMemo(() => {
    const m = new Map<string, Seat>()
    seats.forEach(s => m.set(s.id, s))
    return m
  }, [seats])

  // Effective capacity per seat = baseline + Σ active inbound delegation %.
  // Includes the in-progress draft so the user sees live impact while sliding.
  const capacity = useMemo(() => {
    const inbound = new Map<string, number>()
    for (const d of delegations) {
      if (!isActive(d)) continue
      inbound.set(d.to_seat_id, (inbound.get(d.to_seat_id) || 0) + d.percentage)
    }
    // Live draft preview onto the chosen covering seat.
    if (toSeat && pct > 0) {
      inbound.set(toSeat, (inbound.get(toSeat) || 0) + pct)
    }
    const out = new Map<string, { baseline: number; delegated: number; effective: number; overloaded: boolean }>()
    for (const s of seats) {
      const baseline = baselineFor(s)
      const delegated = inbound.get(s.id) || 0
      const effective = baseline + delegated
      out.set(s.id, { baseline, delegated, effective, overloaded: effective > 100 })
    }
    return out
  }, [delegations, seats, toSeat, pct])

  const draftImpact = toSeat ? capacity.get(toSeat) : null

  // Source candidates: overloaded seats (effective baseline >= 100) or
  // separating/vacant. We surface everyone but tag the priority ones.
  const sourceSeats = useMemo(
    () => seats.filter(s => s.status !== 'planned'),
    [seats],
  )
  const coverSeats = useMemo(
    () => seats.filter(s => s.id !== fromSeat),
    [seats, fromSeat],
  )

  async function createDelegation() {
    if (!fromSeat || !toSeat) { setErr('Pick a source seat and a covering seat.'); return }
    if (fromSeat === toSeat) { setErr('A seat cannot cover for itself.'); return }
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/company/delegation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_seat_id: fromSeat,
          to_seat_id: toSeat,
          percentage: pct,
          reason: reason.trim() || null,
          start_date: startDate,
          end_date: endDate || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Could not create delegation.'); return }
      setDelegations(prev => [data.delegation as Delegation, ...prev])
      // Reset the slice + reason but keep the source for chained delegations.
      setPct(25); setReason(''); setEndDate('')
    } finally {
      setBusy(false)
    }
  }

  async function endDelegation(id: string) {
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/company/delegation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, end_now: true }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Could not end delegation.'); return }
      setDelegations(prev => prev.map(d => (d.id === id ? (data.delegation as Delegation) : d)))
    } finally {
      setBusy(false)
    }
  }

  async function changePct(id: string, percentage: number) {
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/company/delegation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, percentage }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Could not update delegation.'); return }
      setDelegations(prev => prev.map(d => (d.id === id ? (data.delegation as Delegation) : d)))
    } finally {
      setBusy(false)
    }
  }

  const activeDelegations = delegations.filter(isActive)
  const endedDelegations = delegations.filter(d => !isActive(d))

  // ── No spine yet → can't delegate. ──────────────────────────────────────
  if (seats.length < 2) {
    return (
      <div className={CARD} style={CARD_STYLE}>
        <h2 className="text-lg font-black tracking-tight mb-2" style={HEADING_STYLE}>
          Build your spine first
        </h2>
        <p className="text-sm leading-relaxed mb-4" style={BODY_STYLE}>
          Workload delegation moves a slice of one seat&apos;s work onto another. You need at least
          two seats in your org spine before you can delegate. Add seats, then come back.
        </p>
        <a href="/company/spine" className="inline-block px-4 py-2 rounded-lg text-sm font-bold" style={CTA_STYLE}>
          Go to Org Spine →
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <ErrorBanner msg={err} onClear={() => setErr(null)} />

      {/* ── CREATE DELEGATION ─────────────────────────────────────────── */}
      <div className={CARD} style={CARD_STYLE}>
        <h2 className="text-lg font-black tracking-tight mb-1" style={HEADING_STYLE}>
          New delegation
        </h2>
        <p className="text-xs mb-4" style={BODY_STYLE}>
          Pick whose work is being covered, who&apos;s covering it, and how much. The slider is your
          Activity Catalogue Slider — it transfers a percentage of the source seat&apos;s workload.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className={LABEL} style={LABEL_STYLE}>Source seat (overloaded / separating)</label>
            <select className={INPUT} style={INPUT_STYLE} value={fromSeat} onChange={e => { setFromSeat(e.target.value); if (e.target.value === toSeat) setToSeat('') }}>
              <option value="">Select a seat…</option>
              {sourceSeats.map(s => (
                <option key={s.id} value={s.id}>
                  {seatLabel(s, persons)}{s.status === 'separating' ? ' · separating' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} style={LABEL_STYLE}>Covering seat</label>
            <select className={INPUT} style={INPUT_STYLE} value={toSeat} onChange={e => setToSeat(e.target.value)} disabled={!fromSeat}>
              <option value="">Select a seat…</option>
              {coverSeats.map(s => (
                <option key={s.id} value={s.id}>{seatLabel(s, persons)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className={LABEL} style={{ ...LABEL_STYLE, marginBottom: 0 }}>Slice delegated</label>
            <span className="text-sm font-black" style={{ color: ACCENT }}>{pct}%</span>
          </div>
          <input
            type="range" min={1} max={100} step={5} value={pct}
            onChange={e => setPct(Number(e.target.value))}
            className="w-full" style={{ accentColor: ACCENT }}
          />
        </div>

        {/* Live absorbed-capacity impact on the covering seat. */}
        {draftImpact && (
          <div
            className="mb-4 p-3 rounded-xl"
            style={{
              background: draftImpact.overloaded ? 'rgba(251,113,133,0.10)' : 'rgba(52,211,153,0.08)',
              border: `1px solid ${draftImpact.overloaded ? 'rgba(251,113,133,0.30)' : 'rgba(52,211,153,0.25)'}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={LABEL_STYLE}>
                Covering seat after this delegation
              </span>
              <span className="text-sm font-black" style={{ color: draftImpact.overloaded ? '#FB7185' : '#34D399' }}>
                {draftImpact.effective}% capacity
              </span>
            </div>
            <CapacityBar effective={draftImpact.effective} />
            <p className="text-[11px] mt-2" style={BODY_STYLE}>
              {draftImpact.baseline}% own workload + {draftImpact.delegated}% delegated in.
              {draftImpact.overloaded && (
                <span style={{ color: '#FB7185', fontWeight: 700 }}> Over 100% — retention risk. This seat will flag in the Calibration Lens.</span>
              )}
            </p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className={LABEL} style={LABEL_STYLE}>Start date</label>
            <input type="date" className={INPUT} style={INPUT_STYLE} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className={LABEL} style={LABEL_STYLE}>End date (blank = ongoing)</label>
            <input type="date" className={INPUT} style={INPUT_STYLE} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="mb-4">
          <label className={LABEL} style={LABEL_STYLE}>Reason</label>
          <input
            type="text" className={INPUT} style={INPUT_STYLE} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Annual leave 12–19 Aug · covering during separation"
          />
        </div>

        <button
          onClick={createDelegation}
          disabled={busy || !fromSeat || !toSeat}
          className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
          style={CTA_STYLE}
        >
          {busy ? 'Saving…' : 'Delegate workload'}
        </button>
      </div>

      {/* ── ACTIVE DELEGATIONS ────────────────────────────────────────── */}
      <div className={CARD} style={CARD_STYLE}>
        <h2 className="text-lg font-black tracking-tight mb-1" style={HEADING_STYLE}>
          Active delegations
        </h2>

        {activeDelegations.length === 0 ? (
          <div className="mt-3 p-4 rounded-xl text-center" style={{ background: '#060609', border: '1px dashed rgba(56, 189, 248, 0.25)' }}>
            <p className="text-sm font-bold mb-1" style={HEADING_STYLE}>No delegations yet</p>
            <p className="text-xs leading-relaxed" style={BODY_STYLE}>
              When a person is overloaded or about to leave, delegate a slice of their workload to a
              covering seat above. Each delegation raises the covering seat&apos;s absorbed capacity —
              cross 100% and it becomes a retention-risk flag. Delegated deliverables later feed
              skill extraction.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-3">
            {activeDelegations.map(d => {
              const from = seatById.get(d.from_seat_id)
              const to = seatById.get(d.to_seat_id)
              const cap = capacity.get(d.to_seat_id)
              return (
                <div key={d.id} className="p-3 rounded-xl" style={{ background: '#060609', border: '1px solid rgba(56, 189, 248, 0.14)' }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={HEADING_STYLE}>
                        {from ? seatLabel(from, persons) : 'Unknown seat'}
                        <span style={{ color: ACCENT }}> → </span>
                        {to ? seatLabel(to, persons) : 'Unknown seat'}
                      </p>
                      <p className="text-[11px]" style={BODY_STYLE}>
                        {d.percentage}% · from {d.start_date}{d.end_date ? ` to ${d.end_date}` : ' · ongoing'}
                        {d.reason ? ` · ${d.reason}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => endDelegation(d.id)}
                      disabled={busy}
                      className="text-[11px] font-bold whitespace-nowrap disabled:opacity-50"
                      style={{ color: '#FB7185' }}
                    >
                      End now
                    </button>
                  </div>

                  {cap && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider font-bold" style={LABEL_STYLE}>
                          {to ? to.title : 'Seat'} capacity
                        </span>
                        <span className="text-[11px] font-black" style={{ color: cap.overloaded ? '#FB7185' : '#34D399' }}>
                          {cap.effective}%{cap.overloaded ? ' · overload' : ''}
                        </span>
                      </div>
                      <CapacityBar effective={cap.effective} />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold" style={LABEL_STYLE}>Adjust slice</span>
                    <input
                      type="range" min={1} max={100} step={5} defaultValue={d.percentage}
                      onMouseUp={e => changePct(d.id, Number((e.target as HTMLInputElement).value))}
                      onTouchEnd={e => changePct(d.id, Number((e.target as HTMLInputElement).value))}
                      className="flex-1" style={{ accentColor: ACCENT }} disabled={busy}
                    />
                  </div>

                  {d.ai_detected_skills_gained && d.ai_detected_skills_gained.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {d.ai_detected_skills_gained.map(s => (
                        <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(56, 189, 248, 0.14)', color: ACCENT }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── ENDED DELEGATIONS (history) ───────────────────────────────── */}
      {endedDelegations.length > 0 && (
        <div className={CARD} style={CARD_STYLE}>
          <h2 className="text-sm font-black tracking-tight mb-3" style={HEADING_STYLE}>
            Ended ({endedDelegations.length})
          </h2>
          <div className="space-y-2">
            {endedDelegations.map(d => {
              const from = seatById.get(d.from_seat_id)
              const to = seatById.get(d.to_seat_id)
              return (
                <div key={d.id} className="text-[11px] flex items-center justify-between gap-2" style={BODY_STYLE}>
                  <span className="truncate">
                    {from ? from.title : '—'} → {to ? to.title : '—'} · {d.percentage}%
                  </span>
                  <span className="whitespace-nowrap opacity-60">ended {d.end_date}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {planTier === 'free' && (
        <div
          className="p-4 rounded-xl text-xs"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#FBBF24' }}
        >
          <strong>Heads up:</strong> overload flags feed the HRBP Calibration Lens and Skill Density —
          both Enterprise overlays. Delegation tracking itself works on every tier.
        </div>
      )}
    </div>
  )
}
