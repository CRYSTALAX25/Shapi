// Welcome nurture sweep — walks candidates through the 3-part welcome sequence:
//   stage 0 → 1  immediately (welcome)
//   stage 1 → 2  ~2 days after signup (career pivot map)
//   stage 2 → 3  ~5 days after signup (social proof)
// Idempotent: welcome_stage is only incremented after a successful send, so a
// given stage is never double-sent even if the sweep overlaps or retries.

import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendWelcomeEmail,
  sendPivotMapEmail,
  sendSocialProofEmail,
} from '@/lib/email'

const DAY_MS = 24 * 60 * 60 * 1000
const STAGE_AGE_MS: Record<number, number> = {
  0: 0,            // welcome — send immediately
  1: 2 * DAY_MS,   // pivot map — at least ~2 days old
  2: 5 * DAY_MS,   // social proof — at least ~5 days old
}
const BATCH = 50

export async function runNurtureSweep(): Promise<{
  sent: number
  byStage: Record<string, number>
  error?: string
}> {
  const admin = createAdminClient()

  // Candidate profiles still in the sequence. type='candidate' or null (no type set yet).
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, full_name, type, created_at, welcome_stage')
    .lt('welcome_stage', 3)
    .or('type.eq.candidate,type.is.null')
    .order('created_at', { ascending: true })
    .limit(BATCH)

  if (error) {
    return { sent: 0, byStage: { '1': 0, '2': 0, '3': 0 }, error: error.message }
  }

  const now = Date.now()
  let sent = 0
  const byStage: Record<string, number> = { '1': 0, '2': 0, '3': 0 }

  for (const profile of profiles || []) {
    const stage = profile.welcome_stage ?? 0
    if (stage >= 3) continue

    const ageMs = now - new Date(profile.created_at).getTime()
    if (ageMs < (STAGE_AGE_MS[stage] ?? Infinity)) continue

    // Resolve the user's email from Supabase Auth.
    const { data: authUser } = await admin.auth.admin.getUserById(profile.id)
    const email = authUser?.user?.email
    if (!email) continue // guard: skip if no email

    const name = profile.full_name || ''
    const nextStage = stage + 1

    try {
      if (stage === 0) await sendWelcomeEmail({ to: email, name })
      else if (stage === 1) await sendPivotMapEmail({ to: email, name })
      else if (stage === 2) await sendSocialProofEmail({ to: email, name })
    } catch (err) {
      console.error('[nurture] send failed for', profile.id, err)
      continue // don't advance stage on failure — retried next run
    }

    // Only advance after a successful send → never double-send a stage.
    const { error: updateError } = await admin
      .from('profiles')
      .update({ welcome_stage: nextStage })
      .eq('id', profile.id)

    if (updateError) {
      console.error('[nurture] stage update failed for', profile.id, updateError)
      continue
    }

    sent++
    byStage[String(nextStage)]++
  }

  return { sent, byStage }
}
