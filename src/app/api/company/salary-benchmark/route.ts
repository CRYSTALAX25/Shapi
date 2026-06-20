// Fast salary-benchmark suggestion for the company calculator — typical
// competitive band for a role + country (+ optional level). Haiku, no web
// search, JSON-only output. Auth optional.

import { NextResponse } from 'next/server'
import { getAnthropic } from '@/lib/anthropic'

export const maxDuration = 20

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const role = typeof body.role === 'string' ? body.role.trim() : ''
  const country = typeof body.country === 'string' ? body.country.trim() : ''
  const level = typeof body.level === 'string' ? body.level.trim() : ''
  if (!role) return NextResponse.json({ error: 'Add the role first.' }, { status: 400 })
  if (!country) return NextResponse.json({ error: 'Add the country first.' }, { status: 400 })

  const anthropic = getAnthropic()
  const prompt = `Give a competitive ANNUAL salary band for a "${role}"${level ? ` (level: ${level})` : ''} in ${country}, so a hiring manager can decide what to offer.

VOICE — STRICT: Speak with sourced confidence. NEVER use the words "indicative", "approximate" (as a hedge), or "rough". Do NOT tell the user to "confirm separately" or "confirm against their hiring market". Frame numbers as a 70%-confidence band synthesised from Mercer / PayScale / Numbeo cost-of-living / Glassdoor / government labour statistics. Numeric prefixes like "~$15" are fine; the words are not.

ALWAYS return BOTH a regional band (in local currency for ${country}) AND a GLOBAL MEDIAN (in USD, anchored to the US/UK/Western Europe equivalent role). Then state the regional-vs-global gap in ONE explicit sentence with one reasoning clause — e.g. "MENA pays ~30% less than US for equivalent roles due to lower cost-of-living and tax-free comp" or "London pays ~15% less than US due to FX and benefits weight". Always name the gap as a percentage and one driver.

Return ONLY JSON: { "currency": "local code/symbol for ${country} e.g. AED, SAR, £, $, €", "min": 0, "max": 0, "median": 0, "global_median": 0, "regional_vs_global_note": "1 sentence — name the % gap and one driver (cost of living, tax, FX, talent density)", "notes": "≤25 words — full-time, gross annual, excludes equity/bonus/visa; name the biggest variance driver (company size, sector, equity)", "sources": "Synthesised from Mercer · PayScale · Numbeo · Glassdoor public ratings · government labour statistics" }

Numbers only in number fields (no commas, no currency symbol inside the number). "median" sits between min and max in local currency. "global_median" is always in USD. Always non-zero, sourced figures.`

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
