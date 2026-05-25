// Inbound email webhook — automated Concierge reply capture.
//
//   POST /api/inbound/email[?key=<INBOUND_SECRET>]
//
// Activates once inbound email is configured (see report). An email provider
// (Resend Inbound, SendGrid Inbound Parse, Postmark, Mailgun routes, etc.)
// POSTs the parsed reply here. We accept a generic payload and normalise the
// common field shapes:
//   recipient: `to` | `recipient` | `To` | envelope.to
//   sender:    `from` | `sender` | `From`
//   subject:   `subject` | `Subject`
//   text:      `text` | `body` | `html` (stripped) | `body-plain`
//
// We extract a token from the recipient address `reply+<token>@<domain>` (or,
// as a fallback, from the subject), look it up against
// concierge_queue.reply_token, and hand off to the shared handler.
//
// Guard: if INBOUND_SECRET is set, the request must pass ?key=<secret> (or an
// Authorization: Bearer <secret> header). If unset, the endpoint is open so it
// works the moment a provider is pointed at it during setup.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleConciergeReply } from '@/lib/concierge'

export const runtime = 'nodejs'
export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = process.env.INBOUND_SECRET
  if (!secret) return true
  const auth = request.headers.get('authorization') || ''
  if (auth === `Bearer ${secret}`) return true
  const url = new URL(request.url)
  return url.searchParams.get('key') === secret
}

// Parse JSON, form-urlencoded, or multipart payloads into a flat record.
async function readPayload(request: Request): Promise<Record<string, unknown>> {
  const ct = (request.headers.get('content-type') || '').toLowerCase()
  try {
    if (ct.includes('application/json')) {
      return (await request.json()) as Record<string, unknown>
    }
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const form = await request.formData()
      const obj: Record<string, unknown> = {}
      for (const [k, v] of form.entries()) obj[k] = typeof v === 'string' ? v : String(v)
      return obj
    }
    // Last resort: try JSON.
    return (await request.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

function firstString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v
    if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim()) return v[0]
  }
  return ''
}

// reply+<token>@domain  →  token. Handles angle brackets, display names, lists.
function extractToken(recipient: string, subject: string): string | null {
  const haystacks = [recipient, subject]
  for (const h of haystacks) {
    if (!h) continue
    const m = h.match(/reply\+([A-Za-z0-9]+)@/i)
    if (m) return m[1]
  }
  return null
}

// Strip HTML tags as a crude text fallback when only `html` is provided.
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|br|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim()
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await readPayload(request)
  const env = (payload.envelope as Record<string, unknown>) || {}

  const recipient = firstString(payload.to, payload.recipient, payload.To, payload.Recipient, env.to)
  const subject = firstString(payload.subject, payload.Subject)
  const htmlRaw = firstString(payload.html, payload.Html, payload['body-html'])
  const text = firstString(
    payload.text,
    payload.Text,
    payload['body-plain'],
    payload.body,
    payload.Body,
    htmlRaw ? stripHtml(htmlRaw) : '',
  )

  const token = extractToken(recipient, subject)
  if (!token) {
    // Nothing to match — ack so the provider doesn't retry forever.
    return NextResponse.json({ ok: true, matched: false, reason: 'no reply token in recipient/subject' })
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('concierge_queue')
    .select('id, status')
    .eq('reply_token', token)
    .single()
  if (!row) {
    return NextResponse.json({ ok: true, matched: false, reason: 'token did not match a draft' })
  }

  const result = await handleConciergeReply(row.id, text || undefined)
  if (!result.ok) {
    return NextResponse.json({ ok: false, matched: true, reason: result.reason }, { status: 500 })
  }
  return NextResponse.json({ ok: true, matched: true, interviewId: result.interviewId, already: result.already })
}

export async function POST(request: Request) {
  return handle(request)
}
