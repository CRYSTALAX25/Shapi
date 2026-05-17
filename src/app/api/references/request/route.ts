import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendManagerReferenceEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    job_slot,            // 1 | 2
    referee_name,
    referee_email,
    referee_title,       // manager's job title
    candidate_job_title,
    candidate_company,
    candidate_dates,
  } = body

  if (!referee_name || !referee_email || !job_slot || !candidate_company) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const candidateName = (profile?.full_name as string) || 'the candidate'

  // Upsert — one manager per job_slot per candidate (replace if they re-submit)
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
      referee_email,
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
      referee_email,
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

  // Send reference request email to the manager
  const referenceUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/reference/${ref.token}`
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
    await admin.from('candidate_references')
      .update({ status: 'contacted', contacted_at: new Date().toISOString() })
      .eq('id', ref.id)
  } catch (err) {
    console.error('[references/request] Email failed:', err)
  }

  return NextResponse.json({ success: true, id: ref.id })
}

// GET — list all references for the current candidate (for status tracker)
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
