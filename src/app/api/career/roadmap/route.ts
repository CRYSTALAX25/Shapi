// Career Roadmap generator — Pro-tier-gated personalised upskill + pivot plan.
//
// Inputs (read from candidate profile):
//   - work_history, headline, skills, matched_industries, ai_tier
//   - continuous_learning (what they've already done)
//   - location (where they could attend events)
//
// Output (saved to profiles.career_recommendations + profiles.ai_resilience_score):
//   - ai_resilience_score: 0-10 for their current role
//   - resilience_reasoning: 1-2 sentence explanation
//   - skills_gaps: skills they should learn (priority + why + suggested courses)
//   - pivot_paths: career pivots they could consider, with transferable skills,
//     gaps, and concrete first actions
//   - events_to_attend: relevant conferences/meetups in the next 12 months

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('work_history, headline, summary, skills, matched_industries, ai_tier, location, continuous_learning, cv_tier, cv_kit_purchased')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Pro-gated — Roadmap is part of the Pro tier
  const isPro = profile.cv_tier === 'pro'
  if (!isPro) {
    return NextResponse.json({
      error: 'Career Roadmap is a Pro feature. Upgrade to unlock personalised AI-resilience analysis + pivot recommendations.',
      requires: 'pro',
    }, { status: 403 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const workHistory = Array.isArray(profile.work_history) ? profile.work_history : []
  const skills = Array.isArray(profile.skills) ? profile.skills : []
  const matchedIndustries = Array.isArray(profile.matched_industries) ? profile.matched_industries : []
  const continuousLearning = profile.continuous_learning as Record<string, unknown> | null

  const prompt = `You are a senior career strategist advising a mid-career professional on how to stay relevant in an AI-disrupted job market. Produce a personalised Career Roadmap.

═══ CANDIDATE PROFILE ═══
Name (for tone, don't name them in output): headline-only
Current/most-recent role: ${profile.headline || 'not provided'}
Summary: ${(profile.summary as string) || 'not provided'}
Location: ${profile.location || 'not provided'}
Current skills: ${skills.join(', ') || 'none listed'}
Industries with real experience: ${matchedIndustries.join(', ') || 'none specified'}
AI tier (current proficiency): ${(profile.ai_tier as string) || 'unknown — possibly User'}

Work history (most recent first):
${workHistory.map((w: { title?: string; company?: string; start?: string; end?: string; achievements?: string }, i: number) =>
  `${i + 1}. ${w.title || '?'} at ${w.company || '?'} (${w.start || '?'} – ${w.end || 'present'})${w.achievements ? '\n   ' + w.achievements.slice(0, 200) : ''}`
).join('\n')}

What they've already done (continuous learning):
- Certifications: ${JSON.stringify(continuousLearning?.certifications || [])}
- Events attended: ${JSON.stringify(continuousLearning?.events || [])}
- Talks given: ${JSON.stringify(continuousLearning?.talks || [])}
- OSS contributions: ${JSON.stringify(continuousLearning?.oss || [])}
- Courses completed: ${JSON.stringify(continuousLearning?.courses || [])}

═══ YOUR ANALYSIS ═══

1. AI RESILIENCE SCORE (0-10) for their current/most-recent role:
   - 0-3 = high displacement risk (data entry, basic copywriting, routine analysis, transactional sales)
   - 4-6 = medium (some tasks automatable; role still needs human judgement + relationships)
   - 7-10 = low risk (deep expertise + judgement + interpersonal + physical or creative synthesis)
   Be honest and specific to THIS role, not generic. Don't comfort.

2. SKILLS GAPS — 3 to 5 skills they should learn in the next 6-12 months to either:
   (a) make their current career MORE AI-augmented (use AI as a multiplier), OR
   (b) prepare for a pivot if their role is high-risk.
   Each gap: { skill, priority (high|medium|low), why (1 sentence), suggested_courses ([{name, platform}]) }
   Courses must be REAL platforms (Coursera, edX, Udacity, Pluralsight, AWS Skill Builder, Google Digital Garage, LinkedIn Learning, Stripe Atlas Guides, Stanford Online, DeepLearning.AI). Don't invent course names — be conservative if unsure.

3. PIVOT PATHS — 2 to 3 career pivots they could realistically make. Each path:
   - to_role: target role title
   - to_industry: target industry
   - why (1-2 sentences: how their current skills transfer + market opportunity)
   - transferable_skills (3-5 strongest matches from their actual history)
   - gaps_to_close (3-5 specific skills/credentials to acquire)
   - first_actions (3 concrete first steps — books, courses, certs, communities, side projects — in priority order)
   Prefer pivots within their target industries (matched_industries) where possible. Include ONE adjacent industry pivot too if it makes sense.

4. EVENTS TO ATTEND — 3 to 5 conferences/meetups in the next 12 months relevant to their target industries.
   Each: { name, when (month/year if known, "Q3 2025" otherwise), where (city or "online"), why (1 sentence: who's there + why this candidate should go), priority (high|medium|low) }
   Use real, well-known events (Money 20/20, KubeCon, Web Summit, GITEX, MozCon, SaaStr, AHIC, ATD, Cannes Lions, etc.). Prefer their location/region.

═══ OUTPUT ═══
Return ONLY valid JSON in this exact shape:
{
  "ai_resilience_score": 0,
  "resilience_reasoning": "1-2 sentences",
  "skills_gaps": [
    { "skill": "...", "priority": "high|medium|low", "why": "...", "suggested_courses": [{"name": "...", "platform": "..."}] }
  ],
  "pivot_paths": [
    { "to_role": "...", "to_industry": "...", "why": "...", "transferable_skills": ["..."], "gaps_to_close": ["..."], "first_actions": ["..."] }
  ],
  "events_to_attend": [
    { "name": "...", "when": "...", "where": "...", "why": "...", "priority": "high|medium|low" }
  ]
}

Be specific and honest. Generic advice = useless advice.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[career/roadmap] no JSON in response')
      return NextResponse.json({ error: 'Could not parse roadmap' }, { status: 500 })
    }
    const parsed = JSON.parse(match[0])
    const roadmap = { ...parsed, generated_at: new Date().toISOString() }

    // Persist via admin client (bypasses RLS on the score column)
    const admin = createAdminClient()
    await admin.from('profiles').update({
      ai_resilience_score: typeof parsed.ai_resilience_score === 'number' ? parsed.ai_resilience_score : null,
      career_recommendations: roadmap,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)

    return NextResponse.json({ success: true, roadmap })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[career/roadmap] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
