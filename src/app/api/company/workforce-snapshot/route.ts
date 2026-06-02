// Tier A Workforce Snapshot — the launch wedge (STRATEGY §16).
//
// One-shot Sonnet call produces the headline Workforce Future Readiness Score
// (0-100) + the full snapshot report. Inputs are L1 only (no PII / no exact
// salaries) so a CEO can run it on the spot with zero confidential data.
// Logs every audit to company_workforce_audits for follow-up (Tier B upsell)
// and aggregate benchmarking.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

// Sonnet 4.6 with max_tokens=2600 can take 30–55s end-to-end. The previous
// 60s cap was tripping the connection-drop bug Ana hit in testing. Vercel
// clamps to the plan's max (Hobby 60, Pro 300) so requesting 300 here is
// safe and gives us the headroom we need without dropping mid-generation.
export const maxDuration = 300

type RoleInput = { role?: string; dept?: string; count?: number }

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const industry: string = typeof body.industry === 'string' ? body.industry.trim() : ''
  const size: string = typeof body.size === 'string' ? body.size.trim() : ''
  const country: string = typeof body.country === 'string' ? body.country.trim() : ''
  const ai_maturity: string = typeof body.ai_maturity === 'string' ? body.ai_maturity.trim() : ''
  const operating_model: string = typeof body.operating_model === 'string' ? body.operating_model.trim() : ''
  const roles: RoleInput[] = Array.isArray(body.roles) ? body.roles : []
  const use_cases: string[] = Array.isArray(body.use_cases) ? body.use_cases.filter((u: unknown) => typeof u === 'string' && u.trim()) : []

  if (!industry || !size) {
    return NextResponse.json({ error: 'industry and size are required' }, { status: 400 })
  }

  // Optional auth — signed-in companies get the audit attached to their account.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const rolesSummary = roles.length
    ? roles.slice(0, 50).map(r => `- ${r.role || 'role'}${r.dept ? ` (${r.dept})` : ''}: count ${r.count || 1}`).join('\n')
    : 'not provided — give general guidance for this industry + size'
  const useCasesSummary = use_cases.length
    ? use_cases.slice(0, 3).map((u, i) => `${i + 1}. ${u}`).join('\n')
    : 'not provided — assume the common 2-3 use cases for this industry'

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are Shapi's Workforce Intelligence engine. Produce a one-shot Workforce Snapshot for a company.

INPUTS:
- Industry: ${industry}
- Size: ${size}
- Country: ${country || 'not specified'}
- AI maturity: ${ai_maturity || 'not specified'} (one of: experimenting, piloting, scaling, mature)
- Operating model: ${operating_model || 'not specified'} (one of: centralised, decentralised, agile-pod, skills-marketplace, hybrid-ai, outcome-based, hybrid)
- Roles roster (anonymised — counts only):
${rolesSummary}
- AI use cases under consideration:
${useCasesSummary}

PRODUCE: a Workforce Future Readiness Score (0-100) + the full report. The score = weighted composite of:
1. AI exposure inverted (% org NOT high-risk under AI displacement)
2. Skills maturity (likely % of future skills present given industry + AI maturity)
3. Leadership adaptability (estimate from AI maturity stage + operating model)
4. Innovation density (estimate from industry + operating model)
5. Workforce resilience (estimate from operating model + maturity)
6. Organisational adaptability (estimate from operating model + AI maturity)
Each sub-score 0-100. Composite = weighted average (you choose sensible weights).

USE THE 6-DIMENSION AI EXPOSURE INDEX for at-risk role scoring: repetitiveness, rules-based work, admin intensity, data processing dependency, creativity requirement (inverted), human interaction dependency (inverted).

USE THE 5-WAY PER-ROLE RECOMMENDATION: replace | augment | reskill | redeploy | protect (the last one = high-value people likely to leave during change; we want to retain them).

Ground cost projections in: Mercer salary ranges for ${country || 'the country'}, Anthropic/OpenAI published API pricing, AWS/GCP/Azure published cloud rates, and the industry's typical AI integration burden. Use confidence bands ("70% confidence: $X-Y") and name the variance drivers. Sandbag honestly — industry data says ~50-70% of enterprise AI pilots fail to scale; bake that into ROI gate signals.

VOICE: Speak with sourced confidence. NEVER use the words "indicative", "approximate" (as a hedge), or "rough" — when uncertain, use a confidence band (e.g. "70% confidence: $200-450k") and name the variance drivers. Numeric prefixes like "~$15" are fine. Do NOT tell the user to "confirm separately" or "confirm on the platform". List sources at the bottom of every numeric output.

