// Subscription product helpers — read the subscription_product[] array on a
// profile and answer "does this candidate have feature X enabled?".
//
// One-time purchases (CV Kit, CV Pro) live on cv_tier. Recurring add-ons
// (Roles Board, Active, Concierge, Bundle) live in subscription_product[].
// The Bundle product unlocks both Roles Board and Active.

export type SubscriptionProduct =
  | 'roles_board_monthly' | 'roles_board_yearly'
  | 'active_monthly' | 'active_yearly'
  | 'concierge_monthly'
  | 'bundle_monthly' | 'bundle_yearly'
  // Company-side products (STRATEGY §14 Tier 1 / §16 Tier B)
  | 'active_hiring_monthly' | 'active_hiring_yearly'

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
  // Tier ladder: Active ($29) and Concierge ($79) both include Roles Board ($19).
  return p.has('roles_board_monthly') || p.has('roles_board_yearly')
    || p.has('active_monthly') || p.has('active_yearly')
    || p.has('concierge_monthly')
    || p.has('bundle_monthly') || p.has('bundle_yearly')
}

export function hasActive(profile: ProfileWithSubscriptions | null | undefined): boolean {
  const p = products(profile)
  // Tier ladder: Concierge ($79) includes Active ($29).
  return p.has('active_monthly') || p.has('active_yearly')
    || p.has('bundle_monthly') || p.has('bundle_yearly')
    || p.has('concierge_monthly')
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
export const PRODUCT_LABELS: Record<SubscriptionProduct, string> = {
  roles_board_monthly: 'Open Roles Board',
  roles_board_yearly: 'Open Roles Board',
  active_monthly: 'Shapi Active',
  active_yearly: 'Shapi Active',
  concierge_monthly: 'Active Concierge',
  bundle_monthly: 'Career Bundle',
  bundle_yearly: 'Career Bundle',
  active_hiring_monthly: 'Active Hiring',
  active_hiring_yearly: 'Active Hiring',
}

export const PRODUCT_PRICES: Record<SubscriptionProduct, { amount: number; interval: 'month' | 'year' }> = {
  roles_board_monthly: { amount: 19, interval: 'month' },
  roles_board_yearly: { amount: 149, interval: 'year' },
  active_monthly: { amount: 29, interval: 'month' },
  active_yearly: { amount: 249, interval: 'year' },
  concierge_monthly: { amount: 79, interval: 'month' },
  bundle_monthly: { amount: 39, interval: 'month' },
  bundle_yearly: { amount: 349, interval: 'year' },
  // Active Hiring — sits between Starter ($299) and Growth ($799) tiers.
  // Daily AI-shortlist of verified candidates + drafted outreach per open role.
  active_hiring_monthly: { amount: 499, interval: 'month' },
  active_hiring_yearly: { amount: 4990, interval: 'year' },
}
