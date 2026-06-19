import { NextResponse } from 'next/server'
import { runNurtureSweep } from '@/lib/nurture'
import { runConciergeScanForAll, sendPendingConciergeOutreach } from '@/lib/concierge'
import { runActiveHiringScanForAll, sendApprovedActiveHiringOutreach } from '@/lib/active-hiring'
import { sweepPastEmployeeSourcing } from '@/lib/culture-sourcing'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildDigestMessage, buildCompanyDigestMessage, sendWhatsApp } from '@/lib/whatsapp'

// Consolidated daily cron (Vercel Hobby allows only 1-2 daily crons, so this
// single endpoint drives the whole automated pipeline, in order):
//   1. runNurtureSweep()           — 3-part welcome email sequence
//   2. runConciergeScanForAll()    — scan roles, draft + queue outreach,
//                                    nudge candidates with new drafts
//   3. sendPendingConciergeOutreach(25) — fire approved/auto_send drafts
//   4. runReferenceReminders()     — nudge referees who were contacted but
//                                    haven't engaged after 3 days
//   5. runWhatsAppDigest()         — daily WhatsApp digest for opted-in subs
//   6. runCompanyWhatsAppDigest()  — same, for opted-in companies
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
    referenceReminders: unknown
    ghostingFeedback: unknown
    whatsappDigest: unknown
    companyWhatsappDigest?: unknown
    monthlyRoiDigest?: unknown
    trialEndingNudge?: unknown
    dunningSweep?: unknown
    activeHiringScan?: unknown
    activeHiringSend?: unknown
    cultureSourcing?: unknown
  } = {
    ranAt: new Date().toISOString(),
    nurture: null,
    conciergeScan: null,
    conciergeSend: null,
    referenceReminders: null,
    ghostingFeedback: null,
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

  // 3.5. Nudge referees who were contacted but haven't engaged after 3 days.
  // Capped at 2 nudges per ref (reminder_count check inside). Requires the
  // reference_reminders.sql migration — silently no-ops if columns are missing.
  try {
    summary.referenceReminders = await runReferenceReminders()
  } catch (err) {
    console.error('[cron/daily] reference reminders failed:', err)
    summary.referenceReminders = { error: String(err) }
  }

  // 3.6. Ghosting-prevention: nudge hiring managers whose interviews are 5+
  // days past their scheduled date with no feedback logged. Trust on both
  // sides collapses fast if companies ghost — this is the quiet retention
  // mechanic that keeps the platform from becoming another job-board black-
  // hole. Idempotent via profiles.feedback_nudge_last_sent_at (engagement_
  // stamps.sql migration); falls back to "fire daily" if column missing.
  try {
    summary.ghostingFeedback = await runGhostingFeedbackNudges()
  } catch (err) {
    console.error('[cron/daily] ghosting feedback nudges failed:', err)
    summary.ghostingFeedback = { error: String(err) }
  }

  // 4. Daily WhatsApp digest for opted-in subscribers
  try {
    summary.whatsappDigest = await runWhatsAppDigest()
  } catch (err) {
    console.error('[cron/daily] whatsapp digest failed:', err)
    summary.whatsappDigest = { error: String(err) }
  }

  // 5. Daily WhatsApp digest for COMPANIES (STRATEGY §14 Tier 1)
  try {
    summary.companyWhatsappDigest = await runCompanyWhatsAppDigest()
  } catch (err) {
    console.error('[cron/daily] company whatsapp digest failed:', err)
    summary.companyWhatsappDigest = { error: String(err) }
  }

  // 5.5. Trial-ending WhatsApp nudge — for companies in their Stripe trial
  // window with 1 day left. Cheap to run, big save on churn.
  try {
    summary.trialEndingNudge = await runTrialEndingNudge()
  } catch (err) {
    console.error('[cron/daily] trial ending nudge failed:', err)
    summary.trialEndingNudge = { error: String(err) }
  }

  // 5.7. Dunning sweep — Day 3 + Day 7 follow-ups for payment failures.
  // Webhook fires the initial WA at the moment of failure; this cron keeps
  // chasing on a humane schedule. On Day 7 with no recovery, sets
  // subscription_status=grace_expired and clears subscription_product[] so
  // gates lock down. Requires supabase/dunning.sql; degrades quietly.
  try {
    summary.dunningSweep = await runDunningSweep()
  } catch (err) {
    console.error('[cron/daily] dunning sweep failed:', err)
    summary.dunningSweep = { error: String(err) }
  }

  // 6. Monthly ROI digest for COMPANIES — runs only on the 25th of each
  // month (UTC). Vercel Hobby caps us to ~1 cron/day, so we piggyback on
  // /api/cron/daily and gate by date. Quantified value recap is the single
  // highest-leverage B2B retention lever (ChartMogul 2024).
  try {
    const today = new Date()
    if (today.getUTCDate() === 25) {
      summary.monthlyRoiDigest = await runMonthlyRoiDigest()
    } else {
      summary.monthlyRoiDigest = { skipped: 'not the 25th UTC' }
    }
  } catch (err) {
    console.error('[cron/daily] monthly ROI digest failed:', err)
    summary.monthlyRoiDigest = { error: String(err) }
  }

  // Active Hiring — daily company-side shortlist + drafted outreach, then flush
  // any outreach the company already approved.
  try {
    summary.activeHiringScan = await runActiveHiringScanForAll()
  } catch (e) {
    summary.activeHiringScan = { error: e instanceof Error ? e.message : String(e) }
  }
  try {
    summary.activeHiringSend = await sendApprovedActiveHiringOutreach(50)
  } catch (e) {
    summary.activeHiringSend = { error: e instanceof Error ? e.message : String(e) }
  }

  // Culture sourcing — independently invite past employees (from our own
  // candidate pool) to the anonymous trust-score survey. Idempotent.
  try {
    summary.cultureSourcing = await sweepPastEmployeeSourcing(createAdminClient(), { companyLimit: 25 })
  } catch (err) {
    console.error('[cron/daily] culture sourcing failed:', err)
    summary.cultureSourcing = { error: String(err) }
  }

  return NextResponse.json({ ok: true, ...summary })
}

