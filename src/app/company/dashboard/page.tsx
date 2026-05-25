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
      .select('full_name, type, paid, subscription_status, company_name, company_data, company_size')
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
    integrator: 'bg-[#F08CAE]/10 text-[#F08CAE]',
    builder: 'bg-[#F58E9A]/10 text-[#F58E9A]',
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
                      linear-gradient(135deg, rgba(106,168,245,0.12), rgba(240,140,174,0.12)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .card-hover:hover {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.25), rgba(240,140,174,0.25)) border-box;
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
                      linear-gradient(135deg, #6AA8F5, #F08CAE) border-box;
          border: 1px solid transparent;
          color: #F4F4F7;
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Nav — company "red world" band */}
      <nav className="relative z-10" style={{ background: 'linear-gradient(120deg, #F58E9A 0%, #F58E9A 45%, #F08CAE 100%)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ShapiCharacter mood="happy" size={30} />
            <span className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/company/pipeline" className="text-white/85 text-sm font-bold hover:text-white transition-colors">Pipeline →</Link>
            <span className="text-white/60 text-sm hidden sm:block">{companyName}</span>
            {!isPaid && (
              <Link href="/company/pricing"
                className="bg-white text-[#F58E9A] text-xs font-black px-4 py-2 rounded-full hover:bg-white/90 transition-colors">
                Upgrade
              </Link>
            )}
            <form action="/api/auth/signout" method="post">
              <button className="text-white/60 text-sm hover:text-white transition-colors">Sign out</button>
            </form>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-10 pb-20">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-[#F4F4F7] mb-1">{companyName}</h1>
            <p className="text-[#A6A6B4] text-sm">
              {isPaid ? 'Full access · View profiles, contact directly' : 'Subscribe to unlock full profiles'}
            </p>
          </div>
          <Link href="/company/roles/new"
            className="flex-shrink-0 bg-gradient-to-r from-[#6AA8F5] to-[#F08CAE] px-5 py-2.5 rounded-full font-black text-xs text-[#fff] hover:opacity-90 transition-opacity">
            + Post a role
          </Link>
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

        {/* Role tabs */}
        {allRoles.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <p className="text-[#7E7E8E] text-xs font-bold uppercase tracking-wider flex-shrink-0">Matching for</p>
              <div className="flex gap-2 flex-wrap">
                {activeRoles.map(role => (
                  <Link
                    key={role.id}
                    href={`/company/dashboard?role=${role.id}`}
                    className={`role-tab ${selectedRoleId === role.id ? 'active' : ''}`}
                  >
                    {role.title}
                    {role.department && <span className="text-[#7E7E8E] font-normal ml-1">· {role.department}</span>}
                  </Link>
                ))}
                {allRoles.filter(r => r.status !== 'active').map(role => (
                  <Link
                    key={role.id}
                    href={`/company/dashboard?role=${role.id}`}
                    className={`role-tab ${selectedRoleId === role.id ? 'active' : ''}`}
                  >
                    {role.title}
                    <span className="text-[#7E7E8E] font-normal ml-1">· {role.status}</span>
                  </Link>
                ))}
              </div>
              <Link href="/company/roles/new"
                className="role-tab text-[#7E7E8E] hover:text-[#A6A6B4]">
                + New role
              </Link>
            </div>

            {selectedRole && (() => {
              const ageDays = Math.floor((Date.now() - new Date(selectedRole.created_at).getTime()) / 86400000)
              const shortlistedCount = shortlistedIds.size
              const stale = ageDays >= 21 && shortlistedCount < 2
              return (
                <>
                  <div className="gradient-border-card rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[#F4F4F7] font-bold text-sm">{selectedRole.title}</p>
                      <p className="text-[#7E7E8E] text-xs">
                        {[selectedRole.department, selectedRole.location].filter(Boolean).join(' · ')}
                        {selectedRole.salary_min && selectedRole.salary_max && (
                          <span className="text-[#6AA8F5] ml-2">
                            {selectedRole.salary_currency} {selectedRole.salary_min.toLocaleString()}–{selectedRole.salary_max.toLocaleString()}
                          </span>
                        )}
                        <span className="ml-2">· Posted {ageDays === 0 ? 'today' : `${ageDays} day${ageDays !== 1 ? 's' : ''} ago`}</span>
                      </p>
                    </div>
                    <p className="text-[#7E7E8E] text-xs flex-shrink-0">
                      {count} candidate{count !== 1 ? 's' : ''} scored · {shortlistedCount} shortlisted
                    </p>
                  </div>

                  {/* Job health nudge — Shapi proactively offers help on stale roles */}
                  {stale && (
                    <div className="rounded-xl px-4 py-3 mt-2" style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)' }}>
                      <p className="text-sm font-bold" style={{ color: '#FBBF24' }}>⏳ This role&apos;s been open {ageDays} days with little traction.</p>
                      <p className="text-[#A6A6B4] text-xs mt-1 leading-relaxed">
                        Common fixes: salary below market for the level, the must-haves are too strict, or the JD is too narrow.
                        Want a hand? <a href="mailto:hello@shapi.io?subject=Help with my role" className="font-bold" style={{ color: '#FBBF24' }}>Ask Shapi to review it →</a>
                      </p>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {/* No roles yet — prompt */}
        {allRoles.length === 0 && (
          <div className="gradient-border-card rounded-2xl p-6 mb-6 flex items-center justify-between gap-6">
            <div>
              <p className="text-[#F4F4F7] font-bold mb-1">Post a role to see matched candidates</p>
              <p className="text-[#7E7E8E] text-sm">Once you post a role, we rank all verified candidates by how well they match it.</p>
            </div>
            <Link href="/company/roles/new"
              className="flex-shrink-0 bg-gradient-to-r from-[#6AA8F5] to-[#F08CAE] px-5 py-3 rounded-full font-black text-sm text-[#fff] hover:opacity-90 transition-opacity">
              Post a role →
            </Link>
          </div>
        )}

        {/* Paywall banner */}
        {!isPaid && count > 0 && (
          <div className="rounded-2xl p-6 mb-8 flex items-center justify-between gap-6"
            style={{ background: 'linear-gradient(135deg, #6AA8F5 0%, #F08CAE 100%)' }}>
            <div>
              <p className="text-white font-black text-lg mb-1">
                {count} verified profile{count !== 1 ? 's' : ''} ready to view
              </p>
              <p className="text-white/70 text-sm">
                Subscribe to unlock names, full profiles, WhatsApp conversations, and direct contact.
              </p>
            </div>
            <Link href="/company/pricing"
              className="bg-white text-[#060609] px-6 py-3 rounded-full font-black text-sm hover:opacity-90 transition-opacity flex-shrink-0">
              Unlock all →
            </Link>
          </div>
        )}

        {/* Candidate list */}
        {count === 0 ? (
          <div className="gradient-border-card rounded-2xl p-16 text-center flex flex-col items-center">
            <ShapiCharacter mood="idle" size={72} className="mb-6" />
            <p className="text-[#C7C7D1] font-bold text-lg mb-2">No verified candidates yet</p>
            <p className="text-[#7E7E8E] text-sm">We&apos;re onboarding candidates now — check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {candidates.map(c => {
              const hasDeepDive = Array.isArray(c.whatsapp_chat) && c.whatsapp_chat.length > 2
              const ms = c.match_score
              const ml = ms !== undefined ? matchLabel(ms) : null

              return (
                <div key={c.id}
                  className="gradient-border-card card-hover rounded-2xl p-6 transition-all duration-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className={`font-black text-lg ${isPaid ? 'text-[#F4F4F7]' : 'text-[#F4F4F7] blur-sm select-none'}`}>
                          {isPaid ? (c.full_name || 'Candidate') : 'Verified Candidate'}
                        </h3>
                        {c.completion_pct >= 60 && (
                          <span className="bg-[#6AA8F5]/10 text-[#6AA8F5] text-xs font-bold px-2.5 py-1 rounded-full">
                            ✓ Verified
                          </span>
                        )}
                        {hasDeepDive && (
                          <span className="bg-[#F08CAE]/10 text-[#F08CAE] text-xs font-bold px-2.5 py-1 rounded-full">
                            Deep profile
                          </span>
                        )}
                        {c.ai_tier && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${aiTierColour[c.ai_tier] || 'bg-[rgba(255,255,255,0.05)] text-[#A6A6B4]'}`}>
                            AI {c.ai_tier}
                          </span>
                        )}
                        {ml && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ml.colour}`}>
                            {ml.label}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mb-1 ${isPaid ? 'text-[#C7C7D1]' : 'text-[#C7C7D1] blur-sm select-none'}`}>
                        {isPaid ? (c.headline || '—') : 'Senior Professional · 8+ years'}
                      </p>
                      {c.location && (
                        <p className={`text-xs mb-3 ${isPaid ? 'text-[#7E7E8E]' : 'text-[#7E7E8E] blur-sm select-none'}`}>
                          📍 {isPaid ? c.location : 'Dubai, UAE'}
                        </p>
                      )}
                      {c.skills && c.skills.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {c.skills.slice(0, 5).map((skill, i) => (
                            <span key={i} className="bg-[rgba(255,255,255,0.05)] text-[#A6A6B4] text-xs px-3 py-1 rounded-full">
                              {skill}
                            </span>
                          ))}
                          {c.skills.length > 5 && (
                            <span className="text-[#7E7E8E] text-xs py-1">+{c.skills.length - 5} more</span>
                          )}
                        </div>
                      )}
                      {c.match_reasons && c.match_reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {c.match_reasons.map((r, i) => (
                            <span key={i} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(106,168,245,0.10)', color: '#6AA8F5' }}>
                              ✓ {r}
                            </span>
                          ))}
                        </div>
                      )}
                      {isPaid && c.summary && (
                        <p className="text-[#7E7E8E] text-xs leading-relaxed line-clamp-2">{c.summary}</p>
                      )}
                    </div>

                    {/* Right side */}
                    <div className="flex flex-col items-end gap-3 flex-shrink-0">
                      {ms !== undefined ? (
                        <div className="text-right">
                          <div className="text-3xl font-black" style={{
                            background: ms >= 50
                              ? 'linear-gradient(135deg, #6AA8F5, #F08CAE)'
                              : 'linear-gradient(135deg, #F08CAE, #F58E9A)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                          }}>{ms}%</div>
                          <div className="text-[#7E7E8E] text-xs">match</div>
                        </div>
                      ) : (
                        <div className="text-right">
                          <div className="text-3xl font-black" style={{
                            background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                          }}>{c.completion_pct}%</div>
                          <div className="text-[#7E7E8E] text-xs">complete</div>
                        </div>
                      )}
                      {isPaid && (
                        <Link href={`/candidates/${c.id}`}
                          className="bg-gradient-to-r from-[#6AA8F5] to-[#F08CAE] text-[#fff] text-xs font-black px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                          View profile →
                        </Link>
                      )}
                      {isPaid && selectedRoleId && (
                        <ShortlistButton
                          candidateId={c.id}
                          roleId={selectedRoleId}
                          initialShortlisted={shortlistedIds.has(c.id)}
                        />
                      )}
                    </div>
                  </div>

                  {!isPaid && (
                    <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.08)] flex items-center justify-between">
                      <p className="text-xs text-[#7E7E8E]">Subscribe to view full profile, references & contact</p>
                      <Link href="/company/pricing" className="text-xs text-[#6AA8F5] font-bold hover:opacity-80">
                        Unlock →
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
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
              className="flex-shrink-0 bg-gradient-to-r from-[#6AA8F5] to-[#F08CAE] text-[#fff] text-xs font-black px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
              Invite
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
