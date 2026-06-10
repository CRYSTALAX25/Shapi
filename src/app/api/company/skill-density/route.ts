// ============================================================================
// /api/company/skill-density (GET) — HRBP KEYSTONE: the internal redeployment
// engine. Aggregates verified/detected skills across the workforce and matches
// them against OPEN vacancies so an HRBP redeploys instead of rehiring.
//
// "Don't hire 3 external data analysts — Riyadh Ops already has 2 verified
//  people doing admin who have the skills."
//
// SKILL PROVENANCE (two sources, both text[] arrays, both gin-indexed):
//   1. brain_entries.ai_detected_skills_gained
//        anchored to brain_entries.anchor_seat_id (Seat Inheritance Playbook)
//        — skills demonstrated in ingested knowledge (docs/emails/transcripts)
//   2. workload_delegations.ai_detected_skills_gained
//        attached to workload_delegations.to_seat_id (the covering seat)
//        — skills the to_seat demonstrated while covering delegated work
//
// SPINE JOIN (read-only, RLS applies — normal anon-key server client):
//   roles_seats (id, title, seniority, function, person_id, status, team_id)
//     → teams      (id, name, function, location_id)
//       → locations(id, name, city, country)
//     → persons    (id, full_name, preferred_name, status)
//
// A "holder" of a skill = a seat (+ its occupant person + its location/team).
// OPEN vacancies = roles_seats WHERE status IN ('planned','vacant').
//
// Gating: this endpoint is Enterprise-tier conceptually. We return the
// plan_tier so the page can show an upgrade teaser, but we STILL return the
// matrix for testing (per build brief). No service-role; RLS already scopes
// every read to company_id = auth.uid().
// ============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ---------- normalisation helpers ----------------------------------------

// Skills are free-text. Normalise for grouping (case/space-insensitive) but
// keep a display label (the most common original casing wins).
function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

type SkillProvenance = 'brain' | 'delegation'

type SeatRow = {
  id: string
  title: string | null
  seniority: string | null
  function: string | null
  status: string | null
  person_id: string | null
  team_id: string | null
}

type TeamRow = { id: string; name: string | null; function: string | null; location_id: string | null }
type LocationRow = { id: string; name: string | null; city: string | null; country: string | null }
type PersonRow = { id: string; full_name: string | null; preferred_name: string | null; status: string | null }

