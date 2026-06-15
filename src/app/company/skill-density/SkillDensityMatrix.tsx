'use client'

// ============================================================================
// SkillDensityMatrix — the interactive Capability Matrix (client component).
//
// Fetches /api/company/skill-density and renders a dense, visual capability
// view:
//   1. A totals strip (skills / holders / teams covered / open vacancies).
//   2. A comparative SEARCH bar that filters the matrix and surfaces a
//      one-line internal-match summary ("2 people in Riyadh Ops match").
//   3. A skills × teams HEATMAP — the org-wide density centrepiece, with
//      violet intensity per cell and key-person-risk (amber) flags.
//   4. SKILL CARDS — strength bars + holder avatar chips, colour-cued by
//      provenance (brain ingestion = violet, delegated work = emerald).
//   5. REDEPLOY panels per open vacancy: ranked internal candidates with a
//      clear "redeploy vs external hire" verdict.
//
// SAMPLE MODE: when the real API returns no skills, we render the exact same
// components against a typed SAMPLE_DATA constant (a fictional UAE
// financial-services org, "Meridian Gulf") and show a clear sample banner.
// No DB / seed scripts are touched — the demo lives entirely in this file.
//
// Tier teaser: if plan_tier !== 'enterprise' we show an upgrade banner but
// still render everything (testing).
// ============================================================================

import { useEffect, useMemo, useState } from 'react'

const VIOLET = '#38BDF8'
const EMERALD = '#34D399'
const AMBER = '#FBBF24'
const CORAL = '#FB7185'
const BG = '#060609'
const CARD = '#0D0C14'
const ACCENT = VIOLET
const HEADING: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }
const BODY: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }
const GRADIENT = 'linear-gradient(135deg, #38BDF8, #34D399)'

type Provenance = 'brain' | 'delegation'

type Holder = {
  seat_id: string
  seat_title: string
  seniority: string | null
  function: string | null
  seat_status: string | null
  person_id: string | null
  person_name: string | null
  team_id: string | null
  team_name: string | null
  location_id: string | null
  location_name: string | null
  sources: Provenance[]
}

type Skill = {
  skill: string
  skill_key: string
  holder_count: number
  holders: Holder[]
}

type Vacancy = {
  seat_id: string
  title: string
  status: string
  seniority: string | null
  function: string | null
  team_id: string | null
  team_name: string | null
  location_id: string | null
  location_name: string | null
  match_tokens: string[]
}

type RosterEntry = {
  seat_id: string
  person_id: string | null
  person_name: string | null
  seat_title: string
  seniority: string | null
  function: string | null
  seat_status: string | null
  team_name: string | null
  location_name: string | null
  skills: string[]
  skill_keys: string[]
}

type ApiData = {
  success: boolean
  plan_tier: string
  is_enterprise: boolean
  company_name: string | null
  skills: Skill[]
  vacancies: Vacancy[]
  roster: RosterEntry[]
  totals: {
    skill_count: number
    holder_seats: number
    open_vacancies: number
    skill_signal_rows: number
  }
}

type Props = { planTier: string; companyName: string }

// ============================================================================
// SAMPLE / DEMO DATA — clearly-labelled fallback for empty orgs.
// A fictional UAE financial-services firm ("Meridian Gulf"). This is NOT real
// data and never touches Supabase; it only renders when the API returns zero
// skills, so the founder can see a populated matrix.
// ============================================================================

type SamplePerson = {
  seatId: string
  name: string
  title: string
  seniority: string
  func: string
  teamId: string
  teamName: string
  locationId: string
  locationName: string
  skills: Array<{ label: string; source: Provenance }>
}

const SAMPLE_COMPANY = 'Meridian Gulf'

