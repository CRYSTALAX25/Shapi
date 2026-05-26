import { NextResponse } from 'next/server'
import { runNurtureSweep } from '@/lib/nurture'
import { runConciergeScanForAll, sendPendingConciergeOutreach } from '@/lib/concierge'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildDigestMessage, sendWhatsApp } from '@/lib/whatsapp'

// Consolidated daily cron (Vercel Hobby allows only 1-2 daily crons, so this
// single endpoint drives the whole automated pipeline, in order):
//   1. runNurtureSweep()           — 3-part welcome email sequence
//   2. runConciergeScanForAll()    — scan roles, draft + queue outreach,
//                                    nudge candidates with new drafts
//   3. sendPendingConciergeOutreach(25) — fire approved/auto_send drafts
//   4. runWhatsAppDigest()         — daily WhatsApp digest for opted-in subs
//
// Each step is wrapped in its own try/catch so one failure doesn't kill the
// rest. Cron-safe GET with the same auth guard as the other cron routes.

// Vercel Hobby caps function duration at 60s; Pro allows up to 300s. We request
// 300 here — if the plan can't honour it, Vercel clamps to its max.
export const maxDuration = 300

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  // Pre-config: if no secret is set, allow (so it works before env is added).
  if (!secret) return true
  const header = request.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true
  const url = new URL(request.url)
  if (url.searchParams.get('key') === secret) return true
  return false
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const summary: {
    ranAt: string
    nurture: unknown
    conciergeScan: unknown
    conciergeSend: unknown
    whatsappDigest: unknown
  } = {
    ranAt: new Date().toISOString(),
    nurture: null,
    conciergeScan: null,
    conciergeSend: null,
    whatsappDigest: null,
  }

  // 1. Welcome nurture sweep
  try {
    summary.nurture = await runNurtureSweep()
  } catch (err) {
    console.error('[cron/daily] nurture sweep failed:', err)
    summary.nurture = { error: String(err) }
  }

  // 2. Concierge scan (drafts + candidate nudges)
  try {
    summary.conciergeScan = await runConciergeScanForAll()
  } catch (err) {
    console.error('[cron/daily] concierge scan failed:', err)
    summary.conciergeScan = { error: String(err) }
  }

  // 3. Send approved Concierge outreach
  try {
    summary.conciergeSend = await sendPendingConciergeOutreach(25)
  } catch (err) {
    console.error('[cron/daily] concierge send failed:', err)
    summary.conciergeSend = { error: String(err) }
  }

  // 4. Daily WhatsApp digest for opted-in subscribers
  try {
    summary.whatsappDigest = await runWhatsAppDigest()
  } catch (err) {
    console.error('[cron/daily] whatsapp digest failed:', err)
    summary.whatsappDigest = { error: String(err) }
  }

  return NextResponse.json({ ok: true, ...summary })
}

// ── Daily WhatsApp digest ────────────────────────────────────────────────────
// One short morning message per candidate summarising what's on their plate:
// upcoming interviews, drafts awaiting approval, interviews missing feedback,
// pending references. Eligibility (inclusive — trial/F&F users get it too):
//   • whatsapp_digest_opt_in = true
//   • whatsapp_number is set
//   • has some paid candidate product (cv_tier set OR subscription_product
//     array non-empty OR legacy paid=true)
// Dedup: we stamp whatsapp_digest_last_sent_at after each successful send and
// skip candidates already stamped within the current UTC day, so a cron that
// fires twice in 24h doesn't double-send.

type DigestProfile = {
  id: string
  full_name: string | null
  whatsapp_number: string | null
  cv_tier: string | null
  subscription_product: string[] | null
  paid: boolean | null
  whatsapp_digest_last_sent_at: string | null
}

function hasAnyCandidateProduct(p: DigestProfile): boolean {
  if (p.cv_tier && p.cv_tier.trim().length > 0) return true
  if (Array.isArray(p.subscription_product) && p.subscription_product.length > 0) return true
  if (p.paid) return true
  return false
}

function sentTodayAlready(lastSentAt: string | null): boolean {
  if (!lastSentAt) return false
  const last = new Date(lastSentAt)
  if (Number.isNaN(last.getTime())) return false
  const now = new Date()
  return (
    last.getUTCFullYear() === now.getUTCFullYear() &&
    last.getUTCMonth() === now.getUTCMonth() &&
    last.getUTCDate() === now.getUTCDate()
  )
}

