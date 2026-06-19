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

  const body: Record<string, unknown> = await request.json().catch(() => ({}))

  // The 8 universal dimensions are required; exit_handled is past-only (optional).
  const REQUIRED = ['paid_on_time', 'real_hours', 'manager_quality', 'promise_kept',
    'respect_safety', 'growth', 'fair_treatment', 'would_recommend'] as const

  const ratings: Record<string, number> = {}
  for (const key of REQUIRED) {
    const v = body[key]
    if (!isValidRating(v)) {
      return NextResponse.json({ error: 'Please answer all questions (1–5).' }, { status: 400 })
    }
    ratings[key] = v
  }
  // exit_handled — only stored if a valid rating was sent.
  if (isValidRating(body.exit_handled)) ratings.exit_handled = body.exit_handled

  const text = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
  const periodWorked = text(body.period_worked, 200)
  const improveCulture = text(body.improve_culture, 600)
  const bestThing = text(body.best_thing, 600)

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
      ...ratings,
      improve_culture: improveCulture,
      best_thing: bestThing,
      period_worked: periodWorked,
      consent_ack: true,
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
