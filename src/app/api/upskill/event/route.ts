// POST /api/upskill/event — set a candidate's status on a roadmap event
// (interested → booked → attended / not_attended). Upserts by event name.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID = ['interested', 'booked', 'attended', 'not_attended']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { event_name, event_when, event_where, event_url, status } = body as Record<string, string | undefined>

  if (!event_name) return NextResponse.json({ error: 'event_name required' }, { status: 400 })
  const effectiveStatus = status && VALID.includes(status) ? status : 'interested'

  // Upsert on (candidate_id, event_name)
  const { error } = await supabase
    .from('candidate_events')
    .upsert({
      candidate_id: user.id,
      event_name,
      event_when: event_when ?? null,
      event_where: event_where ?? null,
      event_url: event_url ?? null,
      status: effectiveStatus,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'candidate_id,event_name' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, status: effectiveStatus })
}
