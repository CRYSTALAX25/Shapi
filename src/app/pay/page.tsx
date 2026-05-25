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
    <div className="min-h-screen bg-[#0E0E13]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.15), rgba(240,140,174,0.15)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
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
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-2xl mx-auto border-b border-[rgba(255,255,255,0.08)]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #F08CAE, #6AA8F5)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <Link href="/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">← Dashboard</Link>
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-20">

        {/* Headline */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-[#F4F4F7] mb-3">
            {firstName ? `${firstName}, see what Shapi did to your CV.` : 'See what Shapi did to your CV.'}
          </h1>
          <p className="text-[#A6A6B4] text-sm leading-relaxed max-w-md mx-auto">
            Below is the difference between your uploaded CV and what Shapi produces — enriched with your WhatsApp conversation, industry-optimised, in your language.
          </p>
        </div>

        {/* Before / After */}
        <div className="gradient-border-card rounded-2xl p-5 mb-6">
          <p className="text-[#7E7E8E] text-xs font-bold uppercase tracking-wider mb-4">
            Your profile summary — before & after
            {preview?.industry && <span className="text-[#5C5C6A] ml-2 normal-case font-normal capitalize">{preview.industry}-optimised</span>}
          </p>

          <div className="flex gap-3">
            {/* Before */}
            <div className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-xl p-4">
              <p className="text-[#5C5C6A] text-[10px] font-bold uppercase tracking-wider mb-3">Before — your upload</p>
              {loadingPreview ? (
                <><div className="shimmer w-full" /><div className="shimmer w-4/5" /><div className="shimmer w-3/5" /></>
              ) : (
                <p className="text-[#7E7E8E] text-xs leading-relaxed italic">
                  &ldquo;{preview?.before
                    ? preview.before.slice(0, 200) + (preview.before.length > 200 ? '…' : '')
                    : 'Basic work history — job titles, companies, dates. No specific achievements or metrics.'}
                  &rdquo;
                </p>
              )}
            </div>

            <div className="flex items-center flex-shrink-0 px-1">
              <span style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontSize: 20, fontWeight: 900 }}>→</span>
            </div>

            {/* After — blurred until paid */}
            <div className="flex-1 relative rounded-xl overflow-hidden" style={{
              background: 'linear-gradient(135deg, rgba(106,168,245,0.06), rgba(240,140,174,0.06))',
              border: '1px solid rgba(106,168,245,0.2)',
              padding: '16px',
            }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#6AA8F5', opacity: 0.7 }}>After — Shapi-enhanced</p>
              {loadingPreview ? (
                <><div className="shimmer w-full" /><div className="shimmer w-11/12" /><div className="shimmer w-3/4" /></>
              ) : preview?.after ? (
                <>
                  {/* First sentence visible, rest blurred */}
                  <p className="text-[#F4F4F7] text-xs leading-relaxed">
                    {preview.after.split('.')[0] + '.'}
                  </p>
                  <div className="relative mt-2">
                    <p className="text-[#F4F4F7] text-xs leading-relaxed blur-sm select-none">
                      {preview.after.split('.').slice(1).join('.').trim() || 'Enhanced with specific achievements, metrics, and real stories from your WhatsApp conversation.'}
                    </p>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-[#A6A6B4] bg-[#16161F]/80 px-3 py-1 rounded-full">Unlock to see full version</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-[#A6A6B4] text-xs leading-relaxed">
                  Enhanced with specific achievements, metrics, and real stories from your WhatsApp conversation — woven into every bullet point.
                </p>
              )}
            </div>
          </div>

          {preview?.whatsapp_count && (
            <p className="text-[#5C5C6A] text-[10px] mt-3 text-center">
              Built from {preview.whatsapp_count} WhatsApp message{preview.whatsapp_count !== 1 ? 's' : ''} · Full CV has all sections enriched, not just the summary
            </p>
          )}
        </div>

        {/* What you get */}
        <div className="gradient-border-card rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[#F4F4F7] font-black text-lg">CV Kit — one-time</p>
              <p className="text-[#7E7E8E] text-sm mt-1">Download instantly · yours to keep</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-[#F4F4F7]">$25</p>
              <p className="text-[#7E7E8E] text-xs">one-time · no subscription</p>
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
                  <p className="text-[#F4F4F7] text-sm font-bold">{item.label}</p>
                  <p className="text-[#7E7E8E] text-xs">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full py-4 rounded-full font-black text-sm transition-opacity disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)', color: '#fff' }}
          >
            {loading ? 'Redirecting to payment…' : 'Unlock my enhanced CV — $25 →'}
          </button>

          <p className="text-center text-xs text-[#5C5C6A] mt-4">
            Secure payment via Stripe · 30-day money-back guarantee
          </p>
        </div>

        <p className="text-center text-xs text-[#5C5C6A]">
          Are you a company?{' '}
          <a href="/signup" className="text-[#6AA8F5] hover:underline">Start your 60-day free trial →</a>
        </p>
      </div>
    </div>
  )
}
