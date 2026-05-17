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

  console.log('[profile/update] Saved for user:', user.id, 'fields:', Object.keys(body).join(','))

  // Send opening WhatsApp message when a number is saved for the first time
  if (body.whatsapp_number) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, whatsapp_conversation_active, cv_parsed')
      .eq('id', user.id)
      .single()

    if (!profile?.whatsapp_conversation_active) {
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

  return NextResponse.json({ success: true })
}
