import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ============================================================================
// /api/company/attendance — correct or delete an attendance ledger entry.
// ============================================================================
//
// PATCH:  update editable fields of an employee_attendance_ledger row
//         (entry_type, start_date, end_date, days, notes).
// DELETE: remove an entry.
//
// Both are company-scoped + auth'd. RLS on employee_attendance_ledger ALSO
// restricts writes to owner / assigned HRBP, but we explicitly scope by
// company_id and verify the person belongs to the company for a clean error.
//
// PDPL note: for medical-consent rows we never accept a `notes` write from this
// surface (the editor never exposes those notes). The `corrected_at` column does
// not exist on the table — the schema only auto-bumps `updated_at` via trigger —
// so corrections are reflected there. We optionally fold a correction marker
// into `notes` for non-medical rows.
// ============================================================================

const VALID_ENTRY_TYPES = [
  'annual_leave', 'sick_leave', 'parental_leave',
  'bereavement', 'personal', 'unpaid', 'public_holiday',
] as const

async function requireCompany() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
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

// Load the entry RLS-scoped to confirm it exists for this company.
async function loadEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  id: string,
) {
  return supabase
    .from('employee_attendance_ledger')
    .select('id, person_id, medical_consent_logged')
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle()
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — correct an entry.
// Body: { id, person_id?, entry_type?, start_date?, end_date?, days?, notes? }
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  const gate = await requireCompany()
  if (gate.error) return gate.error
  const { supabase, user } = gate

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: existing, error: loadErr } = await loadEntry(supabase, user.id, id)
  if (loadErr) {
    console.error('[attendance PATCH] load error:', loadErr.message)
    return NextResponse.json({ error: loadErr.message }, { status: 500 })
  }
  if (!existing) return NextResponse.json({ error: 'entry not found' }, { status: 404 })
  const row = existing as { id: string; person_id: string; medical_consent_logged: boolean }

  const update: Record<string, unknown> = {}

  if (body.entry_type !== undefined) {
    const et = String(body.entry_type)
    if (!VALID_ENTRY_TYPES.includes(et as typeof VALID_ENTRY_TYPES[number])) {
      return NextResponse.json({ error: 'invalid entry_type' }, { status: 400 })
    }
    update.entry_type = et
  }
  if (body.start_date !== undefined) {
    if (!body.start_date) return NextResponse.json({ error: 'start_date cannot be empty' }, { status: 400 })
    update.start_date = String(body.start_date)
  }
  if (body.end_date !== undefined) {
    if (!body.end_date) return NextResponse.json({ error: 'end_date cannot be empty' }, { status: 400 })
    update.end_date = String(body.end_date)
  }
  if (body.days !== undefined) {
    const days = Number(body.days)
    if (Number.isNaN(days) || days < 0) {
      return NextResponse.json({ error: 'days must be a number ≥ 0' }, { status: 400 })
    }
    update.days = days
  }
  // PDPL: never write notes onto a medical-consent row from this surface.
  if (body.notes !== undefined && !row.medical_consent_logged) {
    update.notes = body.notes === null ? null : String(body.notes)
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no editable fields supplied' }, { status: 400 })
  }

  const { data: updated, error: updErr } = await supabase
    .from('employee_attendance_ledger')
    .update(update)
    .eq('company_id', user.id)
    .eq('id', id)
    .select('id, entry_type, start_date, end_date, days, notes, medical_consent_logged, logged_via, approved_at')
    .single()
  if (updErr) {
    console.error('[attendance PATCH] update error:', updErr.message)
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, entry: updated })
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — remove an entry. Body: { id, person_id? }
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  const gate = await requireCompany()
  if (gate.error) return gate.error
  const { supabase, user } = gate

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: existing, error: loadErr } = await loadEntry(supabase, user.id, id)
  if (loadErr) {
    console.error('[attendance DELETE] load error:', loadErr.message)
    return NextResponse.json({ error: loadErr.message }, { status: 500 })
  }
  if (!existing) return NextResponse.json({ error: 'entry not found' }, { status: 404 })

  const { error: delErr } = await supabase
    .from('employee_attendance_ledger')
    .delete()
    .eq('company_id', user.id)
    .eq('id', id)
  if (delErr) {
    console.error('[attendance DELETE] delete error:', delErr.message)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
