import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Keep the assistant snappy — short, focused career answers
export const maxDuration = 30

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const SYSTEM_PROMPT = `You are Shapi — a warm, practical career guide in the AI era. Help with career pivots, which courses to take (free/paid/financed), salary expectations by country, and concrete steps to start a small business. Be concise (≤120 words), specific, and encouraging. You are NOT a general chatbot — keep it about careers, skills, jobs, money, and work.`

export async function POST(request: Request) {
  let messages: ChatMessage[] = []
  try {
    const body = await request.json()
    if (Array.isArray(body?.messages)) {
      messages = body.messages
        .filter(
          (m: unknown): m is ChatMessage =>
            !!m &&
            typeof m === 'object' &&
            (((m as ChatMessage).role === 'user') || ((m as ChatMessage).role === 'assistant')) &&
            typeof (m as ChatMessage).content === 'string'
        )
        .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (messages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
  }

  // ── Optional personalisation: include a short profile context if signed in ──
  let contextBlock = ''
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('headline, location, skills, career_recommendations, ai_resilience_score')
        .eq('id', user.id)
        .single()
      if (profile) {
        const skills = Array.isArray(profile.skills)
          ? (profile.skills as string[]).slice(0, 12).join(', ')
          : ''
        const recs = profile.career_recommendations
          ? JSON.stringify(profile.career_recommendations).slice(0, 800)
          : ''
        const parts: string[] = []
        if (profile.headline) parts.push(`Headline: ${profile.headline}`)
        if (profile.location) parts.push(`Location: ${profile.location}`)
        if (skills) parts.push(`Skills: ${skills}`)
        if (typeof profile.ai_resilience_score === 'number') parts.push(`AI resilience score (0-10): ${profile.ai_resilience_score}`)
        if (recs) parts.push(`Career recommendations on file: ${recs}`)
        if (parts.length > 0) {
          contextBlock = `\n\nABOUT THIS PERSON (use to personalise, do not recite verbatim):\n${parts.join('\n')}`
        }
      }
    }
  } catch {
    // Personalisation is best-effort — never block the answer on it
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: SYSTEM_PROMPT + contextBlock,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })
    const reply = response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''
    return NextResponse.json({ reply: reply || "Sorry, I couldn't generate a reply just now." })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[api/ask] error:', msg)
    return NextResponse.json({ error: 'Ask Shapi is unavailable right now. Please try again.' }, { status: 500 })
  }
}
