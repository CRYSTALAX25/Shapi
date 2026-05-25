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

export const maxDuration = 60

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const field = typeof body.field === 'string' ? body.field.trim() : ''
  const country = typeof body.country === 'string' ? body.country.trim() : ''
  if (!field) return NextResponse.json({ error: 'Tell us the trade or field.' }, { status: 400 })
  if (!country) return NextResponse.json({ error: 'Add your country for accurate guidance.' }, { status: 400 })

  // Pull the user's experience + residency/right-to-work (if signed in) so the
  // fit read AND the ownership/visa eligibility are real.
  let experience = 'not provided (give general guidance)'
  let residency = 'not provided — ask them, and assume a non-resident foreigner unless told otherwise'
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase
        .from('profiles')
        .select('headline, summary, skills, work_history, right_to_work, location, native_language')
        .eq('id', user.id)
        .single()
      if (p) {
        const skills = Array.isArray(p.skills) ? (p.skills as string[]).join(', ') : ''
        const roles = Array.isArray(p.work_history)
          ? (p.work_history as Array<{ title?: string; company?: string }>).slice(0, 5).map(w => `${w.title || '?'} @ ${w.company || '?'}`).join('; ')
          : ''
        experience = `Headline: ${p.headline || 'n/a'}. Summary: ${(p.summary as string) || 'n/a'}. Skills: ${skills || 'n/a'}. Recent roles: ${roles || 'n/a'}.`
        const basisLabel: Record<string, string> = { citizen: 'citizen', permanent_resident: 'permanent resident (PR)', work_visa: 'work visa', eu_citizen: 'EU/EEA citizen', need_sponsorship: 'needs sponsorship' }
        const rtw = Array.isArray(p.right_to_work)
          ? (p.right_to_work as Array<{ region?: string; basis?: string }>).filter(r => r.region).map(r => `${r.region} (${basisLabel[r.basis || ''] || r.basis || 'status unknown'})`)
          : []
        if (rtw.length) residency = rtw.join('; ')
        else if (p.location) residency = `based in ${p.location} (exact residency status unknown)`
      }
    }
  } catch { /* anonymous — general guidance */ }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are Shapi, a blunt, practical business advisor. Someone wants to start their own "${field}" business in ${country}. Use their background to judge fit, and give concrete, country-specific guidance.

THEIR BACKGROUND: ${experience}
THEIR RESIDENCY / RIGHT-TO-WORK: ${residency}

