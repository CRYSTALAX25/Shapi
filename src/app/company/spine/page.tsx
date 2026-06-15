import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import OrgCanvas from './OrgCanvas'
import SpineManager from './SpineManager'
import DashboardNav from '../dashboard/DashboardNav'
import { parseHQ } from '@/lib/parseHQ'

export const metadata = { title: 'Org Spine · Shapi' }

export default async function SpinePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const params = await searchParams
  const isWelcome = params.welcome === 'true'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, company_website, location, plan_tier, onboarding_complete')
    .eq('id', user.id)
    .single()

  if (!profile || profile.type !== 'company') redirect('/dashboard')
  if (!profile.onboarding_complete) redirect('/company/onboarding')

  // NOTE: roles_seats uses select('*') on purpose — once the founder runs
  // supabase/verified_org.sql, the verification_status / verified_at /
  // verified_via columns flow straight into OrgCanvas, which probes for the
  // field on the loaded rows and shows the VERIFIED ORG badges + counter.
  // Before the migration the key is simply absent and the canvas hides it all.
  let [locResult, teamsResult, personsResult, seatsResult] = await Promise.all([
    supabase.from('locations').select('*').eq('company_id', user.id).order('is_primary', { ascending: false }).order('name'),
    supabase.from('teams').select('*').eq('company_id', user.id).order('name'),
    supabase.from('persons').select('*').eq('company_id', user.id).order('full_name'),
    supabase.from('roles_seats').select('*').eq('company_id', user.id).order('title'),
  ])

  // HQ AUTO-PROMOTION — first visit to the spine after onboarding. If the
  // company has no locations yet AND profile.location (= HQ from onboarding)
  // is set, materialize it as the primary location. Idempotent: subsequent
  // visits skip because locations.length > 0. The DB free-tier trigger
  // permits this insert (it's the first location).
  const profileHQ = (profile as { location?: string | null }).location || null
  if ((locResult.data || []).length === 0 && profileHQ) {
    const parsed = parseHQ(profileHQ)
    // Need *some* country to insert (NOT NULL constraint). Fall back to first
    // 2 characters of country part or 'XX' so the row exists; user edits it
    // on the page.
    const fallbackCountry = parsed.country || 'XX'
    const fallbackCity = parsed.city || profileHQ.split(',')[0]?.trim() || null
    const seedName = `${profile.company_name || 'HQ'}${fallbackCity ? ` · ${fallbackCity}` : ''}`
    const { error: seedErr } = await supabase
      .from('locations')
      .insert({
        company_id: user.id,
        name: seedName,
        country: fallbackCountry,
        city: fallbackCity,
        timezone: parsed.timezone || null,
        is_primary: true,
      })
    if (!seedErr) {
      locResult = await supabase
        .from('locations')
        .select('*')
        .eq('company_id', user.id)
        .order('is_primary', { ascending: false })
        .order('name')
    } else {
      console.error('[spine] HQ auto-promote failed:', seedErr.message)
    }
  }

  const locations = locResult.data || []
  const teams = teamsResult.data || []
  const persons = personsResult.data || []
  const seats = seatsResult.data || []

  const planTier = (profile as { plan_tier?: string | null }).plan_tier || 'free'
  const companyWebsite = (profile as { company_website?: string | null }).company_website || null
  const planLabel = planTier === 'enterprise' ? 'Enterprise' : (planTier === 'pro' || planTier === 'growth') ? 'Pro' : 'Free'
  const showUpgrade = planTier !== 'enterprise'

  const ACCENT = '#38BDF8'
  const HEADING_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }
  const BODY_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }

  return (
    <div className="min-h-screen" style={{ background: '#060609' }}>
      {/* Dot-grid overlay — Violet Mint spec, matches the dashboard shell. */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(56, 189, 248,0.07) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Top bar — same wordmark + sign out as every company surface. */}
      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="font-black text-xl"
            style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '-0.02em' }}
          >
            shapi
          </Link>
          <form action="/api/auth/signout" method="post">
            <button className="text-white/40 text-sm hover:text-white/70 transition-colors">Sign out</button>
          </form>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-8 pb-20">
        <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">

          {/* Same sticky sidebar as the dashboard — navigation is identical
              across the whole company product. */}
          <DashboardNav planLabel={planLabel} showUpgrade={showUpgrade} activeHref="/company/spine" />

          <main className="min-w-0">
            {/* Header: company name + the org-data action bar (Locations /
                Teams / People / Seats) pinned top-right, like the candidate
                profile bar. The chart below is the hero. */}
            <header className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5" style={{ color: ACCENT }}>
                Org Spine · {planLabel}
              </p>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <h1 className="text-3xl font-black tracking-tight min-w-0 truncate" style={HEADING_STYLE}>
                  {profile.company_name || 'Your org'}
                </h1>
                <SpineManager
                  locations={locations}
                  teams={teams}
                  persons={persons}
                  seats={seats}
                  companyWebsite={companyWebsite}
                  planTier={planTier}
                />
              </div>
              <p className="text-sm leading-relaxed mt-2 max-w-2xl" style={BODY_STYLE}>
                Your live org in 2D — locations, teams, seats and the people in them. Drag a seat to
                reassign (justified + logged); everything else in Shapi reads from here.
              </p>
            </header>

            {isWelcome && (
              <div
                className="mb-6 p-5 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(56, 189, 248,0.10), rgba(52,211,153,0.08))',
                  border: `1px solid ${ACCENT}55`,
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
                  Welcome to your org spine
                </p>
                <h2 className="text-xl font-black mb-2" style={HEADING_STYLE}>
                  {profile.company_name || 'Your HQ'} is in. Now build out the rest.
                </h2>
                <p className="text-sm leading-relaxed mb-4" style={BODY_STYLE}>
                  Use the <strong style={{ color: ACCENT }}>Locations</strong> button above to add a site and upload its roster,
                  then add teams and seats. Every other tool — Workforce Snapshot, Salary Benchmark, Hiring Roadmap — pre-fills from here.
                </p>
                <Link
                  href="/company/workforce-snapshot?first=true"
                  className="inline-block text-xs font-bold underline"
                  style={{ color: ACCENT }}
                >
                  Skip — run Workforce Snapshot manually →
                </Link>
              </div>
            )}

            {planTier === 'free' && (
              <div
                className="mb-6 p-4 rounded-xl text-xs"
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#FBBF24' }}
              >
                <strong>Free tier:</strong> one location + one roster upload. Upgrade to Pro ($499/mo) for
                multi-location org charts + Talent Match Pipeline.{' '}
                <Link href="/company/pricing" className="font-black underline">See plans</Link>
              </div>
            )}

            {/* The hero — the 2D node-and-line org map. */}
            <OrgCanvas locations={locations} teams={teams} persons={persons} seats={seats} />
          </main>
        </div>
      </div>
    </div>
  )
}
