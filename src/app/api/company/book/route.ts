import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slot_id, role_id, candidate_id } = await request.json()
  if (!slot_id || !candidate_id) return NextResponse.json({ error: 'slot_id and candidate_id required' }, { status: 400 })

  // Mark slot booked
  const { data: slot, error } = await supabase
    .from('availability_slots')
    .update({ status: 'booked', booked_by: user.id, booked_role_id: role_id || null, booked_at: new Date().toISOString() })
    .eq('id', slot_id)
    .eq('status', 'available')
    .select()
    .single()

  if (error || !slot) return NextResponse.json({ error: 'Slot not available' }, { status: 409 })

  // Fetch names and emails
  const admin = createAdminClient()
  const [candidateAuth, companyAuth, candidateProfile, companyProfile, roleData] = await Promise.all([
    admin.auth.admin.getUserById(candidate_id),
    admin.auth.admin.getUserById(user.id),
    supabase.from('profiles').select('full_name, whatsapp_number').eq('id', candidate_id).single(),
    supabase.from('profiles').select('company_name, full_name').eq('id', user.id).single(),
    role_id ? supabase.from('roles').select('title').eq('id', role_id).single() : Promise.resolve({ data: null }),
  ])

  const candidateEmail = candidateAuth.data?.user?.email
  const companyEmail = companyAuth.data?.user?.email
  const candidateName = candidateProfile.data?.full_name || 'Candidate'
  const companyName = companyProfile.data?.company_name || companyProfile.data?.full_name || 'Company'
  const roleTitle = roleData.data?.title || 'Interview'
  const slotDate = new Date(slot.slot_datetime)
  const formatted = slotDate.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })

  // Generate .ics content
  const icsStart = slotDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const icsEnd = new Date(slotDate.getTime() + (slot.duration_mins || 30) * 60000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:${roleTitle} — ${candidateName} & ${companyName}\r\nDTSTART:${icsStart}\r\nDTEND:${icsEnd}\r\nDESCRIPTION:Shapi interview — ${roleTitle}. View profile: ${SITE}/candidates/${candidate_id}\r\nORGANIZER:Shapi <hello@shapi.io>\r\nEND:VEVENT\r\nEND:VCALENDAR`

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const emailHtml = (name: string, other: string, role: string) => `
      <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;background:#060609">
        <p style="font-size:22px;font-weight:900;margin:0 0 24px;background:linear-gradient(135deg,#A78BFA,#22D3EE);-webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</p>
        <div style="background:#0d0d14;border:1px solid rgba(34,211,238,0.2);border-radius:16px;padding:28px">
          <div style="font-size:28px;margin-bottom:12px">📅</div>
          <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 8px">Interview confirmed</h1>
          <p style="color:rgba(255,255,255,0.5);font-size:15px;margin:0 0 20px">
            <strong style="color:#22D3EE">${role}</strong> with <strong style="color:rgba(255,255,255,0.8)">${other}</strong>
          </p>
          <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;margin-bottom:20px">
            <p style="color:rgba(255,255,255,0.35);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px">Date & time (Dubai)</p>
            <p style="color:#fff;font-size:16px;font-weight:700;margin:0">${formatted}</p>
            <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:4px 0 0">${slot.duration_mins || 30} minutes · Calendar invite attached</p>
          </div>
          <p style="color:rgba(255,255,255,0.3);font-size:13px">The calendar invite is attached. Add it to your calendar to get the reminder.</p>
        </div>
      </div>`

    const attachments = [{ filename: 'shapi-interview.ics', content: Buffer.from(ics).toString('base64') }]

    if (candidateEmail) {
      resend.emails.send({ from: 'Shapi <hello@shapi.io>', to: candidateEmail, subject: `Interview confirmed: ${roleTitle} with ${companyName}`, html: emailHtml(candidateName, companyName, roleTitle), attachments }).catch(() => {})
    }
    if (companyEmail) {
      resend.emails.send({ from: 'Shapi <hello@shapi.io>', to: companyEmail, subject: `Interview confirmed: ${candidateName} for ${roleTitle}`, html: emailHtml(companyName, candidateName, roleTitle), attachments }).catch(() => {})
    }
  }

  return NextResponse.json({ success: true, slot, formatted_time: formatted })
}

// Get available slots for a candidate (public, for company to book)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const candidateId = searchParams.get('candidate_id')
  if (!candidateId) return NextResponse.json({ error: 'candidate_id required' }, { status: 400 })

  const { data } = await supabase
    .from('availability_slots')
    .select('id, slot_datetime, duration_mins')
    .eq('candidate_id', candidateId)
    .eq('status', 'available')
    .gte('slot_datetime', new Date().toISOString())
    .order('slot_datetime', { ascending: true })
    .limit(10)

  return NextResponse.json({ slots: data || [] })
}
