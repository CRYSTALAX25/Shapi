// Company Hiring Roadmap — the strategic-advice mirror of the candidate Career Roadmap.
//
// Inputs (read from the authenticated company's profile + open roles):
//   - profiles.industry, profiles.company_name, profiles.company_data (HQ/headcount-ish signals)
//   - roles table — open titles + descriptions for real hiring context
//
// Output (returned to the UI, not persisted yet — Ana can wire storage later):
//   - hiring_priorities: 3-5 priority roles to fill, with why + urgency
//   - reskill_vs_hire: skills they could reskill the existing team on vs hire fresh
//   - ai_risk: roles/functions exposed to AI displacement + concrete action
//   - next_90_days: 4-6 short concrete steps
//
// Honest by design — flags estimates vs concrete facts.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Optional team composition input — companies can tell us roughly who they
  // already employ so we don't recommend roles they've already filled.
  const body = await request.json().catch(() => ({}))
  const teamComposition: string = typeof body?.team_composition === 'string'
    ? body.team_composition.trim().slice(0, 1000)
    : ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, industry, company_data, location, headline, summary')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Pull the company's open roles for grounded context. Defensive — table may not
  // exist on every env, so we soft-fail and just continue without roles.
  let roles: Array<{ title?: string; description?: string; status?: string }> = []
  try {
    const { data: rolesData } = await supabase
      .from('roles')
      .select('title, description, status')
      .eq('company_id', user.id)
      .limit(20)
    if (Array.isArray(rolesData)) roles = rolesData
  } catch {
    // ignore — roles table optional
  }

  const companyData = (profile.company_data as Record<string, unknown> | null) || {}
  const headcount = companyData.headcount || companyData.team_size || companyData.size || null
  const stage = companyData.stage || companyData.funding_stage || null
  const hq = companyData.hq || companyData.headquarters || profile.location || null

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Split roles by status so the prompt can distinguish what's still open
  // (don't double-recommend) from what's been filled / closed (proves the
  // function already exists on the team).
  const openRoles = roles.filter(r => r.status === 'active' || !r.status)
  const closedRoles = roles.filter(r => r.status && r.status !== 'active')
  const openRolesBlock = openRoles.length
    ? openRoles.map((r, i) => `${i + 1}. ${r.title || 'untitled'}${r.description ? ` — ${String(r.description).slice(0, 180)}` : ''}`).join('\n')
    : 'None posted on Shapi yet.'
  const closedRolesBlock = closedRoles.length
    ? closedRoles.map((r, i) => `${i + 1}. ${r.title || 'untitled'} [${r.status}]`).join('\n')
    : 'None.'
  const teamBlock = teamComposition
    ? teamComposition
    : 'Not provided — work from open roles + industry signals only, and flag the variance driver in your "why" lines (e.g. "scales with team makeup we don\'t yet have").'

  const prompt = `You are a senior talent strategist advising a company on how to build the right team for the next 12 months in an AI-disrupted market. Produce a focused Hiring Roadmap.

═══ COMPANY ═══
Name: ${profile.company_name || 'not provided'}
Industry: ${profile.industry || 'not provided'}
HQ / location: ${hq || 'not provided'}
Headcount signal: ${headcount || 'unknown — infer from industry/stage'}
Stage signal: ${stage || 'unknown — infer from industry/headcount'}
Headline: ${profile.headline || 'not provided'}
Summary: ${(profile.summary as string) || 'not provided'}

═══ VOICE ═══
Speak with sourced confidence. NEVER use the words "indicative", "approximate" (as a hedge), or "rough". When uncertain, name the variance driver in one phrase (e.g. "scales with headcount", "depends on funding runway"). Do NOT prefix lines with "Estimate:". Numeric prefixes like "~$15" are fine. Synthesise from Mercer / Glassdoor / Anthropic/OpenAI published API pricing / BLS labour statistics / Shapi platform data.

═══ TEAM YOU ALREADY HAVE (from the company directly) ═══
${teamBlock}

═══ ROLES STILL OPEN ON SHAPI (do NOT re-recommend these — they are already being hired) ═══
${openRolesBlock}

═══ ROLES PREVIOUSLY POSTED / NOW CLOSED ON SHAPI (signals the function already exists on the team) ═══
${closedRolesBlock}

═══ YOUR ANALYSIS ═══

1. HIRING PRIORITIES — exactly 3-5 roles the company should prioritise hiring in the next 6-12 months.
   Each: { role (title), why (1 short sentence — explicitly reference their existing team / open roles when you can), urgency ("now" | "next quarter" | "next 6-12 months"), starter_jd (a SHORT job description ready for them to amend — see shape below) }
   - DO NOT recommend roles that already appear in the OPEN ROLES list above; assume those are being filled.
   - When the team composition shows a function is already covered, DO NOT recommend duplicating it — recommend an adjacent / complementary role instead. Reference what they already have in the "why".
   - Be specific to THIS company's industry/stage/team. Generic advice = useless.
   - starter_jd shape: { headline (1 line, role's purpose), responsibilities ([3-5 bullets, max 14 words each]), must_haves ([3-5 short skills/experience items]), nice_to_haves ([2-3 short items]), salary_band (one sourced range with currency + the source — e.g. "$45-65k base (Mercer MENA / Glassdoor)") } — keep tight; the company can refine on WhatsApp by texting "edit JD for [role]".

2. RESKILL vs HIRE — exactly 3-5 skills the company will need.
   Each: { skill, recommendation ("reskill" | "hire"), why (1 short sentence — explain when reskilling an existing team is faster/cheaper vs hiring fresh) }
   - Reskill = skill is teachable to existing team in <6 months (e.g. prompt engineering, basic SQL, modern tooling).
   - Hire = needs deep specialism or significantly different background (e.g. ML platform engineer, senior security, FP&A lead).

3. AI RISK — exactly 3-5 roles or functions in this company exposed to AI displacement or transformation.
   Each: { role_or_function, risk ("low" | "medium" | "high"), why (1 sentence — what AI specifically changes), action (1 sentence — what to do: augment, redeploy, freeze hiring, etc.) }
   - Be honest. If a function is largely automatable in 12 months, say "high".
   - Prefer actionable framings ("augment with...", "freeze backfills, redeploy to...") over vague advice.

4. NEXT 90 DAYS — exactly 4-6 short concrete steps (max 14 words each).
   Each: { step }
   - Mix of hiring actions, reskilling actions, and one process/measurement step.

═══ OUTPUT ═══
KEEP IT TIGHT so the JSON is complete and valid. Every "why" = 1 short sentence (max 18 words). Each step max 14 words. The full JSON MUST close properly.

Return ONLY valid JSON in this exact shape:
{
  "hiring_priorities": [
    {
      "role": "...",
      "why": "...",
      "urgency": "now|next quarter|next 6-12 months",
      "starter_jd": {
        "headline": "...",
        "responsibilities": ["...", "..."],
        "must_haves": ["...", "..."],
        "nice_to_haves": ["...", "..."],
        "salary_band": "..."
      }
    }
  ],
  "reskill_vs_hire": [
    { "skill": "...", "recommendation": "reskill|hire", "why": "..." }
  ],
  "ai_risk": [
    { "role_or_function": "...", "risk": "low|medium|high", "why": "...", "action": "..." }
  ],
  "next_90_days": [
    { "step": "..." }
  ]
}

Be specific and honest. Where data is thin, name the variance driver instead of using hedge-words.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3200,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[company/roadmap] no JSON in response')
      return NextResponse.json({ error: 'Could not parse roadmap' }, { status: 500 })
    }
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(match[0])
    } catch (e) {
      console.error('[company/roadmap] JSON parse error:', e)
      return NextResponse.json({ error: 'Roadmap response was malformed — try again.' }, { status: 500 })
    }

    // Defensive defaults so the UI always renders something sane.
    if (!Array.isArray(parsed.hiring_priorities)) parsed.hiring_priorities = []
    if (!Array.isArray(parsed.reskill_vs_hire)) parsed.reskill_vs_hire = []
    if (!Array.isArray(parsed.ai_risk)) parsed.ai_risk = []
    if (!Array.isArray(parsed.next_90_days)) parsed.next_90_days = []

    const roadmap = { ...parsed, generated_at: new Date().toISOString() }
    return NextResponse.json({ success: true, roadmap })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[company/roadmap] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
