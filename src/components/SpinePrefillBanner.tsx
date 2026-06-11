'use client'

// Shared "✨ Use your org spine data" banner used by every sub-product that
// can pre-fill its inputs from /company/spine. The v4 data-loop value prop
// in a single component:
//   fill the spine once → every tool reads from it.
//
// USAGE:
//   const { spine, applied, apply } = useSpinePrefill()
//   useEffect(() => {
//     if (applied && spine) { setIndustry(spine.industry); ... }
//   }, [applied, spine])
//
//   <SpinePrefillBanner spine={spine} applied={applied} onApply={apply}
//     fieldsLabel="industry, size, country, headcount" />

import { useCallback, useEffect, useState } from 'react'

export type SpinePrefillData = {
  hasSpine: boolean
  industry: string
  size: string
  country: string
  roles: { role: string; dept: string; count: string }[]
  /**
   * Open seats = the hiring list (roles_seats WHERE status IN ('planned',
   * 'vacant')). Consumed by Hiring Roadmap / Hiring Plan — this set IS the
   * roadmap, so the user doesn't retype roles already laid out on the spine.
   */
  openSeats?: {
    title: string
    dept: string
    seniority: string
    status: 'planned' | 'vacant'
  }[]
  /** Per-team rollup — consumed by Cognitive Load to seed team rows. */
  teams?: {
    name: string
    function: string | null
    headcount: number
    total_seats: number
    vacant: number
  }[]
  /**
   * VERIFIED ORG stats (supabase/verified_org.sql). Omitted by the API until
   * the founder runs the migration — render nothing when absent. When present,
   * the Snapshot cites "based on {verified_pct}% verified org data".
   */
  verification?: {
    verified_seats: number
    occupied_seats: number
    verified_pct: number
  }
  counts: {
    locations: number
    teams: number
    seats: number
    activeSeats: number
    vacantSeats: number
  }
}

export function useSpinePrefill() {
  const [spine, setSpine] = useState<SpinePrefillData | null>(null)
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    fetch('/api/company/spine/snapshot-prefill')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.hasSpine) setSpine(d) })
      .catch(() => { /* user might not have a spine yet — silent */ })
  }, [])

  const apply = useCallback(() => setApplied(true), [])
  return { spine, applied, apply }
}

type Props = {
  spine: SpinePrefillData | null
  applied: boolean
  onApply: () => void
  /** One-line summary of what fields will populate, shown to the user. */
  fieldsLabel: string
}

export default function SpinePrefillBanner({ spine, applied, onApply, fieldsLabel }: Props) {
  if (!spine?.hasSpine) return null

  const accent = applied ? '#34D399' : '#9D8CFF'
  const accentBg = applied ? 'rgba(52,211,153,0.08)' : 'rgba(157, 140, 255, 0.08)'
  const accentBorder = applied ? 'rgba(52,211,153,0.30)' : 'rgba(157, 140, 255, 0.30)'

  return (
    <div
      className="rounded-2xl p-4 mb-4"
      style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-black mb-0.5" style={{ color: accent }}>
            {applied ? '✓ Filled from your org spine' : '✨ Use your org spine data'}
          </p>
          <p className="text-xs text-[#A6A6B4]">
            {spine.counts.locations} location{spine.counts.locations === 1 ? '' : 's'} ·{' '}
            {spine.counts.teams} team{spine.counts.teams === 1 ? '' : 's'} ·{' '}
            {spine.counts.activeSeats} filled / {spine.counts.vacantSeats} vacant seats.
            {applied ? ' Edit anything below.' : ` ${fieldsLabel} will pre-fill.`}
          </p>
          {/* VERIFIED ORG citation — only when the API returns stats (i.e. the
              migration has run). The data-loop trust line. */}
          {spine.verification && (
            spine.verification.verified_pct > 0 ? (
              <p className="text-xs mt-1 font-bold" style={{ color: '#9D8CFF' }}>
                ✓ Based on {spine.verification.verified_pct}% verified org data
                ({spine.verification.verified_seats} of {spine.verification.occupied_seats} seats
                confirmed by employees).
              </p>
            ) : (
              <p className="text-xs mt-1" style={{ color: '#FBBF24' }}>
                0% verified — send seat confirmations from your org spine to raise confidence.
              </p>
            )
          )}
        </div>
        {!applied && (
          <button
            type="button"
            onClick={onApply}
            className="text-xs font-black px-4 py-2 rounded-full whitespace-nowrap"
            style={{ background: '#9D8CFF', color: '#fff' }}
          >
            Pre-fill now
          </button>
        )}
      </div>
    </div>
  )
}
