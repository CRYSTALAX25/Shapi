import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import InviteForm from './InviteForm'
import DashboardNav from './DashboardNav'
import { scoreCandidateForRole, type MatchCandidate } from '@/lib/matching'
import SubscribeButton from '@/components/SubscribeButton'
import WhatsAppConnectCard from '@/components/WhatsAppConnectCard'
import { hasActiveHiring } from '@/lib/subscriptions'

// ── Company dashboard — redesigned 2026-06 ──────────────────────────────────
// Founder feedback: the old page was messy — mixed palettes (#0E0E13 /
// #16161F / #6AA8F5), nav pills overlapping the completion ring at mid widths,
// and big upsell banners cluttering the main flow. Now:
//   · BRAND.md kit enforced throughout (bg #060609, cards #0d0d14, cyan→purple)
//   · Real two-column shell — sidebar owns its column (see DashboardNav.tsx)
//   · Main column hierarchy: greeting + live KPI chips → "What needs you
//     today" hero → status card grid → team access
//   · Upsell moved OUT of the flow: "Plan & billing" at the nav bottom; only
//     contextual nudges remain where a feature is actually gated.
// Every data load and feature from the old page is preserved.

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
  salary_expectations: MatchCandidate['salary_expectations']
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

// Live KPI chip — header strip. One accent colour each, BRAND palette only.
function KpiChip({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
      style={{ background: `${color}1A`, border: `1px solid ${color}40`, color }}
    >
      <span className="font-black">{value}</span>
      <span className="opacity-80 font-semibold">{label}</span>
    </span>
  )
}

