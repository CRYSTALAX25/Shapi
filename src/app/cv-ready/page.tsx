'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type SendState = 'idle' | 'sending' | 'sent' | 'error'

type Preview = {
  before: string | null
  after: string | null
  has_whatsapp: boolean
  whatsapp_count?: number
  industry?: string
}

type Profile = {
  cv_kit_purchased?: boolean
  full_name: string | null
  id: string
  location: string | null
  native_language: string | null
  cv_language_preference: string | null
}

// Resolve what to show from the candidate's WhatsApp language selection
// Returns: { showEnglish, showNative, nativeLabel }
function resolveCVLanguages(profile: Profile): { showEnglish: boolean; showNative: boolean; nativeLabel: string } {
  const pref = (profile.cv_language_preference || '').toLowerCase().trim()
  const nativeFallback = profile.native_language || 'Native language'

  // They explicitly chose English only
  if (pref === 'english') {
    return { showEnglish: true, showNative: false, nativeLabel: nativeFallback }
  }

  // They chose both (stored as "Both — English and Croatian" etc.)
  if (pref.startsWith('both')) {
    // Extract the non-English language from the preference string if possible
    const match = pref.match(/both\s*[—\-+&and]+\s*english\s*[+&and]+\s*(.+)/i)
      || pref.match(/both\s*[—\-+&and]+\s*(.+)\s*[+&and]+\s*english/i)
      || pref.match(/both[^\w]*english[^\w]*(?:and|&|\+)[^\w]*(.+)/i)
      || pref.match(/both[^\w]*(.+)[^\w]*(?:and|&|\+)[^\w]*english/i)
    const extracted = match?.[1]?.trim()
    const nativeLabel = extracted
      ? extracted.charAt(0).toUpperCase() + extracted.slice(1)
      : nativeFallback
    return { showEnglish: true, showNative: true, nativeLabel }
  }

  // No preference set yet — fall back to location/native_language detection
  if (!profile.cv_language_preference) {
    const NATIVE_ENGLISH = ['uk', 'united kingdom', 'england', 'scotland', 'wales', 'northern ireland',
      'usa', 'united states', 'australia', 'canada', 'ireland', 'new zealand']
    const isEngNative = profile.native_language?.toLowerCase() === 'english'
      || NATIVE_ENGLISH.some(c => (profile.location || '').toLowerCase().includes(c))
    return { showEnglish: true, showNative: !isEngNative, nativeLabel: nativeFallback }
  }

  // They chose a specific language (e.g., "Croatian", "Tagalog", "French")
  // Treat their chosen language as primary — show it first, offer English as optional
  const chosenLabel = profile.cv_language_preference.charAt(0).toUpperCase() + profile.cv_language_preference.slice(1)
  const isEnglishChosen = pref === 'english'
  return { showEnglish: !isEnglishChosen, showNative: true, nativeLabel: chosenLabel }
}

