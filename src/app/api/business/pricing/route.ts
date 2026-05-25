// Fast pricing suggestion for the business calculator — typical per-job figures
// for a field + country. Haiku (fast/cheap), no web search. Auth optional.

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 20

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const field = typeof body.field === 'string' ? body.field.trim() : ''
  const country = typeof body.country === 'string' ? body.country.trim() : ''
  if (!field) return NextResponse.json({ error: 'Add your trade/field first.' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `Give TYPICAL pricing inputs for a "${field}" business${country ? ` in ${country}` : ''}, so a new owner can sanity-check costs. Use realistic local-currency numbers — NEVER return 0 for labour or materials.

- HANDS-ON / trade / physical business: "labour" and "materials" are the typical PER-JOB costs.
- DIGITAL / software / app / marketplace / online / agency business (no physical materials): use "materials" for the typical MONTHLY TECH-STACK / OPERATING cost — hosting, database, auth, email/SMS, payment processing fees, key SaaS subscriptions — approximated for ~1,000 users/month; and "labour" for the typical monthly team/contractor cost. Always give a realistic non-zero tech figure here (a marketplace always has real infra costs).

Return ONLY JSON: { "currency": "local code/symbol", "labour": 0, "materials": 0, "overhead_pct": 0, "margin_pct": 0, "note": "≤18 words — state whether figures are per-job or per-month, and what 'materials' covers (e.g. 'monthly; materials = tech stack for ~1,000 users')" }
Numbers only in number fields. overhead_pct + margin_pct are percentages (e.g. 20, 30). Always give realistic non-zero labour AND materials.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Could not suggest figures — try again.' }, { status: 500 })
    return NextResponse.json({ success: true, suggestion: JSON.parse(match[0]) })
  } catch (err) {
    console.error('[business/pricing] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Could not suggest figures — try again.' }, { status: 500 })
  }
}
