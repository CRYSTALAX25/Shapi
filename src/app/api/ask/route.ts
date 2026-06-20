import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAnthropic } from '@/lib/anthropic'

// Keep the assistant snappy — short, focused career answers
export const maxDuration = 30

type ChatMessage = { role: 'user' | 'assistant'; content: string }

// Two system prompts — Shapi serves two audiences and one prompt cannot do
// both well. The route detects profile.type and picks accordingly.

const CANDIDATE_SYSTEM_PROMPT = `You are Shapi — a warm, practical career guide in the AI era. Help with career pivots, which courses to take (free/paid/financed), salary expectations by country, and concrete steps to start a small business. Be concise (≤120 words), specific, and encouraging. You are NOT a general chatbot — keep it about careers, skills, jobs, money, and work.`

const COMPANY_SYSTEM_PROMPT = `You are Shapi — a workforce and hiring co-pilot for the AI era. You help hiring managers, founders, and HR leaders with: role definition + JD drafting, comp benchmarks by country and seniority, hiring roadmaps (what to hire first, what to defer), restructuring + outplacement (Replace/Augment/Reskill/Redeploy/Protect), AI exposure of teams + roles, org design (target operating model), and how to use Shapi's tools (Workforce Snapshot, Salary Benchmark, Hiring Plan, Hiring Roadmap, Org Design, Staffing Recommendations, Cognitive Load, AI-Proof a Role). Be concise (≤120 words), specific, decision-oriented. When relevant, point to the specific Shapi tool that does the heavy lifting. You are NOT a general chatbot — keep it about hiring, workforce, comp, org design, and AI transformation.`

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

  // ── Detect role + personalise: candidate gets career framing, company gets
  // workforce / hiring framing. Either way we keep it best-effort. ──
  let contextBlock = ''
  let isCompany = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Pull a broad set of fields once; we use only what's relevant per role.
      const { data: profile } = await supabase
        .from('profiles')
        .select('type, headline, location, skills, career_recommendations, ai_resilience_score, company_name, company_size, industry, summary, company_data')
        .eq('id', user.id)
        .single()
      if (profile) {
        isCompany = profile.type === 'company'
        const parts: string[] = []
        if (isCompany) {
          if (profile.company_name) parts.push(`Company: ${profile.company_name}`)
          if (profile.industry) parts.push(`Industry: ${profile.industry}`)
          if (profile.company_size) parts.push(`Size: ${profile.company_size}`)
          if (profile.location) parts.push(`Location: ${profile.location}`)
          if (profile.summary) parts.push(`About: ${(profile.summary as string).slice(0, 400)}`)
        } else {
          const skills = Array.isArray(profile.skills)
            ? (profile.skills as string[]).slice(0, 12).join(', ')
            : ''
          const recs = profile.career_recommendations
            ? JSON.stringify(profile.career_recommendations).slice(0, 800)
            : ''
          if (profile.headline) parts.push(`Headline: ${profile.headline}`)
          if (profile.location) parts.push(`Location: ${profile.location}`)
          if (skills) parts.push(`Skills: ${skills}`)
          if (typeof profile.ai_resilience_score === 'number') parts.push(`AI resilience score (0-10): ${profile.ai_resilience_score}`)
          if (recs) parts.push(`Career recommendations on file: ${recs}`)
        }
        if (parts.length > 0) {
          const label = isCompany ? 'ABOUT THIS COMPANY' : 'ABOUT THIS PERSON'
          contextBlock = `\n\n${label} (use to personalise, do not recite verbatim):\n${parts.join('\n')}`
        }
      }
    }
  } catch {
    // Personalisation is best-effort — never block the answer on it
  }

  try {
    const anthropic = getAnthropic()
    const systemPrompt = isCompany ? COMPANY_SYSTEM_PROMPT : CANDIDATE_SYSTEM_PROMPT
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt + contextBlock,
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
