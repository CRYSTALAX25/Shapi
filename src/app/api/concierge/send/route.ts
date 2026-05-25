// Concierge outbound delivery worker.
//
//   POST /api/concierge/send            → send all approved, not-yet-sent drafts
//   GET  /api/concierge/send            → same (cron-friendly)
//
// Auth: cron-safe. Pass the shared secret as either
//   - Authorization: Bearer ${CRON_SECRET}, or
//   - ?key=${CRON_SECRET}
// If CRON_SECRET is unset (e.g. local dev), the endpoint is open.
//
// This is the retry / batch path: /api/concierge/approve sends on approval,
// but anything that couldn't go out then (e.g. no company email at the time)
// stays 'approved' and gets picked up here. Batch capped at 25. Never
// double-sends — only 'approved'/'auto_send' rows with no sent_at are touched.

import { NextResponse } from 'next/server'
import { sendPendingConciergeOutreach } from '@/lib/concierge'

export const runtime = 'nodejs'
export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // open if no secret configured (local/dev)
  const auth = request.headers.get('authorization') || ''
  if (auth === `Bearer ${secret}`) return true
  const url = new URL(request.url)
  return url.searchParams.get('key') === secret
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await sendPendingConciergeOutreach(25)
  return NextResponse.json({ ok: true, ...result })
}

export async function POST(request: Request) {
  return handle(request)
}

export async function GET(request: Request) {
  return handle(request)
}