Rules:
- USE WEB SEARCH to find CURRENT, real figures: the actual setup/licence/registration fees and starting-capital ranges for a "${field}" business in ${country} right now, and the official government/registration body plus its REAL website URL. Base costs and links on what you find — do not guess.
- Be specific to ${country} — name REAL authorities/bodies you found. Generic = useless.
- For each entity, give the official organisation name and its real official URL from your search (root or the specific registration page). If you genuinely couldn't find a URL, set "url" to null.
- OWNERSHIP & VISA (critical): based on THEIR residency status above, determine whether they can own this "${field}" business as a SOLE / 100% owner in ${country}, or whether they need a local partner/sponsor, a specific visa/residency/permit, or must use a free zone (100% foreign ownership) vs mainland (which may require a local partner or service agent). Use web search for ${country}'s current foreign-ownership rules. Be specific to their exact status (citizen vs PR vs work-visa vs non-resident) — e.g. a PR may have different rights than a citizen or a tourist.
- "fit.score" 0-10 = how well THEIR background suits running this business; be honest.
- DECISION SUPPORT (this must be enough to decide go/no-go): give an honest market-DEMAND + competition read, a rough BREAK-EVEN (how many jobs/clients per month, or what monthly revenue, to cover costs), and a clear VERDICT (go / caution / not-now) with why.
- AUTOMATION (Shapi's whole point): since they're costing labour, name which tasks in a "${field}" business can be AUTOMATED or sped up with AI/software/tools to cut labour cost or let them scale without hiring.

Return ONLY valid JSON (tight; each string ≤ 24 words):
{
  "field": "${field}",
  "country": "${country}",
  "currency": "local currency code/symbol",
  "verdict": { "recommendation": "go|caution|not-now", "why": "1-2 honest sentences — should THEY open this, here, now" },
  "demand": { "level": "high|medium|low", "summary": "market demand + competition in ${country}, 1-2 sentences" },
  "breakeven": "rough jobs/clients per month (or monthly revenue) to break even",
  "automation": { "tasks": ["2-4 tasks AI/software/tools can do or speed up for a ${field} business"], "note": "1 sentence — how it cuts labour cost or lets you scale" },
  "fit": { "score": 0, "verdict": "1-2 honest sentences on their fit", "strengths": ["from their background"], "gaps": ["what they'd need to add"] },
  "ownership": {
    "can_sole_own": "yes|no|conditional",
    "summary": "1-2 sentences SPECIFIC to their residency status (e.g. 'As a Saudi PR you can…')",
    "visa_or_permit": "the visa/residency/permit needed to set up & operate (or 'your current residency already allows this')",
    "partner_or_sponsor": "local partner / sponsor / service agent needed? give specifics, or 'not required'",
    "route": "best ownership route, e.g. 'free zone — 100% foreign ownership' or 'mainland LLC with a local partner'"
  },
  "pros": ["3-4 pros of this business in ${country}"],
  "cons": ["3-4 real challenges/cons in ${country}"],
  "better_countries": [ { "country": "...", "why": "1 short reason it may do better" } ],
  "structures": ["common legal structure(s) used in ${country}"],
  "time_estimate": "e.g. 2-6 weeks to be legally operating",
  "pricing_suggestion": { "labour": 0, "materials": 0, "overhead_pct": 0, "margin_pct": 0, "note": "typical figures (numbers only, local currency). NEVER 0. For a hands-on business these are per-job; for a DIGITAL/software/marketplace/online/agency business 'materials' = the MONTHLY tech-stack/operating cost (hosting, DB, auth, email/SMS, payment fees, SaaS) for ~1,000 users and 'labour' = monthly team cost — say which in the note" },
  "capital": {
    "lean": { "range": "local-currency range", "covers": "what this gets you" },
    "standard": { "range": "...", "covers": "..." },
    "comfortable": { "range": "...", "covers": "..." },
    "note": "1 sentence — indicative, confirm locally"
  },
  "launch_plan": [ { "phase": "Phase name", "steps": ["concrete step", "concrete step"] } ],
  "contacts": ["specific types of people/orgs to connect with first"],
  "entities": [ { "name": "official body/resource name", "what": "why you go here", "url": "https://official-root OR null" } ],
  "disclaimer": "Based on current sources found via web search — fees/rules can still change, so confirm on the official links above."
}
Keep it practical and ${country}-specific. After searching, output the JSON as your final message.`

  // Join all text blocks (with web search there are tool/result blocks too).
  const extractJson = (content: Array<{ type: string; text?: string }>): Record<string, unknown> | null => {
    const text = content.filter(b => b.type === 'text').map(b => b.text || '').join('\n')
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try { return JSON.parse(match[0]) as Record<string, unknown> } catch { return null }
  }

  // Live web-search is opt-in (it's slow and can exceed serverless time limits).
  // Default = fast model-knowledge pass (returns in seconds, framed as indicative).
  const live = body.live === true

  try {
    let content: Array<{ type: string; text?: string }>
    if (live) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 } as unknown as Anthropic.Tool],
          messages: [{ role: 'user', content: prompt }],
        })
        content = response.content as Array<{ type: string; text?: string }>
      } catch (searchErr) {
        console.warn('[business] web search failed, falling back:', searchErr instanceof Error ? searchErr.message : searchErr)
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6', max_tokens: 2800,
          messages: [{ role: 'user', content: prompt + '\n\n(No web search — give your best indicative figures and say so in the disclaimer.)' }],
        })
        content = response.content as Array<{ type: string; text?: string }>
      }
    } else {
      // Fast path — no web search, indicative figures.
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 2800,
        messages: [{ role: 'user', content: prompt + '\n\n(Give your best indicative figures from knowledge — do NOT use web search. Keep the disclaimer honest that figures are indicative; the user can tap "live figures" to research current ones.)' }],
      })
      content = response.content as Array<{ type: string; text?: string }>
    }

    const blueprint = extractJson(content)
    if (!blueprint) return NextResponse.json({ error: 'Could not build that blueprint — try again.' }, { status: 500 })
    return NextResponse.json({ success: true, blueprint })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[business] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
