import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

// VERIFIED ORG — mint seat-confirmation magic links.
//
// POST { seat_ids?: uuid[] } (default: ALL occupied seats)
//   TOKEN GUARD — we do NOT blindly re-mint on every click:
//     • seat already verified                → send_status 'already_verified', skip
//     • latest token pending AND unexpired   → send_status 'already_sent',
//       return the EXISTING link + sent date (no new token, nothing re-sent)
//     • never sent / expired / disputed      → mint fresh + send → 'newly_sent'
//   For newly-sent seats we try WhatsApp (persons.whatsapp_number) and email
//   (persons.email) and report per-channel honesty in `channels` — Twilio is
//   on a trial plan (50/day cap) so WhatsApp sends DO fail; the copyable link
//   is always returned so the founder can paste it manually.
//
// GET — verification summary + per-seat latest-token detail (status, channel,
//   sent date, expiry, link) for the canvas status panel.
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

type TokenRow = {
  id: string
  seat_id: string | null
  token: string
  status: string
  sent_via: string | null
  created_at: string
  expires_at: string
}

// Latest token per seat, newest first. Admin client (RLS-exempt) but always
// scoped to company_id = the authenticated company.
async function latestTokensBySeat(
  companyId: string,
  seatIds: string[]
): Promise<{ error?: DbError; bySeat?: Map<string, TokenRow> }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('seat_confirmation_tokens')
    .select('id, seat_id, token, status, sent_via, created_at, expires_at')
    .eq('company_id', companyId)
    .in('seat_id', seatIds)
    .order('created_at', { ascending: false })
  if (error) return { error }
  const bySeat = new Map<string, TokenRow>()
  for (const row of (data || []) as TokenRow[]) {
    if (row.seat_id && !bySeat.has(row.seat_id)) bySeat.set(row.seat_id, row)
  }
  return { bySeat }
}

// ── GET: verification summary + per-seat latest-token detail ─────────────────
export async function GET() {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx

  const { data: seats, error } = await supabase
    .from('roles_seats')
    .select('id, title, person_id, status, verification_status, verified_at, verified_via')
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

  // Per-seat detail for the status panel.
  let details: Array<{
    seat_id: string
    seat_title: string
    person_id: string
    person_name: string
    verification_status: string
    verified_at: string | null
    verified_via: string | null
    latest_token: {
      status: string
      sent_via: string | null
      sent_at: string
      expires_at: string
      link: string
    } | null
  }> = []

  if (occupied.length > 0) {
    const personIds = [...new Set(occupied.map(s => s.person_id as string))]
    const { data: persons } = await supabase
      .from('persons')
      .select('id, full_name, preferred_name')
      .in('id', personIds)
    const personById = Object.fromEntries(
      (persons || []).map(p => [p.id, (p.preferred_name as string | null) || (p.full_name as string)])
    )

    const tok = await latestTokensBySeat(user.id, occupied.map(s => s.id as string))
    // Token table missing but seat columns present shouldn't happen (same
    // migration) — degrade to "no tokens" rather than failing the summary.
    const bySeat = tok.bySeat || new Map<string, TokenRow>()

    details = occupied.map(s => {
      const t = bySeat.get(s.id as string) || null
      return {
        seat_id: s.id as string,
        seat_title: s.title as string,
        person_id: s.person_id as string,
        person_name: personById[s.person_id as string] || 'Unknown',
        verification_status: (s.verification_status as string) || 'self_reported',
        verified_at: (s.verified_at as string | null) || null,
        verified_via: (s.verified_via as string | null) || null,
        latest_token: t
          ? {
              status: t.status,
              sent_via: t.sent_via,
              sent_at: t.created_at,
              expires_at: t.expires_at,
              link: `${SITE}/confirm-seat/${t.token}`,
            }
          : null,
      }
    })
  }

  return NextResponse.json({
    available: true,
    occupied_seats: occupied.length,
    by_status: byStatus,
    verified_pct: verifiedPct,
    seats: details,
  })
}

