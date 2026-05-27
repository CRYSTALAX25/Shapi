// Token-gated edit/publish endpoint for the mobile share link.
// No user auth required — the token IS the auth. Verifies the token + expiry
// + that it hasn't been revoked, then performs ONLY the allowed actions:
// edit fields on the role, or publish (status: draft -> active).

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

type Action = 'edit' | 'publish'

type RoleUpdates = {
  title?: string
  description?: string
  requirements?: string
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  salary_visible?: boolean
  remote?: boolean
  location?: string
  department?: string
}

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: tokenRow } = await admin
    .from('role_share_tokens')
    .select('token, role_id, company_id, expires_at')
    .eq('token', token)
    .single()
  if (!tokenRow) return NextResponse.json({ error: 'Link not found or revoked' }, { status: 404 })
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Link expired — ask your account to generate a new one' }, { status: 410 })
  }

  const body = await request.json().catch(() => ({}))
  const action = body.action as Action | undefined
  if (action !== 'edit' && action !== 'publish') {
    return NextResponse.json({ error: 'action must be edit or publish' }, { status: 400 })
  }

  // Stamp used_at on first use (telemetry only).
  await admin.from('role_share_tokens').update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .is('used_at', null)

  if (action === 'edit') {
    const updates = (body.updates || {}) as RoleUpdates
    // Allowlist the fields we let a token-holder edit. Never let them change
    // company_id, status, created_at, etc.
    const allowed: RoleUpdates = {}
    const fields: Array<keyof RoleUpdates> = ['title', 'description', 'requirements', 'salary_min', 'salary_max', 'salary_currency', 'salary_visible', 'remote', 'location', 'department']
    for (const k of fields) {
      if (k in updates) (allowed as Record<string, unknown>)[k] = updates[k]
    }
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'no allowed fields in update' }, { status: 400 })
    }
    const { error } = await admin.from('roles').update(allowed).eq('id', tokenRow.role_id).eq('company_id', tokenRow.company_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // action === 'publish'
  const { error } = await admin.from('roles').update({ status: 'active' })
    .eq('id', tokenRow.role_id)
    .eq('company_id', tokenRow.company_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
