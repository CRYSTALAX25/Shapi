import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'

type WorkEntry = { title?: string; company?: string; start?: string; end?: string; achievements?: string }

// `profiles.id` is a UUID column — you cannot ILIKE a uuid (Postgres throws
// "operator does not exist: uuid ~~* unknown"). The share link uses the first
// 8 hex chars of the UUID, so we match by UUID range: every UUID whose first
// group equals the prefix falls between <prefix>-0000-… and <prefix>-ffff-…
// A full UUID is matched exactly.
function uuidMatch(raw: string): { full: string } | { lo: string; hi: string } {
  const s = raw.trim().toLowerCase()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)) {
    return { full: s }
  }
  const hex = s.replace(/[^0-9a-f]/g, '').slice(0, 8)
  return {
    lo: `${hex.padEnd(8, '0')}-0000-0000-0000-000000000000`,
    hi: `${hex.padEnd(8, 'f')}-ffff-ffff-ffff-ffffffffffff`,
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const m = uuidMatch(id)
  let q = admin.from('profiles').select('full_name, headline')
  q = 'full' in m ? q.eq('id', m.full) : q.gte('id', m.lo).lte('id', m.hi)
  const { data } = await q.limit(1)
  const row = data?.[0] as { full_name?: string; headline?: string } | undefined
  return {
    title: row?.full_name ? `${row.full_name} — Shapi` : 'Shapi Profile',
    description: row?.headline || 'Verified professional profile on Shapi',
  }
}

