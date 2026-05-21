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
    .select('full_name, headline, location, summary, skills, work_history, whatsapp_chat, ai_tier, profile_live, cv_parsed, cv_kit_purchased, cv_tier, whatsapp_number, completion_pct, type, verification_tier, verification_report, skill_quadrant, continuous_learning, career_recommendations, ai_resilience_score, languages_spoken, language_proficiency, english_level, native_language, voice_samples, profile_image_url, right_to_work, work_style, linkedin_url, github_url, website_url, portfolio_url')
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
    <div className="min-h-screen bg-white">
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .gradient-border-card {
          background: linear-gradient(#ffffff, #ffffff) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.15), rgba(139,92,246,0.15)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05);
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(14,14,26,0.05) 1px, transparent 1px)',
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
          <a href={`/p/${user.id.slice(0, 8)}`} target="_blank" rel="noopener noreferrer"
            className="text-[#0891B2] text-xs font-bold px-4 py-2 rounded-full border border-[#22D3EE]/30 hover:border-[#22D3EE]/60 transition-colors">
            👁 View public profile
          </a>
          <Link href="/profile/edit"
            className="text-[#5A5A6E] text-xs font-bold px-4 py-2 rounded-full border border-[#0E0E1A]/[0.08] hover:border-[#0E0E1A]/20 transition-colors">
            Edit profile
          </Link>
          <a href="/profile/print" target="_blank"
            className="bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] text-[#060609] text-xs font-black px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
            Download CV ↓
          </a>
          <Link href="/dashboard" className="text-[#5A5A6E] text-sm hover:text-[#3F3F4E] transition-colors">
            ← Dashboard
          </Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pb-20 pt-4">

        {/* Status banner */}
        {!isLive && (
          <div className="gradient-border-card rounded-2xl px-5 py-4 mb-6 flex items-center gap-4">
            <ShapiCharacter mood="thinking" size={48} className="flex-shrink-0" />
            <p className="text-[#3F3F4E] text-sm">
              Your profile is <span className="text-[#0E0E1A] font-semibold">being verified</span> — it will go live once our team confirms your references. Usually 48hrs.
            </p>
          </div>
        )}
        {isLive && (
          <div className="gradient-border-card rounded-2xl px-5 py-4 mb-6 flex items-center gap-4">
            <ShapiCharacter mood="happy" size={48} className="flex-shrink-0" />
            <p className="text-[#3F3F4E] text-sm">
              Your profile is <span className="text-[#0891B2] font-semibold">live</span> — companies can now find and view you. 🎉
            </p>
          </div>
        )}

        {/* Verification tier badge */}
        {(() => {
          const tier = (profile.verification_tier as string) || 'unverified'
          if (tier === 'unverified') return null
          const tierMeta: Record<string, { label: string; color: string; bg: string; emoji: string; description: string }> = {
            basic: { label: 'Basic Verified', color: '#0891B2', bg: 'rgba(34,211,238,0.10)', emoji: '🔵', description: '1 of 2 reference chains complete' },
            strong: { label: 'Strongly Verified', color: '#059669', bg: 'rgba(52,211,153,0.10)', emoji: '🟢', description: 'Both reference chains + peer reference complete' },
            premium: { label: 'Premium Verified', color: '#D97706', bg: 'rgba(251,191,36,0.10)', emoji: '🟡', description: 'Strong + AI cross-check passed with no conflicts' },
          }
          const m = tierMeta[tier]
          if (!m) return null
          return (
            <div className="gradient-border-card rounded-2xl px-5 py-4 mb-6 flex items-center gap-4" style={{ background: m.bg, border: `1px solid ${m.color}33` }}>
              <span className="text-3xl flex-shrink-0">{m.emoji}</span>
              <div>
                <p className="font-bold text-sm" style={{ color: m.color }}>{m.label}</p>
                <p className="text-[#5A5A6E] text-xs mt-0.5">{m.description}</p>
              </div>
            </div>
          )
        })()}

        {/* AI cross-check report — what references independently confirmed */}
        {(() => {
          const report = profile.verification_report as {
            claims_verified?: string[]
            claims_unverified?: string[]
            conflicts?: Array<{ topic: string; perspectives: string[]; note: string }>
            top_skills?: string[]
            tone_summary?: string
            summary_en?: string
          } | null
          if (!report || (!report.summary_en && !(report.claims_verified?.length))) return null
          return (
            <div className="gradient-border-card rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#34D399,#22D3EE)' }} />
                <h2 className="text-[#0E0E1A] font-black text-xl tracking-tight">AI Cross-Check</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#059669' }}>◆ across all references</span>
              </div>
              {report.summary_en && <p className="text-[#3F3F4E] text-sm leading-relaxed mb-4 ml-4">{report.summary_en}</p>}
              <div className="grid sm:grid-cols-2 gap-4 ml-4">
                {(report.claims_verified?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[#059669] text-[11px] font-bold uppercase tracking-wider mb-2">✓ Independently confirmed</p>
                    <ul className="space-y-1">
                      {report.claims_verified!.map((c, i) => <li key={i} className="text-[#3F3F4E] text-xs leading-relaxed">· {c}</li>)}
                    </ul>
                  </div>
                )}
                {(report.top_skills?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[#0891B2] text-[11px] font-bold uppercase tracking-wider mb-2">Most-cited strengths</p>
                    <div className="flex flex-wrap gap-1.5">
                      {report.top_skills!.map((s, i) => (
                        <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,211,238,0.1)', color: '#0891B2' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {(report.conflicts?.length ?? 0) > 0 && (
                <div className="ml-4 mt-4 pt-3 border-t border-[#0E0E1A]/[0.08]">
                  <p className="text-[#D97706] text-[11px] font-bold uppercase tracking-wider mb-2">⚠ Differing perspectives</p>
                  {report.conflicts!.map((c, i) => (
                    <div key={i} className="mb-2">
                      <p className="text-[#3F3F4E] text-xs font-bold">{c.topic}</p>
                      <p className="text-[#5A5A6E] text-[11px] leading-relaxed">{c.note}</p>
                    </div>
                  ))}
                </div>
              )}
              {report.tone_summary && <p className="text-[#8A8A99] text-[11px] mt-3 ml-4 italic">Overall tone: {report.tone_summary}</p>}
            </div>
          )
        })()}

        {/* Header */}
        <div className="gradient-border-card rounded-3xl p-8 mb-4">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-start gap-4">
              {profile.profile_image_url && (
                <img src={profile.profile_image_url as string} alt={(profile.full_name as string) || 'Profile'}
                  className="w-16 h-16 rounded-full object-cover flex-shrink-0" style={{ border: '2px solid rgba(34,211,238,0.3)' }} />
              )}
              <div>
                <h1 className="text-3xl font-black text-[#0E0E1A] mb-1">
                  {profile.full_name || 'Your Name'}
                </h1>
                <p className="text-[#3F3F4E] text-lg">{profile.headline || 'Professional'}</p>
                {profile.location && (
                  <p className="text-[#8A8A99] text-sm mt-1">📍 {profile.location}</p>
                )}
                {(() => {
                  const rtw = Array.isArray(profile.right_to_work) ? profile.right_to_work as Array<{ region?: string; basis?: string; verified?: boolean }> : []
                  if (rtw.length === 0) return null
                  const basisLabel: Record<string, string> = { citizen: 'Citizen', permanent_resident: 'PR', work_visa: 'Work Visa', eu_citizen: 'EU/EEA', need_sponsorship: 'Needs sponsorship' }
                  return (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[#8A8A99] text-[10px] font-bold uppercase tracking-wider self-center">Right to work:</span>
                      {rtw.filter(r => r.region).map((r, i) => (
                        <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(14,14,26,0.04)', color: '#3F3F4E' }}>
                          {r.verified ? '✓' : '○'} {r.region}{r.basis ? ` · ${basisLabel[r.basis] || r.basis}` : ''}
                        </span>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-4xl font-black" style={{
                background: 'linear-gradient(135deg, #22D3EE, #A78BFA)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>{completion}%</div>
              <div className="text-[#8A8A99] text-xs">complete</div>
              {isLive && (
                <span className="inline-block mt-2 bg-[#22D3EE]/15 text-[#0891B2] text-xs font-bold px-3 py-1 rounded-full">
                  ✓ Live
                </span>
              )}
            </div>
          </div>

          {/* AI tier badge */}
          {profile.ai_tier && (
            <span className="inline-block bg-[#A78BFA]/15 text-[#7C3AED] text-xs font-bold px-3 py-1.5 rounded-full capitalize mb-4">
              {aiTierLabel[profile.ai_tier] || profile.ai_tier}
            </span>
          )}

          {/* Summary */}
          {profile.summary && (
            <p className="text-[#3F3F4E] text-sm leading-relaxed">{profile.summary}</p>
          )}
        </div>

        {/* Skill fingerprint — Hands/Heart/Head/Spark radar with AI Tier badge */}
        {profile.skill_quadrant && (
          <div className="gradient-border-card rounded-2xl p-6 mb-4">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#22D3EE,#A78BFA)' }} />
                  <h2 className="text-[#0E0E1A] font-black text-xl tracking-tight">Skill Fingerprint</h2>
                </div>
                <p className="text-[#5A5A6E] text-xs mt-1 ml-4">How you work, scored 0–10 on 4 axes</p>
              </div>
              {profile.ai_tier && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(167,139,250,0.10)', color: '#7C3AED', border: '1px solid rgba(167,139,250,0.2)' }}>
                  🤖 AI {(profile.ai_tier as string).charAt(0).toUpperCase() + (profile.ai_tier as string).slice(1)}
                </span>
              )}
            </div>
            <div className="flex justify-center">
              <SkillRadar data={profile.skill_quadrant as { hands: number; heart: number; head: number; spark: number; reasoning?: string }} />
            </div>
          </div>
        )}

        {/* Work Style — self-assessment (Shapi-assessed). Prompt to take it if not done. */}
        {(() => {
          const ws = profile.work_style as { scores?: Record<string, number> } | null
          const dims: Array<{ key: string; poleA: string; poleB: string }> = [
            { key: 'collaboration', poleA: 'Collaborative', poleB: 'Independent' },
            { key: 'leadership', poleA: 'Director', poleB: 'Contributor' },
            { key: 'structure', poleA: 'Structured', poleB: 'Adaptive' },
            { key: 'decisions', poleA: 'Analytical', poleB: 'Intuitive' },
            { key: 'communication', poleA: 'Direct', poleB: 'Diplomatic' },
          ]
          if (!ws?.scores) {
            return (
              <div className="gradient-border-card rounded-2xl p-6 mb-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-[#0E0E1A] font-black text-base mb-1">Work-style check <span className="text-[10px] font-bold px-2 py-0.5 rounded-full align-middle" style={{ background: 'rgba(14,14,26,0.04)', color: '#5A5A6E' }}>optional · 2 min</span></h2>
                    <p className="text-[#5A5A6E] text-xs">Show companies how you prefer to work — team vs solo, leader vs contributor, and more.</p>
                  </div>
                  <a href="/work-style" className="flex-shrink-0 px-4 py-2.5 rounded-xl font-black text-xs" style={{ background: 'linear-gradient(135deg,#22D3EE,#A78BFA)', color: '#060609' }}>Take it →</a>
                </div>
              </div>
            )
          }
          return (
            <div className="gradient-border-card rounded-2xl p-6 mb-4">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#22D3EE,#A78BFA)' }} />
                <h2 className="text-[#0E0E1A] font-black text-xl tracking-tight">Work Style</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#EDE9FE', color: '#7C3AED' }}>◆ Shapi-assessed</span>
                <a href="/work-style" className="ml-auto text-[#8A8A99] text-xs hover:text-[#3F3F4E]">Retake</a>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                {dims.map(d => {
                  const score = ws.scores![d.key] ?? 50
                  const label = score >= 65 ? d.poleA : score <= 35 ? d.poleB : `Balanced`
                  return (
                    <div key={d.key}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-[#5A5A6E]">{d.poleB}</span>
                        <span className="text-[#0E0E1A] font-bold">{label}</span>
                        <span className="text-[#5A5A6E]">{d.poleA}</span>
                      </div>
                      <div className="relative h-2 rounded-full" style={{ background: 'rgba(14,14,26,0.06)' }}>
                        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full" style={{ left: `calc(${score}% - 6px)`, background: 'linear-gradient(135deg,#22D3EE,#A78BFA)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left column */}
          <div className="md:col-span-2 space-y-4">

            {/* Work history */}
            {workHistory.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <div className="flex items-center gap-2.5 mb-5">
                  <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#22D3EE,#A78BFA)' }} />
                  <h2 className="text-[#0E0E1A] font-black text-xl tracking-tight">Experience</h2>
                </div>
                <div className="space-y-6">
                  {workHistory.map((job, i) => (
                    <div key={i} className={i > 0 ? 'pt-6 border-t border-[#0E0E1A]/[0.08]' : ''}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-[#0E0E1A] font-bold">{job.title || '—'}</p>
                          <p className="text-[#5A5A6E] text-sm">{job.company || '—'}</p>
                        </div>
                        <p className="text-[#8A8A99] text-xs text-right flex-shrink-0">
                          {job.start}{job.end ? ` – ${job.end}` : ''}
                        </p>
                      </div>
                      {job.achievements && (
                        <p className="text-[#5A5A6E] text-sm leading-relaxed mt-2">{job.achievements}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {workHistory.length === 0 && (
              <div className="gradient-border-card rounded-2xl p-8 text-center">
                <p className="text-[#8A8A99] text-sm">Work history will appear here once your CV is processed</p>
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
            {/* Languages — spoken + proficiency scores */}
            {(() => {
              const langs = Array.isArray(profile.languages_spoken)
                ? (profile.languages_spoken as Array<{ language?: string; level?: string }>)
                : []
              const proficiency = profile.language_proficiency as {
                conversation_language?: string
                cefr_level?: string
                ielts_equivalent?: string
                english_level?: string
                proficiency_notes?: string
              } | null
              if (langs.length === 0 && !proficiency) return null

              const cefrInfo: Record<string, string> = {
                A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate',
                B2: 'Upper-intermediate (fluent professional)',
                C1: 'Advanced', C2: 'Mastery / near-native',
              }

              return (
                <div className="gradient-border-card rounded-2xl p-6">
                  <h2 className="text-[#0E0E1A] font-black text-sm uppercase tracking-widest mb-4 opacity-50">Languages</h2>

                  {langs.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {langs.map((l, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="text-[#0E0E1A] text-sm">{l.language}</span>
                          <span className="text-[#8A8A99] text-xs">{l.level}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {proficiency && (proficiency.cefr_level || proficiency.english_level || proficiency.ielts_equivalent) && (
                    <div className="pt-3 border-t border-[#0E0E1A]/[0.08]">
                      <p className="text-[#8A8A99] text-[10px] font-bold uppercase tracking-wider mb-2">Verified via WhatsApp</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {proficiency.cefr_level && (
                          <span
                            title={`CEFR ${proficiency.cefr_level} — ${cefrInfo[proficiency.cefr_level] || 'language proficiency standard'}`}
                            className="text-xs font-bold px-2 py-1 rounded-full cursor-help"
                            style={{ background: 'rgba(34,211,238,0.08)', color: '#0891B2' }}
                          >
                            {proficiency.cefr_level} CEFR ⓘ
                          </span>
                        )}
                        {proficiency.ielts_equivalent && (
                          <span
                            title={`IELTS ${proficiency.ielts_equivalent} band — international English testing scale (0-9)`}
                            className="text-xs font-bold px-2 py-1 rounded-full cursor-help"
                            style={{ background: 'rgba(167,139,250,0.08)', color: '#7C3AED' }}
                          >
                            IELTS {proficiency.ielts_equivalent} ⓘ
                          </span>
                        )}
                        {proficiency.english_level && proficiency.english_level !== 'unassessed' && (
                          <span
                            title={`English CEFR ${proficiency.english_level} — ${cefrInfo[proficiency.english_level] || 'English proficiency'}`}
                            className="text-xs font-bold px-2 py-1 rounded-full cursor-help"
                            style={{ background: 'rgba(251,113,133,0.08)', color: '#E11D48' }}
                          >
                            {proficiency.english_level} English ⓘ
                          </span>
                        )}
                      </div>
                      <p className="text-[#8A8A99] text-[10px] leading-relaxed">
                        A1/A2 beginner · B1/B2 intermediate (B2 = fluent professional) · C1/C2 advanced
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Voice samples — playable audio per language */}
            {(() => {
              const samples = (profile.voice_samples as Record<string, { transcript?: string; duration_s?: number; language: string }> | null) || {}
              const entries = Object.entries(samples)
              if (entries.length === 0) return null
              return (
                <div className="gradient-border-card rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-[#0E0E1A] font-black text-sm uppercase tracking-widest opacity-50">Voice Samples</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,211,238,0.12)', color: '#0891B2' }}>NEW</span>
                  </div>
                  <p className="text-[#8A8A99] text-xs mb-4">Hiring managers hear how you communicate — much more authentic than text alone.</p>
                  <div className="space-y-3">
                    {entries.map(([lang, s]) => (
                      <div key={lang} className="bg-[#0E0E1A]/[0.04] rounded-xl p-3 border border-[#0E0E1A]/[0.08]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[#0E0E1A] text-sm font-bold capitalize">{s.language || lang}</span>
                          {s.duration_s && <span className="text-[#8A8A99] text-[10px]">{s.duration_s}s</span>}
                        </div>
                        <audio controls preload="none" src={`/api/voice-sample/${user.id}/${encodeURIComponent(lang)}`} className="w-full" style={{ height: 32 }}>
                          Your browser does not support audio playback.
                        </audio>
                        {s.transcript && (
                          <p className="text-[#5A5A6E] text-[11px] mt-2 italic line-clamp-2">&ldquo;{s.transcript}&rdquo;</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Skills */}
            {skills.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-[#0E0E1A] font-black text-sm uppercase tracking-widest mb-4 opacity-50">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, i) => (
                    <span key={i} className="bg-[#0E0E1A]/[0.04] text-[#3F3F4E] text-xs px-3 py-1.5 rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Verification status */}
            <div className="gradient-border-card rounded-2xl p-6">
              <h2 className="text-[#0E0E1A] font-black text-sm uppercase tracking-widest mb-4 opacity-50">Verification</h2>
              <div className="space-y-3">
                {[
                  { label: 'CV parsed', done: profile.cv_parsed },
                  { label: 'WhatsApp interview', done: Array.isArray(profile.whatsapp_chat) && (profile.whatsapp_chat as unknown[]).length > 2 },
                  { label: 'References checked', done: refScore.jobsComplete >= 1 },
                  { label: 'Profile live', done: isLive },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-[#22D3EE]/20' : 'bg-[#0E0E1A]/[0.04]'}`}>
                      {item.done
                        ? <svg className="w-3 h-3 text-[#0891B2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        : <div className="w-1.5 h-1.5 rounded-full bg-[#0E0E1A]/[0.04]" />
                      }
                    </div>
                    <span className={`text-sm ${item.done ? 'text-[#3F3F4E]' : 'text-[#8A8A99]'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CV Download CTA */}
            <CVDownloadButton cvParsed={!!profile.cv_parsed} cvKitPurchased={cvKitPurchased} cvTier={profile.cv_tier as string | null} />

            {/* References CTA / status — tiered completion */}
            <Link href="/profile/references" className="block gradient-border-card rounded-2xl p-5 hover:bg-[#0E0E1A]/[0.03] transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[#0E0E1A] font-bold text-sm">References</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: refScore.jobsComplete === 2 ? 'rgba(52,211,153,0.15)' : refScore.jobsComplete === 1 ? 'rgba(251,191,36,0.15)' : 'rgba(251,113,133,0.15)',
                    color: refScore.jobsComplete === 2 ? '#34D399' : refScore.jobsComplete === 1 ? '#FBBF24' : '#FB7185',
                  }}>
                  {refScore.jobsComplete} of 2 jobs verified
                </span>
              </div>
              <p className="text-[#8A8A99] text-xs leading-relaxed">
                {refScore.jobsComplete === 2
                  ? 'Both jobs fully verified — profile live ✓'
                  : refScore.jobsComplete === 1
                  ? 'One more job to verify (85% → 100%). Add your second manager.'
                  : 'Add the line manager from your 2 latest jobs. We contact them, they nominate a colleague + stakeholder, you get verified — and 100% complete.'}
              </p>
              <p className="text-[#0891B2] text-xs font-semibold mt-3">
                {refScore.jobsComplete === 2 ? 'View references →' : 'Add references →'}
              </p>
            </Link>

            {/* Evidence CTA / status */}
            <Link href="/evidence" className="block gradient-border-card rounded-2xl p-5 hover:bg-[#0E0E1A]/[0.03] transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[#0E0E1A] font-bold text-sm">Work evidence</p>
                {hasEvidence ? (
                  <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded-full flex-shrink-0">
                    {evidenceCount} file{evidenceCount !== 1 ? 's' : ''} ✓
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-[#FB7185]/12 text-[#E11D48] px-2 py-0.5 rounded-full flex-shrink-0">Optional</span>
                )}
              </div>
              <p className="text-[#8A8A99] text-xs">
                {hasEvidence ? 'Photos and docs uploaded — strengthens your verified profile.' : 'Photos, docs, references that prove your track record'}
              </p>
              <p className="text-[#0891B2] text-xs font-semibold mt-3">
                {hasEvidence ? 'Add more →' : 'Upload evidence →'}
              </p>
            </Link>

            {/* Online presence — the links from profile/edit, surfaced as proof */}
            {(() => {
              const links = [
                { url: profile.linkedin_url as string | null, label: 'LinkedIn', icon: 'in' },
                { url: profile.github_url as string | null, label: 'GitHub', icon: '</>' },
                { url: profile.website_url as string | null, label: 'Website', icon: '🌐' },
                { url: profile.portfolio_url as string | null, label: 'Portfolio', icon: '🎨' },
              ].filter(l => l.url && l.url.trim())
              if (links.length === 0) return null
              const tidy = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/$/, '')
              return (
                <div className="gradient-border-card rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-[#0E0E1A] font-bold text-sm">Online presence</p>
                    <Link href="/profile/edit" className="text-[#8A8A99] text-[10px] hover:text-[#3F3F4E] flex-shrink-0">Edit</Link>
                  </div>
                  <div className="space-y-2">
                    {links.map((l, i) => (
                      <a key={i} href={l.url!.startsWith('http') ? l.url! : `https://${l.url}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2.5 bg-[#0E0E1A]/[0.04] hover:bg-[#0E0E1A]/[0.06] rounded-lg px-3 py-2 transition-colors">
                        <span className="text-[#0891B2] text-xs font-bold w-8 flex-shrink-0">{l.icon}</span>
                        <span className="min-w-0">
                          <span className="text-[#0E0E1A] text-xs font-bold block">{l.label}</span>
                          <span className="text-[#8A8A99] text-[11px] truncate block">{tidy(l.url!)}</span>
                        </span>
                        <span className="text-[#8A8A99] text-xs ml-auto flex-shrink-0">↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
