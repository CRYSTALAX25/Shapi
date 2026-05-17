import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type WorkEntry = { title?: string; company?: string; start?: string; end?: string; achievements?: string }

export default async function CandidateProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify viewer is a paid company
  const { data: company } = await supabase
    .from('profiles')
    .select('type, paid, subscription_status')
    .eq('id', user.id)
    .single()

  if (!company || company.type !== 'company') redirect('/dashboard')
  if (!company.paid || company.subscription_status !== 'active') redirect('/company/pricing')

  // Fetch candidate via admin (bypasses RLS)
  const admin = createAdminClient()
  const { data: c } = await admin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('type', 'candidate')
    .single()

  if (!c) redirect('/company/dashboard')

  const skills: string[] = Array.isArray(c.skills) ? c.skills : []
  const workHistory: WorkEntry[] = Array.isArray(c.work_history) ? c.work_history : []
  const chatMessages: Array<{role: string; content: string}> = Array.isArray(c.whatsapp_chat) ? c.whatsapp_chat : []
  const userAnswers = chatMessages.filter(m => m.role === 'user').slice(0, 5)

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

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.06] flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <Link href="/company/dashboard" className="text-white/40 text-sm hover:text-white/70 transition-colors">
          ← All candidates
        </Link>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-20">

        {/* Header card */}
        <div className="gradient-border-card rounded-3xl p-8 mb-5">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="text-3xl font-black text-white mb-1">{c.full_name || '—'}</h1>
              <p className="text-white/60 text-lg">{c.headline || '—'}</p>
              {c.location && <p className="text-white/35 text-sm mt-1">📍 {c.location}</p>}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-4xl font-black" style={{
                background: 'linear-gradient(135deg, #22D3EE, #A78BFA)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>{c.completion_pct || 0}%</div>
              <div className="text-white/30 text-xs">complete</div>
              {c.profile_live && (
                <span className="inline-block mt-2 bg-[#22D3EE]/15 text-[#22D3EE] text-xs font-bold px-3 py-1 rounded-full">✓ Verified</span>
              )}
            </div>
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

          {/* Contact */}
          {c.whatsapp_number && (
            <div className="mt-5 pt-5 border-t border-white/[0.06] flex items-center gap-4">
              <a href={`https://wa.me/${c.whatsapp_number.replace('+', '')}`} target="_blank"
                className="bg-[#25D366] text-white text-xs font-black px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity">
                WhatsApp {c.whatsapp_number} →
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Left — work + chat */}
          <div className="md:col-span-2 space-y-5">

            {workHistory.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-white font-black text-xs uppercase tracking-widest mb-5 opacity-50">Experience</h2>
                <div className="space-y-6">
                  {workHistory.map((job, i) => (
                    <div key={i} className={i > 0 ? 'pt-5 border-t border-white/[0.06]' : ''}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-white font-bold">{job.title || '—'}</p>
                          <p className="text-white/50 text-sm">{job.company || '—'}</p>
                        </div>
                        <p className="text-white/30 text-xs text-right flex-shrink-0">
                          {job.start}{job.end ? ` – ${job.end}` : ' – Present'}
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
                  {userAnswers.map((m, i) => (
                    <div key={i} className="bg-white/[0.03] rounded-xl px-4 py-3 border-l-2 border-[#A78BFA]/40">
                      <p className="text-white/65 text-sm leading-relaxed">&ldquo;{m.content}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — skills + verification */}
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

            <div className="gradient-border-card rounded-2xl p-6">
              <h2 className="text-white font-black text-xs uppercase tracking-widest mb-4 opacity-50">Verification</h2>
              <div className="space-y-3">
                {[
                  { label: 'CV parsed', done: c.cv_parsed },
                  { label: 'WhatsApp interview', done: chatMessages.length > 4 },
                  { label: 'Reference checked', done: false },
                  { label: 'Profile live', done: c.profile_live },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-[#22D3EE]/20' : 'bg-white/[0.05]'}`}>
                      {item.done
                        ? <svg className="w-3 h-3 text-[#22D3EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        : <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                    </div>
                    <span className={`text-sm ${item.done ? 'text-white/70' : 'text-white/30'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="gradient-border-card rounded-2xl p-6">
              <h2 className="text-white font-black text-xs uppercase tracking-widest mb-3 opacity-50">Share profile</h2>
              <code className="text-[#22D3EE] text-xs bg-white/[0.05] px-3 py-2 rounded-lg block break-all">
                shapi.io/p/{c.id.slice(0, 8)}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
