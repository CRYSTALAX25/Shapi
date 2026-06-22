import type { SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { Resend } from 'resend'
import { domainFromUrl, findHiringManager } from '@/lib/enrichment'

// ─────────────────────────────────────────────────────────────────────────────
// Cross-sell ("Trojan candidate", Direction A) — the data + logic layer.
// SPEC_ACTIVE_CROSSSELL.md.
//
// A candidate imports an external job they're chasing → we enrich the hiring
// manager (Hunter, see enrichment.ts) → email them an ANONYMIZED, verified
// candidate teaser for that exact role → the company signs up free to unlock the
// candidate. Callers (API routes + cron) own the admin client and pass it in.
//
// Anti-spam / compliance is built in: candidate consent gate (teaser_approved),
// a global suppression list, ≤1 send per company-domain per 90 days, a daily
// send cap, and a one-click unsubscribe in every email. TEST MODE (OUTREACH_FROM
// unset) redirects every send to the candidate's own inbox so the whole loop is
// safe to exercise without contacting a real manager.
// ─────────────────────────────────────────────────────────────────────────────

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'
const COMPANY_COOLDOWN_DAYS = 90

// ── Types ───────────────────────────────────────────────────────────────────

// ANONYMIZED — never include the candidate's name or current employer.
export type TeaserPayload = {
  headline: string
  strengths: string[]
  verification_tier: string | null
  ai_tier: string | null
  reference_count: number
  axis_proofs?: Array<{ axis: string; proof: string }>
}

type OutreachRow = {
  id: string
  candidate_id: string
  active_application_id: string | null
  company_name: string
  company_domain: string | null
  target_role: string | null
  hm_name: string | null
  hm_email: string | null
  hm_title: string | null
  status: string
  unlock_token: string
  teaser_approved: boolean
}

// ── Resend (inline — we do not touch src/lib/email.ts) ──────────────────────

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

// ── Teaser ──────────────────────────────────────────────────────────────────

// Map a skill_quadrant / work_style assessment into Head/Hands/Spark/Heart
// axis proofs. Only axes the candidate is genuinely strong on (>= 6/10) surface.
const AXIS_LABELS: Record<string, string> = {
  head: 'Head',
  hands: 'Hands',
  spark: 'Spark',
  heart: 'Heart',
}

function axisProofsFromQuadrant(quadrant: unknown): Array<{ axis: string; proof: string }> {
  if (!quadrant || typeof quadrant !== 'object') return []
  const q = quadrant as Record<string, unknown>
  const out: Array<{ axis: string; proof: string }> = []
  for (const key of ['head', 'hands', 'spark', 'heart']) {
    const score = Number(q[key])
    if (Number.isFinite(score) && score >= 6) {
      out.push({ axis: AXIS_LABELS[key], proof: `Assessed strong on ${AXIS_LABELS[key]} (${score}/10)` })
    }
  }
  return out
}

// Build the anonymized teaser the hiring manager (and unlock page) sees. Reads
// the candidate's verified profile + counts completed references. NEVER includes
// name or any identifying current employer.
export async function buildTeaser(admin: SupabaseClient, candidateId: string): Promise<TeaserPayload> {
  const { data: profile } = await admin
    .from('profiles')
    .select('headline, summary, verification_tier, ai_tier, skill_quadrant, work_style')
    .eq('id', candidateId)
    .single()

  const { count: refCount } = await admin
    .from('candidate_references')
    .select('id', { count: 'exact', head: true })
    .eq('candidate_id', candidateId)
    .eq('status', 'completed')

  // Strengths from verified data: the AI cross-check's most-cited skills if we
  // have them, else the candidate's headline as a single line. Pull most-cited
  // strengths off the verification_report when present.
  const strengths: string[] = []
  const { data: report } = await admin
    .from('profiles')
    .select('verification_report')
    .eq('id', candidateId)
    .single()
  const vr = report?.verification_report as { top_skills?: string[] } | null
  if (Array.isArray(vr?.top_skills)) {
    for (const s of vr!.top_skills!.slice(0, 5)) if (typeof s === 'string' && s.trim()) strengths.push(s.trim())
  }

  const quadrant =
    (profile?.skill_quadrant as unknown) ??
    ((profile?.work_style as { scores?: unknown } | null)?.scores as unknown) ??
    null

  return {
    headline: (profile?.headline as string) || 'A verified Shapi candidate',
    strengths,
    verification_tier: (profile?.verification_tier as string) ?? null,
    ai_tier: (profile?.ai_tier as string) ?? null,
    reference_count: refCount ?? 0,
    axis_proofs: axisProofsFromQuadrant(quadrant),
  }
}

// ── Create / list / withdraw (candidate-facing, via admin-backed API) ───────

// Create a queued outreach from an imported external job. The candidate must
// own the active_applications row; consent (teaser_approved) is implied by the
// UI approve-click that calls this. Dedupes on (candidate, domain, role).
export async function createOutreach(
  admin: SupabaseClient,
  args: { candidateId: string; activeApplicationId: string },
): Promise<{ ok: true; id: string; status: string; teaser: TeaserPayload } | { ok: false; error: string }> {
  const { data: app } = await admin
    .from('active_applications')
    .select('id, candidate_id, company_name, job_title, job_url, hiring_manager_name')
    .eq('id', args.activeApplicationId)
    .single()

  if (!app) return { ok: false, error: 'application not found' }
  if (app.candidate_id !== args.candidateId) return { ok: false, error: 'not your application' }

  const companyDomain = domainFromUrl(app.job_url as string | null)
  const targetRole = (app.job_title as string) || null
  const unlockToken = crypto.randomBytes(24).toString('hex')

  const { data: inserted, error } = await admin
    .from('crosssell_outreach')
    .insert({
      candidate_id: args.candidateId,
      active_application_id: args.activeApplicationId,
      direction: 'A',
      company_name: (app.company_name as string) || 'Unknown company',
      company_domain: companyDomain,
      target_role: targetRole,
      hm_name: (app.hiring_manager_name as string) || null,
      hm_source: app.hiring_manager_name ? 'posting' : null,
      teaser_approved: true,
      status: 'queued',
      unlock_token: unlockToken,
    })
    .select('id, status')
    .single()

  if (error) {
    // 23505 = unique_violation on the (candidate, domain, role) dedupe index.
    if ((error as { code?: string }).code === '23505') return { ok: false, error: 'already queued' }
    console.error('[crosssell] createOutreach insert failed:', error)
    return { ok: false, error: 'could not queue outreach' }
  }

  const teaser = await buildTeaser(admin, args.candidateId)
  return { ok: true, id: inserted!.id as string, status: inserted!.status as string, teaser }
}

export async function getCandidateOutreach(
  admin: SupabaseClient,
  candidateId: string,
): Promise<Array<{ id: string; company_name: string; target_role: string | null; status: string }>> {
  const { data } = await admin
    .from('crosssell_outreach')
    .select('id, company_name, target_role, status')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })
  return (data || []).map(r => ({
    id: r.id as string,
    company_name: r.company_name as string,
    target_role: (r.target_role as string) ?? null,
    status: r.status as string,
  }))
}

