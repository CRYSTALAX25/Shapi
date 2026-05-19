// AI Concierge — daily shortlist + drafted outreach.
//
// Once per day (cron) we scan open roles for each Concierge subscriber,
// score matches, pick the top 3-5, and ask Claude to draft a personalised
// intro from the candidate's CV + the role description. Each draft lands
// in `concierge_queue` with status='pending_approval' (or 'auto_send' if
// the candidate opted in to autonomous mode).

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

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
    .select('id, full_name, headline, location, summary, skills, work_history, industry, concierge_auto_send, concierge_paused_until')
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
    if (!error) drafted++
    else console.error('[concierge] insert failed:', error)
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
