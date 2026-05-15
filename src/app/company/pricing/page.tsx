'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CompanyPricing() {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  const checkout = async (tier: string) => {
    setLoading(tier)
    const res = await fetch('/api/stripe/company-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setLoading(null)
  }

  return (
    <div className="min-h-screen bg-[#F8F4EE]">
      <nav className="px-6 py-5 flex items-center justify-between max-w-5xl mx-auto border-b border-[#1C1C2E]/5">
        <span className="text-[#0B5563] font-bold text-2xl tracking-tight">shapi</span>
        <button onClick={() => router.push('/dashboard')} className="text-sm text-[#1C1C2E]/50 hover:text-[#1C1C2E]">
          ← Back
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-12 pb-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#1C1C2E] mb-4">Unlock verified candidates</h1>
          <p className="text-[#1C1C2E]/60 text-lg max-w-xl mx-auto">
            Every candidate is independently verified — work history, skills, and references. No CVs to sift through.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Starter */}
          <div className="bg-white rounded-2xl p-8 border border-[#1C1C2E]/10 shadow-sm">
            <p className="text-sm font-medium text-[#1C1C2E]/50 mb-2">Starter</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold text-[#1C1C2E]">$299</span>
              <span className="text-[#1C1C2E]/40 mb-1">/month</span>
            </div>
            <p className="text-sm text-[#1C1C2E]/50 mb-6">Cancel anytime</p>

            <div className="space-y-3 mb-8">
              {[
                'Up to 5 active job roles',
                'Unlimited verified candidate views',
                'Independent reference access',
                'AI skills verification badges',
                'Email support',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#0B5563]/10 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-[#0B5563]" />
                  </div>
                  <p className="text-sm text-[#1C1C2E]/70">{item}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => checkout('starter')}
              disabled={loading === 'starter'}
              className="w-full bg-[#0B5563] text-white py-4 rounded-full font-semibold text-sm hover:bg-[#094450] transition-colors disabled:opacity-50"
            >
              {loading === 'starter' ? 'Redirecting...' : 'Start hiring — $299/mo →'}
            </button>
          </div>

          {/* Growth */}
          <div className="bg-[#0B5563] rounded-2xl p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-[#E8745A] text-white text-xs font-semibold px-3 py-1 rounded-full">
              Most popular
            </div>
            <p className="text-sm font-medium text-white/60 mb-2">Growth</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold text-white">$799</span>
              <span className="text-white/50 mb-1">/month</span>
            </div>
            <p className="text-sm text-white/50 mb-6">Cancel anytime</p>

            <div className="space-y-3 mb-8">
              {[
                'Unlimited active job roles',
                'Priority candidate matching',
                'Dedicated account manager',
                'Company trust score dashboard',
                'Placement fee waiver on first hire',
                'Custom enterprise integrations',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <p className="text-sm text-white/80">{item}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => checkout('growth')}
              disabled={loading === 'growth'}
              className="w-full bg-white text-[#0B5563] py-4 rounded-full font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {loading === 'growth' ? 'Redirecting...' : 'Start hiring — $799/mo →'}
            </button>
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="bg-white rounded-2xl p-8 border border-[#1C1C2E]/10 text-center">
          <p className="font-semibold text-[#1C1C2E] mb-2">Enterprise</p>
          <p className="text-[#1C1C2E]/60 text-sm mb-4">
            Custom pricing for high-volume hiring, bulk verification, or white-label solutions.
          </p>
          <a href="mailto:hello@shapi.io?subject=Enterprise enquiry"
            className="inline-block border border-[#0B5563] text-[#0B5563] px-6 py-3 rounded-full text-sm font-medium hover:bg-[#0B5563] hover:text-white transition-colors">
            Talk to us →
          </a>
        </div>

        <p className="text-center text-xs text-[#1C1C2E]/40 mt-6">
          A $500 placement fee applies per successful hire after 30 days in role. Included in Growth plan first hire.
        </p>
      </div>
    </div>
  )
}
