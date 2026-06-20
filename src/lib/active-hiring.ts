// Active Hiring — the company-side mirror of the candidate Concierge.
//
// Once a day (cron), for every company on Active Hiring and each of their OPEN
// roles, we score the verified candidate pool, take the top matches not already
// queued, draft a warm recruiter→candidate intro, and drop it in
// active_hiring_queue as 'pending_approval'. The company approves with one tap;
// sendApprovedActiveHiringOutreach() emails the candidate (reply-to the company)
// and flips the row to 'sent'.
//
// Delivers the $499/mo promise: "a daily shortlist of verified candidates per
// open role, with outreach drafted and waiting for your approval."

import Anthropic from '@anthropic-ai/sdk'
import { getAnthropic } from '@/lib/anthropic'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreCandidateForRole, type MatchCandidate, type MatchRole } from '@/lib/matching'

const anthropic = getAnthropic()
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

const MIN_SCORE = 55          // quality over volume — don't queue weak matches
const MAX_PER_ROLE = 5        // top N candidates per role per run
const POOL_SCAN = 1500        // candidate pool cap per scan

type Role = MatchRole & { id: string; company_id: string; must_have_skills?: string[] | null; nice_to_have_skills?: string[] | null }
type Candidate = MatchCandidate & { id: string; full_name?: string | null }

function getResend() {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
}

