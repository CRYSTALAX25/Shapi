import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropic } from '@/lib/anthropic'

export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jd_text } = await request.json()
  if (!jd_text?.trim()) return NextResponse.json({ error: 'jd_text required' }, { status: 400 })

  const anthropic = getAnthropic()

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Extract structured information from this job description. Return ONLY valid JSON — no other text.

JOB DESCRIPTION:
${jd_text.slice(0, 4000)}

Return this JSON:
{
  "title": "exact job title",
  "department": "department or function (e.g. Operations, Finance, Tech) or null",
  "location": "city, country or null",
  "remote": true or false,
  "salary_min": number or null (annual, in the currency mentioned),
  "salary_max": number or null,
  "salary_currency": "USD" or detected currency code or null,
  "problem_to_solve": "1-2 sentences: what business problem does this role solve? Extract from the JD.",
  "ideal_candidate": "1-2 sentences: what does the ideal candidate look like based on requirements?",
  "team_context": "what team/reporting structure is mentioned, or null",
  "what_success_looks_like": "any KPIs or success criteria mentioned, or null",
  "deal_breakers": "any must-haves or deal-breakers mentioned, or null",
  "growth_path": "any career progression mentioned, or null"
}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'Parse failed' }, { status: 500 })

  try {
    const parsed = JSON.parse(match[0])
    return NextResponse.json({ parsed })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from Claude' }, { status: 500 })
  }
}
