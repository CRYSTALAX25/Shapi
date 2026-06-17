import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Employee-side Culture References — aggregate helper (Plane B, Shapi-only).
//
// Anonymous, aggregated past/current employee vouching across the locked
// 9-dimension rubric. This is the COMPANY trust score (employees rate their
// employer so candidates can vet a company before applying) — NOT a candidate
// score. See memory: project_trust_score_model.
//
// PRIVACY RULE: averages are only returned when the number of non-flagged
// submitted responses is >= MIN_RESPONSES (= 3). Below that we return the
// count + flagged_count only — never per-rating averages — so a single
// respondent can never be reverse-identified. The table has NO company-side
// SELECT policy; only the service role reads it, and only ever as aggregate.
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_RESPONSES = 3

// The 9 rated dimensions. `hours_respected` maps to the legacy `real_hours`
// column; `exit_handled` is past-employees-only (may be absent even at scale).
export type CultureAggregate = {
  count: number
  flagged_count: number
  // averages (1-5), undefined until trusted responses >= MIN_RESPONSES
  paid_on_time?: number
  hours_respected?: number
  manager_quality?: number
  promise_kept?: number
  respect_safety?: number
  growth?: number
  fair_treatment?: number
  would_recommend?: number   // the headline metric
  exit_handled?: number      // past employees only
  overall?: number           // blended 0-100 headline trust score
}

type CultureRow = {
  paid_on_time: number | null
  real_hours: number | null
  manager_quality: number | null
  promise_kept: number | null
  respect_safety: number | null
  growth: number | null
  fair_treatment: number | null
  would_recommend: number | null
  exit_handled: number | null
  submitted_at: string | null
  flagged: boolean | null
}

// Columns we pull for any aggregate read. Kept in one place so single + batch
// helpers stay in sync.
const RATING_COLUMNS =
  'paid_on_time, real_hours, manager_quality, promise_kept, respect_safety, growth, fair_treatment, would_recommend, exit_handled, submitted_at, flagged'

function avg(nums: number[]): number | undefined {
  if (nums.length === 0) return undefined
  const sum = nums.reduce((a, b) => a + b, 0)
  return Math.round((sum / nums.length) * 10) / 10
}

// Collapse a set of (already-submitted) rows for ONE company into the public
// aggregate, applying the anonymity floor. Shared by single + batch helpers.
function aggregateRows(rows: CultureRow[]): CultureAggregate {
  const count = rows.length
  const flagged_count = rows.filter(r => r.flagged === true).length
  const trusted = rows.filter(r => r.flagged !== true)

  // Anonymity floor: never expose averages computed from < MIN_RESPONSES.
  if (trusted.length < MIN_RESPONSES) {
    return { count, flagged_count }
  }

  const mean = (key: keyof CultureRow) =>
    avg(trusted.map(r => r[key]).filter((n): n is number => typeof n === 'number'))

  const dims = {
    paid_on_time: mean('paid_on_time'),
    hours_respected: mean('real_hours'),
    manager_quality: mean('manager_quality'),
    promise_kept: mean('promise_kept'),
    respect_safety: mean('respect_safety'),
    growth: mean('growth'),
    fair_treatment: mean('fair_treatment'),
    would_recommend: mean('would_recommend'),
    exit_handled: mean('exit_handled'),
  }

  // Overall = mean of whichever dimensions have data, scaled 1-5 → 0-100.
  const present = Object.values(dims).filter((n): n is number => typeof n === 'number')
  const overall = present.length
    ? Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 20)
    : undefined

  return { count, flagged_count, ...dims, overall }
}

export async function getCultureAggregate(
  admin: SupabaseClient,
  companyId: string,
): Promise<CultureAggregate> {
  const { data, error } = await admin
    .from('company_culture_references')
    .select(RATING_COLUMNS)
    .eq('company_id', companyId)
    .not('submitted_at', 'is', null)

  if (error || !data) return { count: 0, flagged_count: 0 }
  return aggregateRows(data as CultureRow[])
}

// Batch variant — one query for many companies (e.g. the candidate roles list).
// Returns a Map keyed by company_id; companies with no submitted responses are
// simply absent. Degrades to an empty map if the table/migration isn't present
// yet, so callers can render without it.
export async function getCultureAggregates(
  admin: SupabaseClient,
  companyIds: string[],
): Promise<Map<string, CultureAggregate>> {
  const out = new Map<string, CultureAggregate>()
  const ids = [...new Set(companyIds.filter(Boolean))]
  if (ids.length === 0) return out

  const { data, error } = await admin
    .from('company_culture_references')
    .select(`company_id, ${RATING_COLUMNS}`)
    .in('company_id', ids)
    .not('submitted_at', 'is', null)

  if (error || !data) return out

  const byCompany = new Map<string, CultureRow[]>()
  for (const row of data as Array<CultureRow & { company_id: string }>) {
    const list = byCompany.get(row.company_id) || []
    list.push(row)
    byCompany.set(row.company_id, list)
  }
  for (const [companyId, rows] of byCompany) {
    out.set(companyId, aggregateRows(rows))
  }
  return out
}
