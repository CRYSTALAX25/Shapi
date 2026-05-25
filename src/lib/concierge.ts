// AI Concierge — daily shortlist + drafted outreach.
//
// Once per day (cron) we scan open roles for each Concierge subscriber,
// score matches, pick the top 3-5, and ask Claude to draft a personalised
// intro from the candidate's CV + the role description. Each draft lands
// in `concierge_queue` with status='pending_approval' (or 'auto_send' if
// the candidate opted in to autonomous mode).

import { randomBytes } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendConciergeOutreach,
  sendConciergeNudge,
  sendConciergeReplyAlert,
  sendConciergeReadyToBookEmail,
} from '@/lib/email'
import { sendWhatsApp } from '@/lib/whatsapp'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_DRAFTS_PER_RUN = 5
const MIN_MATCH_SCORE_TO_DRAFT = 50  // skip weak matches — quality over volume

type Role = {
  id: string
  title: string
  department: string | null
  location: string | null
  remote: boolean
  description: string | null
  must_have_skills: string[] | null
  nice_to_have_skills: string[] | null
  status: string
  company_id: string
  created_at: string
}

type Profile = {
  id: string
  full_name: string | null
  headline: string | null
  location: string | null
  summary: string | null
  skills: string[] | null
  work_history: Array<{ title?: string; company?: string }> | null
  industry: string | null
}

type ScoredRole = {
  role: Role
  score: number
  reasons: string[]
}

// Cheap, deterministic match scorer. Same shape as /roles board logic so
// scores stay comparable between manual browsing and Concierge.
function scoreRole(profile: Profile, role: Role): ScoredRole {
  const candidateSkills = (profile.skills || []).map(s => s.toLowerCase())
  const roleText = `${role.title} ${role.department || ''} ${role.description || ''}`.toLowerCase()
  const roleMustHaves = (role.must_have_skills || []).map(s => s.toLowerCase())

  let score = 0
  const reasons: string[] = []

  // Skill match (50pt max)
  const skillHits = candidateSkills.filter(s =>
    roleText.includes(s) || roleMustHaves.some(must => must.includes(s) || s.includes(must))
  )
  if (skillHits.length > 0) {
    score += Math.min(50, skillHits.length * 12)
    reasons.push(`${skillHits.length} matching skill${skillHits.length > 1 ? 's' : ''} (${skillHits.slice(0, 3).join(', ')})`)
  }

  // Headline overlap (20pt)
  const headlineLower = (profile.headline || '').toLowerCase()
  const headlineWords = headlineLower.split(/\s+/).filter(w => w.length > 3)
  const headlineHits = headlineWords.filter(w => roleText.includes(w))
  if (headlineHits.length >= 2) {
    score += 20
    reasons.push('headline aligns with role')
  }

  // Location (20pt)
  const candidateLoc = (profile.location || '').toLowerCase()
  const roleLoc = (role.location || '').toLowerCase()
  if (candidateLoc && roleLoc) {
    const candidateCity = candidateLoc.split(',')[0].trim()
    const roleCity = roleLoc.split(',')[0].trim()
    if (candidateCity && roleCity && (candidateCity.includes(roleCity) || roleCity.includes(candidateCity))) {
      score += 20
      reasons.push('same city')
    }
  } else if (role.remote) {
    score += 10
    reasons.push('remote-friendly')
  }

  // Industry match (10pt)
  if (profile.industry && roleText.includes(profile.industry.toLowerCase())) {
    score += 10
    reasons.push(`${profile.industry} industry match`)
  }

  return { role, score: Math.min(100, score), reasons }
}

