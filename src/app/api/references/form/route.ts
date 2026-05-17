import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const admin = createAdminClient()

  const { data: ref, error } = await admin
    .from('candidate_references')
    .select('id, referee_name, referee_title, referee_relationship, ref_type, status, candidate_id, candidate_job_title, candidate_company, candidate_dates, nominator_name, nominated_by')
    .eq('token', token)
    .single()

  if (error || !ref) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', ref.candidate_id)
    .single()

  // If nominated by a manager, get their name + company for the form header
  let nominator: { name: string; company: string } | null = null
  if (ref.nominated_by) {
    const { data: mgr } = await admin
      .from('candidate_references')
      .select('referee_name, candidate_company')
      .eq('id', ref.nominated_by)
      .single()
    if (mgr) nominator = { name: mgr.referee_name, company: mgr.candidate_company }
  }

  return NextResponse.json({
    referee_name: ref.referee_name,
    referee_title: ref.referee_title,
    candidate_name: profile?.full_name || 'the candidate',
    candidate_job_title: ref.candidate_job_title,
    candidate_company: ref.candidate_company,
    candidate_dates: ref.candidate_dates,
    ref_type: ref.ref_type || 'manager',
    status: ref.status,
    nominator,
  })
}
