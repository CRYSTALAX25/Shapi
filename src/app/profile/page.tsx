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
    .select('full_name, headline, location, summary, skills, work_history, whatsapp_chat, ai_tier, profile_live, cv_parsed, cv_kit_purchased, cv_tier, whatsapp_number, completion_pct, type, verification_tier, verification_report, skill_quadrant, continuous_learning, career_recommendations, ai_resilience_score, languages_spoken, language_proficiency, english_level, native_language, voice_samples, profile_image_url, right_to_work, work_style')
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
            <div className="flex items-start gap-4">
              {profile.profile_image_url && (
                <img src={profile.profile_image_url as string} alt={(profile.full_name as string) || 'Profile'}
                  className="w-16 h-16 rounded-full object-cover flex-shrink-0" style={{ border: '2px solid rgba(34,211,238,0.3)' }} />
              )}
              <div>
                <h1 className="text-3xl font-black text-white mb-1">
                  {profile.full_name || 'Your Name'}
                </h1>
                <p className="text-white/60 text-lg">{profile.headline || 'Professional'}</p>
                {profile.location && (
                  <p className="text-white/35 text-sm mt-1">📍 {profile.location}</p>
                )}
                {(() => {
                  const rtw = Array.isArray(profile.right_to_work) ? profile.right_to_work as Array<{ region?: string; basis?: string; verified?: boolean }> : []
                  if (rtw.length === 0) return null
                  const basisLabel: Record<string, string> = { citizen: 'Citizen', permanent_resident: 'PR', work_visa: 'Work Visa', eu_citizen: 'EU/EEA', need_sponsorship: 'Needs sponsorship' }
                  return (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-white/30 text-[10px] font-bold uppercase tracking-wider self-center">Right to work:</span>
                      {rtw.filter(r => r.region).map((r, i) => (
                        <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
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
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#22D3EE,#A78BFA)' }} />
                  <h2 className="text-white font-black text-xl tracking-tight">Skill Fingerprint</h2>
                </div>
                <p className="text-white/40 text-xs mt-1 ml-4">How you work, scored 0–10 on 4 axes</p>
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
                    <h2 className="text-white font-black text-base mb-1">Work-style check <span className="text-[10px] font-bold px-2 py-0.5 rounded-full align-middle" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>optional · 2 min</span></h2>
                    <p className="text-white/40 text-xs">Show companies how you prefer to work — team vs solo, leader vs contributor, and more.</p>
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
                <h2 className="text-white font-black text-xl tracking-tight">Work Style</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#EDE9FE', color: '#A78BFA' }}>◆ Shapi-assessed</span>
                <a href="/work-style" className="ml-auto text-white/30 text-xs hover:text-white/60">Retake</a>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                {dims.map(d => {
                  const score = ws.scores![d.key] ?? 50
                  const label = score >= 65 ? d.poleA : score <= 35 ? d.poleB : `Balanced`
                  return (
                    <div key={d.key}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-white/45">{d.poleB}</span>
                        <span className="text-white font-bold">{label}</span>
                        <span className="text-white/45">{d.poleA}</span>
                      </div>
                      <div className="relative h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
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
                  <h2 className="text-white font-black text-xl tracking-tight">Experience</h2>
                </div>
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
                  <h2 className="text-white font-black text-sm uppercase tracking-widest mb-4 opacity-50">Languages</h2>

                  {langs.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {langs.map((l, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="text-white/80 text-sm">{l.language}</span>
                          <span className="text-white/35 text-xs">{l.level}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {proficiency && (proficiency.cefr_level || proficiency.english_level || proficiency.ielts_equivalent) && (
                    <div className="pt-3 border-t border-white/[0.06]">
                      <p className="text-white/35 text-[10px] font-bold uppercase tracking-wider mb-2">Verified via WhatsApp</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {proficiency.cefr_level && (
                          <span
                            title={`CEFR ${proficiency.cefr_level} — ${cefrInfo[proficiency.cefr_level] || 'language proficiency standard'}`}
                            className="text-xs font-bold px-2 py-1 rounded-full cursor-help"
                            style={{ background: 'rgba(34,211,238,0.08)', color: '#22D3EE' }}
                          >
                            {proficiency.cefr_level} CEFR ⓘ
                          </span>
                        )}
                        {proficiency.ielts_equivalent && (
                          <span
                            title={`IELTS ${proficiency.ielts_equivalent} band — international English testing scale (0-9)`}
                            className="text-xs font-bold px-2 py-1 rounded-full cursor-help"
                            style={{ background: 'rgba(167,139,250,0.08)', color: '#A78BFA' }}
                          >
                            IELTS {proficiency.ielts_equivalent} ⓘ
                          </span>
                        )}
                        {proficiency.english_level && proficiency.english_level !== 'unassessed' && (
                          <span
                            title={`English CEFR ${proficiency.english_level} — ${cefrInfo[proficiency.english_level] || 'English proficiency'}`}
                            className="text-xs font-bold px-2 py-1 rounded-full cursor-help"
                            style={{ background: 'rgba(251,113,133,0.08)', color: '#FB7185' }}
                          >
                            {proficiency.english_level} English ⓘ
                          </span>
                        )}
                      </div>
                      <p className="text-white/25 text-[10px] leading-relaxed">
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
                    <h2 className="text-white font-black text-sm uppercase tracking-widest opacity-50">Voice Samples</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,211,238,0.12)', color: '#22D3EE' }}>NEW</span>
                  </div>
                  <p className="text-white/35 text-xs mb-4">Hiring managers hear how you communicate — much more authentic than text alone.</p>
                  <div className="space-y-3">
                    {entries.map(([lang, s]) => (
                      <div key={lang} className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.04]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white/80 text-sm font-bold capitalize">{s.language || lang}</span>
                          {s.duration_s && <span className="text-white/30 text-[10px]">{s.duration_s}s</span>}
                        </div>
                        <audio controls preload="none" src={`/api/voice-sample/${user.id}/${encodeURIComponent(lang)}`} className="w-full" style={{ height: 32 }}>
                          Your browser does not support audio playback.
                        </audio>
                        {s.transcript && (
                          <p className="text-white/40 text-[11px] mt-2 italic line-clamp-2">&ldquo;{s.transcript}&rdquo;</p>
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