export default async function PublicProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  // Support short 8-char IDs (from the share link) or full UUIDs
  const m = uuidMatch(id)
  let baseQuery = admin
    .from('profiles')
    .select('id, full_name, headline, location, summary, skills, work_history, whatsapp_chat, ai_tier, completion_pct, profile_live, industry, linkedin_url, github_url, website_url, portfolio_url, languages_spoken, language_proficiency, english_level, native_language, voice_samples, profile_image_url, right_to_work, work_style, verification_tier, verification_report, target_roles, target_industries')
  baseQuery = 'full' in m ? baseQuery.eq('id', m.full) : baseQuery.gte('id', m.lo).lte('id', m.hi)
  // Candidates may have type=null (signup doesn't always set it). Exclude only
  // company accounts; show candidate + untyped profiles.
  const { data: rows } = await baseQuery.or('type.eq.candidate,type.is.null').limit(1)
  const c = rows?.[0]

  if (!c) notFound()

  // Fetch completed references (public data only — no responses, no names of nominees)
  const { data: refRows } = await admin
    .from('candidate_references')
    .select('ref_type, extracted_skills, job_slot')
    .eq('candidate_id', c.id)
    .eq('status', 'completed')

  const completedRefs = refRows || []
  const refCount = completedRefs.length

  // Courses (verified learning) for the company-facing profile — completed AND in-progress,
  // so clients see everything the candidate has done plus what they're actively working on.
  const { data: courseRows } = await admin
    .from('candidate_courses')
    .select('course_name, platform, verification_status, credential_url, sponsored_by, status')
    .eq('candidate_id', c.id)
    .in('status', ['completed', 'in_progress'])
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
    <div className="min-h-screen bg-[#0E0E13]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.15), rgba(240,140,174,0.15)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-4 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between max-w-4xl mx-auto">
        <a href="https://shapi.io" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</a>
        <span className="text-[#7E7E8E] text-xs">Independently verified profile</span>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">

        {/* Header */}
        <div className="gradient-border-card rounded-3xl p-8 mb-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-4">
              {c.profile_image_url && (
                <img src={c.profile_image_url as string} alt={(c.full_name as string) || 'Profile'}
                  className="w-16 h-16 rounded-full object-cover flex-shrink-0" style={{ border: '2px solid rgba(106,168,245,0.3)' }} />
              )}
              <div>
                <h1 className="text-3xl font-black text-[#F4F4F7] mb-1">{c.full_name || '—'}</h1>
                <p className="text-[#C7C7D1] text-lg">{c.headline || '—'}</p>
                {c.location && <p className="text-[#A6A6B4] text-sm mt-1">📍 {c.location}</p>}
                {(() => {
                  const rtw = Array.isArray(c.right_to_work) ? c.right_to_work as Array<{ region?: string; basis?: string; verified?: boolean }> : []
                  if (rtw.length === 0) return null
                  const basisLabel: Record<string, string> = { citizen: 'Citizen', permanent_resident: 'PR', work_visa: 'Work Visa', eu_citizen: 'EU/EEA', need_sponsorship: 'Needs sponsorship' }
                  return (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[#8A8A99] text-[10px] font-bold uppercase tracking-wider self-center">Right to work:</span>
                      {rtw.filter(r => r.region).map((r, i) => (
                        <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: '#C7C7D1' }}>
                          {r.verified ? '✓' : '○'} {r.region}{r.basis ? ` · ${basisLabel[r.basis] || r.basis}` : ''}
                        </span>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
            {c.profile_live && (
              <span className="flex-shrink-0 bg-[#6AA8F5]/15 text-[#6AA8F5] text-xs font-bold px-3 py-1.5 rounded-full">
                ✓ Verified
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {c.ai_tier && (
              <span className="bg-[#F08CAE]/15 text-[#F08CAE] text-xs font-bold px-3 py-1.5 rounded-full">
                {aiTierLabel[c.ai_tier] || c.ai_tier}
              </span>
            )}
            {c.industry && (
              <span className="bg-[#6AA8F5]/10 text-[#6AA8F5] text-xs font-bold px-3 py-1.5 rounded-full capitalize">
                {c.industry}
              </span>
            )}
          </div>

          {c.summary && <p className="text-[#C7C7D1] text-sm leading-relaxed">{c.summary}</p>}

          {/* Looking for — target roles + industries */}
          {(() => {
            const tRoles = Array.isArray(c.target_roles) ? c.target_roles as string[] : []
            const tInds = Array.isArray(c.target_industries) ? c.target_industries as string[] : []
            if (tRoles.length === 0 && tInds.length === 0) return null
            const indLabel: Record<string, string> = { finance: 'Finance', tech: 'Tech', creative: 'Media & Creative', healthcare: 'Healthcare', legal: 'Legal', marketing: 'Marketing', operations: 'Operations', hospitality: 'Hospitality', education: 'Education', sales: 'Sales' }
            return (
              <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(106,168,245,0.06)', border: '1px solid rgba(106,168,245,0.18)' }}>
                <p className="text-[#6AA8F5] text-[11px] font-bold uppercase tracking-wider mb-2">Looking for</p>
                <div className="flex flex-wrap gap-1.5">
                  {tRoles.map((r, i) => (
                    <span key={`r${i}`} className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(106,168,245,0.12)', color: '#6AA8F5' }}>{r}</span>
                  ))}
                  {tInds.map((ind, i) => (
                    <span key={`i${i}`} className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(240,140,174,0.12)', color: '#F08CAE' }}>{indLabel[ind] || ind}</span>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Profile links */}
          {(c.linkedin_url || c.github_url || c.website_url || c.portfolio_url) && (
            <div className="flex flex-wrap gap-2 mt-5">
              {c.linkedin_url && (
                <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: 'rgba(0,119,181,0.12)', color: '#6AA8F5', border: '1px solid rgba(0,119,181,0.25)' }}>
                  <span className="font-black">in</span> LinkedIn
                </a>
              )}
              {c.github_url && (
                <a href={c.github_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#C7C7D1', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {'</>'} GitHub
                </a>
              )}
              {c.website_url && (
                <a href={c.website_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: 'rgba(106,168,245,0.08)', color: '#6AA8F5', border: '1px solid rgba(106,168,245,0.2)' }}>
                  🌐 Website
                </a>
              )}
              {c.portfolio_url && (
                <a href={c.portfolio_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: 'rgba(240,140,174,0.1)', color: '#F08CAE', border: '1px solid rgba(240,140,174,0.2)' }}>
                  🗂 Portfolio
                </a>
              )}
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.08)]">
            <p className="text-[#7E7E8E] text-xs">
              Want to hire {c.full_name?.split(' ')[0] || 'this candidate'}?{' '}
              <a href="https://shapi.io" className="text-[#6AA8F5] hover:underline">Create a company account →</a>
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
                  background: 'linear-gradient(#16161F,#16161F) padding-box, linear-gradient(135deg,rgba(106,168,245,0.4),rgba(106,168,245,0.3)) border-box',
                  border: '1px solid transparent',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)',
                }}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="w-1.5 h-6 rounded-full" style={{ background: '#6AA8F5' }} />
                    <h2 className="text-[#F4F4F7] font-black text-xl tracking-tight">AI Cross-Check</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(106,168,245,0.15)', color: '#6AA8F5' }}>✓ verified across references</span>
                  </div>
                  <p className="text-[#A6A6B4] text-xs mb-4 ml-4">Independent claims compared across every reference — conflicts flagged, not hidden.</p>
                  {report.summary_en && <p className="text-[#C7C7D1] text-sm leading-relaxed mb-4 ml-4">{report.summary_en}</p>}
                  <div className="grid sm:grid-cols-2 gap-4 ml-4">
                    {(report.claims_verified?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[#6AA8F5] text-[11px] font-bold uppercase tracking-wider mb-2">✓ Independently confirmed</p>
                        <ul className="space-y-1">
                          {report.claims_verified!.map((cl, i) => <li key={i} className="text-[#C7C7D1] text-xs leading-relaxed">· {cl}</li>)}
                        </ul>
                      </div>
                    )}
                    {(report.top_skills?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[#6AA8F5] text-[11px] font-bold uppercase tracking-wider mb-2">Most-cited strengths</p>
                        <div className="flex flex-wrap gap-1.5">
                          {report.top_skills!.map((s, i) => (
                            <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(106,168,245,0.1)', color: '#6AA8F5' }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {(report.conflicts?.length ?? 0) > 0 && (
                    <div className="ml-4 mt-4 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                      <p className="text-[#FBBF24] text-[11px] font-bold uppercase tracking-wider mb-2">⚠ Differing perspectives</p>
                      {report.conflicts!.map((cf, i) => (
                        <div key={i} className="mb-2">
                          <p className="text-[#C7C7D1] text-xs font-bold">{cf.topic}</p>
                          <p className="text-[#A6A6B4] text-[11px] leading-relaxed">{cf.note}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {report.tone_summary && <p className="text-[#7E7E8E] text-[11px] mt-3 ml-4 italic">Overall tone: {report.tone_summary}</p>}
                </div>
              )
            })()}

            {workHistory.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-[#F4F4F7] font-black text-xs uppercase tracking-widest mb-5 opacity-50">Experience</h2>
                <div className="space-y-5">
                  {workHistory.map((job, i) => (
                    <div key={i} className={i > 0 ? 'pt-5 border-t border-[rgba(255,255,255,0.08)]' : ''}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-[#F4F4F7] font-bold">{job.title || '—'}</p>
                          <p className="text-[#C7C7D1] text-sm">{job.company || '—'}</p>
                        </div>
                        <p className="text-[#7E7E8E] text-xs text-right flex-shrink-0">
                          {job.start}{job.end ? ` – ${job.end}` : ''}
                        </p>
                      </div>
                      {job.achievements && (
                        <p className="text-[#A6A6B4] text-sm leading-relaxed mt-2">{job.achievements}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {userAnswers.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-[#F4F4F7] font-black text-xs uppercase tracking-widest mb-1 opacity-50">In their own words</h2>
                <p className="text-[#7E7E8E] text-xs mb-5">From their Shapi conversation</p>
                <div className="space-y-3">
                  {userAnswers.map((m: {role: string; content: string}, i: number) => (
                    <div key={i} className="rounded-xl px-4 py-3 border-l-2 border-[#F08CAE]/40" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <p className="text-[#C7C7D1] text-sm leading-relaxed">&ldquo;{m.content}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {skills.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-[#F4F4F7] font-black text-xs uppercase tracking-widest mb-4 opacity-50">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {skills.map((s, i) => (
                    <span key={i} className="text-[#C7C7D1] text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages & proficiency */}
            {(languagesSpoken.length > 0 || langProficiency) && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-[#F4F4F7] font-black text-xs uppercase tracking-widest mb-4 opacity-50">Languages</h2>

                {languagesSpoken.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {languagesSpoken.map((lang, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[#C7C7D1] text-sm">{lang.language}</span>
                        <span className="text-[#7E7E8E] text-xs capitalize px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>{lang.level}</span>
                      </div>
                    ))}
                  </div>
                )}

                {langProficiency?.cefr_level && (
                  <div className="border-t border-[rgba(255,255,255,0.08)] pt-4 mt-2">
                    <p className="text-[#7E7E8E] text-xs mb-3 uppercase tracking-wider font-bold">Assessed proficiency</p>
                    <div className="flex gap-2 flex-wrap">
                      <div className="bg-[#6AA8F5]/10 border border-[#6AA8F5]/20 rounded-xl px-3 py-2 text-center flex-1 min-w-[70px]">
                        <p className="text-[#6AA8F5] text-base font-black">{langProficiency.cefr_level}</p>
                        <p className="text-[#7E7E8E] text-[10px]">CEFR</p>
                      </div>
                      {langProficiency.ielts_equivalent && (
                        <div className="bg-[#F08CAE]/10 border border-[#F08CAE]/20 rounded-xl px-3 py-2 text-center flex-1 min-w-[70px]">
                          <p className="text-[#F08CAE] text-base font-black">{langProficiency.ielts_equivalent}</p>
                          <p className="text-[#7E7E8E] text-[10px]">IELTS est.</p>
                        </div>
                      )}
                      {langProficiency.english_level && langProficiency.english_level !== 'unassessed' && (
                        <div className="bg-[#F58E9A]/10 border border-[#F58E9A]/20 rounded-xl px-3 py-2 text-center flex-1 min-w-[70px]">
                          <p className="text-[#F58E9A] text-base font-black">{langProficiency.english_level}</p>
                          <p className="text-[#7E7E8E] text-[10px]">English</p>
                        </div>
                      )}
                    </div>
                    {langProficiency.proficiency_notes && (
                      <p className="text-[#7E7E8E] text-xs mt-3 leading-relaxed">{langProficiency.proficiency_notes}</p>
                    )}
                    <p className="text-[#5C5C6A] text-[10px] mt-2">Assessed via Shapi conversation</p>
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
                    <h2 className="text-[#F4F4F7] font-black text-xs uppercase tracking-widest opacity-50">Voice Samples</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(106,168,245,0.12)', color: '#6AA8F5' }}>LIVE</span>
                  </div>
                  <p className="text-[#A6A6B4] text-xs mb-4">Hear how this candidate actually communicates — recorded via Shapi WhatsApp.</p>
                  <div className="space-y-3">
                    {entries.map(([lang, s]) => (
                      <div key={lang} className="rounded-xl p-3 border border-[rgba(255,255,255,0.08)]" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[#F4F4F7] text-sm font-bold capitalize">{s.language || lang}</span>
                          {s.duration_s && <span className="text-[#7E7E8E] text-[10px]">{s.duration_s}s</span>}
                        </div>
                        <audio controls preload="none" src={`/api/voice-sample/${c.id}/${encodeURIComponent(lang)}`} className="w-full" style={{ height: 32 }}>
                          Your browser does not support audio playback.
                        </audio>
                        {s.transcript && (
                          <p className="text-[#7E7E8E] text-[11px] mt-2 italic line-clamp-2">&ldquo;{s.transcript}&rdquo;</p>
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
                    <h2 className="text-[#F4F4F7] font-black text-xs uppercase tracking-widest opacity-50">Work Style</h2>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(240,140,174,0.15)', color: '#F08CAE' }}>◆ self-assessed</span>
                  </div>
                  <div className="space-y-3">
                    {dims.map(d => {
                      const score = ws.scores![d.key] ?? 50
                      const label = score >= 65 ? d.poleA : score <= 35 ? d.poleB : 'Balanced'
                      return (
                        <div key={d.key}>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-[#7E7E8E]">{d.poleB}</span>
                            <span className="text-[#F4F4F7] font-bold">{label}</span>
                            <span className="text-[#7E7E8E]">{d.poleA}</span>
                          </div>
                          <div className="relative h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full" style={{ left: `calc(${score}% - 6px)`, background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)' }} />
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
                <h2 className="text-[#F4F4F7] font-black text-xs uppercase tracking-widest mb-4 opacity-50">Courses & Learning</h2>
                <div className="space-y-2">
                  {completedCourses.map((cc, i) => {
                    const verified = cc.verification_status === 'verified'
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <span className="text-[#C7C7D1] text-xs">{cc.course_name}{cc.platform ? <span className="text-[#7E7E8E]"> · {cc.platform}</span> : null}</span>
                        <span className="flex items-center gap-1.5 flex-shrink-0">
                          {cc.status === 'in_progress' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(106,168,245,0.12)', color: '#6AA8F5' }}>● In progress</span>}
                          {cc.sponsored_by && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>🏢 {cc.sponsored_by}</span>}
                          {verified
                            ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(106,168,245,0.15)', color: '#6AA8F5' }}>✓ Verified</span>
                            : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: '#5C5C6A' }}>○ Self-reported</span>}
                          {cc.credential_url && <a href={cc.credential_url as string} target="_blank" rel="noopener noreferrer" className="text-[#6AA8F5] text-[10px] font-bold">cert ↗</a>}
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
                  ? 'linear-gradient(#16161F,#16161F) padding-box, linear-gradient(135deg,rgba(106,168,245,0.35),rgba(240,140,174,0.25)) border-box'
                  : 'linear-gradient(#16161F,#16161F) padding-box, linear-gradient(135deg,rgba(106,168,245,0.15),rgba(240,140,174,0.15)) border-box',
                border: '1px solid transparent',
                boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)',
              }}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-[#F4F4F7] font-black text-2xl leading-none">{refCount}</p>
                    <p className="text-[#A6A6B4] text-xs mt-0.5 font-bold uppercase tracking-wider">
                      verified reference{refCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {refCount >= 3 && (
                    <span className="flex-shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(106,168,245,0.15)', color: '#6AA8F5' }}>
                      ✓ Verified
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 mb-4">
                  {managerRefs > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#6AA8F5]/60 flex-shrink-0" />
                      <p className="text-[#A6A6B4] text-xs">{managerRefs} direct manager{managerRefs !== 1 ? 's' : ''}</p>
                    </div>
                  )}
                  {independentRefs > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#F08CAE]/60 flex-shrink-0" />
                      <p className="text-[#A6A6B4] text-xs">{independentRefs} independently nominated</p>
                    </div>
                  )}
                </div>

                {refSkills.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[#7E7E8E] text-[10px] uppercase tracking-wider font-bold mb-2">Mentioned by references</p>
                    <div className="flex flex-wrap gap-1.5">
                      {refSkills.map((s, i) => (
                        <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(106,168,245,0.1)', color: '#6AA8F5' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[#5C5C6A] text-[10px] leading-relaxed">
                  Candidate was not told who was contacted. References sourced independently via Shapi.
                </p>
              </div>
            )}

            <div className="gradient-border-card rounded-2xl p-6 text-center">
              <p className="text-[#7E7E8E] text-xs mb-3">Verified by</p>
              <a href="https://shapi.io" className="font-black text-lg tracking-tighter" style={{
                background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>shapi</a>
              <p className="text-[#7E7E8E] text-xs mt-2">shapi.io · Shape what&apos;s next</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
