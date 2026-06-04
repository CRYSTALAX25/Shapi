import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LocationsSection, TeamsSection, PersonsSection, SeatsSection } from './SpineForms'

export const metadata = { title: 'Org Spine · Shapi' }

export default async function SpinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, company_website, plan_tier, onboarding_complete')
    .eq('id', user.id)
    .single()

  if (!profile || profile.type !== 'company') redirect('/dashboard')
  if (!profile.onboarding_complete) redirect('/company/onboarding')

  const [locResult, teamsResult, personsResult, seatsResult] = await Promise.all([
    supabase.from('locations').select('*').eq('company_id', user.id).order('is_primary', { ascending: false }).order('name'),
    supabase.from('teams').select('*').eq('company_id', user.id).order('name'),
    supabase.from('persons').select('*').eq('company_id', user.id).order('full_name'),
    supabase.from('roles_seats').select('*').eq('company_id', user.id).order('title'),
  ])

  const locations = locResult.data || []
  const teams = teamsResult.data || []
  const persons = personsResult.data || []
  const seats = seatsResult.data || []

  const planTier = (profile as { plan_tier?: string | null }).plan_tier || 'free'

  const ACCENT = '#7c93f5'
  const HEADING_STYLE: React.CSSProperties = { color: '#f4f6f9' }
  const BODY_STYLE: React.CSSProperties = { color: '#9ca3af' }

  return (
    <main className="min-h-screen px-4 py-10 sm:py-14" style={{ background: '#0c0e11' }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/company/dashboard" className="text-xs font-bold mb-4 inline-block" style={{ color: ACCENT }}>
          ← Dashboard
        </Link>

        <header className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
            Org Spine · {planTier === 'free' ? 'Free' : planTier === 'pro' ? 'Pro' : 'Enterprise'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2" style={HEADING_STYLE}>
            {profile.company_name || 'Your org'}
          </h1>
          <p className="text-sm leading-relaxed" style={BODY_STYLE}>
            The single source of truth for who works where. Locations hold teams, teams hold seats,
            seats are filled by people. Everything else in Shapi — workforce planning, talent matching,
            HR portal — reads from here.
          </p>
        </header>

        {planTier === 'free' && (
          <div
            className="mb-6 p-4 rounded-xl text-xs"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#FBBF24' }}
          >
            <strong>Free tier:</strong> one location, one upload-and-map. Upgrade to Pro ($499/mo) for
            multi-location org charts + Talent Match Pipeline.{' '}
            <Link href="/company/pricing" className="font-black underline">See plans</Link>
          </div>
        )}

        <div className="space-y-5">
          <LocationsSection locations={locations} companyWebsite={(profile as { company_website?: string | null }).company_website || null} />
          <TeamsSection teams={teams} locations={locations} />
          <PersonsSection persons={persons} />
          <SeatsSection seats={seats} teams={teams} persons={persons} />
        </div>

        <div className="mt-8 p-4 rounded-xl" style={{ background: '#13161b', border: `1px dashed ${ACCENT}40` }}>
          <p className="text-xs font-bold mb-1" style={HEADING_STYLE}>Coming next</p>
          <p className="text-xs" style={BODY_STYLE}>
            Visual drag-and-drop tree, CSV upload-and-map, AI-assisted org design — all built on top
            of this spine.
          </p>
        </div>
      </div>
    </main>
  )
}