function buildSampleData(): ApiData {
  const DUBAI = { id: 'loc-dubai', name: 'Dubai HQ' }
  const RIYADH = { id: 'loc-riyadh', name: 'Riyadh' }
  const T_EXEC = { id: 'team-exec', name: 'Executive' }
  const T_ENG = { id: 'team-eng', name: 'Engineering' }
  const T_SALES = { id: 'team-sales', name: 'Sales' }
  const T_OPS = { id: 'team-ops', name: 'Operations' }

  const people: SamplePerson[] = [
    {
      seatId: 'exec-1', name: 'Layla Haddad', title: 'Chief Executive Officer', seniority: 'exec',
      func: 'Executive', teamId: T_EXEC.id, teamName: T_EXEC.name, locationId: DUBAI.id, locationName: DUBAI.name,
      skills: [
        { label: 'Stakeholder Management', source: 'brain' },
        { label: 'Financial Modeling', source: 'brain' },
        { label: 'Arabic', source: 'brain' },
        { label: 'Compliance', source: 'delegation' },
      ],
    },
    {
      seatId: 'exec-2', name: 'Omar Khalil', title: 'Chief Financial Officer', seniority: 'exec',
      func: 'Executive', teamId: T_EXEC.id, teamName: T_EXEC.name, locationId: DUBAI.id, locationName: DUBAI.name,
      skills: [
        { label: 'Financial Modeling', source: 'brain' },
        { label: 'Compliance', source: 'brain' },
        { label: 'Stakeholder Management', source: 'brain' },
        { label: 'Risk Analytics', source: 'delegation' },
      ],
    },
    {
      seatId: 'eng-1', name: 'Yusuf Rahman', title: 'Staff Engineer', seniority: 'staff',
      func: 'Engineering', teamId: T_ENG.id, teamName: T_ENG.name, locationId: DUBAI.id, locationName: DUBAI.name,
      skills: [
        { label: 'Python', source: 'brain' },
        { label: 'PyTorch', source: 'brain' },
        { label: 'Vector Search', source: 'delegation' },
        { label: 'Data Pipelines', source: 'brain' },
        { label: 'React', source: 'delegation' },
        { label: 'Cloud Infrastructure', source: 'brain' },
      ],
    },
    {
      seatId: 'eng-2', name: 'Aisha Noor', title: 'Senior ML Engineer', seniority: 'senior',
      func: 'Engineering', teamId: T_ENG.id, teamName: T_ENG.name, locationId: DUBAI.id, locationName: DUBAI.name,
      skills: [
        { label: 'Python', source: 'brain' },
        { label: 'PyTorch', source: 'brain' },
        { label: 'Vector Search', source: 'brain' },
        { label: 'Data Pipelines', source: 'delegation' },
      ],
    },
    {
      seatId: 'eng-3', name: 'Karim Saleh', title: 'Frontend Engineer', seniority: 'mid',
      func: 'Engineering', teamId: T_ENG.id, teamName: T_ENG.name, locationId: RIYADH.id, locationName: RIYADH.name,
      skills: [
        { label: 'React', source: 'brain' },
        { label: 'Python', source: 'delegation' },
      ],
    },
    {
      seatId: 'eng-4', name: 'Hana Farouk', title: 'Data Engineer', seniority: 'senior',
      func: 'Engineering', teamId: T_ENG.id, teamName: T_ENG.name, locationId: RIYADH.id, locationName: RIYADH.name,
      skills: [
        { label: 'Python', source: 'brain' },
        { label: 'Data Pipelines', source: 'brain' },
        { label: 'SQL', source: 'brain' },
        { label: 'Cloud Infrastructure', source: 'delegation' },
      ],
    },
    {
      seatId: 'sales-1', name: 'Fatima Zahra', title: 'Sales Director', seniority: 'director',
      func: 'Sales', teamId: T_SALES.id, teamName: T_SALES.name, locationId: DUBAI.id, locationName: DUBAI.name,
      skills: [
        { label: 'Enterprise Sales', source: 'brain' },
        { label: 'Stakeholder Management', source: 'brain' },
        { label: 'Arabic', source: 'brain' },
      ],
    },
    {
      seatId: 'sales-2', name: 'Sami Aziz', title: 'Account Executive', seniority: 'mid',
      func: 'Sales', teamId: T_SALES.id, teamName: T_SALES.name, locationId: RIYADH.id, locationName: RIYADH.name,
      skills: [
        { label: 'Enterprise Sales', source: 'brain' },
        { label: 'Arabic', source: 'brain' },
        { label: 'Stakeholder Management', source: 'delegation' },
      ],
    },
    {
      seatId: 'ops-1', name: 'Noura Al-Otaibi', title: 'Operations Lead', seniority: 'lead',
      func: 'Operations', teamId: T_OPS.id, teamName: T_OPS.name, locationId: RIYADH.id, locationName: RIYADH.name,
      skills: [
        { label: 'Compliance', source: 'brain' },
        { label: 'Stakeholder Management', source: 'brain' },
        { label: 'Arabic', source: 'delegation' },
        { label: 'Financial Modeling', source: 'delegation' },
      ],
    },
    {
      seatId: 'ops-2', name: 'Tariq Mansour', title: 'Operations Analyst', seniority: 'mid',
      func: 'Operations', teamId: T_OPS.id, teamName: T_OPS.name, locationId: RIYADH.id, locationName: RIYADH.name,
      skills: [
        { label: 'Data Pipelines', source: 'brain' },
        { label: 'SQL', source: 'brain' },
        { label: 'Python', source: 'delegation' },
        { label: 'Compliance', source: 'brain' },
      ],
    },
  ]

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

  const skillAgg = new Map<string, { label: string; holders: Holder[] }>()
  for (const p of people) {
    for (const sk of p.skills) {
      const key = norm(sk.label)
      let agg = skillAgg.get(key)
      if (!agg) {
        agg = { label: sk.label, holders: [] }
        skillAgg.set(key, agg)
      }
      agg.holders.push({
        seat_id: p.seatId,
        seat_title: p.title,
        seniority: p.seniority,
        function: p.func,
        seat_status: 'active',
        person_id: `${p.seatId}-p`,
        person_name: p.name,
        team_id: p.teamId,
        team_name: p.teamName,
        location_id: p.locationId,
        location_name: p.locationName,
        sources: [sk.source],
      })
    }
  }

  const skills: Skill[] = Array.from(skillAgg.entries())
    .map(([key, agg]) => ({
      skill: agg.label,
      skill_key: key,
      holder_count: agg.holders.length,
      holders: agg.holders,
    }))
    .sort((a, b) => b.holder_count - a.holder_count || a.skill.localeCompare(b.skill))

  const roster: RosterEntry[] = people.map(p => ({
    seat_id: p.seatId,
    person_id: `${p.seatId}-p`,
    person_name: p.name,
    seat_title: p.title,
    seniority: p.seniority,
    function: p.func,
    seat_status: 'active',
    team_name: p.teamName,
    location_name: p.locationName,
    skills: p.skills.map(s => s.label),
    skill_keys: p.skills.map(s => norm(s.label)),
  }))

  const vacancies: Vacancy[] = [
    {
      seat_id: 'vac-fe',
      title: 'Frontend Engineer',
      status: 'planned',
      seniority: 'mid',
      function: 'Engineering',
      team_id: T_ENG.id,
      team_name: T_ENG.name,
      location_id: DUBAI.id,
      location_name: DUBAI.name,
      match_tokens: ['react', 'python', 'frontend', 'typescript', 'engineer'],
    },
    {
      seat_id: 'vac-ml',
      title: 'Machine Learning Engineer',
      status: 'vacant',
      seniority: 'senior',
      function: 'Engineering',
      team_id: T_ENG.id,
      team_name: T_ENG.name,
      location_id: DUBAI.id,
      location_name: DUBAI.name,
      match_tokens: ['python', 'pytorch', 'vector', 'data', 'pipelines', 'machine', 'learning'],
    },
  ]

  return {
    success: true,
    plan_tier: 'enterprise',
    is_enterprise: true,
    company_name: SAMPLE_COMPANY,
    skills,
    vacancies,
    roster,
    totals: {
      skill_count: skills.length,
      holder_seats: roster.length,
      open_vacancies: vacancies.length,
      skill_signal_rows: 48,
    },
  }
}

