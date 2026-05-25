// POST   /api/upskill/course — add or update a tracked course
// DELETE /api/upskill/course — remove one
//
// Verification rule (fountain-of-truth principle):
//   - status='completed' AND (credential_url OR credential_id present) → verified
//   - completed via a Shapi pathway (via_shapi) → verified
//   - otherwise → self_reported

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function deriveVerification(status: string, credentialUrl?: string, credentialId?: string, viaShapi?: boolean): 'verified' | 'self_reported' {
  if (status === 'completed' && (viaShapi || (credentialUrl && credentialUrl.trim()) || (credentialId && credentialId.trim()))) {
    return 'verified'
  }
  return 'self_reported'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const {
    id, skill, course_name, platform, course_url, tier, status,
    credential_url, credential_id, via_shapi,
    liked, subsidy_type, subsidy_detail, duration_hours,
  } = body as Record<string, string | boolean | number | undefined>

  if (!id && !course_name) {
    return NextResponse.json({ error: 'course_name required' }, { status: 400 })
  }

  const effectiveStatus = (status as string) || 'interested'
  const verification_status = deriveVerification(
    effectiveStatus, credential_url as string, credential_id as string, via_shapi as boolean,
  )

  const payload: Record<string, unknown> = {
    candidate_id: user.id,
    skill: skill ?? null,
    course_name: course_name ?? undefined,
    platform: platform ?? null,
    course_url: course_url ?? null,
    tier: tier ?? 'free',
    status: effectiveStatus,
    verification_status,
    credential_url: credential_url ?? null,
    credential_id: credential_id ?? null,
    via_shapi: via_shapi ?? false,
    completed_at: effectiveStatus === 'completed' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }

  // Course-wallet fields — only attach when explicitly provided so partial
  // updates (e.g. just toggling "liked") never clobber other saved values.
  if (liked !== undefined) payload.liked = !!liked
  if (subsidy_type !== undefined) payload.subsidy_type = (subsidy_type as string) || null
  if (subsidy_detail !== undefined) payload.subsidy_detail = (subsidy_detail as string) || null
  if (duration_hours !== undefined) {
    const n = Number(duration_hours)
    payload.duration_hours = Number.isFinite(n) && n > 0 ? Math.round(n) : null
  }

  if (id) {
    // Update existing — only fields provided
    const updates = { ...payload }
    delete updates.candidate_id
    if (course_name === undefined) delete updates.course_name
    const { error } = await supabase
      .from('candidate_courses')
      .update(updates)
      .eq('id', id)
      .eq('candidate_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, verification_status })
  }

  const { data, error } = await supabase
    .from('candidate_courses')
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id, verification_status })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase
    .from('candidate_courses')
    .delete()
    .eq('id', id)
    .eq('candidate_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
