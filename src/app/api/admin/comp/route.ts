// Admin manual-comp actions — F&F launch lubrication.
// Lets Ana (the only allowed caller) flip product flags on a user without
// going through Stripe checkout. Used to comp Pro, comp a subscription, or
// toggle the legacy paid flag manually.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'ana.vbarber@gmail.com'

type Action =
  | 'comp_pro'              // candidate: cv_tier = 'pro', cv_kit_purchased = true
  | 'comp_kit'              // candidate: cv_tier = 'kit', cv_kit_purchased = true
  | 'uncomp_cv'             // candidate: clear cv_tier + cv_kit_purchased
  | 'comp_active'           // candidate: add 'active_monthly' to subscription_product[]
  | 'comp_concierge'        // candidate: add 'concierge_monthly'
  | 'comp_roles_board'      // candidate: add 'roles_board_monthly'
  | 'uncomp_subscription'   // candidate: clear subscription_product[]
  | 'toggle_paid'           // legacy paid flag
  | 'comp_active_hiring'    // company: add 'active_hiring_monthly'
  | 'set_live'              // candidate: profile_live = true

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const userId = typeof body.user_id === 'string' ? body.user_id : ''
  const action = body.action as Action | undefined
  if (!userId || !action) {
    return NextResponse.json({ error: 'user_id and action required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Read current profile so the array-update actions can read-modify-write.
  const { data: profile, error: readErr } = await admin
    .from('profiles')
    .select('cv_tier, cv_kit_purchased, subscription_product, paid, profile_live')
    .eq('id', userId)
    .single()
  if (readErr || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const currentSubs = Array.isArray(profile.subscription_product) ? profile.subscription_product as string[] : []
  let updates: Record<string, unknown> = {}

  switch (action) {
    case 'comp_pro':
      updates = { cv_tier: 'pro', cv_kit_purchased: true }
      break
    case 'comp_kit':
      updates = { cv_tier: 'kit', cv_kit_purchased: true }
      break
    case 'uncomp_cv':
      updates = { cv_tier: null, cv_kit_purchased: false }
      break
    case 'comp_active':
      updates = { subscription_product: Array.from(new Set([...currentSubs, 'active_monthly'])) }
      break
    case 'comp_concierge':
      updates = { subscription_product: Array.from(new Set([...currentSubs, 'concierge_monthly'])) }
      break
    case 'comp_roles_board':
      updates = { subscription_product: Array.from(new Set([...currentSubs, 'roles_board_monthly'])) }
      break
    case 'comp_active_hiring':
      updates = { subscription_product: Array.from(new Set([...currentSubs, 'active_hiring_monthly'])) }
      break
    case 'uncomp_subscription':
      updates = { subscription_product: [] }
      break
    case 'toggle_paid':
      updates = { paid: !profile.paid }
      break
    case 'set_live':
      updates = { profile_live: true }
      break
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const { error: updErr } = await admin.from('profiles').update(updates).eq('id', userId)
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, action, applied: updates })
}
