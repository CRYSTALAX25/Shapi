'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Preview = {
  before: string | null
  after: string | null
  has_whatsapp: boolean
  whatsapp_count?: number
  industry?: string
}

// The two one-time CV products. MUST mirror /api/stripe/cv-checkout PRODUCTS
// (kit $25 — or $9 blue-collar self-selected — / pro $59) — that route is the
// source of truth for what's charged; this object only controls what's
// displayed. The $9 blue-collar override lives in component state, not here.
const TIERS = {
  kit: {
    title: 'CV Kit — one-time',
    subtitle: 'Download instantly · yours to keep',
    price: '$25',
    cta: 'Unlock my enhanced CV — $25 →',
    features: [
      { icon: '✨', label: 'Enhanced CV — every version', sub: 'Your WhatsApp answers woven into every bullet point' },
      { icon: '🎯', label: 'Generate for any industry', sub: 'Tech, media, finance, hospitality — one click, re-framed' },
      { icon: '🌐', label: 'Native language version', sub: 'Croatian, Arabic, Tagalog — whatever you chose' },
      { icon: '📤', label: 'Send to your WhatsApp & email', sub: 'Open on any device, print to PDF instantly' },
      { icon: '✓', label: 'Verified profile badge', sub: 'Shapi-verified on your public profile' },
    ],
  },
  pro: {
    title: 'CV Pro — one-time',
    subtitle: 'Everything in the Kit + the deep-dive · yours to keep',
    price: '$59',
    cta: 'Unlock CV Pro — $59 →',
    features: [
      { icon: '✨', label: 'Everything in the CV Kit', sub: 'Enhanced CV, every industry + language version, WhatsApp & email delivery' },
      { icon: '💬', label: 'WhatsApp deep-dive interviews', sub: 'Targeted follow-ups that surface achievements you forgot to mention' },
      { icon: '🔗', label: 'Verification chain', sub: 'Every claim classified: Verified / Shapi-assessed / Self-reported' },
      { icon: '🧠', label: 'AI cross-check', sub: 'Claims sanity-checked against your real conversation' },
      { icon: '🗺️', label: 'Career Roadmap', sub: 'Where your profile is strong, what to fix next, and how' },
    ],
  },
} as const

type TierKey = keyof typeof TIERS

// useSearchParams() must live under a <Suspense> boundary in Next 16 —
// otherwise the whole page bails out of static prerendering and the build
// errors. The shell renders the page background as the fallback.
export default function Pay() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0E0E13]" />}>
      <PayInner />
    </Suspense>
  )
}

