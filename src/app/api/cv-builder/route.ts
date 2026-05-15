import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages, profileData } = await request.json()

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `You are Shapi's CV builder assistant. Your job is to help candidates articulate their work experience, skills, and achievements in a way that gets them noticed by the right companies.

You are warm, encouraging, and direct. You ask one focused question at a time. You help people who may not know how to "sell themselves" — including people who have never written a CV before.

Current profile data: ${JSON.stringify(profileData || {})}

Your goals:
1. Help the candidate describe their most recent role with specific achievements and numbers
2. Uncover skills they take for granted but that are actually valuable
3. Identify what kind of role they want next and why
4. Build a compelling summary in their own voice

Rules:
- Ask one question at a time
- When they answer vaguely, ask for specifics ("Can you give me a number or example?")
- When they undersell themselves, reflect back what they said more powerfully
- After collecting enough for a role, summarise it back and ask if it's right
- Keep responses short — max 3 sentences + your question
- Never use jargon or corporate speak
- If they mention something impressive, acknowledge it genuinely before moving on`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const reply = response.content[0].type === 'text' ? response.content[0].text : ''

  return NextResponse.json({ reply })
}
