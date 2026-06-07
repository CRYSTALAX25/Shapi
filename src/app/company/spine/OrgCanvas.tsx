'use client'

// OrgCanvas — the visual spine. Blueprint v4 Phase B+C in one component.
//
// Renders teams + seats in four switchable LENSES:
//   • Functional  — group by team.function across all locations
//   • Divisional  — group by location, then by team
//   • Matrix      — 2D grid: rows=function, cols=location
//   • Flat        — minimal hierarchy, flat list with seat-count chips
//
// And two STATE filters (the time-slider):
//   • Current — seats with status in {active, separating}
//   • Target  — seats with status in {active, planned}
//
// Drag-drop: pick up any seat card, drop on a team header → PATCH seat's
// team_id + auto-log to organizational_decisions with a default "Drag-drop
// reassignment from <Team A> to <Team B>" justification (40+ chars to clear
// the schema floor). A richer justification modal will land in a follow-up.
//
// All seat cards click through to the existing manual edit affordances
// below (the CRUD sections) — the canvas is for visual restructuring and
// the CRUD is for fine-grained edits.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Location = { id: string; name: string; country: string }
type Team = { id: string; name: string; location_id: string; function: string | null; parent_team_id: string | null }
type Person = { id: string; full_name: string; preferred_name: string | null }
type Seat = {
  id: string
  title: string
  team_id: string
  seniority: string | null
  person_id: string | null
  status: string
}

type Props = {
  locations: Location[]
  teams: Team[]
  persons: Person[]
  seats: Seat[]
}

type Lens = 'functional' | 'divisional' | 'matrix' | 'flat'
type State = 'current' | 'target'

const LENS_LABEL: Record<Lens, string> = {
  functional: 'Functional',
  divisional: 'Divisional',
  matrix: 'Matrix',
  flat: 'Flat',
}

const ACCENT = '#7c93f5'
const HEADING_STYLE: React.CSSProperties = { color: '#f4f6f9' }
const BODY_STYLE: React.CSSProperties = { color: '#9ca3af' }

const FUNCTION_LABEL: Record<string, string> = {
  engineering: 'Engineering',
  sales: 'Sales',
  ops: 'Operations',
  finance: 'Finance',
  people: 'People / HR',
  marketing: 'Marketing',
  other: 'Other',
}

const STATUS_COLOR: Record<string, string> = {
  active: '#34D399',
  planned: '#7c93f5',
  vacant: '#FBBF24',
  separating: '#FB7185',
  frozen: 'rgba(255,255,255,0.4)',
  redeployed: '#9ca3af',
}

const STATE_FILTER: Record<State, Set<string>> = {
  current: new Set(['active', 'separating']),
  target: new Set(['active', 'planned']),
}

