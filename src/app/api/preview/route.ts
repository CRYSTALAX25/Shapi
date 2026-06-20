// Free top-of-funnel "Profile Preview" parser.
//
// This is the SOFT, no-login entry point that sits ABOVE /upload-cv.
// A logged-out visitor uploads a PDF CV → we run the SAME Claude extraction
// contract that the authed /api/cv-parse flow uses (see EXTRACTION_PROMPT below,
// kept identical so the preview matches what the real profile will look like),
// but we DO NOT persist anything: no Supabase Storage upload, no profiles upsert.
//
// The endpoint returns the parsed profile JSON straight back to the client so it
// can render a polished-but-blurred preview. Nothing sensitive is stored.
//
// Reuse note: the extraction prompt + model + JSON-repair logic mirror
// /api/cv-parse exactly. The only differences are (1) no auth requirement and
// (2) no writes — this is intentionally a read-only, stateless preview so the
// hook works for anonymous visitors.

import Anthropic from '@anthropic-ai/sdk'
import { getAnthropic } from '@/lib/anthropic'
import { NextResponse } from 'next/server'

export const maxDuration = 60

// Identical extraction contract to /api/cv-parse — keep in sync so the free
// preview is a faithful render of the real parsed profile.
const EXTRACTION_PROMPT = `Extract the candidate's information from this CV and return ONLY a valid JSON object with this exact structure:
{
  "full_name": "string or null",
  "headline": "their current or most recent job title, string or null",
  "location": "city, country if present, string or null",
  "summary": "their profile summary or objective if present, string or null",
  "nationality": "ONLY use what's EXPLICITLY written on the CV. If not explicitly stated, return null.",
  "languages_spoken": [
    {"language": "English", "level": "fluent/native/professional/basic — as stated on CV or inferred"}
  ],
  "work_history": [
    {
      "title": "job title",
      "company": "company name",
      "start": "start date as written",
      "end": "end date or Present",
      "achievements": "bullet points or description of responsibilities and achievements"
    }
  ],
  "skills": ["skill1", "skill2"],
  "ai_tier": "user | integrator | builder | null — infer from skills/tools mentioned",
  "matched_industries": ["hospitality", "operations"],
  "skill_quadrant": {
    "hands": 0,
    "heart": 0,
    "head": 0,
    "spark": 0,
    "reasoning": "1-2 sentence summary of why these scores"
  }
}

For matched_industries: identify the 2-4 industries this candidate has REAL experience in based on their work history. Only pick from: finance, tech, creative, healthcare, legal, marketing, operations, hospitality, education, sales. Max 4.

For skill_quadrant: score this candidate 0-10 on each of 4 working-style axes — be honest and discriminating, not generous.
  - HANDS (0-10): physical/practical work — tools, equipment, on-site operations.
  - HEART (0-10): interpersonal — leadership, customer-facing, care, stakeholder management.
  - HEAD (0-10): analytical/technical — data, systems thinking, technical depth.
  - SPARK (0-10): creative synthesis — strategy, design, innovation.
  Provide a 1-2 sentence reasoning.

For ai_tier infer one of: "user" (uses AI tools casually), "integrator" (wires AI into workflows), "builder" (builds AI systems), or null.

IMPORTANT for summary: if the CV has no written summary, WRITE a strong 2-3 sentence professional summary yourself based on their work history — make it polished and specific. This is what the candidate will see as their "after".

Return only the JSON. No explanation, no markdown fences.`

export async function POST(request: Request) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 })
  }

  const file = formData.get('file') as File | null

  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'PDF required' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  const anthropic = getAnthropic()

  let response
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    })
  } catch (err) {
    console.error('[preview] Anthropic error:', err)
    return NextResponse.json({ error: 'AI parsing failed — try again' }, { status: 500 })
  }

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'

  // Same defensive JSON extraction as /api/cv-parse.
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      const first = cleaned.indexOf('{')
      const last = cleaned.lastIndexOf('}')
      if (first !== -1 && last !== -1 && last > first) {
        try {
          parsed = JSON.parse(cleaned.slice(first, last + 1))
        } catch {
          return NextResponse.json({ error: 'Could not read your CV — try another file' }, { status: 500 })
        }
      } else {
        return NextResponse.json({ error: 'Could not read your CV — try another file' }, { status: 500 })
      }
    }
  }

  // Stateless: return the parse straight back. Nothing is persisted.
  return NextResponse.json({ profile: parsed })
}
