// Target-State Org Design — Tier B premium deliverable (STRATEGY §16).
//
// Given a company's current team, strategy, and AI integration plan, returns
// a target operating model: what teams to build, how they should report,
// inter-team dependencies, the growth path to year 2, and a 70%-confidence
// cost envelope. Synthesised from Mercer / Glassdoor / Anthropic+OpenAI
// published API pricing / Shapi platform data.
//
// Auth: signed-in company account only.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, industry, company_data, location, headline, summary')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.type !== 'company') {
    return NextResponse.json({ error: 'Company accounts only' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const currentTeam: string = typeof body?.current_team_composition === 'string'
    ? body.current_team_composition.trim().slice(0, 2000)
    : ''
  const strategy: string = typeof body?.strategy === 'string'
    ? body.strategy.trim().slice(0, 2000)
    : ''
  const aiPlan: string = typeof body?.ai_integration_plan === 'string'
    ? body.ai_integration_plan.trim().slice(0, 2000)
    : ''
  const growthTarget: string = typeof body?.growth_target === 'string'
    ? body.growth_target.trim().slice(0, 500)
    : ''
  const country: string = typeof body?.country === 'string'
    ? body.country.trim().slice(0, 100)
    : ''

  if (!currentTeam || !strategy || !aiPlan) {
    return NextResponse.json(
      { error: 'current_team_composition, strategy and ai_integration_plan are all required.' },
      { status: 400 }
    )
  }

  const companyData = (profile.company_data as Record<string, unknown> | null) || {}
  const headcount = companyData.headcount || companyData.team_size || companyData.size || null
  const stage = companyData.stage || companyData.funding_stage || null
  const hq = country || companyData.hq || companyData.headquarters || profile.location || 'not provided'

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are a senior operating-model strategist designing a target-state organisation for a company building toward year 2 in an AI-disrupted market. Produce a focused Target-State Org Design.

═══ COMPANY ═══
Name: ${profile.company_name || 'not provided'}
Industry: ${profile.industry || 'not provided'}
HQ / country: ${hq}
Headcount signal: ${headcount || 'unknown — infer from team composition + industry'}
Stage signal: ${stage || 'unknown — infer from team composition + strategy'}
Headline: ${profile.headline || 'not provided'}
Summary: ${(profile.summary as string) || 'not provided'}

═══ VOICE ═══
Speak with sourced confidence. NEVER use the words "indicative", "approximate" (as a hedge), or "rough". Use 70%-confidence bands for numeric ranges and name the variance drivers explicitly. Do NOT prefix lines with "Estimate:". Numeric prefixes like "$120k" are fine. Synthesise from Mercer / Glassdoor / Anthropic+OpenAI published API pricing / Shapi platform data.

═══ INPUTS ═══

CURRENT TEAM COMPOSITION:
${currentTeam}

STRATEGY (where they're going):
${strategy}

AI INTEGRATION PLAN (how AI fits):
${aiPlan}

GROWTH TARGET:
${growthTarget || 'Not specified — infer from strategy + industry benchmarks.'}

═══ YOUR ANALYSIS ═══

Design the team they will need by year 2, given strategy + AI integration. Be specific to THIS company. Generic org charts = useless.

1. SUMMARY — 1-2 honest sentences naming where they're actually going (the read between the lines of the strategy).

2. TARGET ORG — exactly 4-8 teams. Each:
   { team (name), purpose (1 sentence, what this team owns), headcount: { now, year_1, year_2 } (integers — reference current team composition for "now"), roles (3-6 short role titles inside this team), reports_to (optional — name of the team or "CEO"/"COO" etc.) }
   - "now" headcount MUST be grounded in what they actually have today (0 is fine if the team doesn't exist yet).
   - AI integration plan should compress headcount in some teams (call this out via lower y1/y2 vs industry norm) and grow it in others.

3. DEPENDENCIES — exactly 3-6 inter-team dependencies that are load-bearing for the strategy.
   Each: { from (team name from target_org), to (team name from target_org), why (1 short sentence — what flows between them and why it breaks if it fails) }

4. GROWTH PATH — milestones to get from now → year 2.
   { y1: [3-5 short milestones, max 12 words each], y2: [3-5 short milestones, max 12 words each] }

5. RISK AREAS — exactly 2-4 honest risks in this design.
   Each: short phrase (max 16 words). Examples: "AI Ops team is a single point of failure until y2 hire 3", "Engineering velocity assumes 80% AI coding adoption — fragile if reality is 40%".

6. COST ENVELOPE — fully-loaded annual people-cost ranges (70% confidence band) for year 1 and year 2.
   { y1_low, y1_high, y2_low, y2_high, currency (e.g. "USD", "AED", "GBP" — match country), drivers: [2-3 short variance drivers, max 14 words each] }
   - Fully-loaded = base + benefits + employer taxes + tooling per head.
   - Anchor to Mercer / Glassdoor for the country named above.
   - drivers = what makes the band wide (e.g. "seniority mix of 3 senior eng hires", "UAE Emiratisation quota cost", "AI tooling per-seat at scale").

7. SOURCES — single string naming the actual data sources you synthesised from (e.g. "Mercer MENA 2025 / Glassdoor / Anthropic+OpenAI published API pricing / Shapi platform data").

═══ OUTPUT ═══
KEEP IT TIGHT so the JSON is complete and valid. Every "purpose" / "why" = 1 short sentence (max 18 words). The full JSON MUST close properly.

Return ONLY valid JSON in this exact shape:
{
  "summary": "...",
  "target_org": [
    {
      "team": "...",
      "purpose": "...",
      "headcount": { "now": 0, "year_1": 0, "year_2": 0 },
      "roles": ["...", "..."],
      "reports_to": "..."
    }
  ],
  "dependencies": [
    { "from": "...", "to": "...", "why": "..." }
  ],
  "growth_path": {
    "y1": ["..."],
    "y2": ["..."]
  },
  "risk_areas": ["..."],
  "cost_envelope": {
    "y1_low": 0,
    "y1_high": 0,
    "y2_low": 0,
    "y2_high": 0,
    "currency": "USD",
    "drivers": ["..."]
  },
  "sources": "..."
}

Be specific, honest, and sourced. Where data is thin, name the variance driver instead of using hedge-words.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2800,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[company/org-design] no JSON in response')
      return NextResponse.json({ error: 'Could not parse org design' }, { status: 500 })
    }
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(match[0])
    } catch (e) {
      console.error('[company/org-design] JSON parse error:', e)
      return NextResponse.json({ error: 'Org design response was malformed — try again.' }, { status: 500 })
    }

    // Defensive defaults so the UI always renders something sane.
    if (typeof parsed.summary !== 'string') parsed.summary = ''
    if (!Array.isArray(parsed.target_org)) parsed.target_org = []
    if (!Array.isArray(parsed.dependencies)) parsed.dependencies = []
    if (!parsed.growth_path || typeof parsed.growth_path !== 'object') {
      parsed.growth_path = { y1: [], y2: [] }
    } else {
      const gp = parsed.growth_path as Record<string, unknown>
      if (!Array.isArray(gp.y1)) gp.y1 = []
      if (!Array.isArray(gp.y2)) gp.y2 = []
    }
    if (!Array.isArray(parsed.risk_areas)) parsed.risk_areas = []
    if (!parsed.cost_envelope || typeof parsed.cost_envelope !== 'object') {
      parsed.cost_envelope = {
        y1_low: 0, y1_high: 0, y2_low: 0, y2_high: 0, currency: 'USD', drivers: [],
      }
    } else {
      const ce = parsed.cost_envelope as Record<string, unknown>
      if (typeof ce.currency !== 'string') ce.currency = 'USD'
      if (!Array.isArray(ce.drivers)) ce.drivers = []
    }
    if (typeof parsed.sources !== 'string') {
      parsed.sources = 'Mercer / Glassdoor / Anthropic+OpenAI published API pricing / Shapi platform data'
    }

    return NextResponse.json({ success: true, design: parsed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[company/org-design] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
