import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/company/spine/decision
//
// Insert an immutable row into organizational_decisions. The
// blueprint_v4_06_decisions.sql schema enforces:
//   - decision_type IN (hire, separate, restructure, redeploy, promote,
//     demote, reskill_assign, augment_assign, comp_change, team_split,
//     team_merge, location_change)
//   - justification text NOT NULL with min length 20
//   - decided_by_user_id NOT NULL (we set to auth.uid())
//   - state_snapshot jsonb captures before/after
//
// Used by:
//   - Visual canvas drag-drop reassignment (auto-justification fallback)
//   - HRBP PIP / Separation playbooks (Phase D)
//   - Manual decision capture from spine edits (future)
//
// No UPDATE/DELETE — IMMUTABLE per schema policy.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', user.id)
    .single()
  if (!profile || profile.type !== 'company') {
    return NextResponse.json({ error: 'Company account required' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const {
    decision_type,
    justification,
    impacted_seat_id,
    impacted_person_id,
    impacted_team_id,
    state_snapshot,
  } = body

  if (!decision_type) return NextResponse.json({ error: 'decision_type required' }, { status: 400 })
  if (!justification || String(justification).trim().length < 20) {
    return NextResponse.json({
      error: 'justification_too_short',
      message: 'Justification must be at least 20 characters — the audit log needs context.',
    }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('organizational_decisions')
    .insert({
      company_id: user.id,
      decision_type,
      justification: String(justification).trim(),
      decided_by_user_id: user.id,
      impacted_seat_id: impacted_seat_id || null,
      impacted_person_id: impacted_person_id || null,
      impacted_team_id: impacted_team_id || null,
      state_snapshot: state_snapshot || {},
    })
    .select()
    .single()

  if (error) {
    console.error('[spine/decision] insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ decision: data })
}