// Withdraw an outreach the candidate owns — only before it has been sent.
export async function withdrawOutreach(
  admin: SupabaseClient,
  args: { id: string; candidateId: string },
): Promise<{ ok: boolean }> {
  const { data, error } = await admin
    .from('crosssell_outreach')
    .delete()
    .eq('id', args.id)
    .eq('candidate_id', args.candidateId)
    .in('status', ['draft', 'queued', 'enriching', 'ready', 'ready_no_email'])
    .select('id')
  if (error) {
    console.error('[crosssell] withdrawOutreach failed:', error)
    return { ok: false }
  }
  return { ok: (data?.length ?? 0) > 0 }
}

// ── Token lookup (unlock page) ──────────────────────────────────────────────

export async function getOutreachByToken(
  admin: SupabaseClient,
  token: string,
): Promise<{
  id: string
  company_name: string
  target_role: string | null
  status: string
  teaser: TeaserPayload
  candidate_id: string
} | null> {
  const { data: row } = await admin
    .from('crosssell_outreach')
    .select('id, company_name, target_role, status, candidate_id')
    .eq('unlock_token', token)
    .single()
  if (!row) return null

  const teaser = await buildTeaser(admin, row.candidate_id as string)
  return {
    id: row.id as string,
    company_name: row.company_name as string,
    target_role: (row.target_role as string) ?? null,
    status: row.status as string,
    teaser,
    candidate_id: row.candidate_id as string,
  }
}

