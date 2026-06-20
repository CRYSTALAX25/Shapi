// AI-Proof Status Report — free, public lead magnet. Enter a job title → honest
// automation-risk read + what's at risk, what's irreplaceable, and 3 pivot/
// level-up previews. The FULL plan (timeline, courses, salary) is gated behind a
// free signup on the page. No auth (top-of-funnel); light input guards.

import { NextResponse } from 'next/server'
import { getAnthropic } from '@/lib/anthropic'

export const maxDuration = 30

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const role = (typeof body.role === 'string' ? body.role : '').trim().slice(0, 120)
  const about = (typeof body.about === 'string' ? body.about : '').trim().slice(0, 400)
  if (!role) return NextResponse.json({ error: 'Enter your job title.' }, { status: 400 })

  const anthropic = getAnthropic()

  const prompt = `You are Shapi, an honest career strategist. Give a quick "AI-Proof Status" read for this worker. Be truthful, not alarmist and not falsely reassuring.

Job title: ${role}
${about ? `What they do: ${about}` : ''}

Rules:
- ai_risk 0-10 = how exposed THIS role is to automation (0-3 low / 4-6 medium / 7-10 high).
- Skilled physical trades (plumber, electrician, HVAC, mechanic), hands-on care (nurse, carer), and deep-judgement/relationship roles are LOW risk — celebrate them, don't tell them to flee; their pivots should be LEVEL-UP moves (more pay, specialise, supervise, run a business).
- High-risk roles (data entry, basic copywriting, routine admin, transactional work): be honest and give pivots OUT into durable fields.
- pivots: 3 realistic next moves that reuse their experience (adjacent, not generic restarts).

Return ONLY valid JSON, tight (each item ≤ 14 words):
{
  "role": "${role}",
  "ai_risk": 0,
  "risk_label": "Low|Medium|High",
  "verdict": "1-2 honest sentences",
  "at_risk_tasks": ["2-3 parts of this job AI is already doing"],
  "human_strengths": ["2-3 things in this role AI can't replace"],
  "pivots": [ { "to_role": "...", "why": "1 short sentence" } ]
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Could not read that role — try again.' }, { status: 500 })
    const report = JSON.parse(match[0])
    return NextResponse.json({ success: true, report })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai-proof] error:', msg)
    return NextResponse.json({ error: 'Something went wrong — try again.' }, { status: 500 })
  }
}
