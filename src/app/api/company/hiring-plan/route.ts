// Company Hiring Plan — given industry + country + stage (+ optional monthly
// burn budget and current headcount), returns an honest read on where the
// company is and what to do next: a perm/temp/fractional split with rationale,
// the next 3 hires (role, level, mode), a 70%-confidence monthly comp band, and
// risks + quick wins.
//
// VOICE: comp bands are framed as 70%-confidence ranges synthesised from public
// benchmarks (Mercer / PayScale / Numbeo / Glassdoor / Shapi platform data), with
// named variance drivers — no hedge-words. Auth optional. Fast path via Haiku.

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

type Stage = 'pre-seed' | 'seed' | 'series-a' | 'growth' | 'enterprise'
const STAGES: Stage[] = ['pre-seed', 'seed', 'series-a', 'growth', 'enterprise']

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const industry = typeof body.industry === 'string' ? body.industry.trim() : ''
  const country = typeof body.country === 'string' ? body.country.trim() : ''
  const stageRaw = typeof body.stage === 'string' ? body.stage.trim().toLowerCase() : ''
  const stage = (STAGES as string[]).includes(stageRaw) ? (stageRaw as Stage) : ''
  const monthly_burn_budget = typeof body.monthly_burn_budget === 'number' && body.monthly_burn_budget > 0 ? body.monthly_burn_budget : null
  const headcount_today = typeof body.headcount_today === 'number' && body.headcount_today >= 0 ? body.headcount_today : null

  if (!industry) return NextResponse.json({ error: 'Tell us your industry.' }, { status: 400 })
  if (!country) return NextResponse.json({ error: 'Add your country for accurate guidance.' }, { status: 400 })
  if (!stage) return NextResponse.json({ error: 'Pick a stage.' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const budgetLine = monthly_burn_budget != null
    ? `Monthly burn budget for hiring: ~${monthly_burn_budget} (local currency).`
    : 'Monthly burn budget for hiring: not provided — anchor to a typical budget for this stage.'
  const headcountLine = headcount_today != null
    ? `Current headcount: ${headcount_today}.`
    : 'Current headcount: not provided — anchor to a typical team for this stage.'

  const prompt = `You are Shapi, a blunt, practical hiring advisor for founders and ops leads. A company in the "${industry}" industry based in ${country} at the "${stage}" stage is planning their next wave of hiring.

CONTEXT:
- Industry: ${industry}
- Country: ${country}
- Stage: ${stage}
- ${budgetLine}
- ${headcountLine}

VOICE — STRICT: Speak with sourced confidence. NEVER use the words "indicative", "approximate" (as a hedge), or "rough". Frame comp ranges as a 70%-confidence band synthesised from Mercer / PayScale / Numbeo cost-of-living / Glassdoor / government labour statistics. Name the variance driver in one phrase ("varies with seniority", "scales with equity weighting"). Numeric prefixes like "~$15" are fine; the words are not.

Rules:
- Give an HONEST read of where they are and what to do — not a sales pitch.
- The perm/temp/fractional split MUST sum to 100. Be opinionated: at pre-seed/seed, fractional + temp usually beat perm; at growth/enterprise, perm dominates.
- "Next 3 hires" must be specific to the industry (e.g. "Senior backend engineer" not "engineer"). Mark each as junior/mid/senior and perm/temp/fractional.
- Monthly comp band = 70%-confidence range for the 3 hires combined, in local currency or USD. The "note" must NAME the biggest variance driver (seniority, sector, equity weight) — do NOT use the words "approx" / "approximate" / "indicative" / "varies" as standalone hedges.
- Risks (2-3) = realistic things that bite at this stage in this industry.
- Quick wins (2-3) = concrete moves they can make this month.

Return ONLY valid JSON (tight; each string ≤ 22 words):
{
  "summary": "1-2 sentence honest read of where they are + what to do",
  "perm_vs_temp_vs_fractional": { "perm_pct": 0, "temp_pct": 0, "fractional_pct": 0, "why": "1 short sentence" },
  "next_3_hires": [
    { "role": "specific role title", "why": "1 short sentence", "level": "junior|mid|senior", "perm_or_temp": "perm|temp|fractional" },
    { "role": "...", "why": "...", "level": "...", "perm_or_temp": "..." },
    { "role": "...", "why": "...", "level": "...", "perm_or_temp": "..." }
  ],
  "monthly_comp_estimate": { "currency": "USD or local code/symbol", "low": 0, "high": 0, "note": "70% confidence; variance driven by [seniority/sector/equity]" },
  "risks_to_watch": ["short string", "short string"],
  "quick_wins": ["short string", "short string"]
}
Output only the JSON.`

  const extractJson = (content: Array<{ type: string; text?: string }>): Record<string, unknown> | null => {
    const text = content.filter(b => b.type === 'text').map(b => b.text || '').join('\n')
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try { return JSON.parse(match[0]) as Record<string, unknown> } catch { return null }
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }],
    })
    const content = response.content as Array<{ type: string; text?: string }>
    const plan = extractJson(content)
    if (!plan) return NextResponse.json({ error: 'Could not build that plan — try again.' }, { status: 500 })
    return NextResponse.json({ success: true, plan })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[company/hiring-plan] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
