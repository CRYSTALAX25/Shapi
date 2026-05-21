// "What you're worth" — salary benchmark estimator. Public (lead magnet).
// v1: AI/market estimate, clearly labelled. The moat (real verified placement
// comp) layers on later. Pivot-aware: estimates a separate lower band for a
// field the candidate is moving INTO with transferable-but-limited experience.

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const role = String(body.role || '').trim()
  const experience = String(body.experience || '').trim()
  const location = String(body.location || '').trim() || 'UAE'
  const currency = String(body.currency || 'AED').trim()
  const pivotField = String(body.pivotField || '').trim()

  if (!role) return NextResponse.json({ error: 'Please enter a role.' }, { status: 400 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Estimator unavailable.' }, { status: 500 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are a compensation analyst for the ${location} job market. Estimate a realistic MONTHLY total-package salary band (base + typical allowances such as housing/transport, tax-free where applicable) in ${currency}.

ROLE: ${role}
EXPERIENCE: ${experience || 'unspecified'}
LOCATION: ${location}
${pivotField ? `ALSO estimate a SEPARATE, LOWER "pivot" band for someone moving INTO "${pivotField}" — they bring transferable skills from the role above but have limited direct ${pivotField} experience, so price them at an entry/early band for ${pivotField}.` : ''}

Use realistic ${location} market figures. Return ONLY valid JSON, no prose:
{"currency":"${currency}","period":"month","primary":{"min":<integer>,"max":<integer>},${pivotField ? `"pivot":{"field":"${pivotField}","min":<integer>,"max":<integer>},` : ''}"rationale":"one or two plain-language sentences explaining the range"}`

  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = resp.content[0].type === 'text' ? resp.content[0].text : ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return NextResponse.json({ error: 'Could not estimate right now.' }, { status: 502 })
    const parsed = JSON.parse(m[0])
    return NextResponse.json({ estimate: parsed })
  } catch (err) {
    console.error('[salary-benchmark] failed:', err)
    return NextResponse.json({ error: 'Could not estimate right now.' }, { status: 502 })
  }
}
