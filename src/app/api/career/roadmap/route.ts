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

// Salvage a truncated JSON string (Claude hit max_tokens mid-array). Strategy:
// walk the string tracking string/bracket state, drop any trailing incomplete
// token, then close all still-open arrays/objects in the right order.
function repairTruncatedJson(s: string): string {
  let inStr = false, esc = false
  const stack: string[] = []
  let lastSafe = -1 // index just after the last complete top-level-ish value
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']')
    else if (c === '}' || c === ']') stack.pop()
    // A comma or closing bracket at depth >=1 marks a clean cut point
    if (!inStr && (c === ',' || c === '}' || c === ']')) lastSafe = i
  }
  // Trim to last safe boundary, drop a trailing comma, then close open brackets
  let out = lastSafe > 0 ? s.slice(0, lastSafe + 1) : s
  out = out.replace(/,\s*$/, '')
  // Recompute open brackets on the trimmed string
  inStr = false; esc = false
  const open: string[] = []
  for (let i = 0; i < out.length; i++) {
    const c = out[i]
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue }
    if (c === '"') inStr = true
    else if (c === '{') open.push('}')
    else if (c === '[') open.push(']')
    else if (c === '}' || c === ']') open.pop()
  }
  while (open.length) out += open.pop()
  return out
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('work_history, headline, summary, skills, matched_industries, ai_tier, location, continuous_learning, cv_tier, cv_kit_purchased, languages_spoken, native_language')
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
  // Languages the candidate actually speaks — never recommend courses/events
  // in a language they don't (e.g. don't push Arabic resources just because
  // they're UAE-based).
  const spokenLangs = Array.isArray(profile.languages_spoken)
    ? (profile.languages_spoken as Array<{ language?: string }>).map(l => l.language).filter(Boolean)
    : []
  const languageList = [...new Set([
    'English',
    ...(profile.native_language ? [profile.native_language as string] : []),
    ...spokenLangs as string[],
  ])].join(', ')

  const prompt = `You are a senior career strategist advising a mid-career professional on how to stay relevant in an AI-disrupted job market. Produce a personalised Career Roadmap.

═══ CANDIDATE PROFILE ═══
Name (for tone, don't name them in output): headline-only
Current/most-recent role: ${profile.headline || 'not provided'}
Summary: ${(profile.summary as string) || 'not provided'}
Location: ${profile.location || 'not provided'}
Current skills: ${skills.join(', ') || 'none listed'}
Industries with real experience: ${matchedIndustries.join(', ') || 'none specified'}
AI tier (current proficiency): ${(profile.ai_tier as string) || 'unknown — possibly User'}
Languages they speak: ${languageList}

⚠️ LANGUAGE RULE: Only recommend courses and events delivered in a language the candidate speaks (${languageList}). NEVER recommend Arabic-language (or any other-language) resources unless that language is in their list — even though they may be based in a region where it's common. Default to English-language courses/events.

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
   IMPORTANT: hands-on skilled trades and care roles (plumber, electrician, HVAC tech, carpenter, welder, mechanic, chef, nurse, paramedic, technician, etc.) are AI-PROOF — they require physical presence + judgement + dexterity. Score these 7-10. Never patronise them or imply they need to "escape" their trade.

1b. TRACK + COLLAR — classify the strategy:
   - track="shield" when ai_resilience_score >= 7 OR the person is clearly in a hands-on resilient trade/care role. Shield = level up, earn more, and protect their position WITHIN the trade. This is the default for resilient roles — do NOT frame them as needing to pivot out.
   - track="pivot" when ai_resilience_score <= 4 (high displacement risk). Pivot = move toward a more durable role.
   - track="cross-collar" when the person is clearly moving white↔blue (e.g. an office worker retraining into a trade, or a tradesperson moving into a management/desk role).
   - collar="blue" for hands-on/physical/trade/site roles; "white" for office/desk/knowledge roles; "mixed" if genuinely both.

1c. VERIFIED HUMAN SKILLS — 3-5 concrete human strengths this person has that AI can't replace (e.g. "on-site fault diagnosis", "calm under pressure", "client trust", "manual dexterity", "judgement in ambiguity"). Specific to their actual work, never generic filler.

1d. SHIELD GROWTH (only meaningful when track="shield") — 2-3 level-up moves to grow earning power WITHIN their trade/field. Each: { title (the move, e.g. "Get gas-safe certified"), why (1 sentence), uplift (concrete payoff, e.g. "+20% pay" or "qualify for supervisor roles") }. For pivot/cross-collar tracks, return an empty array [].

2. SKILLS GAPS — exactly 3 skills they should learn in the next 6-12 months to either:
   (a) make their current career MORE AI-augmented (use AI as a multiplier), OR
   (b) prepare for a pivot if their role is high-risk.
   Each gap: { skill, priority (high|medium|low), why (1 sentence), suggested_courses ([{name, platform, popular, cost, rating, price_band}] — exactly 4 SPECIFIC, well-known courses people actually take for this skill: the 2 best FREE ones AND the 2 best PAID ones) }
   - Pick by real-world POPULARITY + RATING: the courses with the most enrolments / best reviews that people actually take. Give the 2 strongest FREE (or free-to-audit) courses and the 2 strongest PAID courses.
   - name: the REAL course title (e.g. "Google Data Analytics Professional Certificate", "Machine Learning Specialization", "The Complete 2024 Web Development Bootcamp"). Don't invent — be conservative if unsure, but DO name the famous flagship course where you know it.
   - platform: the REAL platform (Coursera, edX, Udacity, Pluralsight, AWS Skill Builder, Google Digital Garage, Udemy, LinkedIn Learning, Stanford Online, DeepLearning.AI).
   - popular: true for the SINGLE most-taken / most-reviewed course across all 4 (the one most people choose); false for the others. Exactly one popular:true per gap.
   - cost: "free" (genuinely free), "free_audit" (free to take, paid only for the certificate — true for most Coursera/edX courses), or "paid".
   - rating: approximate average rating out of 5 (e.g. 4.7) from your knowledge; if you genuinely don't know, use null.
   - price_band: short approximate price for the PAID part (e.g. "~$15", "~$49/mo", "~$59"); for free/free_audit use "Free". These are approximate — the UI tells the user to confirm on the platform.

3. PIVOT PATHS — exactly 2 career pivots they could realistically make. Each path:
   - to_role: target role title
   - to_industry: target industry
   - why (1 sentence: how their current skills transfer + market opportunity)
   - transferable_skills (3 strongest matches from their actual history)
   - gaps_to_close (3 specific skills/credentials to acquire)
   - first_actions (3 concrete first steps — courses, certs, communities, side projects — in priority order)
   Prefer pivots within their target industries (matched_industries) where possible.

4. EVENTS TO ATTEND — exactly 3 conferences/meetups in the next 12 months relevant to their target industries.
   Each: { name, when (month/year if known, "Q3 2025" otherwise), where (city or "online"), why (1 sentence), priority (high|medium|low), official_url }
   Use real, well-known events (Money 20/20, KubeCon, Web Summit, GITEX, MozCon, SaaStr, AHIC, ATD, Cannes Lions, etc.). Prefer their location/region.
   official_url: the event's official website ROOT DOMAIN ONLY (e.g. "https://gitex.com", "https://websummit.com", "https://www.money2020.com"). Root domains are stable across years. If you are not confident of the exact official domain, set official_url to null — do NOT guess a deep URL.

═══ OUTPUT ═══
KEEP IT TIGHT so the JSON is complete and valid: every "why" = 1 short sentence (max 18 words); each first_action max 10 words; each transferable_skill / gap_to_close max 4 words; resilience_reasoning max 2 sentences. Do NOT pad. The full JSON MUST close properly.

Return ONLY valid JSON in this exact shape:
{
  "ai_resilience_score": 0,
  "resilience_reasoning": "1-2 sentences",
  "track": "pivot|shield|cross-collar",
  "collar": "white|blue|mixed",
  "verified_human_skills": ["3-5 AI-proof human strengths"],
  "shield_growth": [
    { "title": "...", "why": "...", "uplift": "e.g. +20% pay" }
  ],
  "skills_gaps": [
    { "skill": "...", "priority": "high|medium|low", "why": "...", "suggested_courses": [{"name": "...", "platform": "...", "popular": true, "cost": "free|free_audit|paid", "rating": 4.7, "price_band": "Free | ~$15 | ~$49/mo"}] }
  ],
  "pivot_paths": [
    { "to_role": "...", "to_industry": "...", "why": "...", "transferable_skills": ["..."], "gaps_to_close": ["..."], "first_actions": ["..."] }
  ],
  "events_to_attend": [
    { "name": "...", "when": "...", "where": "...", "why": "...", "priority": "high|medium|low", "official_url": "https://... or null" }
  ]
}

Be specific and honest. Generic advice = useless advice.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2800,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[career/roadmap] no JSON in response')
      return NextResponse.json({ error: 'Could not parse roadmap' }, { status: 500 })
    }
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(match[0])
    } catch {
      // Repair a truncated response: cut to the last complete object/array element
      // and close any open brackets so we salvage a valid roadmap.
      parsed = JSON.parse(repairTruncatedJson(match[0]))
    }

    // Bulletproof language filter — strip any course/event in a language the
    // candidate doesn't speak (belt-and-suspenders on top of the prompt rule).
    // Detects Arabic script or an explicit "(Arabic)" / "in Arabic" mention.
    const spokenLower = (languageList || 'English').toLowerCase()
    const hasArabicScript = (s: unknown) => typeof s === 'string' && /[؀-ۿ]/.test(s)
    const mentionsUnspokenLang = (s: unknown) => {
      if (typeof s !== 'string') return false
      const m = s.toLowerCase()
      // Flag a language mention only if the candidate doesn't speak it
      for (const lang of ['arabic', 'french', 'spanish', 'german', 'mandarin', 'chinese', 'hindi', 'urdu', 'russian']) {
        if (m.includes(lang) && !spokenLower.includes(lang)) return true
      }
      return false
    }
    const tainted = (s: unknown) => hasArabicScript(s) || mentionsUnspokenLang(s)
    if (Array.isArray(parsed.events_to_attend)) {
      parsed.events_to_attend = (parsed.events_to_attend as Array<Record<string, unknown>>)
        .filter(e => !tainted(e.name) && !tainted(e.why) && !tainted(e.where))
    }
    if (Array.isArray(parsed.skills_gaps)) {
      parsed.skills_gaps = (parsed.skills_gaps as Array<Record<string, unknown>>).map(g => {
        if (Array.isArray(g.suggested_courses)) {
          g.suggested_courses = (g.suggested_courses as Array<Record<string, unknown>>)
            .filter(c => !tainted(c.name) && !tainted(c.platform))
        }
        return g
      })
    }

    // Belt-and-suspenders: derive track from the score if the model omitted/garbled it,
    // so the UI always knows whether to lead with SHIELD or PIVOT framing.
    const score = typeof parsed.ai_resilience_score === 'number' ? parsed.ai_resilience_score : null
    const validTracks = ['pivot', 'shield', 'cross-collar']
    if (!validTracks.includes(parsed.track as string)) {
      parsed.track = score !== null && score >= 7 ? 'shield' : score !== null && score <= 4 ? 'pivot' : 'shield'
    }
    if (!Array.isArray(parsed.verified_human_skills)) parsed.verified_human_skills = []
    if (!Array.isArray(parsed.shield_growth)) parsed.shield_growth = []

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
