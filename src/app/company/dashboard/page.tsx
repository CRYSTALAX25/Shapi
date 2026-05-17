import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'

type Candidate = {
  id: string
  full_name: string | null
  headline: string | null
  location: string | null
  skills: string[]
  ai_tier: string | null
  completion_pct: number
  summary: string | null
  whatsapp_chat: unknown[]
}

export default async function CompanyDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: company } = await supabase
    .from('profiles')
    .select('full_name, type, paid, subscription_status, subscription_tier, company_name')
    .eq('id', user.id)
    .single()

  if (!company || company.type !== 'company') redirect('/dashboard')

  const isPaid = company?.paid && company?.subscription_status === 'active'

  const { data: candidates } = await supabase
    .from('profiles')
    .select('id, full_name, headline, location, skills, ai_tier, completion_pct, summary, whatsapp_chat')
    .eq('type', 'candidate')
    .gte('completion_pct', 30)
    .order('completion_pct', { ascending: false })
    .limit(50)

  const count = candidates?.length || 0
  const companyName = company.company_name || company.full_name || 'Your company'

  const aiTierColour: Record<string, string> = {
    user: 'bg-[#22D3EE]/10 text-[#22D3EE]',
    integrator: 'bg-[#A78BFA]/10 text-[#A78BFA]',
    builder: 'bg-[#FB7185]/10 text-[#FB7185]',
  }

  return (
    <div className="min-h-screen bg-[#060609]">
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .gradient-border-card {
          background: linear-gradient(#0d0d14, #0d0d14) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.12), rgba(139,92,246,0.12)) border-box;
          border: 1px solid transparent;
        }
        .card-hover:hover {
          background: linear-gradient(#0d0d14, #0d0d14) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.25), rgba(139,92,246,0.25)) border-box;
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.06) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Nav */}
      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-black text-xl tracking-tighter" style={{
            background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'gradientShift 5s ease infinite',
          }}>shapi</Link>
          <div className="flex items-center gap-6">
            <span className="text-white/30 text-sm">{companyName}</span>
            {!isPaid && (
              <Link href="/company/pricing"
                className="bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] text-[#060609] text-xs font-black px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                Upgrade
              </Link>
            )}
            <form action="/api/auth/signout" method="post">
              <button className="text-white/30 text-sm hover:text-white/60 transition-colors">Sign out</button>
            </form>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-10 pb-20">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">
            {count} verified candidate{count !== 1 ? 's' : ''}
          </h1>
          <p className="text-white/40 text-sm">
            {isPaid
              ? 'You have full access — view profiles, references, and contact directly.'
              : 'Subscribe to unlock full profiles and direct contact.'}
          </p>
        </div>

        {/* Paywall banner */}
        {!isPaid && count > 0 && (
          <div className="rounded-2xl p-6 mb-8 flex items-center justify-between gap-6"
            style={{ background: 'linear-gradient(135deg, #0891B2 0%, #7C3AED 100%)' }}>
            <div>
              <p className="text-white font-black text-lg mb-1">
                {count} verified profile{count !== 1 ? 's' : ''} ready to view
              </p>
              <p className="text-white/70 text-sm">
                Subscribe to unlock names, full profiles, WhatsApp conversations, and direct contact.
              </p>
            </div>
            <Link href="/company/pricing"
              className="bg-white text-[#060609] px-6 py-3 rounded-full font-black text-sm hover:opacity-90 transition-opacity flex-shrink-0">
              Unlock all →
            </Link>
          </div>
        )}

        {count === 0 ? (
          <div className="gradient-border-card rounded-2xl p-16 text-center flex flex-col items-center">
            <ShapiCharacter mood="idle" size={72} className="mb-6" />
            <p className="text-white/60 font-bold text-lg mb-2">No verified candidates yet</p>
            <p className="text-white/25 text-sm">We&apos;re onboarding candidates now — check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {(candidates as Candidate[]).map(c => {
              const hasDeepDive = Array.isArray(c.whatsapp_chat) && c.whatsapp_chat.length > 2
              return (
                <div key={c.id}
                  className="gradient-border-card card-hover rounded-2xl p-6 transition-all duration-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className={`font-black text-lg ${isPaid ? 'text-white' : 'text-white blur-sm select-none'}`}>
                          {isPaid ? (c.full_name || 'Candidate') : 'Verified Candidate'}
                        </h3>
                        {c.completion_pct >= 60 && (
                          <span className="bg-[#22D3EE]/10 text-[#22D3EE] text-xs font-bold px-2.5 py-1 rounded-full">
                            ✓ Verified
                          </span>
                        )}
                        {hasDeepDive && (
                          <span className="bg-[#A78BFA]/10 text-[#A78BFA] text-xs font-bold px-2.5 py-1 rounded-full">
                            Deep profile
                          </span>
                        )}
                        {c.ai_tier && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${aiTierColour[c.ai_tier] || 'bg-white/10 text-white/50'}`}>
                            AI {c.ai_tier}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mb-1 ${isPaid ? 'text-white/60' : 'text-white/60 blur-sm select-none'}`}>
                        {isPaid ? (c.headline || '—') : 'Senior Professional · 8+ years'}
                      </p>
                      {c.location && (
                        <p className={`text-xs mb-3 ${isPaid ? 'text-white/35' : 'text-white/35 blur-sm select-none'}`}>
                          📍 {isPaid ? c.location : 'Dubai, UAE'}
                        </p>
                      )}
                      {/* Skills */}
                      {c.skills && c.skills.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {c.skills.slice(0, 5).map((skill, i) => (
                            <span key={i} className="bg-white/[0.05] text-white/50 text-xs px-3 py-1 rounded-full">
                              {skill}
                            </span>
                          ))}
                          {c.skills.length > 5 && (
                            <span className="text-white/25 text-xs py-1">+{c.skills.length - 5} more</span>
                          )}
                        </div>
                      )}
                      {/* Summary preview */}
                      {isPaid && c.summary && (
                        <p className="text-white/35 text-xs leading-relaxed line-clamp-2">{c.summary}</p>
                      )}
                    </div>

                    {/* Right side */}
                    <div className="flex flex-col items-end gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-3xl font-black" style={{
                          background: 'linear-gradient(135deg, #22D3EE, #A78BFA)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}>{c.completion_pct}%</div>
                        <div className="text-white/25 text-xs">complete</div>
                      </div>
                      {isPaid && (
                        <Link href={`/candidates/${c.id}`}
                          className="bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] text-[#060609] text-xs font-black px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                          View profile →
                        </Link>
                      )}
                    </div>
                  </div>

                  {!isPaid && (
                    <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                      <p className="text-xs text-white/25">Subscribe to view full profile, references & contact</p>
                      <Link href="/company/pricing" className="text-xs text-[#22D3EE] font-bold hover:opacity-80">
                        Unlock →
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
