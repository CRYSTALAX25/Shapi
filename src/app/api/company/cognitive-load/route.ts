// Company Cognitive Load Check — STRATEGY §16 long-horizon tool.
//
// Reads a structured per-team payload from the company (size, manager span,
// meeting load, recent changes, on-call, AI tool adoption, scope) and returns
// a per-team load score + verdict + drivers + relief actions, plus an
// org-wide first-move recommendation.
//
// Scoring rationale (encoded in the prompt + verdict gates):
//   - 0-49  sustainable   — load is within Gallup-benchmarked healthy bands
//   - 50-69 stretched     — one or two stress drivers; relievable without a hire
//   - 70-100 overloaded   — multiple compounding drivers (e.g. manager span >9
//                           AND on-call AND recent attrition); needs structural
//                           change (hire / redistribute / AI adoption)
//
// Auth required: signed-in company profile.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

type TeamInput = {
  name?: unknown
  headcount?: unknown
  manager_span?: unknown
  weekly_meeting_hours?: unknown
  recent_changes?: unknown
  on_call?: unknown
  ai_tool_adoption?: unknown
  scope?: unknown
}

type CleanTeam = {
  name: string
  headcount: number
  manager_span?: number
  weekly_meeting_hours?: number
  recent_changes?: string
  on_call?: boolean
  ai_tool_adoption?: 'low' | 'medium' | 'high'
  scope?: string
}

