// Centralised references logic — completion scoring, profile_live recomputation,
// test mode routing. Imported by both API routes and webhook to keep behaviour
// consistent.

import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic } from '@/lib/anthropic'

export type RefRow = {
  id: string
  candidate_id: string
  job_slot: number
  ref_type: 'manager' | 'colleague' | 'stakeholder' | 'peer'
  status: string
}

// Platform access: Pro CV purchase grants access to references, verification,
// AI cross-check, Roles Board visibility. Kit users only get the CV download.
export function hasPlatformAccess(profile: { cv_tier?: string | null; paid?: boolean | null; subscription_tier?: string | null } | null): boolean {
  if (!profile) return false
  return profile.cv_tier === 'pro' || !!profile.paid || !!profile.subscription_tier
}

export type JobCompletionScore = {
  jobsComplete: 0 | 1 | 2
  bonusPct: 0 | 10 | 25
  job1: { manager: boolean; colleague: boolean; stakeholder: boolean; complete: boolean }
  job2: { manager: boolean; colleague: boolean; stakeholder: boolean; complete: boolean }
}

// A job_slot is "complete" only when all 3 references for it
// (manager + colleague + stakeholder) are status=completed.
// Per Ana's spec: 0 jobs → 0%, 1 job → +10%, 2 jobs → +25% (replaces the
// 25% slot reserved for profile_live in the 4×25% layout).
export async function computeJobCompletionScore(candidateId: string): Promise<JobCompletionScore> {
  const admin = createAdminClient()
  const { data: refs } = await admin
    .from('candidate_references')
    .select('id, job_slot, ref_type, status')
    .eq('candidate_id', candidateId)

  const rows: RefRow[] = (refs as RefRow[]) || []
  const completed = rows.filter(r => r.status === 'completed')

  const job = (slot: 1 | 2) => {
    const slotCompleted = completed.filter(r => r.job_slot === slot)
    const manager = slotCompleted.some(r => r.ref_type === 'manager')
    const colleague = slotCompleted.some(r => r.ref_type === 'colleague')
    const stakeholder = slotCompleted.some(r => r.ref_type === 'stakeholder')
    return { manager, colleague, stakeholder, complete: manager && colleague && stakeholder }
  }

  const job1 = job(1)
  const job2 = job(2)
  const jobsComplete = (job1.complete ? 1 : 0) + (job2.complete ? 1 : 0) as 0 | 1 | 2
  const bonusPct = jobsComplete === 2 ? 25 : jobsComplete === 1 ? 10 : 0

  return { jobsComplete, bonusPct, job1, job2 }
}

// Auto-flip profile_live=true when both jobs are fully verified.
// Called after any reference is marked completed (in submit + webhook).
export async function recomputeProfileLive(candidateId: string): Promise<{ profileLive: boolean }> {
  const score = await computeJobCompletionScore(candidateId)
  if (score.jobsComplete === 2) {
    const admin = createAdminClient()
    await admin
      .from('profiles')
      .update({ profile_live: true, updated_at: new Date().toISOString() })
      .eq('id', candidateId)
    return { profileLive: true }
  }
  return { profileLive: false }
}

// ─── Verification tier ───────────────────────────────────────────────────────
// Standard / Premium badges based on what's been completed.
// Premium is gated on the AI cross-check pass (no flagged conflicts).
//
// Basic    = 1 past-manager chain (3 refs) complete                       → 85%
// Strong   = 2 past-manager chains complete + 1 current-role peer        → 100%
// Premium  = Strong + AI cross-check report with no flagged conflicts    → 100% gold

export type VerificationTier = 'unverified' | 'basic' | 'strong' | 'premium'

