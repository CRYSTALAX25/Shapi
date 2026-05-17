import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsApp, OPENING_MESSAGE, NO_CV_MESSAGE } from '@/lib/whatsapp'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, whatsapp_number, cv_parsed')
    .eq('id', user.id)
    .single()

  if (!profile?.whatsapp_number) {
    return NextResponse.json({ error: 'No WhatsApp number on profile' }, { status: 400 })
  }

  const firstName = profile.full_name?.split(' ')[0] || 'there'
  const message = profile.cv_parsed ? OPENING_MESSAGE(firstName) : NO_CV_MESSAGE(firstName)

  const { success, error } = await sendWhatsApp(profile.whatsapp_number, message)

  if (success) {
    await supabase
      .from('profiles')
      .update({ whatsapp_conversation_active: true })
      .eq('id', user.id)

    return NextResponse.json({ success: true, sent_to: profile.whatsapp_number })
  }

  return NextResponse.json({ error }, { status: 500 })
}
