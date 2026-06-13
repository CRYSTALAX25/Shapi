import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { normalizeOkrs, overallCompletion, type OkrObjective } from '@/lib/okrTemplates'

// PATCH /api/company/okr — save a seat's objectives & key results.
// Body: { seat_id: string, okrs: OkrObjective[] }
// Writes roles_seats.current_okrs and recomputes okr_completion_pct so the
// Calibration Lens stays in sync. Company-scoped + auth'd (RLS also enforced).

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

export async function PATCH(request: Request) {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx

  let body: { seat_id?: string; okrs?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const seatId = body.seat_id
  if (!seatId) return NextResponse.json({ error: 'seat_id required' }, { status: 400 })

  // Normalize + clamp everything server-side — never trust client progress.
  const okrs: OkrObjective[] = normalizeOkrs(body.okrs)
  const completion = overallCompletion(okrs)

  const { data, error } = await supabase
    .from('roles_seats')
    .update({ current_okrs: okrs, okr_completion_pct: completion })
    .eq('id', seatId)
    .eq('company_id', user.id)
    .select('id, current_okrs, okr_completion_pct')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ seat: data, completion })
}
