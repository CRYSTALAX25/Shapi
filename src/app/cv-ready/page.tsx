'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SendState = 'idle' | 'sending' | 'sent' | 'error' | 'fallback'

type Preview = {
  before: string | null
  after: string | null
  has_whatsapp: boolean
  whatsapp_count?: number
  industry?: string
}

type LanguageSpoken = { language: string; level: string }

type Profile = {
  cv_kit_purchased?: boolean
  cv_tier?: string | null
  full_name: string | null
  id: string
  location: string | null
  native_language: string | null
  cv_language_preference: string | null
  languages_spoken?: LanguageSpoken[]
  matched_industries?: string[]
  industry_chats?: Record<string, { status?: string; answers?: string[] }>
}

// Language → flag emoji + ISO code mapping for display
const LANG_META: Record<string, { flag: string; code: string }> = {
  english: { flag: '🇬🇧', code: 'en' },
  arabic: { flag: '🇸🇦', code: 'ar' },
  french: { flag: '🇫🇷', code: 'fr' },
  spanish: { flag: '🇪🇸', code: 'es' },
  german: { flag: '🇩🇪', code: 'de' },
  italian: { flag: '🇮🇹', code: 'it' },
  portuguese: { flag: '🇵🇹', code: 'pt' },
  russian: { flag: '🇷🇺', code: 'ru' },
  chinese: { flag: '🇨🇳', code: 'zh' },
  mandarin: { flag: '🇨🇳', code: 'zh' },
  japanese: { flag: '🇯🇵', code: 'ja' },
  korean: { flag: '🇰🇷', code: 'ko' },
  hindi: { flag: '🇮🇳', code: 'hi' },
  urdu: { flag: '🇵🇰', code: 'ur' },
  turkish: { flag: '🇹🇷', code: 'tr' },
  croatian: { flag: '🇭🇷', code: 'hr' },
  tagalog: { flag: '🇵🇭', code: 'tl' },
  filipino: { flag: '🇵🇭', code: 'tl' },
  swahili: { flag: '🇰🇪', code: 'sw' },
  dutch: { flag: '🇳🇱', code: 'nl' },
  greek: { flag: '🇬🇷', code: 'el' },
  hebrew: { flag: '🇮🇱', code: 'he' },
  polish: { flag: '🇵🇱', code: 'pl' },
  romanian: { flag: '🇷🇴', code: 'ro' },
  ukrainian: { flag: '🇺🇦', code: 'uk' },
  serbian: { flag: '🇷🇸', code: 'sr' },
  hungarian: { flag: '🇭🇺', code: 'hu' },
  czech: { flag: '🇨🇿', code: 'cs' },
  swedish: { flag: '🇸🇪', code: 'sv' },
  norwegian: { flag: '🇳🇴', code: 'no' },
  danish: { flag: '🇩🇰', code: 'da' },
  finnish: { flag: '🇫🇮', code: 'fi' },
  thai: { flag: '🇹🇭', code: 'th' },
  vietnamese: { flag: '🇻🇳', code: 'vi' },
  indonesian: { flag: '🇮🇩', code: 'id' },
  malay: { flag: '🇲🇾', code: 'ms' },
  bengali: { flag: '🇧🇩', code: 'bn' },
}
function langFlag(name: string): string {
  return LANG_META[name.toLowerCase().trim()]?.flag || '🌐'
}

// Build the list of languages to offer for CV download — always include English first,
// then every language on the CV (excluding English-as-listed since it's already covered).
// Sort by proficiency: Native > Fluent > Professional > Conversational.
function buildLanguageList(profile: Profile): LanguageSpoken[] {
  const list: LanguageSpoken[] = [{ language: 'English', level: 'Fluent' }]
  const onCV = Array.isArray(profile.languages_spoken) ? profile.languages_spoken : []
  const native = profile.native_language?.trim()

  // Add native_language if not already in the spoken list
  if (native && native.toLowerCase() !== 'english' && !onCV.some(l => l.language?.toLowerCase() === native.toLowerCase())) {
    onCV.push({ language: native, level: 'Native' })
  }

  // Filter out duplicates and English (already at the top)
  const seen = new Set(['english'])
  for (const l of onCV) {
    if (!l.language) continue
    const key = l.language.toLowerCase().trim()
    if (seen.has(key)) continue
    seen.add(key)
    list.push(l)
  }

  // Sort: keep English first, then by proficiency
  const order: Record<string, number> = { native: 0, fluent: 1, professional: 2, intermediate: 3, conversational: 4, basic: 5 }
  const [first, ...rest] = list
  rest.sort((a, b) => {
    const aLvl = order[(a.level || '').toLowerCase()] ?? 9
    const bLvl = order[(b.level || '').toLowerCase()] ?? 9
    return aLvl - bLvl
  })
  return [first, ...rest]
}

