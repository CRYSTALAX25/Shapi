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
// Drag-drop: pick up any seat card, drop on a team header → opens a
// justification modal (ReassignModal). The user must type a real reason
// (min 20 chars) before the move commits. On confirm we PATCH the seat's
// team_id AND POST the typed justification to organizational_decisions.
// Cancel/Escape aborts with no DB write. We refresh from the server after a
// successful commit rather than mutating local state optimistically.
//
// All seat cards click through to the existing manual edit affordances
// below (the CRUD sections) — the canvas is for visual restructuring and
// the CRUD is for fine-grained edits.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReassignModal, { type ReassignContext } from './ReassignModal'

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
  // HRBP Calibration Lens inputs (roles_seats). All nullable — overlay degrades
  // to neutral when absent. flight_risk_score is a Year-2 ML signal; the MVP
  // lens does NOT depend on it.
  okr_completion_pct?: number | null
  absorbed_capacity_pct?: number | null
  ai_exposure_score?: number | null
  flight_risk_score?: number | null
  // VERIFIED ORG trust tier (supabase/verified_org.sql). Optional on purpose —
  // before the founder runs the migration the column doesn't exist, the key is
  // absent from the loaded rows, and all verification UI hides itself.
  verification_status?: 'self_reported' | 'shapi_assessed' | 'verified' | null
  verified_at?: string | null
  verified_via?: string | null
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

// ── CALIBRATION LENS ──────────────────────────────────────────────────
// Brand palette per the HRBP "Strategic Calibration Lens" spec:
//   • glow-gold (amber)  — top performer AND overloaded → retention risk
//   • muted-slate        — optimized / healthy (good OKR, capacity in band)
//   • crimson (coral)    — high AI-exposure AND missing timelines (no/low OKR
//                          or seat not yet operating)
//   • neutral            — insufficient data (overlay does nothing)
type CalBucket = 'gold' | 'slate' | 'crimson' | 'neutral'

const CAL_COLORS = {
  gold: '#FBBF24',     // amber — retention risk
  slate: '#64748B',    // muted slate — healthy
  crimson: '#FB7185',  // coral — AI-exposed, no timeline
} as const

// Thresholds (client-side, computed from already-loaded seat data).
const OKR_HIGH = 70           // "top performer" / has a real timeline
const CAPACITY_OVERLOAD = 100 // absorbed_capacity_pct > 100 = overloaded
const AI_EXPOSURE_HIGH = 70   // high automation exposure

// Statuses that mean the seat is NOT operating against live OKRs yet.
const NO_TIMELINE_STATUS = new Set(['planned', 'vacant', 'frozen'])

// Pure, deterministic classifier. flight_risk_score is intentionally ignored
// (nullable Year-2 signal). Returns 'neutral' whenever the inputs it needs are
// missing, so the overlay never invents a colour from null data.
function calibrationBucket(seat: Seat): CalBucket {
  const okr = seat.okr_completion_pct
  const cap = seat.absorbed_capacity_pct
  const ai = seat.ai_exposure_score

  // CRIMSON: high AI-exposure with no/low delivery timeline. Needs ai present.
  if (typeof ai === 'number' && ai >= AI_EXPOSURE_HIGH) {
    const lowOkr = typeof okr === 'number' ? okr < OKR_HIGH : true
    const noTimeline = NO_TIMELINE_STATUS.has(seat.status)
    if (lowOkr || noTimeline) return 'crimson'
  }

  // GOLD: top performer AND overloaded. Needs both okr and capacity present.
  if (typeof okr === 'number' && typeof cap === 'number') {
    if (okr >= OKR_HIGH && cap > CAPACITY_OVERLOAD) return 'gold'
    // SLATE: healthy — good OKR, capacity within band.
    if (okr >= OKR_HIGH && cap <= CAPACITY_OVERLOAD) return 'slate'
  }

  // Not enough signal to colour confidently.
  return 'neutral'
}

const CAL_LEGEND: { bucket: Exclude<CalBucket, 'neutral'>; label: string }[] = [
  { bucket: 'gold', label: 'Top performer + overloaded — retention risk' },
  { bucket: 'slate', label: 'Optimized / healthy' },
  { bucket: 'crimson', label: 'High AI-exposure, no timeline' },
]

