import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// PUBLIC endpoint — the employee confirming their seat has NO login. Auth is
// the unguessable token itself, exactly like /api/references/submit. All DB
// writes run service-role server-side after token lookup.
//
// POST { token, action: 'confirm' | 'dispute', corrections?: { correct_title,
//        correct_team, correct_manager, note } }
//
//   confirm → token status 'confirmed' + seat verification_status='verified',
//             verified_at=now, verified_via=<channel the link went out on>.
//   dispute → token status 'disputed' (corrections saved in response jsonb) +
//             seat verification_status='shapi_assessed' — a signal was
//             received but the seat data is contested.
//
// Re-visits are idempotent: an already-responded token returns its current
// status without rewriting anything.

function channelFromSentVia(sentVia: string | null): 'whatsapp' | 'email' | 'link' {
  if (sentVia?.includes('whatsapp')) return 'whatsapp'
  if (sentVia?.includes('email')) return 'email'
  return 'link'
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const token = typeof body.token === 'string' ? body.token : null
  const action = body.action === 'confirm' || body.action === 'dispute' ? body.action : null
  if (!token || !action) {
    return NextResponse.json({ error: 'token + action required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: row, error } = await admin
    .from('seat_confirmation_tokens')
    .select('id, token, company_id, person_id, seat_id, status, sent_via, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Idempotent re-visit: already responded → report current state, no rewrite.
  if (row.status === 'confirmed' || row.status === 'disputed') {
    return NextResponse.json({ ok: true, status: row.status, already_responded: true })
  }

  const expired = row.status === 'expired' ||
    (row.expires_at ? new Date(row.expires_at).getTime() < Date.now() : false)
  if (expired) {
    // Lazily mark it so future lookups are consistent.
    if (row.status !== 'expired') {
      await admin.from('seat_confirmation_tokens').update({ status: 'expired' }).eq('id', row.id)
    }
    return NextResponse.json({ error: 'Expired' }, { status: 410 })
  }

  const now = new Date().toISOString()

  if (action === 'confirm') {
    const { error: tokErr } = await admin
      .from('seat_confirmation_tokens')
      .update({ status: 'confirmed', responded_at: now })
      .eq('id', row.id)
      .eq('status', 'pending') // race guard — double-tap can't double-write
    if (tokErr) return NextResponse.json({ error: tokErr.message }, { status: 500 })

    if (row.seat_id) {
      const { error: seatErr } = await admin
        .from('roles_seats')
        .update({
          verification_status: 'verified',
          verified_at: now,
          verified_via: channelFromSentVia(row.sent_via),
        })
        .eq('id', row.seat_id)
        .eq('company_id', row.company_id)
      if (seatErr) console.error('[confirm-seat] seat update failed:', seatErr.message)
    }

    // Piggyback the anonymous culture survey onto the seat confirmation — this
    // is how CURRENT employees feed the company trust score (Layer 2). We mint a
    // fresh culture-reference token so they can rate their employer right after
    // confirming. ANONYMOUS by design: the row carries company_id + source only,
    // NO person/seat link, so a response can never be traced back. Only the
    // first confirm mints one (re-visits return early above). Degrades quietly
    // if the culture table isn't present.
    let cultureToken: string | null = null
    try {
      const minted = crypto.randomBytes(32).toString('hex')
      const { error: cErr } = await admin.from('company_culture_references').insert({
        company_id: row.company_id,
        token: minted,
        respondent_type: 'current',
        source: 'seat_confirmation',
      })
      if (cErr) console.error('[confirm-seat] culture token mint failed:', cErr.message)
      else cultureToken = minted
    } catch (e) {
      console.error('[confirm-seat] culture token error:', e)
    }

    return NextResponse.json({ ok: true, status: 'confirmed', cultureToken })
  }

  // action === 'dispute'
  const c = (body.corrections || {}) as Record<string, unknown>
  const corrections = {
    correct_title: typeof c.correct_title === 'string' ? c.correct_title.slice(0, 300) : null,
    correct_team: typeof c.correct_team === 'string' ? c.correct_team.slice(0, 300) : null,
    correct_manager: typeof c.correct_manager === 'string' ? c.correct_manager.slice(0, 300) : null,
    note: typeof c.note === 'string' ? c.note.slice(0, 2000) : null,
  }

  const { error: tokErr } = await admin
    .from('seat_confirmation_tokens')
    .update({ status: 'disputed', responded_at: now, response: corrections })
    .eq('id', row.id)
    .eq('status', 'pending')
  if (tokErr) return NextResponse.json({ error: tokErr.message }, { status: 500 })

  if (row.seat_id) {
    // Signal received but contested → shapi_assessed (amber), never 'verified'.
    const { error: seatErr } = await admin
      .from('roles_seats')
      .update({ verification_status: 'shapi_assessed', verified_at: null, verified_via: null })
      .eq('id', row.seat_id)
      .eq('company_id', row.company_id)
    if (seatErr) console.error('[confirm-seat] seat update failed:', seatErr.message)
  }
  return NextResponse.json({ ok: true, status: 'disputed' })
}
