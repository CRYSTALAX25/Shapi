import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type Candidate = {
  id: string
  full_name: string | null
  headline: string | null
  location: string | null
  skills: string[]
  ai_tier: string | null
  completion_pct: number
}

export default async function CandidatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: company } = await supabase
    .from('profiles')
    .select('type, paid, subscription_status, subscription_tier')
    .eq('id', user.id)
    .single()

  if (company?.type !== 'company') redirect('/dashboard')

  const isPaid = company?.paid && company?.subscription_status === 'active'

  const { data: candidates } = await supabase
    .from('profiles')
    .select('id, full_name, headline, location, skills, ai_tier, completion_pct')
    .eq('type', 'candidate')
    .eq('paid', true)
    .gte('completion_pct', 50)
    .order('completion_pct', { ascending: false })
    .limit(50)

  const count = candidates?.length || 0

  return (
    <div className="min-h-screen bg-[#F8F4EE]">
      <nav className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto border-b border-[#1C1C2E]/5">
        <Link href="/" className="text-[#0B5563] font-bold text-2xl tracking-tight">shapi</Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-[#1C1C2E]/50 hover:text-[#1C1C2E]">Dashboard</Link>
          <form action="/api/auth/signout" method="post">
            <button className="text-sm text-[#1C1C2E]/50 hover:text-[#1C1C2E]">Sign out</button>
          </form>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-10 pb-20">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#1C1C2E] mb-2">Verified candidates</h1>
            <p className="text-[#1C1C2E]/60">{count} candidates with verified profiles</p>
          </div>
          {isPaid && (
            <span className="bg-[#0B5563]/10 text-[#0B5563] text-xs font-semibold px-3 py-1.5 rounded-full capitalize">
              {company.subscription_tier} plan
            </span>
          )}
        </div>

        {/* Paywall banner */}
        {!isPaid && count > 0 && (
          <div className="bg-[#0B5563] rounded-2xl p-7 mb-8 flex items-center justify-between gap-6">
            <div>
              <p className="text-white font-semibold text-lg mb-1">
                {count} verified candidate{count !== 1 ? 's' : ''} matched
              </p>
              <p className="text-white/70 text-sm">
                Subscribe to unlock full profiles, references, and direct contact.
              </p>
            </div>
            <Link href="/company/pricing"
              className="bg-white text-[#0B5563] px-6 py-3 rounded-full font-semibold text-sm hover:bg-white/90 transition-colors flex-shrink-0">
              Unlock candidates →
            </Link>
          </div>
        )}

        {count === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-[#1C1C2E]/10 text-center">
            <div className="w-12 h-12 bg-[#1C1C2E]/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-[#1C1C2E]/30 text-xl">◎</span>
            </div>
            <p className="text-[#1C1C2E] font-medium mb-2">No verified candidates yet</p>
            <p className="text-[#1C1C2E]/50 text-sm">We're onboarding candidates — check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {candidates!.map((c: Candidate) => (
              <div key={c.id} className={`bg-white rounded-2xl p-6 border border-[#1C1C2E]/10 shadow-sm transition-shadow ${isPaid ? 'hover:shadow-md' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className={`font-semibold text-lg ${isPaid ? 'text-[#1C1C2E]' : 'blur-sm select-none text-[#1C1C2E]'}`}>
                        {isPaid ? (c.full_name || 'Anonymous Candidate') : 'Verified Candidate'}
                      </h3>
                      {c.completion_pct >= 80 && (
                        <span className="bg-[#0B5563]/10 text-[#0B5563] text-xs font-medium px-2.5 py-1 rounded-full">
                          Verified
                        </span>
                      )}
                      {c.ai_tier && (
                        <span className="bg-[#F8F4EE] text-[#1C1C2E]/60 text-xs font-medium px-2.5 py-1 rounded-full capitalize">
                          AI {c.ai_tier}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mb-1 ${isPaid ? 'text-[#1C1C2E]/70' : 'blur-sm select-none text-[#1C1C2E]/70'}`}>
                      {isPaid ? (c.headline || '—') : 'Senior Professional · 8+ years experience'}
                    </p>
                    <p className={`text-xs mb-3 ${isPaid ? 'text-[#1C1C2E]/40' : 'blur-sm select-none text-[#1C1C2E]/40'}`}>
                      {isPaid ? (c.location || '—') : 'Dubai, UAE'}
                    </p>
                    {c.skills && c.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {c.skills.slice(0, 6).map((skill: string, i: number) => (
                          <span key={i} className="bg-[#F8F4EE] text-[#1C1C2E]/60 text-xs px-3 py-1 rounded-full">
                            {skill}
                          </span>
                        ))}
                        {c.skills.length > 6 && (
                          <span className="text-[#1C1C2E]/30 text-xs px-1 py-1">+{c.skills.length - 6} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold text-[#0B5563]">{c.completion_pct}%</div>
                    <div className="text-xs text-[#1C1C2E]/40">complete</div>
                  </div>
                </div>
                {!isPaid && (
                  <div className="mt-4 pt-4 border-t border-[#1C1C2E]/5 flex items-center justify-between">
                    <p className="text-xs text-[#1C1C2E]/40">Subscribe to view full profile, references & contact</p>
                    <Link href="/company/pricing" className="text-xs text-[#0B5563] font-medium hover:underline">
                      Unlock →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
