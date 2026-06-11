import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

// VERIFIED ORG — mint seat-confirmation magic links.
//
// POST { seat_ids?: uuid[] } (default: ALL occupied seats)
//   For each occupied seat: expire any previous pending token, mint a fresh
//   one, then try WhatsApp (persons.whatsapp_number) and email (persons.email).
//   The copyable link is ALWAYS returned per person — Twilio is on a trial
//   plan (50/day cap) so the founder can paste links manually when sends fail.
//
// GET — verification summary: counts by status + % verified of occupied seats.
//
// GRACEFUL DEGRADE: if the founder hasn't run supabase/verified_org.sql yet,
// POST returns 409 with a clear message; GET returns { available: false }.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'
const FROM = 'Shapi <hello@shapi.io>'

type DbError = { code?: string; message?: string } | null

// 42703 = undefined column (verification_status missing on roles_seats)
// 42P01 = undefined table  (seat_confirmation_tokens missing)
function isMigrationMissing(err: DbError): boolean {
  if (!err) return false
  if (err.code === '42703' || err.code === '42P01') return true
  const msg = err.message || ''
  return /verification_status|seat_confirmation_tokens/i.test(msg) && /(does not exist|could not find|schema cache)/i.test(msg)
}

const MIGRATION_409 = NextResponse.json(
  { error: 'Run supabase/verified_org.sql first', migration: 'supabase/verified_org.sql' },
  { status: 409 }
)

async function requireCompany() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name')
    .eq('id', user.id)
    .single()
  if (!profile || profile.type !== 'company') {
    return { error: NextResponse.json({ error: 'Company account required' }, { status: 403 }) }
  }
  return { supabase, user, companyName: (profile.company_name as string | null) || 'Your company' }
}

