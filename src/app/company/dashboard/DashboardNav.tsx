import Link from 'next/link'
import { Fragment } from 'react'

// ── Company dashboard navigation ────────────────────────────────────────────
// Redesign 2026-06: the old nav lived inside a fixed 220px grid track with
// whitespace-nowrap + flex-shrink-0 pills — at mid widths the pills overflowed
// the track and overlapped the profile-completion ring. Now the nav owns its
// column for real:
//   · lg+  — true sticky sidebar (own grid column, labels truncate, never
//            overflows) with "Plan & billing" pinned at the bottom.
//   · <lg  — single horizontal scroll strip (overflow-x-auto), so nowrap
//            pills scroll instead of spilling onto the content. Clean at 375px.
// The founder-approved grouping is unchanged: Your org → Hire → Intelligence
// (Enterprise) → More tools (collapsed). Every route stays reachable.

type NavItem = { href: string; label: string; icon: string; active?: boolean; enterprise?: boolean }

const NAV_GROUPS: Array<{ label: string; badge?: string; items: NavItem[] }> = [
  {
    label: 'Your org',
    items: [
      { href: '/company/spine', label: 'Org Spine', icon: '🌳' },
      { href: '/company/people', label: 'People (HR Portal)', icon: '🗂️', enterprise: true },
      { href: '/company/workforce-snapshot', label: 'Workforce Snapshot', icon: '✦' },
    ],
  },
  {
    label: 'Hire',
    items: [
      { href: '/company/roles', label: 'Roles', icon: '💼' },
      { href: '/company/pipeline', label: 'Pipeline', icon: '📋' },
      { href: '/candidates', label: 'Candidates', icon: '👥' },
      { href: '/company/roles/new', label: 'Post a role', icon: '➕' },
    ],
  },
  {
    label: 'Intelligence',
    badge: 'Enterprise',
    items: [
      { href: '/company/skill-density', label: 'Skill Density', icon: '🔬' },
      { href: '/company/brain', label: 'Company Brain', icon: '🧬' },
      { href: '/company/delegation', label: 'Workload Delegation', icon: '⚖️' },
      { href: '/company/os', label: 'Workforce OS', icon: '📡' },
    ],
  },
]

// Long tail — collapsed by default; every route stays reachable.
const MORE_TOOLS: NavItem[] = [
  { href: '/company/salary-benchmark', label: 'Salary benchmark', icon: '💸' },
  { href: '/company/roadmap', label: 'Hiring Roadmap', icon: '🗺️' },
  { href: '/company/hiring-plan', label: 'Hiring Plan', icon: '🚀' },
  { href: '/company/org-design', label: 'Org design', icon: '🏛️' },
  { href: '/company/staffing', label: 'Staffing recs', icon: '🤖' },
  { href: '/company/cognitive-load', label: 'Cognitive load', icon: '🧠' },
  { href: '/company/strategic-plan', label: 'Strategic Workforce Plan', icon: '📋' },
  { href: '/role/ai-proof', label: 'AI-Proof a role', icon: '🛡️' },
  { href: '/company/profile', label: 'Company profile', icon: '👤' },
]

function EnterpriseBadge() {
  return (
    <span className="flex-shrink-0 text-[9px] font-black uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full bg-[rgba(251,191,36,0.14)] text-[#FBBF24]">
      Enterprise
    </span>
  )
}

