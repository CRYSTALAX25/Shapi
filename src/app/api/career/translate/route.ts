// Career Translator — maps a candidate's current role → a target role with the
// financial reality (salary dip + multi-year forecast), the Pivot-vs-Shield
// track, transferable human skills, and a course roadmap with time estimates.
// Available to any signed-in candidate (the flagship "shape your next move" tool).

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

// GET — current role (to prefill the "From" field) + the last saved translation.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('headline, location, career_translation')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    from_role: (profile?.headline as string) || '',
    country: (profile?.location as string) || '',
    translation: profile?.career_translation ?? null,
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const toRole = typeof body.to_role === 'string' ? body.to_role.trim() : ''
  if (!toRole) return NextResponse.json({ error: 'Tell us the role you want to move into.' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('headline, summary, skills, work_history, location, salary_expectations, languages_spoken, native_language')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const fromRole = (typeof body.from_role === 'string' && body.from_role.trim())
    || (profile.headline as string) || 'their current role'
  const country = (typeof body.country === 'string' && body.country.trim())
    || (profile.location as string) || ''
  const skills = Array.isArray(profile.skills) ? profile.skills : []
  const workHistory = Array.isArray(profile.work_history) ? profile.work_history : []

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are Shapi, a blunt, practical career strategist for the AI era. A worker wants to move from one role to another. Give them the honest financial + skills reality and a concrete plan.

═══ THE PERSON ═══
Current role: ${fromRole}
Target role they're considering: ${toRole}
Country / market: ${country || 'n/a — ask them to set their country for accurate pay'}
Summary: ${(profile.summary as string) || 'n/a'}
Current skills: ${skills.join(', ') || 'n/a'}
Recent work history: ${workHistory.slice(0, 4).map((w: { title?: string; company?: string }) => `${w.title || '?'} @ ${w.company || '?'}`).join('; ') || 'n/a'}

═══ HOW TO THINK ═══
- Classify each role's collar: "white" (office/knowledge), "blue" (skilled trade/physical), or "mixed".
- Decide the TRACK:
  • "pivot" — leaving a high-AI-risk role for a growing/safer one.
  • "shield" — the current role is a resilient trade (plumber, electrician, HVAC, nurse, etc.) and the move is about LEVELLING UP / earning more within it, not escaping. Treat these workers as the AI-proof backbone — do NOT patronise them.
  • "cross-collar" — moving white↔blue. Favour industry-ADJACENT moves that reuse their knowledge (e.g. logistics manager → supply-chain coordinator for a construction firm; master welder → QC manager), never generic restarts.
- AI risk (0-10): current role displacement risk; target role resilience.
- Salary: be realistic and **specific to their country (${country || 'their country'})** — use THAT market's pay norms and **local currency**. Give typical pay ranges for the current role, the target role in Year 1, and the target role in Year 3, as short strings in local currency (e.g. "AED 8,000–12,000/mo", "£28k–34k/yr"). Also express the change as % vs their current pay (negative = a drop). Career changes often dip Year-1 then climb.
- Roadmap: 2-4 concrete upskilling steps. For each, set "platform" to EXACTLY ONE of: Coursera, Udemy, edX, LinkedIn Learning, Udacity, DeepLearning.AI, Pluralsight, YouTube (so the link opens that platform's own site, not a search engine). Give honest hour estimates. Don't invent specific course names — use a clear, real, searchable course/topic title.
- Business: could they eventually run their own business in the TARGET field? One honest line.

Return ONLY valid JSON, tight (every "why"/note ≤ 18 words):
{
  "from_role": "${fromRole}",
  "from_collar": "white|blue|mixed",
  "to_role": "${toRole}",
  "to_collar": "white|blue|mixed",
  "track": "pivot|shield|cross-collar",
  "country": "${country}",
  "currency": "local currency code/symbol, e.g. AED, £, $",
  "current_ai_risk": 0,
  "target_ai_resilience": 0,
  "from_pay_range": "current role typical pay in local currency",
  "to_pay_year1_range": "target role Year-1 pay in local currency",
  "to_pay_year3_range": "target role Year-3 pay in local currency",
  "salary_year1_change_pct": 0,
  "salary_year3_change_pct": 0,
  "salary_note": "1 sentence",
  "transferable_skills": ["3-5 human skills that carry over"],
  "roadmap": [
    { "step": "skill/cert name", "why": "1 short sentence", "course": {"name": "...", "platform": "..."}, "hours": 0, "priority": "high|medium|low" }
  ],
  "total_hours": 0,
  "business": { "viable": true, "note": "1 sentence" },
  "insight": "1-2 sentence honest verdict — should they do it, and why"
}
Be specific and honest. Generic = useless.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Could not map that move — try again.' }, { status: 500 })
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    const translation = { ...parsed, generated_at: new Date().toISOString() }

    const admin = createAdminClient()
    await admin.from('profiles')
      .update({ career_translation: translation, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    return NextResponse.json({ success: true, translation })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[career/translate] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
