import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendLifecycleCommsEmail } from '@/lib/email'

// ============================================================================
// /api/company/lifecycle/notify — send a PIP / Separation communication.
// ============================================================================
//
// POST: send the MANAGER-EDITED communication draft to the employee via Resend
//       AND write an immutable organizational_decisions audit row recording
//       that the comms were sent.
//
// SECURITY — mirrors /api/company/lifecycle:
//   • company_id + decided_by_user_id stamped from auth.uid(), NEVER body.
//   • The program is loaded RLS-scoped and we verify the impacted person
//     belongs to this company before sending anything.
//   • RBAC: owner / assigned HRBP / reporting manager only.
//
// IMPORTANT — decision_type constraint:
//   organizational_decisions.decision_type has a DB CHECK that only permits a
//   fixed vocabulary (hire, separate, restructure, …). 'pip_comms_sent' is NOT
//   in that list, so we map PIP comms → 'restructure', separation → 'separate'
//   and record the real event ('pip_comms_sent' / 'separation_comms_sent') in
//   state_snapshot.event instead.
// ============================================================================

type LifecycleRow = {
  id: string
  company_id: string
  person_id: string
  program_type: string
  status: string
  source_seat_id: string | null
  target_seat_id: string | null
  legal_template_ref: string | null
  assigned_hrbp_user_id: string | null
  reporting_manager_user_id: string | null
}

const PROGRAM_LABEL: Record<string, string> = {
  pip: 'Performance Improvement Plan',
  separation: 'Separation',
}

// PIP comms map to a 'restructure' decision; separation comms to 'separate'.
function commsDecisionType(programType: string): string {
  return programType === 'separation' ? 'separate' : 'restructure'
}

function canWrite(userId: string, companyId: string, row: {
  assigned_hrbp_user_id: string | null
  reporting_manager_user_id: string | null
}): boolean {
  return (
    userId === companyId ||
    userId === row.assigned_hrbp_user_id ||
    userId === row.reporting_manager_user_id
  )
}

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
  const programId = String(body.program_id || '')
  const subject = String(body.subject || '').trim()
  const message = String(body.body || '').trim()

  if (!programId) return NextResponse.json({ error: 'program_id required' }, { status: 400 })
  if (message.length < 20) {
    return NextResponse.json({
      error: 'message_too_short',
      message: 'The communication body must be at least 20 characters.',
    }, { status: 400 })
  }

  // Load the program (RLS + explicit company scope) — this also confirms the
  // program exists for this company.
  const { data: programData, error: loadErr } = await supabase
    .from('hr_lifecycle_programs')
    .select('id, company_id, person_id, program_type, status, source_seat_id, target_seat_id, legal_template_ref, assigned_hrbp_user_id, reporting_manager_user_id')
    .eq('company_id', user.id)
    .eq('id', programId)
    .maybeSingle()
  if (loadErr) {
    console.error('[lifecycle notify] load error:', loadErr.message)
    return NextResponse.json({ error: loadErr.message }, { status: 500 })
  }
  if (!programData) return NextResponse.json({ error: 'program not found' }, { status: 404 })
  const program = programData as LifecycleRow

  if (program.program_type !== 'pip' && program.program_type !== 'separation') {
    return NextResponse.json({ error: 'comms_unsupported_for_program_type' }, { status: 400 })
  }
  if (!canWrite(user.id, user.id, program)) {
    return NextResponse.json({ error: 'Forbidden — owner / assigned HRBP / reporting manager only' }, { status: 403 })
  }

  // Verify the impacted person belongs to this company and has an email.
  const { data: personData, error: personErr } = await supabase
    .from('persons')
    .select('id, full_name, preferred_name, email')
    .eq('company_id', user.id)
    .eq('id', program.person_id)
    .maybeSingle()
  if (personErr) {
    console.error('[lifecycle notify] person load error:', personErr.message)
    return NextResponse.json({ error: personErr.message }, { status: 500 })
  }
  const person = personData as { id: string; full_name: string; preferred_name: string | null; email: string | null } | null
  if (!person) return NextResponse.json({ error: 'person not found for this company' }, { status: 404 })
  if (!person.email) {
    return NextResponse.json({
      error: 'person_has_no_email',
      message: 'This employee has no email on file — add one before sending.',
    }, { status: 400 })
  }

  const programLabel = PROGRAM_LABEL[program.program_type] || 'HR communication'
  const displayName = person.preferred_name || person.full_name
  const finalSubject = subject || `${programLabel} — discussion invitation`

  // ── Send the email ──────────────────────────────────────────────────────
  try {
    await sendLifecycleCommsEmail({
      to: person.email,
      subject: finalSubject,
      body: message,
      programLabel,
    })
  } catch (e) {
    console.error('[lifecycle notify] email send error:', e)
    return NextResponse.json({
      error: 'email_send_failed',
      message: 'Could not send the email. Check the Resend configuration.',
    }, { status: 502 })
  }

  // ── Immutable audit row ──────────────────────────────────────────────────
  const event = program.program_type === 'separation' ? 'separation_comms_sent' : 'pip_comms_sent'
  const justification =
    `${programLabel} communication sent to ${displayName} via Shapi on ` +
    `${new Date().toISOString().slice(0, 10)}. Subject: "${finalSubject}".`

  const { error: auditErr } = await supabase
    .from('organizational_decisions')
    .insert({
      company_id: user.id,
      decision_type: commsDecisionType(program.program_type),
      justification,
      decided_by_user_id: user.id,
      impacted_seat_id: program.source_seat_id || null,
      impacted_person_id: program.person_id,
      state_snapshot: {
        lifecycle_program_id: program.id,
        program_type: program.program_type,
        event,
        legal_template_ref: program.legal_template_ref,
        channel: 'email',
        subject: finalSubject,
      },
    })
  if (auditErr) {
    // The email already went out; surface that the audit row failed so the
    // caller knows the trail is incomplete.
    console.error('[lifecycle notify] audit insert error:', auditErr.message)
    return NextResponse.json({
      ok: true,
      warning: 'email_sent_but_audit_failed',
      audit_error: auditErr.message,
    }, { status: 207 })
  }

  return NextResponse.json({ ok: true })
}