// Recruiter → candidate intro. Warm, specific, NOT spammy. Returns null on
// failure (we just skip that draft).
async function draftOutreach(candidate: Candidate, role: Role, companyName: string, reasons: string[]): Promise<{ subject: string; body: string } | null> {
  try {
    const completion = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Draft a short, warm outreach message FROM a hiring company TO a verified candidate about a specific open role. The company found them via Shapi (a verified hiring platform) and wants to start a conversation.

CANDIDATE:
- Name: ${candidate.full_name || 'there'}
- Headline: ${candidate.headline || ''}
- Top skills: ${(candidate.skills || []).slice(0, 8).join(', ')}
- Why they matched: ${reasons.join('; ')}

ROLE:
- Title: ${role.title || ''}
- Company: ${companyName}
- Location: ${role.location || 'unspecified'}
- About: ${(role.description || '').slice(0, 500)}

INSTRUCTIONS:
- Warm, human, specific. Like a real hiring manager who read their profile — not a mass blast.
- 3-5 sentences. Open by tying THEIR background to THIS role (use the match reasons).
- One line on what the role/company offers.
- Close with a low-pressure ask ("open to a quick chat?").
- NO clichés ("I came across your profile"), NO flattery, NO overpromising.
- Sign off as the ${companyName} hiring team.

Return ONLY JSON (no markdown):
{ "subject": "short, specific subject line (6-10 words)", "body": "the message body, plain text with line breaks" }`,
      }],
    })
    const text = completion.content[0].type === 'text' ? completion.content[0].text : ''
    const match = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch (err) {
    console.error('[active-hiring] draft failed:', err)
    return null
  }
}

// Scan ALL open roles for one company. Idempotent — won't re-queue a
// (company, role, candidate) already in the queue.
export async function runActiveHiringScanForCompany(companyId: string): Promise<{ roles: number; queued: number }> {
  const admin = createAdminClient()

  const { data: company } = await admin.from('profiles').select('company_name, full_name').eq('id', companyId).single()
  const companyName = (company?.company_name as string) || (company?.full_name as string) || 'A company'

  const { data: roles } = await admin
    .from('roles')
    .select('id, company_id, title, department, location, description, must_have_skills, nice_to_have_skills, salary_min, salary_max, engagement_type, status')
    .eq('company_id', companyId)
    .eq('status', 'active')
  if (!roles || roles.length === 0) return { roles: 0, queued: 0 }

  // Discoverable candidate pool (verified-leaning). Cap for cost.
  const { data: candidates } = await admin
    .from('profiles')
    .select('id, full_name, skills, location, headline, industry, completion_pct, verification_tier, salary_expectations, open_to_engagement, target_roles')
    .eq('type', 'candidate')
    .not('skills', 'is', null)
    .limit(POOL_SCAN)
  if (!candidates || candidates.length === 0) return { roles: roles.length, queued: 0 }

  // Already-queued (company, role, candidate) pairs — skip them.
  const { data: existing } = await admin
    .from('active_hiring_queue')
    .select('role_id, candidate_id')
    .eq('company_id', companyId)
  const seen = new Set((existing || []).map(r => `${r.role_id}:${r.candidate_id}`))

  let queued = 0
  for (const role of roles as Role[]) {
    const requirements = [...(role.must_have_skills || []), ...(role.nice_to_have_skills || [])].join(', ')
    const matchRole: MatchRole = { ...role, requirements }

    const scored = (candidates as Candidate[])
      .filter(c => !seen.has(`${role.id}:${c.id}`))
      .map(c => ({ c, ...scoreCandidateForRole(c, matchRole) }))
      .filter(s => s.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PER_ROLE)

    for (const s of scored) {
      const draft = await draftOutreach(s.c, role, companyName, s.reasons)
      const { error } = await admin.from('active_hiring_queue').insert({
        company_id: companyId,
        role_id: role.id,
        candidate_id: s.c.id,
        match_score: s.score,
        match_reasons: s.reasons,
        draft_subject: draft?.subject || null,
        draft_body: draft?.body || null,
      })
      if (!error) queued++
    }
  }
  return { roles: roles.length, queued }
}

// Batch: every company on Active Hiring (active_hiring_monthly | _yearly).
export async function runActiveHiringScanForAll(): Promise<{ companies: number; queued: number }> {
  const admin = createAdminClient()
  const { data: monthly } = await admin.from('profiles').select('id').contains('subscription_product', ['active_hiring_monthly'])
  const { data: yearly } = await admin.from('profiles').select('id').contains('subscription_product', ['active_hiring_yearly'])
  const ids = [...new Set([...(monthly || []), ...(yearly || [])].map(r => r.id as string))]

  let queued = 0
  for (const id of ids) {
    const r = await runActiveHiringScanForCompany(id)
    queued += r.queued
  }
  return { companies: ids.length, queued }
}

// Send approved drafts to the candidate (email, reply-to the company). Flips
// 'approved' → 'sent'. Idempotent + capped.
export async function sendApprovedActiveHiringOutreach(limit = 25): Promise<{ picked: number; sent: number; skipped: number }> {
  const admin = createAdminClient()
  const resend = getResend()
  const { data: rows } = await admin
    .from('active_hiring_queue')
    .select('id, company_id, role_id, candidate_id, draft_subject, draft_body, status, sent_at')
    .eq('status', 'approved')
    .is('sent_at', null)
    .limit(Math.max(1, Math.min(50, limit)))

  let sent = 0, skipped = 0
  for (const row of rows || []) {
    if (!resend || !row.draft_body) { skipped++; continue }
    const [{ data: candAuth }, { data: company }] = await Promise.all([
      admin.auth.admin.getUserById(row.candidate_id as string),
      admin.from('profiles').select('company_name, full_name').eq('id', row.company_id).single(),
    ])
    const candidateEmail = candAuth?.user?.email
    const companyEmail = (await admin.auth.admin.getUserById(row.company_id as string)).data?.user?.email
    const companyName = (company?.company_name as string) || (company?.full_name as string) || 'A company'
    if (!candidateEmail) { skipped++; continue }

    try {
      await resend.emails.send({
        from: 'Shapi <hello@shapi.io>',
        to: candidateEmail,
        replyTo: companyEmail || undefined,
        subject: row.draft_subject || `${companyName} would like to connect`,
        html: `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:28px 20px;background:#060609">
          <p style="font-size:20px;font-weight:900;margin:0 0 18px;background:linear-gradient(135deg,#38BDF8,#34D399);-webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</p>
          <div style="background:#0D0C14;border:1px solid rgba(56,189,248,0.2);border-radius:16px;padding:26px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.6;white-space:pre-wrap">${String(row.draft_body).replace(/</g, '&lt;')}</div>
          <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:18px">Sent via Shapi · reply to reach ${companyName} directly · <a href="${SITE}/dashboard" style="color:rgba(255,255,255,0.4)">your dashboard</a></p>
        </div>`,
      })
      await admin.from('active_hiring_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', row.id).is('sent_at', null)
      sent++
    } catch (err) {
      console.error('[active-hiring] send failed:', err)
      skipped++
    }
  }
  return { picked: rows?.length || 0, sent, skipped }
}
