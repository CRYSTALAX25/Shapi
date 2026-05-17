import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { outcome, company_id, role_id, reported_by } = await request.json()
  // outcome: 'interview' | 'offer' | 'hired' | 'rejected' | 'no_response'

  const { error } = await supabase
    .from('match_outcomes')
    .insert({
      candidate_id: user.id,
      company_id: company_id || null,
      role_id: role_id || null,
      outcome,
      reported_by: reported_by || 'candidate',
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If hired — update profile
  if (outcome === 'hired') {
    await supabase.from('profiles').update({ completion_pct: 100 }).eq('id', user.id)
  }

  return NextResponse.json({ success: true })
}
