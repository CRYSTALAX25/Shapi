// Single-source-of-truth feature → tier entitlement layer (Blueprint v3
// Prompt 03). Replaces the scattered `hasX(profile)` checks across 22+ files
// with a single map and a reusable <FeatureGate/> component.
//
// Design decisions:
// 1. Tier-name STRINGS used here are the v3 names; if pricing reshapes to
//    something else, the only change is THIS file's FEATURE_GATES map.
//    No component or page changes needed at flip-day.
// 2. Blueprint v3 actually has TWO orthogonal entitlement axes:
//    - Product 1 subscription ladder (free → starter → active_hiring)
//    - Standalone product purchases (Product 2 engagement, Product 3 retainer)
//    Modelled here as `Requirement` = either a min subscription tier OR a
//    product flag — never both. Cumulative for tiers.
// 3. Pricing is PARKED today. `GATES_ENFORCE` flag (defaults OFF) means the
//    scaffold sits inert in the codebase — Ana keeps testing without
//    lockouts. Flip the env var on launch day to activate gates.
//
// To add a new gated feature:
//   1. Add an entry to FEATURE_GATES below
//   2. Wrap the protected UI in <FeatureGate feature="your_feature_key">
//   3. Done.

import type { SupabaseClient } from '@supabase/supabase-js'

/* ──────────────────────────────────────────────────────────────────────── */
/* Tier model — Product 1 cumulative ladder (subscription)                  */
/* ──────────────────────────────────────────────────────────────────────── */

export const PLAN_TIERS = ['free', 'starter', 'active_hiring'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]

const TIER_INDEX: Record<PlanTier, number> = {
  free: 0,
  starter: 1,
  active_hiring: 2,
}

