import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp, sendWhatsAppMedia } from '@/lib/whatsapp'
import { generateBundledPdf, type CVSelection, labelForSelection } from '@/lib/cv-pdf-bundle'
import { signBundlePayload } from '@/app/api/cv/pdf-bundle/route'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'
export const maxDuration = 60

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set')
  return new Resend(process.env.RESEND_API_KEY)
}

function selectionToToken(sel: CVSelection): string {
  if (sel.type === 'universal') return 'u'
  if (sel.type === 'industry') return `i:${sel.value.toLowerCase()}`
  return sel.value.toLowerCase() === 'english' ? 'english' : sel.value
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const channel: 'email' | 'whatsapp' | 'both' = body.channel || 'email'
  // selections is an array of { type, value } objects describing which CVs to send.
  // Defaults to English only if missing/empty (the safe default).
  let selections: CVSelection[] = Array.isArray(body.selections) && body.selections.length > 0
    ? body.selections
    : [{ type: 'language', value: 'english' }]
  // Dedupe + cap to 8 to avoid abuse
  const seen = new Set<string>()
  selections = selections.filter(s => {
    const key = `${s.type}:${s.value.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 8)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, whatsapp_number, cv_kit_purchased, cv_tier')
    .eq('id', user.id)
    .single()

  // Gate: Kit OR Pro
  const hasAccess = !!profile?.cv_kit_purchased || profile?.cv_tier === 'pro'
  if (!hasAccess) return NextResponse.json({ error: 'CV kit not purchased' }, { status: 403 })

  const name = (profile.full_name as string) || 'there'
  const firstName = name.split(' ')[0]

  // Generate the bundled PDF once — used for both email attachment + WhatsApp URL signing.
  // (Email gets the actual buffer attached; WhatsApp gets a signed URL pointing to
  // the public /api/cv/pdf-bundle endpoint that re-generates on Twilio's fetch.)
  let pdfBuffer: Buffer | null = null
  let rendered: CVSelection[] = []
  let missing: CVSelection[] = []
  try {
    const result = await generateBundledPdf(user.id, selections)
    pdfBuffer = result.buffer
    rendered = result.rendered
    missing = result.missing
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cv/send] bundle generation failed:', msg)
    return NextResponse.json({ error: `Could not generate PDFs: ${msg}` }, { status: 500 })
  }

  if (rendered.length === 0) {
    return NextResponse.json({
      error: 'None of the selected CVs are cached yet. Visit /cv-ready and open each version once to generate them, then try Send again.',
      missing: missing.map(m => m.value),
    }, { status: 400 })
  }

  const renderedLabels = rendered.map(labelForSelection)
  const versionTag = rendered.length === 1 ? rendered[0].value : `${rendered.length}_versions`
  const safeName = name.replace(/\s+/g, '_')
  const attachmentFilename = `${safeName}_${versionTag}_CV.pdf`

  const results: { email?: boolean; whatsapp?: boolean; rendered: string[]; missing: string[] } = {
    rendered: renderedLabels,
    missing: missing.map(labelForSelection),
  }

  // ── Email — attach the merged PDF directly via Resend ───────────────────
  if (channel === 'email' || channel === 'both') {
    try {
      const summary = rendered.length === 1
        ? `Your ${renderedLabels[0]} CV is attached.`
        : `${rendered.length} CV versions are attached in one PDF: ${renderedLabels.join(', ')}.`

      await getResend().emails.send({
        from: 'Shapi <hello@shapi.io>',
        to: user.email!,
        subject: rendered.length === 1
          ? `Your ${renderedLabels[0]} CV — Shapi`
          : `Your Shapi CVs (${rendered.length} versions)`,
        html: `<!doctype html><html><body style="background:#060609;font-family:system-ui;margin:0;padding:40px 24px">
          <div style="max-width:540px;margin:0 auto;background:#0D0C14;border:1px solid rgba(157, 140, 255, 0.15);border-radius:16px;padding:32px;color:white">
            <h1 style="font-size:22px;font-weight:900;margin:0 0 14px">Your CV is ready, ${firstName}.</h1>
            <p style="color:rgba(255,255,255,0.65);font-size:15px;line-height:1.6;margin:0 0 16px">${summary}</p>
            <p style="color:rgba(255,255,255,0.45);font-size:13px;line-height:1.6;margin:0">Open the attachment to view + share with hiring managers. You can re-generate or download any other versions anytime at <a href="${SITE}/cv-ready" style="color:#9D8CFF">shapi.io/cv-ready</a>.</p>
            ${missing.length > 0 ? `<p style="color:rgba(255,255,255,0.4);font-size:12px;margin-top:16px">Note: ${missing.length} version${missing.length > 1 ? 's were' : ' was'} skipped (not yet generated): ${missing.map(labelForSelection).join(', ')}. Visit cv-ready to generate them first.</p>` : ''}
          </div>
        </body></html>`,
        attachments: [{
          filename: attachmentFilename,
          content: pdfBuffer,
        }],
      })
      results.email = true
    } catch (err) {
      console.error('[cv/send] email failed:', err)
      results.email = false
    }
  }

  // ── WhatsApp — sign a public URL pointing at /api/cv/pdf-bundle, send via Twilio ────
  if (channel === 'whatsapp' || channel === 'both') {
    const phone = profile.whatsapp_number as string | null
    if (!phone) {
      results.whatsapp = false
    } else {
      const v = rendered.map(selectionToToken).join(',')
      const { sig, expires } = signBundlePayload(user.id, v, 7)
      const pdfUrl = `${SITE}/api/cv/pdf-bundle?uid=${user.id}&v=${encodeURIComponent(v)}&exp=${expires}&sig=${sig}`

      const captionLines: string[] = [
        `Hi ${firstName} 👋 Your CV is ready.`,
        '',
        rendered.length === 1
          ? `📄 *${renderedLabels[0]} CV* — attached.`
          : `📄 *${rendered.length} CV versions* in one PDF: ${renderedLabels.join(', ')}.`,
        '',
        `Tap the attachment to view + share. Re-download anytime at ${SITE}/cv-ready.`,
      ]
      if (missing.length > 0) {
        captionLines.push('', `_(${missing.length} version${missing.length > 1 ? 's' : ''} skipped — not yet generated: ${missing.map(labelForSelection).join(', ')}.)_`)
      }

      const wa = await sendWhatsAppMedia(phone, captionLines.join('\n'), pdfUrl)
      if (!wa.success) {
        console.error('[cv/send] WhatsApp media send failed:', wa.error)
        // Fallback to text-only message with a link
        const fallback = await sendWhatsApp(phone, `${captionLines.join('\n')}\n\nDirect PDF: ${pdfUrl}`)
        results.whatsapp = fallback.success
      } else {
        results.whatsapp = true
      }
    }
  }

  return NextResponse.json({ success: true, ...results })
}
