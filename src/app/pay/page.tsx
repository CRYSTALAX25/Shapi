'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Pay() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handlePay = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const type = user.user_metadata?.type || 'candidate'

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })

    const { url } = await res.json()
    if (url) window.location.href = url
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F8F4EE] flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <span className="text-[#0B5563] font-bold text-2xl tracking-tight">shapi</span>
          <h1 className="text-2xl font-bold text-[#1C1C2E] mt-6 mb-2">One step before your profile</h1>
          <p className="text-[#1C1C2E]/60 text-sm">Your verified profile is a one-time fee. No subscription. Live until you&apos;re hired.</p>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-[#1C1C2E]/10 shadow-sm mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="font-bold text-[#1C1C2E] text-lg">Verified Candidate Profile</p>
              <p className="text-[#1C1C2E]/50 text-sm mt-1">One-time · Live until hired</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-[#0B5563]">$49</p>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            {[
              'AI-verified skills profile',
              'Independent reference collection',
              'Matched to relevant companies',
              'Visa & degree intelligence',
              'Hidden skills discovery',
              'Profile live until you\'re hired',
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
            onClick={handlePay}
            disabled={loading}
            className="w-full bg-[#0B5563] text-white py-4 rounded-full font-semibold text-sm hover:bg-[#094450] transition-colors disabled:opacity-50"
          >
            {loading ? 'Redirecting to payment...' : 'Pay $49 and build your profile →'}
          </button>

          <p className="text-center text-xs text-[#1C1C2E]/40 mt-4">
            Secure payment via Stripe. 30-day money-back guarantee if not satisfied.
          </p>
        </div>

        <p className="text-center text-xs text-[#1C1C2E]/40">
          Are you a company?{' '}
          <a href="/company/signup" className="text-[#E8745A] font-medium hover:underline">
            Start your 60-day free trial →
          </a>
        </p>
      </div>
    </div>
  )
}
