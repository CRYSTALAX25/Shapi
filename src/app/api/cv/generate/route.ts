import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { redirect } from 'next/navigation'

// Extend Vercel function timeout to 60s for Claude CV generation
export const maxDuration = 60

type WorkEntry = {
  title?: string
  company?: string
  start?: string
  end?: string
  achievements?: string
}

const INDUSTRY_GUIDES: Record<string, string> = {
  finance: 'Lead achievements with numbers. Formal tone. Highlight P&L, AUM, risk, compliance outcomes.',
  tech: 'Name specific stack in context. Quantify scale (users, uptime, latency). Show ownership.',
  creative: 'Evocative language. Name brands and campaigns. Include reach/engagement metrics.',
  healthcare: 'Certifications and licenses prominent. Clinical hours and patient volumes. Formal and precise.',
  legal: 'Practice areas clear. Deal/case experience named. Academic credentials weighted.',
  marketing: 'Every campaign gets a metric: ROAS, conversion, CAC, reach. Channel ownership clear.',
  operations: 'Certifications and licences first. Volume, scale, safety record. Direct and factual.',
  hospitality: 'Property name and star rating upfront. RevPAR, covers, guest scores. Languages listed.',
  education: 'Student outcomes and cohort size. Research and publications. Safeguarding noted.',
  sales: 'Quota attainment % in every role. Deal size, revenue generated. Methodology named.',
  general: 'Lead with impact. Quantify wherever possible. Clear upward progression.',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { mode } = await request.json() // 'english' | 'native'

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, location, summary, skills, work_history, whatsapp_chat, industry, whatsapp_number, ai_tier')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const workHistory: WorkEntry[] = Array.isArray(profile.work_history) ? profile.work_history as WorkEntry[] : []
  const skills: string[] = Array.isArray(profile.skills) ? profile.skills as string[] : []
  const allChat: Array<{ role: string; content: string }> = Array.isArray(profile.whatsapp_chat) ? profile.whatsapp_chat as Array<{ role: string; content: string }> : []
  const userMessages = allChat.filter(m => m.role === 'user').map(m => m.content)
  const sampleText = userMessages.slice(0, 5).join(' | ')
  const industry = (profile.industry as string) || 'general'
  const industryGuide = INDUSTRY_GUIDES[industry] || INDUSTRY_GUIDES.general

  const languageInstruction = mode === 'native'
    ? `Detect the candidate's native language from their messages: "${sampleText || 'No messages'}". If unclear, default to Arabic. Translate ALL text values into that language. Keep JSON keys in English.`
    : `Write everything in polished professional English.`

  const prompt = `You are an expert CV writer producing a world-class ${mode === 'native' ? 'native language' : 'English'} CV.

CANDIDATE INFO:
- Name: ${profile.full_name || ''}
- Headline: ${profile.headline || ''}
- Location: ${profile.location || ''}
- Industry: ${industry}
- Summary: ${(profile.summary as string || '').replace(/"/g, "'")}
- Work history: ${JSON.stringify(workHistory)}
- Skills: ${JSON.stringify(skills)}
- WhatsApp conversation (use these stories and insights to ENRICH achievements and summary — this is gold): ${JSON.stringify(userMessages)}

INDUSTRY WRITING GUIDE — ${industry.toUpperCase()}:
${industryGuide}

LANGUAGE: ${languageInstruction}

Using ALL of the above — CV data AND WhatsApp insights — produce an enriched, polished CV. The WhatsApp answers often contain specific numbers, challenges, and stories missing from the raw CV. Weave them in.

Return ONLY valid JSON:
{
  "language": "${mode === 'english' ? 'English' : 'detected language name'}",
  "languageCode": "${mode === 'english' ? 'en' : 'detected 2-letter code'}",
  "full_name": "...",
  "headline": "...",
  "location": "...",
  "summary": "3-4 sentence enriched professional summary",
  "sectionLabels": {
    "profile": "...",
    "inTheirOwnWords": "...",
    "experience": "...",
    "skills": "...",
    "present": "...",
    "verifiedBy": "..."
  },
  "workHistory": [{"title":"...","company":"...","start":"...","end":"...","achievements":"2-3 bullet points with metrics"}],
  "chatAnswers": ["best quote 1 from whatsapp", "best quote 2", "best quote 3"],
  "skills": ["skill1","skill2"]
}`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Claude returned invalid JSON' }, { status: 500 })

    const cv = JSON.parse(jsonMatch[0])

    // Merge with profile fields not in the CV (for the render)
    return NextResponse.json({
      cv,
      meta: {
        whatsapp_number: profile.whatsapp_number,
        ai_tier: profile.ai_tier,
        has_whatsapp: userMessages.length > 0,
      }
    })
  } catch (err) {
    console.error('[cv/generate] error:', err)
    return NextResponse.json({ error: 'CV generation failed' }, { status: 500 })
  }
}
