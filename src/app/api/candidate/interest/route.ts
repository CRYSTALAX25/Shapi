import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role_id } = await request.json()
  if (!role_id) return NextResponse.json({ error: 'role_id required' }, { status: 400 })

  // Insert interest
  const { error } = await supabase
    .from('candidate_interests')
    .upsert({ candidate_id: user.id, role_id }, { onConflict: 'candidate_id,role_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Check for mutual match — has company shortlisted this candidate for this role?
  const { data: shortlist } = await supabase
    .from('company_shortlists')
    .select('company_id')
    .eq('candidate_id', user.id)
    .eq('role_id', role_id)
    .maybeSingle()

  let mutual = false
  if (shortlist) {
    mutual = true
    // Fire mutual match emails
    const admin = createAdminClient()
    const [candidateAuth, companyAuth, roleData, candidateProfile, companyProfile] = await Promise.all([
      admin.auth.admin.getUserById(user.id),
      admin.auth.admin.getUserById(shortlist.company_id),
      supabase.from('roles').select('title').eq('id', role_id).single(),
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('profiles').select('company_name, full_name').eq('id', shortlist.company_id).single(),
    ])

    const resend = new Resend(process.env.RESEND_API_KEY)
    const roleTitle = roleData.data?.title || 'a role'
    const candidateName = candidateProfile.data?.full_name || 'A candidate'
    const companyName = companyProfile.data?.company_name || companyProfile.data?.full_name || 'A company'

    // Email candidate
    if (candidateAuth.data?.user?.email) {
      resend.emails.send({
        from: 'Shapi <hello@shapi.io>',
        to: candidateAuth.data.user.email,
        subject: `It's a match — ${companyName} wants to connect`,
        html: mutualMatchEmail('candidate', candidateName.split(' ')[0], companyName, roleTitle),
      }).catch(() => {})
    }
    // Email company
    if (companyAuth.data?.user?.email) {
      resend.emails.send({
        from: 'Shapi <hello@shapi.io>',
        to: companyAuth.data.user.email,
        subject: `${candidateName} is interested in your ${roleTitle} role`,
        html: mutualMatchEmail('company', companyName, candidateName, roleTitle),
      }).catch(() => {})
    }
  }

  // Mirror into the pipeline so it shows in the candidate's tracker (and the
  // company's pipeline once they engage). Candidate-initiated = 'matched';
  // bumps to 'shortlisted' if the company already shortlisted them (mutual).
  try {
    const adminApp = createAdminClient()
    const { data: roleRow } = await adminApp.from('roles').select('company_id').eq('id', role_id).single()
    if (roleRow) {
      const { data: existingApp } = await adminApp
        .from('applications').select('id, stage').eq('candidate_id', user.id).eq('role_id', role_id).maybeSingle()
      if (!existingApp) {
        await adminApp.from('applications').insert({ candidate_id: user.id, role_id, company_id: roleRow.company_id, stage: mutual ? 'shortlisted' : 'matched' })
      } else if (mutual && existingApp.stage === 'matched') {
        await adminApp.from('applications').update({ stage: 'shortlisted' }).eq('id', existingApp.id)
      }
    }
  } catch { /* pipeline mirror is best-effort */ }

  return NextResponse.json({ success: true, mutual })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role_id } = await request.json()
  await supabase.from('candidate_interests').delete()
    .eq('candidate_id', user.id).eq('role_id', role_id)

  return NextResponse.json({ success: true })
}

function mutualMatchEmail(perspective: 'candidate' | 'company', selfName: string, otherName: string, roleTitle: string) {
  const msg = perspective === 'candidate'
    ? `You expressed interest in <strong style="color:rgba(255,255,255,0.8)">${otherName}</strong>'s ${roleTitle} role, and they've already shortlisted you. Both sides are interested — time to connect.`
    : `<strong style="color:rgba(255,255,255,0.8)">${otherName}</strong> just expressed interest in your ${roleTitle} role — and you'd already shortlisted them. It's a mutual match. View their profile and reach out.`

  return `
    <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;background:#060609">
      <p style="font-size:22px;font-weight:900;margin:0 0 24px;background:linear-gradient(135deg, #9D8CFF, #34D399);-webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</p>
      <div style="background:#0D0C14;border:1px solid rgba(157, 140, 255, 0.2);border-radius:16px;padding:28px">
        <div style="font-size:32px;margin-bottom:12px">🤝</div>
        <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 12px">It's a match.</h1>
        <p style="color:rgba(255,255,255,0.5);font-size:15px;line-height:1.6;margin:0 0 24px">${msg}</p>
        <a href="${SITE}/${perspective === 'candidate' ? 'roles' : 'company/dashboard'}" style="display:inline-block;padding:13px 26px;background:linear-gradient(135deg,#9D8CFF, #34D399);color:#060609;font-size:14px;font-weight:900;border-radius:100px;text-decoration:none">
          ${perspective === 'candidate' ? 'View role →' : 'View profile →'}
        </a>
      </div>
    </div>`
}
