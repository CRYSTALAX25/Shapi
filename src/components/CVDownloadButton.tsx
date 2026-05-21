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
      style={{ background: 'linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(135deg, rgba(34,211,238,0.35), rgba(167,139,250,0.35)) border-box', border: '1px solid transparent', boxShadow: '0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📄</span>
        <p className="text-[#0E0E1A] font-bold text-sm">Your CV Kit{cvTier === 'pro' ? ' Pro' : ''}</p>
      </div>

      {hasAccess ? (
        <>
          <p className="text-[#5A5A6E] text-xs mb-4 leading-relaxed">
            English, native language, and industry-targeted versions — all ready.
          </p>
          <Link href="/cv-ready"
            className="block text-center bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] text-[#060609] text-xs font-black py-2.5 rounded-xl hover:opacity-90 transition-opacity">
            Open CV Kit →
          </Link>
        </>
      ) : cvParsed ? (
        <>
          <p className="text-[#5A5A6E] text-xs mb-4 leading-relaxed">
            Multi-language CVs + industry-targeted versions. $25 Kit or $59 Pro (with deep-dive interview) — yours to keep.
          </p>
          <div className="space-y-2">
            <Link href="/profile/print" target="_blank"
              className="block text-center bg-[#0E0E1A]/[0.04] text-[#3F3F4E] text-xs font-bold py-2.5 rounded-xl hover:bg-[#0E0E1A]/[0.08] transition-colors">
              Preview CV (free) →
            </Link>
            <button
              onClick={handleBuy}
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] text-[#060609] text-xs font-black py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? 'Redirecting...' : 'Get CV Kit — $25 →'}
            </button>
          </div>
        </>
      ) : (
        <p className="text-[#8A8A99] text-xs">Upload your CV first to unlock this.</p>
      )}
    </div>
  )
}
