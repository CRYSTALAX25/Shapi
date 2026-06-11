import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { LOCALES } from '@/lib/i18n/locales'

// Owner-scoped single-role operations. Every method re-checks that the role
// belongs to the logged-in company (company_id === user.id) so there is no
// cross-company access.

// Locale codes a roles.translations entry may be keyed by (everything but en)
const TRANSLATION_LOCALES = new Set(LOCALES.filter(l => l.code !== 'en').map(l => l.code as string))

// Validate + sanitise a client-sent translations object (same shape as the
// create route: { ar: { title, description, requirements }, ... }).
// Passing {} explicitly clears all translations.
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
  return out
}

async function getOwnedRole(roleId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: role, error } = await supabase
    .from('roles')
    .select('*')
    .eq('id', roleId)
    .eq('company_id', user.id)
    .single()

  if (error || !role) {
    return { error: NextResponse.json({ error: 'Role not found' }, { status: 404 }) }
  }
  return { supabase, user, role }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getOwnedRole(id)
  if (ctx.error) return ctx.error
  return NextResponse.json({ role: ctx.role })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getOwnedRole(id)
  if (ctx.error) return ctx.error
  const { supabase } = ctx

  const body = await request.json()

  // Whitelist of editable fields — never trust the client with company_id etc.
  const updates: Record<string, unknown> = {}

  if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim()
  if (typeof body.department === 'string') updates.department = body.department.trim() || null
  if (typeof body.location === 'string') updates.location = body.location.trim() || null
  if (typeof body.description === 'string') updates.description = body.description
  if (typeof body.requirements === 'string') updates.requirements = body.requirements
  if (typeof body.hiring_notes === 'string') updates.hiring_notes = body.hiring_notes
  if (typeof body.remote === 'boolean') updates.remote = body.remote
  if (typeof body.salary_visible === 'boolean') updates.salary_visible = body.salary_visible
  if (typeof body.accepts_pivot_candidates === 'boolean') updates.accepts_pivot_candidates = body.accepts_pivot_candidates

  if (body.salary_min !== undefined) {
    const n = Number(body.salary_min)
    updates.salary_min = Number.isFinite(n) && n > 0 ? n : null
  }
  if (body.salary_max !== undefined) {
    const n = Number(body.salary_max)
    updates.salary_max = Number.isFinite(n) && n > 0 ? n : null
  }
  if (typeof body.salary_currency === 'string' && body.salary_currency) {
    updates.salary_currency = body.salary_currency
  }
  if (['permanent', 'contract', 'temp'].includes(body.engagement_type)) {
    updates.engagement_type = body.engagement_type
  }
  if (['draft', 'active', 'closed'].includes(body.status)) {
    updates.status = body.status
  }
  // Multilingual JD versions ({ ar: { title, description, requirements }, ... }).
  // Sending {} clears them. Requires supabase/jd_translations.sql — if the
  // column is missing we retry without it below rather than failing the save.
  if (body.translations !== undefined) {
    const t = sanitiseTranslations(body.translations)
    if (t !== null) updates.translations = t
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Guard salary range if both present after the update
  const min = updates.salary_min ?? ctx.role.salary_min
  const max = updates.salary_max ?? ctx.role.salary_max
  if (min != null && max != null && Number(min) >= Number(max)) {
    return NextResponse.json({ error: 'Salary max must be greater than min' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  let { data: role, error } = await supabase
    .from('roles')
    .update(updates)
    .eq('id', id)
    .eq('company_id', ctx.user.id)
    .select()
    .single()

  // Graceful degradation: translations column missing (migration not run yet)
  if (error && 'translations' in updates && /translations/i.test(error.message)) {
    console.warn('[company/roles/:id] translations column missing — run supabase/jd_translations.sql. Saving without translations.')
    delete updates.translations
    if (Object.keys(updates).length > 1) { // more than just updated_at
      ;({ data: role, error } = await supabase
        .from('roles')
        .update(updates)
        .eq('id', id)
        .eq('company_id', ctx.user.id)
        .select()
        .single())
    } else {
      return NextResponse.json({ error: 'Translations could not be saved — database migration pending (supabase/jd_translations.sql)' }, { status: 500 })
    }
  }

  if (error) {
    console.error('[company/roles/:id] update error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ role })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getOwnedRole(id)
  if (ctx.error) return ctx.error
  const { supabase } = ctx

  const { error } = await supabase
    .from('roles')
    .delete()
    .eq('id', id)
    .eq('company_id', ctx.user.id)

  if (error) {
    console.error('[company/roles/:id] delete error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