// A holder = one seat that has the skill, with denormalised context.
type Holder = {
  seat_id: string
  seat_title: string
  seniority: string | null
  function: string | null
  seat_status: string | null
  person_id: string | null
  person_name: string | null // null = vacant seat that nonetheless carries inherited brain skills
  team_id: string | null
  team_name: string | null
  location_id: string | null
  location_name: string | null
  sources: SkillProvenance[] // how we know this seat has the skill
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, plan_tier')
    .eq('id', user.id)
    .single()

  if (!profile || profile.type !== 'company') {
    return NextResponse.json({ error: 'Company profile required' }, { status: 403 })
  }

  const planTier = (profile as { plan_tier?: string | null }).plan_tier || 'free'

  // ---- Pull the spine + the two skill sources in parallel. RLS scopes all. --
  const [
    seatsResult,
    teamsResult,
    locationsResult,
    personsResult,
    brainResult,
    delegationsResult,
  ] = await Promise.all([
    supabase
      .from('roles_seats')
      .select('id, title, seniority, function, status, person_id, team_id')
      .eq('company_id', user.id),
    supabase
      .from('teams')
      .select('id, name, function, location_id')
      .eq('company_id', user.id),
    supabase
      .from('locations')
      .select('id, name, city, country')
      .eq('company_id', user.id),
    supabase
      .from('persons')
      .select('id, full_name, preferred_name, status')
      .eq('company_id', user.id),
    // Only entries that actually detected skills are useful here.
    supabase
      .from('brain_entries')
      .select('anchor_seat_id, ai_detected_skills_gained')
      .eq('company_id', user.id)
      .not('anchor_seat_id', 'is', null),
    supabase
      .from('workload_delegations')
      .select('to_seat_id, ai_detected_skills_gained')
      .eq('company_id', user.id),
  ])

  const firstErr =
    seatsResult.error ||
    teamsResult.error ||
    locationsResult.error ||
    personsResult.error ||
    brainResult.error ||
    delegationsResult.error
  if (firstErr) {
    console.error('[company/skill-density] read error:', firstErr.message)
    return NextResponse.json({ error: firstErr.message }, { status: 500 })
  }

  const seats = (seatsResult.data || []) as SeatRow[]
  const teams = (teamsResult.data || []) as TeamRow[]
  const locations = (locationsResult.data || []) as LocationRow[]
  const persons = (personsResult.data || []) as PersonRow[]

  const teamById = new Map(teams.map(t => [t.id, t]))
  const locationById = new Map(locations.map(l => [l.id, l]))
  const personById = new Map(persons.map(p => [p.id, p]))

  function locationLabel(loc: LocationRow | undefined): string | null {
    if (!loc) return null
    if (loc.name) return loc.name
    const cityCountry = [loc.city, loc.country].filter(Boolean).join(', ')
    return cityCountry || null
  }

  function buildContext(seat: SeatRow): Omit<Holder, 'sources'> {
    const team = seat.team_id ? teamById.get(seat.team_id) : undefined
    const loc = team?.location_id ? locationById.get(team.location_id) : undefined
    const person = seat.person_id ? personById.get(seat.person_id) : undefined
    const personName = person
      ? (person.preferred_name?.trim() || person.full_name || null)
      : null
    return {
      seat_id: seat.id,
      seat_title: seat.title || 'Untitled seat',
      seniority: seat.seniority,
      function: seat.function || team?.function || null,
      seat_status: seat.status,
      person_id: seat.person_id,
      person_name: personName,
      team_id: seat.team_id,
      team_name: team?.name || null,
      location_id: team?.location_id || null,
      location_name: locationLabel(loc),
    }
  }

  const seatById = new Map(seats.map(s => [s.id, s]))

  // ---- Build skill -> holders. Key on normalised skill; track best label. --
  type SkillAgg = {
    key: string
    label: string
    labelCounts: Map<string, number>
    // seat_id -> Holder (so a seat appears once per skill even if both sources
    // detect it; we merge provenance into sources[]).
    holders: Map<string, Holder>
  }
  const skillMap = new Map<string, SkillAgg>()

  function recordSkill(rawSkill: unknown, seatId: string | null, source: SkillProvenance) {
    if (typeof rawSkill !== 'string') return
    const label = rawSkill.trim()
    if (!label) return
    if (!seatId) return
    const seat = seatById.get(seatId)
    if (!seat) return // seat may have been deleted / out of RLS scope

    const key = normKey(label)
    let agg = skillMap.get(key)
    if (!agg) {
      agg = { key, label, labelCounts: new Map(), holders: new Map() }
      skillMap.set(key, agg)
    }
    agg.labelCounts.set(label, (agg.labelCounts.get(label) || 0) + 1)

    let holder = agg.holders.get(seatId)
    if (!holder) {
      holder = { ...buildContext(seat), sources: [] }
      agg.holders.set(seatId, holder)
    }
    if (!holder.sources.includes(source)) holder.sources.push(source)
  }

  for (const row of (brainResult.data || []) as Array<{ anchor_seat_id: string | null; ai_detected_skills_gained: unknown }>) {
    const arr = Array.isArray(row.ai_detected_skills_gained) ? row.ai_detected_skills_gained : []
    for (const s of arr) recordSkill(s, row.anchor_seat_id, 'brain')
  }
  for (const row of (delegationsResult.data || []) as Array<{ to_seat_id: string | null; ai_detected_skills_gained: unknown }>) {
    const arr = Array.isArray(row.ai_detected_skills_gained) ? row.ai_detected_skills_gained : []
    for (const s of arr) recordSkill(s, row.to_seat_id, 'delegation')
  }

  // Finalise each skill: pick most-common label, sort holders (occupied first).
  const skills = Array.from(skillMap.values())
    .map(agg => {
      let bestLabel = agg.label
      let bestCount = -1
      for (const [lbl, cnt] of agg.labelCounts) {
        if (cnt > bestCount) { bestLabel = lbl; bestCount = cnt }
      }
      const holders = Array.from(agg.holders.values()).sort((a, b) => {
        // Occupied seats before vacant; then by location, then person/title.
        if (!!a.person_name !== !!b.person_name) return a.person_name ? -1 : 1
        const locCmp = (a.location_name || '').localeCompare(b.location_name || '')
        if (locCmp !== 0) return locCmp
        return (a.person_name || a.seat_title).localeCompare(b.person_name || b.seat_title)
      })
      return {
        skill: bestLabel,
        skill_key: agg.key,
        holder_count: holders.length,
        holders,
      }
    })
    .sort((a, b) => b.holder_count - a.holder_count || a.skill.localeCompare(b.skill))

  // ---- OPEN vacancies (planned | vacant) with required function/seniority. --
  const vacancies = seats
    .filter(s => s.status === 'planned' || s.status === 'vacant')
    .map(s => {
      const ctx = buildContext(s)
      // Required-skill signal for the vacancy: the seat's function + title +
      // seniority. We surface matches by checking which workforce skills'
      // labels relate to this vacancy. The page does the overlap ranking
      // client-side using the skills[] holders, but we precompute a simple
      // function/title token set the UI can match against.
      const tokens = new Set<string>()
      const title = (s.title || '').toLowerCase()
      for (const word of title.split(/[^a-z0-9+]+/i)) {
        const w = word.trim()
        if (w.length >= 3) tokens.add(w)
      }
      if (s.function) tokens.add(s.function.toLowerCase())
      if (ctx.function) tokens.add(ctx.function.toLowerCase())
      return {
        seat_id: s.id,
        title: s.title || 'Untitled vacancy',
        status: s.status,
        seniority: s.seniority,
        function: ctx.function,
        team_id: ctx.team_id,
        team_name: ctx.team_name,
        location_id: ctx.location_id,
        location_name: ctx.location_name,
        match_tokens: Array.from(tokens),
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))

  // ---- Workforce roster (occupied internal people) for redeploy ranking. ---
  // One entry per occupied seat with its detected skill set, so the page can
  // rank internal redeploy candidates against any vacancy by overlap count.
  const rosterMap = new Map<string, {
    seat_id: string
    person_id: string | null
    person_name: string | null
    seat_title: string
    seniority: string | null
    function: string | null
    seat_status: string | null
    team_name: string | null
    location_name: string | null
    skills: string[]
    skill_keys: string[]
  }>()
  for (const sk of skills) {
    for (const h of sk.holders) {
      let entry = rosterMap.get(h.seat_id)
      if (!entry) {
        entry = {
          seat_id: h.seat_id,
          person_id: h.person_id,
          person_name: h.person_name,
          seat_title: h.seat_title,
          seniority: h.seniority,
          function: h.function,
          seat_status: h.seat_status,
          team_name: h.team_name,
          location_name: h.location_name,
          skills: [],
          skill_keys: [],
        }
        rosterMap.set(h.seat_id, entry)
      }
      entry.skills.push(sk.skill)
      entry.skill_keys.push(sk.skill_key)
    }
  }
  const roster = Array.from(rosterMap.values())

  const totals = {
    skill_count: skills.length,
    holder_seats: roster.length,
    open_vacancies: vacancies.length,
    skill_signal_rows:
      (brainResult.data || []).length + (delegationsResult.data || []).length,
  }

  return NextResponse.json({
    success: true,
    plan_tier: planTier,
    is_enterprise: planTier === 'enterprise',
    company_name: (profile as { company_name?: string | null }).company_name || null,
    skills,
    vacancies,
    roster,
    totals,
  })
}
