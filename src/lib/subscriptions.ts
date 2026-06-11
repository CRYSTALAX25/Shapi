// Subscription product helpers — read the subscription_product[] array on a
// profile and answer "does this candidate have feature X enabled?".
//
// One-time purchases (CV Kit, CV Pro) live on cv_tier. Recurring add-ons
// (Active, Concierge) live in subscription_product[].
//
// v5 PRICING (2026-06-10, STRATEGY §2): candidate ladder collapsed from 8 SKUs
// to Free → CV Kit $25 → CV Pro $59 → Active $29/mo → Concierge $89/mo, plus a
// Profile Boost $29 upsell. The Bundle ($39) was KILLED and the standalone
// Roles Board ($19) was MERGED into Active — Active now includes seeing all
// open roles. Legacy `roles_board_*` / `bundle_*` keys are kept ONLY so that
// pre-v5 subscribers whose arrays still contain them keep their access; no new
// checkout path creates them.

export type SubscriptionProduct =
  | 'active_monthly' | 'active_yearly'
  | 'concierge_monthly'
  // Company-side products (STRATEGY §14 Tier 1 / §16 Tier B)
  | 'active_hiring_monthly' | 'active_hiring_yearly'

// Legacy candidate keys — no longer sold, but honoured if already on a profile.
export type LegacySubscriptionProduct =
  | 'roles_board_monthly' | 'roles_board_yearly'
  | 'bundle_monthly' | 'bundle_yearly'

export type ProfileWithSubscriptions = {
  cv_tier?: string | null
  subscription_product?: string[] | null
  paid?: boolean | null  // legacy fallback — pre-SKU-split candidates
}

function products(profile: ProfileWithSubscriptions | null | undefined): Set<string> {
  if (!profile?.subscription_product) return new Set()
  return new Set(profile.subscription_product)
}

export function hasOpenRolesBoard(profile: ProfileWithSubscriptions | null | undefined): boolean {
  const p = products(profile)
  // v5: Roles Board is folded into Active — anyone on Active (or Concierge,
  // which includes Active) sees all open roles. Legacy roles_board_* / bundle_*
  // keys still resolve true for grandfathered subscribers.
  return p.has('active_monthly') || p.has('active_yearly')
    || p.has('concierge_monthly')
    || p.has('roles_board_monthly') || p.has('roles_board_yearly')
    || p.has('bundle_monthly') || p.has('bundle_yearly')
}

export function hasActive(profile: ProfileWithSubscriptions | null | undefined): boolean {
  const p = products(profile)
  // Tier ladder: Concierge ($89) includes Active ($29).
  return p.has('active_monthly') || p.has('active_yearly')
    || p.has('concierge_monthly')
    || p.has('bundle_monthly') || p.has('bundle_yearly')  // legacy grandfather
}

export function hasConcierge(profile: ProfileWithSubscriptions | null | undefined): boolean {
  const p = products(profile)
  return p.has('concierge_monthly')
}

// Company-side: Active Hiring subscription — daily AI-shortlisted candidates
// per open role + drafted outreach awaiting one-tap approval.
export function hasActiveHiring(profile: ProfileWithSubscriptions | null | undefined): boolean {
  const p = products(profile)
  return p.has('active_hiring_monthly') || p.has('active_hiring_yearly')
}

// CV access — paid Kit or Pro tier (one-time, not subscription)
export function hasCVAccess(profile: ProfileWithSubscriptions | null | undefined): boolean {
  return profile?.cv_tier === 'kit' || profile?.cv_tier === 'pro'
}

export function hasProAccess(profile: ProfileWithSubscriptions | null | undefined): boolean {
  return profile?.cv_tier === 'pro'
}

// Platform-access shortcut used by some routes: anyone who's paid for something
// counts (CV Kit, CV Pro, any subscription, or the legacy `paid` flag).
export function hasPlatformAccess(profile: ProfileWithSubscriptions | null | undefined): boolean {
  if (!profile) return false
  if (hasCVAccess(profile)) return true
  if ((profile.subscription_product?.length ?? 0) > 0) return true
  if (profile.paid) return true
  return false
}

// Convert an internal product key to the human label shown to candidates.
// Legacy keys retain labels so grandfathered subscribers see a sane name.
export const PRODUCT_LABELS: Record<SubscriptionProduct | LegacySubscriptionProduct, string> = {
  active_monthly: 'Shapi Active',
  active_yearly: 'Shapi Active',
  concierge_monthly: 'Active Concierge',
  active_hiring_monthly: 'Active Hiring',
  active_hiring_yearly: 'Active Hiring',
  // legacy
  roles_board_monthly: 'Open Roles Board',
  roles_board_yearly: 'Open Roles Board',
  bundle_monthly: 'Career Bundle',
  bundle_yearly: 'Career Bundle',
}

// Live, sellable products only. Prices in whole dollars; checkout multiplies by
// 100 for Stripe `unit_amount` (cents).
//
// v5 candidate prices: Active $29/mo (now includes the Roles Board), Concierge
// $89/mo. The $89 number is the locked Concierge price — the live bug where it
// charged $79 (amount 7900) was fixed here and in /api/stripe/cv-checkout.
export const PRODUCT_PRICES: Record<SubscriptionProduct, { amount: number; interval: 'month' | 'year' }> = {
  // Active now bundles the old Roles Board ($19) — candidates see every open role.
  active_monthly: { amount: 29, interval: 'month' },
  active_yearly: { amount: 249, interval: 'year' },
  // Concierge — locked at $89/mo (2026-06-02 lock; re-confirmed v5 2026-06-10).
  concierge_monthly: { amount: 89, interval: 'month' },
  // Active Hiring — company-side add-on bundled into the Pro/Growth tiers.
  active_hiring_monthly: { amount: 499, interval: 'month' },
  active_hiring_yearly: { amount: 4990, interval: 'year' },
}
