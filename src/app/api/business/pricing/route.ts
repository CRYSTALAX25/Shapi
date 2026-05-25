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
  const prompt = `Give TYPICAL per-job pricing inputs for a "${field}" business${country ? ` in ${country}` : ''}, so a new owner can sanity-check what to charge. Use realistic local-currency numbers.
Return ONLY JSON: { "currency": "local code/symbol", "labour": 0, "materials": 0, "overhead_pct": 0, "margin_pct": 0, "note": "≤14 words, e.g. 'mid-range residential job'" }
Numbers only (no text in number fields). overhead_pct + margin_pct are percentages (e.g. 20, 30).`

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
