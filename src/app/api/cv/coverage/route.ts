// POST /api/cv/coverage — batch coverage assessment for ALL of a candidate's
// matched industries in ONE Claude call. Populates each industry card's
// thin/medium/rich badge + gaps WITHOUT starting an interview or sending
// WhatsApp. Lets the candidate see where they stand per industry before
// committing to a deep-dive.
//
// Idempotent-ish: only (re)assesses industries that don't already have a
// coverage_level cached, so repeat page loads are free.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { INDUSTRY_FOCUS_SHORT, INDUSTRY_META, type Industry } from '@/lib/industry-briefs'

export const maxDuration = 45

type IndustryChatEntry = {
  status?: string
  coverage_score?: number
  coverage_level?: string
  missing_areas?: string[]
  thin_roles?: string[]
  opening_message?: string
  answers?: string[]
  whatsapp_chat?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, work_history, skills, matched_industries, industry_chats, cv_tier')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.cv_tier !== 'pro') return NextResponse.json({ error: 'Pro tier required' }, { status: 403 })

  const matched = Array.isArray(profile.matched_industries) ? (profile.matched_industries as string[]) : []
  if (matched.length === 0) return NextResponse.json({ ok: true, coverage: {} })

  const existing = (profile.industry_chats as Record<string, IndustryChatEntry>) || {}
  // Only assess industries that don't already have a coverage_level
  const toAssess = matched.filter(ind => !existing[ind]?.coverage_level)
  if (toAssess.length === 0) {
    return NextResponse.json({ ok: true, coverage: existing, assessed: 0 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const workHistory = Array.isArray(profile.work_history) ? profile.work_history : []

  const rubrics = toAssess.map(ind => {
    const label = INDUSTRY_META[ind as Industry]?.label || ind
    return `${ind} (${label}): ${INDUSTRY_FOCUS_SHORT[ind as Industry] || 'quantified impact, scope, named achievements'}`
  }).join('\n')

  const prompt = `Assess how well this candidate's CV already covers each target industry, for a CV deep-dive feature. For EACH industry, score coverage and list the top gaps.

CANDIDATE: ${profile.full_name || 'Candidate'}
HEADLINE: ${profile.headline || 'not provided'}
WORK HISTORY: ${JSON.stringify(workHistory).slice(0, 3500)}
SKILLS: ${JSON.stringify(profile.skills || [])}

TARGET INDUSTRIES (key: what an exceptional CV in each contains):
${rubrics}

For EACH industry key, return:
- coverage_level: "thin" (0-3: barely mentioned / one-liner roles) | "medium" (4-6: some detail, key gaps) | "rich" (7-10: most items covered)
- coverage_score: 0-10
- missing_areas: 2-3 SPECIFIC items from that industry's rubric not yet visible on the CV (short phrases)

Return ONLY valid JSON keyed by the industry key (lowercase), e.g.:
{ "hospitality": { "coverage_level": "medium", "coverage_score": 5, "missing_areas": ["RevPAR/ADR metrics", "pre-opening experience"] }, ... }
Keep it tight so the JSON closes.`

  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Could not parse coverage')
    const parsed = JSON.parse(match[0]) as Record<string, { coverage_level?: string; coverage_score?: number; missing_areas?: string[] }>

    // Merge into industry_chats WITHOUT touching status/answers/opening_message
    const updated: Record<string, IndustryChatEntry> = { ...existing }
    for (const ind of toAssess) {
      const a = parsed[ind] || parsed[ind.toLowerCase()]
      if (!a) continue
      updated[ind] = {
        ...(existing[ind] || {}),
        coverage_level: a.coverage_level || 'medium',
        coverage_score: typeof a.coverage_score === 'number' ? a.coverage_score : 5,
        missing_areas: Array.isArray(a.missing_areas) ? a.missing_areas : [],
        // Mark as assessed-but-not-started so the card shows the badge + Start button
        status: existing[ind]?.status || 'pending',
      }
    }
    await supabase.from('profiles').update({ industry_chats: updated }).eq('id', user.id)

    return NextResponse.json({ ok: true, coverage: updated, assessed: toAssess.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cv/coverage] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
