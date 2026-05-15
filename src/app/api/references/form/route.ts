import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const { data: ref, error } = await supabase
    .from('candidate_references')
    .select('referee_name, referee_relationship, status, candidate_id')
    .eq('token', token)
    .single()

  if (error || !ref) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Get candidate name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', ref.candidate_id)
    .single()

  return NextResponse.json({
    referee_name: ref.referee_name,
    candidate_name: profile?.full_name || 'the candidate',
    referee_relationship: ref.referee_relationship,
    status: ref.status,
  })
}
