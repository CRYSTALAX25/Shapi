// Status update endpoint for a single staffing recommendation.
// POST /api/company/staffing-recommendations/[id]/status
// Body: { status: 'acted' | 'dismissed' }
//
// Updates the row if and only if company_id matches the authed user.
// Uses the cookie-bound Supabase client so RLS enforces the company_id check.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_STATUSES = new Set(['acted', 'dismissed', 'open'])

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.type !== 'company') {
    return NextResponse.json({ error: 'Company accounts only' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const status = String(body?.status || '').toLowerCase().trim()
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // RLS update policy enforces company_id = auth.uid(), so an attacker can't
  // touch someone else's row even by guessing IDs.
  const { data, error } = await supabase
    .from('staffing_recommendations')
    .update({ status })
    .eq('id', id)
    .eq('company_id', user.id)
    .select('id, status')
    .single()

  if (error) {
    console.error('[staffing-recommendations status] update error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })

  return NextResponse.json({ success: true, recommendation: data })
}
