import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'
import SubscribeButton from '@/components/SubscribeButton'
import WhatsAppConnectCard from '@/components/WhatsAppConnectCard'
import { computeJobCompletionScore } from '@/lib/references'
import { hasOpenRolesBoard, hasActive as hasActiveProduct, hasConcierge } from '@/lib/subscriptions'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const type = user.user_metadata?.type || 'candidate'

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, cv_parsed, whatsapp_number, whatsapp_chat, completion_pct, paid, subscription_status, subscription_tier, company_name, cv_kit_purchased, cv_tier, profile_live, subscription_product, right_to_work, work_style, type, onboarding_complete')
    .eq('id', user.id)
    .single()

  // Does the candidate have a /cv-builder draft they haven't finished? Used
  // to show a "Finish your CV" resume card. We hide it once the profile is
  // built (cv_parsed=true OR completion_pct ≥ 80) — the draft has served
  // its purpose by then.
  //
  // Fetched SEPARATELY from the main profile select: cv_builder_chat comes
  // from supabase/cv_draft.sql which may not be applied yet. When the column
  // is missing, Postgres 400s the WHOLE select — which previously nulled the
  // entire profile and broke the dashboard (and mis-routed company users to
  // the candidate view). Best-effort: a failure here only hides the resume
  // card, never the dashboard.
  const { data: draftRow } = await supabase
    .from('profiles')
    .select('cv_builder_chat')
    .eq('id', user.id)
    .maybeSingle()
  const draftRaw = (draftRow as { cv_builder_chat?: unknown } | null)?.cv_builder_chat
  const draftTurns = Array.isArray(draftRaw) ? draftRaw.length : 0
  const hasCvDraft = draftTurns >= 2 && !profile?.cv_parsed && (profile?.completion_pct ?? 0) < 80

  // Companies belong on the company dashboard, not the candidate one.
  // Route them through onboarding first if it isn't complete — same guard
  // /company/dashboard uses, applied earlier in the chain.
  //
  // FALL-THROUGH ON NULL PROFILE: an earlier version redirected to
  // /login?session=lost when profile fetched as null. That created a
  // redirect loop: login → dashboard → null profile → /login?session=lost
  // → succeeds → dashboard → null profile → loop. Now we just log the
  // anomaly and let the candidate dashboard render as a degraded fallback;
  // the user can manually navigate to /company/dashboard if they're a
  // company. No loop.
  if (type === 'company' || profile?.type === 'company') {
    if (!profile) {
      console.error('[dashboard] company-type user but profile fetch returned null — letting candidate dashboard render as fallback to avoid login loop')
    } else {
      const onboardingDone = (profile as { onboarding_complete?: boolean | null }).onboarding_complete
      redirect(onboardingDone ? '/company/dashboard' : '/company/onboarding')
    }
  }

  // Fetch candidate signals
  let interestedRolesCount = 0
  let shortlistedByCount = 0
  let activeApplicationsCount = 0
  let evidenceCount = 0
  let completedRefsCount = 0
  let refsTotal = 0
  // Interviews where the candidate hasn't yet given feedback (upcoming or
  // past-but-not-yet-rated) — these are the "follow up needed" items the
  // sidebar badge surfaces, distinct from the informational application count.
  let needsActionCount = 0
  // Breakdown for the "What needs you today" action card.
  let upcomingInterviewsCount = 0
  let needFeedbackCount = 0
  let pendingDraftsCount = 0
  let pendingRefsCount = 0
  // Upskilling summary
  let coursesInProgress = 0
  let coursesCompleted = 0
  let eventsBooked = 0
  let eventsAttended = 0
  if (type === 'candidate') {
    const [interestsRes, shortlistRes, appsRes, evidenceRes, refsRes, refsTotalRes, coursesRes, eventsRes, ivsRes, ivFbRes, conciergePendingRes] = await Promise.all([
      supabase.from('candidate_interests').select('id', { count: 'exact', head: true }).eq('candidate_id', user.id),
      supabase.from('company_shortlists').select('id', { count: 'exact', head: true }).eq('candidate_id', user.id),
      supabase.from('active_applications').select('id', { count: 'exact', head: true }).eq('candidate_id', user.id),
      supabase.from('evidence').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('candidate_references').select('id', { count: 'exact', head: true }).eq('candidate_id', user.id).eq('status', 'completed'),
      supabase.from('candidate_references').select('id', { count: 'exact', head: true }).eq('candidate_id', user.id),
      supabase.from('candidate_courses').select('status').eq('candidate_id', user.id),
      supabase.from('candidate_events').select('status').eq('candidate_id', user.id),
      // Action-needed badge for "My applications": interviews scheduled where the
      // candidate has not yet posted feedback (upcoming OR past-no-feedback).
      supabase.from('interviews').select('role_id, scheduled_at').eq('candidate_id', user.id).not('scheduled_at', 'is', null),
      supabase.from('interview_feedback').select('role_id').eq('candidate_id', user.id).eq('author', 'candidate'),
      // Concierge drafts awaiting the candidate's approval — surfaced in the
      // "What needs you today" action card (only meaningful if subscribed).
      supabase.from('concierge_queue').select('id', { count: 'exact', head: true }).eq('candidate_id', user.id).eq('status', 'pending_approval'),
    ])
    interestedRolesCount = interestsRes.count ?? 0
    shortlistedByCount = shortlistRes.count ?? 0
    activeApplicationsCount = appsRes.count ?? 0
    evidenceCount = evidenceRes.count ?? 0
    completedRefsCount = refsRes.count ?? 0
    refsTotal = refsTotalRes.count ?? 0
    const fbRoleIds = new Set((ivFbRes.data ?? []).map((f: { role_id: string }) => f.role_id))
    const ivRows = (ivsRes.data ?? []) as Array<{ role_id: string; scheduled_at: string | null }>
    needsActionCount = ivRows.filter(i => !fbRoleIds.has(i.role_id)).length
    const now = Date.now()
    upcomingInterviewsCount = ivRows.filter(i => i.scheduled_at && new Date(i.scheduled_at).getTime() > now).length
    needFeedbackCount = ivRows.filter(i => i.scheduled_at && new Date(i.scheduled_at).getTime() <= now && !fbRoleIds.has(i.role_id)).length
    pendingDraftsCount = conciergePendingRes.count ?? 0
    pendingRefsCount = Math.max(0, refsTotal - completedRefsCount)
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
  // Strict SKU-split gating: each product needs its OWN subscription. No legacy fallbacks.
  const isRolesBoard = hasOpenRolesBoard(profile)
  const isActive = hasActiveProduct(profile)
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
    reply_excerpt: string | null
    interview_id: string | null
  }
  let conciergeDrafts: ConciergeDraft[] = []
  let conciergeRoleMap: Record<string, { title: string; company_name: string }> = {}
  const conciergeCounts = { queued: 0, approved: 0, sent: 0, replied: 0 }
  if (isConcierge) {
    const { data: drafts } = await supabase
      .from('concierge_queue')
      .select('id, role_id, match_score, match_reasons, draft_subject, draft_body, status, created_at, reply_excerpt, interview_id')
      .eq('candidate_id', user.id)
      .in('status', ['pending_approval', 'auto_send', 'approved', 'sent', 'replied'])
      .order('created_at', { ascending: false })
      .limit(10)
    conciergeDrafts = (drafts as ConciergeDraft[]) || []
    for (const d of conciergeDrafts) {
      if (d.status === 'replied') conciergeCounts.replied++
      else if (d.status === 'sent') conciergeCounts.sent++
      else if (d.status === 'approved') conciergeCounts.approved++
      else conciergeCounts.queued++ // pending_approval / auto_send
    }
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
  // 6 = the verification target (2 jobs × manager/colleague/stakeholder). If a manager
  // nominated extra people, refsTotal can exceed 6 — so never let the denominator be
  // smaller than how many actually responded (avoids nonsense like "9/6").
  const refsDenom = Math.max(6, refsTotal)
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

  // Profile is fully complete when it's live (verified + 100%).
  const profileComplete = isProfileLive || completion >= 100

  // Pick Shapi mood based on candidate state
  const shapiMood = profileComplete
    ? 'happy'
    : !profile?.cv_parsed
    ? 'idle'
    : !profile?.whatsapp_number
    ? 'listening'
    : conversationDone
    ? 'happy'
    : 'thinking'

  const shapiMessage = profileComplete
    ? `🎉 Congratulations${firstName ? `, ${firstName}` : ''} — your profile is complete and live. Companies can now find, verify, and reach out to you. You're all set.`
    : !profile?.cv_parsed
    ? `Hey${firstName ? ` ${firstName}` : ''} — drop your CV and I'll take it from here. No forms, I promise.`
    : !profile?.whatsapp_number
    ? `CV's in. Now I want to hear about the stuff that never makes it onto paper. Check your WhatsApp.`
    : conversationDone
    ? `Your profile is being built${firstName ? `, ${firstName}` : ''}. I've got everything I need — sit tight.`
    : `I'm working through your profile. Keep an eye on WhatsApp — I may have a few more questions.`

  return (
    <div className="min-h-screen text-[#F4F4F7]" style={{ background: '#060609' }}>
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animated-gradient {
          background: linear-gradient(135deg, #9D8CFF, #34D399, #9D8CFF, #34D399);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 5s ease infinite;
        }
        .dnav { color: rgba(255,255,255,0.8); transition: color .2s ease; }
        .dnav:hover { background: linear-gradient(135deg, #9D8CFF, #34D399); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .gradient-border-card {
          background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                      linear-gradient(135deg, rgba(157, 140, 255, 0.18), rgba(157, 140, 255, 0.18)) border-box;
          border: 1px solid transparent;
          transition: all 0.25s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .gradient-border-card:hover {
          background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                      linear-gradient(135deg, rgba(157, 140, 255, 0.5), rgba(157, 140, 255, 0.5)) border-box;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
      `}</style>

      {/* Nav — candidate "blue world" band */}
      <nav className="relative z-20" style={{ background: '#14141C', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-2">
            <ShapiCharacter mood="happy" size={30} />
            <span className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg, #9D8CFF, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</span>
          </Link>
          <div className="flex items-center gap-5">
            <span className="text-sm text-white/60 hidden sm:block">{user.email}</span>
            <Link href="/roles" className="text-sm dnav font-medium hidden md:block">Roles</Link>
            <Link href="/applications" className="text-sm dnav font-medium hidden md:block">My applications</Link>
            <Link href="/active" className="text-sm dnav font-medium hidden md:block">Active</Link>
            <Link href="/profile" className="text-sm bg-white/15 hover:bg-white/25 text-white font-bold px-4 py-1.5 rounded-full transition-colors">
              View profile →
            </Link>
            <form action="/api/auth/signout" method="post">
              <button className="text-sm text-white/60 hover:text-white transition-colors">Sign out</button>
            </form>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-8 pb-24">

        {/* ─── CANDIDATE VIEW ─── */}
        {type === 'candidate' && (
          <div className="grid lg:grid-cols-[220px_1fr] gap-6">

            {/* ── Sidebar nav (vertical on lg, horizontal pill row on mobile) ── */}
            <aside className="lg:sticky lg:top-6 self-start">
              <nav className="flex flex-row overflow-x-auto lg:flex-col gap-1.5 pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0">
                {[
                  { href: '#', label: 'Overview', icon: '🏠', active: true },
                  { href: '/translate', label: 'Career Translator', icon: '🧭' },
                  { href: '/course-wallet', label: 'Course Wallet', icon: '📚' },
                  { href: '/worth', label: "What you're worth", icon: '💸' },
                  { href: '/ai-proof', label: 'AI-Proof check', icon: '🛡️' },
                  { href: '/business', label: 'Plan a business', icon: '🚀' },
                  { href: '/profile?tab=Career', label: 'Career roadmap', icon: '🗺️' },
                  { href: '/roles', label: 'Roles', icon: '💼' },
                  { href: '/applications', label: 'My applications', icon: '📋', badge: needsActionCount > 0 ? needsActionCount : undefined },
                  { href: '/active', label: 'Active', icon: '⚡' },
                  { href: '/profile', label: 'My profile', icon: '👤' },
                ].map(item => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-2.5 flex-shrink-0 rounded-xl px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
                      item.active
                        ? 'text-[#FB7185]'
                        : 'text-[#C7C7D1] hover:text-[#FB7185]'
                    }`}
                    style={item.active
                      ? { background: 'rgba(157, 140, 255, 0.12)', border: '1px solid rgba(157, 140, 255, 0.28)' }
                      : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    <span>{item.label}</span>
                    {'badge' in item && item.badge && (
                      <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: '#9D8CFF', color: '#060609' }}>{item.badge}</span>
                    )}
                  </Link>
                ))}
              </nav>
            </aside>

            {/* ── Main column ── */}
            <main className="min-w-0">
            {/* Header */}
            <div className="mb-5">
              <h1 className="text-3xl font-black mb-1" style={{ color: '#FB7185' }}>
                Welcome{completion > 0 ? ' back' : ''}{firstName ? `, ${firstName}` : ''}.
              </h1>
              {profile?.headline && (
                <p className="text-[#7E7E8E] text-sm">{profile.headline}</p>
              )}
            </div>

            {/* What needs you today — actionable items only; hides when there's nothing to do. */}
            {(upcomingInterviewsCount + needFeedbackCount + (isConcierge ? pendingDraftsCount : 0) + pendingRefsCount + (completion < 100 ? 1 : 0)) > 0 && (
              <div className="gradient-border-card rounded-2xl p-5 mb-5">
                <p className="text-[#9D8CFF] text-[10px] font-bold uppercase tracking-wider mb-3">✦ What needs you today</p>
                <ul className="space-y-1.5">
                  {upcomingInterviewsCount > 0 && (
                    <li>
                      <Link href="/applications" className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors">
                        <span className="flex items-center gap-2 text-[#F4F4F7] text-sm">
                          <span className="text-base leading-none">📅</span>
                          <span>{upcomingInterviewsCount} upcoming interview{upcomingInterviewsCount === 1 ? '' : 's'} — prep &amp; join</span>
                        </span>
                        <span className="text-[#9D8CFF] text-xs font-bold flex-shrink-0">→</span>
                      </Link>
                    </li>
                  )}
                  {needFeedbackCount > 0 && (
                    <li>
                      <Link href="/applications" className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors">
                        <span className="flex items-center gap-2 text-[#F4F4F7] text-sm">
                          <span className="text-base leading-none">📝</span>
                          <span>{needFeedbackCount} interview{needFeedbackCount === 1 ? '' : 's'} need{needFeedbackCount === 1 ? 's' : ''} your feedback</span>
                        </span>
                        <span className="text-[#9D8CFF] text-xs font-bold flex-shrink-0">→</span>
                      </Link>
                    </li>
                  )}
                  {isConcierge && pendingDraftsCount > 0 && (
                    <li>
                      <Link href="/active" className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors">
                        <span className="flex items-center gap-2 text-[#F4F4F7] text-sm">
                          <span className="text-base leading-none">✉️</span>
                          <span>{pendingDraftsCount} draft{pendingDraftsCount === 1 ? '' : 's'} ready to approve &amp; send</span>
                        </span>
                        <span className="text-[#9D8CFF] text-xs font-bold flex-shrink-0">→</span>
                      </Link>
                    </li>
                  )}
                  {pendingRefsCount > 0 && (
                    <li>
                      <Link href="/profile/references" className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors">
                        <span className="flex items-center gap-2 text-[#F4F4F7] text-sm">
                          <span className="text-base leading-none">🤝</span>
                          <span>{pendingRefsCount} reference{pendingRefsCount === 1 ? '' : 's'} still awaiting a response</span>
                        </span>
                        <span className="text-[#9D8CFF] text-xs font-bold flex-shrink-0">→</span>
                      </Link>
                    </li>
                  )}
                  {completion < 100 && (
                    <li>
                      <Link href="/profile/edit" className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors">
                        <span className="flex items-center gap-2 text-[#F4F4F7] text-sm">
                          <span className="text-base leading-none">✦</span>
                          <span>Finish your profile — you&apos;re at {completion}%</span>
                        </span>
                        <span className="text-[#9D8CFF] text-xs font-bold flex-shrink-0">→</span>
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Resume CV-builder draft — shown for candidates who started the
                Claude interview, closed the tab, and came back. Hidden once
                the profile is built (cv_parsed or completion ≥ 80%). The
                chat is restored exactly where they left off on /cv-builder. */}
            {hasCvDraft && (
              <Link
                href="/cv-builder"
                className="block mb-5 rounded-2xl p-5 transition-opacity hover:opacity-95"
                style={{ background: 'linear-gradient(135deg, rgba(157, 140, 255, 0.14), rgba(157, 140, 255, 0.06))', border: '1px solid rgba(157, 140, 255, 0.40)' }}
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: '#9D8CFF' }}>↩</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#F4F4F7] font-black text-base mb-0.5">Finish your CV</p>
                    <p className="text-[#A6A6B4] text-xs leading-relaxed">You&apos;re part-way through — pick up where you left off, takes a few more minutes.</p>
                  </div>
                  <span className="flex-shrink-0 text-[#9D8CFF] text-xs font-black">Resume →</span>
                </div>
              </Link>
            )}

            {/* Connect Shapi WhatsApp — first-encounter discovery hook for
                voice notes, reference reminders, profile nudges. needsNumber
                means the candidate skipped the WhatsApp step in /upload-cv;
                point them at /profile/edit to fill it in before pairing. */}
            {!profile?.whatsapp_number && (
              <div className="mb-5">
                <WhatsAppConnectCard role="candidate" needsNumber />
              </div>
            )}

            {/* Persistent "Your CV is ready — unlock" upsell. Shown for
                candidates with a complete profile (≥80%) who haven't yet
                purchased Kit or Pro. The CV interview itself shows a blurred
                preview gate at [PROFILE_READY]; this card is the dashboard
                fallback for users who dismissed it. */}
            {!profile?.cv_tier && (profile?.completion_pct ?? 0) >= 80 && (
              <Link
                href="/cv-ready"
                className="block mb-5 rounded-2xl p-5 transition-opacity hover:opacity-95"
                style={{ background: 'linear-gradient(135deg, rgba(157, 140, 255, 0.14), rgba(157, 140, 255, 0.14))', border: '1px solid rgba(157, 140, 255, 0.40)' }}
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, #9D8CFF, #34D399)' }}>📄</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#F4F4F7] font-black text-base mb-0.5">Your CV is ready ✨</p>
                    <p className="text-[#A6A6B4] text-xs leading-relaxed">Industry-styled, ATS-optimised, native + English. Unlock from <strong className="text-[#F4F4F7]">$25</strong> (Kit) or <strong className="text-[#F4F4F7]">$59</strong> (Pro).</p>
                  </div>
                  <span className="flex-shrink-0 text-[#9D8CFF] text-xs font-black">Unlock →</span>
                </div>
              </Link>
            )}

            {/* Compact hero — guide + progress side by side, key info up top */}
            <div className="grid lg:grid-cols-2 gap-4 mb-5 items-stretch">
              {/* Shapi guide */}
              <div className="rounded-2xl p-6 flex items-center gap-5"
                style={{ background: 'linear-gradient(135deg, rgba(157, 140, 255, 0.12), rgba(157, 140, 255, 0.08))', border: '1px solid rgba(157, 140, 255, 0.28)', boxShadow: '0 10px 30px rgba(157, 140, 255, 0.12)' }}>
                <ShapiCharacter mood={shapiMood} size={84} className="flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#9D8CFF' }}>Shapi says</p>
                  <p className="text-[#F4F4F7] text-sm leading-relaxed font-medium">{shapiMessage}</p>
                </div>
                {!profile?.cv_parsed && (
                  <Link href="/upload-cv"
                    className="ml-auto flex-shrink-0 bg-gradient-to-r from-[#9D8CFF] to-[#9D8CFF] px-4 py-2 rounded-full text-xs font-black text-[#060609] hover:opacity-90 transition-opacity">
                    Start →
                  </Link>
                )}
              </div>

              {/* Progress */}
              <div className="gradient-border-card rounded-2xl p-6 flex flex-col justify-center">
                <div className="flex items-center gap-6">
                  <div className="relative flex-shrink-0 w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="7" />
                      <circle cx="40" cy="40" r="34" fill="none" stroke={completion >= 100 ? '#34D399' : 'url(#progGrad)'} strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} />
                      <defs>
                        <linearGradient id="progGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#9D8CFF" />
                          <stop offset="50%" stopColor="#9D8CFF" />
                          <stop offset="100%" stopColor="#FB7185" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-black" style={{ color: completion >= 100 ? '#34D399' : '#F4F4F7' }}>{completion}%</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-black mb-0" style={completion >= 100
                      ? { color: '#34D399' }
                      : { background: 'linear-gradient(135deg, #9D8CFF, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{completion}% complete</h2>
                    <p className="text-[#7E7E8E] text-xs mt-1">Profile strength</p>
                  </div>
                </div>
                <div className="mt-4 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${completion}%`, background: 'linear-gradient(90deg, #9D8CFF, #34D399)' }} />
                </div>
              </div>
            </div>

            {/* ── Your plan ── subscribed products + upsells for the rest ── */}
            <div className="gradient-border-card rounded-2xl p-5 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#5C5C6A] text-xs font-bold uppercase tracking-wider">Your plan</span>
                {isConcierge ? (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(157, 140, 255, 0.18)', color: '#9D8CFF' }}>Active Concierge</span>
                ) : isActive ? (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(157, 140, 255, 0.15)', color: '#9D8CFF' }}>Shapi Active</span>
                ) : profile?.cv_tier === 'pro' ? (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(157, 140, 255, 0.18)', color: '#9D8CFF' }}>CV Pro</span>
                ) : cvKitPurchased ? (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(157, 140, 255, 0.12)', color: '#9D8CFF' }}>CV Kit</span>
                ) : (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: '#7E7E8E' }}>Free</span>
                )}
              </div>

              {/* Subscribed product(s) + what they unlock */}
              {(isActive || isConcierge) && (
                <div className="space-y-2 mb-3">
                  {isActive && (
                    <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: 'rgba(157, 140, 255, 0.08)', border: '1px solid rgba(157, 140, 255, 0.20)' }}>
                      <span className="text-emerald-400 text-sm font-black mt-0.5">✓</span>
                      <div>
                        <p className="text-[#F4F4F7] text-sm font-bold">Shapi Active</p>
                        <p className="text-[#A6A6B4] text-xs">See every open role · job scanner · email drafter · application tracker · interview prep.</p>
                      </div>
                    </div>
                  )}
                  {isConcierge && (
                    <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: 'rgba(157, 140, 255, 0.08)', border: '1px solid rgba(157, 140, 255, 0.20)' }}>
                      <span className="text-emerald-400 text-sm font-black mt-0.5">✓</span>
                      <div>
                        <p className="text-[#F4F4F7] text-sm font-bold">Active Concierge</p>
                        <p className="text-[#A6A6B4] text-xs">AI scans roles daily and drafts personalised intros — you approve and send.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Upsells for products NOT subscribed */}
              {(!isActive || !isConcierge) && (
                <div className="space-y-2">
                  {!isActive && (
                    <SubscribeButton product="active_monthly" className="w-full flex items-center justify-between gap-3 rounded-xl p-3 hover:bg-white/[0.05] transition-colors text-left">
                      <div>
                        <p className="text-[#F4F4F7] text-sm font-bold">Shapi Active <span className="text-[#9D8CFF] font-black">$29/mo</span></p>
                        <p className="text-[#7E7E8E] text-xs">See every open role + get shortlisted by companies, scan jobs, draft outreach, track applications, prep interviews.</p>
                      </div>
                      <span className="text-[#9D8CFF] text-xs font-black flex-shrink-0">Subscribe →</span>
                    </SubscribeButton>
                  )}
                  {!isConcierge && (
                    <SubscribeButton product="concierge_monthly" className="w-full flex items-center justify-between gap-3 rounded-xl p-3 hover:bg-white/[0.05] transition-colors text-left">
                      <div>
                        <p className="text-[#F4F4F7] text-sm font-bold">Active Concierge <span className="text-[#9D8CFF] font-black">$89/mo</span></p>
                        <p className="text-[#7E7E8E] text-xs">Everything in Active, plus: AI drafts personalised intros daily — you just approve and send.</p>
                      </div>
                      <span className="text-[#9D8CFF] text-xs font-black flex-shrink-0">Subscribe →</span>
                    </SubscribeButton>
                  )}
                </div>
              )}
            </div>

            {/* Concierge queue — today's AI-drafted outreach (only if subscribed) */}
            {isConcierge && (
              <div className="rounded-2xl p-6 mb-5" style={{
                background: 'linear-gradient(#0D0C14,#0D0C14) padding-box, linear-gradient(135deg,rgba(157, 140, 255, 0.35),rgba(157, 140, 255, 0.25)) border-box',
                border: '1px solid transparent',
                boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)',
              }}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-[#9D8CFF] text-xs font-bold uppercase tracking-wider mb-1">Concierge · today's shortlist</p>
                    <h3 className="font-black text-[#F4F4F7] text-lg">
                      {conciergeDrafts.length > 0
                        ? `${conciergeDrafts.length} role${conciergeDrafts.length === 1 ? '' : 's'} matched · ready to send`
                        : 'No new matches today'}
                    </h3>
                    <p className="text-[#A6A6B4] text-xs mt-1">AI scans open roles every morning and drafts personalised intros — you review, approve, send.</p>
                    {(conciergeCounts.queued + conciergeCounts.approved + conciergeCounts.sent + conciergeCounts.replied) > 0 && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.05] text-[#A6A6B4]">{conciergeCounts.queued} queued</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#9D8CFF]/15 text-[#9D8CFF]">{conciergeCounts.approved} approved</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">{conciergeCounts.sent} sent</span>
                        {conciergeCounts.replied > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#9D8CFF]/20 text-[#9D8CFF]">{conciergeCounts.replied} replied ✓</span>
                        )}
                      </div>
                    )}
                  </div>
                  <form action="/api/concierge/scan" method="POST">
                    <button type="submit" className="text-[#9D8CFF] text-xs font-bold border border-[#9D8CFF]/30 hover:border-[#9D8CFF]/60 px-3 py-1.5 rounded-full transition-colors">
                      Refresh now
                    </button>
                  </form>
                </div>
                {conciergeDrafts.length > 0 && (
                  <div className="space-y-3">
                    {[...conciergeDrafts]
                      .sort((a, b) => (a.status === 'replied' ? -1 : 0) - (b.status === 'replied' ? -1 : 0))
                      .slice(0, 3)
                      .map(draft => {
                      const role = conciergeRoleMap[draft.role_id]
                      const replied = draft.status === 'replied'
                      return (
                        <div key={draft.id} className={`rounded-xl p-3 border ${
                          replied
                            ? 'bg-[#9D8CFF]/[0.08] border-[#9D8CFF]/35'
                            : 'bg-white/[0.05] border-white/[0.08]'
                        }`}>
                          {replied && (
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="text-[#9D8CFF] text-xs font-black">Manager replied ✓ — interview proposed</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <p className="text-[#F4F4F7] text-sm font-bold">{role?.title || 'Role'}</p>
                              <p className="text-[#A6A6B4] text-xs">{role?.company_name || ''}</p>
                            </div>
                            <span className="text-[#9D8CFF] text-xs font-black">{draft.match_score}%</span>
                          </div>
                          {replied && draft.reply_excerpt ? (
                            <p className="text-[#A6A6B4] text-xs mt-2 italic line-clamp-3">&ldquo;{draft.reply_excerpt}&rdquo;</p>
                          ) : (
                            <>
                              {draft.draft_subject && (
                                <p className="text-[#A6A6B4] text-xs mt-2 italic">&ldquo;{draft.draft_subject}&rdquo;</p>
                              )}
                              <p className="text-[#7E7E8E] text-[11px] mt-1 line-clamp-2">{draft.draft_body.slice(0, 220)}</p>
                            </>
                          )}
                          <div className="flex items-center justify-between mt-2 gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              draft.status === 'replied' ? 'bg-[#9D8CFF]/20 text-[#9D8CFF]' :
                              draft.status === 'sent' ? 'bg-emerald-500/15 text-emerald-400' :
                              draft.status === 'approved' ? 'bg-[#9D8CFF]/15 text-[#9D8CFF]' :
                              draft.status === 'auto_send' ? 'bg-[#9D8CFF]/15 text-[#9D8CFF]' :
                              'bg-white/[0.05] text-[#A6A6B4]'
                            }`}>
                              {draft.status === 'replied' ? 'replied' : draft.status.replace('_', ' ')}
                            </span>
                            {draft.status === 'sent' ? (
                              <form action="/api/concierge/replied" method="POST">
                                <input type="hidden" name="draftId" value={draft.id} />
                                <button type="submit" className="text-[10px] font-bold text-[#9D8CFF] border border-[#9D8CFF]/40 hover:bg-[#9D8CFF]/10 px-2.5 py-1 rounded-full transition-colors">
                                  ✅ They replied — book me in
                                </button>
                              </form>
                            ) : replied ? (
                              <Link href="/dashboard" className="text-[10px] font-bold text-[#9D8CFF]">Interview proposed →</Link>
                            ) : (
                              draft.match_reasons && draft.match_reasons.length > 0 && (
                                <span className="text-[#7E7E8E] text-[10px]">{draft.match_reasons[0]}</span>
                              )
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {conciergeDrafts.length > 3 && (
                      <p className="text-[#7E7E8E] text-[11px] text-center">+ {conciergeDrafts.length - 3} more in queue</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Status cards WITH progress ── */}
            <p className="text-[#7E7E8E] text-[11px] font-bold uppercase tracking-wider mb-2">Your status</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">

              {/* Profile completion — % bar */}
              <Link href="/profile" className="gradient-border-card rounded-2xl p-5 block hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-bold text-[#F4F4F7] text-sm">Profile completion</h3>
                  <span className="text-[#9D8CFF] text-sm font-black">{completion}%</span>
                </div>
                <p className="text-[#7E7E8E] text-xs mb-3">{profileComplete ? 'Complete & live — companies can find you.' : 'Keep going to reach 100% and go live.'}</p>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${completion}%`, background: 'linear-gradient(90deg, #9D8CFF, #34D399)' }} />
                </div>
              </Link>

              {/* References — completed vs target (6 = 2 jobs × 3) */}
              <Link href="/profile/references" className="gradient-border-card rounded-2xl p-5 block hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-bold text-[#F4F4F7] text-sm">References</h3>
                  <span className={`text-sm font-black ${refScore.jobsComplete === 2 ? 'text-emerald-400' : 'text-[#9D8CFF]'}`}>{completedRefsCount}/{refsDenom}</span>
                </div>
                <p className="text-[#7E7E8E] text-xs mb-3">
                  {refScore.jobsComplete === 2
                    ? 'Both jobs verified — manager + colleague + stakeholder each.'
                    : refScore.jobsComplete === 1
                    ? 'One job verified. Add a second manager to hit 100%.'
                    : 'Add the manager from your 2 latest jobs — we contact them.'}
                </p>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (completedRefsCount / refsDenom) * 100)}%`, background: refScore.jobsComplete === 2 ? 'linear-gradient(90deg,#34D399,#34D399)' : 'linear-gradient(90deg, #9D8CFF, #34D399)' }} />
                </div>
              </Link>

              {/* Courses — in-progress + completed, mini bar */}
              <Link href="/course-wallet" className="gradient-border-card rounded-2xl p-5 block hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-bold text-[#F4F4F7] text-sm">Courses</h3>
                  <span className="text-[#9D8CFF] text-sm font-black">{coursesCompleted} done · {coursesInProgress} learning</span>
                </div>
                <p className="text-[#7E7E8E] text-xs mb-3">{(coursesInProgress + coursesCompleted) > 0 ? 'Verified learning shows companies real growth.' : 'Close your skill gaps — free, paid or financed.'}</p>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(coursesInProgress + coursesCompleted) > 0 ? Math.min(100, (coursesCompleted / (coursesInProgress + coursesCompleted)) * 100) : 0}%`, background: 'linear-gradient(90deg, #9D8CFF, #34D399)' }} />
                </div>
              </Link>

              {/* Applications */}
              <Link href="/applications" className="gradient-border-card rounded-2xl p-5 block hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-[#F4F4F7] text-sm">Applications</h3>
                    <p className="text-[#7E7E8E] text-xs mt-0.5">Active applications in flight.</p>
                  </div>
                  <span className="text-3xl font-black" style={{ color: activeApplicationsCount > 0 ? '#9D8CFF' : 'rgba(255,255,255,0.10)' }}>{activeApplicationsCount}</span>
                </div>
              </Link>

              {/* Interested / Shortlisted */}
              <Link href="/roles" className="gradient-border-card rounded-2xl p-5 block hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-[#F4F4F7] text-sm">Roles & matches</h3>
                    <p className="text-[#7E7E8E] text-xs mt-0.5">{interestedRolesCount} interested · {shortlistedByCount} shortlisted you</p>
                  </div>
                  <span className="text-3xl font-black" style={{ color: shortlistedByCount > 0 ? '#9D8CFF' : 'rgba(255,255,255,0.10)' }}>{shortlistedByCount}</span>
                </div>
              </Link>

              {/* Evidence */}
              <Link href="/evidence" className="gradient-border-card rounded-2xl p-5 block hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-[#F4F4F7] text-sm">Work evidence</h3>
                    <p className="text-[#7E7E8E] text-xs mt-0.5">{evidenceCount > 0 ? 'Adds weight to your profile.' : 'Photos and docs that prove your experience.'}</p>
                  </div>
                  <span className="text-3xl font-black" style={{ color: evidenceCount > 0 ? '#9D8CFF' : 'rgba(255,255,255,0.10)' }}>{evidenceCount}</span>
                </div>
              </Link>

            </div>

            {/* ── Setup checklist + secondary cards ── */}
            <p className="text-[#7E7E8E] text-[11px] font-bold uppercase tracking-wider mb-2">Build your profile</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

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
                        <h3 className="font-bold text-[#F4F4F7] text-sm">CV uploaded & parsed</h3>
                        <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">Done</span>
                      </div>
                      <p className="text-[#7E7E8E] text-xs">Skills extracted. Profile building in progress.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <Link href="/upload-cv" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.05]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#9D8CFF]/15 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#9D8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-[#F4F4F7] text-sm">Upload your CV</h3>
                        <span className="text-[10px] font-bold bg-[#9D8CFF]/15 text-[#9D8CFF] px-2 py-0.5 rounded-full">Start here →</span>
                      </div>
                      <p className="text-[#7E7E8E] text-xs">Drop it and we build your profile. 3 minutes.</p>
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
                        <h3 className="font-bold text-[#F4F4F7] text-sm">WhatsApp connected</h3>
                        <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">Active</span>
                      </div>
                      <p className="text-[#7E7E8E] text-xs">{profile.whatsapp_number} — expect a message from us.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="gradient-border-card rounded-2xl p-6 opacity-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#9D8CFF]/15 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#9D8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-[#F4F4F7] text-sm mb-0.5">WhatsApp deep-dive</h3>
                      <p className="text-[#7E7E8E] text-xs">Complete CV upload to add your number.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* CV Kit CTA — only if not yet purchased */}
              {!cvKitPurchased && profile?.cv_parsed && (
                <Link href="/pay" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.05] sm:col-span-2 lg:col-span-3" style={{
                  background: 'linear-gradient(#0D0C14,#0D0C14) padding-box, linear-gradient(135deg,rgba(157, 140, 255, 0.3),rgba(157, 140, 255, 0.2)) border-box',
                  border: '1px solid transparent',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)',
                }}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[#F4F4F7] text-sm">Get your enhanced CV</h3>
                        <span className="text-[10px] font-bold bg-[#9D8CFF]/15 text-[#9D8CFF] px-2 py-0.5 rounded-full">From $25 one-time</span>
                      </div>
                      <p className="text-[#7E7E8E] text-xs">English + native language version, industry-optimised, send to WhatsApp or email.</p>
                    </div>
                    <span className="text-[#9D8CFF] font-black text-sm flex-shrink-0">Unlock →</span>
                  </div>
                </Link>
              )}

              {/* CV Kit done */}
              {cvKitPurchased && (
                <Link href="/cv-ready" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.05]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-[#F4F4F7] text-sm">CV Kit</h3>
                        <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">Ready ✓</span>
                      </div>
                      <p className="text-[#7E7E8E] text-xs">Your enhanced CV is ready — download or send it.</p>
                    </div>
                  </div>
                </Link>
              )}

              {/* Independent verification — visible for ALL candidates (references are part of the standard 75→100% completion) */}
              <Link href="/profile/references" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.05]">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${refScore.jobsComplete === 2 ? 'bg-emerald-500/15' : refScore.jobsComplete === 1 ? 'bg-amber-500/15' : 'bg-white/[0.05]'}`}>
                    <svg className={`w-5 h-5 ${refScore.jobsComplete === 2 ? 'text-emerald-400' : refScore.jobsComplete === 1 ? 'text-amber-400' : 'text-[#7E7E8E]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={refScore.jobsComplete === 2 ? 2 : 1.5} d={refScore.jobsComplete === 2 ? 'M5 13l4 4L19 7' : 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'} />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-[#F4F4F7] text-sm">Independent verification</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${refScore.jobsComplete === 2 ? 'bg-emerald-500/15 text-emerald-400' : refScore.jobsComplete === 1 ? 'bg-amber-500/15 text-amber-400' : 'bg-white/[0.05] text-[#7E7E8E]'}`}>
                        {refScore.jobsComplete} of 2 jobs ✓
                      </span>
                    </div>
                    <p className="text-[#7E7E8E] text-xs">
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
              <Link href="/evidence" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.05]">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${evidenceCount > 0 ? 'bg-emerald-500/15' : 'bg-[#9D8CFF]/15'}`}>
                    {evidenceCount > 0 ? (
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-[#9D8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-[#F4F4F7] text-sm">Work evidence</h3>
                      {evidenceCount > 0 ? (
                        <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">{evidenceCount} file{evidenceCount !== 1 ? 's' : ''} ✓</span>
                      ) : (
                        <span className="text-[10px] font-bold bg-[#9D8CFF]/15 text-[#9D8CFF] px-2 py-0.5 rounded-full">Add now</span>
                      )}
                    </div>
                    <p className="text-[#7E7E8E] text-xs">{evidenceCount > 0 ? 'Photos and docs uploaded — adds weight to your profile.' : 'Photos and docs that prove your experience.'}</p>
                  </div>
                </div>
              </Link>

              {/* Right to work */}
              {(() => {
                const rtw = Array.isArray(profile?.right_to_work) ? (profile!.right_to_work as Array<{ region?: string }>).filter(r => r.region) : []
                const has = rtw.length > 0
                return (
                  <Link href="/profile/edit" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${has ? 'bg-emerald-500/15' : 'bg-[#9D8CFF]/15'}`}>
                        {has ? (
                          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-[#9D8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-bold text-[#F4F4F7] text-sm">Right to work</h3>
                          {has
                            ? <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">{rtw.length} added ✓</span>
                            : <span className="text-[10px] font-bold bg-[#9D8CFF]/15 text-[#9D8CFF] px-2 py-0.5 rounded-full">Add now</span>}
                        </div>
                        <p className="text-[#7E7E8E] text-xs">{has ? rtw.map(r => r.region).slice(0, 3).join(' · ') : 'Where you’re authorised to work — a key signal for employers.'}</p>
                      </div>
                    </div>
                  </Link>
                )
              })()}

              {/* Courses / learning */}
              <Link href="/course-wallet" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${(coursesInProgress + coursesCompleted) > 0 ? 'bg-emerald-500/15' : 'bg-[#9D8CFF]/15'}`}>
                    <span className="text-lg">🎓</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-[#F4F4F7] text-sm">Courses & learning</h3>
                      {(coursesInProgress + coursesCompleted) > 0
                        ? <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">{coursesCompleted} done · {coursesInProgress} learning</span>
                        : <span className="text-[10px] font-bold bg-[#9D8CFF]/15 text-[#9D8CFF] px-2 py-0.5 rounded-full">Browse</span>}
                    </div>
                    <p className="text-[#7E7E8E] text-xs">{(coursesInProgress + coursesCompleted) > 0 ? 'Verified learning shows companies real growth.' : 'Close your skill gaps — free, paid or financed.'}</p>
                  </div>
                </div>
              </Link>

              {/* Work style */}
              <Link href="/work-style" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${profile?.work_style ? 'bg-emerald-500/15' : 'bg-[#9D8CFF]/15'}`}>
                    <span className="text-lg">🧭</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-[#F4F4F7] text-sm">Work style</h3>
                      {profile?.work_style
                        ? <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">Done ✓</span>
                        : <span className="text-[10px] font-bold bg-[#9D8CFF]/15 text-[#9D8CFF] px-2 py-0.5 rounded-full">2 min</span>}
                    </div>
                    <p className="text-[#7E7E8E] text-xs">{profile?.work_style ? 'How you prefer to work — shown to companies.' : 'Quick check — how you work best (team vs solo, etc.).'}</p>
                  </div>
                </div>
              </Link>

            </div>

            {/* Matches / shortlisted signal — only Roles Board */}
            {isRolesBoard && (
              <div className={`gradient-border-card rounded-2xl p-6 mt-4 ${shortlistedByCount === 0 ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#7E7E8E] text-xs font-bold uppercase tracking-wider mb-1">Company signals</p>
                    <h3 className="font-bold text-[#F4F4F7] mb-1">
                      {shortlistedByCount > 0
                        ? `${shortlistedByCount} compan${shortlistedByCount === 1 ? 'y has' : 'ies have'} shortlisted you`
                        : 'Complete your profile to unlock matches'}
                    </h3>
                    <p className="text-[#7E7E8E] text-xs">
                      {shortlistedByCount > 0
                        ? `You've expressed interest in ${interestedRolesCount} role${interestedRolesCount !== 1 ? 's' : ''}. Mutual matches trigger introductions.`
                        : 'Once verified, matched companies can view and reach out to you.'}
                    </p>
                  </div>
                  <div className="text-5xl font-black" style={{ color: shortlistedByCount > 0 ? '#9D8CFF' : 'rgba(255,255,255,0.10)' }}>
                    {shortlistedByCount}
                  </div>
                </div>
              </div>
            )}

            {/* WhatsApp — just a hint now. The full command list is delivered in the
                first WhatsApp message (lib/whatsapp.ts), and Ask Shapi (the floating
                ✦ button) answers anything in-app. Open Roles Board + Shapi Active live
                in the sidebar nav and each explains itself on its own page. */}
            {profile?.whatsapp_number && (
              <div className="gradient-border-card rounded-2xl p-4 mt-4 flex items-start gap-3">
                <span className="text-lg leading-none">💬</span>
                <p className="text-[#C7C7D1] text-xs leading-relaxed">
                  Chat with Shapi on <strong className="text-[#F4F4F7]">WhatsApp</strong> anytime — say <span className="font-bold text-[#9D8CFF]">&quot;voice&quot;</span> to record in any language, <span className="font-bold text-[#9D8CFF]">&quot;references&quot;</span> to check your status, <span className="font-bold text-[#9D8CFF]">&quot;skip&quot;</span> during an interview, or just ask anything.
                </p>
              </div>
            )}
            </main>
          </div>
        )}

        {/* ─── COMPANY VIEW ─── */}
        {type === 'company' && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-black mb-1" style={{ color: '#FB7185' }}>
                Welcome{completion > 0 ? ' back' : ''}{firstName ? `, ${firstName}` : ''}.
              </h1>
              <p className="text-[#7E7E8E] text-sm">Post jobs, review verified candidates, manage your pipeline.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Link href="/company/onboarding" className="gradient-border-card rounded-2xl p-7 block hover:bg-white/[0.05]">
                <div className="w-11 h-11 rounded-xl bg-[#9D8CFF]/15 flex items-center justify-center mb-5">
                  <svg className="w-5 h-5 text-[#9D8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="font-bold text-[#F4F4F7] mb-1">Post a role</h3>
                <p className="text-[#A6A6B4] text-sm">Add a job and start receiving verified candidate matches.</p>
              </Link>

              <Link href="/company/dashboard" className="gradient-border-card rounded-2xl p-7 block hover:bg-white/[0.05]">
                <div className="w-11 h-11 rounded-xl bg-[#9D8CFF]/15 flex items-center justify-center mb-5">
                  <svg className="w-5 h-5 text-[#9D8CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-[#F4F4F7] mb-1">Browse verified candidates</h3>
                <p className="text-[#A6A6B4] text-sm">View candidates matched to your roles.</p>
              </Link>

              {profile?.subscription_status === 'active' ? (
                <div className="gradient-border-card rounded-2xl p-7 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#7E7E8E] text-xs font-bold uppercase tracking-wider mb-1">Subscription</p>
                      <h3 className="font-bold text-[#F4F4F7]">{profile.subscription_tier === 'enterprise' ? 'Enterprise' : profile.subscription_tier === 'growth' ? 'Growth' : 'Pro'} plan active</h3>
                      <p className="text-[#7E7E8E] text-xs mt-1">Full access to candidate profiles and outreach.</p>
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
                  background: 'linear-gradient(135deg, rgba(157, 140, 255, 0.85) 0%, rgba(157, 140, 255, 0.85) 100%)',
                  border: '1px solid rgba(157, 140, 255, 0.2)',
                }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Unlock full profiles</p>
                      <h3 className="font-bold text-white text-lg mb-1">Subscribe to start hiring →</h3>
                      <p className="text-white/50 text-sm">From $499/mo · 14-day free trial · Every candidate independently verified</p>
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