export default async function CompanyDashboard({ searchParams }: { searchParams: Promise<{ role?: string; snapshot?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [companyResult, membersResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, type, paid, subscription_status, company_name, company_data, company_size, location, summary, company_website, onboarding_complete, subscription_product, whatsapp_number, plan_tier')
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

  // ── Onboarding guard ──────────────────────────────────────────────────────
  // Blueprint Audit 2 bug: company users could land on /company/dashboard
  // without finishing /company/onboarding (admin-created users, type-flipped
  // accounts, signup bounces all skipped the form). Now enforced: if
  // onboarding_complete=false, force them through the form first.
  if (!(company as { onboarding_complete?: boolean | null }).onboarding_complete) {
    redirect('/company/onboarding')
  }

  const isPaid = company?.paid && company?.subscription_status === 'active'
  const hasAH = hasActiveHiring(company as Parameters<typeof hasActiveHiring>[0])
  // Has the company already paired their WhatsApp with Shapi? If not, surface
  // the "Run Shapi from WhatsApp" card as a first-encounter discovery hook.
  const hasWhatsApp = !!(company as { whatsapp_number?: string | null })?.whatsapp_number
  const companyName = company.company_name || company.full_name || 'Your company'
  const companyData = company.company_data as Record<string, unknown> | null

  // Plan tier for the "Plan & billing" nav item (upsell's new compact home).
  const planTier = ((company as { plan_tier?: string | null }).plan_tier || '').toLowerCase()
  const planLabel =
    planTier === 'enterprise' ? 'Enterprise'
    : planTier === 'pro' || planTier === 'growth' ? 'Pro'
    : hasAH ? 'Active Hiring'
    : isPaid ? 'Pro'
    : 'Free'
  const showUpgrade = planTier !== 'enterprise'

  // Fetch all active roles for this company
  const { data: roles } = await supabase
    .from('roles')
    .select('id, title, department, location, requirements, description, salary_min, salary_max, salary_currency, engagement_type, status, created_at')
    .eq('company_id', user.id)
    .order('created_at', { ascending: false })

  const allRoles: Role[] = roles || []
  const activeRoles = allRoles.filter(r => r.status === 'active')

  // Determine selected role + whether we just completed the first-run Snapshot
  // (sent here as ?snapshot=done from /company/workforce-snapshot?first=true).
  const sp = await searchParams
  const selectedRoleId = sp.role || activeRoles[0]?.id || null
  const justRanSnapshot = sp.snapshot === 'done'
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
  void shortlistedIds // candidate browsing lives on /candidates; load kept for parity

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

  // Has this company ever run a Workforce Snapshot? Used to show a
  // "Run your free analysis" nudge on the dashboard for fresh accounts.
  const { count: snapshotCount } = await admin
    .from('company_workforce_audits')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', user.id)
  const hasRunSnapshot = (snapshotCount ?? 0) > 0

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

  // Score and sort candidates if a role is selected (kept for pool count +
  // parity with /candidates; the browsing UI lives there).
  const candidates: Candidate[] = selectedRole
    ? allCandidates
        .map(c => {
          const { score, reasons } = scoreCandidateForRole(c, selectedRole)
          return { ...c, match_score: score, match_reasons: reasons }
        })
        .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
    : allCandidates

  const count = candidates.length

  const todayCount = newInterestsCount + upcomingIvsCount + needCompanyFeedbackCount + (companyCompletion < 100 ? 1 : 0)

  return (
    <div className="min-h-screen" style={{ background: '#060609' }}>
      <style>{`
        /* BRAND.md gradient-border card — hero surfaces only */
        .gradient-border-card {
          background: linear-gradient(#0d0d14, #0d0d14) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.15), rgba(167,139,250,0.15)) border-box;
          border: 1px solid transparent;
          border-radius: 1rem;
        }
        /* Plain card — everything else */
        .plain-card {
          background: #0d0d14;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 1rem;
        }
        .card-hover { transition: background 0.15s, border-color 0.15s; }
        .card-hover:hover {
          background: #11111a;
          border-color: rgba(34,211,238,0.25);
        }
        .shapi-noscroll { scrollbar-width: none; }
        .shapi-noscroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Dot-grid overlay — BRAND.md spec (cyan-tinted) */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.06) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Minimal top bar — wordmark + sign out. The Upgrade link moved to the
          "Plan & billing" item at the bottom of the sidebar. */}
      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="font-black text-xl"
            style={{ background: 'linear-gradient(135deg, #A78BFA, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '-0.02em' }}
          >
            shapi
          </Link>
          <form action="/api/auth/signout" method="post">
            <button className="text-white/40 text-sm hover:text-white/70 transition-colors">Sign out</button>
          </form>
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-8 pb-20">
        <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">

          {/* Sidebar (lg) / horizontal scroll strip (<lg) + Plan & billing */}
          <DashboardNav planLabel={planLabel} showUpgrade={showUpgrade} />

          {/* ── Main column ── */}
          <main className="min-w-0">

            {/* (a) Greeting header + live KPI chips */}
            <header className="mb-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Company dashboard</p>
                  <h1 className="text-3xl font-black text-white truncate" style={{ letterSpacing: '-0.02em' }}>{companyName}</h1>
                </div>
                <Link
                  href="/company/roles/new"
                  className="flex-shrink-0 px-5 py-2.5 rounded-full font-black text-xs text-white hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #22D3EE, #A78BFA)' }}
                >
                  + Post a role
                </Link>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <KpiChip value={`${companyCompletion}%`} label="org verified" color={companyCompletion >= 100 ? '#34D399' : '#22D3EE'} />
                <KpiChip value={`${activeRoles.length}`} label={activeRoles.length === 1 ? 'active role' : 'active roles'} color="#A78BFA" />
                <KpiChip value={`${count}`} label="candidates in pool" color="#22D3EE" />
              </div>
            </header>

            {/* Snapshot-just-completed celebration + Growth trial CTA — peak-intent
                contextual moment (lands here from /company/workforce-snapshot?first=true). */}
            {justRanSnapshot && (
              <div className="rounded-2xl p-6 mb-6" style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(34,211,238,0.06))', border: '1px solid rgba(52,211,153,0.35)' }}>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: '#34D399' }}>✓</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 font-black text-base mb-1">Snapshot complete — your wedge into Shapi.</p>
                    <p className="text-white/60 text-xs mb-3.5 leading-relaxed">
                      Turn the diagnosis into action: <strong className="text-white/90">Growth ($1,500/mo)</strong> unlocks the full diagnostic suite, the Hiring Roadmap, AI-shortlisted candidates per role, and salary benchmarks per role flagged at risk. <strong className="text-white/90">14-day free trial</strong> — card on file via Stripe, no charge for 14 days, cancel anytime.
                    </p>
                    <div className="flex flex-wrap gap-3 items-center">
                      <Link href="/company/pricing?plan=growth&trial=14" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black text-[#060609]" style={{ background: '#34D399' }}>
                        Start free trial →
                      </Link>
                      <Link href="/company/workforce-snapshot" className="text-[#34D399] text-xs font-bold hover:underline">
                        View Snapshot again →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* (b) THE hero — "What needs you today". Gradient-border card,
                always present: action list when there's work, calm all-clear
                state otherwise. */}
            <section className="gradient-border-card p-6 mb-6">
              <p className="text-[#FB7185] text-[10px] font-bold uppercase tracking-[0.18em] mb-4">✦ What needs you today</p>
              {todayCount > 0 ? (
                <ul className="space-y-1">
                  {newInterestsCount > 0 && (
                    <li>
                      <Link href="/company/pipeline" className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04] transition-colors">
                        <span className="flex items-center gap-3 text-white/90 text-sm font-medium">
                          <span className="text-base leading-none">👋</span>
                          <span>{newInterestsCount} new candidate{newInterestsCount === 1 ? '' : 's'} interested in your roles this week</span>
                        </span>
                        <span className="text-[#FB7185] text-xs font-bold flex-shrink-0">→</span>
                      </Link>
                    </li>
                  )}
                  {upcomingIvsCount > 0 && (
                    <li>
                      <Link href="/company/pipeline" className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04] transition-colors">
                        <span className="flex items-center gap-3 text-white/90 text-sm font-medium">
                          <span className="text-base leading-none">📅</span>
                          <span>{upcomingIvsCount} interview{upcomingIvsCount === 1 ? '' : 's'} scheduled this week</span>
                        </span>
                        <span className="text-[#FB7185] text-xs font-bold flex-shrink-0">→</span>
                      </Link>
                    </li>
                  )}
                  {needCompanyFeedbackCount > 0 && (
                    <li>
                      <Link href="/company/pipeline" className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04] transition-colors">
                        <span className="flex items-center gap-3 text-white/90 text-sm font-medium">
                          <span className="text-base leading-none">📝</span>
                          <span>{needCompanyFeedbackCount} interview{needCompanyFeedbackCount === 1 ? '' : 's'} need your feedback</span>
                        </span>
                        <span className="text-[#FB7185] text-xs font-bold flex-shrink-0">→</span>
                      </Link>
                    </li>
                  )}
                  {companyCompletion < 100 && (
                    <li>
                      <Link href="/company/onboarding" className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04] transition-colors">
                        <span className="flex items-center gap-3 text-white/90 text-sm font-medium">
                          <span className="text-base leading-none">✦</span>
                          <span>Finish your profile — you&apos;re at {companyCompletion}%</span>
                        </span>
                        <span className="text-[#FB7185] text-xs font-bold flex-shrink-0">→</span>
                      </Link>
                    </li>
                  )}
                </ul>
              ) : (
                <div className="flex items-center gap-3 px-3 py-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#34D399' }} />
                  <p className="text-white/60 text-sm">
                    All clear — nothing needs your attention right now.{' '}
                    <Link href="/candidates" className="text-white/90 font-bold hover:underline">Browse the candidate pool →</Link>
                  </p>
                </div>
              )}
            </section>

            {/* (c) Status card grid — plain cards, max 2 accents each, never overlapping */}
            <section className="grid sm:grid-cols-2 gap-4">

              {/* Profile completion ring */}
              <div className="plain-card p-6 flex items-center gap-5">
                <div className="relative flex-shrink-0 w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                    <circle cx="40" cy="40" r="34" fill="none" stroke={companyCompletion >= 100 ? '#34D399' : 'url(#coGrad)'} strokeWidth="7" strokeLinecap="round" strokeDasharray={compCircumference} strokeDashoffset={compDashOffset} />
                    <defs>
                      <linearGradient id="coGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22D3EE" />
                        <stop offset="100%" stopColor="#A78BFA" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black" style={{ color: companyCompletion >= 100 ? '#34D399' : 'rgba(255,255,255,0.9)' }}>{companyCompletion}%</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1">Profile completion</p>
                  <h2 className="text-base font-black" style={companyCompletion >= 100 ? { color: '#34D399' } : { background: 'linear-gradient(135deg, #22D3EE, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    {companyCompletion >= 100 ? 'Verified employer ✓' : `${companyCompletion}% complete`}
                  </h2>
                  <p className="text-white/40 text-[11px] mt-1">Higher = stronger trust score</p>
                </div>
              </div>

              {/* Verified candidates — contextual gate nudge when unsubscribed */}
              <Link href="/candidates" className="plain-card card-hover p-6 block">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Verified candidates</p>
                <p className="text-2xl font-black text-white/90 mb-1">{count}</p>
                <p className="text-white/60 text-xs">ready to view — pre-referenced + AI-scored</p>
                {isPaid ? (
                  <p className="text-[#22D3EE] text-xs font-bold mt-4">Browse pool →</p>
                ) : (
                  <p className="text-[#FB7185] text-xs font-bold mt-4">Preview pool — subscribe to unlock full profiles →</p>
                )}
              </Link>

              {/* Your roles */}
              <Link href="/company/roles" className="plain-card card-hover p-6 block">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Your roles</p>
                <p className="text-2xl font-black text-white/90 mb-1">{activeRoles.length}</p>
                <p className="text-white/60 text-xs">{activeRoles.length === 0 ? 'post one to see candidates matched to it' : 'open · click a role for its matches'}</p>
                <p className="text-[#22D3EE] text-xs font-bold mt-4">{activeRoles.length === 0 ? 'Post a role →' : 'See matches per role →'}</p>
              </Link>

              {/* Workforce Snapshot nudge — first-touch acquisition wedge,
                  shown only until they've run one. STRATEGY §16 Tier A. */}
              {!hasRunSnapshot && (
                <Link href="/company/workforce-snapshot" className="plain-card card-hover p-6 block">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5" style={{ color: '#34D399' }}>✦ Start here — free</p>
                  <p className="text-white/90 text-base font-black mb-1">Run your Workforce Snapshot</p>
                  <p className="text-white/60 text-xs leading-relaxed">
                    Five inputs, zero confidential data, one honest report — your <strong className="text-white/90">Future Readiness Score</strong>, AI risk heatmap, top at-risk roles, and what AI integration will actually cost. ~30 seconds.
                  </p>
                  <p className="text-[#34D399] text-xs font-bold mt-4">Run it →</p>
                </Link>
              )}

              {/* Active Hiring — contextual nudge only while the feature is
                  gated (daily AI-shortlist per role). STRATEGY §14/§16. */}
              {!hasAH && (
                <SubscribeButton product="active_hiring_monthly" className="plain-card card-hover p-6 text-left block w-full">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A78BFA] mb-1.5">Active Hiring · $499/mo</p>
                  <p className="text-white/90 text-base font-black mb-1">Daily AI-shortlist per open role</p>
                  <p className="text-white/60 text-xs leading-relaxed">
                    We scan the verified pool every day, score the top matches for each open role, and draft personalised intro emails awaiting your one-tap approval. Annual $4,990 (save ~17%).
                  </p>
                  <p className="text-[#A78BFA] text-xs font-bold mt-4">Subscribe →</p>
                </SubscribeButton>
              )}

              {/* Connect Shapi WhatsApp — first-encounter entry point, shown
                  until the company has paired their number. needsNumber renders
                  the amber "add your number first" variant. */}
              {!hasWhatsApp && (
                <div className="sm:col-span-2">
                  <WhatsAppConnectCard role="company" needsNumber />
                </div>
              )}

              {/* Team members / invite */}
              <div className="plain-card p-6 sm:col-span-2">
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1">Team access</p>
                  <p className="text-white/60 text-xs">Invite colleagues to view candidates and manage roles</p>
                </div>

                {teamMembers.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {teamMembers.map(m => (
                      <div key={m.id} className="flex items-center justify-between px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                        <span className="text-white/70 text-sm">{m.email}</span>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={m.accepted_at
                            ? { background: 'rgba(52,211,153,0.13)', color: '#34D399' }
                            : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                        >
                          {m.accepted_at ? 'Active' : 'Invited'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <InviteForm />
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  )
}
