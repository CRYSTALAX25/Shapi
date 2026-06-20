import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropic } from '@/lib/anthropic'
import { LOCALES } from '@/lib/i18n/locales'

// Locale codes a roles.translations entry may be keyed by (everything but en)
const TRANSLATION_LOCALES = new Set(LOCALES.filter(l => l.code !== 'en').map(l => l.code as string))

// Validate + sanitise a client-sent translations object into
// { ar: { title, description, requirements }, ... }. Drops unknown locales
// and non-string values. Returns null when nothing valid remains.
function sanitiseTranslations(input: unknown): Record<string, { title: string; description: string; requirements: string }> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const out: Record<string, { title: string; description: string; requirements: string }> = {}
  for (const [code, value] of Object.entries(input as Record<string, unknown>)) {
    if (!TRANSLATION_LOCALES.has(code)) continue
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const v = value as Record<string, unknown>
    const entry = {
      title: typeof v.title === 'string' ? v.title.trim() : '',
      description: typeof v.description === 'string' ? v.description.trim() : '',
      requirements: typeof v.requirements === 'string' ? v.requirements.trim() : '',
    }
    if (entry.title || entry.description || entry.requirements) out[code] = entry
  }
  return Object.keys(out).length ? out : null
}

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
    accepts_pivot_candidates,
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

  // JD body: the new flow ALWAYS sends a company-reviewed description
  // (parsed from their internal JD, or AI-drafted via /draft-jd then edited
  // in the form). When provided, we save it verbatim — no regeneration, no
  // surprises. The Claude generation below is kept only as a fallback for
  // legacy callers that send the brief without a description.
  let description = typeof body.description === 'string' ? body.description.trim() : ''
  let requirements = typeof body.requirements === 'string' ? body.requirements.trim() : ''

  // Optional multilingual JD versions, reviewed in the form before publish.
  const translations = sanitiseTranslations(body.translations)

  if (!description) {
  try {
    const anthropic = getAnthropic()
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
  }

  const payload: Record<string, unknown> = {
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
    accepts_pivot_candidates: accepts_pivot_candidates === true,
    description,
    requirements,
    what_success_looks_like: what_success_looks_like || null,
    team_context: team_context || null,
    status: 'active',
    updated_at: new Date().toISOString(),
  }
  if (translations) payload.translations = translations

  let { data: role, error } = await supabase
    .from('roles')
    .insert(payload)
    .select()
    .single()

  // Graceful degradation: if supabase/jd_translations.sql hasn't been run
  // yet, the translations column doesn't exist — save the role without it
  // rather than failing the whole publish.
  let translationsSaved = !!translations
  if (error && translations && /translations/i.test(error.message)) {
    console.warn('[company/roles] translations column missing — run supabase/jd_translations.sql. Saving role without translations.')
    delete payload.translations
    translationsSaved = false
    ;({ data: role, error } = await supabase.from('roles').insert(payload).select().single())
  }

  if (error) {
    console.error('[company/roles] Insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    role,
    translations_saved: translationsSaved,
    ...(translations && !translationsSaved
      ? { warning: 'Role published, but translations could not be saved yet (database migration pending).' }
      : {}),
  })
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