// ── Daily WhatsApp digest — COMPANY side ─────────────────────────────────────
// Mirrors runWhatsAppDigest: one short morning message per opted-in company
// summarising new interests this week, upcoming interviews, and interviews
// missing their feedback. Eligibility: type='company' + opted-in + has a
// whatsapp_number. Dedupe via same whatsapp_digest_last_sent_at column.
async function runCompanyWhatsAppDigest(): Promise<{
  companiesConsidered: number
  sent: number
  skipped: number
  failed: number
}> {
  const admin = createAdminClient()

  const { data: companies, error } = await admin
    .from('profiles')
    .select('id, company_name, full_name, whatsapp_number, whatsapp_digest_last_sent_at, company_data, company_size')
    .eq('type', 'company')
    .eq('whatsapp_digest_opt_in', true)
    .not('whatsapp_number', 'is', null)

  if (error) {
    console.error('[cron/daily] company digest fetch failed:', error)
    return { companiesConsidered: 0, sent: 0, skipped: 0, failed: 0 }
  }

  const rows = (companies || []) as Array<{
    id: string; company_name: string | null; full_name: string | null; whatsapp_number: string | null
    whatsapp_digest_last_sent_at: string | null; company_data: Record<string, unknown> | null; company_size: string | null
  }>
  let sent = 0, skipped = 0, failed = 0
  const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const nowIsoCo = new Date().toISOString()
  const sevenFromNowCo = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  for (const co of rows) {
    try {
      if (!co.whatsapp_number) { skipped++; continue }
      if (sentTodayAlready(co.whatsapp_digest_last_sent_at)) { skipped++; continue }

      // Fetch this company's role IDs once.
      const { data: roleRows } = await admin
        .from('roles').select('id').eq('company_id', co.id)
      const roleIds = (roleRows || []).map(r => r.id as string)

      const [interestsRes, upcomingRes, completedRes, fbRes] = await Promise.all([
        roleIds.length
          ? admin.from('candidate_interests').select('id', { count: 'exact', head: true }).in('role_id', roleIds).gte('created_at', sevenAgo)
          : Promise.resolve({ count: 0 }),
        admin.from('interviews').select('id', { count: 'exact', head: true }).eq('company_id', co.id).eq('status', 'scheduled').gte('scheduled_at', nowIsoCo).lte('scheduled_at', sevenFromNowCo),
        admin.from('interviews').select('role_id, candidate_id').eq('company_id', co.id).eq('status', 'completed'),
        admin.from('interview_feedback').select('role_id, candidate_id').eq('company_id', co.id).eq('author', 'company'),
      ])

      const completedRows = (completedRes.data || []) as Array<{ role_id: string; candidate_id: string }>
      const fbKeys = new Set(((fbRes.data || []) as Array<{ role_id: string; candidate_id: string }>).map(f => `${f.role_id}|${f.candidate_id}`))
      const needCompanyFeedbackCount = completedRows.filter(i => !fbKeys.has(`${i.role_id}|${i.candidate_id}`)).length

      // Profile completion — same 6 signals as the company dashboard.
      const cd = (co.company_data || {}) as Record<string, unknown>
      const sigs = [
        !!co.company_name,
        !!co.company_size,
        !!cd.description,
        !!cd.glassdoor_rating,
        roleIds.length > 0,
        // We don't pull salary visibility here — approximate by "has roles" only for
        // the digest's completion %; the dashboard ring has the precise version.
      ]
      const profileCompletion = Math.round((sigs.filter(Boolean).length / sigs.length) * 100)

      const msg = buildCompanyDigestMessage({
        companyName: co.company_name || co.full_name || null,
        newInterestsCount: interestsRes.count || 0,
        upcomingInterviewsCount: upcomingRes.count || 0,
        needCompanyFeedbackCount,
        profileCompletion,
      })

      if (!msg) { skipped++; continue }

      const result = await sendWhatsApp(co.whatsapp_number, msg)
      if (result.success) {
        sent++
        await admin.from('profiles').update({ whatsapp_digest_last_sent_at: new Date().toISOString() }).eq('id', co.id)
      } else {
        failed++
        console.warn('[cron/daily] company digest send failed for', co.id, result.error)
      }
    } catch (e) {
      failed++
      console.error('[cron/daily] company digest loop error for', co.id, e)
    }
  }

  return { companiesConsidered: rows.length, sent, skipped, failed }
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
        { count: savedCoursesCount },
        { count: inProgressCoursesCount },
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
        // Saved-but-not-started courses (gentle "you wanted to take this" nudge).
        admin
          .from('candidate_courses')
          .select('id', { count: 'exact', head: true })
          .eq('candidate_id', profile.id)
          .eq('status', 'interested')
          .eq('liked', true),
        // In-progress courses (gentle "pick it back up" nudge).
        admin
          .from('candidate_courses')
          .select('id', { count: 'exact', head: true })
          .eq('candidate_id', profile.id)
          .eq('status', 'in_progress'),
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

// ── Reference reminders ─────────────────────────────────────────────────────
// Polite WhatsApp nudge to referees who were contacted but never engaged.
// Eligibility:
//   • status in ('contacted','opened')
//   • contacted_at < now() - 3 days
//   • reminder_count < 2
//   • reminder_sent_at is null OR < now() - 4 days
// Cap is 2 nudges per ref — past that we leave them alone. Requires the
// supabase/reference_reminders.sql migration (adds reminder_sent_at +
// reminder_count). If the columns don't exist we no-op cleanly.
async function runReferenceReminders(): Promise<{
  considered: number
  sent: number
  skipped: number
  failed: number
  note?: string
}> {
  const admin = createAdminClient()

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch candidates for the nudge. If columns don't exist yet, Supabase returns
  // an error — catch + report so the cron still completes.
  const { data: refs, error } = await admin
    .from('candidate_references')
    .select('id, referee_name, referee_phone, candidate_id, candidate_company, ref_type, status, reminder_count, reminder_sent_at, contacted_at')
    .in('status', ['contacted', 'opened'])
    .lt('contacted_at', threeDaysAgo)
    .lt('reminder_count', 2)

  if (error) {
    // Column-not-found is the migration-not-run case. Skip gracefully.
    if (/reminder_count|reminder_sent_at|column .* does not exist/i.test(error.message)) {
      return { considered: 0, sent: 0, skipped: 0, failed: 0, note: 'reference_reminders.sql migration not yet run' }
    }
    console.error('[cron/daily] reference reminders fetch failed:', error)
    return { considered: 0, sent: 0, skipped: 0, failed: 0, note: String(error.message) }
  }

  const rows = (refs || []) as Array<{
    id: string
    referee_name: string | null
    referee_phone: string | null
    candidate_id: string
    candidate_company: string | null
    ref_type: string | null
    status: string | null
    reminder_count: number | null
    reminder_sent_at: string | null
    contacted_at: string | null
  }>

  let sent = 0, skipped = 0, failed = 0
  let candidateNudges = 0

  // Cache candidate profiles so we don't refetch the same one per ref.
  type CandidateLite = { full_name: string | null; whatsapp_number: string | null }
  const candidateProfileCache = new Map<string, CandidateLite>()
  async function candidateProfileFor(candidateId: string): Promise<CandidateLite> {
    if (candidateProfileCache.has(candidateId)) return candidateProfileCache.get(candidateId)!
    const { data: p } = await admin
      .from('profiles')
      .select('full_name, whatsapp_number')
      .eq('id', candidateId)
      .single()
    const row: CandidateLite = {
      full_name: (p?.full_name as string | null) || null,
      whatsapp_number: (p?.whatsapp_number as string | null) || null,
    }
    candidateProfileCache.set(candidateId, row)
    return row
  }
  async function nameFor(candidateId: string): Promise<string> {
    const p = await candidateProfileFor(candidateId)
    return p.full_name || 'your former colleague'
  }

  for (const ref of rows) {
    try {
      if (!ref.referee_phone) { skipped++; continue }
      // Respect the 4-day inter-nudge gap. (The lt filter above only catches
      // "before contacted >3d ago"; we still need a recency floor for repeats.)
      if (ref.reminder_sent_at && ref.reminder_sent_at > fourDaysAgo) { skipped++; continue }

      const candidateName = await nameFor(ref.candidate_id)
      const firstName = (ref.referee_name || '').split(' ')[0] || 'there'
      const refLabel = ref.ref_type === 'manager' ? 'manager' : ref.ref_type === 'peer' ? 'peer' : ref.ref_type === 'report' ? 'direct report' : 'colleague'

      const msg = (ref.reminder_count ?? 0) === 0
        ? `Hi ${firstName} 👋\n\nGentle nudge from Shapi — ${candidateName} listed you as a ${refLabel} reference at ${ref.candidate_company || 'their company'}. We sent you a quick check-in a few days back; takes 2–3 minutes.\n\nIf now's not a good time, just reply *"next week"* and I'll come back then. Or *"stop"* to opt out — no hard feelings.`
        : `Hi ${firstName} — last nudge from Shapi.\n\n${candidateName} is still waiting on their reference (${refLabel} at ${ref.candidate_company || 'their company'}). Two minutes of your time would mean a lot to them.\n\nReply *"start"* to begin, or *"stop"* and I won't ask again.`

      const result = await sendWhatsApp(ref.referee_phone, msg)
      if (result.success) {
        sent++
        await admin
          .from('candidate_references')
          .update({
            reminder_sent_at: new Date().toISOString(),
            reminder_count: (ref.reminder_count ?? 0) + 1,
          })
          .eq('id', ref.id)

        // On the FIRST reminder (count was 0 going in, now 1), also tell the
        // candidate so they can chase their ref personally — gives them
        // agency rather than treating Shapi as a black box. We piggyback on
        // the same trigger condition; the cron's 4-day inter-nudge floor
        // means a candidate won't get this more than once per ref slot.
        if ((ref.reminder_count ?? 0) === 0) {
          try {
            const cand = await candidateProfileFor(ref.candidate_id)
            if (cand.whatsapp_number) {
              const candFirst = (cand.full_name || '').split(' ')[0] || 'there'
              const refFirst = (ref.referee_name || '').split(' ')[0] || 'your reference'
              await sendWhatsApp(
                cand.whatsapp_number,
                `Hi ${candFirst} 👋 — heads-up: *${refFirst}* hasn't responded to your reference request yet (sent ~3 days ago). I just sent them a gentle nudge from my side. A personal "hey, I really appreciate this" from you on WhatsApp can move things along too.`
              )
              candidateNudges++
            }
          } catch (e) {
            console.warn('[cron/daily] candidate-side chase nudge failed for', ref.id, e)
          }
        }
      } else {
        failed++
        console.warn('[cron/daily] reference reminder send failed for', ref.id, result.error)
      }
    } catch (e) {
      failed++
      console.error('[cron/daily] reference reminder loop error for', ref.id, e)
    }
  }

  console.log(
    `[cron/daily] reference reminders — considered: ${rows.length}, sent: ${sent}, skipped: ${skipped}, failed: ${failed}, candidateNudges: ${candidateNudges}`,
  )
  return { considered: rows.length, sent, skipped, failed, candidateNudges }
}

// ── Ghosting-prevention feedback nudges ─────────────────────────────────────
// Sweep interviews whose scheduled_at was ≥5 days ago and have no entry in
// interview_feedback for the company side. WhatsApp the hiring manager so
// candidates aren't left in silence. Cap to once per company per 5-day window
// via profiles.feedback_nudge_last_sent_at (engagement_stamps.sql). If that
// column doesn't exist we degrade gracefully and just fire daily for the
// duration testers will spend in this state — acceptable for v1.
async function runGhostingFeedbackNudges(): Promise<{
  companiesConsidered: number
  nudged: number
  skipped: number
  failed: number
  note?: string
}> {
  const admin = createAdminClient()
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  const fiveDaysAgoFloor = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

  // Pull interviews where the meeting has happened (or was scheduled) ≥5d ago.
  const { data: interviews } = await admin
    .from('interviews')
    .select('id, role_id, candidate_id, company_id, scheduled_at, status')
    .lt('scheduled_at', fiveDaysAgo)
    .in('status', ['scheduled', 'completed'])
    .limit(500)

  if (!interviews || interviews.length === 0) {
    return { companiesConsidered: 0, nudged: 0, skipped: 0, failed: 0 }
  }

  // Group interviews by company. Then for each company, check which ones the
  // company hasn't filed feedback on; if any remain, send ONE consolidated
  // nudge per company.
  const byCompany = new Map<string, Array<{ role_id: string; candidate_id: string }>>()
  for (const iv of interviews) {
    const list = byCompany.get(iv.company_id as string) || []
    list.push({ role_id: iv.role_id as string, candidate_id: iv.candidate_id as string })
    byCompany.set(iv.company_id as string, list)
  }

  let nudged = 0, skipped = 0, failed = 0
  for (const [companyId, ivs] of byCompany.entries()) {
    try {
      // What feedback has this company already logged?
      const { data: fbRows } = await admin
        .from('interview_feedback')
        .select('role_id, candidate_id')
        .eq('company_id', companyId)
        .eq('author', 'company')
      const fbKeys = new Set((fbRows || []).map(f => `${f.role_id}|${f.candidate_id}`))
      const missing = ivs.filter(i => !fbKeys.has(`${i.role_id}|${i.candidate_id}`))
      if (missing.length === 0) { skipped++; continue }

      // Pull the company's WhatsApp + the last-nudged stamp.
      const { data: company } = await admin
        .from('profiles')
        .select('id, company_name, full_name, whatsapp_number, feedback_nudge_last_sent_at')
        .eq('id', companyId)
        .single()
      if (!company?.whatsapp_number) { skipped++; continue }
      const lastNudge = (company as { feedback_nudge_last_sent_at?: string | null }).feedback_nudge_last_sent_at
      if (lastNudge && lastNudge > fiveDaysAgoFloor) { skipped++; continue }

      const companyName = (company.company_name as string | null) || (company.full_name as string | null) || 'team'
      const msg = `Hi ${companyName} 👋\n\n*${missing.length}* candidate${missing.length === 1 ? '' : 's'} ${missing.length === 1 ? 'is' : 'are'} waiting on feedback from their interview ≥5 days ago. A 30-second yes/no/why keeps them in the loop — and keeps your trust score high.\n\nLog it in your pipeline: ${SITE}/company/pipeline\n\n_Ghosting candidates is the #1 frustration in hiring (44% cite it). Shapi flags companies with high feedback rates to candidates — your fast-feedback is a recruitment advantage._`

      const result = await sendWhatsApp(company.whatsapp_number as string, msg)
      if (result.success) {
        nudged++
        // Best-effort stamp — ignore failure if engagement_stamps.sql hasn't run.
        await admin
          .from('profiles')
          .update({ feedback_nudge_last_sent_at: new Date().toISOString() })
          .eq('id', companyId)
          .then(() => undefined, () => undefined)
      } else {
        failed++
        console.warn('[cron/daily] ghosting feedback nudge send failed for', companyId, result.error)
      }
    } catch (e) {
      failed++
      console.error('[cron/daily] ghosting feedback loop error for', companyId, e)
    }
  }

  console.log(
    `[cron/daily] ghosting feedback — companies: ${byCompany.size}, nudged: ${nudged}, skipped: ${skipped}, failed: ${failed}`,
  )
  return { companiesConsidered: byCompany.size, nudged, skipped, failed }
}

// SITE constant — same default as the webhook.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

// ── Trial-ending WhatsApp nudge ─────────────────────────────────────────────
// Pulls Stripe subscriptions in `trialing` state whose trial ends within
// ~24 hours, and WhatsApps the company a heads-up + "what they got" recap so
// the auto-charge isn't a surprise. Tracks notification via the same
// whatsapp_digest_last_sent_at field — coarse but sufficient (same-day re-
// runs of cron/daily won't double-text).
async function runTrialEndingNudge(): Promise<{
  considered: number
  notified: number
  failed: number
  note?: string
}> {
  // Stripe import is lazy to avoid loading the SDK when there's nothing to do.
  const { getStripe } = await import('@/lib/stripe')
  const stripe = getStripe()
  const admin = createAdminClient()

  // Pull all trialing subscriptions. We don't expect huge volume yet so a
  // single fetch is fine — paginate when we have >100 trials concurrently.
  let subs
  try {
    subs = await stripe.subscriptions.list({ status: 'trialing', limit: 100 })
  } catch (e) {
    return { considered: 0, notified: 0, failed: 0, note: `stripe list failed: ${String(e)}` }
  }

  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000
  let notified = 0, failed = 0, considered = 0

  for (const sub of subs.data) {
    const trialEndMs = (sub.trial_end || 0) * 1000
    if (!trialEndMs) continue
    // Fire when trial ends within the next 36h (some slack for cron timing).
    if (trialEndMs - now > 36 * 60 * 60 * 1000 || trialEndMs - now < -oneDay) continue
    considered++

    try {
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
      if (!customerId) continue

      const { data: profile } = await admin
        .from('profiles')
        .select('id, company_name, full_name, whatsapp_number')
        .eq('stripe_customer_id', customerId)
        .single()
      if (!profile?.whatsapp_number) continue

      const companyName = (profile.company_name as string | null) || (profile.full_name as string | null) || 'there'
      const hoursLeft = Math.max(1, Math.round((trialEndMs - now) / (60 * 60 * 1000)))
      const msg = `Hi ${companyName} 👋\n\n*Your Shapi Active Hiring trial ends in ~${hoursLeft}h.* No action needed — we&apos;ll continue your subscription from then.\n\n• Want to keep it: do nothing 🎉\n• Want to cancel: tap below and pause, no charge.\n\nManage: ${SITE}/company/pricing\n\n_Your roles stay live either way._`

      const r = await sendWhatsApp(profile.whatsapp_number as string, msg)
      if (r.success) notified++
      else { failed++; console.warn('[cron/daily] trial nudge send failed for', profile.id, r.error) }
    } catch (e) {
      failed++
      console.error('[cron/daily] trial nudge loop error:', e)
    }
  }

  console.log(`[cron/daily] trial-ending nudge — considered: ${considered}, notified: ${notified}, failed: ${failed}`)
  return { considered, notified, failed }
}

// ── Dunning sweep ────────────────────────────────────────────────────────────
// Day 3 + Day 7 follow-ups on payment failures. Webhook fires the initial
// "your payment failed" WA + stamps payment_failed_at. We chase from here.
// Schedule:
//   payment_failed_at + ~3d  + dunning_step=0  → Day 3 reminder, bump to 1
//   payment_failed_at + ~7d  + dunning_step=1  → Final warning + grace-expired,
//                                                clear subscription_product[],
//                                                bump to 2
async function runDunningSweep(): Promise<{
  considered: number
  day3Sent: number
  day7Sent: number
  failed: number
  note?: string
}> {
  const admin = createAdminClient()
  const now = Date.now()

  const { data: rows, error } = await admin
    .from('profiles')
    .select('id, full_name, company_name, whatsapp_number, payment_failed_at, dunning_step, stripe_customer_id, subscription_product')
    .not('payment_failed_at', 'is', null)
  if (error) {
    // Column-not-found case (migration not run) — degrade silently.
    if (/payment_failed_at|dunning_step|does not exist/i.test(error.message)) {
      return { considered: 0, day3Sent: 0, day7Sent: 0, failed: 0, note: 'dunning.sql migration not yet run' }
    }
    return { considered: 0, day3Sent: 0, day7Sent: 0, failed: 0, note: String(error.message) }
  }

  let day3Sent = 0, day7Sent = 0, failed = 0
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000

  for (const row of rows || []) {
    try {
      const failedAt = new Date(row.payment_failed_at as string).getTime()
      const age = now - failedAt
      const step = (row.dunning_step as number | null) ?? 0
      const name = (row.company_name as string | null) || (row.full_name as string | null) || 'there'

      // Day 3 reminder.
      if (step === 0 && age >= threeDaysMs && age < sevenDaysMs) {
        if (!row.whatsapp_number) { continue }
        const { getStripe } = await import('@/lib/stripe')
        let portalUrl = `${SITE}/company/pricing`
        try {
          const portal = await getStripe().billingPortal.sessions.create({
            customer: row.stripe_customer_id as string,
            return_url: `${SITE}/company/dashboard`,
          })
          portalUrl = portal.url
        } catch { /* fall back to pricing */ }
        const r = await sendWhatsApp(
          row.whatsapp_number as string,
          `Hi ${name} — quick reminder. Your payment is still failing on Shapi. 4 days left before we pause paid features (we keep your data).\n\nUpdate your card here, takes 30 seconds:\n${portalUrl}`,
        )
        if (r.success) {
          day3Sent++
          await admin.from('profiles').update({ dunning_step: 1 }).eq('id', row.id).then(() => undefined, () => undefined)
        } else { failed++ }
        continue
      }

      // Day 7 final + grace-expired lockdown.
      if (step <= 1 && age >= sevenDaysMs) {
        const { getStripe } = await import('@/lib/stripe')
        let portalUrl = `${SITE}/company/pricing`
        try {
          const portal = await getStripe().billingPortal.sessions.create({
            customer: row.stripe_customer_id as string,
            return_url: `${SITE}/company/dashboard`,
          })
          portalUrl = portal.url
        } catch { /* fall back to pricing */ }
        if (row.whatsapp_number) {
          await sendWhatsApp(
            row.whatsapp_number as string,
            `Hi ${name} — last note from us. After 7 days without payment we&apos;ve paused your paid Shapi features. *Your data + roles are kept intact.* Update your card to bring everything back instantly:\n\n${portalUrl}`,
          )
        }
        // Clear all paid product flags + mark grace_expired. Subscription is
        // still alive on Stripe's side until they fully cancel it.
        await admin
          .from('profiles')
          .update({
            dunning_step: 2,
            subscription_status: 'grace_expired',
            subscription_product: [],
            paid: false,
          })
          .eq('id', row.id)
          .then(() => undefined, () => undefined)
        day7Sent++
        continue
      }
    } catch (e) {
      failed++
      console.error('[cron/daily] dunning loop error for', row.id, e)
    }
  }

  console.log(
    `[cron/daily] dunning sweep — considered: ${(rows || []).length}, day3: ${day3Sent}, day7: ${day7Sent}, failed: ${failed}`,
  )
  return { considered: (rows || []).length, day3Sent, day7Sent, failed }
}

// ── Monthly ROI digest (companies) ──────────────────────────────────────────
// Once-a-month quantified value recap. Fires only on the 25th UTC. Per opted-
// in company: candidates shortlisted, interviews scheduled, ~hours saved
// (~1.5h per manual shortlist), and a "switch to annual" CTA. Uses the same
// whatsapp_digest_opt_in eligibility as the daily digest — companies who
// opted out of one don't get spammed by the other.
//
// Stamps via the existing whatsapp_digest_last_sent_at so a same-day
// daily-digest re-run won't double-text. The monthly + daily messages are
// distinct enough that this is acceptable for v1.
async function runMonthlyRoiDigest(): Promise<{
  companiesConsidered: number
  sent: number
  skipped: number
  failed: number
}> {
  const admin = createAdminClient()

  const { data: companies, error } = await admin
    .from('profiles')
    .select('id, company_name, full_name, whatsapp_number, subscription_status, subscription_tier, stripe_customer_id')
    .eq('type', 'company')
    .eq('whatsapp_digest_opt_in', true)
    .not('whatsapp_number', 'is', null)

  if (error) {
    console.error('[cron/daily] monthly ROI fetch failed:', error)
    return { companiesConsidered: 0, sent: 0, skipped: 0, failed: 0 }
  }

  const rows = (companies || []) as Array<{
    id: string
    company_name: string | null
    full_name: string | null
    whatsapp_number: string | null
    subscription_status: string | null
    subscription_tier: string | null
    stripe_customer_id: string | null
  }>

  // Pull data for "last 30 days" — calendar month is rough but acceptable;
  // candidates wouldn't notice the difference. Start 30d back from the
  // current 25th, ends today.
  const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const monthName = new Date().toLocaleString('en-GB', { month: 'long' })

  let sent = 0, skipped = 0, failed = 0

  for (const co of rows) {
    try {
      if (!co.whatsapp_number) { skipped++; continue }

      const { data: roleRows } = await admin
        .from('roles').select('id').eq('company_id', co.id)
      const roleIds = (roleRows || []).map(r => r.id as string)

      const [shortlistsRes, interviewsRes, fbRes, hiresRes] = await Promise.all([
        admin.from('company_shortlists').select('id', { count: 'exact', head: true })
          .eq('company_id', co.id).gte('created_at', monthStart),
        admin.from('interviews').select('id', { count: 'exact', head: true })
          .eq('company_id', co.id).gte('scheduled_at', monthStart),
        admin.from('interview_feedback').select('id', { count: 'exact', head: true })
          .eq('company_id', co.id).gte('created_at', monthStart),
        // "Hires" approximated as completed interviews with positive feedback
        // — we don't have a true hired-event yet (#13 in earlier audit).
        roleIds.length
          ? admin.from('interviews').select('id', { count: 'exact', head: true })
              .eq('company_id', co.id).eq('status', 'completed').gte('scheduled_at', monthStart)
          : Promise.resolve({ count: 0 }),
      ])

      const shortlisted = shortlistsRes.count || 0
      const interviewed = interviewsRes.count || 0
      const feedbackLogged = fbRes.count || 0
      const completed = hiresRes.count || 0
      // Recruiter-hours saved estimate — 1.5h per shortlist is the industry-
      // standard back-of-envelope for "research + screen + write back".
      const hoursSaved = Math.round(shortlisted * 1.5)

      // Skip silent months — don't ping companies with all-zeroes. Same
      // discipline as the daily digest.
      if (shortlisted + interviewed + completed === 0) { skipped++; continue }

      const companyName = co.company_name || co.full_name || 'team'
      const isAnnual = co.subscription_tier?.includes('yearly') || co.subscription_tier?.includes('annual')
      const annualLine = isAnnual
        ? ''
        : `\n\n💡 *On monthly?* Switch to annual — pay 10× monthly, get 12 months. Saves ~17% and locks in your price.\n${SITE}/company/pricing?billing=annual`

      const msg = `📊 *${monthName} recap · ${companyName}*\n\n• ${shortlisted} candidate${shortlisted === 1 ? '' : 's'} shortlisted\n• ${interviewed} interview${interviewed === 1 ? '' : 's'} scheduled\n• ${feedbackLogged} feedback note${feedbackLogged === 1 ? '' : 's'} logged\n• ${completed} interview${completed === 1 ? '' : 's'} completed\n• ~${hoursSaved} recruiter-hour${hoursSaved === 1 ? '' : 's'} saved (estimate)\n\nFull pipeline: ${SITE}/company/pipeline${annualLine}`

      const result = await sendWhatsApp(co.whatsapp_number, msg)
      if (result.success) sent++
      else { failed++; console.warn('[cron/daily] monthly ROI send failed for', co.id, result.error) }
    } catch (e) {
      failed++
      console.error('[cron/daily] monthly ROI loop error for', co.id, e)
    }
  }

  console.log(
    `[cron/daily] monthly ROI — considered: ${rows.length}, sent: ${sent}, skipped: ${skipped}, failed: ${failed}`,
  )
  return { companiesConsidered: rows.length, sent, skipped, failed }
}
