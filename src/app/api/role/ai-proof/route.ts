// Role AI-Proof — companies paste a JD and we score how AI-resistant the
// role is. Honest, not alarmist: most roles need redesign/augmentation, not
// elimination. Mirror of /api/ai-proof but framed for the hiring side.

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 20

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const title = (typeof body.title === 'string' ? body.title : '').trim().slice(0, 160)
  const description = (typeof body.description === 'string' ? body.description : '').trim().slice(0, 6000)
  const country = (typeof body.country === 'string' ? body.country : '').trim().slice(0, 80)
  if (!title) return NextResponse.json({ error: 'Add a role title.' }, { status: 400 })
  if (!description) return NextResponse.json({ error: 'Paste the job description.' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are Shapi, an honest workforce strategist advising a hiring company. Score how AI-resistant THIS ROLE is, based on the job description.

Role title: ${title}
${country ? `Country: ${country}` : ''}
Job description:
${description}

Rules:
- score 0-10 = how AI-RESILIENT this role is (10 = very durable, 0 = mostly automatable).
- verdict mapping: 7-10 "safe", 4-6 "caution", 0-3 "high-risk".
- Be honest, not alarmist. Do NOT recommend killing the role. Where AI is encroaching, recommend redesign + augmentation so the human focuses on judgement, relationships, accountability, edge cases.
- tasks_at_risk: 2-4 specific tasks from THIS JD that AI/agents can already do well.
- tasks_resilient: 2-3 tasks in THIS JD that genuinely need a human (judgement, stakes, trust, physical, novel context).
- augment_with_ai: 2-3 concrete ways to give this person AI tools so output per head goes up (not headcount down).
- redesign_suggestion: 1 sentence — how to reshape the role so it stays high-leverage in an AI-heavy workplace.

Return ONLY valid JSON, tight (each list item <= 16 words):
{
  "score": 0,
  "verdict": "safe|caution|high-risk",
  "why": "1-2 honest sentences explaining the score",
  "tasks_at_risk": ["..."],
  "tasks_resilient": ["..."],
  "augment_with_ai": ["..."],
  "redesign_suggestion": "1 sentence"
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Could not read that role — try again.' }, { status: 500 })
    const parsed = JSON.parse(match[0])
    const score = Math.max(0, Math.min(10, Number(parsed.score) || 0))
    const rawVerdict = String(parsed.verdict || '').toLowerCase()
    const verdict: 'safe' | 'caution' | 'high-risk' =
      rawVerdict.includes('safe') ? 'safe'
      : rawVerdict.includes('high') ? 'high-risk'
      : rawVerdict.includes('caution') ? 'caution'
      : score >= 7 ? 'safe' : score >= 4 ? 'caution' : 'high-risk'
    return NextResponse.json({
      success: true,
      score,
      verdict,
      why: String(parsed.why || ''),
      tasks_at_risk: Array.isArray(parsed.tasks_at_risk) ? parsed.tasks_at_risk.slice(0, 4) : [],
      tasks_resilient: Array.isArray(parsed.tasks_resilient) ? parsed.tasks_resilient.slice(0, 3) : [],
      augment_with_ai: Array.isArray(parsed.augment_with_ai) ? parsed.augment_with_ai.slice(0, 3) : [],
      redesign_suggestion: String(parsed.redesign_suggestion || ''),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[role/ai-proof] error:', msg)
    return NextResponse.json({ error: 'Something went wrong — try again.' }, { status: 500 })
  }
}
