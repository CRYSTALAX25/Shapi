'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Preview = {
  before: string | null
  after: string | null
  has_whatsapp: boolean
  whatsapp_count?: number
  industry?: string
}

export default function Pay() {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [firstName, setFirstName] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      const name = user.user_metadata?.full_name || ''
      setFirstName(name.split(' ')[0] || '')
    })

    fetch('/api/cv/preview')
      .then(r => r.json())
      .then(d => setPreview(d))
      .catch(() => {})
      .finally(() => setLoadingPreview(false))
  }, [router])

  const handlePay = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const res = await fetch('/api/stripe/cv-checkout', {
      method: 'POST',
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#060609]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#0d0d14, #0d0d14) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.15), rgba(139,92,246,0.15)) border-box;
          border: 1px solid transparent;
        }
        .shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 6px;
          height: 12px;
          margin-bottom: 8px;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.07) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-2xl mx-auto border-b border-white/[0.05]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <Link href="/dashboard" className="text-white/30 text-sm hover:text-white/60 transition-colors">← Dashboard</Link>
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-20">

        {/* Headline */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-white mb-3">
            {firstName ? `${firstName}, see what Shapi did to your CV.` : 'See what Shapi did to your CV.'}
          </h1>
          <p className="text-white/40 text-sm leading-relaxed max-w-md mx-auto">
            Below is the difference between your uploaded CV and what Shapi produces — enriched with your WhatsApp conversation, industry-optimised, in your language.
          </p>
        </div>

        {/* Before / After */}
        <div className="gradient-border-card rounded-2xl p-5 mb-6">
          <p className="text-white/35 text-xs font-bold uppercase tracking-wider mb-4">
            Your profile summary — before & after
            {preview?.industry && <span className="text-white/20 ml-2 normal-case font-normal capitalize">{preview.industry}-optimised</span>}
          </p>

          <div className="flex gap-3">
            {/* Before */}
            <div className="flex-1 bg-white/[0.025] border border-white/[0.07] rounded-xl p-4">
              <p className="text-white/20 text-[10px] font-bold uppercase tracking-wider mb-3">Before — your upload</p>
              {loadingPreview ? (
                <><div className="shimmer w-full" /><div className="shimmer w-4/5" /><div className="shimmer w-3/5" /></>
              ) : (
                <p className="text-white/35 text-xs leading-relaxed italic">
                  &ldquo;{preview?.before
                    ? preview.before.slice(0, 200) + (preview.before.length > 200 ? '…' : '')
                    : 'Basic work history — job titles, companies, dates. No specific achievements or metrics.'}
                  &rdquo;
                </p>
              )}
            </div>

            <div className="flex items-center flex-shrink-0 px-1">
              <span style={{ background: 'linear-gradient(135deg, #22D3EE, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontSize: 20, fontWeight: 900 }}>→</span>
            </div>

            {/* After — blurred until paid */}
            <div className="flex-1 relative rounded-xl overflow-hidden" style={{
              background: 'linear-gradient(135deg, rgba(34,211,238,0.06), rgba(167,139,250,0.06))',
              border: '1px solid rgba(34,211,238,0.2)',
              padding: '16px',
            }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#22D3EE', opacity: 0.7 }}>After — Shapi-enhanced</p>
              {loadingPreview ? (
                <><div className="shimmer w-full" /><div className="shimmer w-11/12" /><div className="shimmer w-3/4" /></>
              ) : preview?.after ? (
                <>
                  {/* First sentence visible, rest blurred */}
                  <p className="text-white/80 text-xs leading-relaxed">
                    {preview.after.split('.')[0] + '.'}
                  </p>
                  <div className="relative mt-2">
                    <p className="text-white/80 text-xs leading-relaxed blur-sm select-none">
                      {preview.after.split('.').slice(1).join('.').trim() || 'Enhanced with specific achievements, metrics, and real stories from your WhatsApp conversation.'}
                    </p>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white/40 bg-[#0d0d14]/80 px-3 py-1 rounded-full">Unlock to see full version</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-white/45 text-xs leading-relaxed">
                  Enhanced with specific achievements, metrics, and real stories from your WhatsApp conversation — woven into every bullet point.
                </p>
              )}
            </div>
          </div>

          {preview?.whatsapp_count && (
            <p className="text-white/20 text-[10px] mt-3 text-center">
              Built from {preview.whatsapp_count} WhatsApp message{preview.whatsapp_count !== 1 ? 's' : ''} · Full CV has all sections enriched, not just the summary
            </p>
          )}
        </div>

        {/* What you get */}
        <div className="gradient-border-card rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-white font-black text-lg">CV Kit — one-time</p>
              <p className="text-white/35 text-sm mt-1">Download instantly · yours to keep</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-white">$29</p>
              <p className="text-white/30 text-xs">one-time · no subscription</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {[
              { icon: '✨', label: 'Enhanced CV — every version', sub: 'Your WhatsApp answers woven into every bullet point' },
              { icon: '🎯', label: 'Generate for any industry', sub: 'Tech, media, finance, hospitality — one click, re-framed' },
              { icon: '🌐', label: 'Native language version', sub: 'Croatian, Arabic, Tagalog — whatever you chose' },
              { icon: '📤', label: 'Send to your WhatsApp & email', sub: 'Open on any device, print to PDF instantly' },
              { icon: '✓', label: 'Verified profile badge', sub: 'Shapi-verified on your public profile' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-base flex-shrink-0 w-6 text-center">{item.icon}</span>
                <div>
                  <p className="text-white/80 text-sm font-bold">{item.label}</p>
                  <p className="text-white/30 text-xs">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full py-4 rounded-full font-black text-sm transition-opacity disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #22D3EE, #A78BFA)', color: '#060609' }}
          >
            {loading ? 'Redirecting to payment…' : 'Unlock my enhanced CV — $29 →'}
          </button>

          <p className="text-center text-xs text-white/20 mt-4">
            Secure payment via Stripe · 30-day money-back guarantee
          </p>
        </div>

        <p className="text-center text-xs text-white/20">
          Are you a company?{' '}
          <a href="/company/signup" className="text-[#22D3EE] hover:underline">Start your 60-day free trial →</a>
        </p>
      </div>
    </div>
  )
}
