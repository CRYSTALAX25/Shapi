import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'
import { computeJobCompletionScore } from '@/lib/references'
import { hasOpenRolesBoard, hasActive as hasActiveProduct, hasConcierge } from '@/lib/subscriptions'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const type = user.user_metadata?.type || 'candidate'

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, cv_parsed, whatsapp_number, whatsapp_chat, completion_pct, paid, subscription_status, subscription_tier, company_name, cv_kit_purchased, cv_tier, profile_live, subscription_product')
    .eq('id', user.id)
    .single()

  // Fetch candidate signals
  let interestedRolesCount = 0
  let shortlistedByCount = 0
  let activeApplicationsCount = 0
  let evidenceCount = 0
  let completedRefsCount = 0
  // Upskilling summary
  let coursesInProgress = 0
  let coursesCompleted = 0
  let eventsBooked = 0
  let eventsAttended = 0
  if (type === 'candidate') {
    const [interestsRes, shortlistRes, appsRes, evidenceRes, refsRes, coursesRes, eventsRes] = await Promise.all([
      supabase.from('candidate_interests').select('id', { count: 'exact', head: true }).eq('candidate_id', user.id),
      supabase.from('company_shortlists').select('id', { count: 'exact', head: true }).eq('candidate_id', user.id),
      supabase.from('active_applications').select('id', { count: 'exact', head: true }).eq('candidate_id', user.id),
      supabase.from('evidence').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('candidate_references').select('id', { count: 'exact', head: true }).eq('candidate_id', user.id).eq('status', 'completed'),
      supabase.from('candidate_courses').select('status').eq('candidate_id', user.id),
      supabase.from('candidate_events').select('status').eq('candidate_id', user.id),
    ])
    interestedRolesCount = interestsRes.count ?? 0
    shortlistedByCount = shortlistRes.count ?? 0
    activeApplicationsCount = appsRes.count ?? 0
    evidenceCount = evidenceRes.count ?? 0
    completedRefsCount = refsRes.count ?? 0
    for (const c of (coursesRes.data ?? [])) {
      if (c.status === 'completed') coursesCompleted++
      else if (c.status === 'in_progress') coursesInProgress++
    }
    for (const e of (eventsRes.data ?? [])) {
      if (e.status === 'attended') eventsAttended++
      else if (e.status === 'booked') eventsBooked++
    }
  }

  // Tier detection — Pro purchase ALSO grants CV Kit access (Pro is the upgraded Kit)
  const cvKitPurchased = !!profile?.cv_kit_purchased || profile?.cv_tier === 'pro'
  // New SKU-split gating: read subscription_product[] via helpers.
  // Legacy fallback: pre-split candidates had `paid=true` or `subscription_tier` set —
  // treat them as Roles Board so they don't lose access during the transition.
  const isRolesBoard = hasOpenRolesBoard(profile) || !!profile?.paid || !!profile?.subscription_tier
  const isActive = hasActiveProduct(profile) || profile?.subscription_status === 'active'
  const isConcierge = hasConcierge(profile)

  const isProfileLive = !!profile?.profile_live

  // Concierge queue — today's AI-drafted outreach awaiting approval
  type ConciergeDraft = {
    id: string
    role_id: string
    match_score: number
    match_reasons: string[] | null
    draft_subject: string | null
    draft_body: string
    status: string
    created_at: string
  }
  let conciergeDrafts: ConciergeDraft[] = []
  let conciergeRoleMap: Record<string, { title: string; company_name: string }> = {}
  if (isConcierge) {
    const { data: drafts } = await supabase
      .from('concierge_queue')
      .select('id, role_id, match_score, match_reasons, draft_subject, draft_body, status, created_at')
      .eq('candidate_id', user.id)
      .in('status', ['pending_approval', 'auto_send', 'approved', 'sent'])
      .order('created_at', { ascending: false })
      .limit(10)
    conciergeDrafts = (drafts as ConciergeDraft[]) || []
    if (conciergeDrafts.length > 0) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()
      const roleIds = [...new Set(conciergeDrafts.map(d => d.role_id))]
      const { data: roleRows } = await admin
        .from('roles')
        .select('id, title, company_id')
        .in('id', roleIds)
      const companyIds = [...new Set((roleRows || []).map(r => r.company_id))]
      const { data: companyRows } = await admin
        .from('profiles')
        .select('id, company_name, full_name')
        .in('id', companyIds)
      const companyName: Record<string, string> = {}
      for (const c of companyRows || []) {
        companyName[c.id] = (c.company_name as string) || (c.full_name as string) || 'Company'
      }
      for (const r of roleRows || []) {
        conciergeRoleMap[r.id] = {
          title: r.title,
          company_name: companyName[r.company_id] || 'Company',
        }
      }
    }
  }

  // Dynamic completion — calculated from real data, tier-aware
  // 100% ONLY when both jobs have all 3 references verified (profile_live=true)
  // Tiered: 0 jobs = 75% floor, 1 of 2 = 85%, 2 of 2 = 100%
  const refScore = type === 'candidate'
    ? await computeJobCompletionScore(user.id)
    : { bonusPct: 0, jobsComplete: 0 as const, job1: { manager: false, colleague: false, stakeholder: false, complete: false }, job2: { manager: false, colleague: false, stakeholder: false, complete: false } }
  let completion: number
  if (isRolesBoard) {
    // Roles Board tier: CV + WhatsApp + Evidence + References tiered bonus
    let score = 0
    if (profile?.cv_parsed) score += 25
    if (profile?.whatsapp_number) score += 25
    if (evidenceCount > 0) score += 25
    score += refScore.bonusPct
    completion = score
  } else {
    // CV Kit tier: CV parsed + WhatsApp + Purchased + Reference bonus
    let score = 0
    if (profile?.cv_parsed) score += 25
    if (profile?.whatsapp_number) score += 25
    if (cvKitPurchased) score += 25
    score += refScore.bonusPct
    completion = score
  }
  const firstName = profile?.full_name?.split(' ')[0] || null
  const circumference = 2 * Math.PI * 34
  const dashOffset = circumference * (1 - completion / 100)

  const chatLength = Array.isArray(profile?.whatsapp_chat) ? profile.whatsapp_chat.length : 0
  const conversationDone = chatLength >= 8

  // Pick Shapi mood based on candidate state
  const shapiMood = !profile?.cv_parsed
    ? 'idle'
    : !profile?.whatsapp_number
    ? 'listening'
    : conversationDone
    ? 'happy'
    : 'thinking'

  const shapiMessage = !profile?.cv_parsed
    ? `Hey${firstName ? ` ${firstName}` : ''} — drop your CV and I'll take it from here. No forms, I promise.`
    : !profile?.whatsapp_number
    ? `CV's in. Now I want to hear about the stuff that never makes it onto paper. Check your WhatsApp.`
    : conversationDone
    ? `Your profile is being built${firstName ? `, ${firstName}` : ''}. I've got everything I need — sit tight.`
    : `I'm working through your profile. Keep an eye on WhatsApp — I may have a few more questions.`

  return (
    <div className="min-h-screen bg-[#060609] text-white">
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animated-gradient {
          background: linear-gradient(135deg, #A78BFA, #22D3EE, #FB7185, #A78BFA);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 5s ease infinite;
        }
        .gradient-border-card {
          background: linear-gradient(#060609, #060609) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.18), rgba(139,92,246,0.18)) border-box;
          border: 1px solid transparent;
          transition: all 0.25s ease;
        }
        .gradient-border-card:hover {
          background: linear-gradient(#09090f, #09090f) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.5), rgba(139,92,246,0.5)) border-box;
        }
      `}</style>

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.09) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Nav */}
      <nav className="relative z-20 px-6 py-5 flex items-center justify-between max-w-6xl mx-auto border-b border-white/[0.05]">
        <Link href="/" className="animated-gradient font-black text-xl tracking-tighter">shapi</Link>
        <div className="flex items-center gap-5">
          <span className="text-sm text-white/25 hidden sm:block">{user.email}</span>
          {type === 'candidate' && (
            <>
              <Link href="/roles" className="text-sm text-white/40 hover:text-white/70 transition-colors hidden md:block">Roles</Link>
              <Link href="/active" className="text-sm text-white/40 hover:text-white/70 transition-colors hidden md:block">Active</Link>
              <Link href="/profile" className="text-sm text-[#22D3EE] font-semibold hover:opacity-80 transition-opacity">
                View profile →
              </Link>
            </>
          )}
          {type === 'company' && (
            <Link href="/company/dashboard" className="text-sm text-[#22D3EE] font-semibold hover:opacity-80 transition-opacity">
              Browse candidates →
            </Link>
          )}
          <form action="/api/auth/signout" method="post">
            <button className="text-sm text-white/30 hover:text-white/70 transition-colors">Sign out</button>
          </form>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-12 pb-24">

        {/* ─── CANDIDATE VIEW ─── */}
        {type === 'candidate' && (
          <>
            {/* Shapi greeting banner */}
            <div className="gradient-border-card rounded-2xl p-5 mb-6 flex items-center gap-5">
              <ShapiCharacter mood={shapiMood} size={64} className="flex-shrink-0" />
              <div>
                <p className="text-white/35 text-[10px] font-bold uppercase tracking-widest mb-1">Shapi says</p>
                <p className="text-white text-sm leading-relaxed font-medium">{shapiMessage}</p>
              </div>
              {!profile?.cv_parsed && (
                <Link href="/upload-cv"
                  className="ml-auto flex-shrink-0 bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] px-4 py-2 rounded-full text-xs font-black text-[#060609] hover:opacity-90 transition-opacity">
                  Start →
                </Link>
              )}
            </div>

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-black text-white mb-1">
                Welcome{completion > 0 ? ' back' : ''}{firstName ? `, ${firstName}` : ''}.
              </h1>
              {/* Sub-headline only when there's a real headline to show; otherwise the
                  progress card below carries the "what's next" message. Avoids duplicate
                  "your profile is being built" text. */}
              {profile?.headline && (
                <p className="text-white/35 text-sm">{profile.headline}</p>
              )}
            </div>

            {/* Progress card */}
            <div className="gradient-border-card rounded-2xl p-7 mb-5">
              <div className="flex items-center gap-6">
                {/* Ring */}
                <div className="relative flex-shrink-0 w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
                    <circle
                      cx="40" cy="40" r="34" fill="none"
                      stroke="url(#progGrad)" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                    />
                    <defs>
                      <linearGradient id="progGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22D3EE" />
                        <stop offset="100%" stopColor="#A78BFA" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black text-white">{completion}%</span>
                  </div>
                </div>

                {/* % only — Start CTA lives in the Shapi-says card above, not duplicated here */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-black text-white mb-0">
                    {completion}% complete
                  </h2>
                </div>
              </div>

              <div className="mt-5 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${completion}%`,
                  background: 'linear-gradient(90deg, #22D3EE, #A78BFA)',
                }} />
              </div>
            </div>

            {/* WhatsApp tips — surfaces hidden intent commands so candidates know what to say */}
            {profile?.whatsapp_number && (
              <details className="gradient-border-card rounded-2xl p-4 mb-5">
                <summary className="cursor-pointer flex items-center gap-2 text-white/70 text-sm font-bold list-none">
                  <span>💡</span>
                  <span>Things you can say in WhatsApp anytime</span>
                  <span className="ml-auto text-white/30 text-xs">tap to view</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                  <p className="text-white/55 text-xs leading-relaxed">
                    During the interview or reference Q&amp;A, type or send a voice note saying any of:
                  </p>
                  <ul className="text-white/55 text-xs leading-relaxed space-y-1.5 pl-1">
                    <li><span className="font-bold text-[#22D3EE]">&quot;skip&quot;</span> or <span className="font-bold text-[#22D3EE]">&quot;next&quot;</span> — move to the next question</li>
                    <li><span className="font-bold text-[#22D3EE]">&quot;repeat that&quot;</span> — re-ask the previous question</li>
                    <li><span className="font-bold text-[#22D3EE]">&quot;start over&quot;</span> or <span className="font-bold text-[#22D3EE]">&quot;restart&quot;</span> — wipe + begin the interview fresh</li>
                    <li><span className="font-bold text-[#22D3EE]">&quot;I&apos;m done&quot;</span> — wrap up the current interview</li>
                    <li><span className="font-bold text-[#22D3EE]">&quot;I don&apos;t know&quot;</span> — totally fine, we&apos;ll move on</li>
                  </ul>
                  <p className="text-white/40 text-xs leading-relaxed pt-2">
                    🎙 <strong>Voice notes work in any language</strong> — Arabic, Tagalog, Spanish, Hindi, whatever&apos;s easier. We transcribe + respond in the same language.
                  </p>
                </div>
              </details>
            )}

            {/* ── Tier label ── */}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-white/20 text-xs font-bold uppercase tracking-wider">Your plan:</span>
              {isConcierge ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.18)', color: '#FBBF24' }}>Active Concierge</span>
              ) : isActive ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(251,113,133,0.15)', color: '#FB7185' }}>Shapi Active</span>
              ) : isRolesBoard ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(34,211,238,0.12)', color: '#22D3EE' }}>Open Roles Board</span>
              ) : cvKitPurchased ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(167,139,250,0.12)', color: '#A78BFA' }}>CV Kit</span>
              ) : (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>Free</span>
              )}
            </div>

            {/* Status grid */}
            <div className="grid md:grid-cols-2 gap-4">

              {/* CV */}
              {profile?.cv_parsed ? (
                <div className="gradient-border-card rounded-2xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-white text-sm">CV uploaded & parsed</h3>
                        <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">Done</span>
                      </div>
                      <p className="text-white/35 text-xs">Skills extracted. Profile building in progress.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <Link href="/upload-cv" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#22D3EE]/15 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#22D3EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-white text-sm">Upload your CV</h3>
                        <span className="text-[10px] font-bold bg-[#22D3EE]/15 text[#22D3EE] px-2 py-0.5 rounded-full">Start here →</span>
                      </div>
                      <p className="text-white/35 text-xs">Drop it and we build your profile. 3 minutes.</p>
                    </div>
                  </div>
                </Link>
              )}

              {/* WhatsApp */}
              {profile?.whatsapp_number ? (
                <div className="gradient-border-card rounded-2xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-white text-sm">WhatsApp connected</h3>
                        <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">Active</span>
                      </div>
                      <p className="text-white/35 text-xs">{profile.whatsapp_number} — expect a message from us.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="gradient-border-card rounded-2xl p-6 opacity-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/15 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#A78BFA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm mb-0.5">WhatsApp deep-dive</h3>
                      <p className="text-white/35 text-xs">Complete CV upload to add your number.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* CV Kit CTA — only if not yet purchased */}
              {!cvKitPurchased && profile?.cv_parsed && (
                <Link href="/pay" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.02] md:col-span-2" style={{
                  background: 'linear-gradient(#0d0d14,#0d0d14) padding-box, linear-gradient(135deg,rgba(167,139,250,0.3),rgba(34,211,238,0.2)) border-box',
                  border: '1px solid transparent',
                }}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-white text-sm">Get your enhanced CV</h3>
                        <span className="text-[10px] font-bold bg-[#A78BFA]/15 text-[#A78BFA] px-2 py-0.5 rounded-full">From $25 one-time</span>
                      </div>
                      <p className="text-white/35 text-xs">English + native language version, industry-optimised, send to WhatsApp or email.</p>
                    </div>
                    <span className="text-[#A78BFA] font-black text-sm flex-shrink-0">Unlock →</span>
                  </div>
                </Link>
              )}

              {/* CV Kit done */}
              {cvKitPurchased && (
                <Link href="/cv-ready" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-white text-sm">CV Kit</h3>
                        <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">Ready ✓</span>
                      </div>
                      <p className="text-white/35 text-xs">Your enhanced CV is ready — download or send it.</p>
                    </div>
                  </div>
                </Link>
              )}

              {/* Independent verification — visible for ALL candidates (references are part of the standard 75→100% completion) */}
              <Link href="/profile/references" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${refScore.jobsComplete === 2 ? 'bg-emerald-500/15' : refScore.jobsComplete === 1 ? 'bg-amber-500/15' : 'bg-white/[0.05]'}`}>
                    <svg className={`w-5 h-5 ${refScore.jobsComplete === 2 ? 'text-emerald-400' : refScore.jobsComplete === 1 ? 'text-amber-400' : 'text-white/30'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={refScore.jobsComplete === 2 ? 2 : 1.5} d={refScore.jobsComplete === 2 ? 'M5 13l4 4L19 7' : 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'} />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-white text-sm">Independent verification</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${refScore.jobsComplete === 2 ? 'bg-emerald-500/15 text-emerald-400' : refScore.jobsComplete === 1 ? 'bg-amber-500/15 text-amber-400' : 'bg-white/[0.07] text-white/35'}`}>
                        {refScore.jobsComplete} of 2 jobs ✓
                      </span>
                    </div>
                    <p className="text-white/35 text-xs">
                      {refScore.jobsComplete === 2
                        ? 'Both jobs verified — manager + colleague + stakeholder each.'
                        : refScore.jobsComplete === 1
                        ? 'One job verified. Add a second manager to hit 100%.'
                        : 'Add the manager from your 2 latest jobs — we contact them, they nominate a colleague + stakeholder.'}
                    </p>
                  </div>
                </div>
              </Link>

              {/* Work evidence — visible for ALL candidates */}
              <Link href="/evidence" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${evidenceCount > 0 ? 'bg-emerald-500/15' : 'bg-[#FB7185]/15'}`}>
                    {evidenceCount > 0 ? (
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-[#FB7185]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-white text-sm">Work evidence</h3>
                      {evidenceCount > 0 ? (
                        <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">{evidenceCount} file{evidenceCount !== 1 ? 's' : ''} ✓</span>
                      ) : (
                        <span className="text-[10px] font-bold bg-[#FB7185]/15 text-[#FB7185] px-2 py-0.5 rounded-full">Add now</span>
                      )}
                    </div>
                    <p className="text-white/35 text-xs">{evidenceCount > 0 ? 'Photos and docs uploaded — adds weight to your profile.' : 'Photos and docs that prove your experience.'}</p>
                  </div>
                </div>
              </Link>

              {/* Upskilling summary — compact card linking to /upskill */}
              <Link href="/upskill" className="md:col-span-2 rounded-2xl p-5 block transition-colors hover:bg-white/[0.02]" style={{
                background: 'linear-gradient(#0d0d14,#0d0d14) padding-box, linear-gradient(135deg,rgba(34,211,238,0.2),rgba(52,211,153,0.15)) border-box',
                border: '1px solid transparent',
              }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[#34D399] text-xs font-bold uppercase tracking-wider mb-1">Upskilling</p>
                    <h3 className="font-black text-white text-sm mb-1">
                      {(coursesInProgress + coursesCompleted + eventsBooked + eventsAttended) > 0
                        ? 'Keep your momentum going'
                        : 'Close your skill gaps'}
                    </h3>
                    <p className="text-white/45 text-xs">
                      {(coursesInProgress + coursesCompleted + eventsBooked + eventsAttended) > 0
                        ? [
                            coursesInProgress > 0 ? `${coursesInProgress} learning` : null,
                            coursesCompleted > 0 ? `${coursesCompleted} completed` : null,
                            eventsBooked > 0 ? `${eventsBooked} event${eventsBooked === 1 ? '' : 's'} booked` : null,
                            eventsAttended > 0 ? `${eventsAttended} attended` : null,
                          ].filter(Boolean).join(' · ')
                        : 'Courses (free / paid / financed) + events from your Career Roadmap.'}
                    </p>
                  </div>
                  <span className="text-[#34D399] text-sm font-bold flex-shrink-0">Open →</span>
                </div>
              </Link>

              {/* Concierge queue — today's AI-drafted outreach */}
              {isConcierge && (
              <div className="md:col-span-2 rounded-2xl p-6" style={{
                background: 'linear-gradient(#0d0d14,#0d0d14) padding-box, linear-gradient(135deg,rgba(251,191,36,0.35),rgba(251,113,133,0.25)) border-box',
                border: '1px solid transparent',
              }}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-[#FBBF24] text-xs font-bold uppercase tracking-wider mb-1">Concierge · today's shortlist</p>
                    <h3 className="font-black text-white text-lg">
                      {conciergeDrafts.length > 0
                        ? `${conciergeDrafts.length} role${conciergeDrafts.length === 1 ? '' : 's'} matched · ready to send`
                        : 'No new matches today'}
                    </h3>
                    <p className="text-white/45 text-xs mt-1">AI scans open roles every morning and drafts personalised intros — you review, approve, send.</p>
                  </div>
                  <form action="/api/concierge/scan" method="POST">
                    <button type="submit" className="text-[#FBBF24] text-xs font-bold border border-[#FBBF24]/30 hover:border-[#FBBF24]/60 px-3 py-1.5 rounded-full transition-colors">
                      Refresh now
                    </button>
                  </form>
                </div>
                {conciergeDrafts.length > 0 && (
                  <div className="space-y-3">
                    {conciergeDrafts.slice(0, 3).map(draft => {
                      const role = conciergeRoleMap[draft.role_id]
                      return (
                        <div key={draft.id} className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <p className="text-white text-sm font-bold">{role?.title || 'Role'}</p>
                              <p className="text-white/40 text-xs">{role?.company_name || ''}</p>
                            </div>
                            <span className="text-[#FBBF24] text-xs font-black">{draft.match_score}%</span>
                          </div>
                          {draft.draft_subject && (
                            <p className="text-white/50 text-xs mt-2 italic">&ldquo;{draft.draft_subject}&rdquo;</p>
                          )}
                          <p className="text-white/35 text-[11px] mt-1 line-clamp-2">{draft.draft_body.slice(0, 220)}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              draft.status === 'sent' ? 'bg-emerald-500/15 text-emerald-400' :
                              draft.status === 'approved' ? 'bg-[#22D3EE]/15 text-[#22D3EE]' :
                              draft.status === 'auto_send' ? 'bg-[#FBBF24]/15 text-[#FBBF24]' :
                              'bg-white/[0.06] text-white/40'
                            }`}>
                              {draft.status.replace('_', ' ')}
                            </span>
                            {draft.match_reasons && draft.match_reasons.length > 0 && (
                              <span className="text-white/30 text-[10px]">{draft.match_reasons[0]}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {conciergeDrafts.length > 3 && (
                      <p className="text-white/30 text-[11px] text-center">+ {conciergeDrafts.length - 3} more in queue</p>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Matches / shortlisted signal — only Roles Board */}
              {isRolesBoard && (
              <div className={`gradient-border-card rounded-2xl p-6 md:col-span-2 ${shortlistedByCount === 0 ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/25 text-xs font-bold uppercase tracking-wider mb-1">Company signals</p>
                    <h3 className="font-bold text-white mb-1">
                      {shortlistedByCount > 0
                        ? `${shortlistedByCount} compan${shortlistedByCount === 1 ? 'y has' : 'ies have'} shortlisted you`
                        : 'Complete your profile to unlock matches'}
                    </h3>
                    <p className="text-white/35 text-xs">
                      {shortlistedByCount > 0
                        ? `You've expressed interest in ${interestedRolesCount} role${interestedRolesCount !== 1 ? 's' : ''}. Mutual matches trigger introductions.`
                        : 'Once verified, matched companies can view and reach out to you.'}
                    </p>
                  </div>
                  <div className="text-5xl font-black" style={{ color: shortlistedByCount > 0 ? '#22D3EE' : 'rgba(255,255,255,0.07)' }}>
                    {shortlistedByCount}
                  </div>
                </div>
              </div>
              )}

            </div>

            {/* ─── Open Roles Board ─── */}
            <div className="mt-4">
              <Link href="/roles" className="gradient-border-card rounded-2xl p-6 flex items-center justify-between hover:bg-white/[0.02] transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(139,92,246,0.15))' }}>
                    <svg className="w-5 h-5 text-[#22D3EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm mb-0.5">Open roles board</h3>
                    <p className="text-white/35 text-xs">Browse verified company roles ranked by your match score.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {interestedRolesCount > 0 && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(34,211,238,0.12)', color: '#22D3EE' }}>
                      {interestedRolesCount} interested
                    </span>
                  )}
                  <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </div>

            {/* ─── Shapi Active ─── */}
            <div className="mt-4">
              <Link href="/active" className="block rounded-2xl p-6 hover:opacity-90 transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, rgba(251,113,133,0.12) 0%, rgba(139,92,246,0.12) 50%, rgba(34,211,238,0.12) 100%)',
                  border: '1px solid rgba(251,113,133,0.2)',
                }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(251,113,133,0.2)', color: '#FB7185' }}>
                        NEW
                      </span>
                      <h3 className="font-bold text-white">Shapi Active</h3>
                    </div>
                    <p className="text-white/45 text-sm mb-3">
                      Scan for jobs, draft personalised outreach, track applications, prep for interviews — all in one place.
                    </p>
                    <div className="flex items-center gap-4 text-xs text-white/30">
                      <span>🔍 Job scanner</span>
                      <span>✉️ Email drafter</span>
                      <span>📋 Application tracker</span>
                      <span>🎯 Interview prep</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
                    {activeApplicationsCount > 0 && (
                      <span className="text-2xl font-black" style={{ color: '#FB7185' }}>{activeApplicationsCount}</span>
                    )}
                    {activeApplicationsCount > 0 && (
                      <span className="text-white/25 text-[10px]">applications</span>
                    )}
                    <svg className="w-5 h-5 text-white/30 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </Link>
            </div>
          </>
        )}

        {/* ─── COMPANY VIEW ─── */}
        {type === 'company' && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-black text-white mb-1">
                Welcome{completion > 0 ? ' back' : ''}{firstName ? `, ${firstName}` : ''}.
              </h1>
              <p className="text-white/35 text-sm">Post jobs, review verified candidates, manage your pipeline.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Link href="/company/onboarding" className="gradient-border-card rounded-2xl p-7 block hover:bg-white/[0.02]">
                <div className="w-11 h-11 rounded-xl bg-[#22D3EE]/15 flex items-center justify-center mb-5">
                  <svg className="w-5 h-5 text-[#22D3EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="font-bold text-white mb-1">Post a role</h3>
                <p className="text-white/40 text-sm">Add a job and start receiving verified candidate matches.</p>
              </Link>

              <Link href="/company/dashboard" className="gradient-border-card rounded-2xl p-7 block hover:bg-white/[0.02]">
                <div className="w-11 h-11 rounded-xl bg-[#A78BFA]/15 flex items-center justify-center mb-5">
                  <svg className="w-5 h-5 text-[#A78BFA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-white mb-1">Browse verified candidates</h3>
                <p className="text-white/40 text-sm">View candidates matched to your roles.</p>
              </Link>

              {profile?.subscription_status === 'active' ? (
                <div className="gradient-border-card rounded-2xl p-7 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/25 text-xs font-bold uppercase tracking-wider mb-1">Subscription</p>
                      <h3 className="font-bold text-white">{profile.subscription_tier === 'growth' ? 'Growth' : 'Starter'} plan active</h3>
                      <p className="text-white/35 text-xs mt-1">Full access to candidate profiles and outreach.</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ) : (
                <Link href="/company/pricing" className="md:col-span-2 rounded-2xl p-7 block hover:opacity-90 transition-opacity" style={{
                  background: 'linear-gradient(135deg, rgba(8,145,178,0.85) 0%, rgba(109,40,217,0.85) 100%)',
                  border: '1px solid rgba(34,211,238,0.2)',
                }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Unlock full profiles</p>
                      <h3 className="font-bold text-white text-lg mb-1">Subscribe to start hiring →</h3>
                      <p className="text-white/50 text-sm">From $299/mo · Cancel anytime · Every candidate independently verified</p>
                    </div>
                    <svg className="w-7 h-7 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
