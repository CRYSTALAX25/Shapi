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

  const accent = applied ? '#34D399' : '#6AA8F5'
  const accentBg = applied ? 'rgba(52,211,153,0.08)' : 'rgba(106,168,245,0.08)'
  const accentBorder = applied ? 'rgba(52,211,153,0.30)' : 'rgba(106,168,245,0.30)'

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
        </div>
        {!applied && (
          <button
            type="button"
            onClick={onApply}
            className="text-xs font-black px-4 py-2 rounded-full whitespace-nowrap"
            style={{ background: '#6AA8F5', color: '#fff' }}
          >
            Pre-fill now
          </button>
        )}
      </div>
    </div>
  )
}