export async function computeVerificationTier(candidateId: string): Promise<{
  tier: VerificationTier
  hasCrossCheck: boolean
  flaggedConflicts: number
}> {
  const admin = createAdminClient()
  const [{ data: refs }, { data: profile }] = await Promise.all([
    admin.from('candidate_references')
      .select('ref_type, job_slot, status, is_current_role')
      .eq('candidate_id', candidateId),
    admin.from('profiles')
      .select('verification_report')
      .eq('id', candidateId)
      .single(),
  ])
  const rows = (refs as Array<{ ref_type: string; job_slot: number; status: string; is_current_role: boolean | null }>) || []
  const completed = rows.filter(r => r.status === 'completed')

  const jobComplete = (slot: 1 | 2) => {
    const slotDone = completed.filter(r => r.job_slot === slot && !r.is_current_role)
    return slotDone.some(r => r.ref_type === 'manager')
      && slotDone.some(r => r.ref_type === 'colleague')
      && slotDone.some(r => r.ref_type === 'stakeholder')
  }

  const jobsComplete = (jobComplete(1) ? 1 : 0) + (jobComplete(2) ? 1 : 0)
  const peerComplete = completed.some(r => r.ref_type === 'peer' && r.is_current_role)
  const report = profile?.verification_report as { conflicts?: Array<unknown> } | null
  const hasCrossCheck = !!report
  const flaggedConflicts = report?.conflicts?.length ?? 0

  let tier: VerificationTier = 'unverified'
  if (jobsComplete >= 2 && peerComplete && hasCrossCheck && flaggedConflicts === 0) {
    tier = 'premium'
  } else if (jobsComplete >= 2 && peerComplete) {
    tier = 'strong'
  } else if (jobsComplete >= 1) {
    tier = 'basic'
  }

  return { tier, hasCrossCheck, flaggedConflicts }
}

// ─── AI cross-check — the moat ───────────────────────────────────────────────
// Once all references are in, Claude analyses the structured responses across
// all referees + the candidate's CV claims. Produces a Verification Report:
//   - claims_verified: skills/achievements multiple referees confirmed
//   - claims_unverified: candidate-only claims with no referee corroboration
//   - conflicts: where referees disagreed (e.g. team player vs difficult)
//   - top_skills: most cited skills across all references
//   - tone_summary: overall sentiment
// Stored in profiles.verification_report jsonb. Powers the Premium tier and
// (eventually) the paid company reports.

export type VerificationReport = {
  generated_at: string
  reference_count: number
  claims_verified: string[]
  claims_unverified: string[]
  conflicts: Array<{ topic: string; perspectives: string[]; note: string }>
  top_skills: string[]
  tone_summary: string
  summary_en: string
}

