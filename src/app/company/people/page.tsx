import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FeatureGate from '@/components/FeatureGate'

export const metadata = { title: 'People · Shapi' }

// ────────────────────────────────────────────────────────────────────────────
// /company/people — the roster. Lists every `person` for this company and
// links each to their per-employee HR portal (/company/people/[personId]).
//
// Auth pattern copied exactly from src/app/company/spine/page.tsx:
//   getUser → /login · profile.type !== 'company' → /dashboard ·
//   !onboarding_complete → /company/onboarding.
//
// Read-only. Uses the normal server createClient so RLS applies (persons +
// roles_seats are gated to company members via is_company_member()).
// ────────────────────────────────────────────────────────────────────────────

const ACCENT = '#38BDF8'
const BG = '#060609'
const CARD = '#0D0C14'
const HEADING_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }
const BODY_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }

type Person = {
  id: string
  full_name: string
  preferred_name: string | null
  status: string
}

type Seat = {
  id: string
  person_id: string | null
  team_id: string
  title: string
  status: string
}

type Team = {
  id: string
  name: string | null
}

const PERSON_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  active:      { bg: 'rgba(52,211,153,0.12)',  color: '#34D399', label: 'Active' },
  on_leave:    { bg: 'rgba(56, 189, 248, 0.14)', color: ACCENT,    label: 'On leave' },
  separating:  { bg: 'rgba(251,191,36,0.12)',  color: '#FBBF24', label: 'Separating' },
  departed:    { bg: 'rgba(251, 113, 133, 0.12)', color: '#FB7185', label: 'Departed' },
  archived:    { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', label: 'Archived' },
}

export default async function PeoplePage() {
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

  const [personsResult, seatsResult, teamsResult] = await Promise.all([
    supabase
      .from('persons')
      .select('id, full_name, preferred_name, status')
      .eq('company_id', user.id)
      .order('full_name'),
    supabase
      .from('roles_seats')
      .select('id, person_id, team_id, title, status')
      .eq('company_id', user.id),
    supabase
      .from('teams')
      .select('id, name')
      .eq('company_id', user.id),
  ])

  const persons = (personsResult.data || []) as Person[]
  const seats = (seatsResult.data || []) as Seat[]
  const teams = (teamsResult.data || []) as Team[]

  // Index a person → their current seat. A person may hold one occupied seat;
  // pick the first active/non-retired seat that points at them.
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const seatByPerson = new Map<string, Seat>()
  for (const seat of seats) {
    if (!seat.person_id) continue
    const existing = seatByPerson.get(seat.person_id)
    // Prefer an 'active' seat over any other status when a person somehow
    // maps to more than one.
    if (!existing || (existing.status !== 'active' && seat.status === 'active')) {
      seatByPerson.set(seat.person_id, seat)
    }
  }

  const planTier = (profile as { plan_tier?: string | null }).plan_tier || 'free'

  return (
    <main className="min-h-screen px-4 py-10 sm:py-14" style={{ background: BG }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/company/dashboard" className="text-xs font-bold mb-4 inline-block" style={{ color: ACCENT }}>
          ← Dashboard
        </Link>

        <FeatureGate feature="employee_hr_portal">
        <header className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
            People · {planTier === 'free' ? 'Free' : planTier === 'pro' ? 'Pro' : 'Enterprise'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2" style={HEADING_STYLE}>
            {profile.company_name || 'Your people'}
          </h1>
          <p className="text-sm leading-relaxed" style={BODY_STYLE}>
            Every person on your org spine. Open anyone to see their living HR record —
            lifecycle, comp, time off, performance, training, and WhatsApp activity. All
            RBAC-gated and PDPL-aware.
          </p>
        </header>

        {persons.length === 0 ? (
          <div
            className="p-6 rounded-2xl"
            style={{ background: CARD, border: `1px dashed ${ACCENT}40` }}
          >
            <p className="text-sm font-bold mb-1" style={HEADING_STYLE}>No people yet</p>
            <p className="text-sm leading-relaxed mb-4" style={BODY_STYLE}>
              People come from your org spine. Upload-and-map a roster CSV or add a few
              seats on the spine, then they&apos;ll appear here — each with their own HR portal.
            </p>
            <Link
              href="/company/spine"
              className="inline-block text-xs font-black px-4 py-2 rounded-full text-white"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, #38BDF8)` }}
            >
              Go to the org spine →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {persons.map((person) => {
              const seat = seatByPerson.get(person.id) || null
              const team = seat ? teamById.get(seat.team_id) : null
              const statusStyle =
                PERSON_STATUS_STYLE[person.status] || PERSON_STATUS_STYLE.archived
              const displayName = person.preferred_name || person.full_name
              return (
                <li key={person.id}>
                  <Link
                    href={`/company/people/${person.id}`}
                    className="flex items-center gap-3 p-4 rounded-xl transition-colors hover:brightness-110"
                    style={{ background: CARD, border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-black"
                      style={{ background: 'rgba(56, 189, 248, 0.15)', color: ACCENT }}
                    >
                      {displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate" style={HEADING_STYLE}>
                        {displayName}
                      </p>
                      <p className="text-xs truncate" style={BODY_STYLE}>
                        {seat ? seat.title : 'No current seat'}
                        {team?.name ? ` · ${team.name}` : ''}
                      </p>
                    </div>
                    <span
                      className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                      style={{ background: statusStyle.bg, color: statusStyle.color }}
                    >
                      {statusStyle.label}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        </FeatureGate>
      </div>
    </main>
  )
}
