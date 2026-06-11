// ============================================================================
// /company/skill-density — HRBP KEYSTONE: Skill Density / Capability Matrix.
//
// The internal redeployment engine. Surfaces verified/detected skills across
// the workforce against unfilled vacancies so an HRBP redeploys instead of
// rehiring externally.
//
// Server component does the auth gate (same pattern as /company/spine), then
// hands off to the client SkillDensityMatrix which fetches the aggregated data
// from /api/company/skill-density and renders the interactive matrix + the
// comparative vacancy search + the Redeploy Candidates panels.
//
// Tier: conceptually Enterprise. We read plan_tier and, if not 'enterprise',
// the client shows an upgrade teaser — but still renders the matrix for
// testing (noted in the UI).
// ============================================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SkillDensityMatrix from './SkillDensityMatrix'

export const metadata = { title: 'Skill Density · Shapi' }

const ACCENT = '#9D8CFF'
const HEADING_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }
const BODY_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }

export default async function SkillDensityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, plan_tier, onboarding_complete')
    .eq('id', user.id)
    .single()

  if (!profile || profile.type !== 'company') redirect('/dashboard')
  if (!profile.onboarding_complete) redirect('/company/onboarding')

  const planTier = (profile as { plan_tier?: string | null }).plan_tier || 'free'
  const companyName = profile.company_name || 'Your org'

  return (
    <main className="min-h-screen px-4 py-10 sm:py-14" style={{ background: '#060609' }}>
      <div className="max-w-4xl mx-auto">
        <Link href="/company/spine" className="text-xs font-bold mb-4 inline-block" style={{ color: ACCENT }}>
          ← Org Spine
        </Link>

        <header className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
            Capability Matrix · HRBP
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2" style={HEADING_STYLE}>
            Skill Density
          </h1>
          <p className="text-sm leading-relaxed" style={BODY_STYLE}>
            Before you open a requisition, look inward. Shapi maps the verified skills already living
            inside <span style={{ color: 'rgba(255,255,255,0.9)' }}>{companyName}</span> against every open seat — so
            instead of hiring three external data analysts, you discover the two people in Riyadh Ops
            who already do the work and just redeploy them.
          </p>
        </header>

        <SkillDensityMatrix planTier={planTier} companyName={companyName} />
      </div>
    </main>
  )
}
