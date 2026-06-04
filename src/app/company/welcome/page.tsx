import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'

export const metadata = { title: 'Welcome to Shapi Pro · Shapi' }

// /company/welcome — Stripe success-URL target after a successful company
// subscription checkout. The user is fresh off Stripe with no idea what
// happens next. This page exists to ground them with:
//   1. Clear confirmation ("you're in")
//   2. What they unlocked
//   3. Three next actions ranked by leverage
//   4. Where the receipt went (Stripe sends it automatically)
//   5. Customer portal link for billing changes
//
// Previous version of this flow sent users to /candidates?subscribed=true —
// a blank candidates inventory with no welcome. Ana flagged this as a major
// UX gap 2026-06-04.

const PLAN_DETAILS: Record<string, { name: string; unlocked: string[]; nextActions: { href: string; label: string; sub: string; emoji: string }[] }> = {
  pro: {
    name: 'Shapi Pro',
    unlocked: [
      'Multi-location org chart',
      'Talent Match Pipeline with verified candidates',
      'Active Hiring — daily AI shortlists + drafted outreach',
      'Salary Benchmark · Hiring Roadmap · Strategic Workforce Plan',
      'AI-Proof a role + Cognitive Load reads',
      'Proof-Over-Polish verification with Differing Perspectives flagging',
    ],
    nextActions: [
      { href: '/company/spine', label: 'Build your org spine', sub: 'Add teams + seats so every other tool pre-fills.', emoji: '🌳' },
      { href: '/company/workforce-snapshot?first=true', label: 'Run your Workforce Snapshot', sub: 'AI-readiness score in 60 seconds.', emoji: '✦' },
      { href: '/company/roles/new', label: 'Post your first role', sub: 'JD generated from a 6-question intake.', emoji: '💼' },
    ],
  },
}

export default async function CompanyWelcome({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; session_id?: string }>
}) {
  const params = await searchParams
  const tier = params.tier || 'pro'
  const plan = PLAN_DETAILS[tier] || PLAN_DETAILS.pro

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name, full_name, subscription_status, paid')
    .eq('id', user.id)
    .single()

  const companyName = (profile as { company_name?: string | null })?.company_name
    || (profile as { full_name?: string | null })?.full_name
    || 'there'

  // The webhook fires asynchronously. By the time the user lands here, the
  // subscription record may or may not have hit the DB yet. We DON'T gate
  // the welcome screen on subscription_status — the Stripe success URL is
  // proof-enough that the checkout completed. We just show the celebration.

  return (
    <main className="min-h-screen px-4 py-10 sm:py-14" style={{ background: '#0c0e11' }}>
      <div className="max-w-3xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-10">
          <ShapiCharacter mood="happy" size={80} className="mx-auto mb-5" />
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#6AA8F5' }}>
            Welcome to {plan.name}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3" style={{ color: '#F4F4F7' }}>
            You&apos;re in, {companyName}.
          </h1>
          <p className="text-sm text-[#A6A6B4] max-w-xl mx-auto leading-relaxed">
            Your 14-day trial just started. Cancel anytime in your Stripe customer portal — no charge until day 15.
            Your receipt is on its way to {user.email}.
          </p>
        </div>

        {/* Unlocked */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: '#13161b', border: '1px solid rgba(106,168,245,0.20)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#6AA8F5' }}>
            What you unlocked
          </p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {plan.unlocked.map((u, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#6AA8F5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                <p className="text-sm text-[#C7C7D1]">{u}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Next actions */}
        <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#9ca3af' }}>
          What next? (ranked by leverage)
        </p>
        <div className="space-y-3 mb-8">
          {plan.nextActions.map((a, i) => (
            <Link
              key={a.href}
              href={a.href}
              className="block rounded-2xl p-5 transition-all hover:opacity-90"
              style={{
                background: i === 0
                  ? 'linear-gradient(135deg, rgba(106,168,245,0.12), rgba(240,140,174,0.08))'
                  : '#13161b',
                border: i === 0 ? '1px solid rgba(106,168,245,0.35)' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: 'rgba(106,168,245,0.14)', border: '1px solid rgba(106,168,245,0.25)' }}>
                  {a.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-base mb-0.5" style={{ color: '#F4F4F7' }}>
                    {i + 1}. {a.label} →
                  </p>
                  <p className="text-xs text-[#A6A6B4]">{a.sub}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom: receipt + billing */}
        <div className="rounded-xl p-4 text-xs" style={{ background: '#13161b', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="mb-2" style={{ color: '#C7C7D1' }}>
            <strong>Need anything?</strong>
          </p>
          <ul className="space-y-1.5" style={{ color: '#A6A6B4' }}>
            <li>• Receipt + invoice: emailed by Stripe to <strong>{user.email}</strong></li>
            <li>• Manage billing / cancel: <Link href="/api/stripe/portal" className="underline" style={{ color: '#6AA8F5' }}>Stripe customer portal</Link></li>
            <li>• Migration help (CSV import, setup call): reply to your receipt or email <a href="mailto:hello@shapi.io" className="underline" style={{ color: '#6AA8F5' }}>hello@shapi.io</a></li>
          </ul>
        </div>

        <p className="text-center text-xs text-[#7E7E8E] mt-6">
          <Link href="/company/dashboard" className="underline">Skip everything and go to dashboard</Link>
        </p>
      </div>
    </main>
  )
}
