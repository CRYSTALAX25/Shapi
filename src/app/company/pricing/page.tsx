'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function CompanyPricing() {
  const [loading, setLoading] = useState<string | null>(null)

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
    <div className="min-h-screen bg-[#0E0E13]">
      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/company/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">← Dashboard</Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-12 pb-20">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tighter text-[#F4F4F7] mb-4">Unlock verified candidates</h1>
          <p className="text-[#A6A6B4] text-lg max-w-xl mx-auto">
            Every candidate is independently verified — work history, skills, and references. No CVs to sift through.
          </p>
          <p className="text-sm font-bold mt-5" style={{ color: '#6AA8F5' }}>★ 30-day free trial · Founding Partners get 50% off for 3 months</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Starter */}
          <div className="bg-[#16161F] rounded-2xl p-8" style={{ border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)' }}>
            <p className="text-sm font-bold text-[#7E7E8E] uppercase tracking-wider mb-2">Starter</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-[#F4F4F7]">$149</span>
              <span className="text-[#7E7E8E] mb-1">/month</span>
            </div>
            <p className="text-sm text-[#7E7E8E] mb-6"><span className="line-through">$299/mo</span> standard · founding rate, 3 mo</p>

            <div className="space-y-3 mb-8">
              {[
                'Up to 5 active job roles',
                'Unlimited verified candidate views',
                'Independent reference access',
                'AI skills verification badges',
                'Email support',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <svg className="w-4 h-4 flex-shrink-0 text-[#6AA8F5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  <p className="text-sm text-[#C7C7D1]">{item}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => checkout('starter')}
              disabled={loading === 'starter'}
              className="w-full py-4 rounded-full font-bold text-sm transition-all disabled:opacity-50"
              style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#F4F4F7' }}
            >
              {loading === 'starter' ? 'Redirecting...' : 'Start 30-day free trial →'}
            </button>
          </div>

          {/* Growth */}
          <div className="rounded-2xl p-8 relative overflow-hidden text-white" style={{ background: 'linear-gradient(160deg, #0E0E13, #0b1228 60%, #0e1a2e)', boxShadow: '0 20px 50px rgba(106,168,245,0.18)' }}>
            <div className="absolute top-4 right-4 text-white text-[10px] font-black px-3 py-1 rounded-full" style={{ background: 'linear-gradient(135deg,#6AA8F5,#4F8FE8)' }}>
              Most popular
            </div>
            <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: '#6AA8F5' }}>Growth</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-white">$399</span>
              <span className="text-white/50 mb-1">/month</span>
            </div>
            <p className="text-sm text-white/50 mb-6"><span className="line-through">$799/mo</span> standard · founding rate, 3 mo</p>

            <div className="space-y-3 mb-8">
              {[
                'Unlimited active job roles',
                'Priority candidate matching',
                'Dedicated account manager',
                'Company trust score dashboard',
                'Priority onboarding + support',
                'Custom enterprise integrations',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <svg className="w-4 h-4 flex-shrink-0 text-[#6AA8F5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  <p className="text-sm text-white/85">{item}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => checkout('growth')}
              disabled={loading === 'growth'}
              className="w-full py-4 rounded-full font-black text-sm transition-all disabled:opacity-50 text-white"
              style={{ background: 'linear-gradient(135deg, #6AA8F5, #4F8FE8)' }}
            >
              {loading === 'growth' ? 'Redirecting...' : 'Start 30-day free trial →'}
            </button>
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="bg-[#16161F] rounded-2xl p-8 text-center" style={{ border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)' }}>
          <p className="font-black text-[#F4F4F7] mb-2">Enterprise</p>
          <p className="text-[#A6A6B4] text-sm mb-4">
            Custom pricing for high-volume hiring, bulk verification, private API access, or white-label solutions.
          </p>
          <a href="mailto:hello@shapi.io?subject=Enterprise enquiry"
            className="inline-block px-6 py-3 rounded-full text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #6AA8F5, #4F8FE8)' }}>
            Talk to us →
          </a>
        </div>

        <p className="text-center text-xs text-[#7E7E8E] mt-6">
          Simple subscription — no placement fees, no per-hire costs. Cancel anytime.
        </p>
      </div>
    </div>
  )
}
