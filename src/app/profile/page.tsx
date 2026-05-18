import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CVDownloadButton from '@/components/CVDownloadButton'
import ShapiCharacter from '@/components/ShapiCharacter'
import SkillRadar from '@/components/SkillRadar'
import ContinuousLearning from '@/components/ContinuousLearning'
import { computeJobCompletionScore } from '@/lib/references'

type WorkEntry = {
  title?: string
  company?: string
  start?: string
  end?: string
  achievements?: string
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, location, summary, skills, work_history, whatsapp_chat, ai_tier, profile_live, cv_parsed, cv_kit_purchased, cv_tier, whatsapp_number, completion_pct, type, verification_tier, verification_report, skill_quadrant, continuous_learning, career_recommendations, ai_resilience_score')
    .eq('id', user.id)
    .single()

  // Redirect ONLY if profile explicitly belongs to a company.
  // Null/undefined/'candidate' all render the candidate view.
  if (!profile) redirect('/dashboard')
  if (profile.type === 'company') redirect('/company/dashboard')

  // Fetch evidence count
  const { count: evidenceCount } = await supabase
    .from('evidence')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  const hasEvidence = (evidenceCount ?? 0) > 0

  const skills: string[] = Array.isArray(profile.skills) ? profile.skills : []
  const workHistory: WorkEntry[] = Array.isArray(profile.work_history) ? profile.work_history : []
  const isLive = profile.profile_live
  const cvKitPurchased = !!profile.cv_kit_purchased

  // Tiered completion per Ana's spec:
  //   CV parsed (25) + WhatsApp (25) + CV Kit purchased (25) + references bonus
  //   References bonus: 0 jobs done = 0, 1 of 2 = +10 (→85%), 2 of 2 = +25 (→100% + profile_live=true)
  const refScore = await computeJobCompletionScore(user.id)
  let completion = 0
  if (profile.cv_parsed) completion += 25
  if (profile.whatsapp_number) completion += 25
  if (cvKitPurchased) completion += 25
  completion += refScore.bonusPct

  const aiTierLabel: Record<string, string> = {
    user: 'AI User',
    integrator: 'AI Integrator',
    builder: 'AI Builder',
  }

  return (
    <div className="min-h-screen bg-[#060609]">
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .gradient-border-card {
          background: linear-gradient(#0d0d14, #0d0d14) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.15), rgba(139,92,246,0.15)) border-box;
          border: 1px solid transparent;
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.06) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Nav */}
      <nav className="relative z-10 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>shapi</Link>
        <div className="flex items-center gap-3">
          <Link href="/profile/edit"
            className="text-white/50 text-xs font-bold px-4 py-2 rounded-full border border-white/[0.12] hover:border-white/30 transition-colors">
            Edit profile
          </Link>
          <a href="/profile/print" target="_blank"
            className="bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] text-[#060609] text-xs font-black px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
            Download CV ↓
          </a>
          <Link href="/dashboard" className="text-white/40 text-sm hover:text-white/70 transition-colors">
            ← Dashboard
          </Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pb-20 pt-4">

        {/* Status banner */}
        {!isLive && (
          <div className="gradient-border-card rounded-2xl px-5 py-4 mb-6 flex items-center gap-4">
            <ShapiCharacter mood="thinking" size={48} className="flex-shrink-0" />
            <p className="text-white/60 text-sm">
              Your profile is <span className="text-white font-semibold">being verified</span> — it will go live once our team confirms your references. Usually 48hrs.
            </p>
          </div>
        )}
        {isLive && (
          <div className="gradient-border-card rounded-2xl px-5 py-4 mb-6 flex items-center gap-4">
            <ShapiCharacter mood="happy" size={48} className="flex-shrink-0" />
            <p className="text-white/60 text-sm">
              Your profile is <span className="text-[#22D3EE] font-semibold">live</span> — companies can now find and view you. 🎉
            </p>
          </div>
        )}

        {/* Verification tier badge */}
        {(() => {
          const tier = (profile.verification_tier as string) || 'unverified'
          if (tier === 'unverified') return null
          const tierMeta: Record<string, { label: string; color: string; bg: string; emoji: string; description: string }> = {
            basic: { label: 'Basic Verified', color: '#22D3EE', bg: 'rgba(34,211,238,0.10)', emoji: '🔵', description: '1 of 2 reference chains complete' },
            strong: { label: 'Strongly Verified', color: '#34D399', bg: 'rgba(52,211,153,0.10)', emoji: '🟢', description: 'Both reference chains + peer reference complete' },
            premium: { label: 'Premium Verified', color: '#FBBF24', bg: 'rgba(251,191,36,0.10)', emoji: '🟡', description: 'Strong + AI cross-check passed with no conflicts' },
          }
          const m = tierMeta[tier]
          if (!m) return null
          return (
            <div className="gradient-border-card rounded-2xl px-5 py-4 mb-6 flex items-center gap-4" style={{ background: m.bg, border: `1px solid ${m.color}33` }}>
              <span className="text-3xl flex-shrink-0">{m.emoji}</span>
              <div>
                <p className="font-bold text-sm" style={{ color: m.color }}>{m.label}</p>
                <p className="text-white/45 text-xs mt-0.5">{m.description}</p>
              </div>
            </div>
          )
        })()}

        {/* Header */}
        <div className="gradient-border-card rounded-3xl p-8 mb-4">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-black text-white mb-1">
                {profile.full_name || 'Your Name'}
              </h1>
              <p className="text-white/60 text-lg">{profile.headline || 'Professional'}</p>
              {profile.location && (
                <p className="text-white/35 text-sm mt-1">📍 {profile.location}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-4xl font-black" style={{
                background: 'linear-gradient(135deg, #22D3EE, #A78BFA)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>{completion}%</div>
              <div className="text-white/30 text-xs">complete</div>
              {isLive && (
                <span className="inline-block mt-2 bg-[#22D3EE]/15 text-[#22D3EE] text-xs font-bold px-3 py-1 rounded-full">
                  ✓ Live
                </span>
              )}
            </div>
          </div>

          {/* AI tier badge */}
          {profile.ai_tier && (
            <span className="inline-block bg-[#A78BFA]/15 text-[#A78BFA] text-xs font-bold px-3 py-1.5 rounded-full capitalize mb-4">
              {aiTierLabel[profile.ai_tier] || profile.ai_tier}
            </span>
          )}

          {/* Summary */}
          {profile.summary && (
            <p className="text-white/60 text-sm leading-relaxed">{profile.summary}</p>
          )}
        </div>

        {/* Skill fingerprint — Hands/Heart/Head/Spark radar with AI Tier badge */}
        {profile.skill_quadrant && (
          <div className="gradient-border-card rounded-2xl p-6 mb-4">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-white font-black text-sm uppercase tracking-widest opacity-50">Skill fingerprint</h2>
                <p className="text-white/40 text-xs mt-1">How you work, scored 0–10 on 4 axes</p>
              </div>
              {profile.ai_tier && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(167,139,250,0.10)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.2)' }}>
                  🤖 AI {(profile.ai_tier as string).charAt(0).toUpperCase() + (profile.ai_tier as string).slice(1)}
                </span>
              )}
            </div>
            <div className="flex justify-center">
              <SkillRadar data={profile.skill_quadrant as { hands: number; heart: number; head: number; spark: number; reasoning?: string }} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left column */}
          <div className="md:col-span-2 space-y-4">

            {/* Work history */}
            {workHistory.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-white font-black text-sm uppercase tracking-widest mb-5 opacity-50">Experience</h2>
                <div className="space-y-6">
                  {workHistory.map((job, i) => (
                    <div key={i} className={i > 0 ? 'pt-6 border-t border-white/[0.06]' : ''}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-white font-bold">{job.title || '—'}</p>
                          <p className="text-white/50 text-sm">{job.company || '—'}</p>
                        </div>
                        <p className="text-white/30 text-xs text-right flex-shrink-0">
                          {job.start}{job.end ? ` – ${job.end}` : ''}
                        </p>
                      </div>
                      {job.achievements && (
                        <p className="text-white/45 text-sm leading-relaxed mt-2">{job.achievements}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {workHistory.length === 0 && (
              <div className="gradient-border-card rounded-2xl p-8 text-center">
                <p className="text-white/30 text-sm">Work history will appear here once your CV is processed</p>
              </div>
            )}

            {/* Continuous Learning + Career Roadmap */}
            <ContinuousLearning
              data={(profile.continuous_learning as Parameters<typeof ContinuousLearning>[0]['data']) ?? null}
              roadmap={(profile.career_recommendations as Parameters<typeof ContinuousLearning>[0]['roadmap']) ?? null}
              isPro={profile.cv_tier === 'pro'}
              resilienceScore={(profile.ai_resilience_score as number | null) ?? null}
            />
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Skills */}
            {skills.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-white font-black text-sm uppercase tracking-widest mb-4 opacity-50">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, i) => (
                    <span key={i} className="bg-white/[0.06] text-white/60 text-xs px-3 py-1.5 rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Verification status */}
            <div className="gradient-border-card rounded-2xl p-6">
              <h2 className="text-white font-black text-sm uppercase tracking-widest mb-4 opacity-50">Verification</h2>
              <div className="space-y-3">
                {[
                  { label: 'CV parsed', done: profile.cv_parsed },
                  { label: 'WhatsApp interview', done: Array.isArray(profile.whatsapp_chat) && (profile.whatsapp_chat as unknown[]).length > 2 },
                  { label: 'Reference checked', done: false },
                  { label: 'Profile live', done: isLive },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-[#22D3EE]/20' : 'bg-white/[0.05]'}`}>
                      {item.done
                        ? <svg className="w-3 h-3 text-[#22D3EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        : <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      }
                    </div>
                    <span className={`text-sm ${item.done ? 'text-white/70' : 'text-white/30'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CV Download CTA */}
            <CVDownloadButton cvParsed={!!profile.cv_parsed} cvKitPurchased={cvKitPurchased} cvTier={profile.cv_tier as string | null} />

            {/* References CTA / status — tiered completion */}
            <Link href="/profile/references" className="block gradient-border-card rounded-2xl p-5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-white font-bold text-sm">References</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: refScore.jobsComplete === 2 ? 'rgba(52,211,153,0.15)' : refScore.jobsComplete === 1 ? 'rgba(251,191,36,0.15)' : 'rgba(251,113,133,0.15)',
                    color: refScore.jobsComplete === 2 ? '#34D399' : refScore.jobsComplete === 1 ? '#FBBF24' : '#FB7185',
                  }}>
                  {refScore.jobsComplete} of 2 jobs verified
                </span>
              </div>
              <p className="text-white/35 text-xs leading-relaxed">
                {refScore.jobsComplete === 2
                  ? 'Both jobs fully verified — profile live ✓'
                  : refScore.jobsComplete === 1
                  ? 'One more job to verify (85% → 100%). Add your second manager.'
                  : 'Add the line manager from your 2 latest jobs. We contact them, they nominate a colleague + stakeholder, you get verified — and 100% complete.'}
              </p>
              <p className="text-[#22D3EE] text-xs font-semibold mt-3">
                {refScore.jobsComplete === 2 ? 'View references →' : 'Add references →'}
              </p>
            </Link>

            {/* Evidence CTA / status */}
            <Link href="/evidence" className="block gradient-border-card rounded-2xl p-5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-white font-bold text-sm">Work evidence</p>
                {hasEvidence ? (
                  <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full flex-shrink-0">
                    {evidenceCount} file{evidenceCount !== 1 ? 's' : ''} ✓
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-[#FB7185]/12 text-[#FB7185] px-2 py-0.5 rounded-full flex-shrink-0">Optional</span>
                )}
              </div>
              <p className="text-white/35 text-xs">
                {hasEvidence ? 'Photos and docs uploaded — strengthens your verified profile.' : 'Photos, docs, references that prove your track record'}
              </p>
              <p className="text-[#22D3EE] text-xs font-semibold mt-3">
                {hasEvidence ? 'Add more →' : 'Upload evidence →'}
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