// ── GET: verification summary ────────────────────────────────────────────────
export async function GET() {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx

  const { data: seats, error } = await supabase
    .from('roles_seats')
    .select('id, person_id, status, verification_status')
    .eq('company_id', user.id)

  if (error) {
    if (isMigrationMissing(error)) {
      return NextResponse.json({ available: false, message: 'Run supabase/verified_org.sql first' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const occupied = (seats || []).filter(s => s.person_id)
  const byStatus = { self_reported: 0, shapi_assessed: 0, verified: 0 }
  for (const s of occupied) {
    const v = (s.verification_status as keyof typeof byStatus) || 'self_reported'
    if (v in byStatus) byStatus[v] += 1
  }
  const verifiedPct = occupied.length > 0 ? Math.round((byStatus.verified / occupied.length) * 100) : 0

  return NextResponse.json({
    available: true,
    occupied_seats: occupied.length,
    by_status: byStatus,
    verified_pct: verifiedPct,
  })
}

// ── POST: mint tokens + send confirmations ──────────────────────────────────
export async function POST(request: Request) {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user, companyName } = ctx

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const seatIds: string[] | null = Array.isArray(body.seat_ids) && body.seat_ids.length > 0
    ? (body.seat_ids as string[])
    : null

  // Occupied seats only — a vacant seat has nobody to confirm it.
  let seatQuery = supabase
    .from('roles_seats')
    .select('id, title, team_id, person_id, verification_status')
    .eq('company_id', user.id)
    .not('person_id', 'is', null)
  if (seatIds) seatQuery = seatQuery.in('id', seatIds)
  const { data: seats, error: seatErr } = await seatQuery

  if (seatErr) {
    if (isMigrationMissing(seatErr)) return MIGRATION_409
    return NextResponse.json({ error: seatErr.message }, { status: 500 })
  }
  if (!seats || seats.length === 0) {
    return NextResponse.json({ error: 'No occupied seats to verify. Fill some seats first.' }, { status: 400 })
  }

  const personIds = [...new Set(seats.map(s => s.person_id as string))]
  const teamIds = [...new Set(seats.map(s => s.team_id as string))]
  const [{ data: persons }, { data: teams }] = await Promise.all([
    supabase.from('persons').select('id, full_name, preferred_name, email, whatsapp_number').in('id', personIds),
    supabase.from('teams').select('id, name').in('id', teamIds),
  ])
  const personById = Object.fromEntries((persons || []).map(p => [p.id, p]))
  const teamById = Object.fromEntries((teams || []).map(t => [t.id, t]))

  const admin = createAdminClient()
  const resendKey = process.env.RESEND_API_KEY || null
  const resend = resendKey ? new Resend(resendKey) : null

  const results: {
    seat_id: string
    seat_title: string
    person_id: string
    person_name: string
    link: string
    sent_via: string[]
    errors?: string[]
  }[] = []

  for (const seat of seats) {
    const person = personById[seat.person_id as string]
    if (!person) continue
    const personName = person.preferred_name || person.full_name
    const firstName = (personName || '').trim().split(' ')[0] || 'there'
    const teamName = teamById[seat.team_id as string]?.name || null

    // Re-send semantics: expire any previous pending token for this seat so
    // exactly one live link exists per seat at a time.
    const { error: expireErr } = await admin
      .from('seat_confirmation_tokens')
      .update({ status: 'expired' })
      .eq('seat_id', seat.id)
      .eq('status', 'pending')
    if (expireErr && isMigrationMissing(expireErr)) return MIGRATION_409

    const { data: tokenRow, error: tokenErr } = await admin
      .from('seat_confirmation_tokens')
      .insert({ company_id: user.id, person_id: person.id, seat_id: seat.id })
      .select('id, token')
      .single()
    if (tokenErr || !tokenRow) {
      if (isMigrationMissing(tokenErr)) return MIGRATION_409
      results.push({
        seat_id: seat.id, seat_title: seat.title, person_id: person.id,
        person_name: personName, link: '', sent_via: [],
        errors: [tokenErr?.message || 'Token mint failed'],
      })
      continue
    }

    const link = `${SITE}/confirm-seat/${tokenRow.token}`
    const sentVia: string[] = []
    const errors: string[] = []

    // 1. WhatsApp first — degrades gracefully when Twilio creds are absent.
    if (person.whatsapp_number) {
      const msg =
        `Hi ${firstName} 👋 ${companyName} uses Shapi to keep a verified org chart.\n\n` +
        `Can you confirm your role — *${seat.title}*${teamName ? ` on ${teamName}` : ''}? ` +
        `Takes 10 seconds, no login:\n${link}`
      const wa = await sendWhatsApp(person.whatsapp_number, msg)
      if (wa.success) sentVia.push('whatsapp')
      else if (wa.error) errors.push(`WhatsApp: ${wa.error}`)
    }

    // 2. Email — belt + suspenders.
    if (person.email && resend) {
      try {
        await resend.emails.send({
          from: FROM,
          to: person.email,
          subject: `${firstName}, confirm your role at ${companyName} (10 seconds)`,
          html: confirmEmailHtml({ firstName, companyName, seatTitle: seat.title, teamName, link }),
        })
        sentVia.push('email')
      } catch (err) {
        errors.push(`Email: ${String(err)}`)
      }
    } else if (person.email && !resend) {
      errors.push('Email: RESEND_API_KEY not set')
    }

    // Record what actually went out. 'link' = copyable link only (the founder
    // pastes it manually — the Twilio-trial fallback path).
    await admin
      .from('seat_confirmation_tokens')
      .update({ sent_via: sentVia.length > 0 ? sentVia.join('+') : 'link' })
      .eq('id', tokenRow.id)

    results.push({
      seat_id: seat.id, seat_title: seat.title, person_id: person.id,
      person_name: personName, link, sent_via: sentVia,
      ...(errors.length > 0 ? { errors } : {}),
    })
  }

  return NextResponse.json({
    results,
    summary: {
      total: results.length,
      whatsapp: results.filter(r => r.sent_via.includes('whatsapp')).length,
      email: results.filter(r => r.sent_via.includes('email')).length,
      link_only: results.filter(r => r.sent_via.length === 0 && r.link).length,
    },
  })
}

// Minimal brand email — mirrors src/lib/email.ts shell without touching it
// (that file is owned by another lane this wave).
function confirmEmailHtml(opts: {
  firstName: string
  companyName: string
  seatTitle: string
  teamName: string | null
  link: string
}): string {
  const { firstName, companyName, seatTitle, teamName, link } = opts
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060609;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="margin-bottom:32px">
      <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;
                   background:linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A);
                   -webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</span>
    </div>
    <div style="background:#0d0d14;border:1px solid rgba(34,211,238,0.15);border-radius:16px;padding:32px">
      <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 12px">Hi ${firstName}, one quick confirmation.</h1>
      <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 16px">
        ${companyName} uses Shapi to keep a verified org chart. We have you down as:
      </p>
      <div style="background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.12);border-radius:10px;padding:14px 18px;margin:20px 0">
        <p style="color:#22D3EE;font-size:16px;font-weight:900;margin:0">${seatTitle}</p>
        ${teamName ? `<p style="color:rgba(255,255,255,0.45);font-size:13px;margin:4px 0 0">${teamName}</p>` : ''}
      </div>
      <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 16px">
        Is that right? Takes 10 seconds — no account needed.
      </p>
      <a href="${link}" style="display:inline-block;margin-top:8px;padding:14px 28px;
        background:linear-gradient(135deg,#22D3EE,#A78BFA);color:#060609;font-size:14px;
        font-weight:900;border-radius:100px;text-decoration:none">Confirm my role →</a>
    </div>
    <p style="color:rgba(255,255,255,0.2);font-size:12px;margin-top:24px;text-align:center">
      Shapi · Verified workforce intelligence · <a href="${SITE}" style="color:rgba(255,255,255,0.3);text-decoration:none">shapi.io</a>
    </p>
  </div>
</body>
</html>`
}
