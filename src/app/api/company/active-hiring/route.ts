// Company-side Active Hiring queue: list the daily AI-shortlist + drafted
// outreach, and approve (→ sends) or dismiss with one tap.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendApprovedActiveHiringOutreach, runActiveHiringScanForCompany } from '@/lib/active-hiring'

export const maxDuration = 30

// GET — the pending shortlist for the signed-in company (enriched with candidate
// name + role title).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rows } = await supabase
    .from('active_hiring_queue')
    .select('id, role_id, candidate_id, match_score, match_reasons, draft_subject, draft_body, status, created_at')
    .eq('company_id', user.id)
    .eq('status', 'pending_approval')
    .order('match_score', { ascending: false })
    .limit(50)

  const list = rows || []
  if (list.length === 0) return NextResponse.json({ items: [] })

  const admin = createAdminClient()
  const candidateIds = [...new Set(list.map(r => r.candidate_id as string))]
  const roleIds = [...new Set(list.map(r => r.role_id as string))]
  const [{ data: cands }, { data: roles }] = await Promise.all([
    admin.from('profiles').select('id, full_name, headline, verification_tier').in('id', candidateIds),
    admin.from('roles').select('id, title').in('id', roleIds),
  ])
  const candMap = new Map((cands || []).map(c => [c.id, c]))
  const roleMap = new Map((roles || []).map(r => [r.id, r.title]))

  const items = list.map(r => ({
    id: r.id,
    matchScore: r.match_score,
    matchReasons: r.match_reasons,
    draftSubject: r.draft_subject,
    draftBody: r.draft_body,
    roleTitle: roleMap.get(r.role_id) || 'a role',
    candidateName: candMap.get(r.candidate_id)?.full_name || 'A candidate',
    candidateHeadline: candMap.get(r.candidate_id)?.headline || '',
    candidateTier: candMap.get(r.candidate_id)?.verification_tier || 'unverified',
  }))
  return NextResponse.json({ items })
}

// POST { id, action: 'approve' | 'dismiss' }. Approve flips to 'approved' and
// immediately flushes the send; dismiss flips to 'dismissed'.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, action } = await request.json().catch(() => ({}))

  // Manual "find matches now" — runs the shortlist scan for this company.
  if (action === 'scan') {
    try {
      const result = await runActiveHiringScanForCompany(user.id)
      return NextResponse.json({ ok: true, ...result })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Scan failed' }, { status: 500 })
    }
  }

  if (!id || (action !== 'approve' && action !== 'dismiss')) {
    return NextResponse.json({ error: 'id and action (approve|dismiss|scan) required' }, { status: 400 })
  }

  // RLS scopes the update to rows the company owns.
  const next = action === 'approve' ? 'approved' : 'dismissed'
  const { error } = await supabase
    .from('active_hiring_queue')
    .update({ status: next, approved_at: action === 'approve' ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // One-tap approve → send it now (the sender picks up approved rows).
  if (action === 'approve') {
    try { await sendApprovedActiveHiringOutreach(5) } catch (e) { console.error('[active-hiring] flush failed:', e) }
  }
  return NextResponse.json({ ok: true })
}
