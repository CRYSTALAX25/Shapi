import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAnthropic } from '@/lib/anthropic'

export const maxDuration = 30

const INDUSTRY_GUIDES: Record<string, string> = {
  finance: 'Lead with a number: revenue managed, AUM, cost savings, or % return.',
  tech: 'Name the specific stack or product. Quantify scale: users, uptime, speed improvement.',
  creative: 'Name the brand or campaign. Include a reach or engagement metric.',
  healthcare: 'Mention clinical setting and patient volume or outcome metric.',
  legal: 'Name the practice area and deal/case type.',
  marketing: 'Lead with a campaign metric: ROAS, conversion rate, or audience size.',
  operations: 'Lead with scale: volume, headcount, cost reduction, or time saved.',
  hospitality: 'Name the property and a guest satisfaction or revenue metric.',
  education: 'Mention cohort size and a student outcome.',
  sales: 'Lead with quota attainment % or revenue generated.',
  general: 'Lead with a specific impact: what changed, by how much, for whom.',
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, summary, work_history, skills, whatsapp_chat, industry')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rawSummary = (profile.summary as string) || ''
  const allChat = Array.isArray(profile.whatsapp_chat)
    ? (profile.whatsapp_chat as Array<{ role: string; content: string }>)
    : []
  const userMessages = allChat.filter(m => m.role === 'user').map(m => m.content)

  if (userMessages.length === 0) {
    return NextResponse.json({ before: rawSummary, after: null, has_whatsapp: false })
  }

  const industry = (profile.industry as string) || 'general'
  const guide = INDUSTRY_GUIDES[industry] || INDUSTRY_GUIDES.general

  const anthropic = getAnthropic()

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `You are rewriting a professional CV summary to be more specific and impactful.

ORIGINAL SUMMARY (from their uploaded CV):
"${rawSummary || 'No summary provided — just a list of job titles and companies.'}"

WHATSAPP CONVERSATION (what they actually told us — use this to add specifics):
${userMessages.slice(0, 6).map((m, i) => `[${i + 1}] ${m}`).join('\n')}

INDUSTRY: ${industry}
WRITING RULE: ${guide}

Write ONE polished summary paragraph (2-3 sentences max). Be specific — use real numbers, company names, and outcomes from the WhatsApp messages. Make it sound like a human wrote it, not a template.

Return ONLY the enhanced summary text. No quotes, no labels, nothing else.`,
    }],
  })

  const enhanced = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

  return NextResponse.json({
    before: rawSummary || null,
    after: enhanced || null,
    has_whatsapp: true,
    whatsapp_count: userMessages.length,
    industry,
  })
}
