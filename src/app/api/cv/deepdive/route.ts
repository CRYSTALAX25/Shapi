import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { sendWhatsApp } from '@/lib/whatsapp'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

// Extend Vercel function timeout — Claude question generation needs time
export const maxDuration = 60

// Industry-specific focus areas to prompt Claude with
const INDUSTRY_FOCUS: Record<string, string> = {
  finance: 'P&L responsibility, budgets managed, cost savings, revenue generated, financial controls, compliance, reporting',
  tech: 'tech stack, systems built or managed, scale (users/uptime/latency), automation, technical leadership',
  creative: 'campaigns, brands worked with, creative direction, audience reach, content production, platform experience',
  healthcare: 'clinical settings, patient volumes, certifications, care standards, protocols followed',
  legal: 'practice areas, deal/case types, jurisdictions, contracts negotiated, legal frameworks',
  marketing: 'campaigns run, channels owned, ROAS/conversion/CAC metrics, tools used, team size',
  operations: 'processes built, team sizes managed, cost reductions, efficiency gains, vendor management, compliance',
  hospitality: 'property types, F&B operations, guest experience metrics, team size, revenue managed, openings/launches',
  education: 'student outcomes, curriculum, cohort sizes, programmes designed, research',
  sales: 'quota attainment, deal sizes, revenue generated, sales methodology, markets covered, team leadership',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { industries } = await request.json()
  // industries: string[] — e.g. ['hospitality', 'operations']
  if (!Array.isArray(industries) || industries.length === 0) {
    return NextResponse.json({ error: 'industries required' }, { status: 400 })
  }
  const targetIndustries: string[] = industries.slice(0, 3)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, work_history, skills, whatsapp_chat, whatsapp_number, cv_tier, industry_chats')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.cv_tier !== 'pro') return NextResponse.json({ error: 'Pro tier required' }, { status: 403 })
  if (!profile.whatsapp_number) return NextResponse.json({ error: 'WhatsApp number required' }, { status: 400 })

  const existingChat = Array.isArray(profile.whatsapp_chat)
    ? (profile.whatsapp_chat as Array<{ role: string; content: string }>)
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .slice(0, 15)
        .join('\n')
    : ''

  // Generate targeted questions with Claude
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const focusAreas = targetIndustries
    .map(ind => `${ind.toUpperCase()}: ${INDUSTRY_FOCUS[ind] || 'key achievements and experience'}`)
    .join('\n')

  const prompt = `You are writing WhatsApp interview questions for a CV writer.

CANDIDATE: ${profile.full_name || 'Candidate'}
HEADLINE: ${profile.headline || ''}
WORK HISTORY: ${JSON.stringify(profile.work_history || [])}
EXISTING WHATSAPP ANSWERS: ${existingChat || 'None yet'}

TARGET INDUSTRIES FOR DEEP-DIVE:
${focusAreas}

Your job: Write 6-8 WhatsApp messages that will extract the specific stories, numbers and context needed to write compelling CVs for these industries.

Rules:
- Each question on its own line starting with a number and dot (1. 2. etc.)
- Conversational WhatsApp tone — warm, direct, not formal
- Ask about GAPS — things missing from their CV that are critical for these industries
- Reference their actual experience to show you've read their profile
- For hospitality: ask about F&B operations, team sizes, guest metrics, any venue openings/launches
- For operations: ask about process improvements, cost savings, systems they built
- Never ask what's already clearly in their CV
- End with: "Once you've answered these, I'll write your [industry list] CVs straight away 🚀"

Return ONLY the numbered questions, nothing else.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })

  const questionsText = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

  // Send via WhatsApp — ONE combined message (Twilio sandbox drops rapid second sends)
  const firstName = (profile.full_name as string || 'there').split(' ')[0]
  const industryList = targetIndustries.map(i => i.charAt(0).toUpperCase() + i.slice(1)).join(', ')

  const combinedMessage = `Hi ${firstName} 👋 To write your best ${industryList} CV${targetIndustries.length > 1 ? 's' : ''}, I have a few targeted questions — these surface the stories that make the real difference.

Takes about 5 minutes. Just reply to each one 👇

${questionsText}`

  // Always save questions to industry_chats so we have them regardless of WhatsApp outcome
  // On re-trigger, RESET answers — any prior "answers" before questions actually
  // arrived are garbage (e.g. the user typing "give me the questions" before they had them).
  const existingIndustryChats = (profile.industry_chats as Record<string, { answers?: string[]; delivered?: boolean }>) || {}
  const updatedIndustryChats = { ...existingIndustryChats }
  for (const ind of targetIndustries) {
    updatedIndustryChats[ind] = {
      status: 'questions_sent',
      questions: questionsText,
      sent_at: new Date().toISOString(),
      answers: [],          // wipe prior garbage answers
      delivered: false,      // flipped to true only on successful WhatsApp delivery
    }
  }
  await supabase.from('profiles').update({ industry_chats: updatedIndustryChats }).eq('id', user.id)

  console.log('[deepdive] Sending combined message, length:', combinedMessage.length, 'to:', profile.whatsapp_number)

  const wa = await sendWhatsApp(profile.whatsapp_number as string, combinedMessage)
  if (!wa.success) {
    console.error('[deepdive] WhatsApp send failed:', wa.error, '| phone:', profile.whatsapp_number, '| length:', combinedMessage.length)
    return NextResponse.json({
      success: false,
      whatsapp_failed: true,
      questions: questionsText,
      error: `WhatsApp delivery failed (${wa.error || 'unknown'}). Your questions are shown below — answer them in WhatsApp by replying to the chat, or use the app.`,
    }, { status: 200 })
  }

  // Mark as delivered so the webhook knows the questions actually reached the user
  const deliveredChats = { ...updatedIndustryChats }
  for (const ind of targetIndustries) {
    deliveredChats[ind] = { ...deliveredChats[ind], delivered: true }
  }
  await supabase.from('profiles').update({ industry_chats: deliveredChats }).eq('id', user.id)

  console.log('[deepdive] Combined message delivered to:', profile.whatsapp_number)
  return NextResponse.json({ success: true, industries: targetIndustries })
}
