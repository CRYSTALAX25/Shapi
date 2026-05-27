import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Anti-stuffing: if a company accumulates more than this many flagged
// submissions in 24h, any new submission to that company is also flagged.
const FLAGGED_24H_LIMIT = 5

function getSubmitIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip') || null
}

function isValidRating(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  let body: {
    paid_on_time?: unknown
    real_hours?: unknown
    manager_quality?: unknown
    period_worked?: unknown
    notes?: unknown
  } = {}
  try { body = await request.json() } catch {}

  const paid = body.paid_on_time
  const hours = body.real_hours
  const mgr = body.manager_quality

  if (!isValidRating(paid) || !isValidRating(hours) || !isValidRating(mgr)) {
    return NextResponse.json(
      { error: 'Ratings must be integers 1–5 on all three questions.' },
      { status: 400 },
    )
  }

  const periodWorked =
    typeof body.period_worked === 'string' && body.period_worked.trim()
      ? body.period_worked.trim().slice(0, 200)
      : null
  const notes =
    typeof body.notes === 'string' && body.notes.trim()
      ? body.notes.trim().slice(0, 600)
      : null

  const admin = createAdminClient()

  const { data: row, error: fetchError } = await admin
    .from('company_culture_references')
    .select('id, company_id, invite_ip, submitted_at')
    .eq('token', token)
    .maybeSingle()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Invalid link.' }, { status: 404 })
  }

  if (row.submitted_at) {
    // Single-use: 410 Gone tells the client the resource is no longer usable.
    return NextResponse.json({ error: 'This link has already been used.' }, { status: 410 })
  }

  const submitIp = getSubmitIp(request.headers)

  // ── Anti-manipulation ───────────────────────────────────────────────────
  // (1) Same machine sent the invite AND submitted the response → flag.
  let flagged = false
  if (submitIp && row.invite_ip && submitIp === String(row.invite_ip)) {
    flagged = true
  }

  // (2) Stuffing window: if this company already has > 5 flagged submissions
  //     in the last 24h, this one is suspect too.
  if (!flagged) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: flaggedCount } = await admin
      .from('company_culture_references')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', row.company_id)
      .eq('flagged', true)
      .gte('submitted_at', since)

    if ((flaggedCount ?? 0) > FLAGGED_24H_LIMIT) {
      flagged = true
    }
  }

  const { error: updateError } = await admin
    .from('company_culture_references')
    .update({
      paid_on_time: paid,
      real_hours: hours,
      manager_quality: mgr,
      notes,
      period_worked: periodWorked,
      submitted_at: new Date().toISOString(),
      submit_ip: submitIp,
      flagged,
    })
    .eq('id', row.id)
    .is('submitted_at', null) // race-safety: only update if still pending

  if (updateError) {
    console.error('[culture/submit] update', updateError.message)
    return NextResponse.json({ error: 'Could not record response.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
