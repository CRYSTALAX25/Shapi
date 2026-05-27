// Tier B Engagement — 5-year Workforce Plan workspace API.
//
// GET  /api/company/tier-b
//   - Returns the authenticated company's single engagement row (creates one
//     if none exists). Used to hydrate the wizard.
//
// POST /api/company/tier-b
//   - Body: { action: 'diagnose_operating_model' | 'map_org_dna' | 'plan_workforce' | 'generate_playbook', input?: any, advance?: boolean }
//   - Runs the named step against Claude Sonnet 4.6, writes the result into
//     the matching jsonb column, appends to audit_trail, and (optionally)
//     advances `step`. Each step returns the freshly-saved engagement row.
//
// Auth: profiles.type must be 'company'. Engagement is per-company (1:1 via RLS).
//
// Voice rules (mirrored from /api/company/roadmap):
//   - Never use "indicative" or "approximate" as hedges. Use 70%-confidence
//     bands + named variance drivers. Quote sources (Mercer / Glassdoor /
//     Anthropic/OpenAI published API pricing / Shapi platform data) in a
//     footer line on each generated artefact.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

type Action = 'diagnose_operating_model' | 'map_org_dna' | 'plan_workforce' | 'generate_playbook'

const ACTION_TO_COLUMN: Record<Action, string> = {
  diagnose_operating_model: 'operating_model_diagnostic',
  map_org_dna: 'org_dna',
  plan_workforce: 'workforce_plan',
  generate_playbook: 'execution_playbook',
}

const ACTION_TO_STEP: Record<Action, number> = {
  diagnose_operating_model: 1,
  map_org_dna: 2,
  plan_workforce: 3,
  generate_playbook: 4,
}

const SOURCES_FOOTER = 'Sources: Mercer compensation benchmarks · Glassdoor public ratings · Anthropic/OpenAI published API pricing · BLS/government labour statistics · Shapi platform data. Figures are 70%-confidence bands; named variance drivers in-text.'

const VOICE_RULES = `═══ VOICE ═══
Speak with sourced confidence. NEVER use the words "indicative", "approximate" (as a hedge), or "rough". Express uncertainty as a 70%-confidence band ("$48-62k base, 70% band") and name the variance driver in one phrase (e.g. "scales with HQ city", "depends on funding runway"). Numeric prefixes like "~$15" are fine. Synthesise from Mercer / Glassdoor / Anthropic/OpenAI published API pricing / BLS labour statistics / Shapi platform data.`

