import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RolesList from './RolesList'
import SubscribeButton from '@/components/SubscribeButton'
import { companyTrustRatings } from '@/lib/trust'
import { hasOpenRolesBoard } from '@/lib/subscriptions'

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
  accepts_pivot_candidates: boolean | null
}

export default async function RolesBoard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, industry, skills, location, cv_tier, paid, subscription_product')
    .eq('id', user.id)
    .single()

  // Only bounce actual company accounts — candidates may have type=null
  // (signup doesn't always set it), and they should still see the roles board.
  if (profile?.type === 'company') redirect('/company/dashboard')

  // Roles Board is a paid product (STRATEGY pricing). Free users get a taste —
  // top 3 roles with the description blurred. Subscribers see everything.
  // Subscription tiers that unlock: roles_board_*, active_*, concierge_*,
  // bundle_*. CV Pro / Kit purchase does NOT unlock the board (separate product).
  const hasBoard = hasOpenRolesBoard(profile)

  // Fetch all active roles
  const admin = createAdminClient()
  // select('*') so the board stays resilient if the accepts_pivot_candidates
  // (pivot_jobs.sql) migration hasn't been applied yet — an explicit column list
  // would 500 the whole candidate roles board on a missing column.
  const { data: roles } = await admin
    .from('roles')
    .select('*')
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
    <div className="min-h-screen bg-[#060609]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                      linear-gradient(135deg, rgba(56, 189, 248, 0.10), rgba(56, 189, 248, 0.10)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .card-hover:hover {
          background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                      linear-gradient(135deg, rgba(56, 189, 248, 0.22), rgba(56, 189, 248, 0.22)) border-box;
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
            background: 'linear-gradient(135deg,#38BDF8, #34D399)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>shapi</Link>
          <div className="flex items-center gap-4">
            <Link href="/active" className="text-[#A6A6B4] text-sm hover:text-[#C7C7D1] transition-colors">Active search →</Link>
            <Link href="/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">Dashboard</Link>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">
        <div className="mb-6">
          <h1 className="text-3xl font-black mb-2" style={{ color: '#FB7185' }}>Open roles</h1>
          <p className="text-[#A6A6B4] text-sm max-w-2xl">
            Verified company roles, ranked by how well they match you. Every company here is trust-scored &mdash; salary paid on time, real hours, manager quality &mdash; so you can apply with confidence.
          </p>
        </div>

        {/* Free users see the top 3 roles with the description blurred + an
            inline paywall card. Subscribers see everything. Surface salary +
            company name in the previews — visible enough to feel real, gated
            enough to convert. */}
        {!hasBoard && scoredRoles.length > 0 && (
          <div className="mb-5 rounded-2xl p-5 flex items-center gap-4" style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(56, 189, 248, 0.12))', border: '1px solid rgba(56, 189, 248, 0.30)' }}>
            <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg,#38BDF8, #34D399)' }}>🔓</div>
            <div className="flex-1 min-w-0">
              <p className="text-[#F4F4F7] font-black text-base mb-0.5">Unlock all {scoredRoles.length} roles · $59/mo</p>
              <p className="text-[#A6A6B4] text-xs leading-relaxed">You&apos;re seeing 3 previews. Shapi Pro unlocks every verified role + applies you straight from WhatsApp.</p>
            </div>
            <SubscribeButton product="active_monthly" className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-black text-white whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}>
              Unlock →
            </SubscribeButton>
          </div>
        )}

        <RolesList
          roles={hasBoard ? scoredRoles : scoredRoles.slice(0, 3)}
          companyMap={companyMap}
          interestedRoleIds={[...interestedRoleIds]}
          blurred={!hasBoard}
        />
      </div>
    </div>
  )
}
