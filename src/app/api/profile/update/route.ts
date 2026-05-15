import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendWhatsApp, OPENING_MESSAGE, NO_CV_MESSAGE } from '@/lib/whatsapp'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Upsert using admin client (bypasses RLS — user already verified above)
  const admin = createAdminClient()
  const { error } = await admin
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
    const { data: profile } = await admin
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
        await admin
          .from('profiles')
          .update({ whatsapp_conversation_active: true })
          .eq('id', user.id)
      }
    }
  }

  return NextResponse.json({ success: true })
}
