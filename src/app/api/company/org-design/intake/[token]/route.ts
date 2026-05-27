// Token-gated read of a voice-driven org-design intake. Used by the page
// when a hiring manager taps the magic link Shapi WhatsApp'd them after
// recording the 3 voice notes. No login required — the URL token IS the
// auth (validated against expiry + the org_design_intake_tokens table).

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('org_design_intake_tokens')
    .select('token, company_id, current_team_text, strategy_text, ai_plan_text, expires_at')
    .eq('token', token)
    .single()

  if (!row) return NextResponse.json({ error: 'Link not found or revoked' }, { status: 404 })
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }

  return NextResponse.json({
    success: true,
    intake: {
      current_team_text: row.current_team_text || '',
      strategy_text: row.strategy_text || '',
      ai_plan_text: row.ai_plan_text || '',
    },
  })
}
