import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ApplicationTracker from './ApplicationTracker'

export default async function MyApplications() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('type').eq('id', user.id).single()
  if (profile?.type === 'company') redirect('/company/pipeline')

  const { data: appRows } = await supabase
    .from('applications')
    .select('id, role_id, company_id, stage, candidate_scorecard, updated_at')
    .eq('candidate_id', user.id)
    .order('updated_at', { ascending: false })

  const admin = createAdminClient()
  const roleIds = [...new Set((appRows || []).map(a => a.role_id))]
  const companyIds = [...new Set((appRows || []).map(a => a.company_id))]
  const [{ data: roles }, { data: companies }] = await Promise.all([
    roleIds.length ? admin.from('roles').select('id, title, location, salary_min, salary_max, salary_currency, engagement_type').in('id', roleIds) : Promise.resolve({ data: [] }),
    companyIds.length ? admin.from('profiles').select('id, company_name, full_name').in('id', companyIds) : Promise.resolve({ data: [] }),
  ])
  const roleMap = new Map((roles || []).map(r => [r.id, r]))
  const companyMap = new Map((companies || []).map(c => [c.id, c.company_name || c.full_name || 'Company']))

  const { data: ivRows } = await supabase
    .from('interviews')
    .select('role_id, scheduled_at, video_platform, meeting_link, location, status')
    .eq('candidate_id', user.id)
  const ivMap = new Map((ivRows || []).map(i => [i.role_id, i]))

  const { data: fbRows } = await supabase
    .from('interview_feedback')
    .select('role_id, rating, move_forward, notes')
    .eq('candidate_id', user.id)
    .eq('author', 'candidate')
  const fbMap = new Map((fbRows || []).map(f => [f.role_id, f]))

  const apps = (appRows || []).map(a => ({
    id: a.id,
    role_id: a.role_id,
    stage: a.stage,
    candidate_scorecard: a.candidate_scorecard as Record<string, number> | null,
    role: roleMap.get(a.role_id) || null,
    company_name: companyMap.get(a.company_id) || 'Company',
    interview: ivMap.get(a.role_id) || null,
    feedback: fbMap.get(a.role_id) || null,
  }))

  return (
    <div className="min-h-screen bg-[#F1F2F7]">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(14,14,26,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <nav className="relative z-10 px-6 py-4 border-b border-[#0E0E1A]/[0.08] max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg, #A78BFA, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/dashboard" className="text-[#5A5A6E] text-sm hover:text-[#0E0E1A]">← Dashboard</Link>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-[#0E0E1A] mb-1">My applications</h1>
          <p className="text-[#5A5A6E] text-sm">Track where you stand — and score each opportunity so you know which to choose.</p>
        </div>

        {apps.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center" style={{ border: '1px solid rgba(14,14,26,0.08)' }}>
            <p className="text-[#0E0E1A] font-bold mb-1">No applications yet</p>
            <p className="text-[#8A8A99] text-sm mb-4">Express interest in roles and they&apos;ll show up here as you move through the stages.</p>
            <Link href="/roles" className="inline-block text-white text-sm font-bold px-5 py-2.5 rounded-full" style={{ background: 'linear-gradient(135deg,#06B6D4,#7C3AED)' }}>Browse roles →</Link>
          </div>
        ) : (
          <ApplicationTracker applications={apps} />
        )}
      </div>
    </div>
  )
}
