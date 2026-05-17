import { createClient } from '@/lib/supabase/server'
import { sendCVLinksEmail } from '@/lib/email'
import { sendWhatsApp } from '@/lib/whatsapp'
import { NextResponse } from 'next/server'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel, showNative, nativeLabel } = await request.json()
  // channel: 'email' | 'whatsapp' | 'both'

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, whatsapp_number, cv_kit_purchased')
    .eq('id', user.id)
    .single()

  if (!profile?.cv_kit_purchased) {
    return NextResponse.json({ error: 'CV kit not purchased' }, { status: 403 })
  }

  const name = (profile.full_name as string) || 'there'
  const firstName = name.split(' ')[0]
  const englishUrl = `${SITE}/profile/print`
  const nativeUrl = `${SITE}/profile/print?lang=native`

  const results: { email?: boolean; whatsapp?: boolean } = {}

  // ── Email ───────────────────────────────────────────────────────────────────
  if (channel === 'email' || channel === 'both') {
    try {
      await sendCVLinksEmail({
        to: user.email!,
        name,
        showNative: !!showNative,
        nativeLabel: nativeLabel || 'Native language',
      })
      results.email = true
    } catch (err) {
      console.error('[cv/send] email failed:', err)
      results.email = false
    }
  }

  // ── WhatsApp ────────────────────────────────────────────────────────────────
  if (channel === 'whatsapp' || channel === 'both') {
    const phone = profile.whatsapp_number as string | null
    if (!phone) {
      results.whatsapp = false
    } else {
      const msg = showNative
        ? `Hi ${firstName} 👋 Your Shapi CVs are ready.\n\n🇬🇧 English CV:\n${englishUrl}\n\n🌐 ${nativeLabel} CV:\n${nativeUrl}\n\nOpen either link → Ctrl+P / pinch-to-print → Save as PDF.`
        : `Hi ${firstName} 👋 Your Shapi CV is ready.\n\n🇬🇧 English CV:\n${englishUrl}\n\nOpen the link → tap the share icon → Print → Save as PDF.`

      const wa = await sendWhatsApp(phone, msg)
      results.whatsapp = wa.success
    }
  }

  return NextResponse.json({ success: true, ...results })
}