// ── Suppression ─────────────────────────────────────────────────────────────

export async function isSuppressed(
  admin: SupabaseClient,
  args: { email?: string | null; domain?: string | null },
): Promise<boolean> {
  const checks: Array<{ scope: 'email' | 'domain'; value: string }> = []
  if (args.email) checks.push({ scope: 'email', value: args.email.toLowerCase().trim() })
  if (args.domain) checks.push({ scope: 'domain', value: args.domain.toLowerCase().trim() })
  if (checks.length === 0) return false

  for (const c of checks) {
    const { data } = await admin
      .from('outreach_suppression')
      .select('id')
      .eq('scope', c.scope)
      .ilike('value', c.value)
      .limit(1)
    if (data && data.length > 0) return true
  }
  return false
}

export async function addSuppression(
  admin: SupabaseClient,
  args: { value: string; scope: 'email' | 'domain'; reason: string },
): Promise<void> {
  const value = args.value.toLowerCase().trim()
  if (!value) return
  const { error } = await admin
    .from('outreach_suppression')
    .insert({ value, scope: args.scope, reason: args.reason })
  // Unique-index conflict = already suppressed; that's fine.
  if (error && (error as { code?: string }).code !== '23505') {
    console.error('[crosssell] addSuppression failed:', error)
  }
}

// ── The worker: enrich → cap/suppression check → send ───────────────────────

