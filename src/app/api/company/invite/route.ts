import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: company } = await supabase
    .from('profiles')
    .select('type, company_name, full_name')
    .eq('id', user.id)
    .single()

  if (!company || company.type !== 'company') {
    return NextResponse.json({ error: 'Company account required' }, { status: 403 })
  }

  const { email } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const inviteeEmail = email.trim().toLowerCase()
  const companyName = company.company_name || company.full_name || 'your company'

  // Upsert invite record
  const admin = createAdminClient()
  const { data: invite, error } = await admin
    .from('company_members')
    .upsert({
      company_id: user.id,
      email: inviteeEmail,
      invited_by: user.id,
      created_at: new Date().toISOString(),
    }, { onConflict: 'company_id,email' })
    .select()
    .single()

  if (error) {
    console.error('[company/invite]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Send invite email
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const signupUrl = `${SITE}/signup?company_invite=${user.id}&email=${encodeURIComponent(inviteeEmail)}`

    await resend.emails.send({
      from: 'Shapi <hello@shapi.io>',
      to: inviteeEmail,
      subject: `You've been invited to join ${companyName} on Shapi`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#060609;border-radius:16px">
          <p style="font-size:22px;font-weight:900;letter-spacing:-0.5px;margin:0 0 28px;
            background:linear-gradient(135deg, #38BDF8, #34D399);-webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</p>
          <div style="background:#0D0C14;border:1px solid rgba(56, 189, 248, 0.15);border-radius:16px;padding:28px">
            <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 12px">You're invited to ${companyName}</h1>
            <p style="color:rgba(255,255,255,0.5);font-size:15px;line-height:1.6;margin:0 0 24px">
              You've been invited to join <strong style="color:rgba(255,255,255,0.8)">${companyName}</strong> on Shapi —
              the verified hiring platform. You'll be able to view candidate matches and manage roles alongside your team.
            </p>
            <a href="${signupUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#38BDF8, #34D399);
              color:#060609;font-size:14px;font-weight:900;border-radius:100px;text-decoration:none">
              Accept invitation →
            </a>
          </div>
          <p style="color:rgba(255,255,255,0.15);font-size:12px;margin-top:20px;text-align:center">
            Shapi · shapi.io · If you weren't expecting this, ignore it.
          </p>
        </div>
      `,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, invite_id: invite?.id })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: members } = await admin
    .from('company_members')
    .select('id, email, accepted_at, created_at')
    .eq('company_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ members: members || [] })
}
