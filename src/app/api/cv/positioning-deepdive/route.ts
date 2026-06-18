// Starts the Positioning Deep-Dive — the career-wide, axis-driven WhatsApp
// interview that surfaces the proof (incl. off-CV gems) for the Verified
// Positioning CV. Subsequent replies are handled conversationally by the
// WhatsApp webhook via runPositioningTurn().

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/whatsapp'
import { hasProAccess } from '@/lib/subscriptions'
import { buildOpeningMessage } from '@/lib/positioning-deepdive'

export const maxDuration = 30

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, whatsapp_number, cv_tier, subscription_product')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (!hasProAccess(profile)) return NextResponse.json({ error: 'Pro required' }, { status: 403 })
  if (!profile.whatsapp_number) return NextResponse.json({ error: 'WhatsApp number required' }, { status: 400 })

  const opening = buildOpeningMessage(profile)

  // Persist the in-progress state with the opening as the first assistant turn,
  // so the webhook can continue the conversation on the candidate's reply.
  const state = {
    status: 'in_progress' as const,
    chat: [{ role: 'assistant' as const, content: opening }],
    started_at: new Date().toISOString(),
  }
  await supabase.from('profiles').update({ positioning_deepdive: state }).eq('id', user.id)

  const banner = `✨ *Your Shapi deep-dive* — let's find the proof that makes you undeniable.\n\n${opening}\n\n_Anytime: *"pause"* to stop (saved) or *"done"* to wrap up._`
  const wa = await sendWhatsApp(profile.whatsapp_number as string, banner)
  if (!wa.success) {
    return NextResponse.json(
      { success: false, whatsapp_failed: true, opening, error: `WhatsApp delivery failed (${wa.error || 'unknown'}). You can answer here instead.` },
      { status: 200 },
    )
  }

  return NextResponse.json({ success: true })
}
