import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Employee-side Culture References — aggregate helper
//
// STRATEGY §14 Tier 3 + §15 component. Anonymous, aggregated past/current
// employee vouching for "paid on time / real hours / manager quality".
//
// PRIVACY RULE: averages are only returned when the number of non-flagged
// submitted responses is >= MIN_RESPONSES (= 3). Below that we return the
// count and flagged_count only — never the per-rating averages — so a single
// respondent can never be reverse-identified by toggling values.
// ─────────────────────────────────────────────────────────────────────────────

export type CultureAggregate = {
  count: number              // total submitted responses (excluding never-submitted invites)
  flagged_count: number
  paid_on_time?: number      // averages (undefined when count - flagged < MIN_RESPONSES)
  real_hours?: number
  manager_quality?: number
}

export const MIN_RESPONSES = 3

type CultureRow = {
  paid_on_time: number | null
  real_hours: number | null
  manager_quality: number | null
  submitted_at: string | null
  flagged: boolean | null
}

function avg(nums: number[]): number | undefined {
  if (nums.length === 0) return undefined
  const sum = nums.reduce((a, b) => a + b, 0)
  return Math.round((sum / nums.length) * 10) / 10
}

export async function getCultureAggregate(
  admin: SupabaseClient,
  companyId: string,
): Promise<CultureAggregate> {
  const { data, error } = await admin
    .from('company_culture_references')
    .select('paid_on_time, real_hours, manager_quality, submitted_at, flagged')
    .eq('company_id', companyId)
    .not('submitted_at', 'is', null)

  if (error || !data) {
    return { count: 0, flagged_count: 0 }
  }

  const rows = data as CultureRow[]
  const count = rows.length
  const flagged_count = rows.filter(r => r.flagged === true).length
  const trusted = rows.filter(r => r.flagged !== true)

  // Anonymity floor: never expose averages computed from < MIN_RESPONSES.
  if (trusted.length < MIN_RESPONSES) {
    return { count, flagged_count }
  }

  const paid = trusted.map(r => r.paid_on_time).filter((n): n is number => typeof n === 'number')
  const hours = trusted.map(r => r.real_hours).filter((n): n is number => typeof n === 'number')
  const mgr = trusted.map(r => r.manager_quality).filter((n): n is number => typeof n === 'number')

  return {
    count,
    flagged_count,
    paid_on_time: avg(paid),
    real_hours: avg(hours),
    manager_quality: avg(mgr),
  }
}
