// Generate a tokenised mobile share link for a draft role and (optionally)
// WhatsApp it to the hiring manager so they can review/edit/publish from
// their phone without logging in. STRATEGY §16 "running around" UX win.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/whatsapp'
import { randomBytes } from 'crypto'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'
const TOKEN_TTL_DAYS = 14

function newToken(): string {
  // URL-safe ~32 chars (24 bytes -> 32 base64-url chars)
  return randomBytes(24).toString('base64url')
}

function shortJd(title: string, description: string | null, requirements: string | null, salary: string | null): string {
  const parts: string[] = [`📄 *${title}*`]
  if (salary) parts.push(`💸 ${salary}`)
  if (description) parts.push('', description.slice(0, 500) + (description.length > 500 ? '…' : ''))
  if (requirements) parts.push('', '*Must-haves:*', requirements.slice(0, 400) + (requirements.length > 400 ? '…' : ''))
  return parts.join('\n')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const roleId: string = typeof body.role_id === 'string' ? body.role_id : ''
  const sendToWhatsapp: boolean = body.send_whatsapp !== false  // default true
  if (!roleId) return NextResponse.json({ error: 'role_id required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify the role belongs to the requesting company.
  const { data: role } = await admin
    .from('roles')
    .select('id, company_id, title, description, requirements, salary_min, salary_max, salary_currency')
    .eq('id', roleId)
    .single()
  if (!role || role.company_id !== user.id) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 })
  }

  // Generate + store token.
  const token = newToken()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error: insErr } = await admin
    .from('role_share_tokens')
    .insert({ token, role_id: roleId, company_id: user.id, expires_at: expiresAt })
  if (insErr) {
    // Most likely cause: migration not run. Tell the caller honestly.
    return NextResponse.json({ error: `Token storage failed: ${insErr.message}. Run supabase/role_share_tokens.sql.` }, { status: 500 })
  }

  const link = `${SITE}/r/${token}`

  // Pull the company's WhatsApp number for the optional send.
  let whatsappSent = false
  if (sendToWhatsapp) {
    const { data: profile } = await admin
      .from('profiles')
      .select('whatsapp_number, company_name, full_name')
      .eq('id', user.id)
      .single()
    const number = profile?.whatsapp_number
    if (number) {
      const salary = (role.salary_min && role.salary_max)
        ? `${role.salary_currency || ''} ${role.salary_min.toLocaleString()}–${role.salary_max.toLocaleString()}`.trim()
        : null
      const jdText = shortJd(role.title || 'Untitled role', role.description, role.requirements, salary)
      const greeting = profile.company_name || profile.full_name || ''
      const body = `${greeting ? `Hi ${greeting} 👋\n\n` : ''}Here's your draft job description:\n\n${jdText}\n\n*Review / edit / publish — no login needed:*\n${link}\n\nOr reply with edits ("change responsibilities to…", "raise salary to…") and I'll update it.`
      const result = await sendWhatsApp(number, body)
      whatsappSent = !!result.success
    }
  }

  return NextResponse.json({ ok: true, link, expires_at: expiresAt, whatsapp_sent: whatsappSent })
}