async function runWhatsAppDigest(): Promise<{
  candidatesConsidered: number
  sent: number
  skipped: number
  failed: number
}> {
  const admin = createAdminClient()

  // Inclusive candidate pull — F&F / trial users included.
  const { data: profiles, error } = await admin
    .from('profiles')
    .select(
      'id, full_name, whatsapp_number, cv_tier, subscription_product, paid, whatsapp_digest_last_sent_at',
    )
    .eq('type', 'candidate')
    .eq('whatsapp_digest_opt_in', true)
    .not('whatsapp_number', 'is', null)

  if (error) {
    console.error('[cron/daily] digest profile fetch failed:', error)
    return { candidatesConsidered: 0, sent: 0, skipped: 0, failed: 0 }
  }

  const candidates = (profiles || []) as DigestProfile[]
  let sent = 0
  let skipped = 0
  let failed = 0

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const nowIso = new Date().toISOString()

  for (const profile of candidates) {
    try {
      if (!profile.whatsapp_number) {
        skipped++
        continue
      }
      if (!hasAnyCandidateProduct(profile)) {
        skipped++
        continue
      }
      // Duplicate-send guard — skip if we've already sent the digest today.
      if (sentTodayAlready(profile.whatsapp_digest_last_sent_at)) {
        skipped++
        continue
      }

      // Counts — kept cheap (head:true returns count only, not rows).
      const [
        { count: upcomingInterviewsCount },
        { count: needFeedbackCount },
        { count: pendingDraftsCount },
        { count: pendingRefsCount },
      ] = await Promise.all([
        admin
          .from('interviews')
          .select('id', { count: 'exact', head: true })
          .eq('candidate_id', profile.id)
          .eq('status', 'scheduled')
          .gte('scheduled_at', nowIso)
          .lte('scheduled_at', sevenDaysFromNow),
        admin
          .from('interviews')
          .select('id', { count: 'exact', head: true })
          .eq('candidate_id', profile.id)
          .eq('status', 'completed'),
        admin
          .from('concierge_queue')
          .select('id', { count: 'exact', head: true })
          .eq('candidate_id', profile.id)
          .eq('status', 'pending_approval'),
        admin
          .from('candidate_references')
          .select('id', { count: 'exact', head: true })
          .eq('candidate_id', profile.id)
          .eq('status', 'pending'),
      ])

      // 'needFeedbackCount' over-counts (we don't subtract interviews the candidate
      // has already left feedback for) — refine with a second query when there's
      // anything to subtract, so an empty bucket doesn't pay the round-trip cost.
      let refinedNeedFeedback = needFeedbackCount || 0
      if (refinedNeedFeedback > 0) {
        const { data: leftFeedback } = await admin
          .from('interview_feedback')
          .select('role_id')
          .eq('candidate_id', profile.id)
          .eq('author', 'candidate')
        const completedWithFeedback = new Set(
          (leftFeedback || []).map(r => r.role_id as string),
        )
        if (completedWithFeedback.size > 0) {
          // Pull the completed interviews' role_ids and subtract.
          const { data: completed } = await admin
            .from('interviews')
            .select('role_id')
            .eq('candidate_id', profile.id)
            .eq('status', 'completed')
          const completedCount = completed?.length || 0
          const stillNeed = (completed || []).filter(
            iv => !completedWithFeedback.has(iv.role_id as string),
          ).length
          // Only refine if the subtraction is well-defined.
          refinedNeedFeedback = stillNeed
          if (completedCount === 0) refinedNeedFeedback = 0
        }
      }

      const message = buildDigestMessage({
        firstName: profile.full_name,
        upcomingInterviewsCount: upcomingInterviewsCount || 0,
        needFeedbackCount: refinedNeedFeedback,
        pendingDraftsCount: pendingDraftsCount || 0,
        pendingRefsCount: pendingRefsCount || 0,
      })

      if (!message) {
        // Nothing to say today — don't ping, don't stamp (so they can still get
        // a digest later in the day if state changes by a re-run).
        skipped++
        continue
      }

      const result = await sendWhatsApp(profile.whatsapp_number, message)
      if (result.success) {
        sent++
        // Stamp last-sent so a re-run today won't duplicate.
        await admin
          .from('profiles')
          .update({ whatsapp_digest_last_sent_at: new Date().toISOString() })
          .eq('id', profile.id)
      } else {
        failed++
        console.error('[cron/daily] digest send failed for', profile.id, result.error)
      }
    } catch (err) {
      failed++
      console.error('[cron/daily] digest loop error for', profile.id, err)
    }
  }

  console.log(
    `[cron/daily] whatsapp digest — considered: ${candidates.length}, sent: ${sent}, skipped: ${skipped}, failed: ${failed}`,
  )
  return { candidatesConsidered: candidates.length, sent, skipped, failed }
}
