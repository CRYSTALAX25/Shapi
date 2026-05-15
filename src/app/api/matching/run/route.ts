import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { matchCandidateToJobs, matchJobToCandidates } from '@/lib/matching'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { candidate_id, job_id } = await request.json()

  if (candidate_id) {
    await matchCandidateToJobs(candidate_id)
    return NextResponse.json({ success: true, type: 'candidate' })
  }

  if (job_id) {
    await matchJobToCandidates(job_id)
    return NextResponse.json({ success: true, type: 'job' })
  }

  return NextResponse.json({ error: 'Provide candidate_id or job_id' }, { status: 400 })
}
