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
  const { name, country, city, timezone, is_primary } = body
  if (!name || !country) return NextResponse.json({ error: 'name + country required' }, { status: 400 })

  // If marking as primary, unmark any existing primary first.
  if (is_primary) {
    await supabase
      .from('locations')
      .update({ is_primary: false })
      .eq('company_id', user.id)
      .eq('is_primary', true)
  }

  const { data, error } = await supabase
    .from('locations')
    .insert({
      company_id: user.id,
      name,
      country,
      city: city || null,
      timezone: timezone || null,
      is_primary: !!is_primary,
    })
    .select()
    .single()

  if (error) {
    // The free-tier hard gate raises P0001 with hint 'free_tier_location_limit_exceeded'.
    if (error.message?.includes('free_tier_location_limit_exceeded') || error.code === 'P0001') {
      return NextResponse.json({
        error: 'free_tier_location_limit_exceeded',
        message: 'Free tier supports a single location. Upgrade to Pro for multi-location.',
      }, { status: 402 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ location: data })
}

export async function PATCH(request: Request) {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx
  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (updates.is_primary === true) {
    await supabase
      .from('locations')
      .update({ is_primary: false })
      .eq('company_id', user.id)
      .eq('is_primary', true)
  }

  const { data, error } = await supabase
    .from('locations')
    .update(updates)
    .eq('id', id)
    .eq('company_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ location: data })
}

export async function DELETE(request: Request) {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id)
    .eq('company_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
