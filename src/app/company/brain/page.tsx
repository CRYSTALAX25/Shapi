import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import BrainConsole from './BrainConsole'

export const metadata = { title: 'Company Brain · Shapi' }

export default async function BrainPage() {
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

  // Seats + teams for the anchor dropdowns (Seat Inheritance Playbook).
  const [seatsResult, teamsResult] = await Promise.all([
    supabase.from('roles_seats').select('id, title').eq('company_id', user.id).order('title'),
    supabase.from('teams').select('id, name').eq('company_id', user.id).order('name'),
  ])
  const seats = (seatsResult.data || []) as { id: string; title: string }[]
  const teams = (teamsResult.data || []) as { id: string; name: string }[]

  // Existing entry count for the empty-state decision (RLS-scoped).
  const { count: entryCount } = await supabase
    .from('brain_entries')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', user.id)

  const ACCENT = '#9D8CFF'
  const HEADING_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }
  const BODY_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }

  const isEnterprise = planTier === 'enterprise'

  return (
    <main className="min-h-screen px-4 py-10 sm:py-14" style={{ background: '#060609' }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/company/dashboard" className="text-xs font-bold mb-4 inline-block" style={{ color: ACCENT }}>
          ← Dashboard
        </Link>

        <header className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
            Company Brain · Enterprise
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2" style={HEADING_STYLE}>
            {profile.company_name || 'Your org'} — institutional memory
          </h1>
          <p className="text-sm leading-relaxed" style={BODY_STYLE}>
            Drop in meeting notes, handover docs, process write-ups. Shapi chunks and embeds them,
            then answers questions over your own knowledge. Everything is anchored to a{' '}
            <strong style={{ color: 'rgba(255,255,255,0.9)' }}>seat</strong>, not a person.
          </p>
        </header>

        {/* Seat Inheritance Playbook explainer + privacy gate. */}
        <div
          className="mb-6 p-5 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(157, 140, 255, 0.10), rgba(157, 140, 255, 0.10))',
            border: `1px solid ${ACCENT}55`,
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
            Seat Inheritance Playbook
          </p>
          <p className="text-sm leading-relaxed mb-3" style={BODY_STYLE}>
            Knowledge is attached to the <strong style={{ color: 'rgba(255,255,255,0.9)' }}>seat</strong>, so when
            someone leaves, their context stays. The next person to fill that seat inherits a
            conversational onboarding co-pilot on day one — the handover survives the departure.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(52,211,153,0.13)', color: '#34D399' }}>
              team — visible to the whole company
            </span>
            <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>
              manager — owner / chain only
            </span>
            <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(251,113,133,0.15)', color: '#FB7185' }}>
              private — never surfaced in search
            </span>
          </div>
          <p className="text-[11px] leading-relaxed mt-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Privacy gate: search runs under row-level security. Private entries and anything that
            looks like medical / PIP / compensation content is excluded from general queries — by
            design, not by trust.
          </p>
        </div>

        {!isEnterprise && (
          <div
            className="mb-6 p-4 rounded-xl text-xs"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#FBBF24' }}
          >
            <strong>Company Brain is an Enterprise feature.</strong> You can explore the console
            below, but ingestion and retrieval unlock on the Enterprise plan.{' '}
            <Link href="/book-call?intent=enterprise" className="font-black underline">Talk to us</Link>{' '}
            · <Link href="/company/pricing" className="font-black underline">See plans</Link>
          </div>
        )}

        <BrainConsole
          seats={seats}
          teams={teams}
          hasEntries={(entryCount || 0) > 0}
          enabled={isEnterprise}
        />
      </div>
    </main>
  )
}
