import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const { token, quality, achievement, skills, would_rehire, anything_else } = await request.json()

  if (!token || !quality || !achievement || !skills || !would_rehire) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: ref, error } = await supabase
    .from('candidate_references')
    .select('id, status, candidate_id')
    .eq('token', token)
    .single()

  if (error || !ref) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  if (ref.status === 'completed') {
    return NextResponse.json({ error: 'Already submitted' }, { status: 400 })
  }

  // Use Claude to extract skills mentioned in the reference
  let extractedSkills: string[] = []
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Extract a list of professional skills mentioned in this reference. Return only a JSON array of short skill strings (max 8 items). No explanation.

Quality: ${quality}
Achievement: ${achievement}
Skills mentioned: ${skills}
Additional: ${anything_else || ''}`,
      }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : '[]'
    const match = text.indexOf('[')
    const end = text.lastIndexOf(']')
    extractedSkills = match !== -1 && end !== -1 ? JSON.parse(text.slice(match, end + 1)) : []
  } catch {
    // Non-fatal — proceed without extracted skills
  }

  await supabase
    .from('candidate_references')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      response_quality: quality,
      response_achievement: achievement,
      response_skills: skills,
      response_would_rehire: would_rehire,
      response_anything_else: anything_else || null,
      extracted_skills: extractedSkills,
    })
    .eq('id', ref.id)

  // Update candidate profile completion
  await supabase
    .from('profiles')
    .update({ completion_pct: 85 })
    .eq('id', ref.candidate_id)

  return NextResponse.json({ success: true })
}
