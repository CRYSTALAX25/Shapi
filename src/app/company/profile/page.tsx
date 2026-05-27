// Company profile — the view-only "this is how candidates see you" page.
// Sidebar "Company profile" lands here (not on the onboarding form, which is
// for setup / editing). The Company Intelligence card that used to clutter
// the dashboard now lives here, where it belongs.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function CompanyProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, type, company_name, company_data, company_size, company_website, location, summary, industry, onboarding_complete, paid, subscription_status, subscription_tier')
    .eq('id', user.id)
    .single()

  if (!profile || profile.type !== 'company') redirect('/dashboard')

  const companyName = profile.company_name || profile.full_name || 'Your company'
  const cd = (profile.company_data || {}) as Record<string, unknown>
  const cardStyle = { background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }

  return (
    <div className="min-h-screen bg-[#0E0E13]">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/company/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">← Dashboard</Link>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-2" style={{ color: '#FB7185' }}>Company profile</h1>
            <p className="text-[#A6A6B4] text-sm max-w-xl">How candidates see you. A complete + transparent profile builds the trust signal that pulls verified candidates to your roles.</p>
          </div>
          <Link href="/company/onboarding" className="flex-shrink-0 px-5 py-2.5 rounded-full font-black text-xs text-white whitespace-nowrap" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
            Edit profile
          </Link>
        </div>

        {!profile.onboarding_complete && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <p className="text-[#FBBF24] font-bold mb-1">Finish your company setup</p>
            <p className="text-[#A6A6B4] text-sm mb-3">Your profile isn&apos;t complete yet. Verified candidates trust complete profiles more — and the trust signal directly drives candidate flow to your roles.</p>
            <Link href="/company/onboarding" className="inline-block text-[#FBBF24] text-xs font-bold border border-[#FBBF24]/40 px-3 py-1.5 rounded-full hover:border-[#FBBF24]/70 transition-colors">Complete setup →</Link>
          </div>
        )}

        {/* Basics */}
        <div className="rounded-2xl p-6 mb-4" style={cardStyle}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-3">Basics</p>
          <h2 className="text-2xl font-black text-[#F4F4F7] mb-5">{companyName}</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Industry" value={(profile.industry as string) || (cd.industry as string | undefined) || null} />
            <Field label="Size" value={profile.company_size || (cd.size as string | undefined) || null} />
            <Field label="Location" value={profile.location || (cd.headquarters as string | undefined) || null} />
            <Field label="Website" value={profile.company_website} link />
          </div>

          {profile.summary && (
            <div className="mt-5 pt-5 border-t border-white/[0.06]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-2">About</p>
              <p className="text-[#C7C7D1] text-sm leading-relaxed">{profile.summary as string}</p>
            </div>
          )}

          {cd.description ? (
            <div className="mt-5 pt-5 border-t border-white/[0.06]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-2">Enriched description</p>
              <p className="text-[#A6A6B4] text-sm leading-relaxed">{cd.description as string}</p>
            </div>
          ) : null}
        </div>

        {/* Public signals — was on the dashboard, lives here now */}
        {(cd.glassdoor_rating || cd.reddit_sentiment) && (
          <div className="rounded-2xl p-6 mb-4" style={cardStyle}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-3">Public signals</p>
            <div className="flex flex-wrap gap-3">
              {!!cd.glassdoor_rating && (
                <div className="bg-[#6AA8F5]/10 rounded-xl px-4 py-3 text-center min-w-[100px]">
                  <p className="text-2xl font-black text-[#6AA8F5]">{String(cd.glassdoor_rating)}</p>
                  <p className="text-[10px] text-[#7E7E8E]">Glassdoor</p>
                </div>
              )}
              {!!cd.reddit_sentiment && (
                <div className={`rounded-xl px-4 py-3 text-center min-w-[100px] ${
                  cd.reddit_sentiment === 'positive' ? 'bg-[#34D399]/15' :
                  cd.reddit_sentiment === 'negative' ? 'bg-[#F58E9A]/15' :
                  'bg-[#FBBF24]/15'
                }`}>
                  <p className={`text-base font-black capitalize ${
                    cd.reddit_sentiment === 'positive' ? 'text-[#34D399]' :
                    cd.reddit_sentiment === 'negative' ? 'text-[#F58E9A]' :
                    'text-[#FBBF24]'
                  }`}>{String(cd.reddit_sentiment)}</p>
                  <p className="text-[10px] text-[#7E7E8E]">Reddit sentiment</p>
                </div>
              )}
            </div>
            <p className="text-[#7E7E8E] text-[10px] mt-3">Synthesised from Glassdoor public ratings · Reddit public mentions · enrichment APIs.</p>
          </div>
        )}

        {/* Plan / billing */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-2">Plan</p>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[#F4F4F7] text-base font-black">
                {profile.paid && profile.subscription_status === 'active'
                  ? `${profile.subscription_tier ? String(profile.subscription_tier).charAt(0).toUpperCase() + String(profile.subscription_tier).slice(1) : 'Active'} · subscribed`
                  : 'Trial / unpaid'}
              </p>
              <p className="text-[#A6A6B4] text-xs mt-0.5">{profile.subscription_status === 'active' ? 'Full access — view profiles, contact candidates directly.' : 'Subscribe to unlock names, full profiles, and direct contact.'}</p>
            </div>
            <Link href="/company/pricing" className="flex-shrink-0 text-[#6AA8F5] text-xs font-bold border border-[#6AA8F5]/30 hover:border-[#6AA8F5]/60 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap">View plans →</Link>
          </div>
        </div>

      </div>
    </div>
  )
}

function Field({ label, value, link }: { label: string; value: string | null | undefined; link?: boolean }) {
  if (!value) {
    return (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-1">{label}</p>
        <p className="text-[#7E7E8E] text-sm italic">— not set</p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-1">{label}</p>
      {link
        ? <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-[#6AA8F5] text-sm hover:underline break-all">{value}</a>
        : <p className="text-[#F4F4F7] text-sm">{value}</p>}
    </div>
  )
}