// Ask Claude to draft a short, warm intro the candidate can fire off.
// Returns null if generation fails (we just skip that draft).
async function draftIntro(
  profile: Profile,
  role: Role,
  companyName: string,
): Promise<{ subject: string; body: string } | null> {
  const skillsLine = (profile.skills || []).slice(0, 8).join(', ')
  const workSummary = (profile.work_history || []).slice(0, 3)
    .map(w => `${w.title || ''} at ${w.company || ''}`).filter(s => s.trim().length > 4).join(' · ')

  try {
    const completion = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',  // Haiku is fine here — short, low-creativity
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Draft a short, warm outreach message from a candidate to a hiring company. The candidate is applying for a specific role.

CANDIDATE:
- Name: ${profile.full_name || ''}
- Headline: ${profile.headline || ''}
- Top skills: ${skillsLine}
- Recent roles: ${workSummary}
- Summary: ${(profile.summary || '').slice(0, 400)}

ROLE:
- Title: ${role.title}
- Company: ${companyName}
- Location: ${role.location || 'unspecified'}
- Description: ${(role.description || '').slice(0, 600)}
- Must-have skills: ${(role.must_have_skills || []).join(', ')}

INSTRUCTIONS:
- Tone: warm, confident, specific. Not formal. Not desperate.
- Length: 4-6 sentences. Tight.
- Open with one sentence that ties the candidate's experience to the role
- One concrete proof point (a skill/result that maps to the must-haves)
- One sentence on what excites them about the role/company
- Close with a clear ask ("happy to chat" / "share my Shapi profile")
- DO NOT use clichés like "I am writing to express my interest"
- DO NOT exaggerate or invent

Return ONLY JSON (no markdown):
{
  "subject": "short, specific subject line — 6-10 words",
  "body": "the email/message body, plain text with line breaks"
}`,
      }],
    })

    const text = completion.content[0].type === 'text' ? completion.content[0].text : ''
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch (err) {
    console.error('[concierge] draft generation failed:', err)
    return null
  }
}

// Top-level: scan + score + draft for ONE candidate. Idempotent — won't
// re-create drafts for role/candidate pairs that are already in the queue.
export async function runConciergeScanForCandidate(candidateId: string): Promise<{
  scanned: number
  drafted: number
  reason?: string
}> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, headline, location, summary, skills, work_history, industry, concierge_auto_send, concierge_paused_until, whatsapp_number')
    .eq('id', candidateId)
    .single()
  if (!profile) return { scanned: 0, drafted: 0, reason: 'profile not found' }

  // Honour pause
  if (profile.concierge_paused_until) {
    const until = new Date(profile.concierge_paused_until as string)
    if (until.getTime() > Date.now()) {
      return { scanned: 0, drafted: 0, reason: `paused until ${profile.concierge_paused_until}` }
    }
  }

  const { data: roles } = await admin
    .from('roles')
    .select('id, title, department, location, remote, description, must_have_skills, nice_to_have_skills, status, company_id, created_at')
    .eq('status', 'active')

  if (!roles || roles.length === 0) return { scanned: 0, drafted: 0, reason: 'no active roles' }

  // Skip roles already queued for this candidate (any status)
  const { data: existing } = await admin
    .from('concierge_queue')
    .select('role_id')
    .eq('candidate_id', candidateId)
  const seen = new Set((existing || []).map(r => r.role_id))

  const candidateRoles = roles.filter(r => !seen.has(r.id))
  const scored = candidateRoles
    .map(r => scoreRole(profile as Profile, r as Role))
    .filter(s => s.score >= MIN_MATCH_SCORE_TO_DRAFT)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_DRAFTS_PER_RUN)

  if (scored.length === 0) {
    await admin.from('profiles')
      .update({ concierge_last_scan_at: new Date().toISOString() })
      .eq('id', candidateId)
    return { scanned: candidateRoles.length, drafted: 0, reason: 'no strong matches today' }
  }

  // Pre-fetch company names for the prompt
  const companyIds = [...new Set(scored.map(s => s.role.company_id))]
  const { data: companies } = await admin
    .from('profiles')
    .select('id, company_name, full_name')
    .in('id', companyIds)
  const companyMap: Record<string, string> = {}
  for (const c of companies || []) {
    companyMap[c.id] = (c.company_name as string) || (c.full_name as string) || 'Company'
  }

  let drafted = 0
  let newPendingApproval = 0  // NEW drafts that need the candidate's review
  for (const s of scored) {
    const companyName = companyMap[s.role.company_id] || 'Company'
    const draft = await draftIntro(profile as Profile, s.role, companyName)
    if (!draft) continue

    const status = profile.concierge_auto_send ? 'auto_send' : 'pending_approval'
    const { error } = await admin.from('concierge_queue').insert({
      candidate_id: candidateId,
      role_id: s.role.id,
      match_score: s.score,
      match_reasons: s.reasons,
      draft_subject: draft.subject,
      draft_body: draft.body,
      status,
    })
    if (!error) {
      drafted++
      if (status === 'pending_approval') newPendingApproval++
    } else {
      console.error('[concierge] insert failed:', error)
    }
  }

  // Nudge the candidate once per run when ≥1 NEW draft awaits their approval.
  // Never block / fail the scan if the nudge fails — wrap everything in try/catch.
  if (newPendingApproval > 0) {
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(candidateId)
      const email = authUser?.user?.email
      const name = (profile.full_name as string) || ''

      if (email) {
        try {
          await sendConciergeNudge({ to: email, name, count: newPendingApproval })
        } catch (err) {
          console.error('[concierge] nudge email failed:', err)
        }
      }

      const whatsapp = (profile.whatsapp_number as string | null) || null
      if (whatsapp) {
        try {
          const firstName = name.split(' ')[0] || 'there'
          const roleWord = newPendingApproval === 1 ? 'role' : 'roles'
          await sendWhatsApp(
            whatsapp,
            `Hi ${firstName} 👋 Your Shapi Concierge found ${newPendingApproval} new ${roleWord} worth a look — review & approve in your dashboard: https://shapi.io/dashboard`,
          )
        } catch (err) {
          console.error('[concierge] nudge whatsapp failed:', err)
        }
      }
    } catch (err) {
      console.error('[concierge] nudge step failed:', err)
    }
  }

  await admin.from('profiles')
    .update({ concierge_last_scan_at: new Date().toISOString() })
    .eq('id', candidateId)

  return { scanned: candidateRoles.length, drafted }
}

