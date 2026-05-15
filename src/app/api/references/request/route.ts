import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { referee_name, referee_email, referee_relationship } = await request.json()

  if (!referee_name || !referee_email || !referee_relationship) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Get candidate name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const candidateName = profile?.full_name || user.email

  // Create reference record
  const { data: ref, error } = await supabase
    .from('candidate_references')
    .insert({
      candidate_id: user.id,
      referee_name,
      referee_email,
      referee_relationship,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Send reference request email
  const resend = new Resend(process.env.RESEND_API_KEY)
  const referenceUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/reference/${ref.token}`

  await resend.emails.send({
    from: 'Shapi <hello@shapi.io>',
    to: referee_email,
    subject: `${candidateName} has listed you as a reference on Shapi`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1C1C2E;">
        <div style="padding: 40px 0 20px;">
          <span style="color: #0B5563; font-weight: bold; font-size: 20px;">shapi</span>
        </div>

        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 12px;">
          ${candidateName} has listed you as a reference
        </h1>

        <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
          Hi ${referee_name},<br><br>
          ${candidateName} is building a verified professional profile on Shapi and has listed you as a reference
          (${referee_relationship}).
        </p>

        <p style="color: #555; line-height: 1.6; margin-bottom: 28px;">
          We'd love to hear from you — it takes about 5 minutes. Your honest answers help ${candidateName.split(' ')[0]}
          stand out to the right employers, and may highlight skills they haven't even mentioned themselves.
        </p>

        <div style="margin-bottom: 32px;">
          <a href="${referenceUrl}"
             style="background: #0B5563; color: white; padding: 14px 28px; border-radius: 100px;
                    text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
            Give a reference →
          </a>
        </div>

        <p style="color: #999; font-size: 13px; line-height: 1.5;">
          This link is unique to you. Your responses will appear on ${candidateName.split(' ')[0]}'s Shapi profile
          and cannot be edited by them. If you'd prefer not to provide a reference, simply ignore this email.
        </p>

        <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px;">
          <p style="color: #bbb; font-size: 12px;">
            Shapi — Verified professional profiles. shapi.io
          </p>
        </div>
      </div>
    `,
  })

  // Mark as sent
  await supabase
    .from('candidate_references')
    .update({ status: 'sent', email_sent_at: new Date().toISOString() })
    .eq('id', ref.id)

  return NextResponse.json({ success: true })
}
