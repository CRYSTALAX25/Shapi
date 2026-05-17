import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { company_name, job_title, company_website, key_requirements, application_id } = await request.json()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, skills, work_history, summary, industry, whatsapp_chat')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const allChat = Array.isArray(profile.whatsapp_chat) ? profile.whatsapp_chat as Array<{ role: string; content: string }> : []
  const userAnswers = allChat.filter(m => m.role === 'user').map(m => m.content).slice(0, 8)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ type: 'web_search_20250305', name: 'web_search' } as any],
    messages: [{
      role: 'user',
      content: `Research ${company_name} and prepare comprehensive interview prep for this candidate.

CANDIDATE:
- Name: ${profile.full_name}
- Role applying for: ${job_title}
- Skills: ${(profile.skills as string[] || []).join(', ')}
- Background: ${(profile.summary as string || '').slice(0, 300)}
- Their own words from WhatsApp: ${userAnswers.slice(0, 3).join(' | ')}
- Key requirements they need to meet: ${(key_requirements || []).join(', ')}

Search for:
1. ${company_name} recent news (last 6 months)
2. ${company_name} culture, values, leadership team
3. ${company_name} challenges or strategic priorities
4. Common interview questions for ${job_title} roles
5. ${company_name} Glassdoor reviews (themes)

Then return a complete interview prep guide as JSON:
{
  "company_snapshot": {
    "what_they_do": "2 sentences",
    "size_and_stage": "...",
    "recent_news": ["news1", "news2", "news3"],
    "culture_themes": ["theme1", "theme2"],
    "known_challenges": ["challenge1", "challenge2"]
  },
  "why_they_will_love_you": [
    "Specific reason 1 tied to their needs + candidate background",
    "Specific reason 2",
    "Specific reason 3"
  ],
  "your_stories": [
    {
      "situation": "STAR story from their WhatsApp/profile",
      "task": "...",
      "action": "...",
      "result": "...",
      "use_for_question": "Tell me about a time you..."
    }
  ],
  "likely_questions": [
    {
      "question": "Interview question",
      "your_answer_angle": "How to answer using their specific background",
      "watch_out_for": "What not to say"
    }
  ],
  "questions_to_ask_them": [
    "Insightful question 1 (shows you researched them)",
    "Question 2",
    "Question 3"
  ],
  "red_flags_to_probe": ["Thing to watch out for based on research"],
  "salary_intel": "What to know about negotiating for this role/company"
}`,
    }],
  })

  let prepText = ''
  for (const block of response.content) {
    if (block.type === 'text') prepText += block.text
  }

  let prep = null
  try {
    const match = prepText.match(/\{[\s\S]*\}/)
    if (match) prep = JSON.parse(match[0])
  } catch { prep = null }

  // Save prep to application if application_id provided
  if (application_id && prep) {
    await supabase
      .from('active_applications')
      .update({ notes: JSON.stringify(prep), updated_at: new Date().toISOString() })
      .eq('id', application_id)
      .eq('candidate_id', user.id)
  }

  return NextResponse.json({ prep, company_name, job_title })
}