// Batch runner: process every Concierge subscriber. Call from a daily cron
// (Vercel cron or external scheduler) or the manual /api/concierge/scan endpoint.
export async function runConciergeScanForAll(): Promise<{
  candidatesProcessed: number
  totalDrafted: number
}> {
  const admin = createAdminClient()

  // Pull every candidate with the concierge_monthly product enabled
  const { data: candidates } = await admin
    .from('profiles')
    .select('id')
    .contains('subscription_product', ['concierge_monthly'])
    .eq('type', 'candidate')

  let totalDrafted = 0
  for (const c of candidates || []) {
    const result = await runConciergeScanForCandidate(c.id as string)
    totalDrafted += result.drafted
  }

  return { candidatesProcessed: candidates?.length || 0, totalDrafted }
}

// ── Outbound delivery ──────────────────────────────────────────────────────
// Sends an approved Concierge draft to the hiring company behind its role.
//
// There is NO recipient field on concierge_queue, so the recipient is resolved
// at send time: role_id → roles.company_id → auth.users.email (the company's
// signup email). Reply-to is set to the candidate's own email so replies reach
// them directly. Returns a typed outcome so callers can surface why a send was
// skipped (e.g. no company email on file) without inventing an address.

export type ConciergeSendResult =
  | { ok: true; sent: true; draftId: string }
  | { ok: true; sent: false; draftId: string; reason: string }
  | { ok: false; draftId: string; reason: string }

type QueueRow = {
  id: string
  candidate_id: string
  role_id: string
  draft_subject: string | null
  draft_body: string
  status: string
  sent_at: string | null
}

// Send a single already-fetched 'approved' row. Idempotent: re-checks status
// and sent_at, only ever flips 'approved'/'auto_send' → 'sent'.
export async function sendApprovedConciergeDraft(draft: QueueRow): Promise<ConciergeSendResult> {
  const admin = createAdminClient()

  // Guard: only unsent, approved/auto_send rows ever go out.
  if (draft.sent_at) return { ok: true, sent: false, draftId: draft.id, reason: 'already sent' }
  if (draft.status !== 'approved' && draft.status !== 'auto_send') {
    return { ok: true, sent: false, draftId: draft.id, reason: `status is '${draft.status}'` }
  }

  // Resolve the company (recipient) behind the role.
  const { data: role } = await admin
    .from('roles')
    .select('company_id')
    .eq('id', draft.role_id)
    .single()
  if (!role?.company_id) {
    return { ok: true, sent: false, draftId: draft.id, reason: 'role/company not found' }
  }

  const [{ data: companyAuth }, { data: candidateProfile }, { data: candidateAuth }] = await Promise.all([
    admin.auth.admin.getUserById(role.company_id as string),
    admin.from('profiles').select('full_name').eq('id', draft.candidate_id).single(),
    admin.auth.admin.getUserById(draft.candidate_id),
  ])

  const companyEmail = companyAuth?.user?.email
  if (!companyEmail) {
    // Don't invent an address — leave it 'approved' for a later retry.
    return { ok: true, sent: false, draftId: draft.id, reason: 'no company email on file' }
  }

  const candidateName = (candidateProfile?.full_name as string) || ''

  // Reply-to is env-gated. In CAPTURE mode (INBOUND_EMAIL_DOMAIN set) we mint a
  // reply_token and route replies to reply+<token>@<domain> so /api/inbound/email
  // can match the reply back to this draft and auto-book. Otherwise we keep the
  // legacy behaviour: replies go straight to the candidate's own inbox.
  const inboundDomain = process.env.INBOUND_EMAIL_DOMAIN
  let replyTo = candidateAuth?.user?.email || undefined
  if (inboundDomain) {
    const token = randomBytes(16).toString('hex')
    const { error: tokErr } = await admin
      .from('concierge_queue')
      .update({ reply_token: token })
      .eq('id', draft.id)
    if (!tokErr) {
      replyTo = `reply+${token}@${inboundDomain}`
    } else {
      console.error('[concierge] reply_token store failed, falling back to candidate email:', tokErr)
    }
  }

  try {
    await sendConciergeOutreach({
      to: companyEmail,
      subject: draft.draft_subject || `${candidateName || 'A candidate'} would like to connect`,
      body: draft.draft_body,
      candidateName,
      replyTo,
    })
  } catch (err) {
    console.error('[concierge] send failed:', err)
    return { ok: false, draftId: draft.id, reason: 'email send failed' }
  }

  // Flip to 'sent' — scoped to the still-unsent state to avoid races/double-send.
  const { error: updErr } = await admin
    .from('concierge_queue')
    .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', draft.id)
    .is('sent_at', null)
  if (updErr) {
    console.error('[concierge] status update failed after send:', updErr)
    return { ok: false, draftId: draft.id, reason: 'sent but status update failed' }
  }

  return { ok: true, sent: true, draftId: draft.id }
}