const SAMPLE_DATA: ApiData = buildSampleData()

// ============================================================================
// Helpers
// ============================================================================

// Rank internal roster entries against a vacancy by skill-token overlap.
function rankRedeployCandidates(vacancy: Vacancy, roster: RosterEntry[]) {
  const tokens = vacancy.match_tokens.map(t => t.toLowerCase()).filter(t => t.length >= 3)
  if (tokens.length === 0) return []
  return roster
    .map(r => {
      const matched = r.skills.filter(sk => {
        const low = sk.toLowerCase()
        return tokens.some(tok => low.includes(tok))
      })
      const uniqueMatched = Array.from(new Set(matched))
      return { entry: r, overlap: uniqueMatched.length, matched: uniqueMatched }
    })
    .filter(x => x.overlap > 0)
    .filter(x => x.entry.seat_id !== vacancy.seat_id)
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        (a.entry.person_name || a.entry.seat_title).localeCompare(b.entry.person_name || b.entry.seat_title),
    )
}

function initials(name: string | null): string {
  if (!name) return '·'
  const parts = name.split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')
  return letters || '·'
}

function teamLabel(h: Pick<Holder, 'team_name'>): string {
  return h.team_name || 'Unassigned'
}

// ============================================================================
// Main component
// ============================================================================

