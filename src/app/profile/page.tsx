import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'
import SkillRadar, { SkillSummary } from '@/components/SkillRadar'
import ContinuousLearning from '@/components/ContinuousLearning'
import ProfileTabs from './ProfileTabs'
import { computeJobCompletionScore } from '@/lib/references'
import { hasCVAccess, hasProAccess } from '@/lib/subscriptions'

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
    .select('full_name, headline, location, summary, skills, work_history, whatsapp_chat, ai_tier, profile_live, cv_parsed, cv_kit_purchased, cv_tier, subscription_product, whatsapp_number, completion_pct, type, verification_tier, verification_report, skill_quadrant, continuous_learning, career_recommendations, ai_resilience_score, languages_spoken, language_proficiency, english_level, native_language, voice_samples, profile_image_url, right_to_work, work_style, linkedin_url, github_url, website_url, portfolio_url, job_search_status, salary_expectations, open_to_engagement, target_roles, target_industries')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')
  if (profile.type === 'company') redirect('/company/dashboard')

  const { count: evidenceCount } = await supabase
    .from('evidence')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  const hasEvidence = (evidenceCount ?? 0) > 0

  const skills: string[] = Array.isArray(profile.skills) ? profile.skills : []
  const workHistory: WorkEntry[] = Array.isArray(profile.work_history) ? profile.work_history : []
  const isLive = profile.profile_live
  const cvKitPurchased = !!profile.cv_kit_purchased
  // CV access: one-time Kit, legacy one-time Pro, or any Pro/Concierge subscriber.
  const hasCvAccess = cvKitPurchased || hasCVAccess(profile)
  // Pro features (verification chain, Pro CV, deep-dive): legacy one-time Pro
  // OR any active Pro/Concierge subscription.
  const isProTier = hasProAccess(profile)

  const refScore = await computeJobCompletionScore(user.id)
  let completion = 0
  if (profile.cv_parsed) completion += 25
  if (profile.whatsapp_number) completion += 25
  if (cvKitPurchased) completion += 25
  completion += refScore.bonusPct

  const aiTierLabel: Record<string, string> = { user: 'AI User', integrator: 'AI Integrator', builder: 'AI Builder' }

  const tier = (profile.verification_tier as string) || 'unverified'
  const tierMeta: Record<string, { label: string; color: string; bg: string; emoji: string; description: string }> = {
    basic: { label: 'Basic Verified', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.10)', emoji: '🔵', description: '1 of 2 reference chains complete' },
    strong: { label: 'Strongly Verified', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.10)', emoji: '🟢', description: 'Both reference chains + peer reference complete' },
    premium: { label: 'Premium Verified', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.10)', emoji: '🟡', description: 'Strong + AI cross-check passed with no conflicts' },
  }
  const tm = tierMeta[tier]

  // ─── Identity panel (pinned, always in sight) ───
  const identityPanel = (
    <aside className="lg:sticky lg:top-6 space-y-4 self-start">
      <div className="gradient-border-card rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          {profile.profile_image_url ? (
            <img src={profile.profile_image_url as string} alt={(profile.full_name as string) || 'Profile'}
              className="w-16 h-16 rounded-full object-cover flex-shrink-0" style={{ border: '2px solid rgba(56, 189, 248, 0.3)' }} />
          ) : (
            <div className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center text-2xl font-black text-[#060609]" style={{ background: 'linear-gradient(135deg,#38BDF8, #34D399)' }}>
              {((profile.full_name as string) || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-black leading-tight" style={{ color: '#38BDF8' }}>{profile.full_name || 'Your Name'}</h1>
            <p className="text-[#A6A6B4] text-sm">{profile.headline || 'Professional'}</p>
          </div>
        </div>

        {profile.location && <p className="text-[#7E7E8E] text-sm mb-3">📍 {profile.location}</p>}

        {/* Completion + live */}
        <div className="flex items-center gap-3 mb-3">
          <div className="text-3xl font-black" style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{completion}%</div>
          <div className="flex-1">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="h-full rounded-full" style={{ width: `${completion}%`, background: 'linear-gradient(90deg, #38BDF8, #34D399)' }} />
            </div>
            <p className="text-[#7E7E8E] text-[10px] mt-1">profile strength</p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {isLive && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8]">✓ Live</span>}
          {tm && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: tm.bg, color: tm.color }}>{tm.emoji} {tm.label}</span>}
          {((profile.ai_resilience_score as number | null) ?? 0) >= 7 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8]">🛡️ AI-Proof Asset</span>}
          {profile.ai_tier && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] capitalize">{aiTierLabel[profile.ai_tier as string] || profile.ai_tier}</span>}
        </div>

        {/* Right to work */}
        {(() => {
          const rtw = Array.isArray(profile.right_to_work) ? profile.right_to_work as Array<{ region?: string; basis?: string; verified?: boolean }> : []
          if (rtw.filter(r => r.region).length === 0) return null
          const basisLabel: Record<string, string> = { citizen: 'Citizen', permanent_resident: 'PR', work_visa: 'Work Visa', eu_citizen: 'EU/EEA', need_sponsorship: 'Needs sponsorship' }
          return (
            <div className="mb-4">
              <p className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider mb-1.5">Right to work</p>
              <div className="flex flex-wrap gap-1.5">
                {rtw.filter(r => r.region).map((r, i) => (
                  <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: '#C7C7D1' }}>
                    {r.verified ? '✓' : '○'} {r.region}{r.basis ? ` · ${basisLabel[r.basis] || r.basis}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Actions — Pro/Kit see only the Kit; others get a universal download */}
        <div className="space-y-2">
          {hasCvAccess ? (
            <a href="/cv-ready" className="block text-center bg-gradient-to-r from-[#38BDF8] to-[#38BDF8] text-[#060609] text-xs font-black py-2.5 rounded-xl hover:opacity-90 transition-opacity">Open CV Kit →</a>
          ) : (
            <a href="/profile/print" target="_blank" className="block text-center bg-gradient-to-r from-[#38BDF8] to-[#38BDF8] text-[#060609] text-xs font-black py-2.5 rounded-xl hover:opacity-90 transition-opacity">Download CV ↓</a>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Link href="/profile/edit" className="text-center text-[#A6A6B4] text-xs font-bold py-2 rounded-xl border border-white/[0.08] hover:border-white/20 transition-colors">Edit</Link>
            <a href={`/p/${user.id.slice(0, 8)}`} target="_blank" rel="noopener noreferrer" className="text-center text-[#38BDF8] text-xs font-bold py-2 rounded-xl border border-[#38BDF8]/30 hover:border-[#38BDF8]/60 transition-colors">View public</a>
          </div>
        </div>
      </div>

      {/* Status nudge */}
      <div className="gradient-border-card rounded-2xl px-4 py-3 flex items-center gap-3">
        <ShapiCharacter mood={isLive ? 'happy' : 'thinking'} size={40} className="flex-shrink-0" />
        <p className="text-[#A6A6B4] text-xs leading-relaxed">
          {isLive ? <>Your profile is <span className="text-[#38BDF8] font-semibold">live</span> — companies can find you. 🎉</> : <>Being <span className="text-[#F4F4F7] font-semibold">verified</span> — live once references are confirmed.</>}
        </p>
      </div>
    </aside>
  )

  // ─── OVERVIEW ───
  const overviewPanel = (
    <>
      {/* Availability & salary */}
      {(() => {
        const status = (profile.job_search_status as string) || null
        const se = profile.salary_expectations as {
          currency?: string; period?: string; includes_allowances?: boolean; flexible?: boolean
          primary?: { track?: string; min?: number; max?: number } | null
          pivots?: Array<{ track?: string; min?: number; max?: number; note?: string }>
        } | null
        const statusMeta: Record<string, { label: string; color: string }> = {
          actively_looking: { label: 'Actively looking', color: '#38BDF8' },
          open: { label: 'Open to offers', color: '#38BDF8' },
          not_looking: { label: 'Not looking', color: '#7E7E8E' },
        }
        const sm = status ? statusMeta[status] : null
        const openTo = Array.isArray(profile.open_to_engagement) ? profile.open_to_engagement as string[] : []
        const engLabel: Record<string, string> = { permanent: 'Permanent', contract: 'Contract', temp: 'Temp / Shift' }
        const targetRoles = Array.isArray(profile.target_roles) ? profile.target_roles as string[] : []
        const targetIndustries = Array.isArray(profile.target_industries) ? profile.target_industries as string[] : []
        const indLabel: Record<string, string> = { finance: 'Finance', tech: 'Tech', creative: 'Media & Creative', healthcare: 'Healthcare', legal: 'Legal', marketing: 'Marketing', operations: 'Operations', hospitality: 'Hospitality', education: 'Education', sales: 'Sales' }
        const cur = se?.currency || ''
        const per = se?.period === 'year' ? '/yr' : '/mo'
        const band = (b?: { min?: number; max?: number } | null) =>
          b && (b.min != null || b.max != null) ? `${cur} ${b.min != null ? b.min.toLocaleString() : '—'}${b.max != null ? `–${b.max.toLocaleString()}` : '+'}${per}` : null
        const primaryBand = band(se?.primary)
        const pivots = (se?.pivots || []).filter(p => p.track || p.min != null || p.max != null)
        if (!sm && !primaryBand && pivots.length === 0 && openTo.length === 0 && targetRoles.length === 0 && targetIndustries.length === 0) {
          return (
            <div className="gradient-border-card rounded-2xl p-5 flex items-center justify-between gap-4">
              <p className="text-[#A6A6B4] text-sm">Set your availability and salary expectations so we can match you.</p>
              <Link href="/profile/edit" className="text-[#38BDF8] text-sm font-bold whitespace-nowrap">Add →</Link>
            </div>
          )
        }
        return (
          <div className="gradient-border-card rounded-2xl p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#38BDF8, #34D399)' }} />
              <h2 className="text-[#F4F4F7] font-black text-xl tracking-tight">Availability &amp; salary</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)', color: '#7E7E8E' }}>🔒 private</span>
            </div>
            <div className="ml-4 space-y-4">
              {sm && <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: sm.color }} /><span className="text-sm font-bold" style={{ color: sm.color }}>{sm.label}</span></div>}
              {openTo.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap"><span className="text-[#7E7E8E] text-[11px] font-bold uppercase tracking-wider">Open to:</span>{openTo.map((e, i) => <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8' }}>{engLabel[e] || e}</span>)}</div>
              )}
              {(targetRoles.length > 0 || targetIndustries.length > 0) && (
                <div>
                  <p className="text-[#7E7E8E] text-[11px] font-bold uppercase tracking-wider mb-1.5">Looking for</p>
                  <div className="flex flex-wrap gap-1.5">
                    {targetRoles.map((r, i) => <span key={`r${i}`} className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(56, 189, 248, 0.10)', color: '#38BDF8' }}>{r}</span>)}
                    {targetIndustries.map((ind, i) => <span key={`i${i}`} className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(56, 189, 248, 0.10)', color: '#38BDF8' }}>{indLabel[ind] || ind}</span>)}
                  </div>
                </div>
              )}
              {primaryBand && (
                <div>
                  <p className="text-[#7E7E8E] text-[11px] font-bold uppercase tracking-wider mb-1">Primary{se?.primary?.track ? ` · ${se.primary.track}` : ''}</p>
                  <p className="text-[#F4F4F7] text-lg font-black">{primaryBand}{se?.flexible && <span className="text-[#7E7E8E] text-xs font-medium ml-2">negotiable</span>}{se?.includes_allowances && <span className="text-[#7E7E8E] text-xs font-medium ml-2">incl. allowances</span>}</p>
                </div>
              )}
              {pivots.length > 0 && (
                <div>
                  <p className="text-[#7E7E8E] text-[11px] font-bold uppercase tracking-wider mb-2">Open to pivot tracks</p>
                  <div className="space-y-1.5">{pivots.map((p, i) => <div key={i} className="flex items-baseline gap-2 flex-wrap"><span className="text-[#C7C7D1] text-sm font-bold">{p.track || 'Track'}</span><span className="text-[#38BDF8] text-sm font-bold">{band(p) || '—'}</span>{p.note && <span className="text-[#7E7E8E] text-xs">· {p.note}</span>}</div>)}</div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Summary */}
      {profile.summary && (
        <div className="gradient-border-card rounded-2xl p-6">
          <h2 className="text-[#F4F4F7] font-black text-sm uppercase tracking-widest mb-3 opacity-50">About</h2>
          <p className="text-[#C7C7D1] text-sm leading-relaxed">{profile.summary}</p>
        </div>
      )}

      {/* Skill fingerprint — compact snapshot (full version lives in Tests) */}
      {profile.skill_quadrant && (
        <div className="gradient-border-card rounded-2xl p-6">
          <div className="flex items-center justify-between gap-2.5 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#38BDF8, #34D399)' }} />
              <h2 className="text-[#F4F4F7] font-black text-xl tracking-tight">Skill Fingerprint</h2>
            </div>
          </div>
          <SkillSummary data={profile.skill_quadrant as { hands: number; heart: number; head: number; spark: number; reasoning?: string }} />
        </div>
      )}
    </>
  )

  // ─── VERIFICATION ───
  const verificationPanel = (
    <>
      {tm && (
        <div className="gradient-border-card rounded-2xl px-5 py-4 flex items-center gap-4" style={{ background: tm.bg, border: `1px solid ${tm.color}33` }}>
          <span className="text-3xl flex-shrink-0">{tm.emoji}</span>
          <div><p className="font-bold text-sm" style={{ color: tm.color }}>{tm.label}</p><p className="text-[#A6A6B4] text-xs mt-0.5">{tm.description}</p></div>
        </div>
      )}

      {/* AI cross-check */}
      {(() => {
        const report = profile.verification_report as {
          claims_verified?: string[]; claims_unverified?: string[]
          conflicts?: Array<{ topic: string; perspectives: string[]; note: string }>
          top_skills?: string[]; tone_summary?: string; summary_en?: string
        } | null
        if (!report || (!report.summary_en && !(report.claims_verified?.length))) return null
        return (
          <div className="gradient-border-card rounded-2xl p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#38BDF8, #38BDF8)' }} />
              <h2 className="text-[#F4F4F7] font-black text-xl tracking-tight">AI Cross-Check</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' }}>◆ across all references</span>
            </div>
            {report.summary_en && <p className="text-[#C7C7D1] text-sm leading-relaxed mb-4">{report.summary_en}</p>}
            <div className="grid sm:grid-cols-2 gap-3">
              {(report.claims_verified?.length ?? 0) > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)' }}>
                  <p className="text-[#38BDF8] text-[11px] font-bold uppercase tracking-wider mb-2.5">✓ Independently confirmed</p>
                  <ul className="space-y-2">
                    {report.claims_verified!.map((c, i) => (
                      <li key={i} className="flex gap-2 text-[#C7C7D1] text-xs leading-relaxed">
                        <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#38BDF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(report.top_skills?.length ?? 0) > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.22)' }}>
                  <p className="text-[#38BDF8] text-[11px] font-bold uppercase tracking-wider mb-2.5">Most-cited strengths</p>
                  <div className="flex flex-wrap gap-1.5">{report.top_skills!.map((s, i) => <span key={i} className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(56, 189, 248, 0.14)', color: '#38BDF8' }}>{s}</span>)}</div>
                </div>
              )}
            </div>
            {(report.conflicts?.length ?? 0) > 0 && (
              <div className="mt-3 rounded-xl p-4" style={{ background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.18)' }}>
                <p className="text-[#38BDF8] text-[11px] font-bold uppercase tracking-wider mb-2.5">⚖ Differing perspectives <span className="text-[#7E7E8E] normal-case font-medium">— flagged, not hidden</span></p>
                <div className="space-y-2.5">
                  {report.conflicts!.map((c, i) => (
                    <div key={i} className="flex gap-2.5">
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: '#38BDF8' }} />
                      <div><p className="text-[#C7C7D1] text-xs font-bold">{c.topic}</p><p className="text-[#A6A6B4] text-[11px] leading-relaxed">{c.note}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {report.tone_summary && <p className="text-[#7E7E8E] text-[11px] mt-3 italic">Overall tone: {report.tone_summary}</p>}
          </div>
        )
      })()}

      {/* Verification checklist */}
      <div className="gradient-border-card rounded-2xl p-6">
        <h2 className="text-[#F4F4F7] font-black text-sm uppercase tracking-widest mb-4 opacity-50">Verification</h2>
        <div className="space-y-3">
          {[
            { label: 'CV parsed', done: profile.cv_parsed },
            { label: 'WhatsApp interview', done: Array.isArray(profile.whatsapp_chat) && (profile.whatsapp_chat as unknown[]).length > 2 },
            { label: 'References checked', done: refScore.jobsComplete >= 1 },
            { label: 'Profile live', done: isLive },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-[#38BDF8]/20' : 'bg-white/[0.05]'}`}>
                {item.done ? <svg className="w-3 h-3 text-[#38BDF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : <div className="w-1.5 h-1.5 rounded-full bg-white/[0.05]" />}
              </div>
              <span className={`text-sm ${item.done ? 'text-[#C7C7D1]' : 'text-[#7E7E8E]'}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* References + evidence CTAs */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/profile/references" className="block gradient-border-card rounded-2xl p-5 hover:bg-white/[0.05] transition-colors">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-[#F4F4F7] font-bold text-sm">References</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' }}>{refScore.jobsComplete} of 2 jobs</span>
          </div>
          <p className="text-[#7E7E8E] text-xs leading-relaxed">{refScore.jobsComplete === 2 ? 'Both jobs fully verified — profile live ✓' : refScore.jobsComplete === 1 ? 'One more job to verify (85% → 100%).' : 'Add your 2 latest managers — we contact them, they nominate a colleague + stakeholder.'}</p>
          <p className="text-[#38BDF8] text-xs font-semibold mt-3">{refScore.jobsComplete === 2 ? 'View references →' : 'Add references →'}</p>
        </Link>
        <Link href="/evidence" className="block gradient-border-card rounded-2xl p-5 hover:bg-white/[0.05] transition-colors">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-[#F4F4F7] font-bold text-sm">Work evidence</p>
            {hasEvidence ? <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full flex-shrink-0">{evidenceCount} file{evidenceCount !== 1 ? 's' : ''} ✓</span> : <span className="text-[10px] font-bold bg-[#38BDF8]/12 text-[#38BDF8] px-2 py-0.5 rounded-full flex-shrink-0">Optional</span>}
          </div>
          <p className="text-[#7E7E8E] text-xs">{hasEvidence ? 'Photos and docs uploaded — strengthens your profile.' : 'Photos, docs, references that prove your track record'}</p>
          <p className="text-[#38BDF8] text-xs font-semibold mt-3">{hasEvidence ? 'Add more →' : 'Upload evidence →'}</p>
        </Link>
      </div>

      {/* Voice samples */}
      {(() => {
        const samples = (profile.voice_samples as Record<string, { transcript?: string; duration_s?: number; language: string }> | null) || {}
        const entries = Object.entries(samples)
        if (entries.length === 0) return null
        return (
          <div className="gradient-border-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-[#F4F4F7] font-black text-sm uppercase tracking-widest opacity-50">Voice Samples</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8' }}>NEW</span>
            </div>
            <div className="space-y-3">
              {entries.map(([lang, s]) => (
                <div key={lang} className="bg-white/[0.05] rounded-xl p-3 border border-white/[0.08]">
                  <div className="flex items-center justify-between mb-2"><span className="text-[#F4F4F7] text-sm font-bold capitalize">{s.language || lang}</span>{s.duration_s && <span className="text-[#7E7E8E] text-[10px]">{s.duration_s}s</span>}</div>
                  <audio controls preload="none" src={`/api/voice-sample/${user.id}/${encodeURIComponent(lang)}`} className="w-full" style={{ height: 32 }}>Your browser does not support audio playback.</audio>
                  {s.transcript && <p className="text-[#A6A6B4] text-[11px] mt-2 italic line-clamp-2">&ldquo;{s.transcript}&rdquo;</p>}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Languages */}
      {(() => {
        const langs = Array.isArray(profile.languages_spoken) ? (profile.languages_spoken as Array<{ language?: string; level?: string }>) : []
        const proficiency = profile.language_proficiency as { conversation_language?: string; cefr_level?: string; ielts_equivalent?: string; english_level?: string; proficiency_notes?: string } | null
        if (langs.length === 0 && !proficiency) return null
        const cefrInfo: Record<string, string> = { A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate', B2: 'Upper-intermediate (fluent professional)', C1: 'Advanced', C2: 'Mastery / near-native' }
        return (
          <div className="gradient-border-card rounded-2xl p-6">
            <h2 className="text-[#F4F4F7] font-black text-sm uppercase tracking-widest mb-4 opacity-50">Languages</h2>
            {langs.length > 0 && <div className="space-y-2 mb-4">{langs.map((l, i) => <div key={i} className="flex items-center justify-between gap-2"><span className="text-[#F4F4F7] text-sm">{l.language}</span><span className="text-[#7E7E8E] text-xs">{l.level}</span></div>)}</div>}
            {proficiency && (proficiency.cefr_level || proficiency.english_level || proficiency.ielts_equivalent) && (
              <div className="pt-3 border-t border-white/[0.08]">
                <p className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider mb-2">Verified via WhatsApp</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {proficiency.cefr_level && <span title={`CEFR ${proficiency.cefr_level} — ${cefrInfo[proficiency.cefr_level] || ''}`} className="text-xs font-bold px-2 py-1 rounded-full cursor-help" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8' }}>{proficiency.cefr_level} CEFR ⓘ</span>}
                  {proficiency.ielts_equivalent && <span title={`IELTS ${proficiency.ielts_equivalent} band`} className="text-xs font-bold px-2 py-1 rounded-full cursor-help" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8' }}>IELTS {proficiency.ielts_equivalent} ⓘ</span>}
                  {proficiency.english_level && proficiency.english_level !== 'unassessed' && <span title={`English CEFR ${proficiency.english_level}`} className="text-xs font-bold px-2 py-1 rounded-full cursor-help" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8' }}>{proficiency.english_level} English ⓘ</span>}
                </div>
                <p className="text-[#7E7E8E] text-[10px] leading-relaxed">A1/A2 beginner · B1/B2 intermediate (B2 = fluent professional) · C1/C2 advanced</p>
              </div>
            )}
          </div>
        )
      })()}
    </>
  )

  // ─── EXPERIENCE ───
  const experiencePanel = (
    <>
      {workHistory.length > 0 ? (
        <div className="gradient-border-card rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#38BDF8, #34D399)' }} />
            <h2 className="text-[#F4F4F7] font-black text-xl tracking-tight">Experience</h2>
          </div>
          <div className="space-y-6">
            {workHistory.map((job, i) => (
              <div key={i} className={i > 0 ? 'pt-6 border-t border-white/[0.08]' : ''}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div><p className="text-[#F4F4F7] font-bold">{job.title || '—'}</p><p className="text-sm font-semibold" style={{ color: '#38BDF8' }}>{job.company || '—'}</p></div>
                  <p className="text-[#7E7E8E] text-xs text-right flex-shrink-0">{job.start}{job.end ? ` – ${job.end}` : ''}</p>
                </div>
                {job.achievements && <p className="text-[#A6A6B4] text-sm leading-relaxed mt-2">{job.achievements}</p>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="gradient-border-card rounded-2xl p-8 text-center"><p className="text-[#7E7E8E] text-sm">Work history will appear here once your CV is processed</p></div>
      )}

      {skills.length > 0 && (
        <div className="gradient-border-card rounded-2xl p-6">
          <h2 className="text-[#F4F4F7] font-black text-sm uppercase tracking-widest mb-4 opacity-50">Skills</h2>
          <div className="flex flex-wrap gap-2">{skills.map((skill, i) => <span key={i} className="bg-white/[0.05] text-[#C7C7D1] text-xs px-3 py-1.5 rounded-full">{skill}</span>)}</div>
        </div>
      )}

      {/* Online presence */}
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
            <div className="flex items-start justify-between gap-2 mb-3"><p className="text-[#F4F4F7] font-bold text-sm">Online presence</p><Link href="/profile/edit" className="text-[#7E7E8E] text-[10px] hover:text-[#C7C7D1] flex-shrink-0">Edit</Link></div>
            <div className="grid sm:grid-cols-2 gap-2">
              {links.map((l, i) => (
                <a key={i} href={l.url!.startsWith('http') ? l.url! : `https://${l.url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 bg-white/[0.05] hover:bg-white/[0.07] rounded-lg px-3 py-2 transition-colors">
                  <span className="text-[#38BDF8] text-xs font-bold w-8 flex-shrink-0">{l.icon}</span>
                  <span className="min-w-0"><span className="text-[#F4F4F7] text-xs font-bold block">{l.label}</span><span className="text-[#7E7E8E] text-[11px] truncate block">{tidy(l.url!)}</span></span>
                  <span className="text-[#7E7E8E] text-xs ml-auto flex-shrink-0">↗</span>
                </a>
              ))}
            </div>
          </div>
        )
      })()}
    </>
  )

  // ─── CAREER ───
  const learningPanel = (
    <ContinuousLearning view="learning"
      data={(profile.continuous_learning as Parameters<typeof ContinuousLearning>[0]['data']) ?? null}
      roadmap={(profile.career_recommendations as Parameters<typeof ContinuousLearning>[0]['roadmap']) ?? null}
      isPro={isProTier}
      resilienceScore={(profile.ai_resilience_score as number | null) ?? null}
    />
  )

  const careerPanel = (
    <div className="space-y-4">
      <a href="/translate" className="block gradient-border-card rounded-2xl p-5 hover:bg-white/[0.03] transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[#F4F4F7] font-black text-base">🧭 Career Translator</p>
            <p className="text-[#A6A6B4] text-xs mt-0.5">Map any role → role: the salary reality, the track, and the fastest path.</p>
          </div>
          <span className="text-[#38BDF8] text-sm font-bold flex-shrink-0">Open →</span>
        </div>
      </a>
      <ContinuousLearning view="career"
        data={(profile.continuous_learning as Parameters<typeof ContinuousLearning>[0]['data']) ?? null}
        roadmap={(profile.career_recommendations as Parameters<typeof ContinuousLearning>[0]['roadmap']) ?? null}
        isPro={isProTier}
        resilienceScore={(profile.ai_resilience_score as number | null) ?? null}
      />
    </div>
  )

  const eventsPanel = (
    <ContinuousLearning view="events"
      data={(profile.continuous_learning as Parameters<typeof ContinuousLearning>[0]['data']) ?? null}
      roadmap={(profile.career_recommendations as Parameters<typeof ContinuousLearning>[0]['roadmap']) ?? null}
      isPro={isProTier}
      resilienceScore={(profile.ai_resilience_score as number | null) ?? null}
    />
  )

  const testsPanel = (
    <>
      {/* Skill Fingerprint — Shapi-assessed (derived, not retaken) */}
      {profile.skill_quadrant && (
        <div className="gradient-border-card rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#38BDF8, #34D399)' }} />
            <h2 className="text-[#F4F4F7] font-black text-xl tracking-tight">Skill Fingerprint</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(56, 189, 248, 0.14)', color: '#38BDF8' }}>◆ Shapi-assessed</span>
          </div>
          <p className="text-[#7E7E8E] text-xs mb-4 ml-4">Derived from your CV + conversation — it sharpens automatically as you add detail. Not a quiz you retake.</p>
          <div className="flex justify-center"><SkillRadar data={profile.skill_quadrant as { hands: number; heart: number; head: number; spark: number; reasoning?: string }} /></div>
        </div>
      )}

      {/* Work style */}
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
            <div className="gradient-border-card rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4">
                <div><h2 className="text-[#F4F4F7] font-black text-base mb-1">Work-style check <span className="text-[10px] font-bold px-2 py-0.5 rounded-full align-middle" style={{ background: 'rgba(255,255,255,0.05)', color: '#A6A6B4' }}>optional · 2 min</span></h2><p className="text-[#A6A6B4] text-xs">Show companies how you prefer to work — team vs solo, leader vs contributor, and more.</p></div>
                <a href="/work-style" className="flex-shrink-0 px-4 py-2.5 rounded-xl font-black text-xs" style={{ background: 'linear-gradient(135deg,#38BDF8, #34D399)', color: '#060609' }}>Take it →</a>
              </div>
            </div>
          )
        }
        return (
          <div className="gradient-border-card rounded-2xl p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#38BDF8, #34D399)' }} />
              <h2 className="text-[#F4F4F7] font-black text-xl tracking-tight">Work Style</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8' }}>✎ Self-assessment</span>
              <a href="/work-style" className="ml-auto text-[#7E7E8E] text-xs font-bold hover:text-[#C7C7D1]">Retake →</a>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
              {dims.map(d => {
                const score = ws.scores![d.key] ?? 50
                const label = score >= 65 ? d.poleA : score <= 35 ? d.poleB : 'Balanced'
                return (
                  <div key={d.key}>
                    <div className="flex items-center justify-between text-[11px] mb-1"><span className="text-[#A6A6B4]">{d.poleB}</span><span className="text-[#F4F4F7] font-bold">{label}</span><span className="text-[#A6A6B4]">{d.poleA}</span></div>
                    <div className="relative h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}><div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full" style={{ left: `calc(${score}% - 6px)`, background: 'linear-gradient(135deg,#38BDF8, #34D399)' }} /></div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Aptitude — verified test, coming soon */}
      <div className="gradient-border-card rounded-2xl p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#38BDF8, #34D399)' }} />
          <h2 className="text-[#F4F4F7] font-black text-xl tracking-tight">Aptitude test</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' }}>✓ Verified · coming soon</span>
        </div>
        <p className="text-[#7E7E8E] text-xs ml-4">A proctored, one-shot aptitude test employers can trust — not a practice quiz you re-sit. Launching soon.</p>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[#060609]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                      linear-gradient(135deg, rgba(56, 189, 248, 0.18), rgba(56, 189, 248, 0.12)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
      `}</style>

      <nav className="relative z-10 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto border-b border-white/[0.08]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/dashboard" className="text-[#A6A6B4] text-sm hover:text-[#C7C7D1] transition-colors">← Dashboard</Link>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
          {identityPanel}
          <ProfileTabs labels={['Overview', 'Verification', 'Experience', 'Career', 'Learning', 'Events', 'Assessments']} panels={[overviewPanel, verificationPanel, experiencePanel, careerPanel, learningPanel, eventsPanel, testsPanel]} />
        </div>
      </div>
    </div>
  )
}
