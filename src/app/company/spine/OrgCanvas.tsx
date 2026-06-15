'use client'

// OrgCanvas — the founder-approved 2D NODE-AND-LINE ORG MAP.
// Visual reference: mockups/org-mock-2d.html (approved interactive mockup).
//
// WHAT THIS IS
//   A true org chart: seat cards (title, person, team chip, verification chip)
//   connected by smooth SVG reporting curves, auto-laid-out as a tree per
//   location. Pan (drag background), zoom (wheel / pinch / buttons), elevation
//   shadows for depth. The chart is the HUB — clicking a person opens a
//   slide-over that links to the HR portal, lifecycle and skill density.
//
// LAYOUT ASSUMPTIONS (there is no explicit manager FK on roles_seats):
//   • Each LOCATION renders as its own tree under a compact location root node.
//   • Teams nest via teams.parent_team_id (a parent outside the same location
//     is treated as top-level within its own location).
//   • Within a team, the highest-seniority seat (cxo > vp > director > manager
//     > lead > senior > mid > junior > intern) is promoted to TEAM HEAD and
//     becomes the branch anchor; the team's remaining seats and any child
//     teams' anchors hang off it. A team with no visible seats renders as a
//     team placeholder node (still a drop target).
//   • The reporting line is therefore team→seat, approximated through the
//     team-head seat — the closest honest model of hierarchy we can derive
//     from locations / teams(parent_team_id, function) / seats(seniority).
//   • Tidy-tree layout: subtree widths computed bottom-up, children centered
//     under their parent, fixed vertical rhythm per depth level.
//
// STRUCTURE DETECTOR (drag-drop)
//   classifyOrgShape() formalizes the four old lens groupings (Functional /
//   Divisional / Matrix / Flat) into a deterministic classifier over the
//   occupied (function × location) team cells. On drop we classify before vs
//   after; if the shape changes, the staged-move banner says so explicitly.
//   Confirm flows into the EXISTING ReassignModal justification →
//   /api/company/spine/decision audit write. Undo restores with ZERO writes.
//
// KEPT FROM THE PREVIOUS CANVAS
//   Current/Target state filter · Calibration Lens overlay + legend ·
//   advisory suggestion bar · justification-gated drag-drop (ReassignModal +
//   decision audit) · Verified-Org plumbing (now with a clickable status
//   panel) · empty states. The four lens TOGGLES were replaced by the chart;
//   their classification logic lives on inside classifyOrgShape().

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReassignModal, { type ReassignContext } from './ReassignModal'

/* ════════════════════════════════════════════════════════════════════════
   PALETTE TOKENS — a global palette decision is PENDING. Every colour in
   this canvas is one of these 10 CSS custom properties (referenced ONLY via
   var(...) below, with color-mix() for alpha variants). When the founder
   picks the palette we swap these 10 lines, not 500.
   Defaults = the spine's current values. Elevation shadows are intentionally
   palette-independent black (depth, not hue).
   ════════════════════════════════════════════════════════════════════════ */
const PALETTE = {
  // VIOLET MINT — the locked palette (Ana, 2026-06-11). Violet = intelligence,
  // emerald = proof. Green is never decorative: every green pixel means
  // verified/positive.
  '--bg': '#060609',                          // canvas background (deep space)
  '--surface': '#0D0C14',                     // card / panel surface (violet-tinted)
  '--accent': '#38BDF8',                      // primary accent (violet)
  '--accent2': '#34D399',                     // secondary accent (emerald — gradient pair)
  '--verified': '#34D399',                    // emerald — employee-verified
  '--warn': '#FBBF24',                        // amber — assessed / caution
  '--punch': '#FB7185',                       // coral — destructive / risk
  '--text': 'rgba(255,255,255,0.9)',          // headings / primary text
  '--text-muted': 'rgba(255,255,255,0.5)',    // body / secondary text
  '--edge': 'rgba(56, 189, 248,0.35)',         // reporting lines (violet)
} as React.CSSProperties

/* ── Types (mirror the spine tables loaded by page.tsx via select('*')) ── */
type Location = { id: string; name: string; country: string; city?: string | null }
type Team = { id: string; name: string; location_id: string; function: string | null; parent_team_id: string | null }
type Person = { id: string; full_name: string; preferred_name: string | null; email?: string | null; whatsapp_number?: string | null }
type Seat = {
  id: string
  title: string
  team_id: string
  seniority: string | null
  person_id: string | null
  status: string
  // Explicit person-to-person reporting edge (supabase/org_restructure.sql).
  // When set, the reporting line points at this seat instead of the team head.
  // Absent/null → falls back to the team-anchor model. Probed safely so the
  // chart still renders before the migration runs.
  reports_to?: string | null
  // Calibration Lens inputs (nullable — overlay degrades to neutral).
  okr_completion_pct?: number | null
  absorbed_capacity_pct?: number | null
  ai_exposure_score?: number | null
  flight_risk_score?: number | null
  // Detected skills denormalized on the spine (Activity Catalogue).
  primary_activities?: string[] | null
  // VERIFIED ORG trust tier (supabase/verified_org.sql). Key absent before
  // the migration runs → all verification UI hides itself.
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

type State = 'current' | 'target'

// A single pending change in Draft mode. `from*` always captures the ORIGINAL
// live value so Discard returns cleanly and Implement targets correctly.
type DraftMove = {
  seatId: string
  seatTitle: string
  personName: string | null
  changeKind: 'team' | 'reports_to'
  fromTeamId: string
  fromTeamName: string
  fromReportsTo: string | null
  toTeamId: string
  toTeamName: string
  toManagerSeatId: string | null
  managerName: string | null
}

const FUNCTION_LABEL: Record<string, string> = {
  engineering: 'Engineering',
  sales: 'Sales',
  ops: 'Operations',
  finance: 'Finance',
  people: 'People / HR',
  marketing: 'Marketing',
  other: 'Other',
}

// Seat-status dot colour — mapped onto palette tokens.
const STATUS_VAR: Record<string, string> = {
  active: 'var(--verified)',
  planned: 'var(--accent)',
  vacant: 'var(--warn)',
  separating: 'var(--punch)',
  frozen: 'var(--text-muted)',
  redeployed: 'var(--text-muted)',
}

const STATE_FILTER: Record<State, Set<string>> = {
  current: new Set(['active', 'separating']),
  target: new Set(['active', 'planned']),
}

/* ── STRUCTURE DETECTOR ──────────────────────────────────────────────────
   The four old lenses were *views* of the same groupings; this classifier
   formalizes them so a drag-drop can detect when the org's SHAPE changes:
     • Matrix      — ≥2 functions each spanning ≥2 locations AND ≥2 locations
                     each hosting ≥2 functions (a populated fn × loc grid)
     • Divisional  — ≥2 locations, with location-led groupings (some location
                     hosts multiple functions — self-contained divisions)
     • Functional  — function-led: multiple functions or team depth, in
                     essentially one location
     • Flat        — minimal hierarchy, single function band, no sub-teams
   Structure = the constellation of OCCUPIED team cells: a team only counts
   while seats sit in it, so moving a seat can genuinely flip the shape
   (e.g. the move that puts Engineering into a second location). */
export type OrgShape = 'Functional' | 'Divisional' | 'Matrix' | 'Flat'

function classifyOrgShape(teams: Team[], seats: Seat[]): OrgShape {
  const occupiedTeamIds = new Set(seats.map(s => s.team_id))
  const active = teams.filter(t => occupiedTeamIds.has(t.id))
  if (active.length === 0) return 'Flat'
  const hasDepth = active.some(t => t.parent_team_id && occupiedTeamIds.has(t.parent_team_id))
  const fnLocs = new Map<string, Set<string>>()
  const locFns = new Map<string, Set<string>>()
  for (const t of active) {
    const fn = t.function || 'other'
    if (!fnLocs.has(fn)) fnLocs.set(fn, new Set())
    fnLocs.get(fn)!.add(t.location_id)
    if (!locFns.has(t.location_id)) locFns.set(t.location_id, new Set())
    locFns.get(t.location_id)!.add(fn)
  }
  const fnsSpanningLocs = [...fnLocs.values()].filter(s => s.size >= 2).length
  const locsHostingFns = [...locFns.values()].filter(s => s.size >= 2).length
  if (fnsSpanningLocs >= 2 && locsHostingFns >= 2) return 'Matrix'
  if (locFns.size >= 2 && locsHostingFns >= 1) return 'Divisional'
  if (fnLocs.size >= 2 || hasDepth) return 'Functional'
  return 'Flat'
}

/* ── CALIBRATION LENS (kept verbatim from the previous canvas) ──────────── */
type CalBucket = 'gold' | 'slate' | 'crimson' | 'neutral'

const OKR_HIGH = 70           // "top performer" / has a real timeline
const CAPACITY_OVERLOAD = 100 // absorbed_capacity_pct > 100 = overloaded
const AI_EXPOSURE_HIGH = 70   // high automation exposure
const NO_TIMELINE_STATUS = new Set(['planned', 'vacant', 'frozen'])

// Pure, deterministic classifier. flight_risk_score is intentionally ignored
// (nullable Year-2 signal). Returns 'neutral' whenever inputs are missing.
function calibrationBucket(seat: Seat): CalBucket {
  const okr = seat.okr_completion_pct
  const cap = seat.absorbed_capacity_pct
  const ai = seat.ai_exposure_score
  if (typeof ai === 'number' && ai >= AI_EXPOSURE_HIGH) {
    const lowOkr = typeof okr === 'number' ? okr < OKR_HIGH : true
    const noTimeline = NO_TIMELINE_STATUS.has(seat.status)
    if (lowOkr || noTimeline) return 'crimson'
  }
  if (typeof okr === 'number' && typeof cap === 'number') {
    if (okr >= OKR_HIGH && cap > CAPACITY_OVERLOAD) return 'gold'
    if (okr >= OKR_HIGH && cap <= CAPACITY_OVERLOAD) return 'slate'
  }
  return 'neutral'
}

// Calibration colours mapped onto palette tokens: gold→--warn, slate→muted,
// crimson→--punch (so a palette swap re-skins the lens too).
const CAL_VAR: Record<Exclude<CalBucket, 'neutral'>, string> = {
  gold: 'var(--warn)',
  slate: 'var(--text-muted)',
  crimson: 'var(--punch)',
}
const CAL_LEGEND: { bucket: Exclude<CalBucket, 'neutral'>; label: string }[] = [
  { bucket: 'gold', label: 'Top performer + overloaded — retention risk' },
  { bucket: 'slate', label: 'Optimized / healthy' },
  { bucket: 'crimson', label: 'High AI-exposure, no timeline' },
]

const VERIFY_LABEL: Record<string, string> = {
  self_reported: 'Self-reported — not yet confirmed by the employee',
  shapi_assessed: 'Shapi-assessed — response received, details contested',
  verified: 'Verified — confirmed by the employee via magic link',
}

/* ── VERIFY API payloads ────────────────────────────────────────────────── */
type VerifyChannel = { channel: 'whatsapp' | 'email'; ok: boolean; to: string; error?: string }
type VerifyResult = {
  seat_id: string
  seat_title: string
  person_id: string
  person_name: string
  send_status: 'newly_sent' | 'already_sent' | 'already_verified'
  link: string
  sent_via: string[]
  sent_at: string | null
  channels?: VerifyChannel[]
  errors?: string[]
}
type VerifySeatDetail = {
  seat_id: string
  seat_title: string
  person_id: string
  person_name: string
  verification_status: string
  verified_at: string | null
  verified_via: string | null
  latest_token: { status: string; sent_via: string | null; sent_at: string; expires_at: string; link: string } | null
}

/* ── SUGGESTION BAR (kept — advisory only, never mutates layout) ───────── */
type Suggestion = { id: string; text: string; teamIds: string[] }

/* ── GRAPH + LAYOUT ENGINE ──────────────────────────────────────────────── */
type GNode = {
  id: string
  kind: 'location' | 'team' | 'seat'
  seat?: Seat
  teamId: string | null      // drop-target team (null on location roots)
  locationId: string
  parentId: string | null
  children: GNode[]
  x: number
  y: number
  w: number
  h: number
}

type Graph = {
  nodes: GNode[]
  byId: Record<string, GNode>
  anchorByTeam: Record<string, string> // teamId → anchor node id (head seat or placeholder)
  width: number
  height: number
  dividers: number[]                   // x positions between location trees (compare mode)
  locExtents: { locId: string; x0: number; x1: number }[]
}

const SEAT_W = 176
const SEAT_H = 86
const TEAM_W = 176
const TEAM_H = 58
const LOC_W = 212
const LOC_H = 60
const H_GAP = 26
const LEVEL_H = 156
const TREE_GAP = 96

const SENIORITY_RANK: Record<string, number> = {
  cxo: 9, vp: 8, director: 7, manager: 6, lead: 5, senior: 4, mid: 3, junior: 2, intern: 1,
}
const rank = (s: Seat) => SENIORITY_RANK[s.seniority || ''] || 0

function countryFlag(cc: string): string {
  const c = (cc || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c) || c === 'XX') return '🌍'
  return String.fromCodePoint(...[...c].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65))
}

