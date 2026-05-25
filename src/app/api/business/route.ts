// Business Blueprint — given a field + country (and, if signed in, the user's
// Shapi experience), returns a practical "should I / where / how" plan:
// fit-for-this-business, pros/cons in that country, better-fit countries,
// indicative setup cost across 3 capital tiers, a phased launch plan, contacts
// to make, and the official entities to register with (each with a link).
//
// HONESTY: an LLM has no live fee/cost data — costs are INDICATIVE ranges with a
// "confirm on the official source" note, and entity links prefer a known official
// root domain (else the page falls back to an official-search link). Auth optional.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 45

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const field = typeof body.field === 'string' ? body.field.trim() : ''
  const country = typeof body.country === 'string' ? body.country.trim() : ''
  if (!field) return NextResponse.json({ error: 'Tell us the trade or field.' }, { status: 400 })
  if (!country) return NextResponse.json({ error: 'Add your country for accurate guidance.' }, { status: 400 })

  // Pull the user's experience (if signed in) so the fit read is real.
  let experience = 'not provided (give general guidance)'
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase
        .from('profiles')
        .select('headline, summary, skills, work_history')
        .eq('id', user.id)
        .single()
      if (p) {
        const skills = Array.isArray(p.skills) ? (p.skills as string[]).join(', ') : ''
        const roles = Array.isArray(p.work_history)
          ? (p.work_history as Array<{ title?: string; company?: string }>).slice(0, 5).map(w => `${w.title || '?'} @ ${w.company || '?'}`).join('; ')
          : ''
        experience = `Headline: ${p.headline || 'n/a'}. Summary: ${(p.summary as string) || 'n/a'}. Skills: ${skills || 'n/a'}. Recent roles: ${roles || 'n/a'}.`
      }
    }
  } catch { /* anonymous — general guidance */ }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are Shapi, a blunt, practical business advisor. Someone wants to start their own "${field}" business in ${country}. Use their background to judge fit, and give concrete, country-specific guidance.

THEIR BACKGROUND: ${experience}

Rules:
- Be specific to ${country} — name REAL authorities/bodies. Generic = useless.
- Costs are INDICATIVE only (you have no live data). Give realistic local-currency RANGES and never imply they're exact/current.
- For each entity to register with or use, give the official organisation name and, ONLY IF you are confident, its official website ROOT domain (e.g. "https://www.companieshouse.gov.uk"). If unsure of the exact domain, set "url" to null — do NOT guess a deep link.
- "fit.score" 0-10 = how well THEIR background suits running this business; be honest.

Return ONLY valid JSON (tight; each string ≤ 24 words):
{
  "field": "${field}",
  "country": "${country}",
  "currency": "local currency code/symbol",
  "fit": { "score": 0, "verdict": "1-2 honest sentences on their fit", "strengths": ["from their background"], "gaps": ["what they'd need to add"] },
  "pros": ["3-4 pros of this business in ${country}"],
  "cons": ["3-4 real challenges/cons in ${country}"],
  "better_countries": [ { "country": "...", "why": "1 short reason it may do better" } ],
  "structures": ["common legal structure(s) used in ${country}"],
  "time_estimate": "e.g. 2-6 weeks to be legally operating",
  "capital": {
    "lean": { "range": "local-currency range", "covers": "what this gets you" },
    "standard": { "range": "...", "covers": "..." },
    "comfortable": { "range": "...", "covers": "..." },
    "note": "1 sentence — indicative, confirm locally"
  },
  "launch_plan": [ { "phase": "Phase name", "steps": ["concrete step", "concrete step"] } ],
  "contacts": ["specific types of people/orgs to connect with first"],
  "entities": [ { "name": "official body/resource name", "what": "why you go here", "url": "https://official-root OR null" } ],
  "disclaimer": "Figures are indicative — confirm current costs/rules on the official sources linked above."
}
Keep it practical and ${country}-specific.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2600,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
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
