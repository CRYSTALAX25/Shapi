// Schedule / update an interview (company only). Scheduling also advances the
// application to the 'interviewing' stage. Candidates read interviews via pages.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const PLATFORMS = ['google_meet', 'zoom', 'teams', 'in_person', 'other']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('type').eq('id', user.id).single()
  if (profile?.type !== 'company') return NextResponse.json({ error: 'Company account required' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { role_id, candidate_id, scheduled_at, video_platform, meeting_link, location, status } = body
  if (!role_id || !candidate_id) return NextResponse.json({ error: 'role_id and candidate_id required' }, { status: 400 })

  const { data: role } = await supabase.from('roles').select('id, company_id').eq('id', role_id).single()
  if (!role || role.company_id !== user.id) return NextResponse.json({ error: 'Not your role' }, { status: 403 })

  const row: Record<string, unknown> = { candidate_id, role_id, company_id: user.id }
  if (scheduled_at !== undefined) row.scheduled_at = scheduled_at || null
  if (video_platform !== undefined) row.video_platform = PLATFORMS.includes(video_platform) ? video_platform : 'other'
  if (meeting_link !== undefined) row.meeting_link = meeting_link || null
  if (location !== undefined) row.location = location || null
  if (status !== undefined) row.status = status

  const { data, error } = await supabase
    .from('interviews')
    .upsert(row, { onConflict: 'candidate_id,role_id' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Advance the application to 'interviewing' (don't move backwards from offer/hired)
  const { data: app } = await supabase
    .from('applications').select('id, stage').eq('candidate_id', candidate_id).eq('role_id', role_id).maybeSingle()
  if (app && ['matched', 'shortlisted'].includes(app.stage)) {
    await supabase.from('applications').update({ stage: 'interviewing' }).eq('id', app.id)
  }

  return NextResponse.json({ interview: data })
}
