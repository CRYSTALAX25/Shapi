import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const type = user.user_metadata?.type || 'candidate'

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, cv_parsed, whatsapp_number, whatsapp_chat, completion_pct, paid, subscription_status, subscription_tier, company_name')
    .eq('id', user.id)
    .single()

  // Fetch candidate signals (interests expressed + companies who shortlisted them)
  let interestedRolesCount = 0
  let shortlistedByCount = 0
  let activeApplicationsCount = 0
  if (type === 'candidate') {
    const [interestsRes, shortlistRes, appsRes] = await Promise.all([
      supabase.from('candidate_interests').select('id', { count: 'exact', head: true }).eq('candidate_id', user.id),
      supabase.from('company_shortlists').select('id', { count: 'exact', head: true }).eq('candidate_id', user.id),
      supabase.from('active_applications').select('id', { count: 'exact', head: true }).eq('candidate_id', user.id),
    ])
    interestedRolesCount = interestsRes.count ?? 0
    shortlistedByCount = shortlistRes.count ?? 0
    activeApplicationsCount = appsRes.count ?? 0
  }

  const completion = profile?.completion_pct ?? 0
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
                Welcome back{firstName ? `, ${firstName}` : ''}.
              </h1>
              <p className="text-white/35 text-sm">
                {profile?.headline || 'Your verified profile is being built.'}
              </p>
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

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-white/35 text-xs font-bold uppercase tracking-wider mb-1">Profile completion</p>
                  <h2 className="text-xl font-black text-white mb-1">
                    {completion === 0 && "Let's get started"}
                    {completion > 0 && completion < 50 && 'Good start — keep going'}
                    {completion >= 50 && completion < 90 && 'Almost there'}
                    {completion >= 90 && 'Profile complete'}
                  </h2>
                  <p className="text-white/35 text-sm">
                    {completion === 0 && 'Upload your CV — takes 3 minutes. No forms.'}
                    {completion > 0 && completion < 30 && 'Complete the WhatsApp conversation to go deeper.'}
                    {completion >= 30 && completion < 90 && "Verification in progress. We'll notify you when live."}
                    {completion >= 90 && "You're being matched with companies now."}
                  </p>
                </div>

                {!profile?.cv_parsed && (
                  <Link href="/upload-cv"
                    className="flex-shrink-0 bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] px-5 py-2.5 rounded-full text-sm font-black text-[#060609] hover:opacity-90 transition-opacity">
                    Start →
                  </Link>
                )}
              </div>

              <div className="mt-5 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${completion}%`,
                  background: 'linear-gradient(90deg, #22D3EE, #A78BFA)',
                }} />
              </div>
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

              {/* Verification */}
              <div className="gradient-border-card rounded-2xl p-6 opacity-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-white text-sm">Independent verification</h3>
                      <span className="text-[10px] font-bold bg-white/[0.07] text-white/35 px-2 py-0.5 rounded-full">Pending</span>
                    </div>
                    <p className="text-white/35 text-xs">We contact your references. Usually 48hrs.</p>
                  </div>
                </div>
              </div>

              {/* Evidence */}
              <Link href="/evidence" className="gradient-border-card rounded-2xl p-6 block hover:bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#FB7185]/15 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#FB7185]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-white text-sm">Add work evidence</h3>
                      <span className="text-[10px] font-bold bg-[#FB7185]/15 text-[#FB7185] px-2 py-0.5 rounded-full">Optional</span>
                    </div>
                    <p className="text-white/35 text-xs">Photos and docs that prove your experience.</p>
                  </div>
                </div>
              </Link>

              {/* Matches / shortlisted signal */}
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
                Welcome back{firstName ? `, ${firstName}` : ''}.
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
