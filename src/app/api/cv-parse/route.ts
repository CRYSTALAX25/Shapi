import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

  // Upload to Supabase Storage
  const bytes = await file.arrayBuffer()
  const storagePath = `${user.id}/cv-${Date.now()}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('cvs')
    .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Parse with Claude
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const base64 = Buffer.from(bytes).toString('base64')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: `Extract the candidate's information from this CV and return ONLY a valid JSON object with this exact structure:
{
  "full_name": "string or null",
  "headline": "their current or most recent job title, string or null",
  "location": "city, country if present, string or null",
  "summary": "their profile summary or objective if present, string or null",
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

Return only the JSON. No explanation, no markdown fences.`,
          },
        ],
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Could not parse CV' }, { status: 500 })
  }

  // Save to profile
  await supabase.from('profiles').update({
    cv_storage_path: storagePath,
    cv_parsed: true,
    full_name: parsed.full_name || null,
    headline: parsed.headline || null,
    location: parsed.location || null,
    summary: parsed.summary || null,
    work_history: parsed.work_history || [],
    skills: parsed.skills || [],
    ai_tier: parsed.ai_tier || null,
  }).eq('id', user.id)

  return NextResponse.json({ success: true, profile: parsed })
}
