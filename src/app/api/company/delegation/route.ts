import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ============================================================================
// Workload Delegation engine — HR-OS feature.
//
// A workload_delegation transfers a % of one seat's activity to a covering
// seat (during overload, leave, or separation). Delegations feed the
// receiving seat's absorbed_capacity_pct.
//
// ABSORBED-CAPACITY STRATEGY: computed on READ, not stored via this endpoint.
//   - The delegation endpoint never writes to roles_seats. This keeps the
//     exclusive scope clean and avoids drift between the delegation rows and a
//     denormalized counter.
//   - roles_seats.absorbed_capacity_pct (0-250, CHECK-constrained) is treated
//     as the seat's BASELINE own-workload (100 = a normally-loaded occupied
//     seat). Delegations ADD on top of that baseline at read time.
//   - effective_capacity(seat) = baseline + Σ(percentage of active delegations
//     INTO that seat). > 100 => overload => retention risk (Calibration Lens).
//   - "Active" = no end_date, or end_date >= today.
// The GET handler returns this computed view so the page and the Calibration
// Lens read a single source of truth without a write side-effect here.
// ============================================================================

async function requireCompany() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', user.id)
    .single()
  if (!profile || profile.type !== 'company') {
    return { error: NextResponse.json({ error: 'Company account required' }, { status: 403 }) }
  }
  return { supabase, user }
}

type DelegationRow = {
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

function isActive(d: { end_date: string | null }, today: string): boolean {
  return !d.end_date || d.end_date >= today
}

// Compute effective absorbed capacity per seat from baseline + active inbound
// delegation percentages. Returns a map seat_id -> { baseline, delegated,
// effective, overloaded }.
function computeCapacity(
  seats: { id: string; absorbed_capacity_pct: number | null; person_id: string | null; status: string }[],
  delegations: DelegationRow[],
  today: string,
) {
  const inbound = new Map<string, number>()
  for (const d of delegations) {
    if (!isActive(d, today)) continue
    inbound.set(d.to_seat_id, (inbound.get(d.to_seat_id) || 0) + d.percentage)
  }
  const out: Record<string, { baseline: number; delegated: number; effective: number; overloaded: boolean }> = {}
  for (const s of seats) {
    // Baseline: stored value if present; else 100 for an occupied/active seat,
    // 0 for vacant/planned/frozen (no own workload to begin with).
    const occupied = !!s.person_id && (s.status === 'active' || s.status === 'separating')
    const baseline = s.absorbed_capacity_pct ?? (occupied ? 100 : 0)
    const delegated = inbound.get(s.id) || 0
    const effective = baseline + delegated
    out[s.id] = { baseline, delegated, effective, overloaded: effective > 100 }
  }
  return out
}

// ---------------------------------------------------------------------------
// GET — list delegations + computed capacity view for the company.
// ---------------------------------------------------------------------------
export async function GET() {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx

  const today = new Date().toISOString().slice(0, 10)

  const [delResult, seatResult] = await Promise.all([
    supabase
      .from('workload_delegations')
      .select('*')
      .eq('company_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('roles_seats')
      .select('id, title, person_id, status, absorbed_capacity_pct, team_id')
      .eq('company_id', user.id),
  ])

  if (delResult.error) return NextResponse.json({ error: delResult.error.message }, { status: 500 })
  if (seatResult.error) return NextResponse.json({ error: seatResult.error.message }, { status: 500 })

  const delegations = (delResult.data || []) as DelegationRow[]
  const seats = seatResult.data || []
  const capacity = computeCapacity(seats, delegations, today)

  return NextResponse.json({ delegations, seats, capacity, today })
}

// ---------------------------------------------------------------------------
// POST — create a delegation from one seat to a covering seat.
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx
  const body = await request.json()
  const {
    from_seat_id, to_seat_id, activity_id,
    percentage, reason, start_date, end_date,
  } = body

  if (!from_seat_id || !to_seat_id) {
    return NextResponse.json({ error: 'from_seat_id + to_seat_id required' }, { status: 400 })
  }
  if (from_seat_id === to_seat_id) {
    return NextResponse.json({ error: 'A seat cannot delegate to itself' }, { status: 400 })
  }
  const pct = Number(percentage)
  if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
    return NextResponse.json({ error: 'percentage must be 1–100' }, { status: 400 })
  }
  if (!start_date) {
    return NextResponse.json({ error: 'start_date required' }, { status: 400 })
  }

  // Verify both seats belong to this company (defence-in-depth on top of RLS,
  // and gives a clean 400 instead of an FK error).
  const { data: ownSeats, error: ownErr } = await supabase
    .from('roles_seats')
    .select('id')
    .eq('company_id', user.id)
    .in('id', [from_seat_id, to_seat_id])
  if (ownErr) return NextResponse.json({ error: ownErr.message }, { status: 500 })
  if (!ownSeats || ownSeats.length !== 2) {
    return NextResponse.json({ error: 'Both seats must belong to your org' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('workload_delegations')
    .insert({
      company_id: user.id, // stamped from auth.uid(), never trusted from client
      from_seat_id,
      to_seat_id,
      activity_id: activity_id || null,
      percentage: Math.round(pct),
      reason: reason || null,
      start_date,
      end_date: end_date || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ delegation: data })
}

// ---------------------------------------------------------------------------
// PATCH — update an existing delegation's percentage, dates, reason, status.
// "Status" here is expressed as end_date: setting end_date < today retires a
// delegation (it drops out of the active-capacity sum). We accept an explicit
// `end_now: true` convenience to close a delegation as of today.
// ---------------------------------------------------------------------------
export async function PATCH(request: Request) {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx
  const body = await request.json()
  const { id, end_now, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (rest.percentage !== undefined) {
    const pct = Number(rest.percentage)
    if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
      return NextResponse.json({ error: 'percentage must be 1–100' }, { status: 400 })
    }
    updates.percentage = Math.round(pct)
  }
  if (rest.reason !== undefined) updates.reason = rest.reason || null
  if (rest.start_date !== undefined) updates.start_date = rest.start_date
  if (rest.end_date !== undefined) updates.end_date = rest.end_date || null
  if (rest.quality_score !== undefined) updates.quality_score = rest.quality_score
  if (end_now) updates.end_date = new Date().toISOString().slice(0, 10)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields supplied' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('workload_delegations')
    .update(updates)
    .eq('id', id)
    .eq('company_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ delegation: data })
}
