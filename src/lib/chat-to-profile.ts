// chat-to-profile.ts — extract a structured CV-equivalent from a WhatsApp
// conversation when the candidate didn't upload a CV.
//
// Runs at [DONE] in the webhook when profile.cv_parsed === false.
// Produces the SAME shape as cv-parse output so downstream code (cv/generate,
// matching, references smart-picker, public profile) works identically.
//
// After this runs, the profile is upserted with the extracted fields and
// cv_parsed is flipped to true.

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

type ChatTurn = { role: 'user' | 'assistant'; content: string }

export type ExtractedProfile = {
  full_name: string | null
  headline: string | null
  location: string | null
  summary: string | null
  nationality: string | null
  country_of_origin: string | null
  native_language: string | null
  languages_spoken: Array<{ language: string; level: string }>
  work_history: Array<{
    title?: string
    company?: string
    start?: string
    end?: string
    achievements?: string
  }>
  skills: string[]
  ai_tier: 'user' | 'integrator' | 'builder' | null
  matched_industries: string[]
  skill_quadrant: {
    hands: number
    heart: number
    head: number
    spark: number
    reasoning: string
  } | null
  continuous_learning: {
    certifications: Array<{ name?: string; issuer?: string; year?: string }>
    events: Array<{ name?: string; year?: string; role?: string }>
    talks: Array<{ venue?: string; year?: string; title?: string }>
    oss: Array<{ repo_url?: string; role?: string; stars?: number }>
    courses: Array<{ name?: string; platform?: string; year?: string; completed?: boolean }>
  }
}

export async function extractProfileFromChat(history: ChatTurn[]): Promise<ExtractedProfile | null> {
  if (history.length === 0) return null

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const transcript = history.map((m, i) =>
    `${m.role === 'user' ? 'CANDIDATE' : 'SHAPI'} (${i + 1}): ${m.content}`
  ).join('\n\n')

  const prompt = `You are extracting structured profile data from a WhatsApp conversation. The candidate did NOT upload a CV — everything we know about them comes ONLY from this chat.

TRANSCRIPT (CANDIDATE messages are their answers; SHAPI messages are the interviewer's questions):
${transcript}

Your job: produce a STRUCTURED PROFILE with the same shape a CV parser would return. Extract everything you can from the chat. Where information wasn't provided, return null (or empty array/object). Don't invent.

Return ONLY valid JSON in this exact shape:
{
  "full_name": "from the chat or null",
  "headline": "their current or most-recent job title — pick from chat",
  "location": "city, country if mentioned",
  "summary": "3-4 sentence professional summary synthesised from what they said",
  "nationality": "if mentioned, else null",
  "country_of_origin": "if mentioned, else null",
  "native_language": "infer from nationality + language they wrote in (if non-English). Null if unclear.",
  "languages_spoken": [
    { "language": "English", "level": "fluent/native/professional/basic" }
  ],
  "work_history": [
    {
      "title": "Head of Operations",
      "company": "NEOM",
      "start": "2022",
      "end": "Present",
      "achievements": "what they said about responsibilities + achievements from this role"
    }
  ],
  "skills": ["specific skill 1", "specific skill 2", "..."],
  "ai_tier": "user | integrator | builder | null — infer from how they describe AI tool usage in their answers",
  "matched_industries": ["pick 2-4 from: finance, tech, creative, healthcare, legal, marketing, operations, hospitality, education, sales — only where they have REAL hands-on experience based on the chat"],
  "skill_quadrant": {
    "hands": 0,
    "heart": 0,
    "head": 0,
    "spark": 0,
    "reasoning": "1-2 sentences why these scores"
  },
  "continuous_learning": {
    "certifications": [{"name": "PMP", "issuer": "PMI", "year": "2023"}],
    "events": [],
    "talks": [],
    "oss": [],
    "courses": []
  }
}

CALIBRATION for skill_quadrant (0-10 on each, be honest):
- HANDS = physical/practical work, tools, manual skill
- HEART = interpersonal, leadership, customer-facing
- HEAD = analytical/technical, problem-solving
- SPARK = creative, strategic, innovation
Examples: foreman (Hands 9, Heart 7, Head 4, Spark 3); ML eng (Head 9, Spark 7, Hands 4, Heart 5); hotel GM (Heart 9, Head 6, Hands 6, Spark 5)

For work_history: extract EVERY role they mentioned, even briefly. Most recent first. If they only mentioned 1 role, that's fine — return 1 entry.

For headline: their current/most-recent title. NOT a marketing phrase.

For summary: 3-4 sentences capturing what makes this candidate. Use their actual words/stories where possible.

For certifications/events/talks/oss/courses: extract anything they mentioned. Empty arrays if nothing.

Be conservative. Don't invent. Null/empty when data is missing.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Defensive JSON extraction (Claude may wrap in markdown despite instructions)
    let json: string = text
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i)
    if (fenced) json = fenced[1]
    const first = json.indexOf('{')
    const last = json.lastIndexOf('}')
    if (first === -1 || last === -1) {
      console.error('[chat-to-profile] no JSON in response')
      return null
    }
    const parsed = JSON.parse(json.slice(first, last + 1)) as ExtractedProfile
    return parsed
  } catch (err) {
    console.error('[chat-to-profile] extraction failed:', err)
    return null
  }
}

// Save extracted profile to the database and flip cv_parsed to true.
export async function saveExtractedProfile(candidateId: string, extracted: ExtractedProfile): Promise<void> {
  const admin = createAdminClient()
  await admin.from('profiles').update({
    cv_parsed: true,                      // the chat IS now the CV
    full_name: extracted.full_name,
    headline: extracted.headline,
    location: extracted.location,
    summary: extracted.summary,
    nationality: extracted.nationality,
    country_of_origin: extracted.country_of_origin,
    native_language: extracted.native_language,
    languages_spoken: extracted.languages_spoken,
    work_history: extracted.work_history,
    skills: extracted.skills,
    ai_tier: extracted.ai_tier,
    matched_industries: extracted.matched_industries,
    skill_quadrant: extracted.skill_quadrant
      ? { ...extracted.skill_quadrant, assessed_at: new Date().toISOString(), assessed_from: 'whatsapp_chat' }
      : null,
    continuous_learning: extracted.continuous_learning,
    completion_pct: 50,                   // jump from ~30 to ~50 since chat replaced CV
    updated_at: new Date().toISOString(),
  }).eq('id', candidateId)
}
