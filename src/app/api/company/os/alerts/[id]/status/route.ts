// Status update endpoint for a single Workforce OS alert.
// POST /api/company/os/alerts/[id]/status
// Body: { status: 'acked' | 'resolved' }
//
// Updates the alert row if and only if company_id matches the authed user.
// Uses the cookie-bound Supabase client so RLS enforces the company_id check.
// Stamps acked_at on 'acked' and resolved_at on 'resolved'.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_STATUSES = new Set(['acked', 'resolved', 'open'])

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

  const nowIso = new Date().toISOString()
  const patch: Record<string, string | null> = { status }
  if (status === 'acked') patch.acked_at = nowIso
  if (status === 'resolved') {
    patch.resolved_at = nowIso
    // If acking was skipped, stamp it now too so the audit trail is complete.
    patch.acked_at = nowIso
  }

  // RLS policy enforces company_id = auth.uid(), so an attacker can't touch
  // someone else's alert even by guessing the UUID.
  const { data, error } = await supabase
    .from('workforce_os_alerts')
    .update(patch)
    .eq('id', id)
    .eq('company_id', user.id)
    .select('id, status, acked_at, resolved_at')
    .single()

  if (error) {
    console.error('[company/os alerts status] update error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Alert not found' }, { status: 404 })

  return NextResponse.json({ success: true, alert: data })
}