function cleanTeam(t: TeamInput): CleanTeam | null {
  const name = typeof t?.name === 'string' ? t.name.trim().slice(0, 80) : ''
  const headcountRaw = Number(t?.headcount)
  if (!name || !Number.isFinite(headcountRaw) || headcountRaw <= 0) return null

  const clean: CleanTeam = { name, headcount: Math.min(Math.round(headcountRaw), 1000) }

  const span = Number(t?.manager_span)
  if (Number.isFinite(span) && span > 0) clean.manager_span = Math.min(Math.round(span), 200)

  const meet = Number(t?.weekly_meeting_hours)
  if (Number.isFinite(meet) && meet >= 0) clean.weekly_meeting_hours = Math.min(Math.round(meet * 10) / 10, 80)

  if (typeof t?.recent_changes === 'string' && t.recent_changes.trim()) {
    clean.recent_changes = t.recent_changes.trim().slice(0, 400)
  }
  if (typeof t?.on_call === 'boolean') clean.on_call = t.on_call
  if (t?.ai_tool_adoption === 'low' || t?.ai_tool_adoption === 'medium' || t?.ai_tool_adoption === 'high') {
    clean.ai_tool_adoption = t.ai_tool_adoption
  }
  if (typeof t?.scope === 'string' && t.scope.trim()) {
    clean.scope = t.scope.trim().slice(0, 200)
  }
  return clean
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, industry, company_data, location')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const teamsRaw: TeamInput[] = Array.isArray(body?.teams) ? body.teams : []
  const teams: CleanTeam[] = teamsRaw.map(cleanTeam).filter((t): t is CleanTeam => t !== null).slice(0, 20)

  if (teams.length === 0) {
    return NextResponse.json({ error: 'Add at least one team with a name and headcount.' }, { status: 400 })
  }

  const context: string = typeof body?.context === 'string' ? body.context.trim().slice(0, 1000) : ''

  const teamsBlock = teams.map((t, i) => {
    const lines = [
      `Team ${i + 1}: ${t.name}`,
      `  headcount: ${t.headcount}`,
    ]
    if (t.manager_span !== undefined) lines.push(`  manager_span (direct reports): ${t.manager_span}`)
    if (t.weekly_meeting_hours !== undefined) lines.push(`  weekly_meeting_hours: ${t.weekly_meeting_hours}`)
    if (t.on_call !== undefined) lines.push(`  on_call: ${t.on_call ? 'yes' : 'no'}`)
    if (t.ai_tool_adoption) lines.push(`  ai_tool_adoption: ${t.ai_tool_adoption}`)
    if (t.scope) lines.push(`  scope: ${t.scope}`)
    if (t.recent_changes) lines.push(`  recent_changes: ${t.recent_changes}`)
    return lines.join('\n')
  }).join('\n\n')

  const companyData = (profile.company_data as Record<string, unknown> | null) || {}
  const headcountSignal = companyData.headcount || companyData.team_size || companyData.size || null

  const prompt = `You are a senior org-design strategist running a Cognitive Load Check for a company. You have structured per-team inputs and must return an honest, sourced read of who is overloaded and what to do about it.

═══ COMPANY ═══
Name: ${profile.company_name || 'not provided'}
Industry: ${profile.industry || 'not provided'}
Headcount signal: ${headcountSignal || 'inferred from team data below'}

═══ TEAMS ═══
${teamsBlock}

═══ EXTRA CONTEXT ═══
${context || 'None provided.'}

═══ VOICE ═══
Speak with sourced confidence. NEVER use the words "indicative", "approximate" (as a hedge), or "rough". Frame numeric reads as 70%-confidence and name the variance driver in one phrase when uncertain (e.g. "scales with on-call rotation depth", "depends on meeting-to-deep-work ratio"). Synthesise from Gallup management benchmarks (manager span / engagement), WEF Future of Jobs (AI adoption + job redesign), Anthropic published API pricing (where AI tool adoption meaningfully relieves cognitive load), and Shapi platform data.

═══ SCORING RUBRIC (apply this consistently) ═══
load_score is 0-100. Map drivers to the score:
  - Manager span: Gallup-healthy is 5-9 direct reports. 10-12 = +12 points. 13-15 = +20 points. >15 = +30 points.
  - Weekly meeting hours per person: 0-10h = +0. 11-18h = +8. 19-25h = +15. >25h = +22 points.
  - On-call rotation present: +8 points (small team) to +14 points (team ≤4 carrying 24/7 rotation).
  - Recent attrition / scope expansion in last 2 quarters: +10 to +18 points depending on severity.
  - AI tool adoption: high = -10 points (relieves load); medium = -3; low = +0; absent or actively avoided = +5.
  - Headcount vs scope mismatch (scope obviously larger than headcount): +10 to +20 points.

Verdict gates:
  - 0-49  -> "sustainable"
  - 50-69 -> "stretched"
  - 70-100 -> "overloaded"

For every team produce:
  - load_score (integer 0-100)
  - verdict (one of "sustainable" | "stretched" | "overloaded")
  - drivers: 2-3 SHORT signals citing the actual numbers ("manager span 12 + on-call", "23h/wk meetings, scope expanded Q4")
  - relief_actions: 2-3 SHORT concrete actions (max 14 words each) — e.g. "split team at function boundary", "promote a tech lead to absorb 4 reports", "kill recurring 1:1 meeting on Wednesdays"
  - hire_or_redistribute: one of "hire" | "redistribute" | "adopt_ai" | null — pick the SINGLE highest-leverage move; null only if verdict is sustainable

Then org-wide:
  - summary: 1-2 sentences — honest read of the org's cognitive-load picture
  - org_wide_recommendation: 1-2 sentences — what to do FIRST across the org (which team, which lever)
  - sources: literal string "Gallup management benchmarks · WEF Future of Jobs · Anthropic published API pricing · Shapi platform data"

═══ OUTPUT ═══
KEEP IT TIGHT so the JSON is complete and valid. Every driver / action max 14 words. The full JSON MUST close properly.

Return ONLY valid JSON in this exact shape:
{
  "summary": "...",
  "teams": [
    {
      "name": "...",
      "load_score": 0,
      "verdict": "sustainable|stretched|overloaded",
      "drivers": ["...", "..."],
      "relief_actions": ["...", "..."],
      "hire_or_redistribute": "hire|redistribute|adopt_ai|null"
    }
  ],
  "org_wide_recommendation": "...",
  "sources": "Gallup management benchmarks · WEF Future of Jobs · Anthropic published API pricing · Shapi platform data"
}

Be specific and honest. Name the actual numbers from the inputs in your drivers. Where data is thin, name the variance driver instead of hedging.`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[company/cognitive-load] no JSON in response')
      return NextResponse.json({ error: 'Could not parse load read' }, { status: 500 })
    }
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(match[0])
    } catch (e) {
      console.error('[company/cognitive-load] JSON parse error:', e)
      return NextResponse.json({ error: 'Response was malformed — try again.' }, { status: 500 })
    }

    // Defensive normalisation so the UI always renders.
    if (!Array.isArray(parsed.teams)) parsed.teams = []
    const teamsOut = (parsed.teams as Array<Record<string, unknown>>).map(t => {
      const scoreRaw = Number(t.load_score)
      const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 0
      // Re-derive verdict from score so it always matches the rubric gates.
      const verdict = score >= 70 ? 'overloaded' : score >= 50 ? 'stretched' : 'sustainable'
      const hr = t.hire_or_redistribute
      const hireOrRedistribute = (hr === 'hire' || hr === 'redistribute' || hr === 'adopt_ai') ? hr : null
      return {
        name: typeof t.name === 'string' ? t.name : '',
        load_score: score,
        verdict,
        drivers: Array.isArray(t.drivers) ? t.drivers.filter((d: unknown) => typeof d === 'string').slice(0, 4) : [],
        relief_actions: Array.isArray(t.relief_actions) ? t.relief_actions.filter((d: unknown) => typeof d === 'string').slice(0, 4) : [],
        hire_or_redistribute: hireOrRedistribute,
      }
    })

    const load = {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      teams: teamsOut,
      org_wide_recommendation: typeof parsed.org_wide_recommendation === 'string' ? parsed.org_wide_recommendation : '',
      sources: typeof parsed.sources === 'string' && parsed.sources
        ? parsed.sources
        : 'Gallup management benchmarks · WEF Future of Jobs · Anthropic published API pricing · Shapi platform data',
    }

    return NextResponse.json({ success: true, load })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[company/cognitive-load] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
