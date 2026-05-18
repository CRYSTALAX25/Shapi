import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { sendWhatsApp } from '@/lib/whatsapp'
import { INDUSTRY_BRIEFS, type Industry } from '@/lib/industry-briefs'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

// Extend Vercel function timeout — Claude question generation needs time
export const maxDuration = 60

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

  // Stitch the rich briefs for each target industry into the prompt
  const briefsForTargets = targetIndustries
    .map(ind => INDUSTRY_BRIEFS[ind as Industry] || `${ind.toUpperCase()}: focus on quantified impact, scope, and named achievements.`)
    .join('\n\n═══════════════════════════════════════════════════════\n\n')

  const industryList = targetIndustries.map(i => i.charAt(0).toUpperCase() + i.slice(1)).join(', ')

  const skillsList = Array.isArray(profile.skills)
    ? (profile.skills as string[]).join(', ')
    : ''

  const prompt = `You are a senior recruiter and CV writer at a top executive search firm. You're running a WhatsApp interview with a candidate to surface the SPECIFIC details missing from their CV that would put them in the top 10% of applicants for ${industryList} roles.

═══ CANDIDATE PROFILE (read carefully) ═══
Name: ${profile.full_name || 'Candidate'}
Headline: ${profile.headline || 'not provided'}
Skills listed: ${skillsList || 'none listed'}
Work history (full JSON): ${JSON.stringify(profile.work_history || [])}
Prior WhatsApp answers (from the main interview): ${existingChat || 'None yet — this is the first interview'}

═══ WHAT AN EXCEPTIONAL CV LOOKS LIKE IN ${industryList.toUpperCase()} ═══

${briefsForTargets}

═══ YOUR TASK (two steps) ═══

STEP 1 — Internal gap analysis (do NOT output this part):
Read the candidate's profile against the brief(s) above. Identify the TOP 6-8 SPECIFIC GAPS — things missing from their CV that, if added, would materially improve their chances. Focus on:
  • Missing numbers/metrics specific to this industry (RevPAR, quota %, deal sizes, patient volumes, etc.)
  • Missing sub-segment context (e.g. property type + brand for hospitality, sub-specialty for healthcare, vertical for sales)
  • HIDDEN GOLDMINES from the brief — things candidates in this industry ALWAYS forget but recruiters always look for
  • Industry-specific vocabulary that signals deep expertise (use the "Vocabulary of expertise" section)
  • Career story rationale where role transitions need explaining

STEP 2 — Output the questions:
Write 6-8 WhatsApp questions that surface those exact gaps. Each must:
  • Reference something specific from the candidate's actual CV/profile (proves you read it carefully)
  • Target ONE specific gap from your Step 1 analysis
  • Be answerable in 1-2 sentences or a voice note — no essays
  • Use natural, warm WhatsApp tone — like a sharp recruiter texting, not formal HR
  • Be numbered on its own line: "1. ", "2. ", etc.
  • Where helpful, give context for WHY you're asking (e.g. "Hiring managers in luxury hospitality always ask about pre-opening experience...")

═══ NON-NEGOTIABLE RULES ═══
- NEVER ask about something already clearly in their CV or prior WhatsApp answers (wastes their time, breaks trust)
- For ${industryList}, prioritize gaps from the brief(s) above — those are the ones that decide interviews
- Distribute questions across all target industries proportionally if multiple are picked
- Use industry vocabulary in the questions themselves — shows we know the field
- End the message with EXACTLY: "Once you've answered these, I'll write your ${industryList} CV${targetIndustries.length > 1 ? 's' : ''} straight away 🚀"

Return ONLY the numbered questions and the closing line. Nothing else.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })

  const questionsText = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

  // Send via WhatsApp — ONE combined message (Twilio sandbox drops rapid second sends)
  const firstName = (profile.full_name as string || 'there').split(' ')[0]

  const combinedMessage = `Hi ${firstName} 👋 To write your best ${industryList} CV${targetIndustries.length > 1 ? 's' : ''}, I have a few targeted questions — these surface the stories that make the real difference.

Takes about 5 minutes. Just reply to each one 👇

${questionsText}`

  // Always save questions to industry_chats so we have them regardless of WhatsApp outcome
  // On re-trigger, RESET answers — any prior "answers" before questions actually
  // arrived are garbage (e.g. the user typing "give me the questions" before they had them).
  type IndustryChatEntry = {
    status?: string
    questions?: string
    sent_at?: string
    answers?: string[]
    delivered?: boolean
  }
  const existingIndustryChats = (profile.industry_chats as Record<string, IndustryChatEntry>) || {}
  const updatedIndustryChats: Record<string, IndustryChatEntry> = { ...existingIndustryChats }
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
