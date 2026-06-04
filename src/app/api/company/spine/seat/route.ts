import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function requireCompany() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', user.id)
    .single()
  if (!profile || profile.type !== 'company') {
    return { error: NextResponse.json({ error: 'Company account required' }, { status: 403 }) }
  }
  return { supabase, user }
}

export async function POST(request: Request) {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx
  const body = await request.json()
  const {
    title, team_id, seniority, function: fn,
    person_id, status,
    experienced_budget_sar, pivot_budget_sar,
  } = body
  if (!title || !team_id) {
    return NextResponse.json({ error: 'title + team_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('roles_seats')
    .insert({
      company_id: user.id,
      team_id,
      title,
      seniority: seniority || null,
      function: fn || null,
      person_id: person_id || null,
      status: status || (person_id ? 'active' : 'planned'),
      experienced_budget_sar: experienced_budget_sar || null,
      pivot_budget_sar: pivot_budget_sar || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ seat: data })
}

export async function PATCH(request: Request) {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx
  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('roles_seats')
    .update(updates)
    .eq('id', id)
    .eq('company_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ seat: data })
}

export async function DELETE(request: Request) {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('roles_seats')
    .delete()
    .eq('id', id)
    .eq('company_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
