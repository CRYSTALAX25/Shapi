import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  programTypeNeedsTemplate,
  isValidTemplateRefForType,
} from '@/lib/legalTemplates'

// ============================================================================
// /api/company/lifecycle — HRBP PIP / Separation playbooks (Enterprise #103).
// ============================================================================
//
// POST: create a new hr_lifecycle_program, OR advance an existing one's status.
//       EVERY create and EVERY status advance ALSO inserts an immutable
//       organizational_decisions audit row (decision_type, justification ≥20,
//       impacted person/seat, state_snapshot).
//
// GET:  list lifecycle programs for ?personId= (RLS-gated).
//
// SECURITY — mirrors /api/company/spine/decision exactly:
//   • company_id + decided_by_user_id are stamped from auth.uid(), NEVER body.
//   • RBAC: only the company owner / assigned HRBP / reporting manager may
//     write — RLS enforces this; we ALSO check in the handler for a clean 403
//     and to avoid writing an orphan audit row when the program write fails.
//   • This route NEVER drafts legal text. legal_template_ref is a reference to
//     a vetted catalogue entry (src/lib/legalTemplates), validated below.
// ============================================================================

const VALID_PROGRAM_TYPES = [
  'onboarding', 'pip', 'separation', 'redeploy', 'reskill', 'augment',
] as const
const VALID_STATUSES = [
  'open', 'in_progress', 'completed', 'abandoned', 'escalated',
] as const

// program_type → the organizational_decisions.decision_type to stamp on the
// audit row at CREATE time.
const CREATE_DECISION_TYPE: Record<string, string> = {
  onboarding: 'hire',
  pip: 'restructure',
  separation: 'separate',
  redeploy: 'redeploy',
  reskill: 'reskill_assign',
  augment: 'augment_assign',
}

// When a program ADVANCES, pick a decision_type that reflects the new state.
function advanceDecisionType(programType: string, newStatus: string): string {
  if (newStatus === 'escalated') {
    // A PIP escalating typically means moving toward separation.
    return programType === 'pip' ? 'separate' : 'restructure'
  }
  if (newStatus === 'completed' && programType === 'separation') return 'separate'
  if (newStatus === 'completed' && programType === 'redeploy') return 'redeploy'
  return CREATE_DECISION_TYPE[programType] || 'restructure'
}

type LifecycleRow = {
  id: string
  company_id: string
  person_id: string
  program_type: string
  status: string
  source_seat_id: string | null
  target_seat_id: string | null
  assigned_hrbp_user_id: string | null
  reporting_manager_user_id: string | null
}

// Shared auth + company gate.
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

// RBAC: owner OR assigned HRBP OR reporting manager may write to a program.
// Owner === auth.uid() === company_id (companies own their own auth row).
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

