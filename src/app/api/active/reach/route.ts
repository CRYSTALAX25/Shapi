// Candidate "Trojan candidate" cross-sell trigger (SPEC_ACTIVE_CROSSSELL §3).
//
//   POST   { active_application_id } → create a crosssell_outreach row (queued)
//          Pro-gated: only Shapi Pro subscribers can ask Shapi to reach a company.
//   GET    → this candidate's own outreach list + statuses
//   DELETE { id } → withdraw a not-yet-sent outreach
//
// All writes to crosssell_outreach go through the admin client (the table is
// service-role-only — RLS has no client policies). Auth is the candidate's
// session; we pass user.id as the candidate_id so a candidate can only ever
// create/withdraw their own outreach.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasProAccess } from '@/lib/subscriptions'
import {
  createOutreach,
  getCandidateOutreach,
  withdrawOutreach,
} from '@/lib/crosssell'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let active_application_id: string | undefined
  try {
    const body = await request.json()
    active_application_id = body?.active_application_id
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!active_application_id) {
    return NextResponse.json({ error: 'active_application_id is required' }, { status: 400 })
  }

  // Pro gate — read the candidate's entitlement the same way other Pro-gated
  // routes do (cv_tier + subscription_product[] off the profile).
  const { data: profile } = await supabase
    .from('profiles')
    .select('cv_tier, subscription_product, paid')
    .eq('id', user.id)
    .single()

  if (!hasProAccess(profile)) {
    return NextResponse.json({ error: 'Shapi Pro required' }, { status: 402 })
  }

  const result = await createOutreach(createAdminClient(), {
    candidateId: user.id,
    activeApplicationId: active_application_id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outreach = await getCandidateOutreach(createAdminClient(), user.id)
  return NextResponse.json({ outreach })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let id: string | undefined
  try {
    const body = await request.json()
    id = body?.id
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const result = await withdrawOutreach(createAdminClient(), { id, candidateId: user.id })
  return NextResponse.json(result)
}