/** True if the user's tier is at-or-above the required tier (cumulative). */
function tierMeets(have: PlanTier, need: PlanTier): boolean {
  return TIER_INDEX[have] >= TIER_INDEX[need]
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Standalone product flags — Product 2 (engagement) + Product 3 (retainer) */
/* ──────────────────────────────────────────────────────────────────────── */

export type ProductFlag =
  | 'product_2_strategic_workforce_plan' // per-engagement purchase
  | 'product_3_brain_hr_os_retainer'     // monthly retainer

/* ──────────────────────────────────────────────────────────────────────── */
/* Requirement = a tier (cumulative) OR a product flag (standalone)         */
/* ──────────────────────────────────────────────────────────────────────── */

export type Requirement =
  | { kind: 'tier'; tier: PlanTier }
  | { kind: 'product'; product: ProductFlag }

/* ──────────────────────────────────────────────────────────────────────── */
/* The map — single source of truth                                         */
/* When pricing locks, edit ONLY this object to remap features.             */
/* ──────────────────────────────────────────────────────────────────────── */

export const FEATURE_GATES: Record<string, Requirement> = {
  // ── Product 1 (Talent Match Pipeline) ──────────────────────────────────
  workforce_snapshot:         { kind: 'tier', tier: 'free' },
  single_location_org_chart:  { kind: 'tier', tier: 'free' },
  salary_benchmark:           { kind: 'tier', tier: 'starter' },
  multi_location_chart:       { kind: 'tier', tier: 'starter' },
  ai_proof_role:              { kind: 'tier', tier: 'starter' },
  talent_match_flywheel:      { kind: 'tier', tier: 'active_hiring' },
  dual_budget_bands:          { kind: 'tier', tier: 'active_hiring' },
  interview_prep_briefs:      { kind: 'tier', tier: 'active_hiring' },
  daily_ai_shortlist:         { kind: 'tier', tier: 'active_hiring' },

  // ── Product 2 (Strategic Workforce Planner — engagement) ──────────────
  strategic_workforce_plan:   { kind: 'product', product: 'product_2_strategic_workforce_plan' },
  workforce_p_and_l_ledger:   { kind: 'product', product: 'product_2_strategic_workforce_plan' },
  people_outlay_map:          { kind: 'product', product: 'product_2_strategic_workforce_plan' },
  bespoke_driver_modifiers:   { kind: 'product', product: 'product_2_strategic_workforce_plan' },
  scenario_what_if_modelling: { kind: 'product', product: 'product_2_strategic_workforce_plan' },

  // ── Product 3 (Brain & HR OS — retainer) ──────────────────────────────
  employee_hr_portal:         { kind: 'product', product: 'product_3_brain_hr_os_retainer' },
  whatsapp_leave_logging:     { kind: 'product', product: 'product_3_brain_hr_os_retainer' },
  whatsapp_bonus_logging:     { kind: 'product', product: 'product_3_brain_hr_os_retainer' },
  workload_delegation:        { kind: 'product', product: 'product_3_brain_hr_os_retainer' },
  institutional_knowledge_graph: { kind: 'product', product: 'product_3_brain_hr_os_retainer' },
  predictive_turnover:        { kind: 'product', product: 'product_3_brain_hr_os_retainer' },
  span_of_control_heatmaps:   { kind: 'product', product: 'product_3_brain_hr_os_retainer' },
  cognitive_load:             { kind: 'product', product: 'product_3_brain_hr_os_retainer' },
  live_monitoring:            { kind: 'product', product: 'product_3_brain_hr_os_retainer' },
}

/** Human-facing labels for the lock card. */
export const FEATURE_LABELS: Record<string, string> = {
  workforce_snapshot:         'Workforce Snapshot',
  single_location_org_chart:  'Single-location Org Chart',
  salary_benchmark:           'Salary Benchmark',
  multi_location_chart:       'Multi-location Org Chart',
  ai_proof_role:              'AI-Proof a Role',
  talent_match_flywheel:      'Talent-Match Flywheel',
  dual_budget_bands:          'Dual Budget Bands',
  interview_prep_briefs:      'Interview Prep Briefs',
  daily_ai_shortlist:         'Daily AI Shortlist',
  strategic_workforce_plan:   'Strategic Workforce Plan',
  workforce_p_and_l_ledger:   'Workforce P&L Ledger',
  people_outlay_map:          'People Outlay Map',
  bespoke_driver_modifiers:   'Bespoke Driver Modifiers',
  scenario_what_if_modelling: 'Scenario / What-If Modelling',
  employee_hr_portal:         'Employee HR Portal',
  whatsapp_leave_logging:     'WhatsApp Leave Logging',
  whatsapp_bonus_logging:     'WhatsApp Bonus Logging',
  workload_delegation:        'Workload Delegation',
  institutional_knowledge_graph: 'Institutional Knowledge Graph',
  predictive_turnover:        'Predictive Turnover Detection',
  span_of_control_heatmaps:   'Span-of-Control Heatmaps',
  cognitive_load:             'Cognitive Load Tracking',
  live_monitoring:            'Live Workforce Monitoring',
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Derive the user's current tier + product flags from their profile row    */
/* ──────────────────────────────────────────────────────────────────────── */

export type EntitlementProfile = {
  subscription_product?: string[] | null
  paid?: boolean | null
  // Product-flag carriers — will be added by the schema migration
  // (Blueprint Prompt 04). For now derived from the existing fields.
  strategic_plan_purchased_at?: string | null
  brain_hr_os_active?: boolean | null
}

/**
 * Map the user's existing `subscription_product[]` array to a tier on the
 * Product 1 cumulative ladder. As pricing reshapes, this is where the
 * derivation logic gets re-tuned.
 */
export function currentTier(profile: EntitlementProfile | null | undefined): PlanTier {
  if (!profile) return 'free'
  const subs = new Set(profile.subscription_product || [])
  if (subs.has('active_hiring_monthly') || subs.has('active_hiring_yearly')) return 'active_hiring'
  // Starter equivalents — anything currently in our existing tier system
  // that includes the basic "browse + post" tier. Re-tune at pricing-lock.
  if (subs.has('roles_board_monthly') || subs.has('roles_board_yearly')) return 'starter'
  if (subs.has('bundle_monthly') || subs.has('bundle_yearly')) return 'starter'
  return 'free'
}

/** True if the user has the Strategic Workforce Plan engagement product. */
function hasProduct2(profile: EntitlementProfile | null | undefined): boolean {
  return !!profile?.strategic_plan_purchased_at
}

/** True if the user has the Brain / HR OS retainer subscription. */
function hasProduct3(profile: EntitlementProfile | null | undefined): boolean {
  return !!profile?.brain_hr_os_active
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The check that gates everything                                          */
/* ──────────────────────────────────────────────────────────────────────── */

export function hasEntitlement(
  profile: EntitlementProfile | null | undefined,
  feature: string,
): { allowed: boolean; requirement: Requirement | null } {
  const req = FEATURE_GATES[feature] || null
  if (!req) return { allowed: true, requirement: null } // unknown feature = ungated

  if (req.kind === 'tier') {
    return { allowed: tierMeets(currentTier(profile), req.tier), requirement: req }
  }
  if (req.product === 'product_2_strategic_workforce_plan') {
    return { allowed: hasProduct2(profile), requirement: req }
  }
  if (req.product === 'product_3_brain_hr_os_retainer') {
    return { allowed: hasProduct3(profile), requirement: req }
  }
  return { allowed: false, requirement: req }
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Server-side helper for SSR/RSC pages — fetches the profile + checks      */
/* ──────────────────────────────────────────────────────────────────────── */

export async function hasEntitlementServer(
  supabase: SupabaseClient,
  userId: string,
  feature: string,
): Promise<{ allowed: boolean; requirement: Requirement | null }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_product, paid, strategic_plan_purchased_at, brain_hr_os_active')
    .eq('id', userId)
    .single()
  return hasEntitlement(profile as EntitlementProfile, feature)
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Enforce-mode flag — defaults OFF until pricing is locked                 */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Set NEXT_PUBLIC_GATES_ENFORCE=true in Vercel to activate gates platform-
 * wide on launch day. Until then, FeatureGate renders children straight
 * through (no blur, no overlay) so Ana's testing isn't blocked while she's
 * still designing the pricing tiers.
 *
 * The audit + the gate scaffolding still lives in the code so the day
 * pricing locks, it's a one-env-var flip — not a refactor.
 */
export function gatesEnforced(): boolean {
  return process.env.NEXT_PUBLIC_GATES_ENFORCE === 'true'
}

/** Where to send users when they hit a locked feature. */
export function upgradeHrefFor(requirement: Requirement | null): string {
  if (!requirement) return '/company/pricing'
  if (requirement.kind === 'tier') return `/company/pricing?tier=${requirement.tier}`
  if (requirement.product === 'product_2_strategic_workforce_plan') return '/book-call?topic=strategic-plan'
  if (requirement.product === 'product_3_brain_hr_os_retainer') return '/book-call?topic=workforce-os'
  return '/company/pricing'
}

/** Human-facing description of what needs to happen to unlock. */
export function upgradeLabelFor(requirement: Requirement | null): string {
  if (!requirement) return 'Upgrade'
  if (requirement.kind === 'tier') {
    const tier = requirement.tier === 'starter' ? 'Starter'
      : requirement.tier === 'active_hiring' ? 'Active Hiring' : 'Free'
    return `Upgrade to ${tier}`
  }
  if (requirement.product === 'product_2_strategic_workforce_plan') return 'Book a Strategic Workforce Plan engagement'
  if (requirement.product === 'product_3_brain_hr_os_retainer') return 'Activate the Shapi Brain & HR OS retainer'
  return 'Upgrade'
}
