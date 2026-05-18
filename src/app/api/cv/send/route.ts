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
    .select('full_name, whatsapp_number, cv_kit_purchased, cv_tier')
    .eq('id', user.id)
    .single()

  // Gate: Kit OR Pro
  const hasAccess = !!profile?.cv_kit_purchased || profile?.cv_tier === 'pro'
  if (!hasAccess) {
    return NextResponse.json({ error: 'CV kit not purchased' }, { status: 403 })
  }

  const name = (profile.full_name as string) || 'there'
  const firstName = name.split(' ')[0]
  const englishUrl = `${SITE}/cv-ready`
  const nativeUrl = `${SITE}/cv-ready`

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
      // Direct print-page links for each language — opens straight to the PDF-ready view
      const englishPrintUrl = `${SITE}/profile/print`
      const nativePrintUrl = `${SITE}/profile/print?lang=native`

      const lines: string[] = [
        `Hi ${firstName} 👋 Your Shapi CV is ready.`,
        ``,
        `📄 *English CV*`,
        englishPrintUrl,
      ]
      if (showNative) {
        lines.push(``, `🌐 *${nativeLabel} CV*`, nativePrintUrl)
      }
      lines.push(
        ``,
        `Open in your browser → Save as PDF (Ctrl+P / Cmd+P → Save as PDF).`,
        ``,
        `Full kit (incl. industry-targeted versions): ${englishUrl}`,
      )

      const msg = lines.join('\n')
      const wa = await sendWhatsApp(phone, msg)
      if (!wa.success) {
        console.error('[cv/send] WhatsApp send failed:', wa.error, '| phone:', phone, '| length:', msg.length)
      }
      results.whatsapp = wa.success
    }
  }

  return NextResponse.json({ success: true, ...results })
}
