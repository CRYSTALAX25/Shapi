import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'

type WorkEntry = { title?: string; company?: string; start?: string; end?: string; achievements?: string }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('full_name, headline').ilike('id', `${id}%`).limit(1).single()
  return {
    title: data?.full_name ? `${data.full_name} — Shapi` : 'Shapi Profile',
    description: data?.headline || 'Verified professional profile on Shapi',
  }
}

export default async function PublicProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  // Support short 8-char IDs (from the share link) or full UUIDs
  const { data: c } = await admin
    .from('profiles')
    .select('id, full_name, headline, location, summary, skills, work_history, whatsapp_chat, ai_tier, completion_pct, profile_live, industry, linkedin_url, github_url, website_url, portfolio_url, languages_spoken, language_proficiency, english_level, native_language, voice_samples, profile_image_url, right_to_work, work_style, verification_tier, verification_report')
    .ilike('id', `${id}%`)
    .eq('type', 'candidate')
    .limit(1)
    .single()

  if (!c) notFound()

  // Fetch completed references (public data only — no responses, no names of nominees)
  const { data: refRows } = await admin
    .from('candidate_references')
    .select('ref_type, extracted_skills, job_slot')
    .eq('candidate_id', c.id)
    .eq('status', 'completed')

  const completedRefs = refRows || []
  const refCount = completedRefs.length

  // Completed courses (verified learning) to show on the company-facing profile
  const { data: courseRows } = await admin
    .from('candidate_courses')
    .select('course_name, platform, verification_status, credential_url, sponsored_by')
    .eq('candidate_id', c.id)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
  const completedCourses = courseRows || []
  // Merge all extracted skills from references, deduplicate, cap at 10
  const refSkillsRaw: string[] = completedRefs.flatMap(r => Array.isArray(r.extracted_skills) ? r.extracted_skills : [])
  const refSkills = [...new Set(refSkillsRaw)].slice(0, 10)
  const managerRefs = completedRefs.filter(r => r.ref_type === 'manager').length
  const independentRefs = completedRefs.filter(r => r.ref_type !== 'manager').length

  const skills: string[] = Array.isArray(c.skills) ? c.skills : []
  const workHistory: WorkEntry[] = Array.isArray(c.work_history) ? c.work_history : []
  const userAnswers = (Array.isArray(c.whatsapp_chat) ? c.whatsapp_chat : [])
    .filter((m: {role: string; content: string}) => m.role === 'user')
    .slice(0, 3)
  const languagesSpoken: Array<{ language: string; level: string }> = Array.isArray(c.languages_spoken) ? c.languages_spoken : []
  const langProficiency = c.language_proficiency as {
    conversation_language?: string
    cefr_level?: string
    ielts_equivalent?: string
    english_level?: string
    proficiency_notes?: string
  } | null

  const aiTierLabel: Record<string, string> = { user: 'AI User', integrator: 'AI Integrator', builder: 'AI Builder' }

  return (
    <div className="min-h-screen bg-[#060609]">
      <style>{`
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

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.06] flex items-center justify-between max-w-4xl mx-auto">
        <a href="https://shapi.io" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</a>
        <span className="text-white/25 text-xs">Independently verified profile</span>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">

        {/* Header */}
        <div className="gradient-border-card rounded-3xl p-8 mb-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-4">
              {c.profile_image_url && (
                <img src={c.profile_image_url as string} alt={(c.full_name as string) || 'Profile'}
                  className="w-16 h-16 rounded-full object-cover flex-shrink-0" style={{ border: '2px solid rgba(34,211,238,0.3)' }} />
              )}
              <div>
                <h1 className="text-3xl font-black text-white mb-1">{c.full_name || '—'}</h1>
                <p className="text-white/60 text-lg">{c.headline || '—'}</p>
                {c.location && <p className="text-white/35 text-sm mt-1">📍 {c.location}</p>}
                {(() => {
                  const rtw = Array.isArray(c.right_to_work) ? c.right_to_work as Array<{ region?: string; basis?: string; verified?: boolean }> : []
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
            {c.profile_live && (
              <span className="flex-shrink-0 bg-[#22D3EE]/15 text-[#22D3EE] text-xs font-bold px-3 py-1.5 rounded-full">
                ✓ Verified
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {c.ai_tier && (
              <span className="bg-[#A78BFA]/15 text-[#A78BFA] text-xs font-bold px-3 py-1.5 rounded-full">
                {aiTierLabel[c.ai_tier] || c.ai_tier}
              </span>
            )}
            {c.industry && (
              <span className="bg-[#22D3EE]/10 text-[#22D3EE] text-xs font-bold px-3 py-1.5 rounded-full capitalize">
                {c.industry}
              </span>
            )}
          </div>

          {c.summary && <p className="text-white/55 text-sm leading-relaxed">{c.summary}</p>}

          {/* Profile links */}
          {(c.linkedin_url || c.github_url || c.website_url || c.portfolio_url) && (
            <div className="flex flex-wrap gap-2 mt-5">
              {c.linkedin_url && (
                <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: 'rgba(0,119,181,0.12)', color: '#0ea5e9', border: '1px solid rgba(0,119,181,0.25)' }}>
                  <span className="font-black">in</span> LinkedIn
                </a>
              )}
              {c.github_url && (
                <a href={c.github_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  {'</>'} GitHub
                </a>
              )}
              {c.website_url && (
                <a href={c.website_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: 'rgba(34,211,238,0.08)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.2)' }}>
                  🌐 Website
                </a>
              )}
              {c.portfolio_url && (
                <a href={c.portfolio_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.2)' }}>
                  🗂 Portfolio
                </a>
              )}
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-white/[0.06]">
            <p className="text-white/25 text-xs">
              Want to hire {c.full_name?.split(' ')[0] || 'this candidate'}?{' '}
              <a href="https://shapi.io" className="text-[#22D3EE] hover:underline">Create a company account →</a>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-5">
            {/* AI cross-check — the verification moat. What references independently confirmed. */}
            {(() => {
              const report = c.verification_report as {
                claims_verified?: string[]
                claims_unverified?: string[]
                conflicts?: Array<{ topic: string; perspectives: string[]; note: string }>
                top_skills?: string[]
                tone_summary?: string
                summary_en?: string
              } | null
              if (!report || (!report.summary_en && !(report.claims_verified?.length))) return null
              return (
                <div className="rounded-2xl p-6" style={{
                  background: 'linear-gradient(#0d0d14,#0d0d14) padding-box, linear-gradient(135deg,rgba(52,211,153,0.35),rgba(34,211,238,0.25)) border-box',
                  border: '1px solid transparent',
                }}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#34D399,#22D3EE)' }} />
                    <h2 className="text-white font-black text-xl tracking-tight">AI Cross-Check</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.18)', color: '#34D399' }}>✓ verified across references</span>
                  </div>
                  <p className="text-white/40 text-xs mb-4 ml-4">Independent claims compared across every reference — conflicts flagged, not hidden.</p>
                  {report.summary_en && <p className="text-white/70 text-sm leading-relaxed mb-4 ml-4">{report.summary_en}</p>}
                  <div className="grid sm:grid-cols-2 gap-4 ml-4">
                    {(report.claims_verified?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[#34D399] text-[11px] font-bold uppercase tracking-wider mb-2">✓ Independently confirmed</p>
                        <ul className="space-y-1">
                          {report.claims_verified!.map((cl, i) => <li key={i} className="text-white/65 text-xs leading-relaxed">· {cl}</li>)}
                        </ul>
                      </div>
                    )}
                    {(report.top_skills?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[#22D3EE] text-[11px] font-bold uppercase tracking-wider mb-2">Most-cited strengths</p>
                        <div className="flex flex-wrap gap-1.5">
                          {report.top_skills!.map((s, i) => (
                            <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,211,238,0.1)', color: '#67E8F9' }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {(report.conflicts?.length ?? 0) > 0 && (
                    <div className="ml-4 mt-4 pt-3 border-t border-white/[0.06]">
                      <p className="text-[#FBBF24] text-[11px] font-bold uppercase tracking-wider mb-2">⚠ Differing perspectives</p>
                      {report.conflicts!.map((cf, i) => (
                        <div key={i} className="mb-2">
                          <p className="text-white/70 text-xs font-bold">{cf.topic}</p>
                          <p className="text-white/40 text-[11px] leading-relaxed">{cf.note}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {report.tone_summary && <p className="text-white/35 text-[11px] mt-3 ml-4 italic">Overall tone: {report.tone_summary}</p>}
                </div>
              )
            })()}

            {workHistory.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-white font-black text-xs uppercase tracking-widest mb-5 opacity-50">Experience</h2>
                <div className="space-y-5">
                  {workHistory.map((job, i) => (
                    <div key={i} className={i > 0 ? 'pt-5 border-t border-white/[0.06]' : ''}>
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

            {userAnswers.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-white font-black text-xs uppercase tracking-widest mb-1 opacity-50">In their own words</h2>
                <p className="text-white/25 text-xs mb-5">From their Shapi conversation</p>
                <div className="space-y-3">
                  {userAnswers.map((m: {role: string; content: string}, i: number) => (
                    <div key={i} className="bg-white/[0.03] rounded-xl px-4 py-3 border-l-2 border-[#A78BFA]/40">
                      <p className="text-white/65 text-sm leading-relaxed">&ldquo;{m.content}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {skills.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-white font-black text-xs uppercase tracking-widest mb-4 opacity-50">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {skills.map((s, i) => (
                    <span key={i} className="bg-white/[0.06] text-white/60 text-xs px-3 py-1.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages & proficiency */}
            {(languagesSpoken.length > 0 || langProficiency) && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-white font-black text-xs uppercase tracking-widest mb-4 opacity-50">Languages</h2>

                {languagesSpoken.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {languagesSpoken.map((lang, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-white/70 text-sm">{lang.language}</span>
                        <span className="text-white/35 text-xs capitalize bg-white/[0.05] px-2 py-0.5 rounded-full">{lang.level}</span>
                      </div>
                    ))}
                  </div>
                )}

                {langProficiency?.cefr_level && (
                  <div className="border-t border-white/[0.06] pt-4 mt-2">
                    <p className="text-white/25 text-xs mb-3 uppercase tracking-wider font-bold">Assessed proficiency</p>
                    <div className="flex gap-2 flex-wrap">
                      <div className="bg-[#22D3EE]/10 border border-[#22D3EE]/20 rounded-xl px-3 py-2 text-center flex-1 min-w-[70px]">
                        <p className="text-[#22D3EE] text-base font-black">{langProficiency.cefr_level}</p>
                        <p className="text-white/30 text-[10px]">CEFR</p>
                      </div>
                      {langProficiency.ielts_equivalent && (
                        <div className="bg-[#A78BFA]/10 border border-[#A78BFA]/20 rounded-xl px-3 py-2 text-center flex-1 min-w-[70px]">
                          <p className="text-[#A78BFA] text-base font-black">{langProficiency.ielts_equivalent}</p>
                          <p className="text-white/30 text-[10px]">IELTS est.</p>
                        </div>
                      )}
                      {langProficiency.english_level && langProficiency.english_level !== 'unassessed' && (
                        <div className="bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-3 py-2 text-center flex-1 min-w-[70px]">
                          <p className="text-[#FB7185] text-base font-black">{langProficiency.english_level}</p>
                          <p className="text-white/30 text-[10px]">English</p>
                        </div>
                      )}
                    </div>
                    {langProficiency.proficiency_notes && (
                      <p className="text-white/25 text-xs mt-3 leading-relaxed">{langProficiency.proficiency_notes}</p>
                    )}
                    <p className="text-white/15 text-[10px] mt-2">Assessed via Shapi conversation</p>
                  </div>
                )}
              </div>
            )}

            {/* Voice samples — playable audio per language */}
            {(() => {
              const samples = (c.voice_samples as Record<string, { transcript?: string; duration_s?: number; language: string }> | null) || {}
              const entries = Object.entries(samples)
              if (entries.length === 0) return null
              return (
                <div className="gradient-border-card rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-white font-black text-xs uppercase tracking-widest opacity-50">Voice Samples</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,211,238,0.12)', color: '#22D3EE' }}>LIVE</span>
                  </div>
                  <p className="text-white/35 text-xs mb-4">Hear how this candidate actually communicates — recorded via Shapi WhatsApp.</p>
                  <div className="space-y-3">
                    {entries.map(([lang, s]) => (
                      <div key={lang} className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.04]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white/80 text-sm font-bold capitalize">{s.language || lang}</span>
                          {s.duration_s && <span className="text-white/30 text-[10px]">{s.duration_s}s</span>}
                        </div>
                        <audio controls preload="none" src={`/api/voice-sample/${c.id}/${encodeURIComponent(lang)}`} className="w-full" style={{ height: 32 }}>
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

            {/* Work Style — self-assessment */}
            {(() => {
              const ws = c.work_style as { scores?: Record<string, number> } | null
              if (!ws?.scores) return null
              const dims = [
                { key: 'collaboration', poleA: 'Collaborative', poleB: 'Independent' },
                { key: 'leadership', poleA: 'Director', poleB: 'Contributor' },
                { key: 'structure', poleA: 'Structured', poleB: 'Adaptive' },
                { key: 'decisions', poleA: 'Analytical', poleB: 'Intuitive' },
                { key: 'communication', poleA: 'Direct', poleB: 'Diplomatic' },
              ]
              return (
                <div className="gradient-border-card rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-white font-black text-xs uppercase tracking-widest opacity-50">Work Style</h2>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(167,139,250,0.15)', color: '#A78BFA' }}>◆ self-assessed</span>
                  </div>
                  <div className="space-y-3">
                    {dims.map(d => {
                      const score = ws.scores![d.key] ?? 50
                      const label = score >= 65 ? d.poleA : score <= 35 ? d.poleB : 'Balanced'
                      return (
                        <div key={d.key}>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-white/40">{d.poleB}</span>
                            <span className="text-white/80 font-bold">{label}</span>
                            <span className="text-white/40">{d.poleA}</span>
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

            {/* Verified learning — completed courses */}
            {completedCourses.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-white font-black text-xs uppercase tracking-widest mb-4 opacity-50">Courses & Learning</h2>
                <div className="space-y-2">
                  {completedCourses.map((cc, i) => {
                    const verified = cc.verification_status === 'verified'
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                        <span className="text-white/75 text-xs">{cc.course_name}{cc.platform ? <span className="text-white/35"> · {cc.platform}</span> : null}</span>
                        <span className="flex items-center gap-1.5 flex-shrink-0">
                          {cc.sponsored_by && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>🏢 {cc.sponsored_by}</span>}
                          {verified
                            ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>✓ Verified</span>
                            : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>○ Self-reported</span>}
                          {cc.credential_url && <a href={cc.credential_url as string} target="_blank" rel="noopener noreferrer" className="text-[#22D3EE] text-[10px] font-bold">cert ↗</a>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* References badge */}
            {refCount > 0 && (
              <div className="rounded-2xl p-6" style={{
                background: refCount >= 3
                  ? 'linear-gradient(#0d0d14,#0d0d14) padding-box, linear-gradient(135deg,rgba(52,211,153,0.3),rgba(34,211,238,0.2)) border-box'
                  : 'linear-gradient(#0d0d14,#0d0d14) padding-box, linear-gradient(135deg,rgba(34,211,238,0.15),rgba(139,92,246,0.15)) border-box',
                border: '1px solid transparent',
              }}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-white font-black text-2xl leading-none">{refCount}</p>
                    <p className="text-white/50 text-xs mt-0.5 font-bold uppercase tracking-wider">
                      verified reference{refCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {refCount >= 3 && (
                    <span className="flex-shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
                      ✓ Verified
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 mb-4">
                  {managerRefs > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#22D3EE]/60 flex-shrink-0" />
                      <p className="text-white/40 text-xs">{managerRefs} direct manager{managerRefs !== 1 ? 's' : ''}</p>
                    </div>
                  )}
                  {independentRefs > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]/60 flex-shrink-0" />
                      <p className="text-white/40 text-xs">{independentRefs} independently nominated</p>
                    </div>
                  )}
                </div>

                {refSkills.length > 0 && (
                  <div className="mb-4">
                    <p className="text-white/25 text-[10px] uppercase tracking-wider font-bold mb-2">Mentioned by references</p>
                    <div className="flex flex-wrap gap-1.5">
                      {refSkills.map((s, i) => (
                        <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-white/20 text-[10px] leading-relaxed">
                  Candidate was not told who was contacted. References sourced independently via Shapi.
                </p>
              </div>
            )}

            <div className="gradient-border-card rounded-2xl p-6 text-center">
              <p className="text-white/40 text-xs mb-3">Verified by</p>
              <a href="https://shapi.io" className="font-black text-lg tracking-tighter" style={{
                background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>shapi</a>
              <p className="text-white/25 text-xs mt-2">shapi.io · Shape what&apos;s next</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