export default function SkillDensityMatrix({ planTier, companyName }: Props) {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/company/skill-density')
      .then(async r => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j?.error || `Request failed (${r.status})`)
        return j as ApiData
      })
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // When the real org has no detected skills yet, render the SAMPLE org so the
  // matrix is never an empty shell. The banner makes the swap explicit.
  const isSample = !!data && data.skills.length === 0
  const view: ApiData | null = data ? (isSample ? SAMPLE_DATA : data) : null

  const q = query.trim().toLowerCase()

  const filteredSkills = useMemo(() => {
    if (!view) return []
    if (!q) return view.skills
    return view.skills.filter(sk => {
      if (sk.skill.toLowerCase().includes(q)) return true
      return sk.holders.some(h =>
        (h.person_name || '').toLowerCase().includes(q) ||
        (h.location_name || '').toLowerCase().includes(q) ||
        (h.team_name || '').toLowerCase().includes(q) ||
        (h.seat_title || '').toLowerCase().includes(q),
      )
    })
  }, [view, q])

  // Stable column order for the heatmap: teams sorted by workforce size.
  const teams = useMemo(() => {
    if (!view) return []
    const teamSeats = new Map<string, Set<string>>()
    for (const sk of view.skills) {
      for (const h of sk.holders) {
        const t = teamLabel(h)
        if (!teamSeats.has(t)) teamSeats.set(t, new Set())
        teamSeats.get(t)!.add(h.seat_id)
      }
    }
    return Array.from(teamSeats.entries())
      .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
      .map(([name]) => name)
  }, [view])

  const maxHolders = useMemo(
    () => view ? view.skills.reduce((m, s) => Math.max(m, s.holder_count), 0) : 0,
    [view],
  )

  // Per skill, distinct holder seats per team — drives heatmap intensity.
  const cellCount = (sk: Skill, team: string) => {
    const set = new Set<string>()
    for (const h of sk.holders) if (teamLabel(h) === team) set.add(h.seat_id)
    return set.size
  }

  const maxCell = useMemo(() => {
    let m = 0
    for (const sk of filteredSkills) for (const t of teams) m = Math.max(m, cellCount(sk, t))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSkills, teams])

  const riskCount = useMemo(
    () => view ? view.skills.filter(s => s.holder_count === 1).length : 0,
    [view],
  )

  const matchSummary = useMemo(() => {
    if (!view || !q) return null
    const seatIds = new Set<string>()
    const byLocation = new Map<string, Set<string>>()
    for (const sk of filteredSkills) {
      if (!sk.skill.toLowerCase().includes(q)) continue
      for (const h of sk.holders) {
        if (!h.person_name) continue
        seatIds.add(h.seat_id)
        const loc = h.location_name || 'Unassigned location'
        if (!byLocation.has(loc)) byLocation.set(loc, new Set())
        byLocation.get(loc)!.add(h.seat_id)
      }
    }
    if (seatIds.size === 0) return null
    const parts = Array.from(byLocation.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .map(([loc, set]) => `${set.size} in ${loc}`)
    return { total: seatIds.size, parts }
  }, [view, q, filteredSkills])

  const showTeaser = planTier !== 'enterprise'

  if (loading) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-sm" style={BODY}>Mapping capability density…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${CORAL}4D` }}>
        <p className="text-sm font-bold mb-1" style={{ color: CORAL }}>Couldn&apos;t load skill density</p>
        <p className="text-xs" style={BODY}>{error}</p>
      </div>
    )
  }

  if (!view) return null

  const teamCount = teams.length
  const gridTemplate = `minmax(150px, 1.7fr) repeat(${teamCount}, minmax(64px, 1fr)) minmax(104px, 1fr)`

  return (
    <div className="space-y-6">
      {isSample && (
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(56, 189, 248,0.08)', border: `1px solid ${VIOLET}40` }}
        >
          <span
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base font-black"
            style={{ background: GRADIENT, color: BG }}
          >
            ✨
          </span>
          <div>
            <p className="text-sm font-bold" style={HEADING}>
              Sample data — showing a fictional org ({SAMPLE_COMPANY})
            </p>
            <p className="text-xs mt-0.5" style={BODY}>
              This is a preview with demo skills. Connect <span style={{ color: 'rgba(255,255,255,0.85)' }}>Company Brain</span>{' '}
              &amp; <span style={{ color: 'rgba(255,255,255,0.85)' }}>Delegation</span> to populate this matrix with{' '}
              {companyName}&apos;s real workforce.
            </p>
          </div>
        </div>
      )}

      {showTeaser && (
        <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(251,191,36,0.08)', border: `1px solid ${AMBER}40`, color: AMBER }}>
          <strong>Enterprise feature.</strong> The Capability Matrix + internal redeployment engine is part of
          the Enterprise plan ($2,500–12,000/mo, scaled to workforce size). You&apos;re on{' '}
          <span style={{ textTransform: 'capitalize' }}>{planTier}</span> —{' '}
          <a href="/company/pricing" className="font-black underline">see plans</a>.{' '}
          <span style={{ opacity: 0.8 }}>(Rendered below for testing.)</span>
        </div>
      )}

      {/* ---- Totals strip ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Skills detected" value={view.totals.skill_count} />
        <Stat label="People with skills" value={view.totals.holder_seats} />
        <Stat label="Teams covered" value={teamCount} />
        <Stat label="Open vacancies" value={view.totals.open_vacancies} accent={view.totals.open_vacancies > 0 ? CORAL : undefined} />
      </div>

      {/* ---- Comparative search bar ---- */}
      <div className="rounded-2xl p-5" style={{ background: CARD, border: `1px solid ${ACCENT}30` }}>
        <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: ACCENT }}>
          Compare a vacancy or skill
        </label>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. machine learning, Python, Riyadh, financial modeling…"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: BG, border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}
        />
        {view.vacancies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider self-center" style={BODY}>Quick fill:</span>
            {view.vacancies.slice(0, 6).map(v => (
              <button
                key={v.seat_id}
                onClick={() => setQuery(v.title)}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-opacity hover:opacity-80"
                style={{ background: 'rgba(56, 189, 248, 0.12)', color: ACCENT }}
              >
                {v.title}
              </button>
            ))}
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
              >
                Clear
              </button>
            )}
          </div>
        )}
        {matchSummary && (
          <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.08)', border: `1px solid ${EMERALD}40` }}>
            <p className="text-sm font-bold" style={{ color: EMERALD }}>
              {matchSummary.total} internal {matchSummary.total === 1 ? 'person' : 'people'} already match
            </p>
            <p className="text-xs mt-0.5" style={BODY}>
              {matchSummary.parts.join(' · ')} — redeploy before you rehire.
            </p>
          </div>
        )}
      </div>

      {/* ---- Capability heatmap (skills × teams) ---- */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-sm font-black uppercase tracking-wider" style={HEADING}>
            Capability matrix
          </h2>
          <div className="flex items-center gap-3 text-[10px]" style={BODY}>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: `rgba(56, 189, 248,0.8)` }} /> dense
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: `rgba(56, 189, 248,0.16)` }} /> thin
            </span>
            {riskCount > 0 && (
              <span className="inline-flex items-center gap-1.5" style={{ color: AMBER }}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: AMBER }} /> {riskCount} key-person risk{riskCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        {filteredSkills.length === 0 ? (
          <div className="rounded-xl p-5 text-sm" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.06)', ...BODY }}>
            No skills match “{query}”. Try a broader term.
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="overflow-x-auto">
              <div style={{ minWidth: 360 }}>
                {/* Header row */}
                <div className="grid items-stretch" style={{ gridTemplateColumns: gridTemplate }}>
                  <div
                    className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider sticky left-0 z-10"
                    style={{ ...BODY, background: CARD }}
                  >
                    Skill
                  </div>
                  {teams.map(t => (
                    <div key={t} className="px-2 py-3 text-[10px] font-bold uppercase tracking-wider text-center truncate" style={BODY} title={t}>
                      {t}
                    </div>
                  ))}
                  <div className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-right" style={BODY}>
                    Coverage
                  </div>
                </div>

                {filteredSkills.map((sk, i) => {
                  const isRisk = sk.holder_count === 1
                  return (
                    <div
                      key={sk.skill_key}
                      className="grid items-center"
                      style={{
                        gridTemplateColumns: gridTemplate,
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        background: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                      }}
                    >
                      <div className="px-4 py-2.5 sticky left-0 z-10 flex items-center gap-2" style={{ background: i % 2 === 1 ? '#0E0D16' : CARD }}>
                        {isRisk && <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: AMBER }} title="Key-person risk — only one holder" />}
                        <span className="text-sm font-bold truncate" style={HEADING} title={sk.skill}>{sk.skill}</span>
                      </div>
                      {teams.map(t => {
                        const c = cellCount(sk, t)
                        const alpha = c === 0 ? 0 : 0.16 + 0.64 * (maxCell ? c / maxCell : 0)
                        return (
                          <div key={t} className="px-2 py-2 flex justify-center">
                            <span
                              className="w-full max-w-[44px] h-9 rounded-lg flex items-center justify-center text-xs font-black"
                              style={{
                                background: c === 0 ? 'rgba(255,255,255,0.02)' : `rgba(56, 189, 248,${alpha})`,
                                color: c === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.95)',
                                border: c === 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                              }}
                            >
                              {c === 0 ? '·' : c}
                            </span>
                          </div>
                        )
                      })}
                      <div className="px-3 py-2.5 flex items-center justify-end gap-2">
                        <span className="h-1.5 rounded-full" style={{ width: 44, background: 'rgba(255,255,255,0.06)' }}>
                          <span
                            className="block h-1.5 rounded-full"
                            style={{ width: `${maxHolders ? (sk.holder_count / maxHolders) * 100 : 0}%`, background: isRisk ? AMBER : GRADIENT }}
                          />
                        </span>
                        <span className="text-xs font-black tabular-nums w-4 text-right" style={{ color: isRisk ? AMBER : 'rgba(255,255,255,0.9)' }}>
                          {sk.holder_count}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ---- Skill detail cards (strength bars + holder chips) ---- */}
      {filteredSkills.length > 0 && (
        <section>
          <h2 className="text-sm font-black uppercase tracking-wider mb-3" style={HEADING}>
            Who holds what
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filteredSkills.map(sk => (
              <SkillCard key={sk.skill_key} skill={sk} maxHolders={maxHolders} />
            ))}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-[10px]" style={BODY}>
            <LegendDot color={VIOLET} label="Skill from brain ingestion" />
            <LegendDot color={EMERALD} label="Skill from delegated work" />
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: AMBER }} /> Key-person risk (1 holder)
            </span>
          </div>
        </section>
      )}

      {/* ---- Redeploy panels per open vacancy ---- */}
      {view.vacancies.length > 0 && (
        <section>
          <h2 className="text-sm font-black uppercase tracking-wider mb-3" style={HEADING}>
            Redeploy before you rehire
          </h2>
          <div className="space-y-3">
            {view.vacancies.map(v => {
              const ranked = rankRedeployCandidates(v, view.roster)
              const hasMatch = ranked.length > 0
              return (
                <div key={v.seat_id} className="rounded-2xl p-5" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-base font-black" style={HEADING}>{v.title}</h3>
                        <StatusPill status={v.status} />
                      </div>
                      <p className="text-xs" style={BODY}>
                        {[v.seniority, v.function, v.team_name, v.location_name].filter(Boolean).join(' · ') || 'No location set'}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={
                        hasMatch
                          ? { background: 'rgba(52,211,153,0.14)', color: EMERALD }
                          : { background: 'rgba(251,113,133,0.14)', color: CORAL }
                      }
                    >
                      {hasMatch ? `${ranked.length} redeploy ${ranked.length === 1 ? 'option' : 'options'}` : 'External hire likely'}
                    </span>
                  </div>

                  {!hasMatch ? (
                    <p className="text-xs" style={BODY}>
                      No internal skill overlap detected yet — this seat likely needs an external hire,
                      or more workforce skill signal (brain ingestion / delegated work).
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {ranked.slice(0, 6).map(({ entry, overlap, matched }, idx) => (
                        <div
                          key={entry.seat_id}
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ background: BG, border: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          <span
                            className="flex-shrink-0 text-[10px] font-black w-5 text-center"
                            style={{ color: idx === 0 ? EMERALD : 'rgba(255,255,255,0.35)' }}
                          >
                            #{idx + 1}
                          </span>
                          <Avatar name={entry.person_name || entry.seat_title} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold truncate" style={HEADING}>
                              {entry.person_name || entry.seat_title}
                            </p>
                            <p className="text-[11px] mb-1.5 truncate" style={BODY}>
                              {[entry.person_name ? entry.seat_title : null, entry.team_name, entry.location_name].filter(Boolean).join(' · ')}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {matched.map(m => (
                                <span key={m} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.12)', color: EMERALD }}>
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="text-[11px] font-black whitespace-nowrap" style={{ color: EMERALD }}>
                            {overlap} {overlap === 1 ? 'skill' : 'skills'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

// ============================================================================
// Presentational components
// ============================================================================

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-2xl font-black" style={{ color: accent || 'rgba(255,255,255,0.9)' }}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={BODY}>{label}</p>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function Avatar({ name, vacant }: { name: string | null; vacant?: boolean }) {
  return (
    <span
      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black"
      style={
        vacant
          ? { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px dashed rgba(255,255,255,0.2)' }
          : { background: GRADIENT, color: BG }
      }
      title={name || 'Vacant seat'}
    >
      {initials(name)}
    </span>
  )
}

function StatusPill({ status }: { status: string | null }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    planned: { bg: 'rgba(56, 189, 248, 0.15)', fg: ACCENT, label: 'Planned' },
    vacant: { bg: 'rgba(251,113,133,0.15)', fg: CORAL, label: 'Vacant' },
    active: { bg: 'rgba(52,211,153,0.15)', fg: EMERALD, label: 'Active' },
  }
  const s = (status && map[status]) || { bg: 'rgba(156,163,175,0.15)', fg: 'rgba(255,255,255,0.5)', label: status || '—' }
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  )
}

function SkillCard({ skill, maxHolders }: { skill: Skill; maxHolders: number }) {
  const isRisk = skill.holder_count === 1
  const wellCovered = skill.holder_count >= 3
  const pct = maxHolders ? (skill.holder_count / maxHolders) * 100 : 0

  const verdict = isRisk
    ? { label: 'Key-person risk', bg: 'rgba(251,191,36,0.14)', fg: AMBER }
    : wellCovered
      ? { label: 'Well covered', bg: 'rgba(52,211,153,0.14)', fg: EMERALD }
      : { label: 'Covered', bg: 'rgba(56, 189, 248,0.14)', fg: VIOLET }

  return (
    <div className="rounded-xl p-4" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-bold truncate" style={HEADING} title={skill.skill}>{skill.skill}</h3>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: verdict.bg, color: verdict.fg }}>
          {verdict.label}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="h-1.5 flex-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <span className="block h-1.5 rounded-full" style={{ width: `${pct}%`, background: isRisk ? AMBER : GRADIENT }} />
        </span>
        <span className="text-[11px] font-black whitespace-nowrap" style={{ color: isRisk ? AMBER : ACCENT }}>
          {skill.holder_count} {skill.holder_count === 1 ? 'holder' : 'holders'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {skill.holders.map(h => (
          <HolderChip key={h.seat_id} holder={h} />
        ))}
      </div>
    </div>
  )
}

function HolderChip({ holder }: { holder: Holder }) {
  const fromBrain = holder.sources.includes('brain')
  const fromDelegation = holder.sources.includes('delegation')
  // Border colour cues provenance: delegation (verified-through-work) tints
  // emerald; otherwise violet (brain ingestion).
  const borderColor = fromDelegation && !fromBrain ? EMERALD : VIOLET
  const isVacant = !holder.person_name
  const name = holder.person_name || `${holder.seat_title} (vacant — inherited)`
  const context = [holder.person_name ? holder.seat_title : null, holder.location_name].filter(Boolean).join(' · ')
  return (
    <span
      className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full"
      style={{ background: BG, border: `1px solid ${borderColor}55`, opacity: isVacant ? 0.7 : 1 }}
      title={`${name}${context ? ` — ${context}` : ''} · source: ${holder.sources.join(' + ')}`}
    >
      <Avatar name={holder.person_name} vacant={isVacant} />
      <span className="flex flex-col leading-tight min-w-0">
        <span className="text-xs font-bold truncate max-w-[120px]" style={{ color: 'rgba(255,255,255,0.9)' }}>{name}</span>
        {context && <span className="text-[10px] truncate max-w-[120px]" style={BODY}>{context}</span>}
      </span>
      <span className="flex gap-1 ml-0.5">
        {fromBrain && <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: VIOLET }} title="brain ingestion" />}
        {fromDelegation && <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: EMERALD }} title="delegated work" />}
      </span>
    </span>
  )
}
