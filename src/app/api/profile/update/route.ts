import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const { error } = await supabase
    .from('profiles')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // When a WhatsApp number is saved for the first time, send the opening message
  if (body.whatsapp_number) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, whatsapp_conversation_active')
      .eq('id', user.id)
      .single()

    // Only send if conversation hasn't already started
    if (!profile?.whatsapp_conversation_active) {
      const firstName = profile?.full_name?.split(' ')[0] || 'there'

      // Fire-and-forget — don't block the response
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://shapi.io'}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: request.headers.get('cookie') || '' },
        body: JSON.stringify({
          to: body.whatsapp_number,
          name: firstName,
        }),
      }).catch(err => console.error('[WhatsApp] profile/update trigger failed:', err))
    }
  }

  return NextResponse.json({ success: true })
}
