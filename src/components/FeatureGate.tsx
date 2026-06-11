// FeatureGate — blueprint-v3-mandated component. Wraps any feature surface;
// blurs + overlays a lock card with an upgrade CTA when the user lacks the
// required tier or product. NEVER hides — per Blueprint Principle 4
// (cumulative gated entitlements): "premium modules are rendered natively
// everywhere as greyed-out components overlaid with clear upgrade CTAs and
// lock icons to maximize self-serve upselling."
//
// USAGE — server component variant (most pages):
//   <FeatureGate feature="strategic_workforce_plan">
//     <YourFeatureUI />
//   </FeatureGate>
//
// USAGE — client component variant (when caller has profile in hand):
//   <FeatureGateClient feature="cognitive_load" profile={profile}>
//     <YourFeatureUI />
//   </FeatureGateClient>
//
// The component reads NEXT_PUBLIC_GATES_ENFORCE: if 'true', enforces; if
// not, renders children straight through. Default: not enforced. This lets
// the scaffolding ship + survive pricing-still-TBD without lockouts. Flip
// the env var on launch day to activate platform-wide.

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  hasEntitlement,
  hasEntitlementServer,
  gatesEnforced,
  upgradeHrefFor,
  upgradeLabelFor,
  FEATURE_LABELS,
  type EntitlementProfile,
} from '@/lib/entitlements'

type GateProps = {
  feature: string
  children: React.ReactNode
  /** Optional override for the lock card title (defaults to FEATURE_LABELS[feature]). */
  title?: string
  /** Optional one-line description for the lock card. */
  description?: string
  /** Optional override for the upgrade button text. */
  upgradeLabel?: string
  /** Optional override for the upgrade button href. */
  upgradeHref?: string
  /** Compact mode = smaller overlay, used inline within larger pages. */
  compact?: boolean
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Server Component variant — fetches profile via Supabase server client   */
/* ─────────────────────────────────────────────────────────────────────── */
export default async function FeatureGate(props: GateProps) {
  if (!gatesEnforced()) {
    // Inert until pricing locks + Ana flips NEXT_PUBLIC_GATES_ENFORCE=true.
    // Children render unchanged; scaffold sits invisible in production.
    return <>{props.children}</>
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // Not signed in: render the lock card. The CTA points to signup if the
    // feature is gated on tier, or book-call for product engagements.
    return <LockedShell {...props} requirement={null} />
  }
  const { allowed, requirement } = await hasEntitlementServer(supabase, user.id, props.feature)
  if (allowed) return <>{props.children}</>
  return <LockedShell {...props} requirement={requirement} />
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Client Component variant — for client-rendered pages with profile in    */
/* hand. Same behaviour, no Supabase call.                                 */
/* ─────────────────────────────────────────────────────────────────────── */
export function FeatureGateClient(props: GateProps & { profile: EntitlementProfile | null }) {
  if (!gatesEnforced()) return <>{props.children}</>
  const { allowed, requirement } = hasEntitlement(props.profile, props.feature)
  if (allowed) return <>{props.children}</>
  return <LockedShell {...props} requirement={requirement} />
}

/* ─────────────────────────────────────────────────────────────────────── */
/* The locked shell — blurred children behind a lock card overlay          */
/* ─────────────────────────────────────────────────────────────────────── */
function LockedShell({
  feature, children, title, description, upgradeLabel, upgradeHref, compact,
  requirement,
}: GateProps & { requirement: Awaited<ReturnType<typeof hasEntitlementServer>>['requirement'] }) {
  const displayTitle = title || FEATURE_LABELS[feature] || 'Premium feature'
  const displayUpgradeLabel = upgradeLabel || upgradeLabelFor(requirement)
  const displayUpgradeHref = upgradeHref || upgradeHrefFor(requirement)
  const displayDescription = description ||
    (requirement?.kind === 'product'
      ? 'Available with the corresponding Shapi product purchase. Book a call to scope your engagement.'
      : 'Available on a higher subscription tier. Upgrade to unlock.')

  return (
    <div className="relative">
      {/* The actual children stay rendered but blurred + non-interactive
          per Blueprint Principle 4 (never hide). Pointer-events disabled
          so users can't tab through into the locked UI. */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none"
        style={{ filter: 'blur(6px)', opacity: 0.55 }}
      >
        {children}
      </div>

      {/* Lock card overlay — Palette E tokens (#0D0C14 card / #9D8CFF accent
          / rgba(255,255,255,0.9) heading / rgba(255,255,255,0.5) body). When Palette E ships platform-
          wide, the rest of the UI matches. */}
      <div
        className="absolute inset-0 flex items-center justify-center p-4"
        style={{ background: 'rgba(12,14,17,0.55)', backdropFilter: 'blur(2px)' }}
      >
        <div
          className={compact ? 'max-w-sm w-full rounded-2xl p-5 text-center' : 'max-w-md w-full rounded-2xl p-6 text-center'}
          style={{ background: '#0D0C14', border: '1px solid rgba(157, 140, 255, 0.30)', boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}
        >
          <div
            className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center text-xl"
            style={{ background: 'rgba(157, 140, 255, 0.14)', border: '1px solid rgba(157, 140, 255, 0.35)' }}
          >
            🔒
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#9D8CFF' }}>
            {requirement?.kind === 'product' ? 'Engagement / retainer' : 'Premium tier'}
          </p>
          <h3 className={compact ? 'text-base font-black mb-1' : 'text-lg font-black mb-2'} style={{ color: 'rgba(255,255,255,0.9)' }}>
            {displayTitle}
          </h3>
          <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {displayDescription}
          </p>
          <Link
            href={displayUpgradeHref}
            className={compact ? 'inline-block px-4 py-2 rounded-full font-black text-xs' : 'inline-block px-5 py-2.5 rounded-full font-black text-xs'}
            style={{ background: '#eef1f6', color: '#060609' }}
          >
            {displayUpgradeLabel} →
          </Link>
        </div>
      </div>
    </div>
  )
}
