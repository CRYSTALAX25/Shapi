'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Preview = {
  before: string | null
  after: string | null
  has_whatsapp: boolean
  whatsapp_count?: number
  industry?: string
}

type Profile = {
  cv_kit_purchased: boolean
  full_name: string | null
  id: string
  location: string | null
  native_language: string | null
}

const NATIVE_ENGLISH_COUNTRIES = [
  'uk', 'united kingdom', 'england', 'scotland', 'wales', 'northern ireland',
  'usa', 'united states', 'australia', 'canada', 'ireland', 'new zealand',
]

function isNativeEnglish(profile: Profile): boolean {
  if (profile.native_language?.toLowerCase() === 'english') return true
  const loc = (profile.location || '').toLowerCase()
  return NATIVE_ENGLISH_COUNTRIES.some(c => loc.includes(c))
}

export default function CVReady() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Fetch profile to gate access
    fetch('/api/profile/get')
      .then(r => r.json())
      .then(d => {
        if (!d.profile || !d.profile.cv_kit_purchased) {
          router.replace('/profile')
          return
        }
        setProfile({
          cv_kit_purchased: true,
          full_name: d.profile.full_name,
          id: d.profile.id || '',
          location: d.profile.location || null,
          native_language: d.profile.native_language || null,
        })
        setReady(true)

        // Fetch the before/after preview
        setLoadingPreview(true)
        fetch('/api/cv/preview')
          .then(r => r.json())
          .then(p => setPreview(p))
          .catch(() => {})
          .finally(() => setLoadingPreview(false))
      })
      .catch(() => router.replace('/login'))
  }, [router])

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', background: '#060609', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const profileId = profile?.id?.slice(0, 8) || ''
  const hideNative = profile ? isNativeEnglish(profile) : false

  return (
    <div className="min-h-screen bg-[#060609]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#0d0d14, #0d0d14) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.15), rgba(139,92,246,0.15)) border-box;
          border: 1px solid transparent;
        }
        .before-col {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 18px;
          flex: 1;
        }
        .after-col {
          background: linear-gradient(135deg, rgba(34,211,238,0.06), rgba(167,139,250,0.06));
          border: 1px solid rgba(34,211,238,0.2);
          border-radius: 14px;
          padding: 18px;
          flex: 1;
          position: relative;
        }
        .after-col::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(34,211,238,0.03), rgba(167,139,250,0.03));
          pointer-events: none;
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

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.06]">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-black text-xl tracking-tighter" style={{
            background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>shapi</Link>
          <Link href="/dashboard" className="text-white/30 text-sm hover:text-white/60 transition-colors">Dashboard →</Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-20">

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'radial-gradient(circle at 40% 35%, #67E8F9, #A78BFA, #7C3AED)' }}>
            <span className="text-2xl">✨</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">{firstName}, your CV Kit is ready.</h1>
          <p className="text-white/40 text-sm leading-relaxed max-w-sm mx-auto">
            {hideNative
              ? 'Your CV — enriched with your WhatsApp conversation and optimised for your industry.'
              : 'Two versions — English and native language — both enriched with your WhatsApp conversation.'}
          </p>
        </div>

        {/* Before / After */}
        {(loadingPreview || preview?.has_whatsapp) && (
          <div className="gradient-border-card rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white/35 text-xs font-bold uppercase tracking-wider">What Shapi added to your CV</p>
              {preview?.industry && (
                <span className="text-white/25 text-xs capitalize">{preview.industry}-optimised</span>
              )}
            </div>

            {/* Two columns */}
            <div className="flex gap-3 mb-1" style={{ alignItems: 'stretch' }}>
              {/* Before */}
              <div className="before-col">
                <p className="text-white/20 text-[10px] font-bold uppercase tracking-wider mb-3">
                  Before — from your upload
                </p>
                {loadingPreview ? (
                  <>
                    <div className="shimmer w-full" />
                    <div className="shimmer w-4/5" />
                    <div className="shimmer w-3/5" />
                  </>
                ) : (
                  <p className="text-white/35 text-xs leading-relaxed" style={{ fontStyle: 'italic' }}>
                    &ldquo;{preview?.before
                      ? preview.before.slice(0, 180) + (preview.before.length > 180 ? '…' : '')
                      : 'Basic work history — titles, companies, dates. No specific achievements or metrics.'}
                    &rdquo;
                  </p>
                )}
              </div>

              {/* Arrow */}
              <div className="flex items-center flex-shrink-0 px-1">
                <div style={{
                  color: 'transparent',
                  background: 'linear-gradient(135deg, #22D3EE, #A78BFA)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: 20,
                  fontWeight: 900,
                }}>→</div>
              </div>

              {/* After */}
              <div className="after-col">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#22D3EE', opacity: 0.7 }}>
                  After — Shapi-enhanced
                </p>
                {loadingPreview ? (
                  <>
                    <div className="shimmer w-full" style={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.06) 25%, rgba(34,211,238,0.12) 50%, rgba(34,211,238,0.06) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    <div className="shimmer w-11/12" style={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.06) 25%, rgba(34,211,238,0.12) 50%, rgba(34,211,238,0.06) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    <div className="shimmer w-3/4" style={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.06) 25%, rgba(34,211,238,0.12) 50%, rgba(34,211,238,0.06) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                  </>
                ) : (
                  <p className="text-white/80 text-xs leading-relaxed">
                    {preview?.after
                      ? preview.after
                      : 'Enhanced with specific achievements, metrics, and stories from your WhatsApp conversation.'}
                  </p>
                )}
              </div>
            </div>

            {/* Divider line label */}
            <div className="flex items-center gap-3 mt-4">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <p className="text-white/20 text-[10px]">
                {loadingPreview
                  ? 'Claude is writing your enhanced version…'
                  : preview?.whatsapp_count
                  ? `Built from ${preview.whatsapp_count} WhatsApp message${preview.whatsapp_count !== 1 ? 's' : ''} · 2 CV languages`
                  : 'Enhanced and industry-formatted by Claude'}
              </p>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>
          </div>
        )}

        {/* Downloads */}
        <div className="gradient-border-card rounded-2xl p-5 mb-6 space-y-3">
          <p className="text-white/35 text-xs font-bold uppercase tracking-wider mb-1">Download your CVs</p>

          <a href="/profile/print" target="_blank"
            className="flex items-center justify-between p-4 bg-white/[0.04] rounded-xl hover:bg-white/[0.07] transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#22D3EE]/10 flex items-center justify-center text-lg">🇬🇧</div>
              <div>
                <p className="text-white font-bold text-sm">English CV</p>
                <p className="text-white/35 text-xs">Industry-optimised · ATS-friendly · print to PDF</p>
              </div>
            </div>
            <span className="text-[#22D3EE] text-sm font-bold group-hover:translate-x-1 transition-transform">↓ PDF</span>
          </a>

          {!hideNative && (
            <a href="/profile/print?lang=native" target="_blank"
              className="flex items-center justify-between p-4 bg-white/[0.04] rounded-xl hover:bg-white/[0.07] transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#A78BFA]/10 flex items-center justify-center text-lg">🌐</div>
                <div>
                  <p className="text-white font-bold text-sm">Native language CV</p>
                  <p className="text-white/35 text-xs">Auto-translated · same format · review before sending</p>
                </div>
              </div>
              <span className="text-[#A78BFA] text-sm font-bold group-hover:translate-x-1 transition-transform">↓ PDF</span>
            </a>
          )}
        </div>

        {/* Shareable link */}
        <div className="gradient-border-card rounded-2xl p-5 mb-8">
          <p className="text-white/35 text-xs font-bold uppercase tracking-wider mb-2">Your shareable profile</p>
          <p className="text-white/35 text-xs leading-relaxed mb-3">
            Send this to hiring managers. They see your full verified profile — no login needed.
          </p>
          <div className="flex items-center gap-3 bg-white/[0.04] rounded-xl px-4 py-3">
            <code className="text-[#22D3EE] text-sm font-bold flex-1 truncate">
              shapi.io/p/{profileId}
            </code>
            <a href={`/p/${profileId}`} target="_blank"
              className="text-white/30 text-xs hover:text-white/60 flex-shrink-0 transition-colors">
              Preview →
            </a>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/profile"
            className="flex-1 text-center py-3 text-sm text-white/30 hover:text-white/60 transition-colors">
            View full profile →
          </Link>
          <Link href="/dashboard"
            className="flex-1 text-center bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] py-3 rounded-full font-black text-sm text-[#060609] hover:opacity-90 transition-opacity">
            Dashboard →
          </Link>
        </div>

      </div>
    </div>
  )
}
