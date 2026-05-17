import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 45

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { job_title, company_name, company_website, job_url, key_requirements, hiring_manager_name, mode } = await request.json()
  // mode: 'email' | 'linkedin' | 'follow_up'

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, skills, work_history, summary, industry, whatsapp_chat, location')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const allChat = Array.isArray(profile.whatsapp_chat) ? profile.whatsapp_chat as Array<{ role: string; content: string }> : []
  const userAnswers = allChat.filter(m => m.role === 'user').map(m => m.content).slice(0, 5)
  const workHistory = Array.isArray(profile.work_history) ? profile.work_history as Array<{ title?: string; company?: string; achievements?: string }> : []

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const outreachMode = mode || 'email'
  const isFollowUp = outreachMode === 'follow_up'

  const prompt = isFollowUp
    ? `Write a short, professional follow-up email. The candidate sent an initial outreach to ${company_name} for a ${job_title} role 5-7 days ago and hasn't heard back.

CANDIDATE: ${profile.full_name}
COMPANY: ${company_name}

Write a 3-sentence follow-up that:
1. References the previous email briefly
2. Adds one new specific reason they're interested (use a detail from their background)
3. Makes it easy to respond (suggest a 15-min call)

Keep it under 100 words. Subject line included.

Return JSON: { "subject": "...", "body": "..." }`
    : `Write a highly personalised outreach ${outreachMode === 'linkedin' ? 'LinkedIn message (300 chars max)' : 'email'} from this candidate to ${hiring_manager_name ? `${hiring_manager_name} at ` : ''}${company_name} about their ${job_title} role.

CANDIDATE PROFILE:
- Name: ${profile.full_name}
- Current headline: ${profile.headline}
- Industry: ${profile.industry}
- Location: ${profile.location}
- Top skills: ${(profile.skills as string[] || []).slice(0, 6).join(', ')}
- Most recent role: ${workHistory[0] ? `${workHistory[0].title} at ${workHistory[0].company}` : 'see profile'}
- Key achievement (from verified profile): ${workHistory[0]?.achievements?.slice(0, 200) || userAnswers[0]?.slice(0, 200) || 'strong track record'}
- WhatsApp-verified insights: ${userAnswers.slice(0, 2).join(' | ')}

ROLE:
- Title: ${job_title}
- Company: ${company_name}
- Website: ${company_website || 'not provided'}
- Key requirements: ${(key_requirements || []).join(', ')}
- Job URL: ${job_url || 'not provided'}

RULES:
- Open with one specific reason you're interested in THIS company (not just the role)
- Reference a concrete achievement from their background that matches a requirement
- Mention Shapi verified profile as proof — "my verified profile on Shapi shows..."
- Keep it under 150 words for email, 300 chars for LinkedIn
- No buzzwords, no "I hope this email finds you well", no filler
- Sound like a senior professional writing to a peer, not a job seeker begging

${outreachMode === 'email' ? `Return JSON: { "subject": "...", "body": "..." }` : `Return JSON: { "message": "..." }`}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'Draft generation failed' }, { status: 500 })

  const draft = JSON.parse(match[0])
  return NextResponse.json({ draft, mode: outreachMode })
}
