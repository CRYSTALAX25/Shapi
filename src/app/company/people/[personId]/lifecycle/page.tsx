import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import LifecycleClient from './LifecycleClient'
import { LEGAL_TEMPLATES, TEMPLATE_COUNTRIES, getTemplateByRef } from '@/lib/legalTemplates'

export const metadata = { title: 'Lifecycle Playbooks · Shapi' }

// ────────────────────────────────────────────────────────────────────────────
// /company/people/[personId]/lifecycle — HRBP PIP / Separation playbooks (#103).
//
// Server component. Auth pattern copied from spine/page.tsx and the per-person
// HR portal. Uses the normal server createClient so RLS applies — the lifecycle
// programs + decision audit are HRBP / manager / owner gated at the row level.
//
// CRITICAL: this page NEVER generates legal wording. It routes the HRBP to the
// matching VETTED template reference from src/lib/legalTemplates and displays
// the stub. The actual binding document is authored by counsel.
// ────────────────────────────────────────────────────────────────────────────

const ACCENT = '#9D8CFF'
const BG = '#060609'
const HEADING_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }
const BODY_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }

type Person = {
  id: string
  full_name: string
  preferred_name: string | null
  email: string | null
}

type Program = {
  id: string
  person_id: string
  program_type: string
  status: string
  source_seat_id: string | null
  target_seat_id: string | null
  start_date: string
  target_end_date: string | null
  actual_end_date: string | null
  milestones_30d: unknown
  milestones_60d: unknown
  milestones_90d: unknown
  private_notes: string | null
  legal_template_ref: string | null
  assigned_hrbp_user_id: string | null
  reporting_manager_user_id: string | null
  created_at: string
}

type DecisionRow = {
  id: string
  decision_type: string
  justification: string
  impacted_person_id: string | null
  impacted_seat_id: string | null
  state_snapshot: unknown
  decided_at: string
}

export default async function PersonLifecyclePage({
  params,
}: {
  params: Promise<{ personId: string }>
}) {
  const { personId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, plan_tier, onboarding_complete')
    .eq('id', user.id)
    .single()

  if (!profile || profile.type !== 'company') redirect('/dashboard')
  if (!profile.onboarding_complete) redirect('/company/onboarding')

  const { data: personData } = await supabase
    .from('persons')
    .select('id, full_name, preferred_name, email')
    .eq('company_id', user.id)
    .eq('id', personId)
    .maybeSingle()
  if (!personData) notFound()
  const person = personData as Person

  // Load programs + decision audit for this person in parallel. RLS gates both.
  const [programsResult, decisionsResult] = await Promise.all([
    supabase
      .from('hr_lifecycle_programs')
      .select(
        'id, person_id, program_type, status, source_seat_id, target_seat_id, start_date, target_end_date, actual_end_date, milestones_30d, milestones_60d, milestones_90d, private_notes, legal_template_ref, assigned_hrbp_user_id, reporting_manager_user_id, created_at'
      )
      .eq('company_id', user.id)
      .eq('person_id', personId)
      .order('created_at', { ascending: false }),
    supabase
      .from('organizational_decisions')
      .select('id, decision_type, justification, impacted_person_id, impacted_seat_id, state_snapshot, decided_at')
      .eq('company_id', user.id)
      .eq('impacted_person_id', personId)
      .order('decided_at', { ascending: false })
      .limit(50),
  ])

  const programs = (programsResult.data || []) as Program[]
  const decisions = (decisionsResult.data || []) as DecisionRow[]

  const displayName = person.preferred_name || person.full_name
  const planTier = (profile as { plan_tier?: string | null }).plan_tier || 'free'

  // Resolve template metadata for any refs already attached to programs (so the
  // server can hand the client fully-resolved titles without a round trip).
  const attachedTemplates = programs
    .map((p) => p.legal_template_ref)
    .filter((r): r is string => !!r)
    .map((r) => getTemplateByRef(r))
    .filter((t) => t !== null)

  return (
    <main className="min-h-screen px-4 py-10 sm:py-14" style={{ background: BG }}>
      <div className="max-w-3xl mx-auto">
        <Link
          href={`/company/people/${personId}`}
          className="text-xs font-bold mb-4 inline-block"
          style={{ color: ACCENT }}
        >
          ← {displayName}
        </Link>

        <header className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
            Lifecycle Playbooks · {planTier === 'enterprise' ? 'Enterprise' : 'Preview'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-1" style={HEADING_STYLE}>
            {displayName}
          </h1>
          <p className="text-sm leading-relaxed" style={BODY_STYLE}>
            Start and run a Performance Improvement Plan or Separation — country-correct vetted legal
            template, 30 / 60 / 90 milestones, and an immutable decision audit trail.
          </p>
        </header>

        {/* Counsel disclaimer — sets the no-AI-drafting expectation up front. */}
        <div
          className="mb-6 p-4 rounded-xl text-xs leading-relaxed"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.28)', color: '#FBBF24' }}
        >
          <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Vetted templates only — never AI-drafted.</strong>{' '}
          Shapi routes you to the correct counsel-reviewed document for the chosen country and program
          type. UAE, KSA and India differ on notice periods, end-of-service and probation. Shapi does
          not generate the binding legal wording — a licensed adviser does.
        </div>

        <LifecycleClient
          personId={personId}
          displayName={displayName}
          programs={programs}
          decisions={decisions}
          templates={LEGAL_TEMPLATES}
          countries={TEMPLATE_COUNTRIES}
          attachedTemplates={attachedTemplates as NonNullable<typeof attachedTemplates[number]>[]}
        />
      </div>
    </main>
  )
}
