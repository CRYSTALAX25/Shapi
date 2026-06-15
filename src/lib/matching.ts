import { createClient } from '@/lib/supabase/server'

function scoreCandidate(
  candidateSkills: string[],
  candidateAiTier: string | null,
  jobAiTierRequired: string | null,
): number {
  let score = 40 // base — everyone with a parsed CV gets a starting score

  // AI tier match (up to 40 points)
  const tiers = ['user', 'integrator', 'builder']
  if (!jobAiTierRequired || jobAiTierRequired === 'any') {
    score += 40
  } else if (candidateAiTier === jobAiTierRequired) {
    score += 40
  } else {
    const ci = tiers.indexOf(candidateAiTier || 'user')
    const ji = tiers.indexOf(jobAiTierRequired)
    if (ci >= 0 && ji >= 0 && Math.abs(ci - ji) === 1) score += 20
  }

  // Skills richness bonus (up to 20 points)
  score += Math.min((candidateSkills?.length ?? 0) * 2, 20)

  return Math.min(score, 100)
}

// Run matching for a single candidate against all live jobs
export async function matchCandidateToJobs(candidateId: string) {
  const supabase = await createClient()

  const { data: candidate } = await supabase
    .from('profiles')
    .select('skills, ai_tier, cv_parsed')
    .eq('id', candidateId)
    .single()

  if (!candidate?.cv_parsed) return

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, ai_tier_required')
    .eq('status', 'live')

  if (!jobs?.length) return

  const matches = jobs
    .map(job => ({
      candidate_id: candidateId,
      job_id: job.id,
      score: scoreCandidate(candidate.skills || [], candidate.ai_tier, job.ai_tier_required),
    }))
    .filter(m => m.score >= 40)

  if (!matches.length) return

  await supabase
    .from('matches')
    .upsert(matches, { onConflict: 'candidate_id,job_id' })
}

// Run matching for a single job against all candidates with parsed CVs
export async function matchJobToCandidates(jobId: string) {
  const supabase = await createClient()

  const { data: job } = await supabase
    .from('jobs')
    .select('id, ai_tier_required, status')
    .eq('id', jobId)
    .single()

  if (!job || job.status !== 'live') return

  const { data: candidates } = await supabase
    .from('profiles')
    .select('id, skills, ai_tier')
    .eq('cv_parsed', true)

  if (!candidates?.length) return

  const matches = candidates
    .map(c => ({
      candidate_id: c.id,
      job_id: jobId,
      score: scoreCandidate(c.skills || [], c.ai_tier, job.ai_tier_required),
    }))
    .filter(m => m.score >= 40)

  if (!matches.length) return

  await supabase
    .from('matches')
    .upsert(matches, { onConflict: 'candidate_id,job_id' })
}

// ─── Role ↔ candidate matching (current roles flow) ──────────────────────────
// Scores a verified candidate against a role and returns a 0–100 score plus
// human-readable reasons. Uses the signals we actually capture: skills overlap,
// location, field alignment, salary fit, engagement-type fit, verification.

export type MatchCandidate = {
  skills?: string[] | null
  location?: string | null
  headline?: string | null
  industry?: string | null
  completion_pct?: number | null
  verification_tier?: string | null
  salary_expectations?: {
    period?: string
    primary?: { min?: number | null; max?: number | null } | null
    pivots?: Array<{ min?: number | null; max?: number | null }> | null
  } | null
  open_to_engagement?: string[] | null
  target_roles?: string[] | null
}

export type MatchRole = {
  title?: string | null
  department?: string | null
  location?: string | null
  requirements?: string | null
  description?: string | null
  salary_min?: number | null
  salary_max?: number | null
  engagement_type?: string | null
}

export type MatchResult = { score: number; reasons: string[] }

// Candidate expectations default to monthly; role salaries are annual. Normalise
// the candidate's lowest acceptable figure to annual for comparison.
function candidateAnnualFloor(c: MatchCandidate): number | null {
  const se = c.salary_expectations
  if (!se) return null
  const mins: number[] = []
  if (se.primary?.min != null) mins.push(se.primary.min)
  for (const p of se.pivots || []) if (p?.min != null) mins.push(p.min)
  if (mins.length === 0) return null
  const floor = Math.min(...mins)
  return se.period === 'year' ? floor : floor * 12
}

