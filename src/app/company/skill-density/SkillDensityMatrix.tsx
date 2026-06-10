'use client'

// ============================================================================
// SkillDensityMatrix — the interactive Capability Matrix (client component).
//
// Fetches /api/company/skill-density and renders:
//   1. A comparative SEARCH bar: type a skill or vacancy → the matrix filters
//      to matching skills and highlights internal holders ("2 people in Riyadh
//      Ops match this open Data Analyst seat").
//   2. The CAPABILITY MATRIX: rows = skills, each row carries chips for the
//      people/seats who hold it (name · current seat · location), colour-cued
//      by provenance (brain ingestion vs delegated-deliverable extraction).
//   3. For each OPEN vacancy, a "Redeploy candidates" panel listing internal
//      people whose detected skills overlap the vacancy's needs, ranked by
//      overlap count.
//   4. A polished EMPTY STATE explaining how density populates when no skills
//      have been detected yet (tables unseeded).
//
// Tier teaser: if plan_tier !== 'enterprise' we show an upgrade banner but
// still render everything (testing).
// ============================================================================

import { useEffect, useMemo, useState } from 'react'

const ACCENT = '#7c93f5'
const HEADING: React.CSSProperties = { color: '#f4f6f9' }
const BODY: React.CSSProperties = { color: '#9ca3af' }
const CARD = '#13161b'

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

// Rank internal roster entries against a vacancy by skill-token overlap.
// A skill "matches" a vacancy if any of the vacancy's match_tokens appears in
// the skill label (substring, case-insensitive) — cheap, transparent, and good
// enough for "who already does this work".
function rankRedeployCandidates(vacancy: Vacancy, roster: RosterEntry[]) {
  const tokens = vacancy.match_tokens.map(t => t.toLowerCase()).filter(t => t.length >= 3)
  if (tokens.length === 0) return []
  const ranked = roster
    .map(r => {
      const matched = r.skills.filter(sk => {
        const low = sk.toLowerCase()
        return tokens.some(tok => low.includes(tok))
      })
      // de-dupe matched skill labels
      const uniqueMatched = Array.from(new Set(matched))
      return { entry: r, overlap: uniqueMatched.length, matched: uniqueMatched }
    })
    .filter(x => x.overlap > 0)
    // Don't suggest redeploying someone into the very seat they already hold.
    .filter(x => x.entry.seat_id !== vacancy.seat_id)
    .sort((a, b) => b.overlap - a.overlap || (a.entry.person_name || a.entry.seat_title).localeCompare(b.entry.person_name || b.entry.seat_title))
  return ranked
}