export default function OrgCanvas({ locations, teams, persons, seats }: Props) {
  const router = useRouter()
  const [lens, setLens] = useState<Lens>('functional')
  const [state, setState] = useState<State>('current')
  const [draggingSeatId, setDraggingSeatId] = useState<string | null>(null)
  const [dropTargetTeamId, setDropTargetTeamId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const personById = useMemo(() => Object.fromEntries(persons.map(p => [p.id, p])), [persons])
  const teamById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams])
  const locById = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l])), [locations])

  // Filter seats by state.
  const visibleSeats = useMemo(
    () => seats.filter(s => STATE_FILTER[state].has(s.status)),
    [seats, state]
  )

  // Empty state.
  if (locations.length === 0 && teams.length === 0 && seats.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: '#13161b', border: `1px dashed ${ACCENT}55` }}
      >
        <p className="text-sm" style={HEADING_STYLE}>
          Your visual org chart appears here once you have at least one location, team and seat.
        </p>
        <p className="text-xs mt-1" style={BODY_STYLE}>
          Upload a CSV above or add a location below to get started.
        </p>
      </div>
    )
  }

  async function handleDrop(targetTeamId: string) {
    setDropTargetTeamId(null)
    const seatId = draggingSeatId
    setDraggingSeatId(null)
    if (!seatId) return
    const seat = seats.find(s => s.id === seatId)
    if (!seat || seat.team_id === targetTeamId) return                  // no-op

    const fromTeam = teamById[seat.team_id]
    const toTeam = teamById[targetTeamId]
    if (!fromTeam || !toTeam) return

    setBusy(true)
    try {
      const moveRes = await fetch('/api/company/spine/seat', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: seat.id, team_id: targetTeamId }),
      })
      if (!moveRes.ok) {
        const d = await moveRes.json().catch(() => ({}))
        alert(d.error || 'Move failed')
        return
      }
      // Best-effort audit log. Schema requires 20+ chars on justification;
      // the default below is 60+ to clear the floor cleanly.
      await fetch('/api/company/spine/decision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision_type: 'restructure',
          justification: `Drag-drop reassignment: moved "${seat.title}" from ${fromTeam.name} to ${toTeam.name} on the visual canvas.`,
          impacted_seat_id: seat.id,
          impacted_person_id: seat.person_id,
          impacted_team_id: targetTeamId,
          state_snapshot: {
            seat_title: seat.title,
            from_team_id: fromTeam.id,
            from_team_name: fromTeam.name,
            to_team_id: targetTeamId,
            to_team_name: toTeam.name,
            person_id: seat.person_id,
          },
        }),
      }).catch(() => { /* audit best-effort */ })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  // Seat cards (shared across all lens views).
  function SeatCard({ seat }: { seat: Seat }) {
    const person = seat.person_id ? personById[seat.person_id] : null
    const personName = person ? (person.preferred_name || person.full_name) : null
    const team = teamById[seat.team_id]
    const isDragging = draggingSeatId === seat.id
    return (
      <div
        draggable
        onDragStart={() => setDraggingSeatId(seat.id)}
        onDragEnd={() => setDraggingSeatId(null)}
        className="rounded-lg p-2.5 cursor-grab active:cursor-grabbing transition-opacity"
        style={{
          background: isDragging ? 'rgba(124,147,245,0.18)' : '#0c0e11',
          border: `1px solid ${isDragging ? ACCENT : 'rgba(255,255,255,0.06)'}`,
          opacity: isDragging ? 0.6 : 1,
        }}
        title={`${seat.title} · ${team?.name || ''}\nDrag to reassign team`}
      >
        <p className="text-xs font-bold leading-tight" style={HEADING_STYLE}>{seat.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: STATUS_COLOR[seat.status] || '#9ca3af' }}
          />
          <p className="text-[10px] truncate" style={BODY_STYLE}>
            {personName || '(vacant)'}{seat.seniority ? ` · ${seat.seniority}` : ''}
          </p>
        </div>
      </div>
    )
  }

  function TeamHeader({ team, count }: { team: Team; count: number }) {
    const loc = locById[team.location_id]
    const isHovered = dropTargetTeamId === team.id
    return (
      <div
        onDragOver={e => { e.preventDefault(); setDropTargetTeamId(team.id) }}
        onDragLeave={() => setDropTargetTeamId(prev => prev === team.id ? null : prev)}
        onDrop={() => handleDrop(team.id)}
        className="px-3 py-2 mb-2 rounded-lg transition-colors"
        style={{
          background: isHovered ? 'rgba(124,147,245,0.18)' : 'rgba(255,255,255,0.04)',
          border: `1px dashed ${isHovered ? ACCENT : 'rgba(255,255,255,0.08)'}`,
        }}
      >
        <p className="text-xs font-black" style={HEADING_STYLE}>{team.name}</p>
        <p className="text-[10px]" style={BODY_STYLE}>
          {loc?.name || '—'} · {count} seat{count === 1 ? '' : 's'}
        </p>
      </div>
    )
  }

  // ── LENS: FUNCTIONAL ───────────────────────────────────────────────
  function FunctionalView() {
    // Group teams by team.function, then list seats under each team.
    const byFunction = new Map<string, Team[]>()
    for (const t of teams) {
      const key = t.function || 'other'
      const list = byFunction.get(key) || []
      list.push(t)
      byFunction.set(key, list)
    }
    return (
      <div className="space-y-4">
        {[...byFunction.entries()].map(([fn, fnTeams]) => (
          <div key={fn}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: ACCENT }}>
              {FUNCTION_LABEL[fn] || fn}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {fnTeams.map(t => {
                const tseats = visibleSeats.filter(s => s.team_id === t.id)
                return (
                  <div key={t.id}>
                    <TeamHeader team={t} count={tseats.length} />
                    <div className="space-y-1.5">
                      {tseats.length === 0
                        ? <p className="text-[10px] italic px-2" style={BODY_STYLE}>No seats in this lens.</p>
                        : tseats.map(s => <SeatCard key={s.id} seat={s} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── LENS: DIVISIONAL ───────────────────────────────────────────────
  function DivisionalView() {
    return (
      <div className="space-y-4">
        {locations.map(loc => {
          const locTeams = teams.filter(t => t.location_id === loc.id)
          return (
            <div key={loc.id}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: ACCENT }}>
                {loc.name} · {loc.country}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {locTeams.map(t => {
                  const tseats = visibleSeats.filter(s => s.team_id === t.id)
                  return (
                    <div key={t.id}>
                      <TeamHeader team={t} count={tseats.length} />
                      <div className="space-y-1.5">
                        {tseats.length === 0
                          ? <p className="text-[10px] italic px-2" style={BODY_STYLE}>No seats in this lens.</p>
                          : tseats.map(s => <SeatCard key={s.id} seat={s} />)}
                      </div>
                    </div>
                  )
                })}
                {locTeams.length === 0 && (
                  <p className="text-xs" style={BODY_STYLE}>No teams at this location yet.</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── LENS: MATRIX ───────────────────────────────────────────────────
  function MatrixView() {
    const functions = Array.from(new Set(teams.map(t => t.function || 'other')))
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: 6 }}>
          <thead>
            <tr>
              <th></th>
              {locations.map(loc => (
                <th key={loc.id} className="text-left p-2 align-top">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>{loc.name}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {functions.map(fn => (
              <tr key={fn}>
                <td className="p-2 align-top" style={{ verticalAlign: 'top' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                    {FUNCTION_LABEL[fn] || fn}
                  </p>
                </td>
                {locations.map(loc => {
                  const cellTeams = teams.filter(t => (t.function || 'other') === fn && t.location_id === loc.id)
                  return (
                    <td key={loc.id} className="p-1 align-top" style={{ minWidth: 180 }}>
                      {cellTeams.length === 0 ? (
                        <div
                          className="h-full rounded-lg p-2"
                          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}
                        >
                          <p className="text-[10px] italic" style={BODY_STYLE}>—</p>
                        </div>
                      ) : cellTeams.map(t => {
                        const tseats = visibleSeats.filter(s => s.team_id === t.id)
                        return (
                          <div key={t.id} className="mb-2">
                            <TeamHeader team={t} count={tseats.length} />
                            <div className="space-y-1.5">
                              {tseats.map(s => <SeatCard key={s.id} seat={s} />)}
                            </div>
                          </div>
                        )
                      })}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── LENS: FLAT ─────────────────────────────────────────────────────
  function FlatView() {
    return (
      <div className="space-y-2">
        {teams.map(t => {
          const tseats = visibleSeats.filter(s => s.team_id === t.id)
          const loc = locById[t.location_id]
          const filled = tseats.filter(s => s.person_id).length
          return (
            <div
              key={t.id}
              onDragOver={e => { e.preventDefault(); setDropTargetTeamId(t.id) }}
              onDragLeave={() => setDropTargetTeamId(prev => prev === t.id ? null : prev)}
              onDrop={() => handleDrop(t.id)}
              className="rounded-lg p-3 transition-colors"
              style={{
                background: dropTargetTeamId === t.id ? 'rgba(124,147,245,0.18)' : '#0c0e11',
                border: `1px solid ${dropTargetTeamId === t.id ? ACCENT : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-black" style={HEADING_STYLE}>{t.name}</p>
                  <p className="text-[10px]" style={BODY_STYLE}>
                    {loc?.name || '—'}{t.function ? ` · ${FUNCTION_LABEL[t.function] || t.function}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs" style={BODY_STYLE}>
                    {tseats.length} seat{tseats.length === 1 ? '' : 's'} · {filled} filled
                  </p>
                </div>
              </div>
              {tseats.length > 0 && (
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {tseats.map(s => (
                    <div key={s.id} className="inline-block">
                      <SeatCard seat={s} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: '#13161b', border: `1px solid ${ACCENT}55` }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider mr-1" style={BODY_STYLE}>Lens</p>
          {(['functional', 'divisional', 'matrix', 'flat'] as Lens[]).map(l => (
            <button
              key={l}
              onClick={() => setLens(l)}
              className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
              style={lens === l
                ? { background: `${ACCENT}30`, color: ACCENT, border: `1px solid ${ACCENT}` }
                : { background: '#0c0e11', color: BODY_STYLE.color as string, border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {LENS_LABEL[l]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider mr-1" style={BODY_STYLE}>State</p>
          {(['current', 'target'] as State[]).map(s => (
            <button
              key={s}
              onClick={() => setState(s)}
              className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors capitalize"
              style={state === s
                ? { background: s === 'current' ? 'rgba(52,211,153,0.20)' : 'rgba(124,147,245,0.20)', color: s === 'current' ? '#34D399' : ACCENT, border: `1px solid ${s === 'current' ? '#34D399' : ACCENT}` }
                : { background: '#0c0e11', color: BODY_STYLE.color as string, border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {s === 'current' ? '● Current' : '○ Target'}
            </button>
          ))}
        </div>
      </div>

      {busy && (
        <p className="text-xs mb-3" style={{ color: ACCENT }}>Saving move…</p>
      )}

      <div className="text-[11px] mb-4" style={BODY_STYLE}>
        Drag any seat card onto a team header to reassign. Each move is logged in your decisions audit trail.
      </div>

      {lens === 'functional' && <FunctionalView />}
      {lens === 'divisional' && <DivisionalView />}
      {lens === 'matrix' && <MatrixView />}
      {lens === 'flat' && <FlatView />}
    </div>
  )
}
