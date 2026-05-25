'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function CVDownloadButton({ cvParsed, cvKitPurchased, cvTier }: { cvParsed: boolean; cvKitPurchased?: boolean; cvTier?: string | null }) {
  const [loading, setLoading] = useState(false)

  // Pro purchases also unlock Kit access (Pro is the upgraded Kit)
  const hasAccess = !!cvKitPurchased || cvTier === 'pro'

  const handleBuy = async () => {
    if (!cvParsed) return
    setLoading(true)
    const res = await fetch('/api/stripe/cv-checkout', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setLoading(false)
  }

  return (
    <div className="rounded-2xl p-5"
      style={{ background: 'linear-gradient(#16161F, #16161F) padding-box, linear-gradient(135deg, rgba(106,168,245,0.35), rgba(240,140,174,0.35)) border-box', border: '1px solid transparent', boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📄</span>
        <p className="text-[#F4F4F7] font-bold text-sm">Your CV Kit{cvTier === 'pro' ? ' Pro' : ''}</p>
      </div>

      {hasAccess ? (
        <>
          <p className="text-[#A6A6B4] text-xs mb-4 leading-relaxed">
            English, native language, and industry-targeted versions — all ready.
          </p>
          <Link href="/cv-ready"
            className="block text-center bg-gradient-to-r from-[#6AA8F5] to-[#F08CAE] text-white text-xs font-black py-2.5 rounded-xl hover:opacity-90 transition-opacity">
            Open CV Kit →
          </Link>
        </>
      ) : cvParsed ? (
        <>
          <p className="text-[#A6A6B4] text-xs mb-4 leading-relaxed">
            Multi-language CVs + industry-targeted versions. $25 Kit or $59 Pro (with deep-dive interview) — yours to keep.
          </p>
          <div className="space-y-2">
            <Link href="/profile/print" target="_blank"
              className="block text-center bg-white/[0.05] text-[#C7C7D1] text-xs font-bold py-2.5 rounded-xl hover:bg-white/[0.08] transition-colors">
              Preview CV (free) →
            </Link>
            <button
              onClick={handleBuy}
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#6AA8F5] to-[#F08CAE] text-white text-xs font-black py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? 'Redirecting...' : 'Get CV Kit — $25 →'}
            </button>
          </div>
        </>
      ) : (
        <p className="text-[#7E7E8E] text-xs">Upload your CV first to unlock this.</p>
      )}
    </div>
  )
}