function buildGraph(
  locs: Location[],
  teams: Team[],
  visibleSeats: Seat[],
  effTeamId: (s: Seat) => string,
  effReportsTo: (s: Seat) => string | null,
  withDividers: boolean
): Graph {
  const nodes: GNode[] = []
  const byId: Record<string, GNode> = {}
  const anchorByTeam: Record<string, string> = {}
  const dividers: number[] = []
  const locExtents: { locId: string; x0: number; x1: number }[] = []
  let xOffset = 0
  let maxY = 0

  const add = (n: GNode) => { nodes.push(n); byId[n.id] = n; return n }

  for (let li = 0; li < locs.length; li++) {
    const loc = locs[li]
    const locTeams = teams.filter(t => t.location_id === loc.id)
    const locTeamIds = new Set(locTeams.map(t => t.id))
    const seatsByTeam = new Map<string, Seat[]>()
    for (const s of visibleSeats) {
      const tid = effTeamId(s)
      if (!locTeamIds.has(tid)) continue
      const list = seatsByTeam.get(tid) || []
      list.push(s)
      seatsByTeam.set(tid, list)
    }
    for (const list of seatsByTeam.values()) {
      list.sort((a, b) => rank(b) - rank(a) || a.title.localeCompare(b.title))
    }

    const root = add({
      id: `loc:${loc.id}`, kind: 'location', teamId: null, locationId: loc.id,
      parentId: null, children: [], x: 0, y: 0, w: LOC_W, h: LOC_H,
    })

    function buildTeam(team: Team, parent: GNode): GNode {
      const tseats = seatsByTeam.get(team.id) || []
      const childTeams = locTeams.filter(t => t.parent_team_id === team.id)
      let anchor: GNode
      let rest: Seat[] = []
      if (tseats.length > 0) {
        // Highest-seniority seat = team head = branch anchor.
        anchor = add({
          id: `seat:${tseats[0].id}`, kind: 'seat', seat: tseats[0], teamId: team.id,
          locationId: loc.id, parentId: parent.id, children: [], x: 0, y: 0, w: SEAT_W, h: SEAT_H,
        })
        rest = tseats.slice(1)
      } else {
        anchor = add({
          id: `team:${team.id}`, kind: 'team', teamId: team.id, locationId: loc.id,
          parentId: parent.id, children: [], x: 0, y: 0, w: TEAM_W, h: TEAM_H,
        })
      }
      anchorByTeam[team.id] = anchor.id
      anchor.children = [
        ...rest.map(s => add({
          id: `seat:${s.id}`, kind: 'seat', seat: s, teamId: team.id, locationId: loc.id,
          parentId: anchor.id, children: [], x: 0, y: 0, w: SEAT_W, h: SEAT_H,
        })),
        ...childTeams.map(ct => buildTeam(ct, anchor)),
      ]
      return anchor
    }

    // Top-level teams: no parent, or parent outside this location's team set.
    const topTeams = locTeams.filter(t => !t.parent_team_id || !locTeamIds.has(t.parent_team_id))
    root.children = topTeams.map(t => buildTeam(t, root))

    // reports_to override — re-parent a seat under an explicit manager seat
    // (person-to-person reporting) within this location. The team-anchor model
    // stays the fallback when reports_to is null. Cycle-guarded; cross-location
    // edges are ignored (manager must render in the same location subtree).
    for (const n of nodes) {
      if (n.kind !== 'seat' || n.locationId !== loc.id || !n.seat) continue
      const mgrId = effReportsTo(n.seat)
      if (!mgrId) continue
      const mgr = byId[`seat:${mgrId}`]
      if (!mgr || mgr === n || mgr.locationId !== loc.id) continue
      // Skip if mgr is a descendant of n (would create a cycle).
      let p: GNode | null = mgr
      let cyclic = false
      while (p) { if (p === n) { cyclic = true; break } p = p.parentId ? byId[p.parentId] || null : null }
      if (cyclic) continue
      if (n.parentId) {
        const op = byId[n.parentId]
        if (op) op.children = op.children.filter(c => c !== n)
      }
      n.parentId = mgr.id
      mgr.children.push(n)
    }

    // Tidy-tree: subtree widths bottom-up, children centered under parents.
    function shift(n: GNode, dx: number) {
      n.x += dx
      n.children.forEach(c => shift(c, dx))
    }
    function layout(n: GNode, depth: number, x0: number): number {
      n.y = depth * LEVEL_H
      maxY = Math.max(maxY, n.y + n.h)
      if (n.children.length === 0) { n.x = x0; return n.w }
      let x = x0
      let total = 0
      for (const c of n.children) {
        const w = layout(c, depth + 1, x)
        x += w + H_GAP
        total += w + H_GAP
      }
      total -= H_GAP
      if (total < n.w) {
        const dx = (n.w - total) / 2
        n.children.forEach(c => shift(c, dx))
        total = n.w
      }
      n.x = x0 + total / 2 - n.w / 2
      return total
    }
    const treeW = layout(root, 0, xOffset)
    locExtents.push({ locId: loc.id, x0: xOffset, x1: xOffset + treeW })
    xOffset += treeW + TREE_GAP
    if (withDividers && li < locs.length - 1) dividers.push(xOffset - TREE_GAP / 2)
  }

  return {
    nodes, byId, anchorByTeam,
    width: Math.max(xOffset - TREE_GAP, 320),
    height: Math.max(maxY, 240),
    dividers, locExtents,
  }
}

/* ── small helpers ──────────────────────────────────────────────────────── */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

