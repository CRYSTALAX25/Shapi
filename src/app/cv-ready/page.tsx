import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function CVReady() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('cv_kit_purchased, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.cv_kit_purchased) redirect('/profile')

  return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center px-6">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#0d0d14, #0d0d14) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.2), rgba(139,92,246,0.2)) border-box;
          border: 1px solid transparent;
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.08) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />
      <div className="relative z-10 max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{ background: 'radial-gradient(circle at 40% 35%, #67E8F9, #A78BFA, #7C3AED)' }}>
          <span className="text-3xl">✨</span>
        </div>
        <h1 className="text-3xl font-black text-white mb-3">Your CV Kit is ready.</h1>
        <p className="text-white/50 text-sm leading-relaxed mb-8">
          Download your English CV or your native language version below. Both are yours to keep and use anywhere.
        </p>
        <div className="gradient-border-card rounded-2xl p-6 mb-6 text-left space-y-3">
          <a href="/profile/print" target="_blank"
            className="flex items-center justify-between p-4 bg-white/[0.04] rounded-xl hover:bg-white/[0.08] transition-colors group">
            <div>
              <p className="text-white font-bold text-sm">English CV</p>
              <p className="text-white/40 text-xs">Professional, industry-tailored format</p>
            </div>
            <span className="text-[#22D3EE] text-sm font-bold group-hover:translate-x-1 transition-transform">↓ PDF</span>
          </a>
          <a href="/profile/print?lang=native" target="_blank"
            className="flex items-center justify-between p-4 bg-white/[0.04] rounded-xl hover:bg-white/[0.08] transition-colors group">
            <div>
              <p className="text-white font-bold text-sm">Native language CV</p>
              <p className="text-white/40 text-xs">Auto-translated · same format, your language</p>
            </div>
            <span className="text-[#A78BFA] text-sm font-bold group-hover:translate-x-1 transition-transform">↓ PDF</span>
          </a>
        </div>
        <div className="gradient-border-card rounded-2xl p-5 mb-6 text-left">
          <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-1">Also included</p>
          <p className="text-white text-sm font-semibold">Shareable profile link</p>
          <div className="mt-2">
            <code className="text-[#22D3EE] text-xs bg-white/[0.05] px-3 py-1.5 rounded-lg">
              shapi.io/p/{user.id.slice(0, 8)}
            </code>
          </div>
        </div>
        <Link href="/profile" className="text-white/30 text-sm hover:text-white/60 transition-colors">
          View full profile →
        </Link>
      </div>
    </div>
  )
}