function StatusPill({ status }: { status: string | null }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    planned: { bg: 'rgba(124,147,245,0.15)', fg: ACCENT, label: 'Planned' },
    vacant: { bg: 'rgba(251,113,133,0.15)', fg: '#FB7185', label: 'Vacant' },
    active: { bg: 'rgba(52,211,153,0.15)', fg: '#34D399', label: 'Active' },
  }
  const s = (status && map[status]) || { bg: 'rgba(156,163,175,0.15)', fg: '#9ca3af', label: status || '—' }
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  )
}

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

  const q = query.trim().toLowerCase()

  // Filter the matrix by the comparative search. A skill matches if its label,
  // any holder's location/team/name, matches the query.
  const filteredSkills = useMemo(() => {
    if (!data) return []
    if (!q) return data.skills
    return data.skills.filter(sk => {
      if (sk.skill.toLowerCase().includes(q)) return true
      return sk.holders.some(h =>
        (h.person_name || '').toLowerCase().includes(q) ||
        (h.location_name || '').toLowerCase().includes(q) ||
        (h.team_name || '').toLowerCase().includes(q) ||
        (h.seat_title || '').toLowerCase().includes(q)
      )
    })
  }, [data, q])

  // When searching, surface a one-line internal-match summary grouped by
  // location: "2 people in Riyadh Ops match" — the redeployment hook.
  const matchSummary = useMemo(() => {
    if (!data || !q) return null
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
  }, [data, q, filteredSkills])

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
      <div className="rounded-2xl p-6" style={{ background: CARD, border: '1px solid rgba(251,113,133,0.3)' }}>
        <p className="text-sm font-bold mb-1" style={{ color: '#FB7185' }}>Couldn&apos;t load skill density</p>
        <p className="text-xs" style={BODY}>{error}</p>
      </div>
    )
  }

  if (!data) return null

  const hasData = data.skills.length > 0

  return (
    <div className="space-y-6">
      {showTeaser && (
        <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#FBBF24' }}>
          <strong>Enterprise feature.</strong> The Capability Matrix + internal redeployment engine is part of
          the Enterprise plan ($2,500–5,000/mo). You&apos;re on{' '}
          <span style={{ textTransform: 'capitalize' }}>{planTier}</span> —{' '}
          <a href="/company/pricing" className="font-black underline">see plans</a>.{' '}
          <span style={{ opacity: 0.8 }}>(Rendered below for testing.)</span>
        </div>
      )}

      {/* ---- Totals strip ---- */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Skills detected" value={data.totals.skill_count} />
        <Stat label="People holding skills" value={data.totals.holder_seats} />
        <Stat label="Open vacancies" value={data.totals.open_vacancies} accent="#FB7185" />
      </div>

      {!hasData ? (
        <EmptyState companyName={companyName} signalRows={data.totals.skill_signal_rows} />
      ) : (
        <>
          {/* ---- Comparative search bar ---- */}
          <div className="rounded-2xl p-5" style={{ background: CARD, border: `1px solid ${ACCENT}30` }}>
            <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block" style={{ color: ACCENT }}>
              Compare a vacancy or skill
            </label>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. data analyst, SQL, Riyadh, financial modelling…"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: '#0c0e11', border: '1px solid rgba(255,255,255,0.1)', color: '#f4f6f9' }}
            />
            {data.vacancies.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider self-center" style={BODY}>Quick fill:</span>
                {data.vacancies.slice(0, 6).map(v => (
                  <button
                    key={v.seat_id}
                    onClick={() => setQuery(v.title)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(124,147,245,0.12)', color: ACCENT }}
                  >
                    {v.title}
                  </button>
                ))}
              </div>
            )}
            {matchSummary && (
              <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
                <p className="text-sm font-bold" style={{ color: '#34D399' }}>
                  {matchSummary.total} internal {matchSummary.total === 1 ? 'person' : 'people'} already match
                </p>
                <p className="text-xs mt-0.5" style={BODY}>
                  {matchSummary.parts.join(' · ')} — redeploy before you rehire.
                </p>
              </div>
            )}
          </div>

          {/* ---- Capability matrix ---- */}
          <section>
            <h2 className="text-sm font-black uppercase tracking-wider mb-3" style={HEADING}>
              Capability matrix
            </h2>
            <div className="space-y-2">
              {filteredSkills.length === 0 ? (
                <div className="rounded-xl p-5 text-sm" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.06)', ...BODY }}>
                  No skills match “{query}”. Try a broader term.
                </div>
              ) : (
                filteredSkills.map(sk => (
                  <div key={sk.skill_key} className="rounded-xl p-4" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center justify-between mb-2.5 gap-3">
                      <h3 className="text-sm font-bold" style={HEADING}>{sk.skill}</h3>
                      <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: ACCENT }}>
                        {sk.holder_count} {sk.holder_count === 1 ? 'holder' : 'holders'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sk.holders.map(h => (
                        <HolderChip key={h.seat_id} holder={h} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-[10px]" style={BODY}>
              <LegendDot color={ACCENT} label="Skill from brain ingestion" />
              <LegendDot color="#A78BFA" label="Skill from delegated work" />
            </div>
          </section>

          {/* ---- Redeploy panels per open vacancy ---- */}
          {data.vacancies.length > 0 && (
            <section>
              <h2 className="text-sm font-black uppercase tracking-wider mb-3" style={HEADING}>
                Redeploy before you rehire
              </h2>
              <div className="space-y-3">
                {data.vacancies.map(v => {
                  const ranked = rankRedeployCandidates(v, data.roster)
                  return (
                    <div key={v.seat_id} className="rounded-2xl p-5" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-black" style={HEADING}>{v.title}</h3>
                            <StatusPill status={v.status} />
                          </div>
                          <p className="text-xs" style={BODY}>
                            {[v.seniority, v.function, v.team_name, v.location_name].filter(Boolean).join(' · ') || 'No location set'}
                          </p>
                        </div>
                        <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: ranked.length ? '#34D399' : '#9ca3af' }}>
                          {ranked.length} internal {ranked.length === 1 ? 'match' : 'matches'}
                        </span>
                      </div>

                      {ranked.length === 0 ? (
                        <p className="text-xs" style={BODY}>
                          No internal skill overlap detected yet — this seat likely needs an external hire,
                          or more workforce skill signal (brain ingestion / delegated work).
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {ranked.slice(0, 6).map(({ entry, overlap, matched }) => (
                            <div key={entry.seat_id} className="flex items-start justify-between gap-3 p-3 rounded-xl" style={{ background: '#0c0e11', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate" style={HEADING}>
                                  {entry.person_name || entry.seat_title}
                                </p>
                                <p className="text-[11px] mb-1.5" style={BODY}>
                                  {[entry.seat_title !== entry.person_name ? entry.seat_title : null, entry.team_name, entry.location_name].filter(Boolean).join(' · ')}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {matched.map(m => (
                                    <span key={m} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399' }}>
                                      {m}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <span className="text-[11px] font-black whitespace-nowrap" style={{ color: '#34D399' }}>
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
        </>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-2xl font-black" style={{ color: accent || '#f4f6f9' }}>{value}</p>
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

function HolderChip({ holder }: { holder: Holder }) {
  const fromBrain = holder.sources.includes('brain')
  const fromDelegation = holder.sources.includes('delegation')
  // Border colour cues provenance; delegation tints purple, brain tints accent.
  const borderColor = fromDelegation && !fromBrain ? '#A78BFA' : ACCENT
  const isVacant = !holder.person_name
  const name = holder.person_name || `${holder.seat_title} (vacant — inherited)`
  const context = [holder.person_name ? holder.seat_title : null, holder.location_name]
    .filter(Boolean)
    .join(' · ')
  return (
    <span
      className="inline-flex flex-col px-3 py-1.5 rounded-lg"
      style={{
        background: '#0c0e11',
        border: `1px solid ${borderColor}55`,
        opacity: isVacant ? 0.7 : 1,
      }}
      title={`${name}${context ? ` — ${context}` : ''} · source: ${holder.sources.join(' + ')}`}
    >
      <span className="text-xs font-bold leading-tight" style={{ color: '#f4f6f9' }}>{name}</span>
      {context && <span className="text-[10px] leading-tight" style={BODY}>{context}</span>}
      <span className="flex gap-1 mt-0.5">
        {fromBrain && <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} title="brain ingestion" />}
        {fromDelegation && <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#A78BFA' }} title="delegated work" />}
      </span>
    </span>
  )
}

function EmptyState({ companyName, signalRows }: { companyName: string; signalRows: number }) {
  return (
    <div className="rounded-2xl p-7" style={{ background: CARD, border: `1px dashed ${ACCENT}40` }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: ACCENT }}>
        No skill density yet
      </p>
      <h2 className="text-xl font-black mb-3" style={HEADING}>
        {companyName}&apos;s capability map is still empty
      </h2>
      <p className="text-sm leading-relaxed mb-5" style={BODY}>
        Skill density isn&apos;t something you type in — Shapi <span style={{ color: '#f4f6f9' }}>detects</span> it
        as work flows through your org. Two signals feed the matrix:
      </p>

      <div className="space-y-3 mb-5">
        <div className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black" style={{ background: 'rgba(124,147,245,0.15)', color: ACCENT }}>1</span>
          <div>
            <p className="text-sm font-bold" style={HEADING}>Delegated-deliverable extraction</p>
            <p className="text-xs leading-relaxed" style={BODY}>
              When someone covers another seat&apos;s work (leave coverage, a project loan, a redeployment
              trial), Shapi reads the deliverables they produce and records the skills they demonstrated —
              anchored to the seat that earned them.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black" style={{ background: 'rgba(167,139,250,0.15)', color: '#A78BFA' }}>2</span>
          <div>
            <p className="text-sm font-bold" style={HEADING}>Company Brain ingestion</p>
            <p className="text-xs leading-relaxed" style={BODY}>
              As documents, threads and meeting transcripts are ingested into the Company Brain, each chunk
              is scored for the skills it demonstrates — building a verified capability picture per seat,
              not per CV claim.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl" style={{ background: '#0c0e11', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs" style={BODY}>
          Once those signals start flowing, this page becomes your internal redeployment engine: type any
          open vacancy and see exactly who inside the company already does that work.{' '}
          {signalRows > 0
            ? `(${signalRows} skill-signal ${signalRows === 1 ? 'row' : 'rows'} ingested so far, but none have detected skills yet.)`
            : '(No skill-signal rows ingested yet.)'}
        </p>
      </div>
    </div>
  )
}
