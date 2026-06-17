// GET /api/upskill — returns the candidate's roadmap skill gaps + their tracked
// courses, so the /upskill page can render gaps with tiered options and show
// what they're already taking / have completed.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hasProAccess } from '@/lib/subscriptions'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('cv_tier, subscription_product, career_recommendations')
    .eq('id', user.id)
    .single()

  const isPro = hasProAccess(profile)
  const roadmap = profile?.career_recommendations as {
    skills_gaps?: Array<{ skill: string; priority?: string; why?: string }>
    events_to_attend?: Array<{ name: string; when?: string; where?: string; why?: string; priority?: string }>
  } | null

  const { data: courses } = await supabase
    .from('candidate_courses')
    .select('*')
    .eq('candidate_id', user.id)
    .order('created_at', { ascending: false })

  // Pull all of the candidate's event rows (select * so it's resilient whether or
  // not the photo_url/is_custom migration has been applied yet).
  const { data: eventRows } = await supabase
    .from('candidate_events')
    .select('*')
    .eq('candidate_id', user.id)
  const eventStatus: Record<string, { status: string; event_url: string | null }> = {}
  for (const e of eventRows || []) {
    eventStatus[(e.event_name as string).toLowerCase()] = { status: e.status as string, event_url: (e.event_url as string) ?? null }
  }
  // Recommended events from the roadmap, with the candidate's status overlaid.
  const events = (roadmap?.events_to_attend ?? []).map(e => ({
    ...e,
    status: eventStatus[e.name.toLowerCase()]?.status || 'interested',
  }))
  // Events the candidate added themselves (attended, optional proof photo).
  const custom_events = (eventRows || [])
    .filter(e => e.is_custom)
    .map(e => ({
      name: e.event_name as string,
      when: (e.event_when as string) ?? null,
      where: (e.event_where as string) ?? null,
      status: (e.status as string) ?? 'attended',
      photo_url: (e.photo_url as string) ?? null,
    }))

  return NextResponse.json({
    isPro,
    skill_gaps: roadmap?.skills_gaps ?? [],
    courses: courses ?? [],
    events,
    custom_events,
  })
}
