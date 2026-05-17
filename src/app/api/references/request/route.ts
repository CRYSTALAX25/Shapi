import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendManagerReferenceEmail } from '@/lib/email'
import { sendReferenceOutreach } from '@/lib/whatsapp'
import { NextResponse } from 'next/server'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    job_slot,
    referee_name,
    referee_phone,       // WhatsApp / phone — primary outreach channel
    referee_email,       // secondary / always sent alongside
    referee_title,
    candidate_job_title,
    candidate_company,
    candidate_dates,
  } = body

  if (!referee_name || !job_slot || !candidate_company || (!referee_phone && !referee_email)) {
    return NextResponse.json({ error: 'Name, company, and at least one contact method required.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const candidateName = (profile?.full_name as string) || 'the candidate'

  // Upsert — one manager per job_slot per candidate
  const { data: existing } = await admin
    .from('candidate_references')
    .select('id, token')
    .eq('candidate_id', user.id)
    .eq('job_slot', job_slot)
    .eq('ref_type', 'manager')
    .maybeSingle()

  let ref: { id: string; token: string }

  if (existing) {
    await admin.from('candidate_references').update({
      referee_name,
      referee_phone: referee_phone || null,
      referee_email: referee_email || null,
      referee_title: referee_title || null,
      candidate_job_title: candidate_job_title || null,
      candidate_company,
      candidate_dates: candidate_dates || null,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id)
    ref = existing as { id: string; token: string }
  } else {
    const { data: inserted, error } = await admin.from('candidate_references').insert({
      candidate_id: user.id,
      ref_type: 'manager',
      job_slot,
      referee_name,
      referee_phone: referee_phone || null,
      referee_email: referee_email || null,
      referee_title: referee_title || null,
      referee_relationship: 'direct_manager',
      candidate_job_title: candidate_job_title || null,
      candidate_company,
      candidate_dates: candidate_dates || null,
      status: 'pending',
    }).select('id, token').single()

    if (error || !inserted) {
      console.error('[references/request]', error?.message)
      return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 })
    }
    ref = inserted as { id: string; token: string }
  }

  const referenceUrl = `${SITE}/reference/${ref.token}`
  const candidateFirst = candidateName.split(' ')[0]
  let contacted = false

  // 1. WhatsApp / SMS first (if phone provided)
  if (referee_phone) {
    const waMsg =
      `Hi ${referee_name.split(' ')[0]} 👋 ${candidateName} listed you as their manager at ${candidate_company}.\n\n` +
      `We're building their verified profile on Shapi. Takes 5 minutes — your honest answers help them stand out to the right employers.\n\n` +
      `Fill in here: ${referenceUrl}\n\n` +
      `${candidateFirst} can't edit your responses — they appear exactly as you write them.`

    const { whatsapp, sms } = await sendReferenceOutreach({
      phone: referee_phone,
      message: waMsg,
      label: `manager ref slot ${job_slot} for ${candidateName}`,
    })
    if (whatsapp || sms) contacted = true
  }

  // 2. Email — always send if provided (belt + suspenders)
  if (referee_email) {
    try {
      await sendManagerReferenceEmail({
        to: referee_email,
        refereeName: referee_name,
        candidateName,
        candidateJobTitle: candidate_job_title || 'their role',
        candidateCompany: candidate_company,
        candidateDates: candidate_dates || '',
        referenceUrl,
      })
      contacted = true
    } catch (err) {
      console.error('[references/request] Email failed:', err)
    }
  }

  if (contacted) {
    await admin.from('candidate_references')
      .update({ status: 'contacted', contacted_at: new Date().toISOString() })
      .eq('id', ref.id)
  }

  return NextResponse.json({ success: true, id: ref.id })
}

// GET — list all references for the current candidate
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: refs } = await admin
    .from('candidate_references')
    .select('id, ref_type, job_slot, referee_name, referee_title, candidate_company, candidate_job_title, candidate_dates, status, nominated_by, nominator_name')
    .eq('candidate_id', user.id)
    .order('job_slot', { ascending: true })

  return NextResponse.json({ refs: refs || [] })
}
