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
  const cardStyle = { border: '1px solid rgba(14,14,26,0.08)', boxShadow: '0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05)' }

  return (
    <div className="min-h-screen bg-[#F1F2F7]">
      <nav className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto border-b border-[#0E0E1A]/[0.08]">
        <Link href="/" className="font-black text-2xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-[#5A5A6E] hover:text-[#0E0E1A]">Dashboard</Link>
          <form action="/api/auth/signout" method="post">
            <button className="text-sm text-[#5A5A6E] hover:text-[#0E0E1A]">Sign out</button>
          </form>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-10 pb-20">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-[#0E0E1A] mb-2">Verified candidates</h1>
            <p className="text-[#5A5A6E]">{count} candidates with verified profiles</p>
          </div>
          {isPaid && (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full capitalize" style={{ background: 'rgba(6,182,212,0.10)', color: '#0891B2' }}>
              {company.subscription_tier} plan
            </span>
          )}
        </div>

        {/* Paywall banner */}
        {!isPaid && count > 0 && (
          <div className="rounded-2xl p-7 mb-8 flex items-center justify-between gap-6 text-white" style={{ background: 'linear-gradient(135deg, #06B6D4, #7C3AED)' }}>
            <div>
              <p className="font-black text-lg mb-1">
                {count} verified candidate{count !== 1 ? 's' : ''} matched
              </p>
              <p className="text-white/80 text-sm">
                Subscribe to unlock full profiles, references, and direct contact.
              </p>
            </div>
            <Link href="/company/pricing"
              className="bg-white text-[#0E0E1A] px-6 py-3 rounded-full font-bold text-sm hover:bg-white/90 transition-colors flex-shrink-0">
              Unlock candidates →
            </Link>
          </div>
        )}

        {count === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center" style={cardStyle}>
            <div className="w-12 h-12 bg-[#0E0E1A]/[0.04] rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-[#8A8A99] text-xl">◎</span>
            </div>
            <p className="text-[#0E0E1A] font-bold mb-2">No verified candidates yet</p>
            <p className="text-[#8A8A99] text-sm">We&apos;re onboarding candidates — check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {candidates!.map((c: Candidate) => (
              <div key={c.id} className="bg-white rounded-2xl p-6" style={cardStyle}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className={`font-bold text-lg text-[#0E0E1A] ${isPaid ? '' : 'blur-sm select-none'}`}>
                        {isPaid ? (c.full_name || 'Anonymous Candidate') : 'Verified Candidate'}
                      </h3>
                      {c.completion_pct >= 80 && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                          Verified
                        </span>
                      )}
                      {c.ai_tier && (
                        <span className="bg-[#0E0E1A]/[0.04] text-[#5A5A6E] text-xs font-medium px-2.5 py-1 rounded-full capitalize">
                          AI {c.ai_tier}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mb-1 text-[#3F3F4E] ${isPaid ? '' : 'blur-sm select-none'}`}>
                      {isPaid ? (c.headline || '—') : 'Senior Professional · 8+ years experience'}
                    </p>
                    <p className={`text-xs mb-3 text-[#8A8A99] ${isPaid ? '' : 'blur-sm select-none'}`}>
                      {isPaid ? (c.location || '—') : 'Dubai, UAE'}
                    </p>
                    {c.skills && c.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {c.skills.slice(0, 6).map((skill: string, i: number) => (
                          <span key={i} className="bg-[#0E0E1A]/[0.04] text-[#5A5A6E] text-xs px-3 py-1 rounded-full">
                            {skill}
                          </span>
                        ))}
                        {c.skills.length > 6 && (
                          <span className="text-[#8A8A99] text-xs px-1 py-1">+{c.skills.length - 6} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-black" style={{ color: '#0891B2' }}>{c.completion_pct}%</div>
                    <div className="text-xs text-[#8A8A99]">complete</div>
                  </div>
                </div>
                {!isPaid && (
                  <div className="mt-4 pt-4 border-t border-[#0E0E1A]/[0.06] flex items-center justify-between">
                    <p className="text-xs text-[#8A8A99]">Subscribe to view full profile, references &amp; contact</p>
                    <Link href="/company/pricing" className="text-xs font-bold hover:underline" style={{ color: '#0891B2' }}>
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
