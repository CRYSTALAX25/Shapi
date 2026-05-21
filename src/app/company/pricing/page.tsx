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
    <div className="min-h-screen bg-white">
      <nav className="px-6 py-5 flex items-center justify-between max-w-5xl mx-auto border-b border-[#0E0E1A]/[0.08]">
        <span className="font-black text-2xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</span>
        <button onClick={() => router.push('/dashboard')} className="text-sm text-[#5A5A6E] hover:text-[#0E0E1A]">
          ← Back
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-12 pb-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black tracking-tighter text-[#0E0E1A] mb-4">Unlock verified candidates</h1>
          <p className="text-[#5A5A6E] text-lg max-w-xl mx-auto">
            Every candidate is independently verified — work history, skills, and references. No CVs to sift through.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Starter */}
          <div className="bg-white rounded-2xl p-8" style={{ border: '1px solid rgba(14,14,26,0.08)', boxShadow: '0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05)' }}>
            <p className="text-sm font-bold text-[#8A8A99] uppercase tracking-wider mb-2">Starter</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-[#0E0E1A]">$299</span>
              <span className="text-[#8A8A99] mb-1">/month</span>
            </div>
            <p className="text-sm text-[#8A8A99] mb-6">Cancel anytime</p>

            <div className="space-y-3 mb-8">
              {[
                'Up to 5 active job roles',
                'Unlimited verified candidate views',
                'Independent reference access',
                'AI skills verification badges',
                'Email support',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <svg className="w-4 h-4 flex-shrink-0 text-[#06B6D4]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  <p className="text-sm text-[#3F3F4E]">{item}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => checkout('starter')}
              disabled={loading === 'starter'}
              className="w-full py-4 rounded-full font-bold text-sm transition-all disabled:opacity-50"
              style={{ border: '1px solid rgba(14,14,26,0.12)', color: '#0E0E1A' }}
            >
              {loading === 'starter' ? 'Redirecting...' : 'Start hiring — $299/mo →'}
            </button>
          </div>

          {/* Growth */}
          <div className="rounded-2xl p-8 relative overflow-hidden text-white" style={{ background: 'linear-gradient(160deg, #0E0E1A, #2A1759 60%, #0E2B33)', boxShadow: '0 20px 50px rgba(124,58,237,0.25)' }}>
            <div className="absolute top-4 right-4 text-white text-[10px] font-black px-3 py-1 rounded-full" style={{ background: 'linear-gradient(135deg,#06B6D4,#7C3AED)' }}>
              Most popular
            </div>
            <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: '#67E8F9' }}>Growth</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-white">$799</span>
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
                  <svg className="w-4 h-4 flex-shrink-0 text-[#34D399]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  <p className="text-sm text-white/85">{item}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => checkout('growth')}
              disabled={loading === 'growth'}
              className="w-full py-4 rounded-full font-black text-sm transition-all disabled:opacity-50 text-white"
              style={{ background: 'linear-gradient(135deg, #06B6D4, #7C3AED)' }}
            >
              {loading === 'growth' ? 'Redirecting...' : 'Start hiring — $799/mo →'}
            </button>
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="bg-white rounded-2xl p-8 text-center" style={{ border: '1px solid rgba(14,14,26,0.08)', boxShadow: '0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05)' }}>
          <p className="font-black text-[#0E0E1A] mb-2">Enterprise</p>
          <p className="text-[#5A5A6E] text-sm mb-4">
            Custom pricing for high-volume hiring, bulk verification, private API access, or white-label solutions.
          </p>
          <a href="mailto:hello@shapi.io?subject=Enterprise enquiry"
            className="inline-block px-6 py-3 rounded-full text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #06B6D4, #7C3AED)' }}>
            Talk to us →
          </a>
        </div>

        <p className="text-center text-xs text-[#8A8A99] mt-6">
          A $500 placement fee applies per successful hire after 30 days in role. Included in Growth plan first hire.
        </p>
      </div>
    </div>
  )
}