// One pill, two layouts. Sidebar (default): full-width row, label truncates —
// can never overflow its column. Compact (mobile strip): nowrap is safe here
// because the parent scrolls horizontally.
function Pill({ item, compact = false }: { item: NavItem; compact?: boolean }) {
  const shape = compact
    ? 'flex-shrink-0 whitespace-nowrap'
    : 'w-full min-w-0'
  const tone = item.active
    ? 'bg-[rgba(157,140,255,0.10)] border-[rgba(157,140,255,0.25)] text-[#9D8CFF]'
    : compact
      ? 'bg-[#0D0C14] border-white/[0.06] text-white/60 hover:text-white/90 hover:bg-[#131220] hover:border-[rgba(157,140,255,0.25)]'
      : 'border-transparent text-white/60 hover:text-white/90 hover:bg-[#131220]'
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] font-bold transition-colors ${shape} ${tone}`}
    >
      <span className="text-sm leading-none flex-shrink-0">{item.icon}</span>
      <span className={compact ? '' : 'truncate'}>{item.label}</span>
      {item.enterprise && <EnterpriseBadge />}
    </Link>
  )
}

function GroupLabel({ label, badge }: { label: string; badge?: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5 px-3">
      <span>{label}</span>
      {badge && <EnterpriseBadge />}
    </p>
  )
}

// Compact "Plan & billing" — the upsell's new home. Current tier + a small
// Upgrade chip; the big mid-page banners are gone. Links to /company/pricing.
function PlanChip({ planLabel, showUpgrade, compact = false }: { planLabel: string; showUpgrade: boolean; compact?: boolean }) {
  if (compact) {
    return (
      <Link
        href="/company/pricing"
        className="flex-shrink-0 whitespace-nowrap flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0D0C14] px-3 py-2 text-[13px] font-bold text-white/60 hover:text-white/90 hover:border-[rgba(157,140,255,0.25)] transition-colors"
      >
        <span className="text-sm leading-none">💳</span>
        <span>Plan: {planLabel}</span>
        {showUpgrade && (
          <span className="text-[9px] font-black uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full bg-[rgba(251,113,133,0.14)] text-[#FB7185]">
            Upgrade
          </span>
        )}
      </Link>
    )
  }
  return (
    <Link
      href="/company/pricing"
      className="block rounded-2xl border border-white/[0.06] bg-[#0D0C14] p-3.5 hover:bg-[#131220] hover:border-[rgba(157,140,255,0.25)] transition-colors"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Plan &amp; billing</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-white/90 truncate">{planLabel}</span>
        {showUpgrade && (
          <span className="flex-shrink-0 text-[10px] font-black uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border border-[rgba(251,113,133,0.35)] bg-[rgba(251,113,133,0.10)] text-[#FB7185]">
            Upgrade
          </span>
        )}
      </div>
    </Link>
  )
}

export default function DashboardNav({ planLabel, showUpgrade }: { planLabel: string; showUpgrade: boolean }) {
  const overview: NavItem = { href: '/company/dashboard', label: 'Overview', icon: '🏠', active: true }

  return (
    <>
      {/* ── Desktop: sticky sidebar in its own grid column ── */}
      <aside className="hidden lg:flex flex-col sticky top-6 self-start max-h-[calc(100vh-3rem)]">
        <nav className="flex-1 overflow-y-auto pr-1 flex flex-col gap-5 min-h-0">
          <Pill item={overview} />

          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <GroupLabel label={group.label} badge={group.badge} />
              <div className="flex flex-col gap-0.5">
                {group.items.map(item => <Pill key={item.label} item={item} />)}
              </div>
            </div>
          ))}

          <details>
            <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 hover:text-white/70 transition-colors px-3">
              <span>More tools</span>
              <span aria-hidden="true">▾</span>
            </summary>
            <div className="flex flex-col gap-0.5 mt-1.5">
              {MORE_TOOLS.map(item => <Pill key={item.label} item={item} />)}
            </div>
          </details>
        </nav>

        <div className="pt-5 flex-shrink-0">
          <PlanChip planLabel={planLabel} showUpgrade={showUpgrade} />
        </div>
      </aside>

      {/* ── Mobile / tablet: one horizontal scroll strip — pills scroll, never
            wrap or overlap content below. ── */}
      <div className="lg:hidden -mx-6 mb-6">
        <div className="shapi-noscroll flex items-center gap-2 overflow-x-auto px-6 pb-1">
          <Pill item={overview} compact />
          {NAV_GROUPS.map(group => (
            <Fragment key={group.label}>
              <span aria-hidden="true" className="flex-shrink-0 w-px h-5 bg-white/10" />
              {group.items.map(item => <Pill key={item.label} item={item} compact />)}
            </Fragment>
          ))}
          <span aria-hidden="true" className="flex-shrink-0 w-px h-5 bg-white/10" />
          {MORE_TOOLS.map(item => <Pill key={item.label} item={item} compact />)}
          <span aria-hidden="true" className="flex-shrink-0 w-px h-5 bg-white/10" />
          <PlanChip planLabel={planLabel} showUpgrade={showUpgrade} compact />
        </div>
      </div>
    </>
  )
}
