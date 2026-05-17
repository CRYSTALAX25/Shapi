import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('availability_slots')
    .select('id, slot_datetime, duration_mins, status, booked_at')
    .eq('candidate_id', user.id)
    .gte('slot_datetime', new Date().toISOString())
    .order('slot_datetime', { ascending: true })

  return NextResponse.json({ slots: data || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slot_datetime, duration_mins } = await request.json()
  if (!slot_datetime) return NextResponse.json({ error: 'slot_datetime required' }, { status: 400 })

  const { data, error } = await supabase
    .from('availability_slots')
    .insert({ candidate_id: user.id, slot_datetime, duration_mins: duration_mins || 30 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ slot: data })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slot_id } = await request.json()
  await supabase.from('availability_slots').delete()
    .eq('id', slot_id).eq('candidate_id', user.id)

  return NextResponse.json({ success: true })
}
