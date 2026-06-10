import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsApp, OPENING_MESSAGE, NO_CV_MESSAGE } from '@/lib/whatsapp'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // SECURITY: strip billing / entitlement / system columns from the client
  // body. RLS scopes the row to auth.uid()=id, so without this allow-strip a
  // candidate could POST { paid:true, plan_tier:'enterprise', ... } and grant
  // themselves entitlements, bypassing Stripe. These fields are only ever set
  // server-side (Stripe webhook, reference cascade, admin). Deny-list, not
  // allow-list, so legitimate profile fields across candidate+company flows
  // keep working.
  const PROTECTED_FIELDS = [
    'id', 'created_at', 'paid', 'plan_tier', 'subscription_status',
    'subscription_product', 'trial_ends_at', 'grace_expired',
    'stripe_customer_id', 'stripe_subscription_id', 'cv_kit_purchased',
    'cv_pro_purchased', 'profile_boost_purchased', 'verification_tier',
    'bespoke_config', 'upload_and_map_count', 'is_admin',
  ] as const
  for (const f of PROTECTED_FIELDS) {
    if (f in body) delete body[f]
  }

  // Normalise WhatsApp number — strip spaces so +966 50 250 6355 → +966502506355
  if (body.whatsapp_number) {
    body.whatsapp_number = (body.whatsapp_number as string).replace(/\s+/g, '').trim()
  }

  // Upsert profile
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, ...body, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )

  if (error) {
    console.error('[profile/update] Upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Read-back verification — confirm the upsert actually landed before the
  // client can clear its localStorage draft. Without this confirmation the
  // client used to assume "no error = saved" which left the draft in limbo
  // if RLS silently filtered the write. We return the persisted onboarding
  // state so the client knows it's safe to drop the local copy.
  const { data: saved } = await supabase
    .from('profiles')
    .select('id, type, company_name, company_website, company_size, location, summary, whatsapp_number, onboarding_complete, completion_pct')
    .eq('id', user.id)
    .single()

  console.log('[profile/update] Saved for user:', user.id, 'fields:', Object.keys(body).join(','))

  // Send opening WhatsApp message when a number is saved for the FIRST TIME ever.
  // Gate: only send when whatsapp_chat is empty. Once any conversation exists
  // (active OR completed), the candidate has already seen the opening — never
  // re-send. Previous check used conversation_active which was false after
  // [DONE], causing the opening to re-fire on any subsequent profile edit.
  if (body.whatsapp_number) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, whatsapp_conversation_active, cv_parsed, whatsapp_chat')
      .eq('id', user.id)
      .single()

    const chatLength = Array.isArray(profile?.whatsapp_chat) ? profile.whatsapp_chat.length : 0
    const neverChatted = chatLength === 0

    if (neverChatted) {
      const firstName = profile?.full_name?.split(' ')[0] || 'there'
      const message = profile?.cv_parsed
        ? OPENING_MESSAGE(firstName)
        : NO_CV_MESSAGE(firstName)

      const { success } = await sendWhatsApp(body.whatsapp_number, message)

      if (success) {
        await supabase
          .from('profiles')
          .update({ whatsapp_conversation_active: true })
          .eq('id', user.id)
      }
    }
  }

  return NextResponse.json({ success: true, saved })
}
