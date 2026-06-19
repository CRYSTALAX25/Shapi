// /company/workforce-pl — the Workforce P&L Ledger. Loads the company's org-spine
// seats (with their budget bands), hands them to the interactive client, and gates
// the whole thing behind the Product-2 entitlement (inert until the flag flips).

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FeatureGate from '@/components/FeatureGate'
import WorkforcePLClient, { type SeatInput } from './WorkforcePLClient'

export const metadata = { title: 'Workforce P&L Ledger · Shapi' }
export const dynamic = 'force-dynamic'

const ACCENT = '#38BDF8'

export default async function WorkforcePLPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, onboarding_complete')
    .eq('id', user.id)
    .single()
  if (!profile || profile.type !== 'company') redirect('/dashboard')
  if (!profile.onboarding_complete) redirect('/company/onboarding')

  const admin = createAdminClient()

  // Load seats with their budget band. Defensive: if the budget columns aren't
  // present, fall back to the minimal set (the client lets the user enter costs).
  let rawSeats: Array<{ id: string; title: string; experienced_budget_sar?: number | null }> = []
  const withBudget = await admin
    .from('roles_seats')
    .select('id, title, experienced_budget_sar, status')
    .eq('company_id', user.id)
    .order('title')
  if (withBudget.error) {
    const minimal = await admin.from('roles_seats').select('id, title, status').eq('company_id', user.id).order('title')
    rawSeats = (minimal.data || []) as typeof rawSeats
  } else {
    rawSeats = withBudget.data as typeof rawSeats
  }

  const seats: SeatInput[] = rawSeats.map(s => ({
    id: s.id,
    title: s.title || 'Untitled seat',
    annualCost: Number(s.experienced_budget_sar) || 0,
  }))

  return (
    <main className="min-h-screen px-4 py-10 sm:py-14" style={{ background: '#060609' }}>
      <div className="max-w-4xl mx-auto">
        <Link href="/company/dashboard" className="text-xs font-bold mb-4 inline-block" style={{ color: ACCENT }}>
          ← Dashboard
        </Link>
        <FeatureGate feature="workforce_p_and_l_ledger">
          <header className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
              Workforce P&amp;L Ledger · Strategic Planner
            </p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>
              Restructure as a balance sheet
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Mark each seat keep / cut / redeploy, add the roles you&apos;ll open, and see the capital
              cost, the annualised run-rate saving, and the break-even horizon — the numbers a CFO
              actually signs off, not a headcount count.
            </p>
          </header>
          <WorkforcePLClient seats={seats} companyName={profile.company_name || 'Your company'} />
        </FeatureGate>
      </div>
    </main>
  )
}
