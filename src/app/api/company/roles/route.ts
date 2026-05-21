import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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

  const body = await request.json()
  const {
    title, department, location, remote,
    salary_min, salary_max, salary_currency,
    salary_visible, engagement_type,
    // Raw answers from the creation form — Claude turns these into a JD
    problem_to_solve,
    ideal_candidate,
    team_context,
    what_success_looks_like,
    deal_breakers,
    growth_path,
  } = body

  if (!title) return NextResponse.json({ error: 'Role title required' }, { status: 400 })
  if (!salary_min || !salary_max) return NextResponse.json({ error: 'Salary range required' }, { status: 400 })

  // Generate JD from answers using Claude
  let description = ''
  let requirements = ''

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
Salary: ${salary_currency} ${salary_min?.toLocaleString()}–${salary_max?.toLocaleString()}

What the hiring manager told us:
- Problem this person needs to solve: ${problem_to_solve || 'not specified'}
- What makes an ideal candidate: ${ideal_candidate || 'not specified'}
- Team they're joining: ${team_context || 'not specified'}
- What success looks like in 90 days: ${what_success_looks_like || 'not specified'}
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
    if (match) {
      const parsed = JSON.parse(match[0])
      description = parsed.description || ''
      requirements = parsed.requirements || ''
    }
  } catch (err) {
    console.error('[company/roles] JD generation error:', err)
    // Don't fail — save with empty description, manager can edit
  }

  const { data: role, error } = await supabase
    .from('roles')
    .insert({
      company_id: user.id,
      created_by: user.id,
      title,
      department: department || null,
      location: location || null,
      remote: remote || false,
      salary_min,
      salary_max,
      salary_currency: salary_currency || 'USD',
      salary_visible: salary_visible !== false,
      engagement_type: ['permanent', 'contract', 'temp'].includes(engagement_type) ? engagement_type : 'permanent',
      description,
      requirements,
      what_success_looks_like: what_success_looks_like || null,
      team_context: team_context || null,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[company/roles] Insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ role })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: roles } = await supabase
    .from('roles')
    .select('*')
    .eq('company_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ roles: roles || [] })
}
