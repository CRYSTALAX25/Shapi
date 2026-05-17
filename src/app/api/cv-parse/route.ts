import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { matchCandidateToJobs } from '@/lib/matching'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'PDF required' }, { status: 400 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const storagePath = `${user.id}/cv-${Date.now()}.pdf`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('cvs')
    .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    console.error('[cv-parse] Storage error:', uploadError.message)
    return NextResponse.json(
      { error: `Storage error: ${uploadError.message}` },
      { status: 500 }
    )
  }

  // Parse with Claude
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const base64 = Buffer.from(bytes).toString('base64')

  let response
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            {
              type: 'text',
              text: `Extract the candidate's information from this CV and return ONLY a valid JSON object with this exact structure:
{
  "full_name": "string or null",
  "headline": "their current or most recent job title, string or null",
  "location": "city, country if present, string or null",
  "summary": "their profile summary or objective if present, string or null",
  "nationality": "nationality as explicitly stated on CV e.g. 'Croatian', 'British', 'Saudi Arabian'. null if not mentioned.",
  "country_of_origin": "country of birth or origin if mentioned anywhere on the CV. null if not found.",
  "native_language": "infer from nationality only — e.g. Croatian nationality = Croatian, Saudi = Arabic, French = French. If dual nationality or unclear, return the non-English one. null if truly cannot determine.",
  "languages_spoken": [
    {"language": "English", "level": "fluent/native/professional/basic — as stated on CV or inferred"},
    {"language": "Arabic", "level": "native"}
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
  "ai_tier": "user | integrator | builder | null — infer from skills/tools mentioned"
}

IMPORTANT for languages_spoken: include ALL languages mentioned anywhere on the CV. If they list languages on the CV, capture them all with their stated proficiency levels.

Return only the JSON. No explanation, no markdown fences.`,
            },
          ],
        },
      ],
    })
  } catch (err) {
    console.error('[cv-parse] Anthropic error:', err)
    return NextResponse.json({ error: 'AI parsing failed' }, { status: 500 })
  }

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Could not parse CV response' }, { status: 500 })
  }

  // Upsert profile — including nationality and languages extracted from the actual CV document
  const { error: upsertError } = await supabase.from('profiles').upsert({
    id: user.id,
    cv_storage_path: storagePath,
    cv_parsed: true,
    full_name: parsed.full_name || null,
    headline: parsed.headline || null,
    location: parsed.location || null,
    summary: parsed.summary || null,
    work_history: parsed.work_history || [],
    skills: parsed.skills || [],
    ai_tier: parsed.ai_tier || null,
    // Identity & language — sourced from the CV document itself, not guessed
    nationality: parsed.nationality || null,
    country_of_origin: parsed.country_of_origin || null,
    native_language: parsed.native_language || null,
    languages_spoken: parsed.languages_spoken || [],
    completion_pct: 30,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  if (upsertError) {
    console.error('[cv-parse] Profile upsert error:', upsertError.message, '|', upsertError.details, '|', upsertError.hint)
    return NextResponse.json({ error: `Failed to save profile data: ${upsertError.message}` }, { status: 500 })
  }

  console.log('[cv-parse] Profile saved for user:', user.id)

  // Run matching in the background
  matchCandidateToJobs(user.id).catch(err =>
    console.error('[Matching] cv-parse trigger failed:', err)
  )

  return NextResponse.json({ success: true, profile: parsed })
}
