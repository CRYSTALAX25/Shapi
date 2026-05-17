import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function CVReady() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('cv_kit_purchased, full_name, summary, whatsapp_chat, skills, industry')
    .eq('id', user.id)
    .single()

  if (!profile?.cv_kit_purchased) redirect('/profile')

  const firstName = (profile.full_name as string)?.split(' ')[0] || 'there'
  const rawSummary = profile.summary as string | null
  const whatsappChat = Array.isArray(profile.whatsapp_chat) ? profile.whatsapp_chat as Array<{ role: string; content: string }> : []
  const hasWhatsApp = whatsappChat.filter(m => m.role === 'user').length > 0
  const industry = (profile.industry as string) || null

  // Build a short "what Shapi added" example from whatsapp answers
  const userAnswers = whatsappChat.filter(m => m.role === 'user').map(m => m.content)
  const sampleAnswer = userAnswers.find(a => a.length > 40) || null

  return (
    <div className="min-h-screen bg-[#060609]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#0d0d14, #0d0d14) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.15), rgba(139,92,246,0.15)) border-box;
          border: 1px solid transparent;
        }
        .before-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 16px;
        }
        .after-card {
          background: linear-gradient(135deg, rgba(34,211,238,0.05), rgba(167,139,250,0.05));
          border: 1px solid rgba(34,211,238,0.2);
          border-radius: 12px;
          padding: 16px;
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.07) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.06]">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-black text-xl tracking-tighter" style={{
            background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>shapi</Link>
          <Link href="/dashboard" className="text-white/30 text-sm hover:text-white/60">Dashboard →</Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-20">

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'radial-gradient(circle at 40% 35%, #67E8F9, #A78BFA, #7C3AED)' }}>
            <span className="text-2xl">✨</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">{firstName}, your CV Kit is ready.</h1>
          <p className="text-white/40 text-sm leading-relaxed max-w-sm mx-auto">
            Two versions — English and native language — both enriched with your WhatsApp conversation. Yours to keep.
          </p>
        </div>

        {/* Downloads */}
        <div className="gradient-border-card rounded-2xl p-5 mb-6 space-y-3">
          <p className="text-white/35 text-xs font-bold uppercase tracking-wider mb-1">Download your CVs</p>

          <a href="/profile/print" target="_blank"
            className="flex items-center justify-between p-4 bg-white/[0.04] rounded-xl hover:bg-white/[0.07] transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#22D3EE]/10 flex items-center justify-center text-lg">🇬🇧</div>
              <div>
                <p className="text-white font-bold text-sm">English CV</p>
                <p className="text-white/35 text-xs">
                  {industry ? `${industry.charAt(0).toUpperCase() + industry.slice(1)}-optimised` : 'Industry-tailored'} · ATS-friendly · print to PDF
                </p>
              </div>
            </div>
            <span className="text-[#22D3EE] text-sm font-bold group-hover:translate-x-1 transition-transform">↓ PDF</span>
          </a>

          <a href="/profile/print?lang=native" target="_blank"
            className="flex items-center justify-between p-4 bg-white/[0.04] rounded-xl hover:bg-white/[0.07] transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#A78BFA]/10 flex items-center justify-center text-lg">🌐</div>
              <div>
                <p className="text-white font-bold text-sm">Native language CV</p>
                <p className="text-white/35 text-xs">Auto-translated · same format · review before sending</p>
              </div>
            </div>
            <span className="text-[#A78BFA] text-sm font-bold group-hover:translate-x-1 transition-transform">↓ PDF</span>
          </a>
        </div>

        {/* What Shapi added — before/after */}
        {hasWhatsApp && (
          <div className="gradient-border-card rounded-2xl p-5 mb-6">
            <p className="text-white/35 text-xs font-bold uppercase tracking-wider mb-4">What Shapi added to your CV</p>

            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              <div className="before-card">
                <p className="text-white/25 text-[10px] font-bold uppercase tracking-wider mb-2">Before — from your upload</p>
                <p className="text-white/40 text-xs leading-relaxed line-clamp-4">
                  {rawSummary
                    ? rawSummary.slice(0, 200) + (rawSummary.length > 200 ? '…' : '')
                    : 'Basic work history — titles, companies, dates.'}
                </p>
              </div>
              <div className="after-card">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#22D3EE' }}>After — Shapi-enhanced</p>
                <p className="text-white/70 text-xs leading-relaxed">
                  Same CV, enriched with your specific stories, numbers, and achievements from the WhatsApp conversation. Industry-formatted.
                </p>
              </div>
            </div>

            {sampleAnswer && (
              <div className="bg-white/[0.03] rounded-xl p-4">
                <p className="text-white/25 text-[10px] uppercase tracking-wider mb-2">From your WhatsApp — woven into the CV</p>
                <p className="text-white/55 text-xs leading-relaxed italic">
                  &ldquo;{sampleAnswer.slice(0, 180)}{sampleAnswer.length > 180 ? '…' : ''}&rdquo;
                </p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Messages analysed', value: String(userAnswers.length) },
                { label: 'Format', value: industry ? industry.charAt(0).toUpperCase() + industry.slice(1) : 'General' },
                { label: 'Languages', value: '2' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-lg font-black" style={{
                    background: 'linear-gradient(135deg, #22D3EE, #A78BFA)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}>{stat.value}</div>
                  <div className="text-white/25 text-[10px]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shareable profile link */}
        <div className="gradient-border-card rounded-2xl p-5 mb-8">
          <p className="text-white/35 text-xs font-bold uppercase tracking-wider mb-3">Your shareable profile</p>
          <p className="text-white/50 text-xs leading-relaxed mb-3">
            Send this link to hiring managers directly. It shows your full verified profile — no login required for them.
          </p>
          <div className="flex items-center gap-3 bg-white/[0.04] rounded-xl px-4 py-3">
            <code className="text-[#22D3EE] text-sm font-bold flex-1">
              shapi.io/p/{user.id.slice(0, 8)}
            </code>
            <a href={`/p/${user.id.slice(0, 8)}`} target="_blank"
              className="text-white/30 text-xs hover:text-white/60 flex-shrink-0">Preview →</a>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/profile"
            className="flex-1 text-center py-3 text-sm text-white/30 hover:text-white/60 transition-colors">
            View full profile →
          </Link>
          <Link href="/dashboard"
            className="flex-1 text-center bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] py-3 rounded-full font-black text-sm text-[#060609] hover:opacity-90 transition-opacity">
            Dashboard →
          </Link>
        </div>

      </div>
    </div>
  )
}
