import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const FIRST_MESSAGE = (name: string) =>
  `Hi ${name} 👋 I'm Shapi. I just read your CV.\n\nI want to build you a profile that actually shows who you are — not just job titles.\n\nQuick question: What's the achievement you're most proud of from the last 3 years? Something that made you think "I actually did that."\n\nText back or leave a voice note — whatever's easier.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to, name, message } = await request.json()

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM // e.g. whatsapp:+14155238886

  if (!accountSid || !authToken || !from) {
    // Twilio not configured yet — log and return gracefully
    console.log('[WhatsApp] Twilio not configured. Would send to:', to)
    return NextResponse.json({ success: true, simulated: true })
  }

  // Normalise phone number to E.164 WhatsApp format
  const cleaned = (to || '').replace(/\s/g, '')
  const recipient = cleaned.startsWith('whatsapp:') ? cleaned : `whatsapp:${cleaned}`

  const body = message || FIRST_MESSAGE(name || 'there')

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: recipient, Body: body }).toString(),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    console.error('[WhatsApp] Twilio error:', err)
    return NextResponse.json({ error: err.message || 'WhatsApp send failed' }, { status: 500 })
  }

  // Mark conversation as active on profile
  await supabase
    .from('profiles')
    .update({ whatsapp_conversation_active: true })
    .eq('id', user.id)

  return NextResponse.json({ success: true })
}
