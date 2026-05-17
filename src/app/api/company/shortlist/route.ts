import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { candidate_id, role_id, note } = await request.json()
  if (!candidate_id || !role_id) return NextResponse.json({ error: 'candidate_id and role_id required' }, { status: 400 })

  const { error } = await supabase
    .from('company_shortlists')
    .upsert({ company_id: user.id, candidate_id, role_id, note: note || null }, { onConflict: 'company_id,candidate_id,role_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Check mutual match — has candidate expressed interest?
  const { data: interest } = await supabase
    .from('candidate_interests')
    .select('id')
    .eq('candidate_id', candidate_id)
    .eq('role_id', role_id)
    .maybeSingle()

  let mutual = false
  if (interest) {
    mutual = true
    const admin = createAdminClient()
    const [candidateAuth, companyAuth, roleData, candidateProfile, companyProfile] = await Promise.all([
      admin.auth.admin.getUserById(candidate_id),
      admin.auth.admin.getUserById(user.id),
      supabase.from('roles').select('title').eq('id', role_id).single(),
      supabase.from('profiles').select('full_name').eq('id', candidate_id).single(),
      supabase.from('profiles').select('company_name, full_name').eq('id', user.id).single(),
    ])

    const resend = new Resend(process.env.RESEND_API_KEY)
    const roleTitle = roleData.data?.title || 'a role'
    const candidateName = candidateProfile.data?.full_name || 'A candidate'
    const companyName = companyProfile.data?.company_name || companyProfile.data?.full_name || 'A company'

    if (candidateAuth.data?.user?.email) {
      resend.emails.send({
        from: 'Shapi <hello@shapi.io>',
        to: candidateAuth.data.user.email,
        subject: `It's a match — ${companyName} wants to connect`,
        html: matchEmail(candidateName.split(' ')[0], companyName, roleTitle, `${SITE}/roles`),
      }).catch(() => {})
    }
    if (companyAuth.data?.user?.email) {
      resend.emails.send({
        from: 'Shapi <hello@shapi.io>',
        to: companyAuth.data.user.email,
        subject: `Mutual match: ${candidateName} is interested in ${roleTitle}`,
        html: matchEmail(companyName, candidateName, roleTitle, `${SITE}/company/dashboard`),
      }).catch(() => {})
    }
  }

  return NextResponse.json({ success: true, mutual })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { candidate_id, role_id } = await request.json()
  await supabase.from('company_shortlists').delete()
    .eq('company_id', user.id).eq('candidate_id', candidate_id).eq('role_id', role_id)

  return NextResponse.json({ success: true })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('company_shortlists')
    .select('candidate_id, role_id, note, created_at')
    .eq('company_id', user.id)

  return NextResponse.json({ shortlists: data || [] })
}

function matchEmail(selfFirst: string, otherName: string, roleTitle: string, ctaUrl: string) {
  return `
    <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;background:#060609">
      <p style="font-size:22px;font-weight:900;margin:0 0 24px;background:linear-gradient(135deg,#A78BFA,#22D3EE);-webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</p>
      <div style="background:#0d0d14;border:1px solid rgba(34,211,238,0.2);border-radius:16px;padding:28px">
        <div style="font-size:32px;margin-bottom:12px">🤝</div>
        <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 12px">It's a match, ${selfFirst}.</h1>
        <p style="color:rgba(255,255,255,0.5);font-size:15px;line-height:1.6;margin:0 0 24px">
          Both sides have signalled interest in the <strong style="color:rgba(255,255,255,0.8)">${roleTitle}</strong> role.
          <strong style="color:rgba(255,255,255,0.8)">${otherName}</strong> is ready to connect — reach out directly.
        </p>
        <a href="${ctaUrl}" style="display:inline-block;padding:13px 26px;background:linear-gradient(135deg,#22D3EE,#A78BFA);color:#060609;font-size:14px;font-weight:900;border-radius:100px;text-decoration:none">Connect now →</a>
      </div>
    </div>`
}
