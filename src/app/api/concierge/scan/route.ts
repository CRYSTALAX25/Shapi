// Concierge scanner endpoint.
//
//   POST /api/concierge/scan          → authenticated: scan for the calling candidate
//   POST /api/concierge/scan?all=1    → cron-only: scan for every Concierge subscriber
//                                       (requires CRON_SECRET header)
//
// Drafts land in concierge_queue with status='pending_approval' (or
// 'auto_send' if the candidate opted in). The candidate dashboard reads
// the queue and surfaces today's drafts.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runConciergeScanForCandidate, runConciergeScanForAll } from '@/lib/concierge'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const url = new URL(request.url)
  const isCron = url.searchParams.get('all') === '1'

  if (isCron) {
    // Lightweight shared secret to gate the cron path. Vercel cron sets the
    // `Authorization: Bearer <CRON_SECRET>` header (or you can curl manually).
    const auth = request.headers.get('authorization') || ''
    const expected = `Bearer ${process.env.CRON_SECRET || ''}`
    if (!process.env.CRON_SECRET || auth !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const result = await runConciergeScanForAll()
    return NextResponse.json({ ok: true, ...result })
  }

  // Authenticated single-candidate scan (manual "Refresh my queue" button)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Gate: must have concierge_monthly subscription
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_product')
    .eq('id', user.id)
    .single()
  const subs: string[] = Array.isArray(profile?.subscription_product) ? profile.subscription_product : []
  if (!subs.includes('concierge_monthly')) {
    return NextResponse.json({ error: 'Concierge subscription required' }, { status: 403 })
  }

  const result = await runConciergeScanForCandidate(user.id)
  return NextResponse.json({ ok: true, ...result })
}
