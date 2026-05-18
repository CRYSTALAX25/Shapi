// Centralised references logic — completion scoring, profile_live recomputation,
// test mode routing. Imported by both API routes and webhook to keep behaviour
// consistent.

import { createAdminClient } from '@/lib/supabase/admin'

export type RefRow = {
  id: string
  candidate_id: string
  job_slot: number
  ref_type: 'manager' | 'colleague' | 'stakeholder'
  status: string
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
