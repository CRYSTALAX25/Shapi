// Aggregate interview_feedback into visible scores.
//   Company trust  = candidates' ratings OF a company  (author='candidate')
//   Candidate reliability = companies' ratings OF a candidate (author='company')
// RLS scopes interview_feedback by author, so these must run with the admin client.

type AdminLike = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (c: string, v: string) => {
        in: (c: string, v: string[]) => { not: (c: string, op: string, v: null) => Promise<{ data: Array<Record<string, unknown>> | null }> }
      }
    }
  }
}

export type RatingAgg = { avg: number; count: number }

function groupAvg(rows: Array<Record<string, unknown>>, key: string): Map<string, RatingAgg> {
  const sums = new Map<string, { total: number; n: number }>()
  for (const r of rows) {
    const id = r[key] as string
    const rating = r.rating as number | null
    if (id == null || rating == null) continue
    const cur = sums.get(id) || { total: 0, n: 0 }
    cur.total += rating; cur.n += 1
    sums.set(id, cur)
  }
  const out = new Map<string, RatingAgg>()
  for (const [id, { total, n }] of sums) out.set(id, { avg: Math.round((total / n) * 10) / 10, count: n })
  return out
}

export async function companyTrustRatings(admin: AdminLike, companyIds: string[]): Promise<Map<string, RatingAgg>> {
  if (!companyIds.length) return new Map()
  const { data } = await admin.from('interview_feedback').select('company_id, rating').eq('author', 'candidate').in('company_id', companyIds).not('rating', 'is', null)
  return groupAvg(data || [], 'company_id')
}

export async function candidateReliabilityRatings(admin: AdminLike, candidateIds: string[]): Promise<Map<string, RatingAgg>> {
  if (!candidateIds.length) return new Map()
  const { data } = await admin.from('interview_feedback').select('candidate_id, rating').eq('author', 'company').in('candidate_id', candidateIds).not('rating', 'is', null)
  return groupAvg(data || [], 'candidate_id')
}
