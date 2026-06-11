import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Workforce Snapshot pre-fill from the org spine.
//
// Derives the Snapshot's 6 inputs from the spine where possible:
//   • industry      ← profiles.company_data.industry   (enriched from website)
//   • size          ← bucketed count of active seats   (roles_seats)
//   • country       ← primary location's country name  (locations.country)
//   • roles[]       ← roles_seats grouped by (title, team)
//   • aiMaturity    — STILL asks (not derivable yet)
//   • opModel       — STILL asks (not derivable yet)
//
// Snapshot's size buckets: '<10' | '10-50' | '50-200' | '200-1000' | '1000+'
// Snapshot's country field: free-text country NAME (e.g. "Saudi Arabia"),
// so we map ISO-2 → name.

const ISO_TO_COUNTRY: Record<string, string> = {
  SA: 'Saudi Arabia', AE: 'United Arab Emirates', QA: 'Qatar', KW: 'Kuwait',
  BH: 'Bahrain', OM: 'Oman', EG: 'Egypt', JO: 'Jordan', LB: 'Lebanon',
  IQ: 'Iraq', YE: 'Yemen', SY: 'Syria', PS: 'Palestine',
  IN: 'India', PK: 'Pakistan', BD: 'Bangladesh', PH: 'Philippines',
  LK: 'Sri Lanka', NP: 'Nepal',
  MA: 'Morocco', DZ: 'Algeria', TN: 'Tunisia', LY: 'Libya', SD: 'Sudan',
  KE: 'Kenya', NG: 'Nigeria', ZA: 'South Africa', ET: 'Ethiopia', GH: 'Ghana',
  GB: 'United Kingdom', IE: 'Ireland', DE: 'Germany', FR: 'France',
  ES: 'Spain', IT: 'Italy', NL: 'Netherlands', BE: 'Belgium',
  PT: 'Portugal', CH: 'Switzerland', AT: 'Austria', SE: 'Sweden',
  NO: 'Norway', DK: 'Denmark', FI: 'Finland', PL: 'Poland', TR: 'Turkey',
  US: 'United States', CA: 'Canada', MX: 'Mexico', BR: 'Brazil', AR: 'Argentina',
  SG: 'Singapore', MY: 'Malaysia', ID: 'Indonesia', TH: 'Thailand',
  VN: 'Vietnam', HK: 'Hong Kong', CN: 'China', KR: 'South Korea',
  JP: 'Japan', AU: 'Australia', NZ: 'New Zealand',
}

