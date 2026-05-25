import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'

type Role = {
  id: string
  title: string
  department: string | null
  location: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  engagement_type: string | null
  accepts_pivot_candidates: boolean | null
  status: string
  created_at: string
}

const STATUS_BADGE: Record<string, { label: string; style: React.CSSProperties }> = {
  draft: { label: 'Draft', style: { background: 'rgba(251,191,36,0.12)', color: '#FBBF24' } },
  active: { label: 'Active', style: { background: 'rgba(106,168,245,0.12)', color: '#6AA8F5' } },
  closed: { label: 'Closed', style: { background: 'rgba(245,142,154,0.12)', color: '#F58E9A' } },
}

const ENGAGEMENT_LABEL: Record<string, string> = {
  permanent: 'Permanent',
  contract: 'Contract',
  temp: 'Temp / Shift',
}

function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] || { label: status, style: { background: 'rgba(255,255,255,0.06)', color: '#A6A6B4' } }
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize" style={b.style}>
      {b.label}
    </span>
  )
}

function RoleCard({ role }: { role: Role }) {
  const salary = role.salary_min && role.salary_max
    ? `${role.salary_currency || 'USD'} ${role.salary_min.toLocaleString()}–${role.salary_max.toLocaleString()}`
    : null
  return (
    <div className="gradient-border-card card-hover rounded-2xl p-5 transition-all duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <h3 className="font-black text-lg text-[#F4F4F7] truncate">{role.title}</h3>
            <StatusBadge status={role.status} />
            {role.accepts_pivot_candidates && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399' }}>
                🌱 Train-to-Hire
              </span>
            )}
          </div>
          <p className="text-[#7E7E8E] text-xs">
            {[role.department, role.location].filter(Boolean).join(' · ')}
            {role.engagement_type && (
              <span>{(role.department || role.location) ? ' · ' : ''}{ENGAGEMENT_LABEL[role.engagement_type] || role.engagement_type}</span>
            )}
          </p>
          {salary && <p className="text-[#6AA8F5] text-xs font-semibold mt-1">{salary}</p>}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <Link href={`/company/roles/${role.id}`}
            className="bg-gradient-to-r from-[#6AA8F5] to-[#4F8FE8] text-[#fff] text-xs font-black px-4 py-2 rounded-full hover:opacity-90 transition-opacity whitespace-nowrap">
            {role.status === 'draft' ? 'Review draft →' : 'View / edit →'}
          </Link>
          {role.status === 'active' && (
            <Link href={`/company/dashboard?role=${role.id}`}
              className="text-[#6AA8F5] text-xs font-bold hover:opacity-80 whitespace-nowrap">
              See pipeline →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default async function CompanyRoles() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: company } = await supabase
    .from('profiles')
    .select('type, company_name, full_name')
    .eq('id', user.id)
    .single()

  if (!company || company.type !== 'company') redirect('/dashboard')

  const companyName = company.company_name || company.full_name || 'Your company'

  const { data: roles } = await supabase
    .from('roles')
    .select('id, title, department, location, salary_min, salary_max, salary_currency, engagement_type, accepts_pivot_candidates, status, created_at')
    .eq('company_id', user.id)
    .order('created_at', { ascending: false })

  const allRoles: Role[] = roles || []
  const drafts = allRoles.filter(r => r.status === 'draft')
  const live = allRoles.filter(r => r.status === 'active')
  const closed = allRoles.filter(r => r.status === 'closed')

  return (
    <div className="min-h-screen" style={{ background: '#0E0E13' }}>
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.12), rgba(79,143,232,0.12)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .card-hover:hover {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.25), rgba(79,143,232,0.25)) border-box;
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Nav — company blue band */}
      <nav className="relative z-10" style={{ background: 'linear-gradient(120deg, #4F8FE8 0%, #4F8FE8 45%, #6AA8F5 100%)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ShapiCharacter mood="happy" size={30} />
            <span className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#4F8FE8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/company/dashboard" className="text-white/85 text-sm font-bold hover:text-white transition-colors">Dashboard</Link>
            <Link href="/company/pipeline" className="text-white/85 text-sm font-bold hover:text-white transition-colors">Pipeline →</Link>
            <span className="text-white/60 text-sm hidden sm:block">{companyName}</span>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-10 pb-20">

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-[#F4F4F7] mb-1">Your roles</h1>
            <p className="text-[#A6A6B4] text-sm">Manage, edit and publish the roles you&apos;re hiring for.</p>
          </div>
          <Link href="/company/roles/new"
            className="flex-shrink-0 bg-gradient-to-r from-[#6AA8F5] to-[#4F8FE8] px-5 py-2.5 rounded-full font-black text-xs text-[#fff] hover:opacity-90 transition-opacity">
            + Post a role
          </Link>
        </div>

        {/* Empty state */}
        {allRoles.length === 0 && (
          <div className="gradient-border-card rounded-2xl p-16 text-center flex flex-col items-center">
            <ShapiCharacter mood="idle" size={72} className="mb-6" />
            <p className="text-[#C7C7D1] font-bold text-lg mb-2">No roles yet</p>
            <p className="text-[#7E7E8E] text-sm mb-6 max-w-sm">
              Post your first role and we&apos;ll start matching verified candidates to it — or draft one over WhatsApp and review it here.
            </p>
            <Link href="/company/roles/new"
              className="bg-gradient-to-r from-[#6AA8F5] to-[#4F8FE8] px-6 py-3 rounded-full font-black text-sm text-[#fff] hover:opacity-90 transition-opacity">
              Post a role →
            </Link>
          </div>
        )}

        {/* Drafts to review — prominent, top */}
        {drafts.length > 0 && (
          <div className="mb-8">
            <div className="rounded-2xl px-5 py-4 mb-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <p className="text-sm font-black" style={{ color: '#FBBF24' }}>
                📝 {drafts.length} draft{drafts.length !== 1 ? 's' : ''} to review
              </p>
              <p className="text-[#A6A6B4] text-xs mt-1 leading-relaxed">
                Drafted from your WhatsApp chat. Review the salary, requirements and JD, then publish to start matching candidates.
              </p>
            </div>
            <div className="grid gap-3">
              {drafts.map(r => <RoleCard key={r.id} role={r} />)}
            </div>
          </div>
        )}

        {/* Active roles */}
        {live.length > 0 && (
          <div className="mb-8">
            <p className="text-[#7E7E8E] text-xs font-bold uppercase tracking-wider mb-3">Active · {live.length}</p>
            <div className="grid gap-3">
              {live.map(r => <RoleCard key={r.id} role={r} />)}
            </div>
          </div>
        )}

        {/* Closed roles */}
        {closed.length > 0 && (
          <div className="mb-8">
            <p className="text-[#7E7E8E] text-xs font-bold uppercase tracking-wider mb-3">Closed · {closed.length}</p>
            <div className="grid gap-3 opacity-70">
              {closed.map(r => <RoleCard key={r.id} role={r} />)}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
