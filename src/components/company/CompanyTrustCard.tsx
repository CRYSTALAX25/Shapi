// Candidate-facing company trust card. Renders the anonymous, aggregated
// employee culture score (Plane B) so a candidate can vet an employer before
// applying. Fed directly from getCultureAggregate's CultureAggregate shape.
//
// Brand: ocean-emerald tokens, inline SVG (no icon lib). Presentational only —
// no hooks/state, so it renders server-side.

import { MIN_RESPONSES, type CultureAggregate } from '@/lib/culture-references'

const OCEAN = '#38BDF8'
const EMERALD = '#34D399'
const GRAD = `linear-gradient(90deg, ${OCEAN}, ${EMERALD})`

// The 8 sub-dimensions shown as bars (would_recommend is the headline; overall
// is the big number). Order = most-tangible first.
const DIMENSIONS: { key: keyof CultureAggregate; label: string }[] = [
  { key: 'paid_on_time', label: 'Paid on time' },
  { key: 'hours_respected', label: 'Hours respected' },
  { key: 'manager_quality', label: 'Manager quality' },
  { key: 'promise_kept', label: 'Promise kept (offer vs reality)' },
  { key: 'respect_safety', label: 'Respect & psychological safety' },
  { key: 'growth', label: 'Growth & recognition' },
  { key: 'fair_treatment', label: 'Fair treatment' },
  { key: 'exit_handled', label: 'Exit handled well' },
]

export default function CompanyTrustCard({
  companyName,
  aggregate,
  glassdoor,
}: {
  companyName: string
  aggregate: CultureAggregate
  glassdoor?: number | null
}) {
  const cardStyle = {
    background: '#0d0d14',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)',
  } as const

  // Locked state — below the anonymity floor: the company-side score is hidden
  // until MIN_RESPONSES trusted employees have answered, protecting identities.
  const live = typeof aggregate.overall === 'number'

  if (!live) {
    const remaining = Math.max(MIN_RESPONSES - aggregate.count, 1)
    return (
      <div className="w-full max-w-md rounded-2xl p-6" style={cardStyle}>
        <div className="flex items-center gap-2 mb-4">
          <LockIcon />
          <h3 className="text-sm font-bold text-[#C7C7D1] tracking-tight">Workplace trust · {companyName}</h3>
        </div>
        <p className="text-[#F4F4F7] text-sm font-bold mb-1">Trust score activates soon</p>
        <p className="text-[#7E7E8E] text-xs leading-relaxed">
          Shapi independently surveys current &amp; former employees of {companyName}.
          The score appears once at least {MIN_RESPONSES} have responded
          {aggregate.count > 0 ? ` — ${remaining} more to go` : ''} — so no single
          person can ever be identified.
        </p>
        {/* Skeleton hint of the live layout */}
        <div className="mt-5 space-y-2.5 opacity-20 pointer-events-none" aria-hidden>
          {DIMENSIONS.slice(0, 4).map(d => (
            <div key={d.key} className="h-1.5 w-full rounded-full bg-[rgba(255,255,255,0.12)]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl p-6" style={cardStyle}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <ShieldIcon />
          <h3 className="text-sm font-bold text-[#C7C7D1] tracking-tight">Workplace trust · {companyName}</h3>
        </div>
        <span
          className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
          style={{ color: EMERALD, background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.25)' }}
        >
          {aggregate.count} verified {aggregate.count === 1 ? 'employee' : 'employees'}
        </span>
      </div>

      {/* Headline — overall /100 + would-recommend */}
      <div className="flex items-end gap-5 my-6">
        <div>
          <span className="text-4xl font-black tracking-tight text-[#F4F4F7]">{aggregate.overall}</span>
          <span className="text-[#5C5C6A] text-sm font-normal"> / 100</span>
          <p className="text-[11px] text-[#7E7E8E] mt-0.5">Independent workplace trust</p>
        </div>
        {typeof aggregate.would_recommend === 'number' && (
          <div className="ml-auto text-right">
            <span className="text-xl font-black" style={{ color: EMERALD }}>{aggregate.would_recommend.toFixed(1)}</span>
            <span className="text-[#5C5C6A] text-xs"> / 5</span>
            <p className="text-[10px] text-[#7E7E8E] mt-0.5">Would recommend</p>
          </div>
        )}
      </div>

      {/* Public signal — Glassdoor (Layer 1) when present */}
      {typeof glassdoor === 'number' && (
        <div className="flex items-center gap-2 mb-4 -mt-2">
          <span className="text-[11px] text-[#7E7E8E]">⭐ {glassdoor.toFixed(1)} Glassdoor</span>
          <span className="text-[10px] text-[#5C5C6A]">· public rating</span>
        </div>
      )}

      {/* 8-dimension bars (1-5) */}
      <div className="space-y-3 border-t border-white/[0.07] pt-4">
        {DIMENSIONS.map(d => {
          const v = aggregate[d.key]
          if (typeof v !== 'number') return null
          return (
            <div key={d.key} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#A6A6B4]">{d.label}</span>
                <span className="text-[#F4F4F7] font-bold">{v.toFixed(1)}</span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden bg-[rgba(255,255,255,0.06)]">
                <div className="h-full rounded-full" style={{ width: `${(v / 5) * 100}%`, background: GRAD }} />
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-[#5C5C6A] mt-4 leading-relaxed">
        Anonymous &amp; independently sourced. {companyName} sees only these averages — never who responded or any individual answer.
      </p>
    </div>
  )
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke={EMERALD} strokeWidth={1.7} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M12 2.25l7.5 3v6c0 4.5-3 7.5-7.5 9-4.5-1.5-7.5-4.5-7.5-9v-6l7.5-3Z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="#7E7E8E" strokeWidth={1.7} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 0h10.5a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H6.75a1.5 1.5 0 0 1-1.5-1.5v-7.5a1.5 1.5 0 0 1 1.5-1.5Z" />
    </svg>
  )
}
