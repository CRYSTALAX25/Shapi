// Fast salary-benchmark suggestion for the company calculator — typical
// competitive band for a role + country (+ optional level). Haiku, no web
// search, JSON-only output. Auth optional.

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 20

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const role = typeof body.role === 'string' ? body.role.trim() : ''
  const country = typeof body.country === 'string' ? body.country.trim() : ''
  const level = typeof body.level === 'string' ? body.level.trim() : ''
  if (!role) return NextResponse.json({ error: 'Add the role first.' }, { status: 400 })
  if (!country) return NextResponse.json({ error: 'Add the country first.' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `Give a TYPICAL competitive ANNUAL salary band for a "${role}"${level ? ` (level: ${level})` : ''} in ${country}, so a hiring manager can sanity-check what to offer. Use realistic local-currency numbers — never return 0.

Return ONLY JSON: { "currency": "local code/symbol e.g. AED, SAR, £, $, €", "min": 0, "max": 0, "median": 0, "notes": "≤25 words — state assumptions: full-time, gross annual, excludes equity/bonus/visa where relevant; mention if band varies a lot by company size or sector", "sources": "Indicative range — confirm against your hiring market" }

Numbers only in number fields (no commas, no currency symbol inside the number). "median" should sit between min and max. Always realistic non-zero figures.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Could not build a band — try again.' }, { status: 500 })
    return NextResponse.json({ success: true, benchmark: JSON.parse(match[0]) })
  } catch (err) {
    console.error('[company/salary-benchmark] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Could not build a band — try again.' }, { status: 500 })
  }
}
