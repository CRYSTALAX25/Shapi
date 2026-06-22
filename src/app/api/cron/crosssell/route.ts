// Cross-sell outreach worker (SPEC_ACTIVE_CROSSSELL §4).
//
// Drives the queued → enrich → cap/suppression check → send pipeline for the
// "Trojan candidate" loop. Can run on its own Vercel schedule, or be triggered
// manually (GET) for testing. Also invoked inline from /api/cron/daily.
//
// Auth mirrors /api/cron/daily exactly: a CRON_SECRET via Bearer header or
// ?key=, and open if no secret is configured (pre-config convenience).

import { createAdminClient } from '@/lib/supabase/admin'
import { processOutreachQueue } from '@/lib/crosssell'
import { NextResponse } from 'next/server'

// Enrichment + send can be slow (external HTTP). Request the Pro 300s ceiling;
// Vercel clamps to the plan max if lower.
export const maxDuration = 300

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  // Pre-config: if no secret is set, allow (so it works before env is added).
  if (!secret) return true
  const header = request.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true
  const url = new URL(request.url)
  if (url.searchParams.get('key') === secret) return true
  return false
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await processOutreachQueue(createAdminClient())
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    console.error('[cron/crosssell] processOutreachQueue failed:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return run(request)
}

// GET allows a manual trigger from a browser/curl during testing.
export async function GET(request: Request) {
  return run(request)
}