// Convenience: fetch one draft by id (admin scope) and send it.
export async function sendConciergeDraftById(draftId: string): Promise<ConciergeSendResult> {
  const admin = createAdminClient()
  const { data: draft } = await admin
    .from('concierge_queue')
    .select('id, candidate_id, role_id, draft_subject, draft_body, status, sent_at')
    .eq('id', draftId)
    .single()
  if (!draft) return { ok: false, draftId, reason: 'draft not found' }
  return sendApprovedConciergeDraft(draft as QueueRow)
}

// Batch runner: pick up approved drafts that haven't been sent and fire them.
// Used by the cron-safe /api/concierge/send endpoint. Caps batch size.
export async function sendPendingConciergeOutreach(limit = 25): Promise<{
  picked: number
  sent: number
  skipped: number
  failed: number
  results: ConciergeSendResult[]
}> {
  const admin = createAdminClient()
  const { data: drafts } = await admin
    .from('concierge_queue')
    .select('id, candidate_id, role_id, draft_subject, draft_body, status, sent_at')
    .in('status', ['approved', 'auto_send'])
    .is('sent_at', null)
    .order('approved_at', { ascending: true, nullsFirst: true })
    .limit(Math.max(1, Math.min(25, limit)))

  const rows = (drafts as QueueRow[]) || []
  const results: ConciergeSendResult[] = []
  let sent = 0, skipped = 0, failed = 0
  for (const row of rows) {
    const r = await sendApprovedConciergeDraft(row)
    results.push(r)
    if (r.ok && r.sent) sent++
    else if (r.ok) skipped++
    else failed++
  }
  return { picked: rows.length, sent, skipped, failed, results }
}

// ── Reply capture + auto-booking ────────────────────────────────────────────
// One shared handler for BOTH triggers (manual "they replied" button and the
// automated inbound-email webhook). Given a draft id, it:
//   1. Marks the row 'replied' (+ replied_at, reply_excerpt).
//   2. Notifies the CANDIDATE (email + WhatsApp) that a manager replied.
//   3. Auto-INITIATES an interview row (status 'scheduled', no time yet) and
//      stores its id on the draft. ('scheduled' is the interviews table's
//      earliest stage — the company sets the time later from the pipeline.)
//   4. Notifies the COMPANY that the candidate is ready to book.
// Idempotent: if the row is already 'replied' or already has an interview_id,
// it no-ops (returns ok:true, already:true).

export type ConciergeReplyResult =
  | { ok: true; draftId: string; interviewId: string | null; already?: boolean }
  | { ok: false; draftId: string; reason: string }

