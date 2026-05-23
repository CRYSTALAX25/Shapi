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

  const { data: refRows } = await admin
    .from('candidate_references').select('ref_type, extracted_skills').eq('candidate_id', id).eq('status', 'completed')
  const refCount = (refRows || []).length
  const refSkills = [...new Set((refRows || []).flatMap(r => Array.isArray(r.extracted_skills) ? r.extracted_skills : []))].slice(0, 10)
  const report = (c.verification_report as {
    claims_verified?: string[]; top_skills?: string[]; tone_summary?: string; summary_en?: string
    conflicts?: Array<{ topic: string; note: string }>
  } | null) || null
  const tierMeta: Record<string, { label: string; color: string }> = {
    premium: { label: 'Premium Verified', color: '#D97706' },
    strong: { label: 'Strongly Verified', color: '#059669' },
    basic: { label: 'Verified', color: '#0891B2' },
  }
  const tier = tierMeta[(c.verification_tier as string) || '']
  const se = c.salary_expectations as { currency?: string; period?: string; primary?: { min?: number; max?: number } } | null
  const salaryBand = se?.primary && (se.primary.min != null || se.primary.max != null)
    ? `${se.currency || ''} ${se.primary.min?.toLocaleString() ?? '—'}${se.primary.max != null ? `–${se.primary.max.toLocaleString()}` : '+'}/${se.period === 'year' ? 'yr' : 'mo'}`
    : null
  const targetRoles: string[] = Array.isArray(c.target_roles) ? c.target_roles : []
  const targetIndustries: string[] = Array.isArray(c.target_industries) ? c.target_industries : []

  const skills: string[] = Array.isArray(c.skills) ? c.skills : []
  const workHistory: WorkEntry[] = Array.isArray(c.work_history) ? c.work_history : []
  const chatMessages: Array<{role: string; content: string}> = Array.isArray(c.whatsapp_chat) ? c.whatsapp_chat : []
  const userAnswers = chatMessages.filter(m => m.role === 'user').slice(0, 5)

  const aiTierLabel: Record<string, string> = { user: 'AI User', integrator: 'AI Integrator', builder: 'AI Builder' }

  return (
    <div className="min-h-screen bg-[#F1F2F7]">
      <style>{`
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

      <nav className="relative z-10 px-6 py-4 border-b border-[#0E0E1A]/[0.08] flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <Link href="/company/dashboard" className="text-[#5A5A6E] text-sm hover:text-[#3F3F4E] transition-colors">
          ← All candidates
        </Link>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-20">

        {/* Header card */}
        <div className="gradient-border-card rounded-3xl p-8 mb-5">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="text-3xl font-black text-[#0E0E1A] mb-1">{c.full_name || '—'}</h1>
              <p className="text-[#3F3F4E] text-lg">{c.headline || '—'}</p>
              {c.location && <p className="text-[#5A5A6E] text-sm mt-1">📍 {c.location}</p>}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-4xl font-black" style={{
                background: 'linear-gradient(135deg, #22D3EE, #A78BFA)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>{c.completion_pct || 0}%</div>
              <div className="text-[#8A8A99] text-xs">complete</div>
              {c.profile_live && (
                <span className="inline-block mt-2 bg-[#22D3EE]/15 text-[#0891B2] text-xs font-bold px-3 py-1 rounded-full">✓ Verified</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {tier && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: `${tier.color}1f`, color: tier.color }}>✓ {tier.label}</span>
            )}
            {c.ai_tier && (
              <span className="bg-[#A78BFA]/15 text-[#7C3AED] text-xs font-bold px-3 py-1.5 rounded-full">
                {aiTierLabel[c.ai_tier] || c.ai_tier}
              </span>
            )}
            {c.industry && (
              <span className="bg-[#22D3EE]/10 text-[#0891B2] text-xs font-bold px-3 py-1.5 rounded-full capitalize">
                {c.industry}
              </span>
            )}
            {salaryBand && (
              <span className="bg-[#0E0E1A]/[0.04] text-[#0891B2] text-xs font-bold px-3 py-1.5 rounded-full">💰 {salaryBand}</span>
            )}
          </div>

          {c.summary && <p className="text-[#3F3F4E] text-sm leading-relaxed">{c.summary}</p>}

          {(targetRoles.length > 0 || targetIndustries.length > 0) && (
            <div className="mt-4">
              <p className="text-[#8A8A99] text-[11px] font-bold uppercase tracking-wider mb-1.5">Looking for</p>
              <div className="flex flex-wrap gap-1.5">
                {targetRoles.map((r, i) => <span key={`r${i}`} className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(6,182,212,0.10)', color: '#0891B2' }}>{r}</span>)}
                {targetIndustries.map((ind, i) => <span key={`i${i}`} className="text-[11px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(124,58,237,0.10)', color: '#7C3AED' }}>{ind}</span>)}
              </div>
            </div>
          )}

          {/* Contact */}
          {c.whatsapp_number && (
            <div className="mt-5 pt-5 border-t border-[#0E0E1A]/[0.08] flex items-center gap-4">
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

            {/* AI cross-check — the verification moat */}
            {report && (report.summary_en || (report.claims_verified?.length ?? 0) > 0) && (
              <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid transparent', backgroundImage: 'linear-gradient(#fff,#fff), linear-gradient(135deg,rgba(52,211,153,0.4),rgba(34,211,238,0.3))', backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box', boxShadow: '0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05)' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#34D399,#22D3EE)' }} />
                  <h2 className="text-[#0E0E1A] font-black text-lg tracking-tight">AI Cross-Check</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#059669' }}>✓ across {refCount} reference{refCount !== 1 ? 's' : ''}</span>
                </div>
                {report.summary_en && <p className="text-[#3F3F4E] text-sm leading-relaxed mb-3 ml-4">{report.summary_en}</p>}
                {(report.claims_verified?.length ?? 0) > 0 && (
                  <div className="ml-4 mb-3">
                    <p className="text-[#059669] text-[11px] font-bold uppercase tracking-wider mb-1.5">✓ Independently confirmed</p>
                    <ul className="space-y-1">{report.claims_verified!.slice(0, 5).map((cl, i) => <li key={i} className="text-[#3F3F4E] text-xs leading-relaxed">· {cl}</li>)}</ul>
                  </div>
                )}
                {(report.conflicts?.length ?? 0) > 0 && (
                  <div className="ml-4 pt-2 border-t border-[#0E0E1A]/[0.06]">
                    <p className="text-[#B45309] text-[11px] font-bold uppercase tracking-wider mb-1">⚠ Differing perspectives</p>
                    {report.conflicts!.map((cf, i) => <p key={i} className="text-[#5A5A6E] text-xs">{cf.topic}: {cf.note}</p>)}
                  </div>
                )}
                {report.tone_summary && <p className="text-[#8A8A99] text-[11px] mt-2 ml-4 italic">Tone: {report.tone_summary}</p>}
              </div>
            )}

            {workHistory.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-[#0E0E1A] font-black text-xs uppercase tracking-widest mb-5 opacity-50">Experience</h2>
                <div className="space-y-6">
                  {workHistory.map((job, i) => (
                    <div key={i} className={i > 0 ? 'pt-5 border-t border-[#0E0E1A]/[0.08]' : ''}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-[#0E0E1A] font-bold">{job.title || '—'}</p>
                          <p className="text-[#3F3F4E] text-sm">{job.company || '—'}</p>
                        </div>
                        <p className="text-[#8A8A99] text-xs text-right flex-shrink-0">
                          {job.start}{job.end ? ` – ${job.end}` : ' – Present'}
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

            {userAnswers.length > 0 && (
              <div className="gradient-border-card rounded-2xl p-6">
                <h2 className="text-[#0E0E1A] font-black text-xs uppercase tracking-widest mb-1 opacity-50">In their own words</h2>
                <p className="text-[#8A8A99] text-xs mb-5">From their Shapi conversation</p>
                <div className="space-y-3">
                  {userAnswers.map((m, i) => (
                    <div key={i} className="bg-[#0E0E1A]/[0.04] rounded-xl px-4 py-3 border-l-2 border-[#A78BFA]/40">
                      <p className="text-[#3F3F4E] text-sm leading-relaxed">&ldquo;{m.content}&rdquo;</p>
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
                <h2 className="text-[#0E0E1A] font-black text-xs uppercase tracking-widest mb-4 opacity-50">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {skills.map((s, i) => (
                    <span key={i} className="bg-[#0E0E1A]/[0.04] text-[#3F3F4E] text-xs px-3 py-1.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="gradient-border-card rounded-2xl p-6">
              <h2 className="text-[#0E0E1A] font-black text-xs uppercase tracking-widest mb-4 opacity-50">Verification</h2>
              <div className="space-y-3">
                {[
                  { label: 'CV parsed', done: c.cv_parsed },
                  { label: 'WhatsApp interview', done: chatMessages.length > 4 },
                  { label: `${refCount} reference${refCount !== 1 ? 's' : ''} checked`, done: refCount > 0 },
                  { label: 'Profile live', done: c.profile_live },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-[#22D3EE]/20' : 'bg-[#0E0E1A]/[0.04]'}`}>
                      {item.done
                        ? <svg className="w-3 h-3 text-[#0891B2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        : <div className="w-1.5 h-1.5 rounded-full bg-[#B0B0BC]" />}
                    </div>
                    <span className={`text-sm ${item.done ? 'text-[#3F3F4E]' : 'text-[#8A8A99]'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="gradient-border-card rounded-2xl p-6">
              <h2 className="text-[#0E0E1A] font-black text-xs uppercase tracking-widest mb-3 opacity-50">Share profile</h2>
              <code className="text-[#0891B2] text-xs bg-[#0E0E1A]/[0.04] px-3 py-2 rounded-lg block break-all">
                shapi.io/p/{c.id.slice(0, 8)}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