// Known language whitelist — reject garbage stored values (e.g. "Sure go ahead")
const KNOWN_LANGS = [
  'english','arabic','french','spanish','german','italian','portuguese','russian',
  'chinese','mandarin','japanese','korean','hindi','urdu','turkish','dutch','polish',
  'greek','hebrew','persian','farsi','pashto','thai','vietnamese','indonesian','malay',
  'filipino','tagalog','swahili','amharic','yoruba','zulu','afrikaans','romanian',
  'czech','hungarian','finnish','swedish','norwegian','danish','ukrainian','bulgarian',
  'croatian','serbian','slovak','slovenian','bengali','punjabi','tamil','telugu',
  'marathi','gujarati','malayalam','kannada','sinhala','nepali','burmese','khmer',
  'lao','mongolian','kazakh','uzbek','georgian','armenian','azerbaijani','kurdish',
  'somali','hausa','igbo','catalan','basque','galician','welsh','irish','icelandic',
]
function isValidLangPref(value: string | null | undefined): boolean {
  if (!value) return false
  const v = value.toLowerCase().trim()
  if (v === 'english') return true
  if (v.startsWith('both')) return true
  const cleaned = v.replace(/[^a-z\s]/g, '').trim()
  if (cleaned.length < 2 || cleaned.length > 30) return false
  return KNOWN_LANGS.some(l => cleaned === l || cleaned.split(' ').includes(l))
}

