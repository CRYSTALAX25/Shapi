'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function CVDownloadButton({ cvParsed, cvKitPurchased }: { cvParsed: boolean; cvKitPurchased?: boolean }) {
  const [loading, setLoading] = useState(false)

  const handleBuy = async () => {
    if (!cvParsed) return
    setLoading(true)
    const res = await fetch('/api/stripe/cv-checkout', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setLoading(false)
  }

  return (
    <div className="gradient-border-card rounded-2xl p-5"
      style={{ background: 'linear-gradient(#0d0d14, #0d0d14) padding-box, linear-gradient(135deg, rgba(34,211,238,0.2), rgba(167,139,250,0.2)) border-box', border: '1px solid transparent' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📄</span>
        <p className="text-white font-bold text-sm">Your CV Kit</p>
      </div>

      {cvKitPurchased ? (
        <>
          <p className="text-white/35 text-xs mb-4 leading-relaxed">
            English, native language, and industry-targeted versions — all ready.
          </p>
          <Link href="/cv-ready"
            className="block text-center bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] text-[#060609] text-xs font-black py-2.5 rounded-xl hover:opacity-90 transition-opacity">
            Open CV Kit →
          </Link>
        </>
      ) : cvParsed ? (
        <>
          <p className="text-white/35 text-xs mb-4 leading-relaxed">
            3 CVs: English, native language, and industry-targeted. $29 one-time — yours to keep.
          </p>
          <div className="space-y-2">
            <Link href="/profile/print" target="_blank"
              className="block text-center bg-white/[0.06] text-white/70 text-xs font-bold py-2.5 rounded-xl hover:bg-white/[0.10] transition-colors">
              Preview CV (free) →
            </Link>
            <button
              onClick={handleBuy}
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] text-[#060609] text-xs font-black py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? 'Redirecting...' : 'Get CV Kit — $29 →'}
            </button>
          </div>
        </>
      ) : (
        <p className="text-white/25 text-xs">Upload your CV first to unlock this.</p>
      )}
    </div>
  )
}
