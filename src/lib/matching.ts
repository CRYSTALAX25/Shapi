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