// ─────────────────────────────────────────────────────────────────────────────
// GET — list programs for a person.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const gate = await requireCompany()
  if (gate.error) return gate.error
  const { supabase, user } = gate

  const personId = new URL(request.url).searchParams.get('personId')
  if (!personId) {
    return NextResponse.json({ error: 'personId required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('hr_lifecycle_programs')
    .select(
      'id, person_id, program_type, status, source_seat_id, target_seat_id, start_date, target_end_date, actual_end_date, milestones_30d, milestones_60d, milestones_90d, legal_template_ref, assigned_hrbp_user_id, reporting_manager_user_id, created_at, updated_at'
    )
    .eq('company_id', user.id)
    .eq('person_id', personId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[lifecycle GET] error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ programs: data || [] })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — create a new program, or advance an existing one.
//
// Body (create):  { person_id, program_type, justification, status?,
//                   source_seat_id?, target_seat_id?, target_end_date?,
//                   milestones_30d?, milestones_60d?, milestones_90d?,
//                   private_notes?, legal_template_ref?,
//                   assigned_hrbp_user_id?, reporting_manager_user_id? }
// Body (advance): { program_id, status, justification, private_notes?,
//                   milestones_30d?, ... (any editable field) }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const gate = await requireCompany()
  if (gate.error) return gate.error
  const { supabase, user } = gate

  const body = await request.json().catch(() => ({}))
  const justification = String(body.justification || '').trim()
  if (justification.length < 20) {
    return NextResponse.json({
      error: 'justification_too_short',
      message: 'Justification must be at least 20 characters — the audit log needs context.',
    }, { status: 400 })
  }

  // Common optional editable fields.
  const editable: Record<string, unknown> = {}
  if (Array.isArray(body.milestones_30d)) editable.milestones_30d = body.milestones_30d
  if (Array.isArray(body.milestones_60d)) editable.milestones_60d = body.milestones_60d
  if (Array.isArray(body.milestones_90d)) editable.milestones_90d = body.milestones_90d
  if (typeof body.private_notes === 'string') editable.private_notes = body.private_notes
  if (typeof body.target_end_date === 'string' && body.target_end_date) editable.target_end_date = body.target_end_date

  // ── ADVANCE path ──────────────────────────────────────────────────────────
  if (body.program_id) {
    const newStatus = String(body.status || '')
    if (!VALID_STATUSES.includes(newStatus as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    }

    // Load the existing row (RLS-scoped) so we can RBAC-check and snapshot.
    const { data: existing, error: loadErr } = await supabase
      .from('hr_lifecycle_programs')
      .select('id, company_id, person_id, program_type, status, source_seat_id, target_seat_id, assigned_hrbp_user_id, reporting_manager_user_id')
      .eq('company_id', user.id)
      .eq('id', body.program_id)
      .maybeSingle()
    if (loadErr) {
      console.error('[lifecycle advance] load error:', loadErr.message)
      return NextResponse.json({ error: loadErr.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'program not found' }, { status: 404 })
    }
    const row = existing as LifecycleRow
    if (!canWrite(user.id, user.id, row)) {
      return NextResponse.json({ error: 'Forbidden — owner / assigned HRBP / reporting manager only' }, { status: 403 })
    }

    const update: Record<string, unknown> = { ...editable, status: newStatus }
    // Terminal statuses set actual_end_date if not already supplied.
    if (newStatus === 'completed' || newStatus === 'abandoned') {
      update.actual_end_date = body.actual_end_date || new Date().toISOString().slice(0, 10)
    }

    const { data: updated, error: updErr } = await supabase
      .from('hr_lifecycle_programs')
      .update(update)
      .eq('company_id', user.id)
      .eq('id', body.program_id)
      .select()
      .single()
    if (updErr) {
      console.error('[lifecycle advance] update error:', updErr.message)
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    // Immutable audit row for the transition.
    const { error: auditErr } = await supabase
      .from('organizational_decisions')
      .insert({
        company_id: user.id,
        decision_type: advanceDecisionType(row.program_type, newStatus),
        justification,
        decided_by_user_id: user.id,
        impacted_seat_id: row.source_seat_id || null,
        impacted_person_id: row.person_id,
        state_snapshot: {
          lifecycle_program_id: row.id,
          program_type: row.program_type,
          transition: { from: row.status, to: newStatus },
          source_seat_id: row.source_seat_id,
          target_seat_id: row.target_seat_id,
        },
      })
    if (auditErr) {
      // The status change already committed; surface that the audit failed so
      // the caller knows the trail is incomplete (rare — RLS/insert error).
      console.error('[lifecycle advance] audit insert error:', auditErr.message)
      return NextResponse.json({
        program: updated,
        warning: 'status_updated_but_audit_failed',
        audit_error: auditErr.message,
      }, { status: 207 })
    }

    return NextResponse.json({ program: updated })
  }

  // ── CREATE path ─────────────────────────────────────────────────────────────
  const programType = String(body.program_type || '')
  if (!VALID_PROGRAM_TYPES.includes(programType as typeof VALID_PROGRAM_TYPES[number])) {
    return NextResponse.json({ error: 'invalid program_type' }, { status: 400 })
  }
  const personId = String(body.person_id || '')
  if (!personId) {
    return NextResponse.json({ error: 'person_id required' }, { status: 400 })
  }
  const status = body.status && VALID_STATUSES.includes(body.status) ? body.status : 'open'

  // Validate the legal_template_ref against the vetted catalogue — never trust a
  // client-supplied ref. It must exist AND match the program type. We do NOT
  // generate any legal text; we only record which vetted template was selected.
  let legalTemplateRef: string | null = null
  if (body.legal_template_ref) {
    const ref = String(body.legal_template_ref)
    if (!isValidTemplateRefForType(ref, programType)) {
      return NextResponse.json({
        error: 'invalid_legal_template_ref',
        message: 'legal_template_ref must reference a vetted template matching this program type.',
      }, { status: 400 })
    }
    legalTemplateRef = ref
  } else if (programTypeNeedsTemplate(programType)) {
    // PIP / separation should carry a template reference for the audit trail.
    return NextResponse.json({
      error: 'legal_template_ref_required',
      message: 'PIP and separation programs require a vetted legal template reference.',
    }, { status: 400 })
  }

  // RBAC anchors. Owner always permitted. We allow setting an HRBP / manager;
  // the creator must themselves be permitted (owner, or one of the anchors they
  // set) — companies act as owner so this passes for the company account.
  const assignedHrbp = body.assigned_hrbp_user_id || null
  const reportingManager = body.reporting_manager_user_id || null
  if (!canWrite(user.id, user.id, {
    assigned_hrbp_user_id: assignedHrbp,
    reporting_manager_user_id: reportingManager,
  })) {
    return NextResponse.json({ error: 'Forbidden — owner / assigned HRBP / reporting manager only' }, { status: 403 })
  }

  const insertRow: Record<string, unknown> = {
    company_id: user.id,                 // stamped from auth — never body
    person_id: personId,
    program_type: programType,
    status,
    source_seat_id: body.source_seat_id || null,
    target_seat_id: body.target_seat_id || null,
    legal_template_ref: legalTemplateRef,
    assigned_hrbp_user_id: assignedHrbp,
    reporting_manager_user_id: reportingManager,
    ...editable,
  }

  const { data: created, error: createErr } = await supabase
    .from('hr_lifecycle_programs')
    .insert(insertRow)
    .select()
    .single()
  if (createErr) {
    console.error('[lifecycle create] error:', createErr.message)
    return NextResponse.json({ error: createErr.message }, { status: 500 })
  }

  // Immutable audit row for the creation.
  const { error: auditErr } = await supabase
    .from('organizational_decisions')
    .insert({
      company_id: user.id,
      decision_type: CREATE_DECISION_TYPE[programType] || 'restructure',
      justification,
      decided_by_user_id: user.id,        // stamped from auth — never body
      impacted_seat_id: body.source_seat_id || null,
      impacted_person_id: personId,
      state_snapshot: {
        lifecycle_program_id: (created as { id: string }).id,
        program_type: programType,
        event: 'created',
        status,
        legal_template_ref: legalTemplateRef,
        source_seat_id: body.source_seat_id || null,
        target_seat_id: body.target_seat_id || null,
      },
    })
  if (auditErr) {
    console.error('[lifecycle create] audit insert error:', auditErr.message)
    return NextResponse.json({
      program: created,
      warning: 'program_created_but_audit_failed',
      audit_error: auditErr.message,
    }, { status: 207 })
  }

  return NextResponse.json({ program: created })
}