export async function handleConciergeReply(
  draftId: string,
  replyText?: string,
): Promise<ConciergeReplyResult> {
  const admin = createAdminClient()

  const { data: draft } = await admin
    .from('concierge_queue')
    .select('id, candidate_id, role_id, draft_subject, status, replied_at, interview_id')
    .eq('id', draftId)
    .single()
  if (!draft) return { ok: false, draftId, reason: 'draft not found' }

  // Idempotency guard — already processed.
  if (draft.status === 'replied' || draft.replied_at || draft.interview_id) {
    return { ok: true, draftId, interviewId: (draft.interview_id as string) || null, already: true }
  }

  const excerpt = replyText ? String(replyText).trim().slice(0, 300) : null

  // 1. Flip to 'replied'. Scope to the not-yet-replied state to avoid races.
  const { error: updErr } = await admin
    .from('concierge_queue')
    .update({
      status: 'replied',
      replied_at: new Date().toISOString(),
      reply_excerpt: excerpt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draft.id)
    .is('replied_at', null)
  if (updErr) {
    console.error('[concierge] reply status update failed:', updErr)
    return { ok: false, draftId, reason: 'status update failed' }
  }

  // Resolve role, company, candidate context.
  const { data: role } = await admin
    .from('roles')
    .select('id, title, company_id')
    .eq('id', draft.role_id)
    .single()

  const companyId = (role?.company_id as string) || null
  const roleTitle = (role?.title as string) || 'a role'

  const [{ data: candidateProfile }, { data: candidateAuth }, companyAuthRes] = await Promise.all([
    admin.from('profiles').select('full_name, whatsapp_number').eq('id', draft.candidate_id).single(),
    admin.auth.admin.getUserById(draft.candidate_id),
    companyId ? admin.auth.admin.getUserById(companyId) : Promise.resolve({ data: null }),
  ])

  const candidateName = (candidateProfile?.full_name as string) || ''
  const candidatePhone = (candidateProfile?.whatsapp_number as string) || ''
  const candidateEmail = candidateAuth?.user?.email || ''

  let companyName = 'the hiring team'
  let companyEmail = ''
  if (companyId) {
    const companyAuth = (companyAuthRes as { data: { user?: { email?: string } } | null }).data
    companyEmail = companyAuth?.user?.email || ''
    const { data: companyProfile } = await admin
      .from('profiles')
      .select('company_name, full_name')
      .eq('id', companyId)
      .single()
    companyName = (companyProfile?.company_name as string) || (companyProfile?.full_name as string) || companyName
  }

  // 3. Auto-initiate the interview (earliest stage, no time yet). Idempotent on
  // (candidate_id, role_id) so a re-run reuses the same interview row.
  let interviewId: string | null = null
  if (companyId) {
    const { data: interview, error: ivErr } = await admin
      .from('interviews')
      .upsert(
        {
          candidate_id: draft.candidate_id,
          role_id: draft.role_id,
          company_id: companyId,
          status: 'scheduled', // earliest stage; time set later from pipeline
        },
        { onConflict: 'candidate_id,role_id' },
      )
      .select('id')
      .single()
    if (!ivErr && interview) {
      interviewId = interview.id as string
      await admin.from('concierge_queue').update({ interview_id: interviewId }).eq('id', draft.id)
    } else if (ivErr) {
      console.error('[concierge] interview auto-create failed:', ivErr)
    }
  }

  // 2. Notify the candidate (email + WhatsApp).
  if (candidateEmail) {
    try {
      await sendConciergeReplyAlert({
        to: candidateEmail,
        name: candidateName,
        roleName: roleTitle,
        companyName,
        replyText,
      })
    } catch (err) {
      console.error('[concierge] candidate reply-alert email failed:', err)
    }
  }
  if (candidatePhoneIsUsable(candidatePhone)) {
    const waMsg =
      `Great news${candidateName ? ', ' + candidateName.split(' ')[0] : ''}! ` +
      `A hiring manager at ${companyName} replied about the ${roleTitle} role — let's get you booked. ` +
      `Open your Shapi dashboard to confirm a time.` +
      (replyText ? `\n\nThey said:\n"${String(replyText).trim().slice(0, 280)}"` : '')
    try {
      await sendWhatsApp(candidatePhone, waMsg)
    } catch (err) {
      console.error('[concierge] candidate reply WhatsApp failed:', err)
    }
  }

  // 4. Notify the company that the candidate is ready to book.
  if (companyEmail) {
    try {
      await sendConciergeReadyToBookEmail({
        to: companyEmail,
        companyName,
        candidateName,
        roleName: roleTitle,
      })
    } catch (err) {
      console.error('[concierge] company ready-to-book email failed:', err)
    }
  }

  return { ok: true, draftId, interviewId }
}

function candidatePhoneIsUsable(phone: string): boolean {
  return typeof phone === 'string' && phone.replace(/[^0-9]/g, '').length >= 8
}
