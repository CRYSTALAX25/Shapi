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
    .select('id, full_name, headline, location, summary, skills, work_history, whatsapp_chat, ai_tier, completion_pct, profile_live, industry, linkedin_url, github_url, website_url, portfolio_url, languages_spoken, language_proficiency, english_level, native_language')
    .ilike('id', `${id}%`)
    .eq('type', 'candidate')
    .limit(1)
    .single()

  if (!c) notFound()

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
            <div>
              <h1 className="text-3xl font-black text-white mb-1">{c.full_name || '—'}</h1>
              <p className="text-white/60 text-lg">{c.headline || '—'}</p>
              {c.location && <p className="text-white/35 text-sm mt-1">📍 {c.location}</p>}
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
