// Pipeline application upsert. Company sets stage + its scorecard on candidates
// for its roles; candidate sets its own scorecard on an opportunity. RLS enforces
// row ownership; this route enforces which fields each side may write.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const STAGES = ['matched', 'shortlisted', 'interviewing', 'offer', 'hired', 'passed']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const role_id = body.role_id
  if (!role_id) return NextResponse.json({ error: 'role_id required' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('type').eq('id', user.id).single()
  const { data: role } = await supabase.from('roles').select('id, company_id').eq('id', role_id).single()
  if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })

  if (profile?.type === 'company') {
    if (role.company_id !== user.id) return NextResponse.json({ error: 'Not your role' }, { status: 403 })
    const { candidate_id, stage, company_scorecard } = body
    if (!candidate_id) return NextResponse.json({ error: 'candidate_id required' }, { status: 400 })
    if (stage && !STAGES.includes(stage)) return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    const row: Record<string, unknown> = { candidate_id, role_id, company_id: user.id }
    if (stage) row.stage = stage
    if (company_scorecard) row.company_scorecard = company_scorecard
    const { data, error } = await supabase
      .from('applications')
      .upsert(row, { onConflict: 'candidate_id,role_id' })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ application: data })
  }

  // Candidate — may only set its own scorecard on the opportunity
  const { candidate_scorecard } = body
  const row: Record<string, unknown> = { candidate_id: user.id, role_id, company_id: role.company_id }
  if (candidate_scorecard) row.candidate_scorecard = candidate_scorecard
  const { data: existing } = await supabase
    .from('applications').select('id').eq('candidate_id', user.id).eq('role_id', role_id).maybeSingle()
  if (!existing) row.stage = 'matched'
  const { data, error } = await supabase
    .from('applications')
    .upsert(row, { onConflict: 'candidate_id,role_id' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ application: data })
}