function PayInner() {
  const searchParams = useSearchParams()
  // Tier comes from the CV-builder gate: /pay?tier=kit | /pay?tier=pro.
  // Anything else (or nothing) falls back to the $25 Kit.
  const tier: TierKey = searchParams.get('tier') === 'pro' ? 'pro' : 'kit'
  const t = TIERS[tier]

  // v5.1 blue-collar Kit price — $9 self-selected, Kit only (never Pro).
  // Honest self-selection: toggling switches the displayed price and sends
  // blue_collar:true to cv-checkout, which charges 900 cents.
  const [blueCollar, setBlueCollar] = useState(false)
  const isBlueCollarKit = tier === 'kit' && blueCollar
  const displayPrice = isBlueCollarKit ? '$9' : t.price
  const displayCta = isBlueCollarKit ? 'Unlock my enhanced CV — $9 →' : t.cta

  const [loading, setLoading] = useState(false)
  const [payError, setPayError] = useState('')
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
    setPayError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    try {
      // Pass the chosen tier through so cv-checkout charges the right
      // product ($25 kit / $9 blue-collar kit / $59 pro) — it reads body.tier
      // and body.blue_collar.
      const res = await fetch('/api/stripe/cv-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isBlueCollarKit ? { tier, blue_collar: true } : { tier }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setPayError(data.error || `Couldn't start checkout (${res.status}). Please try again.`)
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setPayError('Network issue — check your connection and try again.')
      setLoading(false)
    }
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
          background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)',
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

        {/* What you get — driven by ?tier= so the price shown is the price charged */}
        <div className="gradient-border-card rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[#F4F4F7] font-black text-lg">
                {t.title}
                {tier === 'pro' && (
                  <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: '#F08CAE', background: 'rgba(240,140,174,0.12)', border: '1px solid rgba(240,140,174,0.35)' }}>
                    Most picked
                  </span>
                )}
              </p>
              <p className="text-[#7E7E8E] text-sm mt-1">{t.subtitle}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-[#F4F4F7]">{displayPrice}</p>
              <p className="text-[#7E7E8E] text-xs">one-time · no subscription</p>
            </div>
          </div>

          {/* v5.1 blue-collar self-select — Kit only. No proof asked, ever. */}
          {tier === 'kit' && (
            <button
              type="button"
              onClick={() => setBlueCollar(v => !v)}
              className="w-full mb-5 rounded-xl px-4 py-3 text-left text-xs transition-colors"
              style={{
                background: blueCollar ? 'rgba(52,211,153,0.10)' : 'rgba(255,255,255,0.04)',
                border: blueCollar ? '1px solid rgba(52,211,153,0.40)' : '1px solid rgba(255,255,255,0.10)',
              }}
            >
              <span className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-black"
                  style={{
                    background: blueCollar ? '#34D399' : 'transparent',
                    border: blueCollar ? '1px solid #34D399' : '1px solid rgba(255,255,255,0.25)',
                    color: '#0E0E13',
                  }}
                >
                  {blueCollar ? '✓' : ''}
                </span>
                <span>
                  <span className="block font-bold text-[#F4F4F7]">Hourly, trade or service worker? The Kit is $9 for you.</span>
                  <span className="block text-[#7E7E8E] mt-0.5">
                    {blueCollar
                      ? 'Blue-collar price applied — you pay $9, same full Kit.'
                      : 'Tap to apply the $9 blue-collar price. We trust you — no proof needed.'}
                  </span>
                </span>
              </span>
            </button>
          )}

          <div className="space-y-3 mb-6">
            {t.features.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-base flex-shrink-0 w-6 text-center">{item.icon}</span>
                <div>
                  <p className="text-[#F4F4F7] text-sm font-bold">{item.label}</p>
                  <p className="text-[#7E7E8E] text-xs">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {payError && (
            <div className="mb-4 rounded-xl px-4 py-3 text-xs text-[#F58E9A]" style={{ background: 'rgba(245,142,154,0.10)', border: '1px solid rgba(245,142,154,0.25)' }}>
              {payError}
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full py-4 rounded-full font-black text-sm transition-opacity disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)', color: '#fff' }}
          >
            {loading ? 'Redirecting to payment…' : displayCta}
          </button>

          {/* Tier switch — keep both prices one tap away */}
          <p className="text-center text-xs text-[#7E7E8E] mt-3">
            {tier === 'kit' ? (
              <>Want the deep-dive + verification chain?{' '}
                <Link href="/pay?tier=pro" className="text-[#F08CAE] font-bold hover:underline">CV Pro — $59 →</Link></>
            ) : (
              <>Just the enhanced CV?{' '}
                <Link href="/pay?tier=kit" className="text-[#6AA8F5] font-bold hover:underline">CV Kit — $25 →</Link></>
            )}
          </p>

          <p className="text-center text-xs text-[#5C5C6A] mt-4">
            Secure payment via Stripe · 30-day money-back guarantee
          </p>
        </div>

        <p className="text-center text-xs text-[#5C5C6A]">
          Are you a company?{' '}
          <a href="/signup" className="text-[#6AA8F5] hover:underline">Start your 14-day free trial →</a>
        </p>
      </div>
    </div>
  )
}
