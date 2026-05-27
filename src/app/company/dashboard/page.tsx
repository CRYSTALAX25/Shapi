import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'
import { createAdminClient } from '@/lib/supabase/admin'
import ShortlistButton from './ShortlistButton'
import { scoreCandidateForRole, matchLabel } from '@/lib/matching'

type Candidate = {
  id: string
  full_name: string | null
  headline: string | null
  location: string | null
  skills: string[]
  ai_tier: string | null
  completion_pct: number
  summary: string | null
  whatsapp_chat: unknown[]
  industry: string | null
  verification_tier: string | null
  salary_expectations: unknown
  open_to_engagement: string[] | null
  target_roles: string[] | null
  match_score?: number
  match_reasons?: string[]
}

type Role = {
  id: string
  title: string
  department: string | null
  location: string | null
  requirements: string | null
  description: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  engagement_type: string | null
  status: string
  created_at: string
}

export default async function CompanyDashboard({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [companyResult, membersResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, type, paid, subscription_status, company_name, company_data, company_size, location, summary, company_website, onboarding_complete')
      .eq('id', user.id)
      .single(),
    supabase
      .from('company_members')
      .select('id, email, accepted_at')
      .eq('company_id', user.id)
      .order('created_at', { ascending: false }),
  ])
  const company = companyResult.data
  const teamMembers = membersResult.data || []

  if (!company || company.type !== 'company') redirect('/dashboard')

  const isPaid = company?.paid && company?.subscription_status === 'active'
  const companyName = company.company_name || company.full_name || 'Your company'
  const companyData = company.company_data as Record<string, unknown> | null

  // Fetch all active roles for this company
  const { data: roles } = await supabase
    .from('roles')
    .select('id, title, department, location, requirements, description, salary_min, salary_max, salary_currency, engagement_type, status, created_at')
    .eq('company_id', user.id)
    .order('created_at', { ascending: false })

  const allRoles: Role[] = roles || []
  const activeRoles = allRoles.filter(r => r.status === 'active')

  // Determine selected role
  const sp = await searchParams
  const selectedRoleId = sp.role || activeRoles[0]?.id || null
  const selectedRole = allRoles.find(r => r.id === selectedRoleId) || null

  // Fetch candidates (admin client)
  const admin = createAdminClient()
  const { data: rawCandidates } = await admin
    .from('profiles')
    .select('id, full_name, headline, location, skills, ai_tier, completion_pct, summary, whatsapp_chat, industry, verification_tier, salary_expectations, open_to_engagement, target_roles')
    .eq('type', 'candidate')
    .gte('completion_pct', 20)
    .order('completion_pct', { ascending: false })
    .limit(200)

  const allCandidates: Candidate[] = rawCandidates || []

  // Fetch existing shortlists for this company+role so buttons show correct state
  const { data: shortlistData } = await supabase
    .from('company_shortlists')
    .select('candidate_id')
    .eq('company_id', user.id)
    .eq('role_id', selectedRoleId || '')
  const shortlistedIds = new Set((shortlistData || []).map(s => s.candidate_id))

  // ── Today / profile-completion data for the action card + ring ──
  const nowIsoCo = new Date().toISOString()
  const sevenDaysFromNowCo = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const roleIds = allRoles.map(r => r.id)
  const [interestRes, upcomingIvsRes, completedIvsRes, coFbRes] = await Promise.all([
    roleIds.length
      ? admin.from('candidate_interests').select('id', { count: 'exact', head: true }).in('role_id', roleIds).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      : Promise.resolve({ count: 0 }),
    admin.from('interviews').select('id', { count: 'exact', head: true }).eq('company_id', user.id).eq('status', 'scheduled').gte('scheduled_at', nowIsoCo).lte('scheduled_at', sevenDaysFromNowCo),
    admin.from('interviews').select('role_id, candidate_id').eq('company_id', user.id).eq('status', 'completed'),
    admin.from('interview_feedback').select('role_id, candidate_id').eq('company_id', user.id).eq('author', 'company'),
  ])
  const newInterestsCount = interestRes.count ?? 0
  const upcomingIvsCount = upcomingIvsRes.count ?? 0
  const completedIvs = (completedIvsRes.data ?? []) as Array<{ role_id: string; candidate_id: string }>
  const coFbKeys = new Set(((coFbRes.data ?? []) as Array<{ role_id: string; candidate_id: string }>).map(f => `${f.role_id}|${f.candidate_id}`))
  const needCompanyFeedbackCount = completedIvs.filter(i => !coFbKeys.has(`${i.role_id}|${i.candidate_id}`)).length

  // Company profile completion. Truth source: profile.onboarding_complete (set by
  // /company/onboarding). For accounts pre-dating that flag — or to give credit
  // as fields fill in — fall back to a field-based score on the actual fields
  // the onboarding form writes (name, size, location, about, website). Roles +
  // glassdoor are separate ACTIVITY signals, not profile completion.
  const cdAny = (companyData || {}) as Record<string, unknown>
  type CompanyRow = { onboarding_complete?: boolean | null; location?: string | null; summary?: string | null; company_website?: string | null }
  const co = company as typeof company & CompanyRow
  const fieldSigs = [
    !!co.company_name,
    !!co.company_size,
    !!co.location,
    !!co.summary || !!cdAny.description,
    !!co.company_website || !!cdAny.glassdoor_rating,
  ]
  const fieldScore = Math.round((fieldSigs.filter(Boolean).length / fieldSigs.length) * 100)
  // onboarding_complete is the binary truth signal — if Ana clicked through the
  // onboarding form, we trust it and show 100% even if enrichment hasn't filled
  // every cosmetic field yet.
  const companyCompletion = co.onboarding_complete ? 100 : fieldScore
  const compCircumference = 2 * Math.PI * 34
  const compDashOffset = compCircumference * (1 - companyCompletion / 100)

  // Score and sort candidates if a role is selected
  const candidates: Candidate[] = selectedRole
    ? allCandidates
        .map(c => {
          const { score, reasons } = scoreCandidateForRole(c, selectedRole)
          return { ...c, match_score: score, match_reasons: reasons }
        })
        .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
    : allCandidates

  const count = candidates.length

  const aiTierColour: Record<string, string> = {
    user: 'bg-[#6AA8F5]/10 text-[#6AA8F5]',
    integrator: 'bg-[#6AA8F5]/10 text-[#6AA8F5]',
    builder: 'bg-[#4F8FE8]/10 text-[#4F8FE8]',
  }

  return (
    <div className="min-h-screen" style={{ background: '#0E0E13' }}>
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .gradient-border-card {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.12), rgba(79,143,232,0.12)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .card-hover:hover {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.25), rgba(79,143,232,0.25)) border-box;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .role-tab {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          color: #A6A6B4;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .role-tab:hover { color: #C7C7D1; border-color: rgba(255,255,255,0.18); }
        .role-tab.active {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, #6AA8F5, #4F8FE8) border-box;
          border: 1px solid transparent;
          color: #F4F4F7;
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Minimal nav — matches candidate-side dashboard convention. The old blue
          gradient bar is gone (too loud); shapi wordmark + Sign out is enough. */}
      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
          <div className="flex items-center gap-5">
            {!isPaid && (
              <Link href="/company/pricing" className="text-[#F08CAE] text-xs font-black border border-[#F08CAE]/30 hover:border-[#F08CAE]/60 px-3 py-1.5 rounded-full transition-colors">
                Upgrade
              </Link>
            )}
            <form action="/api/auth/signout" method="post">
              <button className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">Sign out</button>
            </form>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-8 pb-20">

        <div className="grid lg:grid-cols-[220px_1fr] gap-6">

          {/* ── Sidebar nav (vertical on lg, horizontal pill row on mobile) ──
              Same pattern as the candidate dashboard. Active item = blue
              "you are here" pill + coral text. Hover on others = coral. */}
          <aside className="lg:sticky lg:top-6 self-start">
            <nav className="flex flex-row overflow-x-auto lg:flex-col gap-1.5 pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0">
              {[
                { href: '#', label: 'Overview', icon: '🏠', active: true },
                { href: '/company/workforce-snapshot', label: 'Workforce Snapshot', icon: '✦' },
                { href: '/company/salary-benchmark', label: 'Salary benchmark', icon: '💸' },
                { href: '/company/roadmap', label: 'Hiring Roadmap', icon: '🗺️' },
                { href: '/company/hiring-plan', label: 'Hiring Plan', icon: '🚀' },
                { href: '/role/ai-proof', label: 'AI-Proof a role', icon: '🛡️' },
                { href: '/company/roles', label: 'Roles', icon: '💼' },
                { href: '/company/pipeline', label: 'Pipeline', icon: '📋' },
                { href: '/candidates', label: 'Candidates', icon: '👥' },
                { href: '/company/onboarding', label: 'Company profile', icon: '👤' },
              ].map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-2.5 flex-shrink-0 rounded-xl px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
                    item.active ? 'text-[#FB7185]' : 'text-[#C7C7D1] hover:text-[#FB7185]'
                  }`}
                  style={item.active
                    ? { background: 'rgba(106,168,245,0.12)', border: '1px solid rgba(106,168,245,0.28)' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </aside>

          {/* ── Main column ── */}
          <main className="min-w-0">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-[#F4F4F7] mb-1">{companyName}</h1>
            <p className="text-[#A6A6B4] text-sm">
              {isPaid ? 'Full access · View profiles, contact directly' : 'Subscribe to unlock full profiles'}
            </p>
          </div>
          <Link href="/company/roles/new"
            className="flex-shrink-0 bg-gradient-to-r from-[#6AA8F5] to-[#4F8FE8] px-5 py-2.5 rounded-full font-black text-xs text-[#fff] hover:opacity-90 transition-opacity">
            + Post a role
          </Link>
        </div>

        {/* Compact hero — profile completion ring + Today action card side-by-side */}
        <div className="grid lg:grid-cols-[260px_1fr] gap-4 mb-5 items-stretch">
          {/* Profile completion ring — green at 100, brand gradient otherwise */}
          <div className="gradient-border-card rounded-2xl p-5 flex items-center gap-4">
            <div className="relative flex-shrink-0 w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="7" />
                <circle cx="40" cy="40" r="34" fill="none" stroke={companyCompletion >= 100 ? '#34D399' : 'url(#coGrad)'} strokeWidth="7" strokeLinecap="round" strokeDasharray={compCircumference} strokeDashoffset={compDashOffset} />
                <defs>
                  <linearGradient id="coGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6AA8F5" />
                    <stop offset="50%" stopColor="#F08CAE" />
                    <stop offset="100%" stopColor="#F58E9A" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-black" style={{ color: companyCompletion >= 100 ? '#34D399' : '#F4F4F7' }}>{companyCompletion}%</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-0.5">Profile completion</p>
              <h2 className="text-base font-black" style={companyCompletion >= 100 ? { color: '#34D399' } : { background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{companyCompletion >= 100 ? 'Verified employer ✓' : `${companyCompletion}% complete`}</h2>
              <p className="text-[#7E7E8E] text-[11px] mt-0.5">Higher = stronger trust score</p>
            </div>
          </div>

          {/* Today action card — only shows items that need action; hides when empty */}
          {(newInterestsCount + upcomingIvsCount + needCompanyFeedbackCount + (companyCompletion < 100 ? 1 : 0)) > 0 && (
            <div className="gradient-border-card rounded-2xl p-5">
              <p className="text-[#F08CAE] text-[10px] font-bold uppercase tracking-wider mb-3">✦ What needs you today</p>
              <ul className="space-y-1.5">
                {newInterestsCount > 0 && (
                  <li>
                    <Link href="/company/pipeline" className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors">
                      <span className="flex items-center gap-2 text-[#F4F4F7] text-sm">
                        <span className="text-base leading-none">👋</span>
                        <span>{newInterestsCount} new candidate{newInterestsCount === 1 ? '' : 's'} interested in your roles this week</span>
                      </span>
                      <span className="text-[#F08CAE] text-xs font-bold flex-shrink-0">→</span>
                    </Link>
                  </li>
                )}
                {upcomingIvsCount > 0 && (
                  <li>
                    <Link href="/company/pipeline" className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors">
                      <span className="flex items-center gap-2 text-[#F4F4F7] text-sm">
                        <span className="text-base leading-none">📅</span>
                        <span>{upcomingIvsCount} interview{upcomingIvsCount === 1 ? '' : 's'} scheduled this week</span>
                      </span>
                      <span className="text-[#F08CAE] text-xs font-bold flex-shrink-0">→</span>
                    </Link>
                  </li>
                )}
                {needCompanyFeedbackCount > 0 && (
                  <li>
                    <Link href="/company/pipeline" className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors">
                      <span className="flex items-center gap-2 text-[#F4F4F7] text-sm">
                        <span className="text-base leading-none">📝</span>
                        <span>{needCompanyFeedbackCount} interview{needCompanyFeedbackCount === 1 ? '' : 's'} need your feedback</span>
                      </span>
                      <span className="text-[#F08CAE] text-xs font-bold flex-shrink-0">→</span>
                    </Link>
                  </li>
                )}
                {companyCompletion < 100 && (
                  <li>
                    <Link href="/company/onboarding" className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors">
                      <span className="flex items-center gap-2 text-[#F4F4F7] text-sm">
                        <span className="text-base leading-none">✦</span>
                        <span>Finish your profile — you&apos;re at {companyCompletion}%</span>
                      </span>
                      <span className="text-[#F08CAE] text-xs font-bold flex-shrink-0">→</span>
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Company intelligence */}
        {companyData && (
          <div className="gradient-border-card rounded-2xl p-5 mb-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-widest mb-1">Company intelligence</p>
                <p className="text-[#C7C7D1] text-sm leading-relaxed">{companyData.description as string}</p>
              </div>
              {!!companyData.glassdoor_rating && (
                <div className="flex-shrink-0 text-center bg-[#6AA8F5]/10 rounded-xl px-4 py-3">
                  <div className="text-2xl font-black text-[#6AA8F5]">{String(companyData.glassdoor_rating)}</div>
                  <div className="text-[#7E7E8E] text-[10px]">Glassdoor</div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!!companyData.industry && <span className="bg-[rgba(255,255,255,0.05)] text-[#A6A6B4] text-xs px-3 py-1 rounded-full">{String(companyData.industry)}</span>}
              {!!companyData.size && <span className="bg-[rgba(255,255,255,0.05)] text-[#A6A6B4] text-xs px-3 py-1 rounded-full">{String(companyData.size)} employees</span>}
              {!!companyData.headquarters && <span className="bg-[rgba(255,255,255,0.05)] text-[#A6A6B4] text-xs px-3 py-1 rounded-full">📍 {String(companyData.headquarters)}</span>}
              {!!companyData.reddit_sentiment && (
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                  companyData.reddit_sentiment === 'positive' ? 'bg-emerald-500/15 text-emerald-400' :
                  companyData.reddit_sentiment === 'negative' ? 'bg-[#F58E9A]/15 text-[#F58E9A]' :
                  'bg-[rgba(255,255,255,0.05)] text-[#A6A6B4]'
                }`}>Reddit: {String(companyData.reddit_sentiment)}</span>
              )}
            </div>
            {Array.isArray(companyData.recent_news) && companyData.recent_news.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.08)]">
                <p className="text-[#7E7E8E] text-[10px] uppercase tracking-wider mb-1">Recent news</p>
                {(companyData.recent_news as string[]).map((n, i) => (
                  <p key={i} className="text-[#A6A6B4] text-xs py-0.5">· {n}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hiring at a glance — compact overview. Full browsing lives in the
            sidebar: /candidates (pool) + /company/roles (per-role matches). */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <Link href="/candidates" className="gradient-border-card rounded-2xl p-5 hover:bg-white/[0.04] transition-colors block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-1">Verified candidates</p>
            <p className="text-2xl font-black text-[#F4F4F7] mb-1">{count}</p>
            <p className="text-[#A6A6B4] text-xs">ready to view — pre-referenced + AI-scored</p>
            <p className="text-[#F08CAE] text-xs font-bold mt-3">Browse pool →</p>
          </Link>
          <Link href="/company/roles" className="gradient-border-card rounded-2xl p-5 hover:bg-white/[0.04] transition-colors block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-1">Your roles</p>
            <p className="text-2xl font-black text-[#F4F4F7] mb-1">{activeRoles.length}</p>
            <p className="text-[#A6A6B4] text-xs">{activeRoles.length === 0 ? 'post one to see candidates matched to it' : 'open · click a role for its matches'}</p>
            <p className="text-[#F08CAE] text-xs font-bold mt-3">{activeRoles.length === 0 ? 'Post a role →' : 'See matches per role →'}</p>
          </Link>
        </div>

        {!isPaid && count > 0 && (
          <div className="rounded-2xl p-5 mb-6 flex items-center justify-between gap-4" style={{ background: 'linear-gradient(135deg, rgba(106,168,245,0.10), rgba(240,140,174,0.10))', border: '1px solid rgba(240,140,174,0.25)' }}>
            <div>
              <p className="text-[#F4F4F7] font-black text-base mb-0.5">{count} verified profile{count !== 1 ? 's' : ''} ready to view</p>
              <p className="text-[#A6A6B4] text-xs">Subscribe to unlock names, full profiles, WhatsApp histories, direct contact.</p>
            </div>
            <Link href="/company/pricing" className="flex-shrink-0 px-5 py-2.5 rounded-full font-black text-xs text-white" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
              Unlock →
            </Link>
          </div>
        )}

        {/* Team members / invite */}
        <div className="gradient-border-card rounded-2xl p-5 mt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[#F4F4F7] font-bold text-sm">Team access</p>
              <p className="text-[#7E7E8E] text-xs mt-0.5">Invite colleagues to view candidates and manage roles</p>
            </div>
          </div>

          {teamMembers.length > 0 && (
            <div className="space-y-2 mb-4">
              {teamMembers.map(m => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 bg-[rgba(255,255,255,0.05)] rounded-xl">
                  <span className="text-[#C7C7D1] text-sm">{m.email}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    m.accepted_at
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-[rgba(255,255,255,0.05)] text-[#7E7E8E]'
                  }`}>
                    {m.accepted_at ? 'Active' : 'Invited'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <form action="/api/company/invite" method="post" className="flex gap-2">
            <input
              name="email"
              type="email"
              required
              placeholder="colleague@company.com"
              className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-2.5 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#6AA8F5]/40"
            />
            <button type="submit"
              className="flex-shrink-0 bg-gradient-to-r from-[#6AA8F5] to-[#4F8FE8] text-[#fff] text-xs font-black px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
              Invite
            </button>
          </form>
        </div>

          </main>
        </div>
      </div>
    </div>
  )
}