// ── POST: guarded mint + send ────────────────────────────────────────────────
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

  // TOKEN GUARD — load the latest token per seat up-front so we can skip
  // anything already confirmed or already pending+unexpired.
  const tok = await latestTokensBySeat(user.id, seats.map(s => s.id as string))
  if (tok.error) {
    if (isMigrationMissing(tok.error)) return MIGRATION_409
    return NextResponse.json({ error: tok.error.message }, { status: 500 })
  }
  const latestBySeat = tok.bySeat || new Map<string, TokenRow>()

  const admin = createAdminClient()
  const resendKey = process.env.RESEND_API_KEY || null
  const resend = resendKey ? new Resend(resendKey) : null
  const now = Date.now()

  type Channel = { channel: 'whatsapp' | 'email'; ok: boolean; to: string; error?: string }
  const results: {
    seat_id: string
    seat_title: string
    person_id: string
    person_name: string
    send_status: 'newly_sent' | 'already_sent' | 'already_verified'
    link: string
    sent_via: string[]
    sent_at: string | null
    channels?: Channel[]
    errors?: string[]
  }[] = []

  for (const seat of seats) {
    const person = personById[seat.person_id as string]
    if (!person) continue
    const personName = person.preferred_name || person.full_name
    const firstName = (personName || '').trim().split(' ')[0] || 'there'
    const teamName = teamById[seat.team_id as string]?.name || null
    const base = {
      seat_id: seat.id as string,
      seat_title: seat.title as string,
      person_id: person.id as string,
      person_name: personName as string,
    }

    // 1. Seat already confirmed by the employee — nothing to send.
    if (seat.verification_status === 'verified') {
      results.push({ ...base, send_status: 'already_verified', link: '', sent_via: [], sent_at: null })
      continue
    }

    // 2. A pending, unexpired link already exists — return it, don't re-mint.
    const latest = latestBySeat.get(seat.id as string)
    if (latest && latest.status === 'pending' && Date.parse(latest.expires_at) > now) {
      results.push({
        ...base,
        send_status: 'already_sent',
        link: `${SITE}/confirm-seat/${latest.token}`,
        sent_via: latest.sent_via && latest.sent_via !== 'link' ? latest.sent_via.split('+') : [],
        sent_at: latest.created_at,
      })
      continue
    }

    // 3. Never sent / expired / disputed → mint fresh + send.
    //    Belt + suspenders: expire any stale pending rows (e.g. pending but
    //    past expires_at) so exactly one live link exists per seat.
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
        ...base,
        send_status: 'newly_sent',
        link: '',
        sent_via: [],
        sent_at: null,
        errors: [tokenErr?.message || 'Token mint failed'],
      })
      continue
    }

    const link = `${SITE}/confirm-seat/${tokenRow.token}`
    const sentVia: string[] = []
    const errors: string[] = []
    const channels: Channel[] = []

    // a. WhatsApp first — degrades gracefully when Twilio creds are absent.
    if (person.whatsapp_number) {
      const msg =
        `Hi ${firstName} 👋 ${companyName} uses Shapi to keep a verified org chart.\n\n` +
        `Can you confirm your role — *${seat.title}*${teamName ? ` on ${teamName}` : ''}? ` +
        `Takes 10 seconds, no login:\n${link}`
      const wa = await sendWhatsApp(person.whatsapp_number, msg)
      if (wa.success) {
        sentVia.push('whatsapp')
        channels.push({ channel: 'whatsapp', ok: true, to: person.whatsapp_number })
      } else {
        if (wa.error) errors.push(`WhatsApp: ${wa.error}`)
        channels.push({ channel: 'whatsapp', ok: false, to: person.whatsapp_number, error: wa.error || 'send failed' })
      }
    }

    // b. Email — belt + suspenders.
    if (person.email && resend) {
      try {
        await resend.emails.send({
          from: FROM,
          to: person.email,
          subject: `${firstName}, confirm your role at ${companyName} (10 seconds)`,
          html: confirmEmailHtml({ firstName, companyName, seatTitle: seat.title, teamName, link }),
        })
        sentVia.push('email')
        channels.push({ channel: 'email', ok: true, to: person.email })
      } catch (err) {
        errors.push(`Email: ${String(err)}`)
        channels.push({ channel: 'email', ok: false, to: person.email, error: String(err) })
      }
    } else if (person.email && !resend) {
      errors.push('Email: RESEND_API_KEY not set')
      channels.push({ channel: 'email', ok: false, to: person.email, error: 'RESEND_API_KEY not set' })
    }

    // Record what actually went out. 'link' = copyable link only (the founder
    // pastes it manually — the Twilio-trial fallback path).
    await admin
      .from('seat_confirmation_tokens')
      .update({ sent_via: sentVia.length > 0 ? sentVia.join('+') : 'link' })
      .eq('id', tokenRow.id)

    results.push({
      ...base,
      send_status: 'newly_sent',
      link,
      sent_via: sentVia,
      sent_at: new Date().toISOString(),
      channels,
      ...(errors.length > 0 ? { errors } : {}),
    })
  }

  return NextResponse.json({
    results,
    summary: {
      total: results.length,
      newly_sent: results.filter(r => r.send_status === 'newly_sent').length,
      already_sent: results.filter(r => r.send_status === 'already_sent').length,
      already_verified: results.filter(r => r.send_status === 'already_verified').length,
      whatsapp: results.filter(r => r.sent_via.includes('whatsapp')).length,
      email: results.filter(r => r.sent_via.includes('email')).length,
      link_only: results.filter(r => r.send_status === 'newly_sent' && r.sent_via.length === 0 && r.link).length,
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
