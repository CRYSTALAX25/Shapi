// GET /api/upskill — returns the candidate's roadmap skill gaps + their tracked
// courses, so the /upskill page can render gaps with tiered options and show
// what they're already taking / have completed.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('cv_tier, career_recommendations')
    .eq('id', user.id)
    .single()

  const isPro = profile?.cv_tier === 'pro'
  const roadmap = profile?.career_recommendations as {
    skills_gaps?: Array<{ skill: string; priority?: string; why?: string }>
    events_to_attend?: Array<{ name: string; when?: string; where?: string; why?: string; priority?: string }>
  } | null

  const { data: courses } = await supabase
    .from('candidate_courses')
    .select('*')
    .eq('candidate_id', user.id)
    .order('created_at', { ascending: false })

  // Overlay the candidate's tracked status onto each roadmap event
  const { data: eventRows } = await supabase
    .from('candidate_events')
    .select('event_name, status, event_url')
    .eq('candidate_id', user.id)
  const eventStatus: Record<string, { status: string; event_url: string | null }> = {}
  for (const e of eventRows || []) {
    eventStatus[(e.event_name as string).toLowerCase()] = { status: e.status as string, event_url: (e.event_url as string) ?? null }
  }
  const events = (roadmap?.events_to_attend ?? []).map(e => ({
    ...e,
    status: eventStatus[e.name.toLowerCase()]?.status || 'interested',
  }))

  return NextResponse.json({
    isPro,
    skill_gaps: roadmap?.skills_gaps ?? [],
    courses: courses ?? [],
    events,
  })
}