export async function runVerificationCrossCheck(candidateId: string): Promise<VerificationReport | null> {
  const admin = createAdminClient()
  const [{ data: refs }, { data: profile }] = await Promise.all([
    admin.from('candidate_references')
      .select('ref_type, is_current_role, referee_name, candidate_company, responses, status')
      .eq('candidate_id', candidateId)
      .eq('status', 'completed'),
    admin.from('profiles')
      .select('full_name, headline, summary, skills, work_history')
      .eq('id', candidateId)
      .single(),
  ])

  if (!refs || refs.length === 0) return null

  const anthropic = getAnthropic()

  const refSummaries = refs.map((r, i) => {
    const responses = r.responses as Record<string, unknown> | null
    const lines: string[] = []
    lines.push(`REFEREE ${i + 1} (${r.ref_type}${r.is_current_role ? ', current role' : ''}) — ${r.referee_name} at ${r.candidate_company || 'unknown'}`)
    if (responses) {
      // Use English version where available, fall back to source
      for (const [k, v] of Object.entries(responses)) {
        if (k.endsWith('_en') || ['language', 'language_code'].includes(k)) continue
        const enKey = `${k}_en`
        const display = (responses[enKey] as string) || (v as string)
        if (display) lines.push(`  • ${k}: ${display}`)
      }
    }
    return lines.join('\n')
  }).join('\n\n')

  const cvSummary = `
CANDIDATE: ${profile?.full_name || '?'}
HEADLINE: ${profile?.headline || '?'}
SUMMARY: ${(profile?.summary as string) || '?'}
SKILLS LISTED: ${(profile?.skills as string[] || []).join(', ')}
WORK HISTORY: ${JSON.stringify(profile?.work_history || []).slice(0, 1500)}
`

  const prompt = `You are an independent reference auditor. Compare what a candidate claims about themselves on their CV vs what their references actually said. Produce a fair, balanced Verification Report.

${cvSummary}

═══ REFERENCE RESPONSES (${refs.length} total) ═══
${refSummaries}

═══ YOUR ANALYSIS ═══

1. CLAIMS VERIFIED: which skills/achievements from the CV were confirmed by AT LEAST 1 referee? List up to 6, in candidate's own terms.

2. CLAIMS UNVERIFIED: which skills/achievements on the CV did NO referee mention? List up to 4. Be specific — don't include items obviously outside the referees' visibility (e.g. side projects).

3. CONFLICTS: did any referees DISAGREE on the same topic (e.g. one said "great team player", another said "preferred working solo")? List up to 3. Each is { topic, perspectives: ["referee 1 said X", "referee 2 said Y"], note: "1-sentence reconciliation" }. Empty array if no conflicts.

4. TOP SKILLS: most-cited skills across all references (max 5). Use the candidate's own vocabulary where possible.

5. TONE SUMMARY: 1 sentence on overall referee sentiment ("Uniformly positive", "Positive with one constructive note on X", "Mixed", etc.)

6. SUMMARY: 2-3 sentences for the public profile — what hiring managers will see at a glance. Highlight strongest verified evidence.

Return ONLY valid JSON in this exact shape:
{
  "claims_verified": ["...", "..."],
  "claims_unverified": ["...", "..."],
  "conflicts": [{ "topic": "...", "perspectives": ["...", "..."], "note": "..." }],
  "top_skills": ["...", "..."],
  "tone_summary": "...",
  "summary_en": "..."
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[verification/crosscheck] no JSON in response')
      return null
    }
    const parsed = JSON.parse(match[0])
    const report: VerificationReport = {
      generated_at: new Date().toISOString(),
      reference_count: refs.length,
      claims_verified: parsed.claims_verified || [],
      claims_unverified: parsed.claims_unverified || [],
      conflicts: parsed.conflicts || [],
      top_skills: parsed.top_skills || [],
      tone_summary: parsed.tone_summary || '',
      summary_en: parsed.summary_en || '',
    }
    await admin.from('profiles').update({
      verification_report: report,
      updated_at: new Date().toISOString(),
    }).eq('id', candidateId)
    return report
  } catch (err) {
    console.error('[verification/crosscheck] failed:', err)
    return null
  }
}

// Persist the computed tier on the profile so dashboard/profile queries can read
// it without recomputing. Call after every reference completion.
export async function updateVerificationTier(candidateId: string): Promise<VerificationTier> {
  const admin = createAdminClient()
  const { tier } = await computeVerificationTier(candidateId)
  await admin.from('profiles').update({
    verification_tier: tier,
    updated_at: new Date().toISOString(),
  }).eq('id', candidateId)
  return tier
}

// Test mode helper — when a reference row is is_test_outreach=true, route all
// outreach (WhatsApp + email) to the candidate themselves so they can play all
// 3 roles and validate the full chain without bothering real contacts.
//
// Returns the phone/email that should actually be used for outreach, plus a
// boolean indicating whether the row is in test mode.
export async function resolveOutreachContact(
  candidateId: string,
  rowPhone: string | null,
  rowEmail: string | null,
  isTestOutreach: boolean,
): Promise<{ phone: string | null; email: string | null; testMode: boolean }> {
  if (!isTestOutreach) {
    return { phone: rowPhone, email: rowEmail, testMode: false }
  }

  const admin = createAdminClient()
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin.from('profiles').select('whatsapp_number').eq('id', candidateId).single(),
    admin.auth.admin.getUserById(candidateId),
  ])

  return {
    phone: (profile?.whatsapp_number as string) || rowPhone,
    email: authUser?.user?.email || rowEmail,
    testMode: true,
  }
}
