// Unlock-token claim (SPEC_ACTIVE_CROSSSELL §6 signup hook).
//
// POST { token, company_user_id } — called right after a company finishes
// signup via /signup?type=company&unlock=<token>. Resolves the unlock token,
// links the new company account to the outreach, and reveals the candidate.
//
// Like /api/company/invite/accept, this trusts the passed user_id (the signup
// flow just created it) and runs admin-side — no session required, because the
// caller is the just-created, not-yet-fully-bootstrapped company user.

import { createAdminClient } from '@/lib/supabase/admin'
import { claimUnlock } from '@/lib/crosssell'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  let token: string | undefined
  let company_user_id: string | undefined
  try {
    const body = await request.json()
    token = body?.token
    company_user_id = body?.company_user_id
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!token || !company_user_id) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const result = await claimUnlock(createAdminClient(), {
    token,
    companyUserId: company_user_id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ candidate_id: result.candidateId })
}
