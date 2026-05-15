import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      company_id: user.id,
      title: body.title,
      location: body.location || null,
      remote: body.remote || false,
      salary_min: body.salary_min || null,
      salary_max: body.salary_max || null,
      salary_currency: 'USD',
      description: body.description || null,
      visa_sponsorship: body.visa_sponsorship || false,
      ai_tier_required: body.ai_tier_required || 'any',
      status: body.status || 'draft',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, job: data })
}
