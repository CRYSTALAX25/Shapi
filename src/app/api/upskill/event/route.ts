// POST   /api/upskill/event — set a candidate's status on an event (recommended
//         or self-added), optionally with a proof photo. Upserts by event name.
// DELETE  /api/upskill/event — remove a self-added event by name.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID = ['interested', 'booked', 'attended', 'not_attended']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { event_name, event_when, event_where, event_url, status, photo_url, is_custom } = body as Record<string, unknown>

  if (!event_name || typeof event_name !== 'string') return NextResponse.json({ error: 'event_name required' }, { status: 400 })
  const effectiveStatus = typeof status === 'string' && VALID.includes(status) ? status : 'interested'

  const row: Record<string, unknown> = {
    candidate_id: user.id,
    event_name,
    event_when: (event_when as string) ?? null,
    event_where: (event_where as string) ?? null,
    event_url: (event_url as string) ?? null,
    status: effectiveStatus,
    updated_at: new Date().toISOString(),
  }
  // Only include the new columns when provided, so status toggles keep working
  // even before the photo/is_custom migration has been applied.
  if (photo_url !== undefined) row.photo_url = (photo_url as string) ?? null
  if (is_custom !== undefined) row.is_custom = !!is_custom

  const { error } = await supabase
    .from('candidate_events')
    .upsert(row, { onConflict: 'candidate_id,event_name' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, status: effectiveStatus })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { event_name } = body as Record<string, string | undefined>
  if (!event_name) return NextResponse.json({ error: 'event_name required' }, { status: 400 })

  const { error } = await supabase
    .from('candidate_events')
    .delete()
    .eq('candidate_id', user.id)
    .eq('event_name', event_name)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