export function scoreCandidateForRole(candidate: MatchCandidate, role: MatchRole): MatchResult {
  const reasons: string[] = []
  let score = 0

  // Skills overlap (max 45)
  const reqText = `${role.requirements || ''} ${role.description || ''} ${role.title || ''}`.toLowerCase()
  const skills = (candidate.skills || []).map(s => s.toLowerCase())
  if (skills.length > 0 && reqText.trim()) {
    let hits = 0
    for (const skill of skills) {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`\\b${escaped}\\b`).test(reqText)) hits++
    }
    score += Math.round((hits / skills.length) * 45)
    if (hits >= 3) reasons.push(`${hits} skills match the role`)
    else if (hits > 0) reasons.push(`${hits} skill${hits > 1 ? 's' : ''} match`)
  }

  // Location (max 15)
  if (role.location && candidate.location) {
    const rl = role.location.toLowerCase(), cl = candidate.location.toLowerCase()
    if (rl.includes(cl) || cl.includes(rl)) { score += 15; reasons.push(`Based in ${candidate.location}`) }
    else {
      const rw = rl.split(/[\s,]+/), cw = cl.split(/[\s,]+/)
      if (rw.some(w => w.length > 2 && cw.includes(w))) { score += 8; reasons.push('Nearby location') }
    }
  } else if (!role.location) {
    score += 8
  }

  // Field / headline alignment (max 12)
  const deptText = `${role.department || ''} ${role.title || ''}`.toLowerCase()
  const headlineText = `${candidate.headline || ''} ${candidate.industry || ''}`.toLowerCase()
  if (deptText.trim() && headlineText.trim()) {
    const dw = deptText.split(/[\s,/\-]+/).filter(w => w.length > 3)
    const hw = headlineText.split(/[\s,/\-]+/)
    if (dw.some(w => hw.some(h => h.includes(w) || w.includes(h)))) { score += 12; reasons.push('Background fits the field') }
  }

  // Salary fit (max 10) — lenient: reward a fit, never penalise missing data
  const floor = candidateAnnualFloor(candidate)
  if (floor != null && role.salary_max != null && role.salary_max >= floor) {
    score += 10; reasons.push('Salary in range')
  }

  // Target-role fit (max 8) — candidate explicitly wants this kind of role
  const targetRoles = (candidate.target_roles || []).map(r => r.toLowerCase().trim()).filter(Boolean)
  const roleTitleText = `${role.title || ''} ${role.department || ''}`.toLowerCase()
  if (targetRoles.some(tr => roleTitleText.includes(tr) || tr.split(/\s+/).some(w => w.length > 3 && roleTitleText.includes(w)))) {
    score += 8; reasons.push('Matches a role they want')
  }

  // Engagement-type fit (max 8)
  const wants = candidate.open_to_engagement || []
  const roleEng = role.engagement_type || 'permanent'
  if (wants.length > 0 && wants.includes(roleEng)) {
    score += 8
    if (roleEng !== 'permanent') reasons.push(`Open to ${roleEng === 'temp' ? 'temp/shift' : roleEng}`)
  }

  // Verification strength (max 10)
  const tier = candidate.verification_tier || 'unverified'
  if (tier === 'premium') { score += 10; reasons.push('Premium verified') }
  else if (tier === 'strong') { score += 8; reasons.push('Strongly verified') }
  else if (tier === 'basic') { score += 5; reasons.push('Verified') }
  else score += Math.round(((candidate.completion_pct || 0) / 100) * 5)

  return { score: Math.min(100, score), reasons: reasons.slice(0, 4) }
}

export function matchLabel(score: number): { label: string; colour: string } {
  if (score >= 75) return { label: 'Strong match', colour: 'bg-emerald-500/15 text-emerald-600' }
  if (score >= 50) return { label: 'Good match', colour: 'bg-[#38BDF8]/10 text-[#0891B2]' }
  if (score >= 30) return { label: 'Possible', colour: 'bg-[#38BDF8]/10 text-[#7C3AED]' }
  return { label: 'Low match', colour: 'bg-[#0E0E1A]/[0.04] text-[#8A8A99]' }
}