// ── VERIFIED ORG ──────────────────────────────────────────────────────
// Every seat carries a trust tier like a candidate claim:
//   grey  self_reported  — company typed it in (default)
//   amber shapi_assessed — signal received but contested
//   cyan  verified       — the employee confirmed their own seat via magic link
// The badge is a small corner dot so it never collides with the calibration
// glow ring (which lives on the card border/box-shadow).
const VERIFY_COLORS: Record<string, string> = {
  self_reported: 'rgba(255,255,255,0.28)',
  shapi_assessed: '#FBBF24',
  verified: '#22D3EE',
}
const VERIFY_LABEL: Record<string, string> = {
  self_reported: 'Self-reported — not yet confirmed by the employee',
  shapi_assessed: 'Shapi-assessed — response received, details contested',
  verified: 'Verified — confirmed by the employee via magic link',
}

// Per-person send result returned by POST /api/company/spine/verify. The
// copyable link is ALWAYS present so the founder can paste it manually while
// Twilio is trial-capped.
type VerifyResult = {
  seat_id: string
  seat_title: string
  person_id: string
  person_name: string
  link: string
  sent_via: string[]
  errors?: string[]
}

// ── SUGGESTION BAR ────────────────────────────────────────────────────
// Advisory layout proposals. CRITICAL: these NEVER mutate the layout. Acting
// on one only PREVIEWS (highlights the affected teams) — any real change still
// goes through drag-drop + the justification modal.
type Suggestion = {
  id: string
  text: string
  teamIds: string[] // teams to highlight when this suggestion is previewed
}

