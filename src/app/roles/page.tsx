import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RoleInterestButton from './RoleInterestButton'
import { getPrestigeForCompany, topAccolade } from '@/lib/company-prestige'
import { companyTrustRatings } from '@/lib/trust'

type Role = {
  id: string
  title: string
  department: string | null
  location: string | null
  remote: boolean
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  salary_visible: boolean
  description: string | null
  status: string
  created_at: string
  company_id: string
  engagement_type: string | null
}

export default async function RolesBoard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, industry, skills, location')
    .eq('id', user.id)
    .single()

  // Only bounce actual company accounts — candidates may have type=null
  // (signup doesn't always set it), and they should still see the roles board.
  if (profile?.type === 'company') redirect('/company/dashboard')

  // Fetch all active roles
  const admin = createAdminClient()
  const { data: roles } = await admin
    .from('roles')
    .select('id, title, department, location, remote, salary_min, salary_max, salary_currency, salary_visible, description, status, created_at, company_id, engagement_type')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // Fetch companies for the roles (get company names)
  const companyIds = [...new Set((roles || []).map(r => r.company_id))]
  const { data: companies } = await admin
    .from('profiles')
    .select('id, company_name, full_name, company_data')
    .in('id', companyIds)

  const trustMap = await companyTrustRatings(admin, companyIds)
  const companyMap: Record<string, { name: string; glassdoor?: number; trust?: { avg: number; count: number } }> = {}
  for (const c of companies || []) {
    const cd = c.company_data as Record<string, unknown> | null
    companyMap[c.id] = {
      name: c.company_name || c.full_name || 'Company',
      glassdoor: cd?.glassdoor_rating as number | undefined,
      trust: trustMap.get(c.id),
    }
  }

  // Fetch candidate's existing interests
  const { data: interests } = await supabase
    .from('candidate_interests')
    .select('role_id')
    .eq('candidate_id', user.id)

  const interestedRoleIds = new Set((interests || []).map(i => i.role_id))

  // Score roles for this candidate
  const candidateSkills = (profile?.skills as string[] || []).map(s => s.toLowerCase())
  const candidateLocation = (profile?.location as string || '').toLowerCase()

  const scoredRoles = (roles || []).map(role => {
    let score = 0
    const roleText = `${role.title} ${role.department || ''} ${role.description || ''}`.toLowerCase()
    const skillHits = candidateSkills.filter(s => roleText.includes(s)).length
    score += Math.min(50, skillHits * 10)
    if (role.location && candidateLocation) {
      if (role.location.toLowerCase().includes(candidateLocation.split(',')[0]) || candidateLocation.includes(role.location.toLowerCase().split(',')[0])) score += 30
    }
    if (role.remote) score += 10
    return { ...role, match_score: Math.min(100, score + 10) }
  }).sort((a, b) => b.match_score - a.match_score)

  return (
    <div className="min-h-screen bg-[#0E0E13]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.10), rgba(240,140,174,0.10)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .card-hover:hover {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.22), rgba(240,140,174,0.22)) border-box;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-4 border-b border-[rgba(255,255,255,0.08)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-black text-xl tracking-tighter" style={{
            background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>shapi</Link>
          <div className="flex items-center gap-4">
            <Link href="/active" className="text-[#A6A6B4] text-sm hover:text-[#C7C7D1] transition-colors">Active search →</Link>
            <Link href="/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">Dashboard</Link>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#F4F4F7] mb-2">Open roles</h1>
          <p className="text-[#A6A6B4] text-sm">
            {scoredRoles.length} verified company role{scoredRoles.length !== 1 ? 's' : ''} · ranked by match to your profile · click to express interest
          </p>
        </div>

        {scoredRoles.length === 0 ? (
          <div className="gradient-border-card rounded-2xl p-16 text-center">
            <p className="text-[#A6A6B4] font-bold">No active roles yet</p>
            <p className="text-[#5C5C6A] text-sm mt-2">Companies are onboarding now — check back soon.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {scoredRoles.map(role => {
              const company = companyMap[role.company_id] || { name: 'Company' }
              const isInterested = interestedRoleIds.has(role.id)
              const matchColor = role.match_score >= 60 ? '#6AA8F5' : role.match_score >= 40 ? '#6AA8F5' : '#F08CAE'
              const matchLabel = role.match_score >= 60 ? 'Strong match' : role.match_score >= 40 ? 'Good match' : 'Possible'

              return (
                <div key={role.id} className="gradient-border-card card-hover rounded-2xl p-6 transition-all duration-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h3 className="text-[#F4F4F7] font-black text-lg">{role.title}</h3>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{ background: `${matchColor}18`, color: matchColor }}>
                          {matchLabel}
                        </span>
                        {role.remote && (
                          <span className="bg-[rgba(255,255,255,0.05)] text-[#A6A6B4] text-xs px-2.5 py-1 rounded-full">Remote OK</span>
                        )}
                        {role.engagement_type && role.engagement_type !== 'permanent' && (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize"
                            style={{ background: 'rgba(240,140,174,0.14)', color: '#F08CAE' }}>
                            {role.engagement_type === 'temp' ? 'Temp / Shift' : 'Contract'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-[#C7C7D1] text-sm">{company.name}</p>
                        {(() => {
                          const prestige = getPrestigeForCompany(company.name)
                          if (!prestige) return null
                          const accolade = topAccolade(prestige)
                          if (!accolade) return null
                          const toneColors = {
                            gold:   { bg: 'rgba(251,191,36,0.13)', fg: '#D97706' },
                            teal:   { bg: 'rgba(106,168,245,0.12)', fg: '#6AA8F5' },
                            purple: { bg: 'rgba(240,140,174,0.13)', fg: '#F08CAE' },
                          }[accolade.tone]
                          return (
                            <span
                              title={accolade.tooltip}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full cursor-help"
                              style={{ background: toneColors.bg, color: toneColors.fg }}
                            >
                              ★ {accolade.label}
                            </span>
                          )
                        })()}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#7E7E8E] mb-3 flex-wrap">
                        {role.department && <span>{role.department}</span>}
                        {role.location && <span>📍 {role.location}</span>}
                        {(() => {
                          // Use curated glassdoor first (more reliable), fall back to company-provided
                          const prestige = getPrestigeForCompany(company.name)
                          const score = prestige?.glassdoor ?? company.glassdoor
                          return score ? <span>⭐ {score} Glassdoor</span> : null
                        })()}
                        {company.trust && company.trust.count > 0 && (
                          <span className="font-bold" style={{ color: '#6AA8F5' }}>✓ {company.trust.avg}/5 Shapi trust ({company.trust.count})</span>
                        )}
                        <span>Posted {new Date(role.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      </div>
                      {role.salary_visible && role.salary_min && role.salary_max && (
                        <p className="text-[#6AA8F5] text-sm font-bold mb-3">
                          {role.salary_currency} {role.salary_min.toLocaleString()} – {role.salary_max.toLocaleString()}
                        </p>
                      )}
                      {role.description && (
                        <p className="text-[#A6A6B4] text-xs leading-relaxed line-clamp-2">{role.description}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-2xl font-black" style={{ color: matchColor }}>{role.match_score}%</div>
                        <div className="text-[#5C5C6A] text-[10px]">match</div>
                      </div>
                      <RoleInterestButton roleId={role.id} initialInterested={isInterested} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