// ─────────────────────────────────────────────────────────────────────────────
// GET — fetch (or lazily create) the company's engagement
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, industry, company_data, location, headline, summary')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.type !== 'company') return NextResponse.json({ error: 'Company accounts only' }, { status: 403 })

  // Find or create the single engagement row for this company.
  let { data: engagement } = await supabase
    .from('tier_b_engagements')
    .select('*')
    .eq('company_id', user.id)
    .maybeSingle()

  if (!engagement) {
    const { data: created, error } = await supabase
      .from('tier_b_engagements')
      .insert({ company_id: user.id })
      .select('*')
      .single()
    if (error) {
      console.error('[tier-b] create engagement error:', error)
      return NextResponse.json({ error: 'Could not create engagement' }, { status: 500 })
    }
    engagement = created
  }

  return NextResponse.json({ success: true, engagement, profile })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — run an individual step, save to column, optionally advance step
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const action = body?.action as Action | undefined
  const input = (body?.input ?? {}) as Record<string, unknown>
  const advance = body?.advance !== false // default true

  if (!action || !(action in ACTION_TO_COLUMN)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  // Optional non-AI action: lock the engagement.
  // (Handled via a special action below for clarity.)

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, industry, company_data, location, headline, summary')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.type !== 'company') return NextResponse.json({ error: 'Company accounts only' }, { status: 403 })

  // Find or create the engagement.
  let { data: engagement } = await supabase
    .from('tier_b_engagements')
    .select('*')
    .eq('company_id', user.id)
    .maybeSingle()

  if (!engagement) {
    const { data: created, error } = await supabase
      .from('tier_b_engagements')
      .insert({ company_id: user.id })
      .select('*')
      .single()
    if (error) {
      console.error('[tier-b] lazy-create error:', error)
      return NextResponse.json({ error: 'Could not start engagement' }, { status: 500 })
    }
    engagement = created
  }

  // Pull the Workforce Snapshot data if it exists — feeds step 3 (plan_workforce).
  let workforceSnapshot: Record<string, unknown> | null = null
  try {
    const { data: snap } = await supabase
      .from('company_workforce_audits')
      .select('*')
      .eq('company_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (snap) workforceSnapshot = snap
  } catch {
    // optional — don't block if the table doesn't exist
  }

  // Build the prompt for the requested action.
  const companyData = (profile.company_data as Record<string, unknown> | null) || {}
  const headcount = companyData.headcount || companyData.team_size || companyData.size || null
  const stage = companyData.stage || companyData.funding_stage || null
  const hq = companyData.hq || companyData.headquarters || profile.location || null

  const COMPANY_BLOCK = `═══ COMPANY ═══
Name: ${profile.company_name || 'not provided'}
Industry: ${profile.industry || 'not provided'}
HQ / location: ${hq || 'not provided'}
Headcount signal: ${headcount || 'unknown — infer from industry/stage'}
Stage signal: ${stage || 'unknown — infer from industry/headcount'}
Headline: ${profile.headline || 'not provided'}
Summary: ${(profile.summary as string) || 'not provided'}`

  let prompt = ''
  let maxTokens = 3200

  if (action === 'diagnose_operating_model') {
    const orgDescription = String(input.org_description || '').slice(0, 4000) || 'Not provided — infer from industry/stage/headcount.'
    prompt = `You are a senior operating-model consultant advising a company on whether each business unit is running the right model for the next 5 years.

${COMPANY_BLOCK}

${VOICE_RULES}

═══ COMPANY-PROVIDED ORG DESCRIPTION ═══
${orgDescription}

═══ YOUR ANALYSIS ═══
Identify the company's business units (BUs) — 3 to 6 of them. For each BU, assess the current operating model, recommend the target state for a 3-5 year horizon in an AI-disrupted market, and explain the transition path. Then surface cross-cutting misalignments.

Return ONLY valid JSON in this exact shape:
{
  "perBU": [
    {
      "bu": "...",
      "model": "current operating model — e.g. 'centralised functional', 'product-led squads', 'matrix by geography'",
      "target_model": "recommended target model in 3-5 years",
      "why": "1-2 sentences, name the variance driver",
      "transition_path": "1 sentence on how to get there",
      "confidence_band": "high|medium|low — with one phrase on what would shift the call"
    }
  ],
  "misalignments": [
    { "issue": "...", "impact": "...", "fix": "..." }
  ],
  "sources_footer": "${SOURCES_FOOTER}"
}

Keep each field tight so the JSON closes. No hedge-words.`
  }

  if (action === 'map_org_dna') {
    const cultureDescriptors = String(input.culture_descriptors || '').slice(0, 4000) || 'Not provided.'
    const leadershipDescriptors = String(input.leadership_descriptors || '').slice(0, 2000) || 'Not provided.'
    const riskDescriptors = String(input.risk_descriptors || '').slice(0, 2000) || 'Not provided.'
    prompt = `You are an organisational psychologist mapping the DNA of a company so its workforce plan matches how it actually operates.

${COMPANY_BLOCK}

${VOICE_RULES}

═══ COMPANY-PROVIDED DESCRIPTORS ═══
Culture: ${cultureDescriptors}
Leadership style: ${leadershipDescriptors}
Risk tolerance / innovation appetite: ${riskDescriptors}

═══ YOUR ANALYSIS ═══
Map the company's DNA across five dimensions. For each, give a 1-line characterisation, a 0-10 score, and one implication for workforce strategy.

Return ONLY valid JSON in this exact shape:
{
  "culture": { "summary": "...", "score": 0, "workforce_implication": "..." },
  "leadership_style": { "summary": "...", "score": 0, "workforce_implication": "..." },
  "risk_tolerance": { "summary": "...", "score": 0, "workforce_implication": "..." },
  "innovation_appetite": { "summary": "...", "score": 0, "workforce_implication": "..." },
  "collaboration_maturity": { "summary": "...", "score": 0, "workforce_implication": "..." },
  "headline_archetype": "1 sentence summarising the org's DNA archetype",
  "sources_footer": "${SOURCES_FOOTER}"
}

Score 0-10 (integers only). Be honest — score generously only with evidence.`
  }

  if (action === 'plan_workforce') {
    const opModel = JSON.stringify(engagement.operating_model_diagnostic || {}).slice(0, 2500)
    const dna = JSON.stringify(engagement.org_dna || {}).slice(0, 1500)
    const snapshot = workforceSnapshot ? JSON.stringify(workforceSnapshot).slice(0, 2000) : 'No Workforce Snapshot on file.'
    prompt = `You are a senior workforce strategist building a 5-year workforce + AI plan grounded in the company's operating model diagnostic, org DNA, and any existing Workforce Snapshot.

${COMPANY_BLOCK}

${VOICE_RULES}

═══ OPERATING MODEL DIAGNOSTIC (from step 1) ═══
${opModel}

═══ ORG DNA (from step 2) ═══
${dna}

═══ EXISTING WORKFORCE SNAPSHOT (if any) ═══
${snapshot}

═══ YOUR ANALYSIS ═══
Produce a Y1 / Y3 / Y5 workforce plan. For each horizon, give scenarios (base / aggressive-AI / conservative), a cost trajectory band, and 5-way recommendation counts: Replace, Augment, Reskill, Redeploy, Protect.

Return ONLY valid JSON in this exact shape:
{
  "y1": {
    "scenarios": [
      { "name": "base|aggressive_ai|conservative", "headline": "...", "headcount_delta": "+X to +Y", "key_moves": ["...", "..."] }
    ],
    "cost_trajectory": "70%-confidence band on total comp + AI tooling spend (USD), with the variance driver named",
    "counts": { "replace": 0, "augment": 0, "reskill": 0, "redeploy": 0, "protect": 0 }
  },
  "y3": { "scenarios": [], "cost_trajectory": "...", "counts": { "replace": 0, "augment": 0, "reskill": 0, "redeploy": 0, "protect": 0 } },
  "y5": { "scenarios": [], "cost_trajectory": "...", "counts": { "replace": 0, "augment": 0, "reskill": 0, "redeploy": 0, "protect": 0 } },
  "headline_call": "1-2 sentences — the single most important bet this plan makes",
  "sources_footer": "${SOURCES_FOOTER}"
}

Every cost line names its variance driver. No hedge-words.`
  }

  if (action === 'generate_playbook') {
    const plan = JSON.stringify(engagement.workforce_plan || {}).slice(0, 3500)
    prompt = `You are a senior people-ops partner producing the execution playbook that turns a 5-year workforce plan into Monday-morning actions.

${COMPANY_BLOCK}

${VOICE_RULES}

═══ APPROVED 5-YEAR WORKFORCE PLAN (from step 3) ═══
${plan}

═══ YOUR DELIVERABLE ═══
Produce comms drafts, a compliance checklist, an outplacement plan, a hiring plan, and 90-day milestones.

Return ONLY valid JSON in this exact shape:
{
  "comms_drafts": {
    "all_hands_intro": "150-200 word draft the CEO can adapt and send",
    "manager_brief": "100-150 word brief for line managers running 1:1s",
    "exiting_staff_template": "80-120 word respectful template for those being let go"
  },
  "compliance_notes": [
    { "jurisdiction": "...", "requirement": "...", "action": "..." }
  ],
  "outplacement_plan": {
    "tiered_support": ["..."],
    "vendor_options": ["..."],
    "estimated_cost_band": "70%-confidence USD band, variance driver named"
  },
  "hiring_plan": {
    "q1_q2_roles": ["..."],
    "channels": ["..."],
    "interview_loop": "1 sentence on the shape of the loop"
  },
  "milestones": [
    { "day": 30, "milestone": "..." },
    { "day": 60, "milestone": "..." },
    { "day": 90, "milestone": "..." }
  ],
  "sources_footer": "${SOURCES_FOOTER}"
}

Tight, actionable, no hedge-words. Comms drafts read like a human wrote them.`
    maxTokens = 4000
  }

  // Call Claude.
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let parsed: Record<string, unknown> = {}
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[tier-b] no JSON in response for', action)
      return NextResponse.json({ error: 'Could not parse AI response — try again.' }, { status: 500 })
    }
    try {
      parsed = JSON.parse(match[0])
    } catch (e) {
      console.error('[tier-b] JSON parse error for', action, e)
      return NextResponse.json({ error: 'AI response was malformed — try again.' }, { status: 500 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[tier-b] anthropic error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Persist: column write + audit trail append + optional step advance.
  const column = ACTION_TO_COLUMN[action]
  const nextStep = advance
    ? Math.max(engagement.step ?? 1, Math.min(4, ACTION_TO_STEP[action] + 1))
    : engagement.step

  const auditEntry = {
    ts: new Date().toISOString(),
    who: user.id,
    what: `Ran ${action} (step ${ACTION_TO_STEP[action]}).`,
  }
  const prevAudit = Array.isArray(engagement.audit_trail) ? engagement.audit_trail : []

  const { data: updated, error: updateErr } = await supabase
    .from('tier_b_engagements')
    .update({
      [column]: parsed,
      step: nextStep,
      audit_trail: [...prevAudit, auditEntry],
      updated_at: new Date().toISOString(),
    })
    .eq('id', engagement.id)
    .select('*')
    .single()

  if (updateErr) {
    console.error('[tier-b] update error:', updateErr)
    return NextResponse.json({ error: 'Could not save step — try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, engagement: updated, result: parsed })
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — lock the engagement (final deliverable)
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const status = (body?.status as string) || 'locked'
  if (!['in_progress', 'locked', 'annual_refresh_due'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data: engagement } = await supabase
    .from('tier_b_engagements')
    .select('id, audit_trail')
    .eq('company_id', user.id)
    .maybeSingle()

  if (!engagement) return NextResponse.json({ error: 'No engagement to update' }, { status: 404 })

  const prevAudit = Array.isArray(engagement.audit_trail) ? engagement.audit_trail : []
  const auditEntry = {
    ts: new Date().toISOString(),
    who: user.id,
    what: `Status changed to ${status}.`,
  }

  const { data: updated, error } = await supabase
    .from('tier_b_engagements')
    .update({
      status,
      audit_trail: [...prevAudit, auditEntry],
      updated_at: new Date().toISOString(),
    })
    .eq('id', engagement.id)
    .select('*')
    .single()

  if (error) {
    console.error('[tier-b] PATCH error:', error)
    return NextResponse.json({ error: 'Could not update status' }, { status: 500 })
  }
  return NextResponse.json({ success: true, engagement: updated })
}