function teaserEmailHtml(args: {
  teaser: TeaserPayload
  targetRole: string | null
  unlockUrl: string
  unsubscribeUrl: string
}): string {
  const { teaser, targetRole, unlockUrl, unsubscribeUrl } = args
  const roleLine = targetRole ? `your ${escapeHtml(targetRole)}` : 'your open role'

  const strengthChips =
    teaser.strengths.length > 0
      ? `<div style="margin:16px 0">${teaser.strengths
          .map(
            s =>
              `<span style="display:inline-block;margin:0 6px 6px 0;padding:5px 12px;background:rgba(56,189,248,0.1);color:#38BDF8;font-size:13px;font-weight:700;border-radius:100px">${escapeHtml(
                s,
              )}</span>`,
          )
          .join('')}</div>`
      : ''

  const facts: string[] = []
  if (teaser.verification_tier) facts.push(`Verification: <strong style="color:#34D399">${escapeHtml(teaser.verification_tier)}</strong>`)
  if (teaser.reference_count > 0)
    facts.push(`<strong style="color:#34D399">${teaser.reference_count}</strong> independently sourced reference${teaser.reference_count !== 1 ? 's' : ''}`)
  if (teaser.ai_tier) facts.push(`AI: <strong style="color:#34D399">${escapeHtml(teaser.ai_tier)}</strong>`)
  const factsBlock = facts.length
    ? `<p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.7;margin:0 0 16px">${facts.join(' · ')}</p>`
    : ''

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060609;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="margin-bottom:32px">
      <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;background:linear-gradient(135deg,#38BDF8,#34D399);-webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</span>
    </div>
    <div style="background:#0D0C14;border:1px solid rgba(56,189,248,0.15);border-radius:16px;padding:32px">
      <h1 style="color:#fff;font-size:21px;font-weight:900;margin:0 0 12px">A verified candidate is pursuing ${roleLine}</h1>
      <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 8px">${escapeHtml(teaser.headline)}</p>
      ${factsBlock}
      ${strengthChips}
      <p style="color:rgba(255,255,255,0.45);font-size:13px;line-height:1.6;margin:0 0 20px">A real candidate asked us to share their verified profile with you for ${roleLine}. Their references were sourced independently by Shapi — the candidate didn't pick them.</p>
      <a href="${unlockUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#38BDF8,#34D399);color:#060609;font-size:14px;font-weight:900;border-radius:100px;text-decoration:none">See their profile — free →</a>
    </div>
    <p style="color:rgba(255,255,255,0.25);font-size:12px;margin-top:24px;text-align:center;line-height:1.6">
      Shapi · the verified hiring platform · ${SITE}<br>
      You received this because a verified candidate asked us to share their profile with you.<br>
      <a href="${unsubscribeUrl}" style="color:rgba(255,255,255,0.35);text-decoration:underline">Unsubscribe / don't contact me</a>
    </p>
  </div>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

// Process the outreach queue: enrich the 'queued', then send the 'ready' subject
// to caps + suppression. Idempotent and safe to run on a schedule.
export async function processOutreachQueue(
  admin: SupabaseClient,
  opts?: { dailyCap?: number },
): Promise<{ enriched: number; sent: number; suppressed: number; ready_no_email: number }> {
  const dailyCap = opts?.dailyCap ?? (Number(process.env.OUTREACH_DAILY_CAP) || 25)
  let enriched = 0
  let sent = 0
  let suppressed = 0
  let readyNoEmail = 0

  // ── 1. Enrich queued rows ────────────────────────────────────────────────
  const { data: queued } = await admin
    .from('crosssell_outreach')
    .select(
      'id, candidate_id, active_application_id, company_name, company_domain, target_role, hm_name, hm_email, hm_title, status, unlock_token, teaser_approved',
    )
    .eq('status', 'queued')
    .eq('teaser_approved', true)

  for (const row of (queued as OutreachRow[]) || []) {
    let jobUrl: string | null = null
    if (row.active_application_id) {
      const { data: app } = await admin
        .from('active_applications')
        .select('job_url')
        .eq('id', row.active_application_id)
        .single()
      jobUrl = (app?.job_url as string) ?? null
    }

    const hm = await findHiringManager({
      companyName: row.company_name,
      companyDomain: row.company_domain,
      jobUrl,
      hmName: row.hm_name,
    })

    const hasEmail = !!hm.email
    const { error } = await admin
      .from('crosssell_outreach')
      .update({
        company_domain: hm.domain ?? row.company_domain,
        hm_name: hm.name ?? row.hm_name,
        hm_email: hm.email,
        hm_title: hm.title ?? row.hm_title,
        hm_source: hm.source ?? (row.hm_name ? 'posting' : null),
        status: hasEmail ? 'ready' : 'ready_no_email',
      })
      .eq('id', row.id)
      .eq('status', 'queued')
    if (!error) {
      enriched++
      if (!hasEmail) readyNoEmail++
    }
  }

  // ── 2. Send 'ready' rows under cap + suppression ─────────────────────────
  const { data: ready } = await admin
    .from('crosssell_outreach')
    .select(
      'id, candidate_id, active_application_id, company_name, company_domain, target_role, hm_name, hm_email, hm_title, status, unlock_token, teaser_approved',
    )
    .eq('status', 'ready')
    .not('hm_email', 'is', null)
    .order('created_at', { ascending: true })

  let sentThisRun = 0
  const cutoff = new Date(Date.now() - COMPANY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()

  for (const row of (ready as OutreachRow[]) || []) {
    // Suppression — email or domain.
    if (await isSuppressed(admin, { email: row.hm_email, domain: row.company_domain })) {
      await admin
        .from('crosssell_outreach')
        .update({ status: 'suppressed', suppression_reason: 'on suppression list' })
        .eq('id', row.id)
      suppressed++
      continue
    }

    // ≤1 send to this company-domain in the last 90 days.
    if (row.company_domain) {
      const { count } = await admin
        .from('crosssell_outreach')
        .select('id', { count: 'exact', head: true })
        .eq('company_domain', row.company_domain)
        .eq('status', 'sent')
        .gte('sent_at', cutoff)
      if ((count ?? 0) > 0) {
        // Leave 'ready' — the cooldown will lapse. Don't burn it.
        continue
      }
    }

    // Daily send cap — leave the rest 'ready' for the next run.
    if (sentThisRun >= dailyCap) break

    const teaser = await buildTeaser(admin, row.candidate_id)
    const unlockUrl = `${SITE}/unlock/${row.unlock_token}`
    const unsubscribeUrl = `${SITE}/api/outreach/unsubscribe?token=${row.unlock_token}`

    // TEST MODE: with OUTREACH_FROM unset we redirect to the candidate's own
    // inbox and prefix the subject, so the whole loop is safe to exercise.
    const outreachFrom = process.env.OUTREACH_FROM
    let to = row.hm_email!
    let subjectPrefix = ''
    let from = outreachFrom ? `Shapi <${outreachFrom}>` : 'Shapi <hello@shapi.io>'
    if (!outreachFrom) {
      const { data: candAuth } = await admin.auth.admin.getUserById(row.candidate_id)
      const candEmail = candAuth?.user?.email
      if (!candEmail) {
        // No safe test recipient — skip, leave 'ready'.
        continue
      }
      to = candEmail
      subjectPrefix = '[TEST] '
      from = 'Shapi <hello@shapi.io>'
    }

    const resend = getResend()
    if (!resend) break // no email provider configured — stop, leave rows 'ready'

    const subject = `${subjectPrefix}A verified candidate is pursuing your ${row.target_role || 'open role'}`
    try {
      await resend.emails.send({
        from,
        to,
        subject,
        html: teaserEmailHtml({ teaser, targetRole: row.target_role, unlockUrl, unsubscribeUrl }),
      })
    } catch (err) {
      console.error('[crosssell] teaser send failed:', err)
      continue
    }

    const { error: updErr } = await admin
      .from('crosssell_outreach')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'ready')
    if (!updErr) {
      sent++
      sentThisRun++
    }
  }

  return { enriched, sent, suppressed, ready_no_email: readyNoEmail }
}

// ── Unlock (company signs up to reveal the candidate) ───────────────────────

// Flip an outreach to 'unlocked' and attach the company that signed up. Notifies
// the candidate that a company unlocked them (best-effort; never blocks).
export async function claimUnlock(
  admin: SupabaseClient,
  args: { token: string; companyUserId: string },
): Promise<{ ok: true; candidateId: string } | { ok: false; error: string }> {
  const { data: row } = await admin
    .from('crosssell_outreach')
    .select('id, candidate_id, company_name, target_role, status, unlocked_company_id')
    .eq('unlock_token', args.token)
    .single()
  if (!row) return { ok: false, error: 'invalid token' }

  const candidateId = row.candidate_id as string

  // Idempotent: already unlocked by this company → succeed; by another → reject.
  if (row.status === 'unlocked') {
    if (row.unlocked_company_id === args.companyUserId) return { ok: true, candidateId }
    return { ok: false, error: 'already unlocked' }
  }

  const { error } = await admin
    .from('crosssell_outreach')
    .update({
      status: 'unlocked',
      unlocked_company_id: args.companyUserId,
      unlocked_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .neq('status', 'unlocked')
  if (error) {
    console.error('[crosssell] claimUnlock update failed:', error)
    return { ok: false, error: 'could not unlock' }
  }

  // Notify the candidate (best-effort).
  try {
    const resend = getResend()
    const { data: candAuth } = await admin.auth.admin.getUserById(candidateId)
    const candEmail = candAuth?.user?.email
    if (resend && candEmail) {
      const role = (row.target_role as string) || 'a role you applied for'
      const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#060609;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="margin-bottom:32px"><span style="font-size:22px;font-weight:900;background:linear-gradient(135deg,#38BDF8,#34D399);-webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</span></div>
    <div style="background:#0D0C14;border:1px solid rgba(52,211,153,0.2);border-radius:16px;padding:32px">
      <h1 style="color:#fff;font-size:21px;font-weight:900;margin:0 0 12px">A company just unlocked your profile 🎉</h1>
      <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 16px">We reached out to the hiring team for <strong style="color:#34D399">${escapeHtml(role)}</strong> on your behalf — and they signed up to Shapi to see your full, verified profile.</p>
      <a href="${SITE}/dashboard" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#38BDF8,#34D399);color:#060609;font-size:14px;font-weight:900;border-radius:100px;text-decoration:none">Open your dashboard →</a>
    </div>
  </div>
</body></html>`
      await resend.emails.send({
        from: 'Shapi <hello@shapi.io>',
        to: candEmail,
        subject: 'A company unlocked your Shapi profile 🎉',
        html,
      })
    }
  } catch (err) {
    console.error('[crosssell] unlock candidate notify failed:', err)
  }

  return { ok: true, candidateId }
}
