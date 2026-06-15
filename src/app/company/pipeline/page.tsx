import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PipelineBoard from './PipelineBoard'
import { candidateReliabilityRatings } from '@/lib/trust'

export default async function CompanyPipeline({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: company } = await supabase
    .from('profiles').select('type, company_name, full_name').eq('id', user.id).single()
  if (!company || company.type !== 'company') redirect('/dashboard')

  const { data: roles } = await supabase
    .from('roles').select('id, title, status').eq('company_id', user.id).order('created_at', { ascending: false })
  const activeRoles = (roles || []).filter(r => r.status === 'active')

  const sp = await searchParams
  const selectedRoleId = sp.role || activeRoles[0]?.id || (roles || [])[0]?.id || null
  const selectedRole = (roles || []).find(r => r.id === selectedRoleId) || null

  // Applications for the selected role + candidate info
  let apps: Array<Record<string, unknown>> = []
  if (selectedRoleId) {
    const { data: appRows } = await supabase
      .from('applications')
      .select('id, candidate_id, stage, company_scorecard, updated_at')
      .eq('company_id', user.id)
      .eq('role_id', selectedRoleId)
    const candidateIds = (appRows || []).map(a => a.candidate_id)
    const admin = createAdminClient()
    const { data: cands } = candidateIds.length
      ? await admin.from('profiles').select('id, full_name, headline, location, verification_tier, completion_pct').in('id', candidateIds)
      : { data: [] }
    const cmap = new Map((cands || []).map(c => [c.id, c]))
    const { data: ivRows } = await supabase
      .from('interviews')
      .select('candidate_id, scheduled_at, video_platform, meeting_link, location, status')
      .eq('company_id', user.id)
      .eq('role_id', selectedRoleId)
    const ivMap = new Map((ivRows || []).map(i => [i.candidate_id, i]))
    const { data: fbRows } = await supabase
      .from('interview_feedback')
      .select('candidate_id, rating, move_forward, notes')
      .eq('company_id', user.id)
      .eq('role_id', selectedRoleId)
      .eq('author', 'company')
    const fbMap = new Map((fbRows || []).map(f => [f.candidate_id, f]))
    const relMap = await candidateReliabilityRatings(admin, candidateIds)
    apps = (appRows || []).map(a => ({ ...a, candidate: cmap.get(a.candidate_id) || null, interview: ivMap.get(a.candidate_id) || null, feedback: fbMap.get(a.candidate_id) || null, reliability: relMap.get(a.candidate_id) || null }))
  }

  return (
    <div className="min-h-screen bg-[#060609]">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/company/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">← Dashboard</Link>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-8 pb-20">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-[#F4F4F7] mb-1">Pipeline</h1>
          <p className="text-[#A6A6B4] text-sm">Track every candidate through the stages and score them side by side.</p>
        </div>

        {/* Role tabs */}
        {(roles || []).length > 0 ? (
          <div className="flex gap-2 flex-wrap mb-6">
            {(roles || []).map(r => (
              <Link key={r.id} href={`/company/pipeline?role=${r.id}`}
                className="text-sm font-bold px-4 py-2 rounded-full transition-all"
                style={selectedRoleId === r.id
                  ? { background: 'linear-gradient(135deg,#38BDF8, #34D399)', color: '#fff' }
                  : { background: '#0D0C14', border: '1px solid rgba(255,255,255,0.08)', color: '#A6A6B4' }}>
                {r.title}{r.status !== 'active' ? ` · ${r.status}` : ''}
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-[#0D0C14] rounded-2xl p-10 text-center" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-[#F4F4F7] font-bold mb-1">No roles yet</p>
            <p className="text-[#7E7E8E] text-sm mb-4">Post a role and shortlist candidates to start your pipeline.</p>
            <Link href="/company/roles/new" className="inline-block text-white text-sm font-bold px-5 py-2.5 rounded-full" style={{ background: 'linear-gradient(135deg,#38BDF8, #34D399)' }}>Post a role →</Link>
          </div>
        )}

        {selectedRole && (
          <PipelineBoard roleId={selectedRole.id} roleTitle={selectedRole.title} applications={apps as Parameters<typeof PipelineBoard>[0]['applications']} />
        )}
      </div>
    </div>
  )
}
