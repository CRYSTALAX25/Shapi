// Build (or rebuild) the Verified Positioning CV from whatever we already have —
// the CV alone, or the CV + any deep-dive transcript. Lets candidates who skip
// the WhatsApp interview still get a positioning CV; the deep-dive then enriches
// it with the off-CV proofs a parser can't see.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { hasCVAccess } from '@/lib/subscriptions'
import { runPositioningExtraction } from '@/lib/positioning-deepdive'

export const maxDuration = 30

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('cv_tier, subscription_product, cv_parsed, work_history')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (!hasCVAccess(profile)) return NextResponse.json({ error: 'CV access required' }, { status: 403 })
  const wh = profile.work_history
  if (!profile.cv_parsed && !(Array.isArray(wh) && wh.length > 0)) {
    return NextResponse.json({ error: 'Upload your CV first so we have something to work from.' }, { status: 400 })
  }

  try {
    await runPositioningExtraction(createAdminClient(), user.id)
  } catch (err) {
    console.error('[positioning-generate] failed:', err)
    return NextResponse.json({ error: 'Generation failed — try again in a moment.' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