export default function OrgCanvas({ locations, teams, persons, seats }: Props) {
  const router = useRouter()
  const [lens, setLens] = useState<Lens>('functional')
  const [state, setState] = useState<State>('current')
  const [draggingSeatId, setDraggingSeatId] = useState<string | null>(null)
  const [dropTargetTeamId, setDropTargetTeamId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Pending reassignment awaiting justification. Drop sets this → modal opens.
  const [pendingMove, setPendingMove] = useState<ReassignContext | null>(null)
  // Calibration Lens overlay toggle (composes with all 4 lenses + state).
  const [calibration, setCalibration] = useState(false)
  // Suggestion bar: dismissed ids + the currently-previewed suggestion id.
  // Previewing only HIGHLIGHTS the affected teams — it never moves anything.
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())
  const [previewSuggestionId, setPreviewSuggestionId] = useState<string | null>(null)
  // VERIFIED ORG — send-confirmations panel state.
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [verifyResults, setVerifyResults] = useState<VerifyResult[] | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [copiedSeatId, setCopiedSeatId] = useState<string | null>(null)

  const personById = useMemo(() => Object.fromEntries(persons.map(p => [p.id, p])), [persons])
  const teamById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams])
  const locById = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l])), [locations])

  // Filter seats by state.
  const visibleSeats = useMemo(
    () => seats.filter(s => STATE_FILTER[state].has(s.status)),
    [seats, state]
  )

  // ── Verified Org availability + counter ─────────────────────────────
  // GRACEFUL DEGRADE: before supabase/verified_org.sql runs, roles_seats has
  // no verification_status column → the key is absent on every loaded seat
  // (page.tsx selects '*') → all verification UI hides itself.
  const verificationEnabled = useMemo(
    () => seats.length > 0 && seats.some(s => s.verification_status !== undefined),
    [seats]
  )
  const occupiedSeats = useMemo(() => seats.filter(s => s.person_id), [seats])
  const verifiedCount = occupiedSeats.filter(s => s.verification_status === 'verified').length
  const verifiedPct = occupiedSeats.length > 0
    ? Math.round((verifiedCount / occupiedSeats.length) * 100)
    : 0

  // "Verify org →" — mints magic links for every occupied seat, tries
  // WhatsApp + email per person, and always returns copyable links (Twilio
  // trial fallback). Then shows the per-person panel.
  async function verifyOrg() {
    setVerifyBusy(true)
    setVerifyError(null)
    try {
      const res = await fetch('/api/company/spine/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setVerifyError(
          res.status === 409
            ? 'Verification needs a one-time database update — run supabase/verified_org.sql in the Supabase SQL editor first.'
            : data.error || 'Sending confirmations failed. Try again.'
        )
        return
      }
      setVerifyResults(data.results || [])
    } catch {
      setVerifyError('Network error — try again.')
    } finally {
      setVerifyBusy(false)
    }
  }

  async function copyLink(seatId: string, link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedSeatId(seatId)
      setTimeout(() => setCopiedSeatId(prev => (prev === seatId ? null : prev)), 1500)
    } catch { /* clipboard blocked — the link is visible to select manually */ }
  }

  // ── Suggestions (advisory only) ──────────────────────────────────────
  // Computed client-side from the loaded spine. Each is a heuristic the HRBP
  // *might* want to act on — but we NEVER apply it. Previewing highlights the
  // teams; the user still has to drag a seat (→ justification modal) to act.
  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = []
    const SPAN_THRESHOLD = 8 // reports under one team before we flag span-of-control

    // 1. Over-wide teams — too many seats reporting into one team.
    for (const t of teams) {
      const count = seats.filter(s => s.team_id === t.id).length
      if (count > SPAN_THRESHOLD) {
        out.push({
          id: `span:${t.id}`,
          text: `${t.name} has ${count} reports under one manager — consider splitting into a sub-team.`,
          teamIds: [t.id],
        })
      }
    }

    // 2. Vacancy clusters within the same function — candidates to merge/backfill.
    const vacantByFunction = new Map<string, { teamIds: Set<string>; count: number }>()
    for (const s of seats) {
      if (s.status !== 'vacant' && s.status !== 'planned') continue
      const t = teamById[s.team_id]
      if (!t) continue
      const fn = t.function || 'other'
      const entry = vacantByFunction.get(fn) || { teamIds: new Set<string>(), count: 0 }
      entry.teamIds.add(t.id)
      entry.count += 1
      vacantByFunction.set(fn, entry)
    }
    for (const [fn, entry] of vacantByFunction) {
      if (entry.count >= 3) {
        out.push({
          id: `vacancies:${fn}`,
          text: `${entry.count} vacant/planned seats across ${FUNCTION_LABEL[fn] || fn} — consider merging or a single backfill plan.`,
          teamIds: [...entry.teamIds],
        })
      }
    }

    // 3. Retention-risk cluster (from calibration) — gold seats in a team.
    const goldByTeam = new Map<string, number>()
    for (const s of seats) {
      if (calibrationBucket(s) === 'gold') {
        goldByTeam.set(s.team_id, (goldByTeam.get(s.team_id) || 0) + 1)
      }
    }
    for (const [teamId, n] of goldByTeam) {
      if (n >= 2) {
        const t = teamById[teamId]
        out.push({
          id: `retention:${teamId}`,
          text: `${t?.name || 'A team'} has ${n} overloaded top performers — redistribute load before they churn.`,
          teamIds: [teamId],
        })
      }
    }

    return out.filter(s => !dismissedSuggestions.has(s.id))
  }, [teams, seats, teamById, dismissedSuggestions])

  // Teams to visually highlight from the active preview (advisory only).
  const highlightedTeamIds = useMemo<Set<string>>(() => {
    if (!previewSuggestionId) return new Set()
    const s = suggestions.find(x => x.id === previewSuggestionId)
    return new Set(s?.teamIds || [])
  }, [previewSuggestionId, suggestions])

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

  // Drop only stages the move — it opens the justification modal. The seat
  // stays put (no optimistic mutation) until the user confirms with a reason.
  function handleDrop(targetTeamId: string) {
    setDropTargetTeamId(null)
    const seatId = draggingSeatId
    setDraggingSeatId(null)
    if (!seatId) return
    const seat = seats.find(s => s.id === seatId)
    if (!seat || seat.team_id === targetTeamId) return                  // no-op

    const fromTeam = teamById[seat.team_id]
    const toTeam = teamById[targetTeamId]
    if (!fromTeam || !toTeam) return

    setPendingMove({
      seatId: seat.id,
      seatTitle: seat.title,
      personId: seat.person_id,
      fromTeamId: fromTeam.id,
      fromTeamName: fromTeam.name,
      toTeamId: toTeam.id,
      toTeamName: toTeam.name,
    })
  }

  // Called by ReassignModal on Confirm. Commits the move with the user-typed
  // justification: PATCH the seat, then POST the decision. Throws on failure so
  // the modal keeps itself open and preserves the typed text.
  async function commitMove(
    ctx: ReassignContext,
    { decisionType, justification }: { decisionType: string; justification: string }
  ) {
    setBusy(true)
    try {
      const moveRes = await fetch('/api/company/spine/seat', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: ctx.seatId, team_id: ctx.toTeamId }),
      })
      if (!moveRes.ok) {
        const d = await moveRes.json().catch(() => ({}))
        throw new Error(d.error || d.message || 'Move failed. The seat was not reassigned.')
      }
      // Audit log with the real justification. Schema enforces 20+ chars; the
      // modal already guarantees that, but the API re-validates server-side.
      const decRes = await fetch('/api/company/spine/decision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision_type: decisionType,
          justification,
          impacted_seat_id: ctx.seatId,
          impacted_person_id: ctx.personId,
          impacted_team_id: ctx.toTeamId,
          state_snapshot: {
            seat_title: ctx.seatTitle,
            from_team_id: ctx.fromTeamId,
            from_team_name: ctx.fromTeamName,
            to_team_id: ctx.toTeamId,
            to_team_name: ctx.toTeamName,
            person_id: ctx.personId,
          },
        }),
      })
      if (!decRes.ok) {
        const d = await decRes.json().catch(() => ({}))
        // The seat moved but the audit row failed. Surface it loudly — the
        // user keeps the modal open and can retry the decision write.
        throw new Error(
          (d.message || d.error || 'Decision log failed') +
            ' — the seat was moved, but the justification was not recorded. Please retry.'
        )
      }
      setPendingMove(null)
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

    // Calibration overlay — purely visual, composes on top of drag state.
    const bucket = calibration ? calibrationBucket(seat) : 'neutral'
    const calColor = bucket === 'neutral' ? null : CAL_COLORS[bucket]

    // Resolve border + glow. Drag state wins on border colour; the calibration
    // colour shows as a glow ring so both signals can be read at once.
    const borderColor = isDragging
      ? ACCENT
      : calColor || 'rgba(255,255,255,0.06)'
    const boxShadow = calColor && !isDragging ? `0 0 0 1px ${calColor}, 0 0 10px -2px ${calColor}aa` : undefined

    const calTitle = calColor
      ? `\nCalibration: ${bucket === 'gold' ? 'top performer + overloaded (retention risk)' : bucket === 'slate' ? 'optimized / healthy' : 'high AI-exposure, no timeline'}`
      : ''

    // Verification badge — corner dot, only when the migration has run AND
    // the seat is occupied (a vacant seat has nobody to confirm it). Lives in
    // the card corner so it never collides with the calibration glow ring on
    // the border.
    const vStatus = verificationEnabled && seat.person_id
      ? (seat.verification_status || 'self_reported')
      : null
    const vTitle = vStatus ? `\n${VERIFY_LABEL[vStatus] || vStatus}` : ''

    return (
      <div
        draggable
        onDragStart={() => setDraggingSeatId(seat.id)}
        onDragEnd={() => setDraggingSeatId(null)}
        className="relative rounded-lg p-2.5 cursor-grab active:cursor-grabbing transition-opacity"
        style={{
          background: isDragging ? 'rgba(124,147,245,0.18)' : '#0c0e11',
          border: `1px solid ${borderColor}`,
          boxShadow,
          opacity: isDragging ? 0.6 : 1,
        }}
        title={`${seat.title} · ${team?.name || ''}\nDrag to reassign team${calTitle}${vTitle}`}
      >
        {vStatus && (
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{
              background: VERIFY_COLORS[vStatus],
              boxShadow: vStatus === 'verified' ? `0 0 5px ${VERIFY_COLORS.verified}` : undefined,
            }}
            title={VERIFY_LABEL[vStatus]}
          />
        )}
        <p className="text-xs font-bold leading-tight pr-3" style={HEADING_STYLE}>{seat.title}</p>
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
    // Advisory highlight from a previewed suggestion. Purely visual — does NOT
    // move or restructure anything.
    const isHighlighted = highlightedTeamIds.has(team.id)
    return (
      <div
        onDragOver={e => { e.preventDefault(); setDropTargetTeamId(team.id) }}
        onDragLeave={() => setDropTargetTeamId(prev => prev === team.id ? null : prev)}
        onDrop={() => handleDrop(team.id)}
        className="px-3 py-2 mb-2 rounded-lg transition-colors"
        style={{
          background: isHovered ? 'rgba(124,147,245,0.18)' : isHighlighted ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px dashed ${isHovered ? ACCENT : isHighlighted ? '#FBBF24' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: isHighlighted && !isHovered ? '0 0 12px -3px #FBBF24aa' : undefined,
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
                background: dropTargetTeamId === t.id ? 'rgba(124,147,245,0.18)' : highlightedTeamIds.has(t.id) ? 'rgba(251,191,36,0.10)' : '#0c0e11',
                border: `1px solid ${dropTargetTeamId === t.id ? ACCENT : highlightedTeamIds.has(t.id) ? '#FBBF24' : 'rgba(255,255,255,0.06)'}`,
                boxShadow: highlightedTeamIds.has(t.id) && dropTargetTeamId !== t.id ? '0 0 12px -3px #FBBF24aa' : undefined,
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

        <div className="flex flex-wrap items-center gap-2">
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

          {/* Calibration Lens — overlays a heatmap on seat cards. Composes with
              all 4 lenses + the Current/Target state. */}
          <span className="mx-1 h-4 w-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <button
            onClick={() => setCalibration(v => !v)}
            className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
            style={calibration
              ? { background: 'rgba(251,191,36,0.18)', color: '#FBBF24', border: '1px solid #FBBF24' }
              : { background: '#0c0e11', color: BODY_STYLE.color as string, border: '1px solid rgba(255,255,255,0.08)' }}
            title="Overlay OKR + capacity + AI-exposure heatmap on seat cards"
          >
            {calibration ? '◉ Calibration' : '○ Calibration'}
          </button>

          {/* VERIFIED ORG — counter + send button. Hidden entirely until the
              founder runs supabase/verified_org.sql (column probe above). */}
          {verificationEnabled && (
            <>
              <span className="mx-1 h-4 w-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <span
                className="text-xs font-bold px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(34,211,238,0.10)',
                  color: '#22D3EE',
                  border: '1px solid rgba(34,211,238,0.35)',
                }}
                title={`${verifiedCount} of ${occupiedSeats.length} occupied seats confirmed by the employee themselves`}
              >
                Org verified: {verifiedPct}%
              </span>
              <button
                onClick={verifyOrg}
                disabled={verifyBusy || occupiedSeats.length === 0}
                className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors disabled:opacity-40"
                style={{ background: '#22D3EE', color: '#06141a', border: '1px solid #22D3EE' }}
                title="Send each employee a magic link to confirm their own seat — WhatsApp first, email + copyable link fallback"
              >
                {verifyBusy ? 'Sending…' : 'Verify org →'}
              </button>
            </>
          )}
        </div>
      </div>

      {verifyError && (
        <p
          className="text-xs mb-4 px-3 py-2 rounded-lg"
          style={{ color: '#FB7185', background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.25)' }}
        >
          {verifyError}
        </p>
      )}

      {/* Verify panel — per-person send status + copyable links. The link is
          ALWAYS shown: Twilio is trial-capped, so the founder can paste links
          into WhatsApp manually when the automated send fails. */}
      {verifyResults && (
        <div
          className="mb-4 rounded-xl p-3"
          style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.30)' }}
        >
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#22D3EE' }}>
              Seat confirmations sent · {verifyResults.length} {verifyResults.length === 1 ? 'person' : 'people'}
            </span>
            <button
              onClick={() => setVerifyResults(null)}
              className="text-[10px] font-bold"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Close ✕
            </button>
          </div>
          <ul className="space-y-1.5">
            {verifyResults.map(r => (
              <li
                key={r.seat_id}
                className="rounded-lg px-3 py-2"
                style={{ background: '#0c0e11', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-bold" style={HEADING_STYLE}>
                      {r.person_name} <span className="font-normal" style={BODY_STYLE}>· {r.seat_title}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {r.sent_via.length > 0 ? r.sent_via.map(ch => (
                        <span
                          key={ch}
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399', border: '1px solid rgba(52,211,153,0.30)' }}
                        >
                          ✓ {ch}
                        </span>
                      )) : (
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(251,191,36,0.10)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.30)' }}
                        >
                          link only — copy &amp; send manually
                        </span>
                      )}
                    </div>
                  </div>
                  {r.link && (
                    <button
                      onClick={() => copyLink(r.seat_id, r.link)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0"
                      style={copiedSeatId === r.seat_id
                        ? { background: 'rgba(52,211,153,0.15)', color: '#34D399', border: '1px solid #34D399' }
                        : { background: 'rgba(34,211,238,0.10)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.45)' }}
                    >
                      {copiedSeatId === r.seat_id ? '✓ Copied' : 'Copy link'}
                    </button>
                  )}
                </div>
                {r.link && (
                  <p className="text-[10px] mt-1 break-all" style={{ color: 'rgba(255,255,255,0.35)' }}>{r.link}</p>
                )}
                {r.errors && r.errors.length > 0 && (
                  <p className="text-[10px] mt-1" style={{ color: 'rgba(251,113,133,0.7)' }}>{r.errors.join(' · ')}</p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Each link is valid 14 days. Seats turn <span style={{ color: '#22D3EE' }}>cyan</span> when the employee
            confirms, <span style={{ color: '#FBBF24' }}>amber</span> if they flag something off. Re-sending replaces
            the previous link.
          </p>
        </div>
      )}

      {/* Calibration legend — only while the overlay is on. */}
      {calibration && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 p-3 rounded-xl"
          style={{ background: '#0c0e11', border: '1px solid rgba(251,191,36,0.25)' }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#FBBF24' }}>
            Calibration Lens
          </span>
          {CAL_LEGEND.map(item => (
            <span key={item.bucket} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ background: CAL_COLORS[item.bucket], boxShadow: `0 0 6px -1px ${CAL_COLORS[item.bucket]}` }}
              />
              <span className="text-[10px]" style={BODY_STYLE}>{item.label}</span>
            </span>
          ))}
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Uncoloured = insufficient data (flight-risk is a Year-2 signal, not used).
          </span>
        </div>
      )}

      {/* Suggestion bar — advisory only. Previewing highlights teams; it never
          auto-snaps the layout. Acting still goes through drag-drop + the
          justification modal. */}
      {suggestions.length > 0 && (
        <div
          className="mb-4 rounded-xl p-3"
          style={{ background: 'rgba(124,147,245,0.06)', border: `1px solid ${ACCENT}40` }}
        >
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
              💡 Suggestions · advisory only — nothing changes until you act
            </span>
            <button
              onClick={() => {
                setDismissedSuggestions(prev => {
                  const next = new Set(prev)
                  suggestions.forEach(s => next.add(s.id))
                  return next
                })
                setPreviewSuggestionId(null)
              }}
              className="text-[10px] font-bold"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Dismiss all
            </button>
          </div>
          <ul className="space-y-1.5">
            {suggestions.map(s => {
              const isPreviewing = previewSuggestionId === s.id
              return (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-lg px-3 py-2"
                  style={{
                    background: isPreviewing ? 'rgba(251,191,36,0.10)' : '#0c0e11',
                    border: `1px solid ${isPreviewing ? '#FBBF24' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <p className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.8)' }}>{s.text}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setPreviewSuggestionId(prev => (prev === s.id ? null : s.id))}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={isPreviewing
                        ? { background: 'rgba(251,191,36,0.18)', color: '#FBBF24', border: '1px solid #FBBF24' }
                        : { background: 'rgba(124,147,245,0.12)', color: ACCENT, border: `1px solid ${ACCENT}55` }}
                    >
                      {isPreviewing ? 'Hide preview' : 'Preview'}
                    </button>
                    <button
                      onClick={() => {
                        setDismissedSuggestions(prev => new Set(prev).add(s.id))
                        setPreviewSuggestionId(prev => (prev === s.id ? null : prev))
                      }}
                      className="text-[10px] font-bold"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          {previewSuggestionId && (
            <p className="text-[10px] mt-2" style={{ color: '#FBBF24' }}>
              Previewing only highlights the affected teams. To act, drag a seat — you&rsquo;ll still be asked to justify the move.
            </p>
          )}
        </div>
      )}

      {busy && (
        <p className="text-xs mb-3" style={{ color: ACCENT }}>Saving move…</p>
      )}

      <div className="text-[11px] mb-4" style={BODY_STYLE}>
        Drag any seat card onto a team header to reassign. You&rsquo;ll be asked to justify the move before it commits — every reassignment is logged immutably in your decisions audit trail.
      </div>

      {lens === 'functional' && <FunctionalView />}
      {lens === 'divisional' && <DivisionalView />}
      {lens === 'matrix' && <MatrixView />}
      {lens === 'flat' && <FlatView />}

      {pendingMove && (
        <ReassignModal
          ctx={pendingMove}
          onCancel={() => { if (!busy) setPendingMove(null) }}
          onConfirm={args => commitMove(pendingMove, args)}
        />
      )}
    </div>
  )
}
