import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DelegationBoard from './DelegationBoard'

export const metadata = { title: 'Workload Delegation · Shapi' }

const ACCENT = '#9D8CFF'
const HEADING_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }
const BODY_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }

type SeatRow = {
  id: string
  title: string
  team_id: string
  person_id: string | null
  status: string
  absorbed_capacity_pct: number | null
}

type PersonRow = { id: string; full_name: string; preferred_name: string | null; status: string }

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

export default async function DelegationPage() {
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

  const [seatsResult, personsResult, delResult] = await Promise.all([
    supabase
      .from('roles_seats')
      .select('id, title, team_id, person_id, status, absorbed_capacity_pct')
      .eq('company_id', user.id)
      .order('title'),
    supabase
      .from('persons')
      .select('id, full_name, preferred_name, status')
      .eq('company_id', user.id),
    supabase
      .from('workload_delegations')
      .select('*')
      .eq('company_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const seats = (seatsResult.data || []) as SeatRow[]
  const persons = (personsResult.data || []) as PersonRow[]
  const delegations = (delResult.data || []) as DelegationRow[]

  const planTier = (profile as { plan_tier?: string | null }).plan_tier || 'free'

  return (
    <main className="min-h-screen px-4 py-10 sm:py-14" style={{ background: '#060609' }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/company/dashboard" className="text-xs font-bold mb-4 inline-block" style={{ color: ACCENT }}>
          ← Dashboard
        </Link>

        <header className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
            Workload Delegation · HR OS
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2" style={HEADING_STYLE}>
            Cover the work, not just the seat
          </h1>
          <p className="text-sm leading-relaxed" style={BODY_STYLE}>
            When someone is overloaded or separating, move a slice of their workload onto covering
            seats. Each delegation lifts the covering seat&apos;s absorbed capacity — when a seat
            crosses 100%, it surfaces as a retention risk in the Calibration Lens. Deliverables
            produced under a delegation later feed Skill Density.
          </p>
        </header>

        <DelegationBoard
          seats={seats}
          persons={persons}
          initialDelegations={delegations}
          planTier={planTier}
        />
      </div>
    </main>
  )
}
