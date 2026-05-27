import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import RoleEditForm, { type EditableRole } from './RoleEditForm'

export default async function RoleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: company } = await supabase
    .from('profiles')
    .select('type, company_name, full_name')
    .eq('id', user.id)
    .single()

  if (!company || company.type !== 'company') redirect('/dashboard')

  // Owner-scoped: only this company's role
  const { data: role } = await supabase
    .from('roles')
    .select('id, title, department, location, remote, salary_min, salary_max, salary_currency, salary_visible, engagement_type, accepts_pivot_candidates, description, requirements, hiring_notes, must_have_skills, nice_to_have_skills, status, created_at')
    .eq('id', id)
    .eq('company_id', user.id)
    .single()

  if (!role) notFound()

  // A role is "from WhatsApp" if it has hiring_notes or skill arrays the manual
  // form never sets, or an explicit origin flag. Drafts almost always come from WA.
  const fromWhatsApp = Boolean(
    role.hiring_notes ||
    (Array.isArray(role.must_have_skills) && role.must_have_skills.length > 0) ||
    (Array.isArray(role.nice_to_have_skills) && role.nice_to_have_skills.length > 0)
  )

  return (
    <div className="min-h-screen" style={{ background: '#0E0E13' }}>
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/company/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">← Dashboard</Link>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-24">
        <RoleEditForm role={role as EditableRole} fromWhatsApp={fromWhatsApp} />
      </div>
    </div>
  )
}
