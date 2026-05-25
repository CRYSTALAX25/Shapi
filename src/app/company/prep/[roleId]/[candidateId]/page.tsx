import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Anthropic from '@anthropic-ai/sdk'

type VReport = {
  claims_verified?: string[]
  claims_unverified?: string[]
  conflicts?: Array<{ topic: string; note: string }>
  top_skills?: string[]
  tone_summary?: string
  summary_en?: string
}

export default async function ManagerBrief({ params }: { params: Promise<{ roleId: string; candidateId: string }> }) {
  const { roleId, candidateId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: company } = await supabase.from('profiles').select('type, company_name').eq('id', user.id).single()
  if (company?.type !== 'company') redirect('/dashboard')

  const { data: role } = await supabase.from('roles').select('id, title, description, requirements, company_id').eq('id', roleId).single()
  if (!role || role.company_id !== user.id) notFound()

  const admin = createAdminClient()
  const { data: c } = await admin
    .from('profiles')
    .select('full_name, headline, summary, skills, verification_tier, verification_report, skill_quadrant, salary_expectations')
    .eq('id', candidateId).single()
  if (!c) notFound()
  const { data: refs } = await admin
    .from('candidate_references').select('ref_type, extracted_skills').eq('candidate_id', candidateId).eq('status', 'completed')

  const report = (c.verification_report as VReport | null) || {}
  const refRows = refs || []
  const refCount = refRows.length
  const refSkills = [...new Set(refRows.flatMap(r => Array.isArray(r.extracted_skills) ? r.extracted_skills : []))].slice(0, 10)
  const firstName = (c.full_name as string)?.split(' ')[0] || 'the candidate'

  const tierMeta: Record<string, { label: string; color: string }> = {
    premium: { label: 'Premium Verified', color: '#D97706' },
    strong: { label: 'Strongly Verified', color: '#059669' },
    basic: { label: 'Verified', color: '#0891B2' },
  }
  const tier = tierMeta[(c.verification_tier as string) || '']

  // Salary band
  const se = c.salary_expectations as { currency?: string; period?: string; primary?: { min?: number; max?: number } } | null
  const salaryBand = se?.primary && (se.primary.min != null || se.primary.max != null)
    ? `${se.currency || ''} ${se.primary.min?.toLocaleString() ?? '—'}${se.primary.max != null ? `–${se.primary.max.toLocaleString()}` : '+'}/${se.period === 'year' ? 'yr' : 'mo'}`
    : null

  // AI-suggested probing questions
  let questions: string[] = []
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const prompt = `You are helping a hiring manager prepare for an interview. Produce 5 sharp, specific interview questions for this candidate and role.

ROLE: ${role.title}
ROLE DETAILS: ${(role.description as string || role.requirements as string || '').slice(0, 800)}

CANDIDATE VERIFIED STRENGTHS: ${(report.claims_verified || []).join('; ') || (c.skills as string[] || []).join(', ')}
MOST-CITED SKILLS (from references): ${refSkills.join(', ') || 'n/a'}
AREAS TO PROBE (claims no reference confirmed): ${(report.claims_unverified || []).join('; ') || 'none'}
DIFFERING REFERENCE PERSPECTIVES: ${(report.conflicts || []).map(c => c.topic).join('; ') || 'none'}

Write questions that (a) pressure-test the verified strengths with real examples, and (b) gently explore the areas to probe / differing perspectives. Specific, not generic. Return ONLY a JSON array of 5 strings.`
      const resp = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 700, messages: [{ role: 'user', content: prompt }] })
      const text = resp.content[0].type === 'text' ? resp.content[0].text : ''
      const m = text.match(/\[[\s\S]*\]/)
      if (m) questions = (JSON.parse(m[0]) as string[]).slice(0, 5)
    } catch { questions = [] }
  }

  const card = { background: '#16161F', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)' } as const

  return (
    <div className="min-h-screen bg-[#0E0E13]">
      <nav className="px-6 py-4 border-b border-[rgba(255,255,255,0.08)] max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/company/pipeline" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#F08CAE,#6AA8F5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/company/pipeline" className="text-[#A6A6B4] text-sm hover:text-[#F4F4F7]">← Pipeline</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-8 pb-20">
        <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: '#F08CAE' }}>Interview prep · for the hiring manager</p>
        <h1 className="text-3xl font-black tracking-tighter text-[#F4F4F7]">{c.full_name as string}</h1>
        <p className="text-[#A6A6B4] mb-1">{c.headline as string} · for <span className="font-bold text-[#F4F4F7]">{role.title}</span></p>
        <div className="flex items-center gap-2 mb-6">
          {tier && <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${tier.color}1f`, color: tier.color }}>✓ {tier.label}</span>}
          {refCount > 0 && <span className="text-xs text-[#7E7E8E]">{refCount} reference{refCount !== 1 ? 's' : ''} on file</span>}
          {salaryBand && <span className="text-xs font-bold" style={{ color: '#6AA8F5' }}>· Expects {salaryBand}</span>}
        </div>

        {report.summary_en && (
          <div className="rounded-2xl p-5 mb-4" style={{ ...card, borderLeft: '3px solid #F08CAE' }}>
            <p className="text-[#C7C7D1] text-sm leading-relaxed">{report.summary_en}</p>
            {report.tone_summary && <p className="text-[#7E7E8E] text-xs mt-2">Reference tone: {report.tone_summary}</p>}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          {(report.claims_verified?.length ?? 0) > 0 && (
            <div className="rounded-2xl p-5" style={card}>
              <p className="text-[#6AA8F5] text-[11px] font-bold uppercase tracking-wider mb-2">✓ Verified strengths</p>
              <ul className="space-y-1">{report.claims_verified!.slice(0, 5).map((s, i) => <li key={i} className="text-[#C7C7D1] text-xs leading-relaxed">· {s}</li>)}</ul>
            </div>
          )}
          {refSkills.length > 0 && (
            <div className="rounded-2xl p-5" style={card}>
              <p className="text-[#6AA8F5] text-[11px] font-bold uppercase tracking-wider mb-2">Most-cited by references</p>
              <div className="flex flex-wrap gap-1.5">{refSkills.map((s, i) => <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(106,168,245,0.10)', color: '#6AA8F5' }}>{s}</span>)}</div>
            </div>
          )}
        </div>

        {((report.claims_unverified?.length ?? 0) > 0 || (report.conflicts?.length ?? 0) > 0) && (
          <div className="rounded-2xl p-5 mb-4" style={{ ...card, borderLeft: '3px solid #FBBF24' }}>
            <p className="text-[#FBBF24] text-[11px] font-bold uppercase tracking-wider mb-2">Areas worth exploring</p>
            {(report.claims_unverified || []).map((s, i) => <p key={`u${i}`} className="text-[#C7C7D1] text-xs leading-relaxed">· {s} <span className="text-[#7E7E8E]">(no reference confirmed)</span></p>)}
            {(report.conflicts || []).map((cf, i) => <p key={`c${i}`} className="text-[#C7C7D1] text-xs leading-relaxed mt-1">· {cf.topic}: <span className="text-[#7E7E8E]">{cf.note}</span></p>)}
          </div>
        )}

        {questions.length > 0 && (
          <div className="rounded-2xl p-6" style={card}>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg,#6AA8F5,#F08CAE)' }} />
              <h2 className="text-xl font-black tracking-tight text-[#F4F4F7]">Suggested questions</h2>
            </div>
            <ol className="space-y-3">
              {questions.map((q, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)' }}>{i + 1}</span>
                  <p className="text-[#C7C7D1] text-sm leading-relaxed">{q}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="text-[#7E7E8E] text-xs mt-6">Built from {firstName}&apos;s verified Shapi profile. Reference details are aggregated — individual referee identities and verbatim responses stay confidential.</p>
      </div>
    </div>
  )
}