Return ONLY valid JSON in this exact shape (NO markdown, NO commentary outside the JSON):
{
  "readiness_score": 47,
  "verdict": "high-risk|needs-attention|on-track",
  "headline": "1 short honest sentence summarising where they stand",
  "sub_scores": {
    "ai_exposure_inverse": 0,
    "skills_maturity": 0,
    "leadership_adaptability": 0,
    "innovation_density": 0,
    "workforce_resilience": 0,
    "organisational_adaptability": 0
  },
  "ai_risk_heatmap": {
    "high_risk_count": 0,
    "medium_risk_count": 0,
    "low_risk_count": 0,
    "high_risk_summary": "1 line — which functions/roles drive the high-risk count"
  },
  "top_at_risk_roles": [
    { "role": "", "why": "1 honest sentence", "recommendation": "replace|augment|reskill|redeploy|protect" }
  ],
  "ai_integration_estimates": [
    {
      "use_case": "",
      "build_buy_partner": "build|buy|partner",
      "why": "1 sentence — why this option for this use case",
      "cost_range_year_1": "Year-1 cost band with confidence, e.g. '70% confidence: $80k-$220k (variance driven by integration depth)'",
      "talent_gap": "1-2 sentences — what roles you'd hire / reskill",
      "timeline_months": "delivery range, e.g. '4-9 months'",
      "roi_gate": "1 line — early signal to watch before scaling"
    }
  ],
  "quick_wins": ["3 concrete actions to take in the next 30 days"],
  "raise_score_to": {
    "target_in_12_months": 0,
    "biggest_levers": ["1-3 short levers"]
  },
  "honest_caveats": "1-2 sentences on the variance drivers behind these numbers and what Tier B (the 5-year plan) would add. Do NOT use the words 'indicative' or 'approximate'."
}

top_at_risk_roles = 3-5 items. ai_integration_estimates = 1-3 items (matching the use cases given, or common ones if not provided).`

  // Try Sonnet first (sharper analysis), fall back to Haiku 4.5 if Sonnet is
  // overloaded (HTTP 529 — Anthropic's "we're at capacity" signal). The
  // honest-confidence prompt + JSON-shape contract work well on Haiku too;
  // a slightly less nuanced report is far better than a broken one.
  async function callClaude(model: string) {
    return anthropic.messages.create({
      model,
      max_tokens: 2600,
      messages: [{ role: 'user', content: prompt }],
    })
  }

  function isOverloaded(err: unknown): boolean {
    const m = err instanceof Error ? err.message : String(err)
    return /529|overloaded|overload_error|capacity/i.test(m)
  }

  try {
    let response: Awaited<ReturnType<typeof callClaude>>
    try {
      response = await callClaude('claude-sonnet-4-6')
    } catch (sonnetErr) {
      if (!isOverloaded(sonnetErr)) throw sonnetErr
      console.warn('[workforce-snapshot] Sonnet overloaded, falling back to Haiku 4.5')
      response = await callClaude('claude-haiku-4-5-20251001')
    }
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[workforce-snapshot] no JSON in response')
      return NextResponse.json({ error: 'Could not parse the snapshot — try again.' }, { status: 500 })
    }

    let report: Record<string, unknown>
    try {
      report = JSON.parse(match[0])
    } catch (e) {
      console.error('[workforce-snapshot] JSON parse failed:', e)
      return NextResponse.json({ error: 'Could not parse the snapshot — try again.' }, { status: 500 })
    }

    // Log the audit (admin client bypasses RLS; works for anonymous prospects too).
    try {
      const admin = createAdminClient()
      await admin.from('company_workforce_audits').insert({
        company_id: user?.id || null,
        industry,
        company_size: size,
        country: country || null,
        ai_maturity: ai_maturity || null,
        operating_model: operating_model || null,
        roles_input: roles.length ? roles : null,
        use_cases: use_cases.length ? use_cases : null,
        readiness_score: typeof report.readiness_score === 'number' ? report.readiness_score : null,
        report,
        source: 'web',
      })
    } catch (e) {
      // Log-on-failure pattern — don't block the user response if the audit
      // table isn't migrated yet.
      console.warn('[workforce-snapshot] audit log skipped:', e)
    }

    return NextResponse.json({ success: true, report })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[workforce-snapshot] error:', msg)
    // Friendlier copy for the common-and-recoverable cases. Raw Anthropic
    // JSON in the UI was scaring testers.
    if (/529|overloaded|overload_error|capacity/i.test(msg)) {
      return NextResponse.json(
        { error: "Our analysis engine is at capacity right now — try again in 30–60 seconds." },
        { status: 503 },
      )
    }
    if (/rate.?limit|429/i.test(msg)) {
      return NextResponse.json(
        { error: "Hit a rate limit — wait a minute and try again." },
        { status: 429 },
      )
    }
    return NextResponse.json({ error: 'Snapshot engine hit a snag — try again.' }, { status: 500 })
  }
}
