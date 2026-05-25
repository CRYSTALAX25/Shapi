import { NextResponse } from 'next/server'
import { runNurtureSweep } from '@/lib/nurture'
import { runConciergeScanForAll, sendPendingConciergeOutreach } from '@/lib/concierge'

// Consolidated daily cron (Vercel Hobby allows only 1-2 daily crons, so this
// single endpoint drives the whole automated pipeline, in order):
//   1. runNurtureSweep()           — 3-part welcome email sequence
//   2. runConciergeScanForAll()    — scan roles, draft + queue outreach,
//                                    nudge candidates with new drafts
//   3. sendPendingConciergeOutreach(25) — fire approved/auto_send drafts
//
// Each step is wrapped in its own try/catch so one failure doesn't kill the
// rest. Cron-safe GET with the same auth guard as the other cron routes.

// Vercel Hobby caps function duration at 60s; Pro allows up to 300s. We request
// 300 here — if the plan can't honour it, Vercel clamps to its max.
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

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const summary: {
    ranAt: string
    nurture: unknown
    conciergeScan: unknown
    conciergeSend: unknown
  } = {
    ranAt: new Date().toISOString(),
    nurture: null,
    conciergeScan: null,
    conciergeSend: null,
  }

  // 1. Welcome nurture sweep
  try {
    summary.nurture = await runNurtureSweep()
  } catch (err) {
    console.error('[cron/daily] nurture sweep failed:', err)
    summary.nurture = { error: String(err) }
  }

  // 2. Concierge scan (drafts + candidate nudges)
  try {
    summary.conciergeScan = await runConciergeScanForAll()
  } catch (err) {
    console.error('[cron/daily] concierge scan failed:', err)
    summary.conciergeScan = { error: String(err) }
  }

  // 3. Send approved Concierge outreach
  try {
    summary.conciergeSend = await sendPendingConciergeOutreach(25)
  } catch (err) {
    console.error('[cron/daily] concierge send failed:', err)
    summary.conciergeSend = { error: String(err) }
  }

  return NextResponse.json({ ok: true, ...summary })
}