function bucketSize(activeCount: number): string {
  if (activeCount < 10) return '<10'
  if (activeCount < 50) return '10-50'
  if (activeCount < 200) return '50-200'
  if (activeCount < 1000) return '200-1000'
  return '1000+'
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_data')
    .eq('id', user.id)
    .single()
  if (!profile || profile.type !== 'company') {
    return NextResponse.json({ error: 'Company account required' }, { status: 403 })
  }

  // VERIFIED ORG: ask for verification_status too. GRACEFUL DEGRADE — before
  // the founder runs supabase/verified_org.sql, the column doesn't exist
  // (Postgres 42703), so we retry without it and omit verification stats from
  // the response entirely.
  type SeatRow = {
    id: string
    title: string
    team_id: string
    status: string
    person_id: string | null
    seniority: string | null
    verification_status?: string | null
  }
  const seatColumns = 'id, title, team_id, status, person_id, seniority'
  let verificationAvailable = true
  const [locResult, teamResult, firstSeatResult] = await Promise.all([
    supabase
      .from('locations')
      .select('id, country, name, is_primary')
      .eq('company_id', user.id)
      .order('is_primary', { ascending: false }),
    supabase
      .from('teams')
      .select('id, name, function')
      .eq('company_id', user.id),
    supabase
      .from('roles_seats')
      .select(`${seatColumns}, verification_status`)
      .eq('company_id', user.id),
  ])

  let seatData: SeatRow[] | null = firstSeatResult.data as SeatRow[] | null
  if (firstSeatResult.error) {
    verificationAvailable = false
    const retry = await supabase
      .from('roles_seats')
      .select(seatColumns)
      .eq('company_id', user.id)
    seatData = retry.data as SeatRow[] | null
  }

  const locations = locResult.data || []
  const teams = teamResult.data || []
  const seats = seatData || []
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]))

  // Active = filled + non-frozen; 'planned'/'vacant' don't count toward size.
  const activeSeats = seats.filter(s => s.person_id && (s.status === 'active' || s.status === 'separating'))
  const size = activeSeats.length > 0 ? bucketSize(activeSeats.length) : ''

  // Country: primary location wins. Fall back to first location.
  const primary = locations.find(l => l.is_primary) || locations[0]
  const countryISO = primary?.country || ''
  const country = countryISO && countryISO !== 'XX' ? (ISO_TO_COUNTRY[countryISO] || countryISO) : ''

  // Industry: from enrichment.
  const industry = ((profile.company_data || {}) as { industry?: string }).industry || ''

  // Roles: group seats by (title, team_id). Departments come from team.function
  // or team.name as fallback. Vacancies AND filled seats both count — this
  // table is the workforce inventory, not just headcount.
  const groups = new Map<string, { role: string; dept: string; count: number }>()
  for (const seat of seats) {
    const t = teamById[seat.team_id]
    const dept = t?.function || t?.name || ''
    const key = `${seat.title}::${dept}`
    const existing = groups.get(key)
    if (existing) existing.count += 1
    else groups.set(key, { role: seat.title, dept, count: 1 })
  }
  const roles = [...groups.values()]
    .map(g => ({ role: g.role, dept: g.dept, count: String(g.count) }))
    .sort((a, b) => Number(b.count) - Number(a.count))

  // Open seats = the hiring list. roles_seats WHERE status IN ('planned','vacant')
  // IS the roadmap — these are seats the company has already decided to fill but
  // hasn't yet. The Hiring Roadmap / Hiring Plan read this directly instead of
  // asking the user to retype roles they've already laid out on the spine.
  const openSeats = seats
    .filter(s => s.status === 'planned' || s.status === 'vacant')
    .map(s => {
      const t = teamById[s.team_id]
      const dept = t?.function || t?.name || ''
      return {
        title: s.title,
        dept,
        seniority: s.seniority || '',
        status: s.status as 'planned' | 'vacant',
      }
    })

  const hasSpine = locations.length > 0 || seats.length > 0

  // VERIFIED ORG stats — lets the Workforce Snapshot cite "based on N%
  // verified org data". Occupied = any seat with a person; verified = the
  // employee confirmed their own seat via magic link. Omitted entirely when
  // the migration hasn't run (verificationAvailable=false).
  const occupiedSeats = seats.filter(s => s.person_id)
  const verifiedSeats = verificationAvailable
    ? occupiedSeats.filter(s => (s as { verification_status?: string }).verification_status === 'verified')
    : []
  const verification = verificationAvailable
    ? {
        verified_seats: verifiedSeats.length,
        occupied_seats: occupiedSeats.length,
        verified_pct: occupiedSeats.length > 0
          ? Math.round((verifiedSeats.length / occupiedSeats.length) * 100)
          : 0,
      }
    : undefined

  // Per-team seat counts — consumed by /company/cognitive-load to pre-fill
  // the team rows. Each entry mirrors the row shape the Cognitive Load
  // form expects so its handleApplySpine() just maps + sets state.
  const teamsBreakdown = teams.map(t => {
    const teamSeats = seats.filter(s => s.team_id === t.id)
    return {
      name: t.name,
      function: t.function || null,
      headcount: teamSeats.filter(s => s.person_id && (s.status === 'active' || s.status === 'separating')).length,
      total_seats: teamSeats.length,
      vacant: teamSeats.filter(s => !s.person_id).length,
    }
  })

  return NextResponse.json({
    hasSpine,
    industry,
    size,
    country,
    roles,
    openSeats,
    teams: teamsBreakdown,
    ...(verification ? { verification } : {}),
    counts: {
      locations: locations.length,
      teams: teams.length,
      seats: seats.length,
      activeSeats: activeSeats.length,
      vacantSeats: seats.filter(s => s.status === 'vacant' || s.status === 'planned').length,
    },
  })
}
