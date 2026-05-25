// Manual reply-capture trigger.
//
//   POST /api/concierge/replied  { draftId }
//
// The candidate taps "✅ They replied — book me in" on their dashboard's
// Concierge card. Owner-scoped: we verify the draft belongs to the signed-in
// candidate, then run the shared handler which flips the row to 'replied',
// auto-proposes an interview, and notifies both sides. Idempotent.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { handleConciergeReply } from '@/lib/concierge'

export const runtime = 'nodejs'
export const maxDuration = 60

// Accepts both JSON ({ draftId }) and HTML form posts (the dashboard button
// uses a plain <form>). Form posts get a redirect back to /dashboard so the
// page re-renders with the new 'replied' state; JSON callers get JSON.
async function readDraftId(request: Request): Promise<{ draftId?: string; isForm: boolean }> {
  const ct = (request.headers.get('content-type') || '').toLowerCase()
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    try {
      const form = await request.formData()
      const v = form.get('draftId')
      return { draftId: typeof v === 'string' ? v : undefined, isForm: true }
    } catch {
      return { isForm: true }
    }
  }
  const body = await request.json().catch(() => ({}))
  return { draftId: (body as { draftId?: string }).draftId, isForm: false }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { draftId, isForm } = await readDraftId(request)
  if (!draftId) return NextResponse.json({ error: 'Missing draftId' }, { status: 400 })

  const dashboardUrl = new URL('/dashboard', request.url)

  // Ownership check — the draft must belong to this candidate, and it must
  // already have gone out (only 'sent'/'auto_send' rows can be "replied to").
  const { data: draft, error } = await supabase
    .from('concierge_queue')
    .select('id, status')
    .eq('id', draftId)
    .eq('candidate_id', user.id)
    .single()
  if (error || !draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  if (draft.status === 'replied') {
    if (isForm) return NextResponse.redirect(dashboardUrl, { status: 303 })
    return NextResponse.json({ ok: true, status: 'replied', already: true })
  }
  if (draft.status !== 'sent' && draft.status !== 'auto_send') {
    return NextResponse.json({ error: `Draft has not been sent yet (status '${draft.status}')` }, { status: 400 })
  }

  const result = await handleConciergeReply(draftId)
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 500 })

  if (isForm) return NextResponse.redirect(dashboardUrl, { status: 303 })
  return NextResponse.json({ ok: true, status: 'replied', interviewId: result.interviewId, already: result.already })
}
