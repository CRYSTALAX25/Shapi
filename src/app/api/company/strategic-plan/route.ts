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
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropic } from '@/lib/anthropic'
import { scoreCandidateForRole, type MatchCandidate, type MatchRole } from '@/lib/matching'

// Sonnet 4.6 with 3200-4000 tokens + multi-block context (company +
// diagnostic + DNA + snapshot + workforce_plan + people_outlay) regularly
// runs 35-55s. Previous 60s cap tripped on the workforce_plan step (Ana
// hit this in testing). Vercel auto-clamps to the plan's max.
export const maxDuration = 300

type Action = 'diagnose_operating_model' | 'map_org_dna' | 'plan_workforce' | 'generate_playbook' | 'map_people_outlay'

const ACTION_TO_COLUMN: Record<Action, string> = {
  diagnose_operating_model: 'operating_model_diagnostic',
  map_org_dna: 'org_dna',
  plan_workforce: 'workforce_plan',
  generate_playbook: 'execution_playbook',
  map_people_outlay: 'people_outlay',
}

const ACTION_TO_STEP: Record<Action, number> = {
  diagnose_operating_model: 1,
  map_org_dna: 2,
  plan_workforce: 3,
  map_people_outlay: 4,
  generate_playbook: 5,
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
  // Default headroom. Sonnet 4.6 supports up to 64K output tokens; we
  // generously over-budget to avoid the truncation class of failures
  // Ana hit on plan_workforce. Per-step overrides below for big outputs.
  let maxTokens = 6000

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
    // Four horizons (Y1/Y3/Y5/Y10) × scenarios × cost trajectories + counts
    // = the biggest output in the wizard. Generous token budget. Ana hit
    // mid-string truncation at 4000 — bumping to 10000 eliminates that
    // class of failure even when Sonnet writes verbose scenarios.
    maxTokens = 10000
    prompt = `You are a senior workforce strategist building a 1/3/5/10-year workforce + AI plan grounded in the company's operating model diagnostic, org DNA, and any existing Workforce Snapshot.

${COMPANY_BLOCK}

${VOICE_RULES}

═══ OPERATING MODEL DIAGNOSTIC (from step 1) ═══
${opModel}

═══ ORG DNA (from step 2) ═══
${dna}

═══ EXISTING WORKFORCE SNAPSHOT (if any) ═══
${snapshot}

═══ YOUR ANALYSIS ═══
Produce a Y1 / Y3 / Y5 / Y10 workforce plan. For each horizon, give 2-3 scenarios (base + 1-2 alternatives), a cost trajectory band, and the 6-way recommendation BUCKETS with both COUNTS and the SPECIFIC ROLE TITLES in each bucket:
  - replace   — humans swapped for different humans (changing skill mix)
  - augment   — humans + AI tools (keep the person, give them AI leverage)
  - reskill   — same person re-trained for a different role
  - redeploy  — same person moved to a different team where they're more valuable
  - protect   — high-value people likely to leave during change; retain
  - automate  — AI takes the role over entirely (no human needed)

Y10 is the long-range outlook — sandbag the confidence band wider there and name the structural assumption that would shift the call.

LENGTH DISCIPLINE — KEEP THE JSON COMPACT:
- Each scenario.headline: ONE sentence, max 20 words.
- key_moves: 2-3 SHORT phrases each (5-10 words), not full sentences.
- cost_trajectory: ONE sentence with the band + variance driver. Max 30 words.
- headline_call: 1 sentence, max 25 words.
- Role lists per bucket: 3-8 concrete TITLES each (e.g. "Senior Backend Engineer", "Customer Success Lead"), NOT descriptions.
- Be specific and decision-oriented. No padding. The JSON must close cleanly within the response budget.

Return ONLY valid JSON in this exact shape:
{
  "y1": {
    "scenarios": [
      { "name": "base|aggressive_ai|conservative", "headline": "...", "headcount_delta": "+X to +Y", "key_moves": ["...", "..."] }
    ],
    "cost_trajectory": "70%-confidence band on total comp + AI tooling spend (USD), with the variance driver named",
    "buckets": {
      "replace":  { "count": 0, "roles": ["concrete title", "concrete title"] },
      "augment":  { "count": 0, "roles": [] },
      "reskill":  { "count": 0, "roles": [] },
      "redeploy": { "count": 0, "roles": [] },
      "protect":  { "count": 0, "roles": [] },
      "automate": { "count": 0, "roles": [] }
    }
  },
  "y3":  { "scenarios": [], "cost_trajectory": "...", "buckets": { "replace": {"count":0,"roles":[]}, "augment": {"count":0,"roles":[]}, "reskill": {"count":0,"roles":[]}, "redeploy": {"count":0,"roles":[]}, "protect": {"count":0,"roles":[]}, "automate": {"count":0,"roles":[]} } },
  "y5":  { "scenarios": [], "cost_trajectory": "...", "buckets": { "replace": {"count":0,"roles":[]}, "augment": {"count":0,"roles":[]}, "reskill": {"count":0,"roles":[]}, "redeploy": {"count":0,"roles":[]}, "protect": {"count":0,"roles":[]}, "automate": {"count":0,"roles":[]} } },
  "y10": { "scenarios": [], "cost_trajectory": "...", "buckets": { "replace": {"count":0,"roles":[]}, "augment": {"count":0,"roles":[]}, "reskill": {"count":0,"roles":[]}, "redeploy": {"count":0,"roles":[]}, "protect": {"count":0,"roles":[]}, "automate": {"count":0,"roles":[]} } },
  "headline_call": "1-2 sentences — the single most important bet this plan makes",
  "sources_footer": "${SOURCES_FOOTER}"
}

Every cost line names its variance driver. Y10 scenarios should explicitly call out the assumption that would invalidate them (e.g. 'assumes AI cost-to-capability ratio improves 2x/yr; if it stalls, automate shifts to augment'). count = roles.length in each bucket. No hedge-words.`
  }

  if (action === 'map_people_outlay') {
    const plan = JSON.stringify(engagement.workforce_plan || {}).slice(0, 3500)
    const diagnostic = JSON.stringify(engagement.operating_model_diagnostic || {}).slice(0, 2000)
    prompt = `You are a senior workforce strategist extracting the SPECIFIC role gaps from a 5-year workforce plan so they can be matched to Shapi's verified candidate pool. This is the "People Outlay Map" — the step that turns abstract counts (replace 3, augment 5) into actual hiring needs Shapi can fill.

${COMPANY_BLOCK}

${VOICE_RULES}

═══ APPROVED WORKFORCE PLAN (from step 3) ═══
${plan}

═══ OPERATING MODEL DIAGNOSTIC (from step 1) ═══
${diagnostic}

═══ YOUR ANALYSIS ═══
Translate the counts in the plan (replace/augment/reskill/redeploy/protect) into 5-10 specific role gaps with concrete titles. Each gap = a role the company needs to fill, in a timeframe (Y1 Q1-Q4 / Y2 / Y3+). For each gap, name the seniority level, the must-have skills/experience (3-5 short phrases for skill-matching), the rough city/region the role would be based in (use the company's HQ if not otherwise constrained), and the type of move it represents (new_hire | reskill | redeploy).

Prioritise role gaps that are:
- Critical-path (the plan depends on them)
- Most cost-impactful (highest comp, longest time-to-fill)
- Specific enough that Shapi can match them against verified candidates

Return ONLY valid JSON in this exact shape:
{
  "headline": "1 sentence — the most important hiring decision in the plan",
  "role_gaps": [
    {
      "title": "concrete role title — e.g. 'Head of AI/ML Engineering', 'Senior Backend Engineer'",
      "seniority": "junior | mid | senior | lead | head-of | exec",
      "when": "Y1 Q1 | Y1 Q2 | Y1 Q3 | Y1 Q4 | Y2 | Y3+",
      "type": "new_hire | reskill | redeploy",
      "why": "1 sentence — why the plan needs this role and what it unlocks",
      "must_have_skills": ["3-5 short skill or domain phrases — used for candidate matching"],
      "location_hint": "city or region the role would be based in",
      "headcount": 1,
      "time_to_fill_weeks": "70%-confidence band, e.g. '6-12 weeks', with one phrase on the variance driver"
    }
  ],
  "sources_footer": "${SOURCES_FOOTER}"
}

5-10 role_gaps total. The list must total roughly the headcount counts in the plan (replace + augment + new hires). No hedge-words. Be specific — "Senior Backend Engineer" not "Engineering Hire".

LENGTH DISCIPLINE: each gap's why = 1 sentence, must_have_skills = 3-5 short phrases (not sentences), time_to_fill_weeks = "6-12 weeks, variance: [one phrase]". Keep the JSON compact so it closes cleanly.`
    maxTokens = 8000
  }

  if (action === 'generate_playbook') {
    const plan = JSON.stringify(engagement.workforce_plan || {}).slice(0, 3500)
    const peopleOutlay = JSON.stringify(engagement.people_outlay || {}).slice(0, 2000)
    prompt = `You are a senior people-ops partner producing the execution playbook that turns a 5-year workforce plan into Monday-morning actions.

${COMPANY_BLOCK}

${VOICE_RULES}

═══ APPROVED 5-YEAR WORKFORCE PLAN (from step 3) ═══
${plan}

═══ PEOPLE OUTLAY MAP (from step 4 — specific role gaps + matched candidates) ═══
${peopleOutlay}

═══ YOUR DELIVERABLE ═══
Produce comms drafts, a compliance checklist, an outplacement plan, a hiring plan (use the specific role gaps from the People Outlay — name them concretely), and 90-day milestones.

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

Tight, actionable, no hedge-words. Comms drafts read like a human wrote them.

LENGTH DISCIPLINE: stay inside the word caps named in each field (150-200 for all-hands, 100-150 for manager brief, 80-120 for exiting-staff). Compliance + outplacement + hiring sections should be punchy lists, not essays. Keep the JSON compact so it closes cleanly.`
    maxTokens = 10000
  }

  // Call Claude — SONNET 4.6 PRIMARY for tier-b steps. This is the
  // premium-engagement product ($5-10k Strategic Workforce Plan,
  // $15-40k Full Transformation); buyers expect best-in-class analysis,
  // not a fallback model. Haiku 4.5 stays as a hot standby only when
  // Sonnet is at capacity (HTTP 529).
  //
  // REQUIRED: Vercel Pro plan ($20/mo) so maxDuration=300 actually takes
  // effect. On Hobby the 300s is silently clamped to 60s and Sonnet's
  // 45-65s response time trips the cap → silent reverts. See
  // project_post_launch_backlog for the upgrade trigger conditions.
  const anthropic = getAnthropic()

  async function callClaude(model: string) {
    return anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })
  }
  function isOverloaded(err: unknown): boolean {
    const m = err instanceof Error ? err.message : String(err)
    return /529|overloaded|overload_error|capacity/i.test(m)
  }

  let parsed: Record<string, unknown> = {}
  let modelUsed = 'claude-sonnet-4-6'
  const claudeStartMs = Date.now()
  try {
    let response: Awaited<ReturnType<typeof callClaude>>
    try {
      response = await callClaude('claude-sonnet-4-6')
    } catch (sonnetErr) {
      if (!isOverloaded(sonnetErr)) throw sonnetErr
      console.warn(`[tier-b] Sonnet overloaded for ${action}, falling back to Haiku 4.5`)
      modelUsed = 'claude-haiku-4-5-20251001'
      response = await callClaude('claude-haiku-4-5-20251001')
    }
    const elapsedMs = Date.now() - claudeStartMs
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const inTokens = response.usage?.input_tokens ?? 'n/a'
    const outTokens = response.usage?.output_tokens ?? 'n/a'
    console.log(`[tier-b] ${action} via ${modelUsed} — ${elapsedMs}ms, tokens in=${inTokens} out=${outTokens}, text len=${text.length}`)

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[tier-b] no JSON in response for', action, '— first 500 chars:', text.slice(0, 500))
      return NextResponse.json({ error: 'AI response had no JSON — likely truncated. Try once more.' }, { status: 500 })
    }
    try {
      parsed = JSON.parse(match[0])
    } catch (e) {
      console.error('[tier-b] JSON parse error for', action, '— last 200 chars:', match[0].slice(-200), '| out_tokens:', outTokens, '| max_tokens:', maxTokens, e)
      // If the response hit max_tokens exactly, it's a definite truncation
      // and not a transient error — telling the user to retry is wrong.
      // Log the diagnostic but ALWAYS recommend retry since we just bumped
      // the per-action budgets to absorb verbose generations.
      return NextResponse.json({ error: 'The analysis came back too long for one response — try once more, we just tuned the limits.' }, { status: 500 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[tier-b] anthropic error:', msg)
    // Friendlier copy for the common-and-recoverable error classes so the
    // raw Anthropic JSON doesn't surface to the user.
    if (/529|overloaded|overload_error|capacity/i.test(msg)) {
      return NextResponse.json(
        { error: 'Our analysis engine is at capacity right now — try again in 30–60 seconds.' },
        { status: 503 },
      )
    }
    if (/rate.?limit|429/i.test(msg)) {
      return NextResponse.json(
        { error: 'Hit a rate limit — wait a minute and try again.' },
        { status: 429 },
      )
    }
    return NextResponse.json({ error: 'Step engine hit a snag — try again.' }, { status: 500 })
  }

  // ── People Outlay augmentation ─────────────────────────────────────────
  // For map_people_outlay only: take Claude's extracted role_gaps[] and
  // augment each with matched verified candidates from the platform pool.
  // This is the moat. Without it, this step is just another AI-generated
  // list; WITH it, the engagement output names actual humans available now.
  if (action === 'map_people_outlay' && Array.isArray(parsed.role_gaps)) {
    try {
      const admin = createAdminClient()
      // Fetch verified candidates with enough signal to match meaningfully.
      const { data: pool } = await admin
        .from('profiles')
        .select('id, full_name, headline, location, skills, completion_pct, verification_tier, salary_expectations, open_to_engagement, target_roles, industry, ai_tier')
        .eq('type', 'candidate')
        .eq('profile_live', true)
        .gte('completion_pct', 50)
        .limit(300)

      const candidates = (pool || []) as Array<MatchCandidate & {
        id: string; full_name: string | null; headline: string | null; location: string | null
      }>

      const augmentedGaps = (parsed.role_gaps as Array<Record<string, unknown>>).map(gap => {
        const title = String(gap.title || '')
        const skills = Array.isArray(gap.must_have_skills) ? (gap.must_have_skills as string[]) : []
        const location = String(gap.location_hint || '')

        // Synthesise a Role from the gap so scoreCandidateForRole can rank
        // candidates against it.
        const syntheticRole: MatchRole = {
          title,
          location,
          requirements: skills.join(', '),
          description: `${gap.why || ''} ${gap.seniority || ''}`.trim(),
          engagement_type: 'permanent',
        }

        const scored = candidates
          .map(c => ({ c, ...scoreCandidateForRole(c, syntheticRole) }))
          .filter(s => s.score >= 35) // floor so we don't surface noise
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(s => ({
            id: s.c.id,
            public_id: s.c.id.slice(0, 8),
            full_name: s.c.full_name,
            headline: s.c.headline,
            location: s.c.location,
            verification_tier: s.c.verification_tier || 'unverified',
            match_score: s.score,
            match_reasons: s.reasons,
          }))

        return {
          ...gap,
          verified_candidates: scored,
          pool_match_count: scored.length,
        }
      })

      // Summary across all gaps.
      const totalCandidatesMatched = augmentedGaps.reduce((sum, g) => sum + (Array.isArray(g.verified_candidates) ? g.verified_candidates.length : 0), 0)
      const avgScore = totalCandidatesMatched > 0
        ? Math.round(
            augmentedGaps.flatMap(g => Array.isArray(g.verified_candidates) ? (g.verified_candidates as Array<{ match_score: number }>) : [])
              .reduce((sum, c) => sum + (c.match_score || 0), 0) / totalCandidatesMatched,
          )
        : 0
      const gapsWithMatches = augmentedGaps.filter(g => Array.isArray(g.verified_candidates) && (g.verified_candidates as unknown[]).length > 0).length

      parsed = {
        ...parsed,
        role_gaps: augmentedGaps,
        outlay_summary: {
          total_role_gaps: augmentedGaps.length,
          gaps_with_matches: gapsWithMatches,
          gaps_without_matches: augmentedGaps.length - gapsWithMatches,
          total_candidates_matched: totalCandidatesMatched,
          average_match_score: avgScore,
          pool_size_considered: candidates.length,
        },
      }
    } catch (e) {
      // Pool augmentation is best-effort. If it fails, we still ship the
      // Claude-generated role_gaps so the step has visible output.
      console.warn('[tier-b] people-outlay pool augmentation failed:', e)
    }
  }

  // Persist: column write + audit trail append + optional step advance.
  const column = ACTION_TO_COLUMN[action]
  const nextStep = advance
    ? Math.max(engagement.step ?? 1, Math.min(5, ACTION_TO_STEP[action] + 1))
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