/* ════════════════════════════════════════════════════════════════════════ */
export default function OrgCanvas({ locations, teams, persons, seats }: Props) {
  const router = useRouter()

  /* — filters / modes — */
  const [state, setState] = useState<State>('current')
  const [calibration, setCalibration] = useState(false)
  const [tab, setTab] = useState<string>('all') // 'all' | location id
  const [compare, setCompare] = useState(false)
  const [compareA, setCompareA] = useState<string | null>(null)
  const [compareB, setCompareB] = useState<string | null>(null)

  /* — Draft mode (write-free sandbox) — rearrange freely, nothing touches the
     live org or the audit trail until "Implement". Discard writes nothing. — */
  const [draftMode, setDraftMode] = useState(false)
  const [draftMoves, setDraftMoves] = useState<DraftMove[]>([])
  const [draftImplementing, setDraftImplementing] = useState(false)
  const [draftJustification, setDraftJustification] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)

  /* — viewport (pan / zoom) — */
  const vpRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ scale: 0.9, x: 40, y: 28 })

  /* — drag / staged move — */
  type Gesture =
    | { mode: 'pan'; offX: number; offY: number }
    | { mode: 'node'; nodeId: string; pointerType: string; startX: number; startY: number; origX: number; origY: number; moved: boolean; draggable: boolean }
  const gestureRef = useRef<Gesture | null>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ d0: number; scale0: number; mid0: { x: number; y: number }; pan0: { x: number; y: number } } | null>(null)
  const [draggingSeatId, setDraggingSeatId] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [dropCandidate, setDropCandidate] = useState<{ nodeId: string; teamId: string; managerSeatId: string | null } | null>(null)
  const dropCandidateRef = useRef<typeof dropCandidate>(null)
  const [staged, setStaged] = useState<{
    seat: Seat; fromTeam: Team; toTeam: Team
    // changeKind 'reports_to' = the seat now reports to a specific person (team
    // unchanged); 'team' = the seat joins another team (reports to its head).
    changeKind: 'team' | 'reports_to'
    toManagerSeatId: string | null; managerName: string | null
    shapeBefore: OrgShape; shapeAfter: OrgShape; crossLocation: boolean
  } | null>(null)
  const [pendingMove, setPendingMove] = useState<ReassignContext | null>(null)
  const [busy, setBusy] = useState(false)
  // Post-commit Undo: after a move is logged, keep the last move around so the
  // founder can reverse it (moves the seat back + logs a reversing audit row).
  // Cleared on a timer or once reversed. This is the real "Undo" — distinct
  // from discarding a not-yet-confirmed staged move.
  const [lastMove, setLastMove] = useState<{
    seatId: string; seatTitle: string; personName: string | null
    fromTeamId: string; fromTeamName: string; toTeamId: string; toTeamName: string
    fromReportsTo: string | null; toManagerSeatId: string | null
    changeKind: 'team' | 'reports_to'; managerName: string | null
    personId: string | null
  } | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* — slide-over + touch move mode — */
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null)
  const [moveModeSeatId, setMoveModeSeatId] = useState<string | null>(null)

  /* — verify panel — */
  const [verifyPanelOpen, setVerifyPanelOpen] = useState(false)
  const [verifyDetail, setVerifyDetail] = useState<{ occupied_seats: number; seats: VerifySeatDetail[] } | null>(null)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [lastSend, setLastSend] = useState<Record<string, VerifyResult>>({})
  const [copiedSeatId, setCopiedSeatId] = useState<string | null>(null)

  /* — suggestions (advisory, kept) — */
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())
  const [previewSuggestionId, setPreviewSuggestionId] = useState<string | null>(null)

  /* — lookups — */
  const personById = useMemo(() => Object.fromEntries(persons.map(p => [p.id, p])), [persons])
  const teamById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams])
  const locById = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l])), [locations])

  const visibleSeats = useMemo(
    () => seats.filter(s => STATE_FILTER[state].has(s.status)),
    [seats, state]
  )

  /* — Verified Org availability + counter (graceful degrade pre-migration) — */
  const verificationEnabled = useMemo(
    () => seats.length > 0 && seats.some(s => s.verification_status !== undefined),
    [seats]
  )
  const occupiedSeats = useMemo(() => seats.filter(s => s.person_id), [seats])
  const verifiedCount = occupiedSeats.filter(s => s.verification_status === 'verified').length
  const verifiedPct = occupiedSeats.length > 0
    ? Math.round((verifiedCount / occupiedSeats.length) * 100)
    : 0

  /* — org shape (structure pill) — */
  const orgShape = useMemo(() => classifyOrgShape(teams, seats), [teams, seats])

  // Is the reports_to column live? page.tsx uses select('*'), so the key is
  // present on every row only after supabase/org_restructure.sql runs.
  // Pre-migration we disable person-to-person reporting so team moves keep
  // working exactly as before (and we never PATCH a column that doesn't exist).
  const reportsToEnabled = useMemo(
    () => seats.length > 0 && Object.prototype.hasOwnProperty.call(seats[0] as object, 'reports_to'),
    [seats]
  )

  /* — which locations the canvas renders — */
  const renderedLocations = useMemo(() => {
    if (compare) {
      const a = compareA ? locById[compareA] : null
      const b = compareB ? locById[compareB] : null
      return [a, b].filter(Boolean) as Location[]
    }
    if (tab !== 'all' && locById[tab]) return [locById[tab]]
    return locations
  }, [compare, compareA, compareB, tab, locations, locById])

  /* — staged + draft team override + graph — */
  const draftById = useMemo(
    () => Object.fromEntries(draftMoves.map(m => [m.seatId, m])) as Record<string, DraftMove>,
    [draftMoves]
  )
  const effTeamId = useCallback(
    (s: Seat) => {
      if (staged && staged.seat.id === s.id) return staged.toTeam.id
      const d = draftById[s.id]
      if (d) return d.toTeamId
      return s.team_id
    },
    [staged, draftById]
  )
  // Staged/draft-aware reporting edge: preview the new reports_to while a move
  // is staged or held in the draft; otherwise read the seat's stored reports_to
  // (undefined before the migration → null → team-anchor fallback).
  const effReportsTo = useCallback(
    (s: Seat): string | null => {
      if (staged && staged.seat.id === s.id) return staged.toManagerSeatId
      const d = draftById[s.id]
      if (d) return d.toManagerSeatId
      return s.reports_to ?? null
    },
    [staged, draftById]
  )
  const graph = useMemo(
    () => buildGraph(renderedLocations, teams, visibleSeats, effTeamId, effReportsTo, compare),
    [renderedLocations, teams, visibleSeats, effTeamId, effReportsTo, compare]
  )
  const graphRef = useRef(graph)
  graphRef.current = graph

  /* — fit view on tab / compare change — */
  const fitView = useCallback(() => {
    const vp = vpRef.current
    if (!vp) return
    const r = vp.getBoundingClientRect()
    const g = graphRef.current
    const scale = clamp(Math.min((r.width - 56) / g.width, (r.height - 56) / g.height), 0.3, 1.15)
    setView({ scale, x: Math.max((r.width - g.width * scale) / 2, 24), y: 28 })
  }, [])
  useEffect(() => { fitView() }, [fitView, tab, compare, compareA, compareB, state, locations.length])

  /* — wheel zoom (non-passive, zoom toward cursor) — */
  useEffect(() => {
    const vp = vpRef.current
    if (!vp) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = vp.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setView(v => {
        const ns = clamp(v.scale * (e.deltaY > 0 ? 0.92 : 1.08), 0.3, 2)
        return { scale: ns, x: mx - (mx - v.x) * (ns / v.scale), y: my - (my - v.y) * (ns / v.scale) }
      })
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [])

  /* — default compare pair — */
  useEffect(() => {
    if (compare) {
      if (!compareA) setCompareA(locations[0]?.id || null)
      if (!compareB) setCompareB(locations[1]?.id || null)
    }
  }, [compare, compareA, compareB, locations])

  /* — Escape closes the slide-over / move mode — */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedSeatId(null)
        setMoveModeSeatId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ── stage a move (drag-drop OR tap-select → tap-destination) ─────────── */
  // target.managerSeatId set → person-to-person "reports to" move (team kept).
  // Otherwise a team move (reports to the new team head; clears reports_to).
  function stageMove(seat: Seat, target: { teamId: string; managerSeatId: string | null }) {
    if (staged || busy) return
    const fromTeam = teamById[seat.team_id]
    if (!fromTeam) return
    const before = classifyOrgShape(teams, seats)

    if (target.managerSeatId) {
      if (target.managerSeatId === seat.id) return
      if ((seat.reports_to ?? null) === target.managerSeatId) return
      const mgrSeat = seats.find(s => s.id === target.managerSeatId)
      if (!mgrSeat) return
      const managerName = mgrSeat.person_id
        ? (personById[mgrSeat.person_id]?.preferred_name || personById[mgrSeat.person_id]?.full_name || mgrSeat.title)
        : mgrSeat.title
      setStaged({
        seat, fromTeam, toTeam: fromTeam,
        changeKind: 'reports_to',
        toManagerSeatId: target.managerSeatId, managerName,
        shapeBefore: before, shapeAfter: before, crossLocation: false,
      })
      setSelectedSeatId(null)
      return
    }

    const toTeam = teamById[target.teamId]
    if (!toTeam || fromTeam.id === toTeam.id) return
    const after = classifyOrgShape(teams, seats.map(s => (s.id === seat.id ? { ...s, team_id: target.teamId } : s)))
    setStaged({
      seat, fromTeam, toTeam,
      changeKind: 'team',
      toManagerSeatId: null, managerName: null,
      shapeBefore: before, shapeAfter: after,
      crossLocation: fromTeam.location_id !== toTeam.location_id,
    })
    setSelectedSeatId(null)
  }

  /* ── Draft mode: write-free edits accumulated until Implement ──────────── */
  // Add / update / clear a draft change. No modal, no DB write. `from*` keeps
  // the ORIGINAL live value; dropping a seat back where it started removes its
  // draft entry.
  function addDraftMove(seat: Seat, target: { teamId: string; managerSeatId: string | null }) {
    const fromTeam = teamById[seat.team_id]
    if (!fromTeam) return
    const personName = seat.person_id
      ? (personById[seat.person_id]?.preferred_name || personById[seat.person_id]?.full_name || null)
      : null
    let entry: DraftMove | null = null

    if (target.managerSeatId && target.managerSeatId !== seat.id) {
      const mgrSeat = seats.find(s => s.id === target.managerSeatId)
      if (mgrSeat && (seat.reports_to ?? null) !== target.managerSeatId) {
        const managerName = mgrSeat.person_id
          ? (personById[mgrSeat.person_id]?.preferred_name || personById[mgrSeat.person_id]?.full_name || mgrSeat.title)
          : mgrSeat.title
        entry = {
          seatId: seat.id, seatTitle: seat.title, personName, changeKind: 'reports_to',
          fromTeamId: fromTeam.id, fromTeamName: fromTeam.name, fromReportsTo: seat.reports_to ?? null,
          toTeamId: fromTeam.id, toTeamName: fromTeam.name,
          toManagerSeatId: target.managerSeatId, managerName,
        }
      }
    } else if (!target.managerSeatId) {
      const toTeam = teamById[target.teamId]
      if (toTeam && toTeam.id !== seat.team_id) {
        entry = {
          seatId: seat.id, seatTitle: seat.title, personName, changeKind: 'team',
          fromTeamId: fromTeam.id, fromTeamName: fromTeam.name, fromReportsTo: seat.reports_to ?? null,
          toTeamId: toTeam.id, toTeamName: toTeam.name,
          toManagerSeatId: null, managerName: null,
        }
      }
    }

    setDraftMoves(prev => {
      const rest = prev.filter(m => m.seatId !== seat.id)
      return entry ? [...rest, entry] : rest
    })
    setSelectedSeatId(null)
  }

  function removeDraftMove(seatId: string) {
    setDraftMoves(prev => prev.filter(m => m.seatId !== seatId))
  }

  function discardDraft() {
    setDraftMoves([])
    setDraftImplementing(false)
    setDraftJustification('')
    setDraftError(null)
    setDraftMode(false)
  }

  function toggleDraft() {
    if (draftMode) {
      if (draftMoves.length > 0 && !confirm('Discard your draft changes? Nothing has been saved to your live org.')) return
      discardDraft()
    } else {
      setStaged(null)
      setSelectedSeatId(null)
      setMoveModeSeatId(null)
      setDraftMode(true)
    }
  }

  // Implement the whole draft: one PATCH + one audit decision per change, all
  // sharing the typed justification. This is the ONLY point a draft writes.
  async function implementDraft() {
    if (draftMoves.length === 0 || busy) return
    const justification = draftJustification.trim()
    if (justification.length < 20) { setDraftError('Add a short reason (20+ characters) for this restructure.'); return }
    setBusy(true); setDraftError(null)
    try {
      for (const m of draftMoves) {
        const moveRes = await fetch('/api/company/spine/seat', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(reportsToEnabled
            ? { id: m.seatId, team_id: m.toTeamId, reports_to: m.toManagerSeatId ?? null }
            : { id: m.seatId, team_id: m.toTeamId }),
        })
        if (!moveRes.ok) {
          const d = await moveRes.json().catch(() => ({}))
          throw new Error(d.error || d.message || `Failed to move ${m.seatTitle}. Some changes may not have applied.`)
        }
        await fetch('/api/company/spine/decision', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            decision_type: 'restructure',
            justification,
            impacted_seat_id: m.seatId,
            impacted_person_id: seats.find(s => s.id === m.seatId)?.person_id ?? null,
            impacted_team_id: m.toTeamId,
            state_snapshot: {
              batch: true, change_kind: m.changeKind, seat_title: m.seatTitle,
              from_team_id: m.fromTeamId, from_team_name: m.fromTeamName,
              to_team_id: m.toTeamId, to_team_name: m.toTeamName,
              from_reports_to: m.fromReportsTo, to_reports_to: m.toManagerSeatId,
              reports_to_name: m.managerName,
            },
          }),
        })
      }
      setDraftMoves([])
      setDraftImplementing(false)
      setDraftJustification('')
      setDraftMode(false)
      router.refresh()
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'Implement failed. Please retry.')
    } finally {
      setBusy(false)
    }
  }

  // Build a reports_to draft entry (team kept). Returns null for no-ops.
  function buildReportsToDraftMove(seat: Seat, managerSeatId: string): DraftMove | null {
    const fromTeam = teamById[seat.team_id]
    if (!fromTeam || managerSeatId === seat.id) return null
    if ((seat.reports_to ?? null) === managerSeatId) return null
    const mgrSeat = seats.find(s => s.id === managerSeatId)
    if (!mgrSeat) return null
    const personName = seat.person_id
      ? (personById[seat.person_id]?.preferred_name || personById[seat.person_id]?.full_name || null)
      : null
    const managerName = mgrSeat.person_id
      ? (personById[mgrSeat.person_id]?.preferred_name || personById[mgrSeat.person_id]?.full_name || mgrSeat.title)
      : mgrSeat.title
    return {
      seatId: seat.id, seatTitle: seat.title, personName, changeKind: 'reports_to',
      fromTeamId: fromTeam.id, fromTeamName: fromTeam.name, fromReportsTo: seat.reports_to ?? null,
      toTeamId: fromTeam.id, toTeamName: fromTeam.name,
      toManagerSeatId: managerSeatId, managerName,
    }
  }

  // Reshape the draft into a template by rewriting reporting lines (teams kept).
  // Operates per visible location (each renders as its own tree). 'current'
  // clears the draft back to the live org.
  function applyTemplate(kind: 'current' | 'flat' | 'functional') {
    if (kind === 'current') { setDraftMoves([]); return }
    const moves: DraftMove[] = []
    for (const loc of renderedLocations) {
      const locTeamIds = new Set(teams.filter(t => t.location_id === loc.id).map(t => t.id))
      const locSeats = seats.filter(s => locTeamIds.has(s.team_id))
      if (locSeats.length < 2) continue
      const sorted = [...locSeats].sort((a, b) => rank(b) - rank(a))
      const top = sorted[0]
      const fnOf = (s: Seat) => (s.function || teamById[s.team_id]?.function || 'other')
      const headOfFn = new Map<string, Seat>()
      if (kind === 'functional') {
        for (const s of sorted) { const f = fnOf(s); if (!headOfFn.has(f)) headOfFn.set(f, s) }
      }
      for (const s of locSeats) {
        if (s.id === top.id) continue
        let mgrId: string
        if (kind === 'flat') {
          mgrId = top.id
        } else {
          const head = headOfFn.get(fnOf(s))
          mgrId = !head || head.id === s.id ? top.id : head.id
        }
        const mv = buildReportsToDraftMove(s, mgrId)
        if (mv) moves.push(mv)
      }
    }
    setDraftMoves(moves)
  }

  /* — node tap: open slide-over / complete a touch move / switch tab — */
  function handleNodeTap(node: GNode | undefined) {
    if (!node) return
    if (moveModeSeatId) {
      const seat = seats.find(s => s.id === moveModeSeatId)
      if (node.seat?.id === moveModeSeatId) { setMoveModeSeatId(null); return } // tap self = cancel
      const applyMove = draftMode ? addDraftMove : stageMove
      if (reportsToEnabled && seat && node.seat && node.seat.id !== seat.id) {
        // Tap a person = report to that person.
        applyMove(seat, { teamId: node.teamId as string, managerSeatId: node.seat.id })
        setMoveModeSeatId(null)
      } else if (seat && node.teamId && node.teamId !== seat.team_id) {
        applyMove(seat, { teamId: node.teamId, managerSeatId: null })
        setMoveModeSeatId(null)
      }
      return
    }
    if (node.kind === 'seat' && node.seat) setSelectedSeatId(node.seat.id)
    else if (node.kind === 'location' && !compare && tab === 'all') setTab(node.locationId)
  }

  /* ── pointer handlers: pan / pinch / drag / tap ───────────────────────── */
  function onPointerDown(e: React.PointerEvent) {
    const vp = vpRef.current
    if (!vp) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 2) {
      // Second finger → pinch zoom; cancel any in-flight drag.
      const pts = [...pointersRef.current.values()]
      pinchRef.current = {
        d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        scale0: view.scale,
        mid0: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        pan0: { x: view.x, y: view.y },
      }
      gestureRef.current = null
      setDragPos(null)
      setDropCandidate(null)
      dropCandidateRef.current = null
      setDraggingSeatId(null)
      return
    }
    try { vp.setPointerCapture(e.pointerId) } catch { /* already released */ }
    const el = (e.target as HTMLElement).closest('[data-node-id]') as HTMLElement | null
    if (el) {
      const nodeId = el.dataset.nodeId as string
      const node = graph.byId[nodeId]
      // Mouse drags freely; touch degrades to tap-select → tap-destination.
      const draggable = !!node && node.kind === 'seat' && e.pointerType !== 'touch' && !staged && !busy && !moveModeSeatId
      gestureRef.current = {
        mode: 'node', nodeId, pointerType: e.pointerType,
        startX: e.clientX, startY: e.clientY,
        origX: node?.x ?? 0, origY: node?.y ?? 0,
        moved: false, draggable,
      }
    } else {
      gestureRef.current = { mode: 'pan', offX: e.clientX - view.x, offY: e.clientY - view.y }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    // Pinch zoom (two touch pointers).
    const pinch = pinchRef.current
    if (pinch && pointersRef.current.size >= 2) {
      const vp = vpRef.current
      if (!vp) return
      const rect = vp.getBoundingClientRect()
      const pts = [...pointersRef.current.values()]
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1
      const mid = { x: (pts[0].x + pts[1].x) / 2 - rect.left, y: (pts[0].y + pts[1].y) / 2 - rect.top }
      const mid0 = { x: pinch.mid0.x - rect.left, y: pinch.mid0.y - rect.top }
      const ns = clamp(pinch.scale0 * (d / pinch.d0), 0.3, 2)
      setView({
        scale: ns,
        x: mid.x - (mid0.x - pinch.pan0.x) * (ns / pinch.scale0),
        y: mid.y - (mid0.y - pinch.pan0.y) * (ns / pinch.scale0),
      })
      return
    }
    const g = gestureRef.current
    if (!g) return
    if (g.mode === 'pan') {
      setView(v => ({ ...v, x: e.clientX - g.offX, y: e.clientY - g.offY }))
      return
    }
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (!g.moved && Math.hypot(dx, dy) > 5) {
      g.moved = true
      if (g.draggable) {
        setDraggingSeatId(graph.byId[g.nodeId]?.seat?.id || null)
      } else {
        // Touch finger moving on a node = pan the canvas, not drag the card.
        gestureRef.current = { mode: 'pan', offX: e.clientX - view.x, offY: e.clientY - view.y }
        return
      }
    }
    if (g.moved && g.draggable) {
      const node = graph.byId[g.nodeId]
      if (!node?.seat) return
      const nx = g.origX + dx / view.scale
      const ny = g.origY + dy / view.scale
      setDragPos({ nodeId: g.nodeId, x: nx, y: ny })
      // Live drop candidate: the team whose NEAREST node is closest to the
      // dragged card — re-routes the reporting line as you drag (mockup
      // behaviour). We track the closest node PER team (not just the single
      // globally-nearest node) so dropping anywhere over a team's cluster
      // registers, and accept a generous catch radius so a deliberate drag
      // "across" the chart lands instead of snapping back.
      const cx = nx + node.w / 2
      const cy = ny + node.h / 2
      const homeTeam = effTeamId(node.seat)
      const nearestPerTeam = new Map<string, { node: GNode; d: number }>()
      let homeD = Infinity
      for (const cand of graph.nodes) {
        if (!cand.teamId || cand.id === g.nodeId) continue
        const d = Math.hypot(cx - (cand.x + cand.w / 2), cy - (cand.y + cand.h / 2))
        if (cand.teamId === homeTeam) { if (d < homeD) homeD = d; continue }
        const cur = nearestPerTeam.get(cand.teamId)
        if (!cur || d < cur.d) nearestPerTeam.set(cand.teamId, { node: cand, d })
      }
      let best: GNode | null = null
      let bestD = Infinity
      for (const { node: n, d } of nearestPerTeam.values()) {
        if (d < bestD) { bestD = d; best = n }
      }
      // Accept the drop target only when the card is genuinely near another
      // team's cluster (DROP_RADIUS), OR has been pulled CLEARLY closer to it
      // than to its own home (so a deliberate long drag still lands) — but not
      // so loose that a small nudge snaps onto an adjacent team by mistake.
      const DROP_RADIUS = 230
      // If the nearest target is a seat (a person), this becomes a "reports to
      // that person" move; if it's a team placeholder, it's a team join.
      const next = best && (bestD < DROP_RADIUS || bestD < homeD * 0.7)
        ? {
            nodeId: best.id,
            teamId: best.teamId as string,
            managerSeatId: reportsToEnabled && best.kind === 'seat' && best.seat && best.seat.id !== node.seat.id ? best.seat.id : null,
          }
        : null
      setDropCandidate(next)
      dropCandidateRef.current = next
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    const g = gestureRef.current
    gestureRef.current = null
    if (!g || g.mode === 'pan') return
    const node = graph.byId[g.nodeId]
    if (!g.moved) { handleNodeTap(node); return }
    // Drop.
    const cand = dropCandidateRef.current
    setDraggingSeatId(null)
    setDragPos(null)         // card animates back / into the new branch
    setDropCandidate(null)
    dropCandidateRef.current = null
    if (node?.seat && cand) {
      if (draftMode) addDraftMove(node.seat, { teamId: cand.teamId, managerSeatId: cand.managerSeatId })
      else stageMove(node.seat, { teamId: cand.teamId, managerSeatId: cand.managerSeatId })
    }
  }

  /* ── commit (justification modal → PATCH seat + POST decision) ────────── */
  async function commitMove(
    ctx: ReassignContext,
    { decisionType, justification }: { decisionType: string; justification: string }
  ) {
    setBusy(true)
    try {
      const moveRes = await fetch('/api/company/spine/seat', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        // team_id is unchanged on a reports_to move; reports_to is cleared on a
        // team move so the seat reports to its new team head. reports_to is only
        // sent once the migration is live (else the column doesn't exist).
        body: JSON.stringify(reportsToEnabled
          ? { id: ctx.seatId, team_id: ctx.toTeamId, reports_to: ctx.toManagerSeatId ?? null }
          : { id: ctx.seatId, team_id: ctx.toTeamId }),
      })
      if (!moveRes.ok) {
        const d = await moveRes.json().catch(() => ({}))
        throw new Error(d.error || d.message || 'Move failed. The seat was not reassigned.')
      }
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
            change_kind: ctx.changeKind || 'team',
            from_team_id: ctx.fromTeamId,
            from_team_name: ctx.fromTeamName,
            to_team_id: ctx.toTeamId,
            to_team_name: ctx.toTeamName,
            from_reports_to: ctx.fromReportsTo ?? null,
            to_reports_to: ctx.toManagerSeatId ?? null,
            reports_to_name: ctx.managerName ?? null,
            person_id: ctx.personId,
            org_shape_before: staged?.shapeBefore,
            org_shape_after: staged?.shapeAfter,
          },
        }),
      })
      if (!decRes.ok) {
        const d = await decRes.json().catch(() => ({}))
        throw new Error(
          (d.message || d.error || 'Decision log failed') +
            ' — the seat was moved, but the justification was not recorded. Please retry.'
        )
      }
      // Close the modal and pull fresh server data. Keep `staged` set so the
      // optimistic override (effTeamId) holds the card in its NEW team until
      // the refreshed `seats` prop reflects the move — a reconciliation effect
      // clears `staged` once the real data catches up (no flash-back).
      setPendingMove(null)
      // Offer a real Undo for ~10s after the move lands.
      const personName = ctx.personId
        ? (personById[ctx.personId]?.preferred_name || personById[ctx.personId]?.full_name || null)
        : null
      setLastMove({
        seatId: ctx.seatId, seatTitle: ctx.seatTitle, personName,
        fromTeamId: ctx.fromTeamId, fromTeamName: ctx.fromTeamName,
        toTeamId: ctx.toTeamId, toTeamName: ctx.toTeamName, personId: ctx.personId,
        fromReportsTo: ctx.fromReportsTo ?? null, toManagerSeatId: ctx.toManagerSeatId ?? null,
        changeKind: ctx.changeKind || 'team', managerName: ctx.managerName ?? null,
      })
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      undoTimerRef.current = setTimeout(() => setLastMove(null), 10000)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  // Real post-commit Undo — moves the seat back to where it came from and logs
  // an immutable reversing entry to the audit trail (no silent rollback).
  async function undoLastMove() {
    if (!lastMove || busy) return
    setBusy(true)
    try {
      const moveRes = await fetch('/api/company/spine/seat', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(reportsToEnabled
          ? { id: lastMove.seatId, team_id: lastMove.fromTeamId, reports_to: lastMove.fromReportsTo }
          : { id: lastMove.seatId, team_id: lastMove.fromTeamId }),
      })
      if (!moveRes.ok) {
        const d = await moveRes.json().catch(() => ({}))
        throw new Error(d.error || d.message || 'Undo failed.')
      }
      const undoReason = lastMove.changeKind === 'reports_to'
        ? `Reverted reporting change for ${lastMove.seatTitle}${lastMove.managerName ? ` (no longer reports to ${lastMove.managerName})` : ''}.`
        : `Reverted reassignment: moved ${lastMove.seatTitle} back from ${lastMove.toTeamName} to ${lastMove.fromTeamName}.`
      await fetch('/api/company/spine/decision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision_type: 'restructure',
          justification: undoReason,
          impacted_seat_id: lastMove.seatId,
          impacted_person_id: lastMove.personId,
          impacted_team_id: lastMove.fromTeamId,
          state_snapshot: {
            seat_title: lastMove.seatTitle,
            reverted_from_team_id: lastMove.toTeamId,
            reverted_from_team_name: lastMove.toTeamName,
            restored_to_team_id: lastMove.fromTeamId,
            restored_to_team_name: lastMove.fromTeamName,
            person_id: lastMove.personId,
            reversal: true,
          },
        }),
      })
      setStaged(null)
      setLastMove(null)
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  // Reconcile the optimistic staged move with incoming server data: once the
  // refreshed `seats` prop shows the seat in its committed team, drop `staged`.
  useEffect(() => {
    if (!staged || busy) return
    const real = seats.find(s => s.id === staged.seat.id)
    if (real && real.team_id === staged.toTeam.id && (real.reports_to ?? null) === (staged.toManagerSeatId ?? null)) setStaged(null)
  }, [seats, staged, busy])

  /* ── verify panel actions ─────────────────────────────────────────────── */
  const loadVerifyDetail = useCallback(async () => {
    setVerifyLoading(true)
    setVerifyError(null)
    try {
      const res = await fetch('/api/company/spine/verify')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setVerifyError(data.error || 'Could not load verification status.'); return }
      if (data.available === false) {
        setVerifyError('Verification needs a one-time database update — run supabase/verified_org.sql in the Supabase SQL editor first.')
        return
      }
      setVerifyDetail({ occupied_seats: data.occupied_seats || 0, seats: data.seats || [] })
    } catch {
      setVerifyError('Network error — try again.')
    } finally {
      setVerifyLoading(false)
    }
  }, [])

  async function sendVerify(seatIdsToSend?: string[]) {
    setVerifyBusy(true)
    setVerifyError(null)
    try {
      const res = await fetch('/api/company/spine/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(seatIdsToSend && seatIdsToSend.length > 0 ? { seat_ids: seatIdsToSend } : {}),
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
      const map: Record<string, VerifyResult> = {}
      for (const r of (data.results || []) as VerifyResult[]) map[r.seat_id] = r
      setLastSend(prev => ({ ...prev, ...map }))
      await loadVerifyDetail()
      router.refresh()
    } catch {
      setVerifyError('Network error — try again.')
    } finally {
      setVerifyBusy(false)
    }
  }

  function openVerifyPanel() {
    setVerifyPanelOpen(true)
    loadVerifyDetail()
  }

  async function copyLink(seatId: string, link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedSeatId(seatId)
      setTimeout(() => setCopiedSeatId(prev => (prev === seatId ? null : prev)), 1500)
    } catch { /* clipboard blocked — the link is visible to select manually */ }
  }

  // Honest, per-channel send copy. No pretending a failed WhatsApp went out.
  function sendStatusLines(r: VerifyResult): { text: string; tone: 'ok' | 'warn' | 'muted' }[] {
    if (r.send_status === 'already_verified') {
      return [{ text: '✓ Already verified — nothing sent', tone: 'ok' }]
    }
    if (r.send_status === 'already_sent') {
      return [{ text: `↻ Already sent ${fmtDate(r.sent_at)} — existing link returned, not re-sent`, tone: 'muted' }]
    }
    const lines: { text: string; tone: 'ok' | 'warn' | 'muted' }[] = []
    for (const c of r.channels || []) {
      const name = c.channel === 'email' ? 'Email' : 'WhatsApp'
      if (c.ok) lines.push({ text: `✓ ${name} sent to ${c.to}`, tone: 'ok' })
      else {
        const trial = /trial|not.*verified|21608|21211|63038/i.test(c.error || '')
        lines.push({
          text: `✗ ${name} failed${trial ? ' (Twilio trial)' : ''} — copy the link and send it yourself`,
          tone: 'warn',
        })
      }
    }
    if (lines.length === 0) {
      lines.push({ text: 'No email or WhatsApp on file — copy the link and send it yourself', tone: 'warn' })
    }
    return lines
  }

  /* ── suggestions (advisory only — kept from previous canvas) ──────────── */
  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = []
    const SPAN_THRESHOLD = 8
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
    const goldByTeam = new Map<string, number>()
    for (const s of seats) {
      if (calibrationBucket(s) === 'gold') goldByTeam.set(s.team_id, (goldByTeam.get(s.team_id) || 0) + 1)
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

  const highlightedTeamIds = useMemo<Set<string>>(() => {
    if (!previewSuggestionId) return new Set()
    const s = suggestions.find(x => x.id === previewSuggestionId)
    return new Set(s?.teamIds || [])
  }, [previewSuggestionId, suggestions])

  /* ── per-location stats (compare panel) ───────────────────────────────── */
  function locStats(locId: string) {
    const tIds = new Set(teams.filter(t => t.location_id === locId).map(t => t.id))
    const locSeats = seats.filter(s => tIds.has(s.team_id))
    const headcount = locSeats.filter(s => s.person_id).length
    const open = locSeats.filter(s => s.status === 'vacant' || s.status === 'planned').length
    const skillTally = new Map<string, number>()
    for (const s of locSeats) {
      for (const sk of s.primary_activities || []) {
        skillTally.set(sk, (skillTally.get(sk) || 0) + 1)
      }
    }
    const skills = [...skillTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k)
    return { headcount, open, skills }
  }

  /* ── empty state ──────────────────────────────────────────────────────── */
  if (locations.length === 0 && teams.length === 0 && seats.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{ ...PALETTE, background: 'var(--surface)', border: '1px dashed color-mix(in srgb, var(--accent) 35%, transparent)' }}
      >
        <p className="text-sm" style={{ color: 'var(--text)' }}>
          Your visual org map appears here once you have at least one location, team and seat.
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Upload a CSV below or add a location to get started.
        </p>
      </div>
    )
  }

  /* — render position of a node (drag override wins) — */
  const renderPos = (n: GNode) =>
    dragPos && dragPos.nodeId === n.id ? { x: dragPos.x, y: dragPos.y } : { x: n.x, y: n.y }

  /* — effective parent node (live re-route while dragging) — */
  function effectiveParent(n: GNode): GNode | null {
    if (dragPos && dragPos.nodeId === n.id && dropCandidate) {
      if (dropCandidate.managerSeatId) {
        const mgr = graph.byId[`seat:${dropCandidate.managerSeatId}`]
        if (mgr && mgr.id !== n.id) return mgr
      }
      const anchorId = graph.anchorByTeam[dropCandidate.teamId]
      const anchor = anchorId ? graph.byId[anchorId] : null
      if (anchor && anchor.id !== n.id) return anchor
    }
    return n.parentId ? graph.byId[n.parentId] || null : null
  }

  const draggingNodeId = dragPos?.nodeId || null
  const stagedNodeId = staged ? `seat:${staged.seat.id}` : null
  const selectedSeat = selectedSeatId ? seats.find(s => s.id === selectedSeatId) || null : null
  const moveModeSeat = moveModeSeatId ? seats.find(s => s.id === moveModeSeatId) || null : null

  /* — verify panel groups — */
  const nowMs = Date.now()
  const vSeats = verifyDetail?.seats || []
  const vVerified = vSeats.filter(s => s.verification_status === 'verified')
  const vAwaiting = vSeats.filter(s =>
    s.verification_status !== 'verified' &&
    s.latest_token && s.latest_token.status === 'pending' && Date.parse(s.latest_token.expires_at) > nowMs
  )
  const vNotSent = vSeats.filter(s => !vVerified.includes(s) && !vAwaiting.includes(s))

  const shapeChanged = staged && staged.shapeBefore !== staged.shapeAfter

  /* ════════════════════════════ RENDER ═══════════════════════════════════ */
  return (
    <div
      className="rounded-2xl p-4 sm:p-5 relative"
      style={{ ...PALETTE, background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--accent) 33%, transparent)' }}
    >
      {/* Component-scoped styles — colours strictly via var() tokens. */}
      <style>{`
        .spine-node {
          position: absolute;
          border-radius: 14px;
          border: 1.5px solid transparent;
          padding: 10px 12px;
          cursor: grab;
          user-select: none;
          -webkit-user-select: none;
          background: linear-gradient(var(--surface), var(--surface)) padding-box,
            linear-gradient(135deg, color-mix(in srgb, var(--accent) 28%, transparent), color-mix(in srgb, var(--accent2) 28%, transparent)) border-box;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 16px 38px rgba(0,0,0,0.42);
          transition: left .28s cubic-bezier(.2,.8,.25,1), top .28s cubic-bezier(.2,.8,.25,1), box-shadow .2s;
        }
        .spine-node:hover {
          box-shadow: 0 4px 8px rgba(0,0,0,0.5), 0 24px 54px rgba(0,0,0,0.5), 0 0 22px color-mix(in srgb, var(--accent) 12%, transparent);
        }
        .spine-node.dragging {
          cursor: grabbing;
          z-index: 40;
          transition: box-shadow .2s;
          transform: scale(1.04) rotate(1deg);
          box-shadow: 0 12px 24px rgba(0,0,0,0.6), 0 40px 90px rgba(0,0,0,0.6), 0 0 40px color-mix(in srgb, var(--accent) 25%, transparent);
        }
        .spine-node.v-verified {
          background: linear-gradient(color-mix(in srgb, var(--verified) 7%, var(--surface)), color-mix(in srgb, var(--verified) 7%, var(--surface))) padding-box,
            linear-gradient(135deg, color-mix(in srgb, var(--verified) 55%, transparent), color-mix(in srgb, var(--verified) 24%, transparent)) border-box;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 16px 38px rgba(0,0,0,0.42), 0 0 22px color-mix(in srgb, var(--verified) 18%, transparent);
        }
        .spine-node.v-assessed {
          background: linear-gradient(color-mix(in srgb, var(--warn) 5%, var(--surface)), color-mix(in srgb, var(--warn) 5%, var(--surface))) padding-box,
            linear-gradient(135deg, color-mix(in srgb, var(--warn) 45%, transparent), color-mix(in srgb, var(--warn) 18%, transparent)) border-box;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 16px 38px rgba(0,0,0,0.42), 0 0 16px color-mix(in srgb, var(--warn) 12%, transparent);
        }
        /* Calibration colours WIN the card body; verified keeps the 3px left bar. */
        .spine-node.cal-gold {
          background: linear-gradient(var(--surface), var(--surface)) padding-box,
            linear-gradient(135deg, var(--warn), color-mix(in srgb, var(--warn) 35%, transparent)) border-box;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 16px 38px rgba(0,0,0,0.42), 0 0 16px color-mix(in srgb, var(--warn) 35%, transparent);
        }
        .spine-node.cal-slate {
          background: linear-gradient(var(--surface), var(--surface)) padding-box,
            linear-gradient(135deg, var(--text-muted), color-mix(in srgb, var(--text-muted) 35%, transparent)) border-box;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 16px 38px rgba(0,0,0,0.42);
        }
        .spine-node.cal-crimson {
          background: linear-gradient(var(--surface), var(--surface)) padding-box,
            linear-gradient(135deg, var(--punch), color-mix(in srgb, var(--punch) 35%, transparent)) border-box;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 16px 38px rgba(0,0,0,0.42), 0 0 16px color-mix(in srgb, var(--punch) 35%, transparent);
        }
        .spine-node.loc {
          background: linear-gradient(var(--surface), var(--surface)) padding-box,
            linear-gradient(135deg, var(--accent), var(--accent2)) border-box;
          cursor: pointer;
        }
        .spine-node.team-ph {
          background: linear-gradient(var(--bg), var(--bg)) padding-box,
            linear-gradient(135deg, color-mix(in srgb, var(--accent) 22%, transparent), color-mix(in srgb, var(--accent2) 22%, transparent)) border-box;
          border-style: dashed;
          cursor: default;
        }
        .spine-node.drop-hot {
          box-shadow: 0 0 0 2px var(--accent), 0 16px 38px rgba(0,0,0,0.42), 0 0 28px color-mix(in srgb, var(--accent) 40%, transparent) !important;
        }
        .spine-node.suggest-hot {
          outline: 2px dashed var(--warn);
          outline-offset: 3px;
        }
        .spine-node.move-source {
          box-shadow: 0 0 0 2px var(--accent2), 0 16px 38px rgba(0,0,0,0.42), 0 0 28px color-mix(in srgb, var(--accent2) 40%, transparent) !important;
        }
        /* Planned ("target") seats — the roles you're hiring for. Dashed violet
           halo + animated pulse so the target roles catch the eye immediately. */
        .spine-node.seat-planned {
          background: linear-gradient(var(--bg), var(--bg)) padding-box,
            linear-gradient(135deg, var(--accent), var(--accent2)) border-box;
          border-style: dashed;
          animation: spine-planned-pulse 2.6s ease-in-out infinite;
        }
        @keyframes spine-planned-pulse {
          0%, 100% { box-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 16px 38px rgba(0,0,0,0.42), 0 0 0 0 color-mix(in srgb, var(--accent) 30%, transparent); }
          50% { box-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 16px 38px rgba(0,0,0,0.42), 0 0 24px 2px color-mix(in srgb, var(--accent) 45%, transparent); }
        }
        .spine-edge { stroke: var(--edge); stroke-width: 2; fill: none; transition: stroke .25s; }
        .spine-edge.hot {
          stroke: var(--accent); stroke-width: 2.5;
          filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 60%, transparent));
        }
        .spine-chip {
          font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          padding: 2.5px 7px; border-radius: 999px; white-space: nowrap;
        }
        .spine-title {
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      {/* ── Toolbar (single cohesive control bar) ───────────────────────── */}
      <div
        className="mb-3 rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg)', border: '1px solid color-mix(in srgb, var(--text) 9%, transparent)' }}
      >
        {/* Row 1 — view modes (left) · org status + actions (right) */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>View</span>

            {/* Segmented control — Current vs Planned (mutually exclusive state) */}
            <div className="inline-flex items-center rounded-full p-0.5" style={{ background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--text) 8%, transparent)' }}>
              {(['current', 'target'] as State[]).map(s => {
                const on = state === s
                const isCurrent = s === 'current'
                const tint = isCurrent ? 'var(--verified)' : 'var(--accent)'
                return (
                  <button
                    key={s}
                    onClick={() => setState(s)}
                    className="text-xs font-bold px-3 py-1 rounded-full transition-colors"
                    style={on
                      ? { background: `color-mix(in srgb, ${tint} 20%, transparent)`, color: tint }
                      : { background: 'transparent', color: 'var(--text-muted)' }}
                    title={isCurrent
                      ? 'Current — the org as it stands today (filled + departing seats)'
                      : 'Planned — the org you\u2019re building toward, including roles you\u2019re hiring for'}
                  >
                    {isCurrent ? 'Current' : 'Planned'}
                  </button>
                )
              })}
            </div>

            {/* Overlay + mode toggles — flat chips, fill only when active */}
            <div className="inline-flex items-center gap-1">
              <button
                onClick={() => setCalibration(v => !v)}
                className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                style={calibration
                  ? { background: 'color-mix(in srgb, var(--warn) 18%, transparent)', color: 'var(--warn)' }
                  : { background: 'transparent', color: 'var(--text-muted)' }}
                title="Overlay OKR + capacity + AI-exposure heatmap on seat cards"
              >
                {calibration ? '◉' : '○'} Calibration
              </button>
              {locations.length >= 2 && (
                <button
                  onClick={() => { setCompare(v => !v); setTab('all') }}
                  className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                  style={compare
                    ? { background: 'color-mix(in srgb, var(--accent2) 20%, transparent)', color: 'var(--accent2)' }
                    : { background: 'transparent', color: 'var(--text-muted)' }}
                  title="Compare two locations side by side — drag people between them to plan relocations"
                >
                  ⇄ Compare
                </button>
              )}
              <button
                onClick={toggleDraft}
                className="text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                style={draftMode
                  ? { background: 'color-mix(in srgb, var(--accent) 22%, transparent)', color: 'var(--accent)' }
                  : { background: 'transparent', color: 'var(--text-muted)' }}
                title="Draft mode — rearrange the org freely with no prompts. Nothing is saved or logged until you Implement."
              >
                {draftMode ? '✎ Draft on' : '✎ Draft'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Structure chip — live shape classification + staged transition. */}
            <span
              className="text-[11px] font-bold px-3 py-1.5 rounded-full"
              style={shapeChanged
                ? { background: 'color-mix(in srgb, var(--warn) 12%, transparent)', color: 'var(--warn)' }
                : { background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)' }}
              title="Detected from your occupied team cells (function × location). Drag-drop moves re-detect live."
            >
              {staged && shapeChanged
                ? `Structure: ${staged.shapeBefore} → ${staged.shapeAfter}?`
                : `Structure: ${orgShape}`}
            </span>

            {verificationEnabled && (
              <div
                className="inline-flex items-center rounded-full p-0.5"
                style={{ background: 'color-mix(in srgb, var(--verified) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--verified) 28%, transparent)' }}
              >
                <button
                  onClick={openVerifyPanel}
                  className="text-xs font-bold px-3 py-1 rounded-full transition-colors"
                  style={{ background: 'transparent', color: 'var(--verified)' }}
                  title={`${verifiedCount} of ${occupiedSeats.length} occupied seats confirmed by the employee themselves — click for the full status panel`}
                >
                  Verified {verifiedPct}% ▾
                </button>
                <button
                  onClick={() => { setVerifyPanelOpen(true); sendVerify() }}
                  disabled={verifyBusy || occupiedSeats.length === 0}
                  className="text-xs font-bold px-3 py-1 rounded-full transition-colors disabled:opacity-40"
                  style={{ background: 'var(--verified)', color: 'var(--bg)' }}
                  title="Send confirmations to everyone who needs one — seats already verified or already holding a live link are skipped automatically"
                >
                  {verifyBusy ? 'Sending…' : 'Verify org →'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2 — location filter / compare pickers */}
        <div
          className="flex flex-wrap items-center gap-1.5 px-3 py-2"
          style={{ borderTop: '1px solid color-mix(in srgb, var(--text) 7%, transparent)' }}
        >
          {!compare ? (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider mr-0.5" style={{ color: 'var(--text-muted)' }}>Location</span>
              <button
                onClick={() => setTab('all')}
                className="text-xs font-bold px-3 py-1 rounded-full transition-colors"
                style={tab === 'all'
                  ? { background: 'color-mix(in srgb, var(--accent) 22%, transparent)', color: 'var(--accent)' }
                  : { background: 'transparent', color: 'var(--text-muted)' }}
              >
                All locations
              </button>
              {locations.map(loc => (
                <button
                  key={loc.id}
                  onClick={() => setTab(loc.id)}
                  className="text-xs font-bold px-3 py-1 rounded-full transition-colors"
                  style={tab === loc.id
                    ? { background: 'color-mix(in srgb, var(--accent) 22%, transparent)', color: 'var(--accent)' }
                    : { background: 'transparent', color: 'var(--text-muted)' }}
                >
                  {countryFlag(loc.country)} {loc.city || loc.name}
                </button>
              ))}
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent2)' }}>Comparing</span>
              {[
                { val: compareA, set: setCompareA },
                { val: compareB, set: setCompareB },
              ].map((side, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i === 1 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>vs</span>}
                  <select
                    value={side.val || ''}
                    onChange={e => side.set(e.target.value || null)}
                    className="text-xs font-bold px-2 py-1.5 rounded-lg outline-none"
                    style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid color-mix(in srgb, var(--accent2) 40%, transparent)' }}
                  >
                    {locations.map(l => (
                      <option key={l.id} value={l.id} style={{ background: 'var(--bg)' }}>
                        {countryFlag(l.country)} {l.city || l.name}
                      </option>
                    ))}
                  </select>
                </span>
              ))}
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Drag a person across the divider to plan a relocation — same justification + audit trail.
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Verify status panel — ONE honest panel ──────────────────────── */}
      {verifyPanelOpen && (
        <div
          className="mb-3 rounded-xl p-3"
          style={{ background: 'color-mix(in srgb, var(--verified) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--verified) 30%, transparent)' }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--verified)' }}>
              Org verification · {verifiedCount}/{occupiedSeats.length} confirmed
            </span>
            <button onClick={() => setVerifyPanelOpen(false)} className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
              Close ✕
            </button>
          </div>
          <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
            Shapi sends automatically by WhatsApp and email where possible; links are for manual sharing if a send failed.
            Each link is valid 14 days.
          </p>

          {verifyError && (
            <p className="text-xs mb-2 px-3 py-2 rounded-lg" style={{ color: 'var(--punch)', background: 'color-mix(in srgb, var(--punch) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--punch) 25%, transparent)' }}>
              {verifyError}
            </p>
          )}
          {verifyLoading && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading status…</p>}

          {verifyDetail && !verifyLoading && (
            <div className="space-y-3">
              {/* ✅ Verified */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--verified)' }}>
                  ✅ Verified · {vVerified.length}
                </p>
                {vVerified.length === 0
                  ? <p className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>Nobody yet — send the links below.</p>
                  : (
                    <ul className="space-y-1">
                      {vVerified.map(s => (
                        <li key={s.seat_id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-xs" style={{ background: 'var(--bg)' }}>
                          <span style={{ color: 'var(--text)' }} className="font-bold">
                            {s.person_name} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>· {s.seat_title}</span>
                          </span>
                          <span style={{ color: 'var(--verified)' }}>
                            confirmed {fmtDate(s.verified_at)}{s.verified_via ? ` · ${s.verified_via}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>

              {/* ⏳ Awaiting */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--warn)' }}>
                  ⏳ Awaiting confirmation · {vAwaiting.length}
                </p>
                {vAwaiting.length === 0
                  ? <p className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>No live links waiting.</p>
                  : (
                    <ul className="space-y-1">
                      {vAwaiting.map(s => {
                        const t = s.latest_token!
                        const channels = t.sent_via && t.sent_via !== 'link' ? t.sent_via.split('+').join(' + ') : 'link only'
                        return (
                          <li key={s.seat_id} className="rounded-lg px-3 py-1.5 text-xs" style={{ background: 'var(--bg)' }}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span style={{ color: 'var(--text)' }} className="font-bold">
                                {s.person_name} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>· {s.seat_title}</span>
                              </span>
                              <span className="flex items-center gap-2">
                                <span style={{ color: 'var(--text-muted)' }}>
                                  sent {fmtDate(t.sent_at)} via {channels} · valid 14 days
                                </span>
                                <button
                                  onClick={() => copyLink(s.seat_id, t.link)}
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={copiedSeatId === s.seat_id
                                    ? { background: 'color-mix(in srgb, var(--verified) 15%, transparent)', color: 'var(--verified)', border: '1px solid var(--verified)' }
                                    : { background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)' }}
                                >
                                  {copiedSeatId === s.seat_id ? '✓ Copied' : 'Copy link'}
                                </button>
                              </span>
                            </div>
                            {lastSend[s.seat_id] && sendStatusLines(lastSend[s.seat_id]).map((l, i) => (
                              <p key={i} className="text-[10px] mt-0.5" style={{ color: l.tone === 'ok' ? 'var(--verified)' : l.tone === 'warn' ? 'var(--warn)' : 'var(--text-muted)' }}>{l.text}</p>
                            ))}
                          </li>
                        )
                      })}
                    </ul>
                  )}
              </div>

              {/* ⚪ Not sent */}
              <div>
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    ⚪ Not sent · {vNotSent.length}
                  </p>
                  {vNotSent.length > 0 && (
                    <button
                      onClick={() => sendVerify(vNotSent.map(s => s.seat_id))}
                      disabled={verifyBusy}
                      className="text-[10px] font-bold px-3 py-1 rounded-full disabled:opacity-40"
                      style={{ background: 'var(--verified)', color: 'var(--bg)', border: '1px solid var(--verified)' }}
                    >
                      {verifyBusy ? 'Sending…' : `Send to these ${vNotSent.length} →`}
                    </button>
                  )}
                </div>
                {vNotSent.length === 0
                  ? <p className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>Everyone has been contacted.</p>
                  : (
                    <ul className="space-y-1">
                      {vNotSent.map(s => {
                        const expired = s.latest_token && (s.latest_token.status === 'expired' || Date.parse(s.latest_token.expires_at) <= nowMs)
                        const disputed = s.latest_token?.status === 'disputed' || s.verification_status === 'shapi_assessed'
                        return (
                          <li key={s.seat_id} className="rounded-lg px-3 py-1.5 text-xs" style={{ background: 'var(--bg)' }}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span style={{ color: 'var(--text)' }} className="font-bold">
                                {s.person_name} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>· {s.seat_title}</span>
                              </span>
                              <span style={{ color: disputed ? 'var(--warn)' : 'var(--text-muted)' }}>
                                {disputed ? 'disputed — details contested, re-send to retry' : expired ? 'previous link expired' : 'never sent'}
                              </span>
                            </div>
                            {lastSend[s.seat_id] && sendStatusLines(lastSend[s.seat_id]).map((l, i) => (
                              <p key={i} className="text-[10px] mt-0.5" style={{ color: l.tone === 'ok' ? 'var(--verified)' : l.tone === 'warn' ? 'var(--warn)' : 'var(--text-muted)' }}>{l.text}</p>
                            ))}
                            {lastSend[s.seat_id]?.link && (
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  onClick={() => copyLink(s.seat_id, lastSend[s.seat_id].link)}
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={copiedSeatId === s.seat_id
                                    ? { background: 'color-mix(in srgb, var(--verified) 15%, transparent)', color: 'var(--verified)', border: '1px solid var(--verified)' }
                                    : { background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)' }}
                                >
                                  {copiedSeatId === s.seat_id ? '✓ Copied' : 'Copy link'}
                                </button>
                                <span className="text-[10px] break-all" style={{ color: 'color-mix(in srgb, var(--text) 35%, transparent)' }}>{lastSend[s.seat_id].link}</span>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Calibration legend ──────────────────────────────────────────── */}
      {calibration && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 p-3 rounded-xl"
          style={{ background: 'var(--bg)', border: '1px solid color-mix(in srgb, var(--warn) 25%, transparent)' }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--warn)' }}>
            Calibration Lens
          </span>
          {CAL_LEGEND.map(item => (
            <span key={item.bucket} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ background: CAL_VAR[item.bucket], boxShadow: `0 0 6px -1px ${CAL_VAR[item.bucket]}` }}
              />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
            </span>
          ))}
          <span className="text-[10px]" style={{ color: 'color-mix(in srgb, var(--text) 35%, transparent)' }}>
            Uncoloured = insufficient data. Verified seats keep a {`3px`} left bar.
          </span>
        </div>
      )}

      {/* ── Suggestion bar (advisory only — kept) ───────────────────────── */}
      {suggestions.length > 0 && (
        <div
          className="mb-3 rounded-xl p-3"
          style={{ background: 'color-mix(in srgb, var(--accent) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}
        >
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
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
              style={{ color: 'var(--text-muted)' }}
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
                    background: isPreviewing ? 'color-mix(in srgb, var(--warn) 10%, transparent)' : 'var(--bg)',
                    border: `1px solid ${isPreviewing ? 'var(--warn)' : 'color-mix(in srgb, var(--text) 6%, transparent)'}`,
                  }}
                >
                  <p className="text-xs leading-snug" style={{ color: 'color-mix(in srgb, var(--text) 80%, transparent)' }}>{s.text}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setPreviewSuggestionId(prev => (prev === s.id ? null : s.id))}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={isPreviewing
                        ? { background: 'color-mix(in srgb, var(--warn) 18%, transparent)', color: 'var(--warn)', border: '1px solid var(--warn)' }
                        : { background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)' }}
                    >
                      {isPreviewing ? 'Hide preview' : 'Preview'}
                    </button>
                    <button
                      onClick={() => {
                        setDismissedSuggestions(prev => new Set(prev).add(s.id))
                        setPreviewSuggestionId(prev => (prev === s.id ? null : prev))
                      }}
                      className="text-[10px] font-bold"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          {previewSuggestionId && (
            <p className="text-[10px] mt-2" style={{ color: 'var(--warn)' }}>
              Previewing highlights the affected branches on the map. To act, drag a seat — you&rsquo;ll still be asked to justify the move.
            </p>
          )}
        </div>
      )}

      {/* ── Compare stats (headcount · open seats · detected skills) ─────── */}
      {compare && compareA && compareB && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[compareA, compareB].map(locId => {
            const loc = locById[locId]
            if (!loc) return <div key={locId} />
            const st = locStats(locId)
            return (
              <div key={locId} className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid color-mix(in srgb, var(--accent2) 25%, transparent)' }}>
                <p className="text-xs font-black" style={{ color: 'var(--text)' }}>
                  {countryFlag(loc.country)} {loc.name}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--verified)', fontWeight: 700 }}>{st.headcount}</span> headcount ·{' '}
                  <span style={{ color: 'var(--warn)', fontWeight: 700 }}>{st.open}</span> open seat{st.open === 1 ? '' : 's'}
                </p>
                {st.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {st.skills.map(sk => (
                      <span key={sk} className="spine-chip" style={{ background: 'color-mix(in srgb, var(--accent2) 13%, transparent)', color: 'var(--accent2)' }}>
                        {sk}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {busy && <p className="text-xs mb-2" style={{ color: 'var(--accent)' }}>Saving move…</p>}

      {/* ── Touch move-mode banner ──────────────────────────────────────── */}
      {moveModeSeat && (
        <div
          className="mb-2 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2"
          style={{ background: 'color-mix(in srgb, var(--accent2) 12%, transparent)', color: 'var(--accent2)', border: '1px solid var(--accent2)' }}
        >
          <span>Moving &ldquo;{moveModeSeat.title}&rdquo; — tap a destination team card.</span>
          <button onClick={() => setMoveModeSeatId(null)} className="font-black">Cancel ✕</button>
        </div>
      )}

      {/* ══ THE MAP ═══════════════════════════════════════════════════════ */}
      <div
        ref={vpRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative rounded-xl overflow-hidden"
        style={{
          height: 'min(68vh, 640px)',
          minHeight: 420,
          background: 'var(--bg)',
          backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 7%, transparent) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          border: '1px solid color-mix(in srgb, var(--text) 6%, transparent)',
          cursor: gestureRef.current?.mode === 'pan' ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        {/* World — pannable / zoomable plane holding edges + nodes. */}
        <div
          style={{
            position: 'absolute',
            transformOrigin: '0 0',
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            width: graph.width,
            height: graph.height,
          }}
        >
          {/* Reporting lines (smooth bezier curves, re-routed live on drag). */}
          <svg
            width={graph.width + 200}
            height={graph.height + 200}
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}
          >
            {/* Compare divider(s). */}
            {graph.dividers.map((dx, i) => (
              <line
                key={`div-${i}`}
                x1={dx} y1={-40} x2={dx} y2={graph.height + 60}
                stroke="color-mix(in srgb, var(--accent2) 30%, transparent)"
                strokeWidth={1.5}
                strokeDasharray="6 8"
              />
            ))}
            {graph.nodes.map(n => {
              const parent = effectiveParent(n)
              if (!parent) return null
              const pPos = renderPos(parent)
              const cPos = renderPos(n)
              const x1 = pPos.x + parent.w / 2
              const y1 = pPos.y + parent.h
              const x2 = cPos.x + n.w / 2
              const y2 = cPos.y
              const midY = (y1 + y2) / 2
              const hot = n.id === draggingNodeId || parent.id === draggingNodeId ||
                n.id === stagedNodeId || parent.id === stagedNodeId
              return (
                <path
                  key={`e-${n.id}`}
                  className={`spine-edge${hot ? ' hot' : ''}`}
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                />
              )
            })}
          </svg>

          {/* Nodes. */}
          {graph.nodes.map(n => {
            const pos = renderPos(n)
            const isDragging = n.id === draggingNodeId
            const isDropHot = dropCandidate?.nodeId === n.id ||
              (dropCandidate?.managerSeatId ? `seat:${dropCandidate.managerSeatId}` === n.id : false) ||
              (dropCandidate && !dropCandidate.managerSeatId && graph.anchorByTeam[dropCandidate.teamId] === n.id)
            const isSuggested = !!n.teamId && highlightedTeamIds.has(n.teamId)
            const isMoveSource = !!n.seat && n.seat.id === moveModeSeatId
            const isStagedSeat = n.id === stagedNodeId

            if (n.kind === 'location') {
              const loc = locById[n.locationId]
              const tIds = new Set(teams.filter(t => t.location_id === n.locationId).map(t => t.id))
              const headcount = seats.filter(s => tIds.has(s.team_id) && s.person_id).length
              return (
                <div
                  key={n.id}
                  data-node-id={n.id}
                  className="spine-node loc"
                  style={{ left: pos.x, top: pos.y, width: n.w, minHeight: n.h }}
                  title={`${loc?.name || ''} — tap to focus this location`}
                >
                  <p className="text-[13px] font-black leading-tight" style={{ color: 'var(--text)' }}>
                    {countryFlag(loc?.country || '')} {loc?.name || '—'}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {headcount} {headcount === 1 ? 'person' : 'people'}
                  </p>
                </div>
              )
            }

            if (n.kind === 'team') {
              const team = n.teamId ? teamById[n.teamId] : null
              return (
                <div
                  key={n.id}
                  data-node-id={n.id}
                  className={`spine-node team-ph${isDropHot ? ' drop-hot' : ''}${isSuggested ? ' suggest-hot' : ''}`}
                  style={{ left: pos.x, top: pos.y, width: n.w, minHeight: n.h }}
                  title={`${team?.name || 'Team'} — no seats here in this view. Drop a seat card to move someone in.`}
                >
                  <p className="text-xs font-black leading-tight" style={{ color: 'var(--text)' }}>{team?.name || '—'}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {team?.function ? `${FUNCTION_LABEL[team.function] || team.function} · ` : ''}no seats yet
                  </p>
                </div>
              )
            }

            /* seat node */
            const seat = n.seat as Seat
            const person = seat.person_id ? personById[seat.person_id] : null
            const personName = person ? (person.preferred_name || person.full_name) : null
            const team = n.teamId ? teamById[n.teamId] : null
            const vStatus = verificationEnabled && seat.person_id
              ? (seat.verification_status || 'self_reported')
              : null
            const bucket = calibration ? calibrationBucket(seat) : 'neutral'
            const calClass = bucket !== 'neutral' ? ` cal-${bucket}` : ''
            // Planned/vacant = a "target" role you're hiring for. Highlight it
            // (unless calibration owns the body colour).
            const isOpenRole = seat.status === 'planned' || seat.status === 'vacant'
            const plannedClass = !calClass && isOpenRole ? ' seat-planned' : ''
            // Calibration colour wins the card body; verification falls back to
            // the 3px left edge bar (rendered below) when calibrated.
            const vClass = !calClass && vStatus === 'verified' ? ' v-verified'
              : !calClass && vStatus === 'shapi_assessed' ? ' v-assessed'
              : ''
            return (
              <div
                key={n.id}
                data-node-id={n.id}
                className={`spine-node${vClass}${calClass}${plannedClass}${isDragging ? ' dragging' : ''}${isDropHot ? ' drop-hot' : ''}${isSuggested ? ' suggest-hot' : ''}${isMoveSource || isStagedSeat ? ' move-source' : ''}`}
                style={{ left: pos.x, top: pos.y, width: n.w, minHeight: n.h, ...(isDragging ? { transition: 'none' } : null) }}
                title={`${seat.title}${team ? ` · ${team.name}` : ''}\nClick for details · drag onto another branch to reassign${vStatus ? `\n${VERIFY_LABEL[vStatus]}` : ''}`}
              >
                {/* Verified keeps a 3px left bar even when calibration wins the body. */}
                {calClass && vStatus === 'verified' && (
                  <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, background: 'var(--verified)' }} />
                )}
                <p className="spine-title text-xs font-extrabold leading-tight" style={{ color: 'var(--text)' }}>{seat.title}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_VAR[seat.status] || 'var(--text-muted)' }} />
                  <p className="text-[10.5px] truncate" style={{ color: 'color-mix(in srgb, var(--text) 55%, transparent)' }}>
                    {personName || '— vacant —'}
                  </p>
                </div>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {isOpenRole && (
                    <span className="spine-chip" style={{ background: 'color-mix(in srgb, var(--accent) 18%, transparent)', color: 'var(--accent)' }}>
                      {seat.status === 'planned' ? '✦ Hiring' : '○ Open'}
                    </span>
                  )}
                  {team && (
                    <span className="spine-chip" style={{ background: 'color-mix(in srgb, var(--accent2) 13%, transparent)', color: 'var(--accent2)' }}>
                      {team.name}
                    </span>
                  )}
                  {vStatus && (
                    <span
                      className="spine-chip"
                      style={vStatus === 'verified'
                        ? { background: 'color-mix(in srgb, var(--verified) 15%, transparent)', color: 'var(--verified)' }
                        : vStatus === 'shapi_assessed'
                          ? { background: 'color-mix(in srgb, var(--warn) 13%, transparent)', color: 'var(--warn)' }
                          : { background: 'color-mix(in srgb, var(--text) 6%, transparent)', color: 'color-mix(in srgb, var(--text) 35%, transparent)' }}
                    >
                      {vStatus === 'verified' ? '✓ Verified' : vStatus === 'shapi_assessed' ? 'Assessed' : 'Self-reported'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Zoom controls. */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          {[
            { label: '+', fn: () => setView(v => ({ ...v, scale: clamp(v.scale * 1.2, 0.3, 2) })) },
            { label: '−', fn: () => setView(v => ({ ...v, scale: clamp(v.scale / 1.2, 0.3, 2) })) },
            { label: '⤢', fn: fitView },
          ].map(b => (
            <button
              key={b.label}
              onClick={b.fn}
              className="w-8 h-8 rounded-lg text-sm font-black"
              style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
              title={b.label === '⤢' ? 'Fit to view' : b.label === '+' ? 'Zoom in' : 'Zoom out'}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Hint bar. */}
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] px-3 py-1 rounded-full whitespace-nowrap pointer-events-none"
          style={{ background: 'color-mix(in srgb, var(--surface) 85%, transparent)', color: 'var(--text-muted)', border: '1px solid color-mix(in srgb, var(--text) 6%, transparent)' }}
        >
          <span className="hidden sm:inline">drag a card onto another branch · scroll to zoom · drag background to pan</span>
          <span className="sm:hidden">tap a card for details · pinch to zoom · drag to pan</span>
        </div>

        {/* Per-tab empty state. */}
        {graph.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-center px-6" style={{ color: 'var(--text-muted)' }}>
              {renderedLocations.length === 0
                ? 'Pick a location to compare.'
                : 'No teams or seats here yet — add them below or upload a CSV.'}
            </p>
          </div>
        )}

        {/* ── Draft mode footer (write-free sandbox) ──────────────────────── */}
        {draftMode && (
          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 w-[540px] max-w-[94%] rounded-2xl p-4"
            style={{
              background: `linear-gradient(var(--surface), var(--surface)) padding-box, linear-gradient(135deg, var(--accent), var(--accent2)) border-box`,
              border: '1.5px solid transparent',
              boxShadow: '0 24px 70px rgba(0,0,0,0.7)',
            }}
            onPointerDown={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                ✎ Draft restructure · {draftMoves.length} change{draftMoves.length === 1 ? '' : 's'}
              </p>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Nothing is saved or logged until you implement</span>
            </div>

            {!draftImplementing && (
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <select
                  onChange={e => { const v = e.target.value; if (v) applyTemplate(v as 'current' | 'flat' | 'functional'); e.currentTarget.value = '' }}
                  defaultValue=""
                  className="text-xs font-bold px-2.5 py-1.5 rounded-lg outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', color: 'var(--text)' }}
                  title="Reshape the whole org into a template, then fine-tune by hand. Teams stay; reporting lines change."
                >
                  <option value="">✦ Apply a template…</option>
                  <option value="current">Current org (reset draft)</option>
                  <option value="flat">Flat — everyone under the top</option>
                  <option value="functional">Functional — function heads, then teams</option>
                  <option value="divisional" disabled>Divisional (multi-site) — coming</option>
                  <option value="matrix" disabled>Matrix / dotted lines — coming</option>
                  <option value="pod" disabled>Pods (cross-functional) — coming</option>
                </select>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>then drag to fine-tune</span>
              </div>
            )}

            {draftMoves.length === 0 ? (
              <p className="text-[12px] leading-relaxed" style={{ color: 'color-mix(in srgb, var(--text) 80%, transparent)' }}>
                Drag people around freely — onto a person to set who they report to, or onto a team to move them.
                No prompts, no audit writes. Implement when you&rsquo;re happy, or discard and walk away.
              </p>
            ) : (
              <ul className="space-y-1 mb-1 max-h-[150px] overflow-y-auto pr-1">
                {draftMoves.map(m => (
                  <li key={m.seatId} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: 'var(--bg)' }}>
                    <span style={{ color: 'var(--text)' }}>
                      <strong>{m.personName || m.seatTitle}</strong>{' '}
                      {m.changeKind === 'reports_to'
                        ? <>now reports to <strong style={{ color: 'var(--accent)' }}>{m.managerName}</strong></>
                        : <>→ <strong style={{ color: 'var(--accent)' }}>{m.toTeamName}</strong> <span style={{ color: 'var(--text-muted)' }}>(was {m.fromTeamName})</span></>}
                    </span>
                    <button onClick={() => removeDraftMove(m.seatId)} className="text-[10px] font-bold flex-shrink-0" style={{ color: 'var(--text-muted)' }} title="Drop this change">✕</button>
                  </li>
                ))}
              </ul>
            )}

            {draftError && (
              <p className="text-[11px] mt-2 px-3 py-2 rounded-lg" style={{ color: 'var(--punch)', background: 'color-mix(in srgb, var(--punch) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--punch) 25%, transparent)' }}>
                {draftError}
              </p>
            )}

            {draftImplementing ? (
              <div className="mt-2">
                <textarea
                  value={draftJustification}
                  onChange={e => setDraftJustification(e.target.value)}
                  rows={2}
                  placeholder="Why this restructure? Logged immutably to your decisions audit trail (min 20 chars)."
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none"
                  style={{ background: 'var(--bg)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', color: 'var(--text)' }}
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={implementDraft} disabled={busy} className="text-xs font-black px-4 py-2 rounded-full disabled:opacity-40" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'var(--bg)' }}>
                    {busy ? 'Implementing…' : `Implement ${draftMoves.length} change${draftMoves.length === 1 ? '' : 's'}`}
                  </button>
                  <button onClick={() => { setDraftImplementing(false); setDraftError(null) }} disabled={busy} className="text-xs font-bold px-4 py-2 rounded-full" style={{ background: 'color-mix(in srgb, var(--text) 8%, transparent)', color: 'color-mix(in srgb, var(--text) 80%, transparent)' }}>
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { if (draftMoves.length === 0) { setDraftError('Make at least one change first.'); return } setDraftError(null); setDraftImplementing(true) }}
                  className="text-xs font-bold px-4 py-2 rounded-full"
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'var(--bg)', border: 'none', opacity: draftMoves.length === 0 ? 0.5 : 1 }}
                >
                  Implement as live org →
                </button>
                <button onClick={discardDraft} className="text-xs font-bold px-4 py-2 rounded-full" style={{ background: 'color-mix(in srgb, var(--text) 8%, transparent)', color: 'color-mix(in srgb, var(--text) 80%, transparent)', border: 'none' }}>
                  {draftMoves.length > 0 ? 'Discard all' : 'Exit draft'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Staged-move banner (structure-change detection) ─────────────── */}
        {staged && !pendingMove && !draftMode && (
          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 w-[460px] max-w-[92%] rounded-2xl p-4"
            style={{
              background: `linear-gradient(var(--surface), var(--surface)) padding-box, linear-gradient(135deg, var(--warn), var(--punch)) border-box`,
              border: '1.5px solid transparent',
              boxShadow: '0 24px 70px rgba(0,0,0,0.7)',
            }}
            // The banner lives INSIDE the pannable map, which captures pointer
            // events on pointerdown. Without this stop, pressing Confirm/Undo
            // started a pan gesture and the click never registered — the
            // founder-reported "audit trail + Undo buttons don't work" bug.
            onPointerDown={e => e.stopPropagation()}
          >
            <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--warn)' }}>
              {shapeChanged ? '⚠ Structure change detected' : 'Confirm move'}
            </p>
            <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: 'color-mix(in srgb, var(--text) 85%, transparent)' }}>
              <strong style={{ color: 'var(--accent)' }}>
                {staged.seat.person_id ? (personById[staged.seat.person_id]?.preferred_name || personById[staged.seat.person_id]?.full_name || staged.seat.title) : staged.seat.title}
              </strong>{' '}
              {staged.changeKind === 'reports_to' ? (
                <>now reports to <strong style={{ color: 'var(--accent)' }}>{staged.managerName}</strong>.</>
              ) : (
                <>
                  moves to <strong style={{ color: 'var(--accent)' }}>{staged.toTeam.name}</strong> (was {staged.fromTeam.name})
                  {staged.crossLocation && (
                    <> — a relocation to <strong style={{ color: 'var(--accent2)' }}>{locById[staged.toTeam.location_id]?.name || 'another location'}</strong></>
                  )}.
                </>
              )}
              {shapeChanged && (
                <><br />This shifts your org from <strong style={{ color: 'var(--warn)' }}>{staged.shapeBefore}</strong> toward{' '}
                <strong style={{ color: 'var(--warn)' }}>{staged.shapeAfter}</strong> — confirm?</>
              )}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setPendingMove({
                  seatId: staged.seat.id,
                  seatTitle: staged.seat.title,
                  personId: staged.seat.person_id,
                  fromTeamId: staged.fromTeam.id,
                  fromTeamName: staged.fromTeam.name,
                  toTeamId: staged.toTeam.id,
                  toTeamName: staged.toTeam.name,
                  changeKind: staged.changeKind,
                  fromReportsTo: staged.seat.reports_to ?? null,
                  toManagerSeatId: staged.toManagerSeatId,
                  managerName: staged.managerName,
                })}
                className="text-xs font-bold px-4 py-2 rounded-full"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'var(--bg)', border: 'none' }}
                title="Applies this change to your live org and logs the reason. Dragging without confirming saves nothing."
              >
                Confirm move
              </button>
              <button
                onClick={() => setStaged(null)}
                className="text-xs font-bold px-4 py-2 rounded-full"
                style={{ background: 'color-mix(in srgb, var(--text) 8%, transparent)', color: 'color-mix(in srgb, var(--text) 80%, transparent)', border: 'none' }}
              >
                Discard
              </button>
            </div>
            <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
              Discarding saves nothing. Just exploring?{' '}
              <button onClick={() => { setStaged(null); setDraftMode(true) }} className="font-bold underline" style={{ color: 'var(--accent)' }}>
                Switch to Draft mode
              </button>{' '}
              to rearrange freely with no prompts.
            </p>
          </div>
        )}

        {/* ── Post-commit Undo toast ──────────────────────────────────────── */}
        {lastMove && !staged && !pendingMove && (
          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-full pl-4 pr-2 py-2"
            style={{
              background: 'color-mix(in srgb, var(--surface) 96%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
              boxShadow: '0 16px 50px rgba(0,0,0,0.6)',
            }}
            onPointerDown={e => e.stopPropagation()}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Moved <strong style={{ color: 'var(--text)' }}>{lastMove.personName || lastMove.seatTitle}</strong> to{' '}
              <strong style={{ color: 'var(--accent)' }}>{lastMove.toTeamName}</strong> · logged
            </span>
            <button
              onClick={undoLastMove}
              disabled={busy}
              className="text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-40"
              style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)' }}
            >
              {busy ? 'Undoing…' : '↶ Undo'}
            </button>
            <button
              onClick={() => { setLastMove(null); if (undoTimerRef.current) clearTimeout(undoTimerRef.current) }}
              className="text-xs font-bold w-6 h-6 rounded-full"
              style={{ color: 'var(--text-muted)' }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Slide-over: person / seat detail (the hub) ──────────────────── */}
        {selectedSeat && (() => {
          const person = selectedSeat.person_id ? personById[selectedSeat.person_id] : null
          const team = teamById[selectedSeat.team_id]
          const loc = team ? locById[team.location_id] : null
          const vStatus = verificationEnabled && selectedSeat.person_id
            ? (selectedSeat.verification_status || 'self_reported')
            : null
          const hasSkills = (selectedSeat.primary_activities || []).length > 0
          const seatBucket = calibrationBucket(selectedSeat)
          return (
            <div
              className="absolute top-0 right-0 bottom-0 z-30 w-[300px] max-w-[85%] p-4 overflow-y-auto"
              style={{
                background: 'color-mix(in srgb, var(--surface) 97%, transparent)',
                borderLeft: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
                boxShadow: '-18px 0 50px rgba(0,0,0,0.5)',
              }}
              onPointerDown={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                    {person ? 'Person' : 'Open seat'}
                  </p>
                  <h3 className="text-base font-black leading-tight mt-0.5" style={{ color: 'var(--text)' }}>
                    {person ? (person.preferred_name || person.full_name) : '— vacant —'}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{selectedSeat.title}</p>
                </div>
                <button onClick={() => setSelectedSeatId(null)} className="text-xs font-black" style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>

              <div className="mt-3 space-y-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <p>Team — <span style={{ color: 'var(--text)', fontWeight: 700 }}>{team?.name || '—'}</span></p>
                <p>Location — <span style={{ color: 'var(--text)', fontWeight: 700 }}>{loc ? `${countryFlag(loc.country)} ${loc.name}` : '—'}</span></p>
                <p>Seat status — <span style={{ color: STATUS_VAR[selectedSeat.status] || 'var(--text)', fontWeight: 700, textTransform: 'capitalize' }}>{selectedSeat.status}</span>{selectedSeat.seniority ? ` · ${selectedSeat.seniority}` : ''}</p>
                {vStatus && (
                  <p>
                    Verification —{' '}
                    <span style={{
                      fontWeight: 700,
                      color: vStatus === 'verified' ? 'var(--verified)' : vStatus === 'shapi_assessed' ? 'var(--warn)' : 'var(--text-muted)',
                    }}>
                      {vStatus === 'verified'
                        ? `✓ Verified${selectedSeat.verified_at ? ` ${fmtDate(selectedSeat.verified_at)}` : ''}${selectedSeat.verified_via ? ` via ${selectedSeat.verified_via}` : ''}`
                        : vStatus === 'shapi_assessed' ? 'Shapi-assessed — details contested' : 'Self-reported'}
                    </span>
                  </p>
                )}
                {hasSkills && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(selectedSeat.primary_activities || []).slice(0, 6).map(sk => (
                      <span key={sk} className="spine-chip" style={{ background: 'color-mix(in srgb, var(--accent2) 13%, transparent)', color: 'var(--accent2)' }}>{sk}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Calibration read-out — explains the crimson/gold flag in plain
                  language and points to the next action (the founder asked what
                  "High AI-exposure, no timeline" means + what to do about it). */}
              {seatBucket === 'crimson' && (
                <div className="mt-3 rounded-xl p-3" style={{ background: 'color-mix(in srgb, var(--punch) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--punch) 30%, transparent)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--punch)' }}>
                    ⚠ High AI-exposure · no transition plan
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    This role is highly automatable {typeof selectedSeat.ai_exposure_score === 'number' ? `(${selectedSeat.ai_exposure_score}% exposure)` : ''} and there&rsquo;s no active reskill or redeployment plan for the person in it. Act early: start a reskill/redeploy playbook, or AI-proof the role so the person grows into higher-value work.
                  </p>
                </div>
              )}
              {seatBucket === 'gold' && (
                <div className="mt-3 rounded-xl p-3" style={{ background: 'color-mix(in srgb, var(--warn) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--warn)' }}>
                    ★ Top performer · overloaded
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Strong output but absorbing more than full capacity — a retention risk. Redistribute load before they burn out.
                  </p>
                </div>
              )}

              {/* The hub — everything connects from here. */}
              <div className="mt-4 space-y-1.5">
                {seatBucket === 'crimson' && person && (
                  <Link
                    href={`/company/people/${person.id}/lifecycle`}
                    className="block text-xs font-bold px-3 py-2 rounded-lg"
                    style={{ background: 'color-mix(in srgb, var(--punch) 12%, transparent)', color: 'var(--punch)', border: '1px solid color-mix(in srgb, var(--punch) 35%, transparent)' }}
                  >
                    Start a reskill / redeploy plan →
                  </Link>
                )}
                {seatBucket === 'crimson' && (
                  <Link
                    href="/role/ai-proof"
                    className="block text-xs font-bold px-3 py-2 rounded-lg"
                    style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)' }}
                  >
                    AI-proof this role →
                  </Link>
                )}
                {person && (
                  <>
                    <Link
                      href={`/company/people/${person.id}`}
                      className="block text-xs font-bold px-3 py-2 rounded-lg"
                      style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)' }}
                    >
                      Open in HR portal →
                    </Link>
                    <Link
                      href={`/company/people/${person.id}/lifecycle`}
                      className="block text-xs font-bold px-3 py-2 rounded-lg"
                      style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)' }}
                    >
                      Lifecycle timeline →
                    </Link>
                  </>
                )}
                {hasSkills && (
                  <Link
                    href="/company/skill-density"
                    className="block text-xs font-bold px-3 py-2 rounded-lg"
                    style={{ background: 'color-mix(in srgb, var(--accent2) 12%, transparent)', color: 'var(--accent2)', border: '1px solid color-mix(in srgb, var(--accent2) 35%, transparent)' }}
                  >
                    See these skills in Skill Density →
                  </Link>
                )}
                <button
                  onClick={() => { setMoveModeSeatId(selectedSeat.id); setSelectedSeatId(null) }}
                  disabled={!!staged || busy}
                  className="block w-full text-left text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-40"
                  style={{ background: 'color-mix(in srgb, var(--warn) 10%, transparent)', color: 'var(--warn)', border: '1px solid color-mix(in srgb, var(--warn) 35%, transparent)' }}
                >
                  ⇄ Move to another team (then tap the destination)
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
        Drag any seat card onto another branch to reassign — Shapi detects whether the move changes your
        org&rsquo;s structure, and every reassignment is justified and logged immutably in your decisions audit trail.
      </p>

      {/* Justification gate — the EXISTING audit flow. */}
      {pendingMove && (
        <ReassignModal
          ctx={pendingMove}
          defaultDecisionType={staged?.crossLocation ? 'location_change' : 'restructure'}
          onCancel={() => { if (!busy) setPendingMove(null) }}
          onConfirm={args => commitMove(pendingMove, args)}
        />
      )}
    </div>
  )
}
