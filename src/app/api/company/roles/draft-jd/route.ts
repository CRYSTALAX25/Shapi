// Draft a JD from the hiring manager's honest-brief answers — WITHOUT
// creating or publishing anything. Returns { description, requirements } so
// the draft lands in the editable form on /company/roles/new and the company
// reviews/edits before publishing. (The old flow generated the JD inside
// POST /api/company/roles at publish time, so companies never saw it before
// it went live — this fixes that.)

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: company } = await supabase
    .from('profiles')
    .select('type, company_name')
    .eq('id', user.id)
    .single()
  if (!company || company.type !== 'company') {
    return NextResponse.json({ error: 'Company account required' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const {
    title, department, location, remote,
    salary_min, salary_max, salary_currency,
    problem_to_solve,
    ideal_candidate,
    team_context,
    what_success_looks_like,
    deal_breakers,
    growth_path,
  } = body

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'Role title required' }, { status: 400 })
  }
  if (!problem_to_solve || typeof problem_to_solve !== 'string' || !problem_to_solve.trim()) {
    return NextResponse.json({ error: 'Tell us the problem this person needs to solve — that’s what makes the draft specific' }, { status: 400 })
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are writing a job description for ${company.company_name || 'a company'}.

Role: ${title}
Department: ${department || 'not specified'}
Location: ${location || 'not specified'} ${remote ? '(Remote OK)' : ''}
Salary: ${salary_min && salary_max ? `${salary_currency || 'USD'} ${Number(salary_min).toLocaleString()}–${Number(salary_max).toLocaleString()}` : 'not specified'}

What the hiring manager told us:
- Problem this person needs to solve: ${problem_to_solve || 'not specified'}
- What makes an ideal candidate: ${ideal_candidate || 'not specified'}
- Team they're joining: ${team_context || 'not specified'}
- What success looks like: ${what_success_looks_like || 'not specified'}
- Deal-breakers / what we won't hire: ${deal_breakers || 'not specified'}
- Where this role leads in 2 years: ${growth_path || 'not specified'}

Write a compelling, honest job description. NOT a generic template. Use the specific details above.
Return JSON with exactly two keys:
{
  "description": "3-4 paragraph role overview — what the role is, why it matters, what the team looks like, what you'll actually be doing",
  "requirements": "bullet list of 6-8 genuine requirements — not buzzwords, specific to this role. Start each with a dash."
}`
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Drafting failed — please try again' }, { status: 500 })

    const parsed = JSON.parse(match[0])
    return NextResponse.json({
      description: typeof parsed.description === 'string' ? parsed.description : '',
      requirements: typeof parsed.requirements === 'string' ? parsed.requirements : '',
    })
  } catch (err) {
    console.error('[company/roles/draft-jd] generation error:', err)
    return NextResponse.json({ error: 'Drafting failed — please try again' }, { status: 500 })
  }
}