export default function CVReady() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [ready, setReady] = useState(false)
  const [sendEmailState, setSendEmailState] = useState<SendState>('idle')
  const [sendWAState, setSendWAState] = useState<SendState>('idle')

  useEffect(() => {
    // Fetch profile to gate access
    fetch('/api/profile/get')
      .then(r => r.json())
      .then(d => {
        setProfile({
          cv_kit_purchased: d.profile.cv_kit_purchased ?? false,
          full_name: d.profile.full_name,
          id: d.profile.id || '',
          location: d.profile.location || null,
          native_language: d.profile.native_language || null,
          cv_language_preference: d.profile.cv_language_preference || null,
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

  const sendCV = async (channel: 'email' | 'whatsapp') => {
    const setState = channel === 'email' ? setSendEmailState : setSendWAState
    setState('sending')
    try {
      const res = await fetch('/api/cv/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, showNative, nativeLabel }),
      })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const profileId = profile?.id?.slice(0, 8) || ''
  const { showEnglish, showNative, nativeLabel } = profile
    ? resolveCVLanguages(profile)
    : { showEnglish: true, showNative: false, nativeLabel: 'Native language' }

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
            {showEnglish && showNative
              ? `English and ${nativeLabel} versions ready — plus generate for any target industry below.`
              : showNative && !showEnglish
              ? `Your ${nativeLabel} CV is ready — enriched with your WhatsApp conversation.`
              : 'Your CV is ready — generate a version for any industry you\'re targeting.'}
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
                  ? `Built from ${preview.whatsapp_count} WhatsApp message${preview.whatsapp_count !== 1 ? 's' : ''} · generate for any industry below`
                  : 'Enhanced and industry-formatted by Claude'}
              </p>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>
          </div>
        )}

        {/* Downloads */}
        <div className="gradient-border-card rounded-2xl p-5 mb-6 space-y-3">
          <p className="text-white/35 text-xs font-bold uppercase tracking-wider mb-1">Download your CVs</p>

          {showEnglish && (
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
          )}

          {showNative && (
            <a href="/profile/print?lang=native" target="_blank"
              className="flex items-center justify-between p-4 bg-white/[0.04] rounded-xl hover:bg-white/[0.07] transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#A78BFA]/10 flex items-center justify-center text-lg">🌐</div>
                <div>
                  <p className="text-white font-bold text-sm">{nativeLabel} CV</p>
                  <p className="text-white/35 text-xs">
                    {showEnglish ? 'Auto-translated · same format · review before sending' : 'Industry-optimised · print to PDF'}
                  </p>
                </div>
              </div>
              <span className="text-[#A78BFA] text-sm font-bold group-hover:translate-x-1 transition-transform">↓ PDF</span>
            </a>
          )}

          {/* Always offer the other language as an optional extra — no extra charge */}
          {showNative && !showEnglish && (
            <a href="/profile/print" target="_blank"
              className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl hover:bg-white/[0.05] transition-colors group border border-white/[0.05]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center text-lg">🇬🇧</div>
                <div>
                  <p className="text-white/50 font-bold text-sm">English CV</p>
                  <p className="text-white/25 text-xs">Also available — useful for international roles</p>
                </div>
              </div>
              <span className="text-white/30 text-sm font-bold group-hover:translate-x-1 transition-transform">↓ PDF</span>
            </a>
          )}
          {showEnglish && !showNative && (profile?.native_language && profile.native_language.toLowerCase() !== 'english') && (
            <a href="/profile/print?lang=native" target="_blank"
              className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl hover:bg-white/[0.05] transition-colors group border border-white/[0.05]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center text-lg">🌐</div>
                <div>
                  <p className="text-white/50 font-bold text-sm">{profile.native_language} CV</p>
                  <p className="text-white/25 text-xs">Also available — applying locally? Grab this too</p>
                </div>
              </div>
              <span className="text-white/30 text-sm font-bold group-hover:translate-x-1 transition-transform">↓ PDF</span>
            </a>
          )}
        </div>

        {/* Target industry versions */}
        <div className="gradient-border-card rounded-2xl p-5 mb-6">
          <div className="flex items-start justify-between mb-1">
            <p className="text-white/35 text-xs font-bold uppercase tracking-wider">Applying to a different sector?</p>
            <span className="text-[10px] font-bold bg-[#22D3EE]/10 text-[#22D3EE] px-2 py-0.5 rounded-full flex-shrink-0">Included</span>
          </div>
          <p className="text-white/25 text-xs mb-4">
            Pick any industry below — Shapi rewrites your achievements through that sector&apos;s lens. Same experience, different framing.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Tech', key: 'tech', emoji: '💻' },
              { label: 'Media', key: 'creative', emoji: '🎬' },
              { label: 'Finance', key: 'finance', emoji: '📊' },
              { label: 'Hospitality', key: 'hospitality', emoji: '🏨' },
              { label: 'Marketing', key: 'marketing', emoji: '📣' },
              { label: 'Operations', key: 'operations', emoji: '⚙️' },
              { label: 'Sales', key: 'sales', emoji: '🤝' },
              { label: 'Universal', key: 'universal', emoji: '📋', isUniversal: true },
            ].map((ind) => (
              <a
                key={ind.key}
                href={ind.isUniversal ? '/profile/print?lang=universal' : `/profile/print?industry=${ind.key}`}
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                style={{
                  background: ind.isUniversal ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.05)',
                  border: ind.isUniversal ? '1px solid rgba(52,211,153,0.2)' : '1px solid rgba(255,255,255,0.08)',
                  color: ind.isUniversal ? '#34D399' : 'rgba(255,255,255,0.55)',
                }}
              >
                <span>{ind.emoji}</span>
                {ind.label}
              </a>
            ))}
          </div>
          <p className="text-white/15 text-[10px] mt-3">Each opens as a fresh PDF — Claude re-writes your bullets for that industry in ~20 seconds</p>
        </div>

        {/* Send to yourself */}
        <div className="gradient-border-card rounded-2xl p-5 mb-6">
          <p className="text-white/35 text-xs font-bold uppercase tracking-wider mb-1">Send to yourself</p>
          <p className="text-white/25 text-xs mb-4">Open on your phone or inbox — then print to PDF from there.</p>
          <div className="flex gap-3">
            <button
              onClick={() => sendCV('whatsapp')}
              disabled={sendWAState === 'sending' || sendWAState === 'sent'}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              style={{ background: sendWAState === 'sent' ? 'rgba(52,211,153,0.12)' : 'rgba(37,211,102,0.1)', border: `1px solid ${sendWAState === 'sent' ? 'rgba(52,211,153,0.4)' : 'rgba(37,211,102,0.25)'}`, color: sendWAState === 'sent' ? '#34D399' : '#25D366' }}
            >
              <span>{sendWAState === 'sent' ? '✓' : sendWAState === 'sending' ? '…' : '💬'}</span>
              {sendWAState === 'sent' ? 'Sent to WhatsApp' : sendWAState === 'sending' ? 'Sending…' : 'Send via WhatsApp'}
            </button>
            <button
              onClick={() => sendCV('email')}
              disabled={sendEmailState === 'sending' || sendEmailState === 'sent'}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              style={{ background: sendEmailState === 'sent' ? 'rgba(52,211,153,0.12)' : 'rgba(34,211,238,0.08)', border: `1px solid ${sendEmailState === 'sent' ? 'rgba(52,211,153,0.4)' : 'rgba(34,211,238,0.2)'}`, color: sendEmailState === 'sent' ? '#34D399' : '#22D3EE' }}
            >
              <span>{sendEmailState === 'sent' ? '✓' : sendEmailState === 'sending' ? '…' : '✉️'}</span>
              {sendEmailState === 'sent' ? 'Sent to email' : sendEmailState === 'sending' ? 'Sending…' : 'Send via email'}
            </button>
          </div>
          {(sendEmailState === 'error' || sendWAState === 'error') && (
            <p className="text-[#FB7185] text-xs mt-3 text-center">Something went wrong — try again or download directly above.</p>
          )}
          <p className="text-white/15 text-[10px] mt-3 text-center">Links open the CV in your browser — use Ctrl+P / Cmd+P → Save as PDF</p>
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
