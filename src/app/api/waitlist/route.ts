import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const { email, type } = await request.json()

  if (!email || !type) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { error } = await supabase
    .from('waitlist')
    .insert({ email, type })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already on waitlist' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to join' }, { status: 500 })
  }

  // Send confirmation email (non-blocking)
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const subject = type === 'candidate'
      ? "You're on the Shapi waitlist"
      : "Shapi — your company is on the list"

    const body = type === 'candidate'
      ? `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 20px">
          <p style="font-size:24px;font-weight:700;color:#0B5563;margin-bottom:8px">Shape what's next.</p>
          <p style="color:#1C1C2E;font-size:16px;line-height:1.6">You're on the Shapi early access list. We'll reach out before our UAE launch in May 2026.</p>
          <p style="color:#1C1C2E;font-size:16px;line-height:1.6">As one of the first 50 candidates, you'll get early access to build your verified profile before we open to the public.</p>
          <p style="color:#1C1C2E/60;font-size:14px;margin-top:32px">The Shapi team<br><a href="https://shapi.io" style="color:#0B5563">shapi.io</a></p>
        </div>`
      : `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 20px">
          <p style="font-size:24px;font-weight:700;color:#0B5563;margin-bottom:8px">Shape what's next.</p>
          <p style="color:#1C1C2E;font-size:16px;line-height:1.6">Your company is on the Shapi early access list. As one of the first 5 companies, you get <strong>60 days free</strong> when we launch in UAE — May 2026.</p>
          <p style="color:#1C1C2E;font-size:16px;line-height:1.6">We'll be in touch with details before launch. You're helping shape what verified hiring looks like in the region.</p>
          <p style="color:#1C1C2E/60;font-size:14px;margin-top:32px">The Shapi team<br><a href="https://shapi.io" style="color:#0B5563">shapi.io</a></p>
        </div>`

    await resend.emails.send({
      from: 'Shapi <hello@shapi.io>',
      to: email,
      subject,
      html: body,
    }).catch(() => {}) // don't fail the request if email fails
  }

  return NextResponse.json({ success: true })
}
