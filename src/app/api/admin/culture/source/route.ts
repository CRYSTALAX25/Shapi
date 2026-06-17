import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sourcePastEmployeesFromPool } from '@/lib/culture-sourcing'

// Triggers independent culture sourcing (past employees from our candidate pool).
// SHAPI-SIDE ONLY — never the company itself (independence). Auth = Ana (admin)
// or the cron bearer secret. Body: { companyId?: string }. With companyId we
// source that one company; without, we sweep all company profiles (cron mode).

const ADMIN_EMAIL = 'ana.vbarber@gmail.com'
const MAX_COMPANIES_PER_SWEEP = 25

function isCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function POST(request: Request) {
  // Authorise: cron bearer OR the admin user.
  let authorised = isCron(request)
  if (!authorised) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    authorised = !!user && user.email === ADMIN_EMAIL
  }
  if (!authorised) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body: { companyId?: unknown } = await request.json().catch(() => ({}))
  const admin = createAdminClient()

  // Single company
  if (typeof body.companyId === 'string' && body.companyId) {
    const result = await sourcePastEmployeesFromPool(admin, body.companyId)
    return NextResponse.json({ ok: true, results: [{ companyId: body.companyId, ...result }] })
  }

  // Sweep mode — source for companies that don't yet have enough responses.
  const { data: companies } = await admin
    .from('profiles')
    .select('id')
    .eq('type', 'company')
    .limit(MAX_COMPANIES_PER_SWEEP)

  const results: Array<Record<string, unknown>> = []
  for (const c of companies || []) {
    const result = await sourcePastEmployeesFromPool(admin, c.id as string)
    results.push({ companyId: c.id, ...result })
  }
  return NextResponse.json({ ok: true, swept: results.length, results })
}
