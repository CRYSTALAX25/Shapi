// Mobile review/edit/publish page for a draft role — opened by tapping the
// magic link Shapi WhatsApps after the Hiring Roadmap drafts a JD.
// No user auth required: the URL token IS the auth (verified server-side
// + scoped only to this role's edit + publish actions).

import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import RoleEditClient from './RoleEditClient'

export const dynamic = 'force-dynamic'

type Role = {
  id: string
  title: string | null
  description: string | null
  requirements: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  salary_visible: boolean | null
  status: string | null
  remote: boolean | null
  location: string | null
  department: string | null
  company_id: string
}

export default async function RoleSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) notFound()

  const admin = createAdminClient()
  const { data: tokenRow } = await admin
    .from('role_share_tokens')
    .select('token, role_id, company_id, expires_at')
    .eq('token', token)
    .single()

  if (!tokenRow) {
    return <ExpiredOrInvalid reason="not-found" />
  }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return <ExpiredOrInvalid reason="expired" />
  }

  const { data: role } = await admin
    .from('roles')
    .select('id, title, description, requirements, salary_min, salary_max, salary_currency, salary_visible, status, remote, location, department, company_id')
    .eq('id', tokenRow.role_id)
    .single() as { data: Role | null }

  if (!role) return <ExpiredOrInvalid reason="not-found" />

  // Pull a tiny bit of company context so the page feels personal.
  const { data: company } = await admin
    .from('profiles')
    .select('company_name, full_name')
    .eq('id', role.company_id)
    .single()
  const companyName = company?.company_name || company?.full_name || 'your company'

  return (
    <div className="min-h-screen bg-[#060609] text-[#F4F4F7]">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <nav className="relative z-10 px-5 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-2xl mx-auto">
        <span className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg, #9D8CFF, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</span>
        <span className="text-[#7E7E8E] text-xs">Secure link · {companyName}</span>
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-5 pt-6 pb-20">
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#9D8CFF' }}>
            {role.status === 'active' ? 'Published role' : 'Draft job description'}
          </p>
          <h1 className="text-2xl font-black tracking-tight mb-1" style={{ color: '#FB7185' }}>
            {role.title || 'Untitled role'}
          </h1>
          <p className="text-[#A6A6B4] text-sm">
            {role.status === 'active'
              ? 'This role is live on Shapi. You can still tweak the wording below.'
              : 'Review, tweak, and publish — no login needed. Saved instantly.'}
          </p>
        </div>

        <RoleEditClient token={token} role={role} companyName={companyName} />
      </div>
    </div>
  )
}

function ExpiredOrInvalid({ reason }: { reason: 'expired' | 'not-found' }) {
  return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <p className="text-3xl mb-3">🔗</p>
        <h1 className="text-xl font-black text-[#F4F4F7] mb-2">
          {reason === 'expired' ? 'This link has expired' : 'Link not found'}
        </h1>
        <p className="text-[#A6A6B4] text-sm leading-relaxed">
          {reason === 'expired'
            ? 'Share links expire after 14 days for security. Ask Shapi to send you a fresh one — text "send JD link" on WhatsApp, or open your dashboard.'
            : 'This share link is invalid or has been revoked. If you think this is a mistake, sign into Shapi to view the role.'}
        </p>
      </div>
    </div>
  )
}
