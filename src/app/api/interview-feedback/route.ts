// Two-sided post-interview feedback. Each side writes its own row (author set
// from the caller's profile type). Feeds company trust score / candidate
// reliability downstream.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { role_id, rating, move_forward, notes } = body
  if (!role_id) return NextResponse.json({ error: 'role_id required' }, { status: 400 })
  if (rating != null && (rating < 1 || rating > 5)) return NextResponse.json({ error: 'rating must be 1-5' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('type').eq('id', user.id).single()
  const { data: role } = await supabase.from('roles').select('id, company_id').eq('id', role_id).single()
  if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })

  const isCompany = profile?.type === 'company'
  if (isCompany && role.company_id !== user.id) return NextResponse.json({ error: 'Not your role' }, { status: 403 })

  const candidate_id = isCompany ? body.candidate_id : user.id
  if (!candidate_id) return NextResponse.json({ error: 'candidate_id required' }, { status: 400 })

  const row = {
    candidate_id,
    role_id,
    company_id: role.company_id,
    author: isCompany ? 'company' : 'candidate',
    rating: rating ?? null,
    move_forward: move_forward ?? null,
    notes: (notes || '').trim() || null,
  }

  const { data, error } = await supabase
    .from('interview_feedback')
    .upsert(row, { onConflict: 'candidate_id,role_id,author' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feedback: data })
}
