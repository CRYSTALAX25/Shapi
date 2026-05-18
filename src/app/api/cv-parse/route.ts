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
  "ai_tier": "user | integrator | builder | null — infer from skills/tools mentioned",
  "matched_industries": ["hospitality", "operations"],
  "skill_quadrant": {
    "hands": 0,
    "heart": 0,
    "head": 0,
    "spark": 0,
    "reasoning": "1-2 sentence summary of why these scores"
  },
  "continuous_learning": {
    "certifications": [{"name": "PMP", "issuer": "PMI", "year": "2023"}],
    "events": [{"name": "Money 20/20", "year": "2024", "role": "attendee"}],
    "talks": [{"venue": "Conference name", "year": "2023", "title": "Talk title"}],
    "oss": [{"repo_url": "github.com/...", "role": "contributor"}],
    "courses": [{"name": "AWS Solutions Architect", "platform": "Coursera", "year": "2024", "completed": true}]
  }
}

For matched_industries: identify the 2-4 industries this candidate has REAL experience in based on their work history. Only pick from: finance, tech, creative, healthcare, legal, marketing, operations, hospitality, education, sales. Return only industries where they have genuine hands-on experience — not industries they might pivot into. Be selective, max 4.

For skill_quadrant: score this candidate 0-10 on each of 4 working-style axes — be honest and discriminating, not generous. Most people are STRONG on 1-2, MODERATE on 1-2, WEAK on 0-1.
  - HANDS (0-10): physical/practical work — tools, equipment, dexterity, building, manual skill, on-site operations. High: trades, F&B service, manufacturing, surgery, construction. Low: pure desk/analytical roles.
  - HEART (0-10): interpersonal — leadership, customer-facing, persuasion, care, team building, stakeholder management. High: sales, HR, hospitality, teaching, nursing, management. Low: solo back-office work.
  - HEAD (0-10): analytical/technical — data, systems thinking, problem-solving, technical depth. High: engineering, finance, data, research, accounting. Low: purely creative or hands-only roles.
  - SPARK (0-10): creative synthesis — strategy, design, innovation, original concept work. High: creative direction, product, R&D, founders, marketing strategy. Low: routine execution roles.
  Provide a 1-2 sentence reasoning. Examples for calibration:
    - Construction foreman: Hands 9, Heart 7, Head 4, Spark 3
    - Sales VP: Heart 9, Head 6, Spark 7, Hands 2
    - ML engineer: Head 9, Spark 7, Hands 4, Heart 5
    - Hotel GM: Heart 9, Head 6, Hands 6, Spark 5
    - Surgeon: Hands 9, Head 9, Heart 7, Spark 5
    - Junior accountant: Head 8, Heart 4, Hands 2, Spark 2

For continuous_learning: extract ALL of these from anywhere on the CV — they're often hidden in "Additional", "Certifications", "Professional Development", "Activities", "Interests", "Speaking", "Memberships" sections, or buried in work descriptions:
  - certifications: industry credentials (CFA, ACCA, AWS, PMP, CKA, ITIL, RYT, RICS, etc.) with issuer and year
  - events: conferences ATTENDED (Money 20/20, KubeCon, SaaStr, MozCon, Web Summit, GITEX, AHIC etc.) with role (attendee/speaker/organizer)
  - talks: where they SPOKE or PRESENTED (conferences, webinars, panels) with venue + title
  - oss: open-source contributions (GitHub repos, npm packages, PRs to known projects)
  - courses: online courses completed (Coursera, Udemy, Pluralsight, edX, LinkedIn Learning)
  If a category has nothing on the CV, return an empty array for that category — don't omit the key. If nothing in any category, return empty arrays for all 5.

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
    matched_industries: parsed.matched_industries || [],
    // Skill fingerprint + continuous learning extracted from the CV
    skill_quadrant: parsed.skill_quadrant
      ? { ...parsed.skill_quadrant, assessed_at: new Date().toISOString(), assessed_from: 'cv' }
      : null,
    continuous_learning: parsed.continuous_learning || {
      certifications: [], events: [], talks: [], oss: [], courses: [],
    },
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
