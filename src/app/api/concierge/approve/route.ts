// Approve / decline a Concierge draft.
//
//   POST /api/concierge/approve  { draftId, action: 'approve' | 'decline' | 'edit', body? }
//
// On 'approve': flips status to 'approved' (the actual send happens in a
// downstream worker that we'll wire next — for now, approval just stages it).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { draftId, action, body: editedBody, subject: editedSubject } = body as {
    draftId?: string
    action?: 'approve' | 'decline' | 'edit'
    body?: string
    subject?: string
  }
  if (!draftId || !action) {
    return NextResponse.json({ error: 'Missing draftId or action' }, { status: 400 })
  }

  // Ownership check + fetch current row
  const { data: draft, error } = await supabase
    .from('concierge_queue')
    .select('id, candidate_id, status')
    .eq('id', draftId)
    .eq('candidate_id', user.id)
    .single()
  if (error || !draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  if (draft.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (action === 'approve') {
    updates.status = 'approved'
    updates.approved_at = new Date().toISOString()
  } else if (action === 'decline') {
    updates.status = 'declined'
    updates.declined_at = new Date().toISOString()
  } else if (action === 'edit') {
    if (editedBody !== undefined) updates.draft_body = editedBody
    if (editedSubject !== undefined) updates.draft_subject = editedSubject
  }

  const { error: updErr } = await supabase
    .from('concierge_queue')
    .update(updates)
    .eq('id', draftId)
    .eq('candidate_id', user.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
