// Per-industry conversational deep-dive starter.
//
// Flow:
//   1. Candidate hits this endpoint with a single industry to deep-dive into
//   2. Claude does a quick COVERAGE CHECK — reads candidate's CV vs the
//      industry brief, scores how thin/rich the existing coverage is, and
//      identifies thin/missing role-level details + brief-aligned gaps
//   3. We send a CALIBRATED opening WhatsApp question that references
//      what Claude found:
//        thin    → "tell me about your [industry] experience, dates + what
//                   you did"
//        medium  → "I see X from your time at Y. Two gaps to fill: ..."
//        rich    → "strong coverage already. Quick refinements: ..."
//   4. Subsequent replies are handled by the WhatsApp webhook in
//      conversational mode (one question at a time, follow-ups driven by
//      Claude reading prior turns + remaining brief gaps)
//   5. After 5-8 user turns OR when Claude signals [DEEP_DIVE_DONE], the
//      industry's status flips to 'completed' and the industry CV is
//      enriched with the gathered answers

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAnthropic } from '@/lib/anthropic'
import { sendWhatsApp } from '@/lib/whatsapp'
import { INDUSTRY_BRIEFS, INDUSTRY_META, type Industry } from '@/lib/industry-briefs'

export const maxDuration = 30

type CoverageAssessment = {
  coverage_score: number          // 0-10 where 0 = nothing, 10 = world-class detail
  coverage_level: 'thin' | 'medium' | 'rich'
  thin_roles: string[]            // role titles where the candidate has thin/no detail for this industry
  missing_areas: string[]         // specific brief items not yet covered (e.g. "RevPAR metrics", "venue tier")
  opening_message: string         // the calibrated first WhatsApp message to send
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  // Accept either a single industry string or an array — for the new
  // per-industry flow we use the FIRST industry only.
  const industries: string[] = Array.isArray(body.industries)
    ? body.industries
    : body.industry ? [body.industry] : []
  if (industries.length === 0) {
    return NextResponse.json({ error: 'industry required' }, { status: 400 })
  }
  const industry = industries[0] as Industry
  const industryLabel = INDUSTRY_META[industry]?.label || industry

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, work_history, skills, whatsapp_chat, whatsapp_number, cv_tier, industry_chats, languages_spoken')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.cv_tier !== 'pro') return NextResponse.json({ error: 'Pro tier required' }, { status: 403 })
  if (!profile.whatsapp_number) return NextResponse.json({ error: 'WhatsApp number required' }, { status: 400 })

  // ─── Step 1: Coverage check via Claude ───────────────────────────────────
  // Reads the candidate's existing CV against the industry brief, scores
  // how rich/thin the coverage is, identifies specific role-level thin spots
  // and brief-aligned gaps, and drafts the OPENING WhatsApp question.
  const anthropic = getAnthropic()
  const firstName = (profile.full_name as string || 'there').split(' ')[0]
  const workHistory = Array.isArray(profile.work_history) ? profile.work_history : []

  const coveragePrompt = `You are kicking off a WhatsApp deep-dive interview to enrich a candidate's CV for ${industryLabel.toUpperCase()} roles. Before writing the first question, do a coverage check.

CANDIDATE: ${profile.full_name || 'Candidate'} (${firstName})
HEADLINE: ${profile.headline || 'not provided'}
WORK HISTORY (full): ${JSON.stringify(workHistory)}
SKILLS LISTED: ${JSON.stringify(profile.skills || [])}

═══ WHAT AN EXCEPTIONAL CV IN ${industryLabel.toUpperCase()} CONTAINS ═══
${INDUSTRY_BRIEFS[industry] || `Focus on quantified impact, scope, named achievements for ${industryLabel}.`}

═══ YOUR TASK ═══

1. **Coverage score (0-10)** for ${industryLabel}: how much rich, specific, brief-aligned ${industryLabel} content does the candidate already have on their CV?
   - 0-3 = THIN: ${industryLabel} barely mentioned, or only one-liner roles with no specifics
   - 4-6 = MEDIUM: some ${industryLabel} roles with partial detail, but missing key brief items
   - 7-10 = RICH: most brief items covered with specifics, just needs refinement

2. **thin_roles**: list role titles from the candidate's work history that are RELEVANT to ${industryLabel} but described thinly (one-liner / no metrics / no specifics). These are the roles to drill into first.

3. **missing_areas**: list 3-6 specific BRIEF items that aren't yet visible in the CV but matter for ${industryLabel} recruiters (use the "Hidden goldmines" + "Numbers that matter" + "Sub-segment matters" sections of the brief).

4. **opening_message**: the FIRST WhatsApp message to send. Calibrate the tone:
   - If THIN: open broadly. "Hi ${firstName} 👋 Let's do the ${industryLabel} deep-dive. Tell me about your ${industryLabel} experience — dates from-to, the kinds of venues / companies / contexts you worked in, and what you actually did. Take your time, voice notes work great."
   - If MEDIUM: reference what's already visible, then ask about ONE specific thin role or missing area. "Hi ${firstName} 👋 Let's drill into your ${industryLabel} experience. I see [SPECIFIC FROM CV] from your time at [COMPANY] — but [SPECIFIC GAP] isn't clear. Tell me about [SPECIFIC ASK]."
   - If RICH: acknowledge strength, target the residual gap. "Hi ${firstName} 👋 Your ${industryLabel} background is well-detailed. Two refinements before I write your ${industryLabel} CV: [SPECIFIC ASK 1] and [SPECIFIC ASK 2]."

The opening_message must be ONE WhatsApp message (max 4-5 sentences). Conversational, warm. Use specific company / role names from the CV when calibrating to MEDIUM or RICH. End with an invitation to reply (text or voice).

Return ONLY valid JSON:
{
  "coverage_score": 0,
  "coverage_level": "thin" | "medium" | "rich",
  "thin_roles": ["role 1", "role 2"],
  "missing_areas": ["specific gap 1", "specific gap 2"],
  "opening_message": "the actual first WhatsApp message text"
}`

  let assessment: CoverageAssessment
  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: coveragePrompt }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Could not parse coverage assessment')
    const parsed = JSON.parse(match[0])
    assessment = {
      coverage_score: parsed.coverage_score ?? 5,
      coverage_level: parsed.coverage_level || 'medium',
      thin_roles: Array.isArray(parsed.thin_roles) ? parsed.thin_roles : [],
      missing_areas: Array.isArray(parsed.missing_areas) ? parsed.missing_areas : [],
      opening_message: parsed.opening_message || `Hi ${firstName} 👋 Let's deep-dive into your ${industryLabel} experience. Tell me about it — dates, what you did, and the kinds of venues/companies. Voice notes work too.`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[deepdive/start] coverage check failed:', msg)
    return NextResponse.json({ error: 'Coverage assessment failed' }, { status: 500 })
  }

  // ─── Step 2: Save state — exactly ONE industry can be in_progress ────────
  type IndustryChatEntry = {
    status?: string
    coverage_score?: number
    coverage_level?: string
    thin_roles?: string[]
    missing_areas?: string[]
    opening_message?: string
    answers?: string[]
    whatsapp_chat?: Array<{ role: 'user' | 'assistant'; content: string }>
    started_at?: string
    completed_at?: string
    delivered?: boolean
  }

  const existing = (profile.industry_chats as Record<string, IndustryChatEntry>) || {}
  const updated: Record<string, IndustryChatEntry> = { ...existing }
  // Only one industry can be in_progress at a time — webhook routes incoming
  // replies to whichever is active. Reset any other in_progress back to pending.
  for (const [key, val] of Object.entries(updated)) {
    if (val.status === 'in_progress' && key !== industry) {
      updated[key] = { ...val, status: 'pending' }
    }
  }
  updated[industry] = {
    ...(existing[industry] || {}),
    status: 'in_progress',
    coverage_score: assessment.coverage_score,
    coverage_level: assessment.coverage_level,
    thin_roles: assessment.thin_roles,
    missing_areas: assessment.missing_areas,
    opening_message: assessment.opening_message,
    answers: [],                    // reset — fresh deep-dive overrides prior attempts
    whatsapp_chat: [],
    started_at: new Date().toISOString(),
    delivered: false,
  }
  await supabase.from('profiles').update({ industry_chats: updated }).eq('id', user.id)

  // ─── Step 3: Send the opening WhatsApp message ───────────────────────────
  // Lead with the industry banner so it's clear which deep-dive this is, and
  // close with the available commands so the candidate knows their options.
  const emoji = INDUSTRY_META[industry as Industry]?.emoji || '🎯'
  const openingMessage = `${emoji} *${industryLabel} deep-dive* — let's sharpen your ${industryLabel} CV.\n\n${assessment.opening_message}\n\n_Anytime: say *"skip"* for a question, *"pause"* to stop (saved), or *"done"* to finish._`
  console.log('[deepdive/start] industry:', industry, '| coverage:', assessment.coverage_level, assessment.coverage_score, '| sending to:', profile.whatsapp_number)
  const wa = await sendWhatsApp(profile.whatsapp_number as string, openingMessage)
  if (!wa.success) {
    console.error('[deepdive/start] WhatsApp send failed:', wa.error)
    return NextResponse.json({
      success: false,
      whatsapp_failed: true,
      coverage: assessment,
      error: `WhatsApp delivery failed (${wa.error || 'unknown'}). Opening question shown below — you can answer here.`,
    }, { status: 200 })
  }

  // Append the opening to whatsapp_chat as the first assistant turn, mark delivered
  const deliveredUpdate = {
    ...updated,
    [industry]: {
      ...updated[industry],
      whatsapp_chat: [{ role: 'assistant' as const, content: assessment.opening_message }],
      delivered: true,
    },
  }
  await supabase.from('profiles').update({ industry_chats: deliveredUpdate }).eq('id', user.id)

  console.log('[deepdive/start] opening sent + saved for', industry)
  return NextResponse.json({
    success: true,
    industry,
    coverage: {
      score: assessment.coverage_score,
      level: assessment.coverage_level,
      thin_roles: assessment.thin_roles,
      missing_areas: assessment.missing_areas,
    },
  })
}