// Resolve what to show from the candidate's WhatsApp language selection
// Returns: { showEnglish, showNative, nativeLabel }
function resolveCVLanguages(profile: Profile): { showEnglish: boolean; showNative: boolean; nativeLabel: string } {
  // Treat invalid/garbage preferences as "no preference" so we fall through to detection
  const rawPref = isValidLangPref(profile.cv_language_preference) ? profile.cv_language_preference : null
  const pref = (rawPref || '').toLowerCase().trim()
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
  if (!rawPref) {
    const NATIVE_ENGLISH = ['uk', 'united kingdom', 'england', 'scotland', 'wales', 'northern ireland',
      'usa', 'united states', 'australia', 'canada', 'ireland', 'new zealand']
    const isEngNative = profile.native_language?.toLowerCase() === 'english'
      || NATIVE_ENGLISH.some(c => (profile.location || '').toLowerCase().includes(c))
    return { showEnglish: true, showNative: !isEngNative, nativeLabel: nativeFallback }
  }

  // They chose a specific language (e.g., "Croatian", "Tagalog", "French")
  // Treat their chosen language as primary — show it first, offer English as optional
  const chosenLabel = rawPref.charAt(0).toUpperCase() + rawPref.slice(1)
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
  // English CV pre-generation state
  const [englishCvStatus, setEnglishCvStatus] = useState<'generating' | 'ready'>('generating')
  // Pro deep-dive state
  const [deepDiveState, setDeepDiveState] = useState<'idle' | 'sending' | 'sent' | 'error' | 'fallback'>('idle')
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
  const [deepDiveError, setDeepDiveError] = useState('')
  const [deepDiveQuestions, setDeepDiveQuestions] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }

      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, cv_kit_purchased, cv_tier, location, native_language, cv_language_preference, languages_spoken, matched_industries, industry_chats')
        .eq('id', user.id)
        .single()

      // Gate: must have purchased the kit to access this page
      if (!p?.cv_kit_purchased) {
        router.replace('/profile')
        return
      }

      setProfile({
        cv_kit_purchased: p?.cv_kit_purchased ?? false,
        cv_tier: p?.cv_tier ?? null,
        full_name: p?.full_name ?? null,
        id: user.id,
        location: p?.location ?? null,
        native_language: p?.native_language ?? null,
        cv_language_preference: p?.cv_language_preference ?? null,
        languages_spoken: (p?.languages_spoken as LanguageSpoken[]) ?? [],
        matched_industries: (p?.matched_industries as string[]) ?? [],
        industry_chats: (p?.industry_chats as Record<string, { status?: string; answers?: string[] }>) ?? {},
      })
      setReady(true)

      // ── Silently pre-generate the English CV in the background ──────────────
      // Stores result in sessionStorage so the print page renders instantly
      // without any spinner — no API call needed on the print side.
      fetch('/api/cv/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'english' }),
      })
        .then(r => r.json())
        .then(d => {
          if (!d.error) {
            try {
              sessionStorage.setItem('shapi_cv_english', JSON.stringify({ cv: d.cv, meta: d.meta }))
            } catch { /* sessionStorage may be blocked in some browsers */ }
            setEnglishCvStatus('ready')
          } else {
            setEnglishCvStatus('ready') // let them try even if generation failed
          }
        })
        .catch(() => setEnglishCvStatus('ready'))
      // ─────────────────────────────────────────────────────────────────────────

      // Fetch the before/after preview
      setLoadingPreview(true)
      fetch('/api/cv/preview')
        .then(r => r.json())
        .then(pp => setPreview(pp))
        .catch(() => {})
        .finally(() => setLoadingPreview(false))
    })
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

  const isPro = profile?.cv_tier === 'pro'
  const matchedIndustries = profile?.matched_industries || []
  const industryChats = profile?.industry_chats || {}

  const INDUSTRY_META: Record<string, { label: string; emoji: string }> = {
    finance: { label: 'Finance', emoji: '📊' },
    tech: { label: 'Tech', emoji: '💻' },
    creative: { label: 'Media & Creative', emoji: '🎬' },
    healthcare: { label: 'Healthcare', emoji: '🏥' },
    legal: { label: 'Legal', emoji: '⚖️' },
    marketing: { label: 'Marketing', emoji: '📣' },
    operations: { label: 'Operations', emoji: '⚙️' },
    hospitality: { label: 'Hospitality', emoji: '🏨' },
    education: { label: 'Education', emoji: '🎓' },
    sales: { label: 'Sales', emoji: '🤝' },
  }

  const sendDeepDive = async () => {
    if (selectedIndustries.length === 0) return
    setDeepDiveState('sending')
    setDeepDiveError('')
    try {
      const res = await fetch('/api/cv/deepdive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industries: selectedIndustries }),
      })
      const data = await res.json()
      if (data.success) {
        setDeepDiveState('sent')
      } else if (data.whatsapp_failed && data.questions) {
        // WhatsApp send failed but we still have the questions — show them in-app
        setDeepDiveState('fallback')
        setDeepDiveQuestions(data.questions)
        setDeepDiveError(data.error || '')
      } else if (!res.ok) {
        setDeepDiveState('error')
        setDeepDiveError(data.error || 'Something went wrong — please try again')
      } else {
        setDeepDiveState('sent')
      }
    } catch {
      setDeepDiveState('error')
      setDeepDiveError('Network error — please try again')
    }
  }

  const upgradeToPro = async () => {
    const res = await fetch('/api/stripe/cv-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'pro' }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

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
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
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
            {profile && buildLanguageList(profile).length > 1
              ? `One CV per language you speak (${buildLanguageList(profile).map(l => l.language).join(', ')}) — plus generate for any target industry below.`
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

        {/* Downloads — one button per language the candidate speaks */}
        <div className="gradient-border-card rounded-2xl p-5 mb-6 space-y-3">
          <p className="text-white/35 text-xs font-bold uppercase tracking-wider mb-1">Download your CVs</p>
          <p className="text-white/25 text-xs mb-3">
            One CV per language you speak. Generated on first click, then saved forever — re-download anytime.
          </p>

          {profile && buildLanguageList(profile).map((lang, idx) => {
            const isEnglish = lang.language.toLowerCase() === 'english'
            const isPrimary = idx === 0
            const href = isEnglish
              ? '/profile/print'
              : `/profile/print?lang=${encodeURIComponent(lang.language)}`
            // English uses the same pre-gen status indicator; others generate on click (~15-20s) and cache
            const showSpinner = isEnglish && englishCvStatus !== 'ready'
            return (
              <a
                key={lang.language + idx}
                href={showSpinner ? undefined : href}
                onClick={showSpinner ? e => e.preventDefault() : undefined}
                target="_blank"
                className="flex items-center justify-between p-4 rounded-xl transition-colors group"
                style={{
                  background: isPrimary ? 'rgba(34,211,238,0.06)' : 'rgba(255,255,255,0.04)',
                  border: isPrimary ? '1px solid rgba(34,211,238,0.15)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: showSpinner ? 'default' : 'pointer',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-lg">{langFlag(lang.language)}</div>
                  <div>
                    <p className="text-white font-bold text-sm">{lang.language} CV</p>
                    {showSpinner ? (
                      <p className="text-[#22D3EE]/60 text-xs flex items-center gap-1">
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22D3EE', opacity: 0.7, animation: 'pulse 1.2s ease-in-out infinite' }} />
                        Writing your CV… ready in ~20 seconds
                      </p>
                    ) : (
                      <p className="text-white/35 text-xs">
                        {isEnglish ? 'Industry-optimised · ATS-friendly · print to PDF' : `${lang.level || 'Fluent'} · auto-translated · review before sending`}
                      </p>
                    )}
                  </div>
                </div>
                {showSpinner ? (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(34,211,238,0.2)', borderTopColor: '#22D3EE', animation: 'spin 0.9s linear infinite' }} />
                ) : (
                  <span className="text-[#22D3EE] text-sm font-bold group-hover:translate-x-1 transition-transform">↓ PDF</span>
                )}
              </a>
            )
          })}
        </div>

        {/* Industry CVs — matched to their background */}
        {matchedIndustries.length > 0 && (
          <div className="gradient-border-card rounded-2xl p-5 mb-6">
            <div className="flex items-start justify-between mb-1">
              <p className="text-white/35 text-xs font-bold uppercase tracking-wider">Your industry CVs</p>
              <span className="text-[10px] font-bold bg-[#22D3EE]/10 text-[#22D3EE] px-2 py-0.5 rounded-full flex-shrink-0">Included</span>
            </div>
            <p className="text-white/25 text-xs mb-4">
              Based on your background, Shapi identified these industries. Each CV reframes your achievements for that sector.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {matchedIndustries.map((ind) => {
                const meta = INDUSTRY_META[ind] || { label: ind, emoji: '📄' }
                return (
                  <a key={ind} href={`/profile/print?industry=${ind}`} target="_blank"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                    style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.15)', color: 'rgba(255,255,255,0.7)' }}>
                    <span>{meta.emoji}</span>{meta.label}
                    <span className="text-[#22D3EE] ml-1">↓</span>
                  </a>
                )
              })}
              <a href="/profile/print?lang=universal" target="_blank"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', color: 'rgba(52,211,153,0.8)' }}>
                <span>📋</span>Universal
                <span className="text-[#34D399] ml-1">↓</span>
              </a>
            </div>
            <p className="text-white/15 text-[10px]">Opens in a new tab — click &quot;Save as PDF&quot; to download</p>
          </div>
        )}

        {/* Pro deep-dive — only if kit tier */}
        {!isPro && (
          <div className="gradient-border-card rounded-2xl p-5 mb-6" style={{ borderColor: 'rgba(167,139,250,0.3)' }}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-[#A78BFA] text-xs font-bold uppercase tracking-wider">CV Pro — $59</p>
              <span className="text-[10px] font-bold bg-[#A78BFA]/10 text-[#A78BFA] px-2 py-0.5 rounded-full flex-shrink-0">Upgrade</span>
            </div>
            <p className="text-white/60 text-sm font-bold mb-1">Get the stories that win the role you actually want</p>
            <p className="text-white/35 text-xs mb-4 leading-relaxed">
              Claude reviews your CV and WhatsApp answers, identifies what&apos;s missing for {matchedIndustries.length > 0 ? matchedIndustries.map(i => INDUSTRY_META[i]?.label || i).join(', ') : 'your target industries'}, then interviews you on WhatsApp to surface the specific projects, numbers and stories that only come out when you&apos;re asked directly.
            </p>
            <button onClick={upgradeToPro}
              className="w-full py-3 rounded-xl font-black text-sm transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #A78BFA, #22D3EE)', color: '#060609' }}>
              Upgrade to Pro — $59 →
            </button>
          </div>
        )}

        {/* Pro deep-dive UI — only for pro tier */}
        {isPro && matchedIndustries.length > 0 && (
          <div className="gradient-border-card rounded-2xl p-5 mb-6" style={{ borderColor: 'rgba(167,139,250,0.25)' }}>
            <div className="flex items-start justify-between mb-1">
              <p className="text-[#A78BFA] text-xs font-bold uppercase tracking-wider">Pro deep-dive</p>
              <span className="text-[10px] font-bold bg-[#A78BFA]/10 text-[#A78BFA] px-2 py-0.5 rounded-full">Pro ✓</span>
            </div>
            <p className="text-white/60 text-sm font-bold mb-1">Pick up to 3 industries for a targeted WhatsApp interview</p>
            <p className="text-white/30 text-xs mb-4">Claude will ask you 6–8 targeted questions to surface the stories that make your CV exceptional for each sector.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {matchedIndustries.map((ind) => {
                const meta = INDUSTRY_META[ind] || { label: ind, emoji: '📄' }
                const isSelected = selectedIndustries.includes(ind)
                // Lock only when industry deep-dive is actually delivered AND has real answers.
                // Status='questions_sent' alone doesn't lock — Twilio drops sometimes, so allow re-send.
                const ic = industryChats[ind] as { status?: string; answers?: string[]; delivered?: boolean } | undefined
                const hasRealAnswers = (ic?.answers?.length ?? 0) > 0 && ic?.delivered === true
                const isPending = ic?.status === 'questions_sent' && !hasRealAnswers
                const isDone = hasRealAnswers
                return (
                  <button key={ind}
                    disabled={isDone || deepDiveState === 'sent'}
                    onClick={() => {
                      if (isDone) return
                      setSelectedIndustries(prev =>
                        prev.includes(ind)
                          ? prev.filter(i => i !== ind)
                          : prev.length < 3 ? [...prev, ind] : prev
                      )
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: isDone ? 'rgba(52,211,153,0.08)' : isPending ? 'rgba(251,191,36,0.08)' : isSelected ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)',
                      border: isDone ? '1px solid rgba(52,211,153,0.3)' : isPending ? '1px solid rgba(251,191,36,0.3)' : isSelected ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.08)',
                      color: isDone ? '#34D399' : isPending ? '#FBBF24' : isSelected ? '#A78BFA' : 'rgba(255,255,255,0.5)',
                      cursor: isDone ? 'default' : 'pointer',
                    }}>
                    <span>{meta.emoji}</span>
                    {meta.label}
                    {isDone && <span>✓</span>}
                    {isPending && <span className="ml-1 text-[10px]">↻ resend</span>}
                  </button>
                )
              })}
            </div>
            {deepDiveState === 'sent' ? (
              <p className="text-[#34D399] text-sm font-bold text-center py-2">✓ Questions sent to WhatsApp — answer them and your CVs will be ready</p>
            ) : deepDiveState === 'fallback' ? (
              <div className="space-y-3">
                <div className="bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl p-3">
                  <p className="text-[#FB7185] text-xs font-bold mb-1">⚠️ WhatsApp delivery failed</p>
                  <p className="text-white/40 text-xs">Your questions are below — copy them or answer right here. We&apos;ll use your answers for your CVs.</p>
                </div>
                <div className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.08]">
                  <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">Your deep-dive questions</p>
                  <pre className="text-white/70 text-xs leading-relaxed whitespace-pre-wrap font-sans">{deepDiveQuestions}</pre>
                </div>
                <p className="text-white/25 text-[10px] text-center">To fix WhatsApp delivery: open WhatsApp and send us any message first, then try again.</p>
              </div>
            ) : (
              <button
                onClick={sendDeepDive}
                disabled={selectedIndustries.length === 0 || deepDiveState === 'sending'}
                className="w-full py-3 rounded-xl font-black text-sm transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #A78BFA, #22D3EE)', color: '#060609' }}>
                {deepDiveState === 'sending'
                  ? 'Sending questions…'
                  : selectedIndustries.length === 0
                  ? 'Select industries above'
                  : `Send ${selectedIndustries.length} industry deep-dive to WhatsApp →`}
              </button>
            )}
            {deepDiveState === 'error' && (
              <p className="text-[#FB7185] text-xs mt-2 text-center">{deepDiveError || 'Something went wrong — try again.'}</p>
            )}
          </div>
        )}

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
