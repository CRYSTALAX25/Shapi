// Business Blueprint — given a trade/field + country, returns a concise, practical
// checklist of the country-specific steps to legally start that business:
// licensing, the registration body to use, insurance, and first-client tips.
// Auth optional (a public-facing planning helper).

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const field = typeof body.field === 'string' ? body.field.trim() : ''
  const country = typeof body.country === 'string' ? body.country.trim() : ''

  if (!field) return NextResponse.json({ error: 'Tell us the trade or field.' }, { status: 400 })
  if (!country) return NextResponse.json({ error: 'Add your country for accurate steps.' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are Shapi, a blunt, practical small-business advisor. Someone wants to legally start their own "${field}" business in ${country}. Give them the concrete, country-specific steps — no fluff, no disclaimers.

Cover, specific to ${country}:
- The legal business structure(s) commonly used (e.g. sole establishment, LLC, free-zone licence).
- The exact registration / licensing body or authority to register with, and the licence type needed for "${field}".
- Any trade-specific permits, certifications or qualifications required.
- Mandatory insurance (e.g. liability, workers') and any visa/sponsorship notes if relevant to ${country}.
- 2-3 honest first-clients tips for a "${field}" business in ${country}.

Return ONLY valid JSON, tight and practical (each "detail" ≤ 22 words):
{
  "field": "${field}",
  "country": "${country}",
  "steps": [
    { "title": "short step name", "detail": "what to do, with the specific body/authority name" }
  ],
  "insurance": ["specific insurance / cover needed"],
  "first_clients": ["specific tip", "specific tip"],
  "note": "1 honest sentence about how hard/fast this is in ${country}"
}
Keep the whole thing under 200 words. Be specific to ${country} — name real authorities. Generic = useless.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Could not build that blueprint — try again.' }, { status: 500 })
    const blueprint = JSON.parse(match[0]) as Record<string, unknown>
    return NextResponse.json({ success: true, blueprint })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[business] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
