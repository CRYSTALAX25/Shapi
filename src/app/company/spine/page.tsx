import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LocationsSection, TeamsSection, PersonsSection, SeatsSection } from './SpineForms'
import CsvImportSection from './CsvImportSection'
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

        {isWelcome && (
          <div
            className="mb-6 p-5 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(106,168,245,0.10), rgba(240,140,174,0.10))',
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
              Add a couple of teams and seats. Once that&apos;s done, every other tool in Shapi —
              Workforce Snapshot, Salary Benchmark, Hiring Roadmap, Strategic Plan — pre-fills from
              here instead of asking you to retype the same data.
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
            <strong>Free tier:</strong> one location, one upload-and-map. Upgrade to Pro ($499/mo) for
            multi-location org charts + Talent Match Pipeline.{' '}
            <Link href="/company/pricing" className="font-black underline">See plans</Link>
          </div>
        )}

        <div className="space-y-5">
          {/* CSV import lives at the TOP — it's the primary way to populate
              the spine for real companies. Manual CRUD below is for tweaks
              and corrections. Visual canvas + drag-drop tree lands in
              Phase B (next commit). */}
          <CsvImportSection planTier={planTier} />

          <LocationsSection locations={locations} companyWebsite={(profile as { company_website?: string | null }).company_website || null} />
          <TeamsSection teams={teams} locations={locations} />
          <PersonsSection persons={persons} />
          <SeatsSection seats={seats} teams={teams} persons={persons} />
        </div>

        <div className="mt-8 p-4 rounded-xl" style={{ background: '#13161b', border: `1px dashed ${ACCENT}40` }}>
          <p className="text-xs font-bold mb-1" style={HEADING_STYLE}>Coming next (Phase B+)</p>
          <p className="text-xs" style={BODY_STYLE}>
            Per-location upload buttons · visual drag-and-drop SVG tree · template lenses
            (functional / divisional / matrix / flat) · HRBP Calibration overlay.
          </p>
        </div>
      </div>
    </main>
  )
}
