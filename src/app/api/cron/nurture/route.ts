import { NextResponse } from 'next/server'
import { runNurtureSweep } from '@/lib/nurture'

// Vercel cron-safe GET. Walks candidates through the 3-part welcome sequence.
// The send logic lives in src/lib/nurture.ts (runNurtureSweep) so it can be
// shared with the consolidated /api/cron/daily runner. This route is kept so
// existing callers / manual triggers continue to work unchanged.
export const maxDuration = 60

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

  const result = await runNurtureSweep()
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ sent: result.sent, byStage: result.byStage })
}
