'use client'

// Manual company-onboarding form. PRESERVED verbatim from the original static
// /company/onboarding page — only lifted into its own component so the new
// conversational chat can be the default while keeping "Prefer a form?" as a
// lossless fallback. Writes the SAME profile fields as before (and as the chat):
//   company_name, company_website, company_size, location, summary,
//   whatsapp_number, onboarding_complete, completion_pct.

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'
import PhoneInput from '@/components/PhoneInput'

type Stage = 'profile' | 'enriching' | 'done'

const SIZES = ['1–10', '11–50', '51–200', '201–500', '500–2000', '2000+']

// Derive a sensible company name from a URL when the user hasn't typed one
// yet. bupa.com → "Bupa". Useful when the only thing they've entered is the
// website and they want to hit "Pull from website" without filling the name.
function nameFromWebsite(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const host = u.hostname.replace(/^www\./, '')
    const root = host.split('.')[0] || ''
    return root ? root.charAt(0).toUpperCase() + root.slice(1) : ''
  } catch { return '' }
}

const SIZE_MATCH: Record<string, string> = {
  '1-10': '1–10', '1-50': '11–50', '11-50': '11–50',
  '51-200': '51–200', '201-500': '201–500', '500-1000': '500–2000',
  '500-2000': '500–2000', '1000-5000': '500–2000', '2000+': '2000+',
  '5000+': '2000+', '10000+': '2000+',
}

function normalizeSize(raw: string | null | undefined): string {
  if (!raw) return ''
  const s = String(raw).toLowerCase().replace(/[\s,]/g, '').replace(/–/g, '-')
  return SIZE_MATCH[s] || ''
}

// localStorage key for the onboarding form. Restored on mount, cleared on
// confirmed-success submit. Survives the "page reloaded itself and I lost
// 5 minutes of typing" failure mode that's stung Ana repeatedly.
const STORAGE_KEY = 'shapi.company.onboarding.draft.v1'

export default function ManualForm({ onSwitchToChat }: { onSwitchToChat?: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // ?edit=true → stay on this page even if onboarding_complete is already
  // true (so the user can update company info on demand). Without this flag
  // the page auto-redirects already-onboarded companies to their dashboard.
  const isEditMode = searchParams.get('edit') === 'true'
  const [stage, setStage] = useState<Stage>('profile')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Auto-fill state — fires the enrichment endpoint pre-submit so users see
  // the magic before they commit. ~15s spinner.
  const [pulling, setPulling] = useState(false)
  const [pullNote, setPullNote] = useState<string | null>(null)
  const [restored, setRestored] = useState(false)

  const [companyName, setCompanyName] = useState('')
  const [website, setWebsite] = useState('')
  const [hq, setHq] = useState('')
  const [size, setSize] = useState('')
  const [about, setAbout] = useState('')
  // WhatsApp number is the primary engagement channel — collect it during
  // onboarding so the Connect-WhatsApp card on /company/dashboard already
  // has the user paired by the time they land. Otherwise the dashboard's
  // "tap to open WhatsApp" link sends a message from an unknown phone and
  // the webhook can't link it to this account.
  const [whatsapp, setWhatsapp] = useState('')
  // Set true the moment we decide to redirect (profile already onboarded).
  // Prevents the form from rendering during the brief window between
  // 'profile says onboarded' and 'router navigation actually lands'.
  const [redirecting, setRedirecting] = useState(false)

  // Restore on mount. THREE sources, in priority order:
  //   1. SAVED PROFILE from DB — if the user already completed onboarding,
  //      pre-fill from their actual saved company data.
  //   2. localStorage draft — in-progress work that hasn't been submitted.
  //   3. Empty form — first-time user, nothing to restore.
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const res = await fetch('/api/profile/get')
        if (!cancelled && res.ok) {
          const d = await res.json()
          const profile = d?.profile || null
          if (profile?.type === 'company') {
            if (profile.company_name) setCompanyName(profile.company_name)
            if (profile.company_website) setWebsite(profile.company_website)
            if (profile.location) setHq(profile.location)
            if (profile.company_size) setSize(profile.company_size)
            if (profile.summary) setAbout(profile.summary)
            if (profile.whatsapp_number) setWhatsapp(profile.whatsapp_number)
            if (profile.onboarding_complete && !isEditMode) {
              setRedirecting(true)
              router.replace('/company/dashboard')
              return
            }
          }
        }
      } catch { /* network blip — fall through to localStorage */ }

      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw && !cancelled) {
          const d = JSON.parse(raw)
          setCompanyName(prev => prev || d.companyName || '')
          setWebsite(prev => prev || d.website || '')
          setHq(prev => prev || d.hq || '')
          setSize(prev => prev || d.size || '')
          setAbout(prev => prev || d.about || '')
          setWhatsapp(prev => prev || d.whatsapp || '')
        }
      } catch { /* corrupt draft — ignore */ }

      if (!cancelled) setRestored(true)
    }
    init()
    return () => { cancelled = true }
  }, [isEditMode, router])

  // Persist on any field change AFTER the restore has happened.
  useEffect(() => {
    if (!restored) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        companyName, website, hq, size, about, whatsapp,
      }))
    } catch { /* quota / privacy mode — fail silent */ }
  }, [restored, companyName, website, hq, size, about, whatsapp])

  const handlePull = async () => {
    setError(''); setPullNote(null)
    if (!website.trim()) { setError('Add a website first'); return }
    const nameForPull = companyName.trim() || nameFromWebsite(website.trim())
    if (!nameForPull) { setError('Could not derive a name from that URL. Add the company name.'); return }
    setPulling(true)
    const controller = new AbortController()
    const watchdog = setTimeout(() => controller.abort(), 90000)
    try {
      const res = await fetch('/api/company/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: nameForPull, website: website.trim() }),
        signal: controller.signal,
      })
      if (!res.ok) { setError(`Pull failed (${res.status}). Add details manually or try again.`); return }
      const data = await res.json()
      const cd = (data?.company_data || {}) as { headquarters?: string; size?: string; description?: string; industry?: string; founded?: string }
      if (!companyName.trim() && nameForPull) setCompanyName(nameForPull)
      if (!hq.trim() && cd.headquarters) setHq(cd.headquarters)
      const normSize = normalizeSize(cd.size)
      if (!size && normSize) setSize(normSize)
      if (!about.trim() && cd.description) setAbout(cd.description)
      const filled: string[] = []
      if (cd.headquarters) filled.push(`HQ: ${cd.headquarters}`)
      if (cd.size) filled.push(`Size: ${cd.size}`)
      if (cd.industry) filled.push(`Industry: ${cd.industry}`)
      setPullNote(filled.length
        ? `Pulled from public sources. ${filled.join(' · ')}. Review + edit before saving.`
        : 'Pulled — limited data found. Add details manually.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[onboarding] pull error:', msg)
      if (controller.signal.aborted) {
        setError('Pull is taking longer than expected — try again or add details manually.')
      } else {
        setError('Pull failed. Add details manually.')
      }
    } finally {
      clearTimeout(watchdog)
      setPulling(false)
    }
  }

  const submit = async () => {
    setError('')
    if (!companyName.trim()) { setError('Company name is required'); return }

    setSaving(true)

    let saveOk = false
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName.trim(),
          company_website: website.trim() || null,
          company_size: size || null,
          location: hq.trim() || null,
          summary: about.trim() || null,
          whatsapp_number: whatsapp.trim().length > 5 ? whatsapp.trim() : null,
          onboarding_complete: true,
          completion_pct: 100,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Couldn't save (${res.status}). Your details are still here — try again.`)
        setSaving(false)
        return
      }
      const data = await res.json().catch(() => ({}))
      const saved = data?.saved as { onboarding_complete?: boolean; company_name?: string } | null
      const verified = !!(saved?.onboarding_complete && saved?.company_name === companyName.trim())
      if (!verified) {
        console.warn('[onboarding] read-back did not confirm save; keeping localStorage draft as safety')
      }
      saveOk = true
      if (verified) {
        try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('[onboarding] save error:', err)
      setError("Network issue saving your details. They're still here — try again.")
      setSaving(false)
      return
    }

    if (!saveOk) return

    setStage('enriching')
    setSaving(false)

    try {
      const controller = new AbortController()
      const watchdog = setTimeout(() => controller.abort(), 90000)
      try {
        await fetch('/api/company/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_name: companyName.trim(),
            website: website.trim() || null,
          }),
          signal: controller.signal,
        })
      } finally { clearTimeout(watchdog) }
    } catch { /* enrichment is best-effort */ }

    setStage('done')
  }

  if (redirecting) {
    return (
      <Screen>
        <ShapiCharacter mood="happy" size={80} className="mb-6" />
        <h2 className="text-xl font-black text-[#F4F4F7] mb-2 text-center">You&apos;re already set up.</h2>
        <p className="text-[#A6A6B4] text-sm text-center leading-relaxed max-w-xs mb-6">
          Opening your dashboard. Need to update company info? Use{' '}
          <Link href="/company/onboarding?edit=true" className="underline text-[#38BDF8]">edit mode</Link>.
        </p>
        <div className="flex items-center gap-2" style={{ color: '#38BDF8' }}>
          <div className="w-4 h-4 rounded-full border-2 border-[#38BDF8]/30 border-t-[#38BDF8] animate-spin" />
          <span className="text-xs font-bold">Loading dashboard…</span>
        </div>
      </Screen>
    )
  }

  if (!restored) {
    return (
      <Screen>
        <ShapiCharacter mood="idle" size={80} className="mb-6" />
        <p className="text-[#A6A6B4] text-sm">Loading your company…</p>
      </Screen>
    )
  }

  if (stage === 'enriching') {
    return (
      <Screen>
        <ShapiCharacter mood="thinking" size={90} className="mb-6" />
        <h2 className="text-2xl font-black text-[#F4F4F7] mb-3 text-center">Setting up your company profile...</h2>
        <p className="text-[#A6A6B4] text-sm text-center leading-relaxed max-w-xs">
          Pulling public data — Glassdoor rating, Reddit sentiment, recent news. About 15 seconds.
        </p>
      </Screen>
    )
  }

  if (stage === 'done') {
    return (
      <Screen>
        <ShapiCharacter mood="happy" size={90} className="mb-6" />
        <h2 className="text-2xl font-black text-[#F4F4F7] mb-3 text-center">
          {companyName} is set up.
        </h2>
        <p className="text-[#A6A6B4] text-sm text-center leading-relaxed mb-6 max-w-xs">
          Where do you want to go first? The org spine is the single source of truth that powers every other tool in Shapi — but you can jump anywhere.
        </p>
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => router.push('/company/spine?welcome=true')}
            className="w-full py-4 rounded-full font-black text-sm text-[#fff] hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}>
            🌳 Build your org spine →
          </button>
          <button
            onClick={() => router.push('/company/workforce-snapshot?first=true')}
            className="w-full py-2.5 rounded-full text-xs font-bold text-[#A6A6B4] hover:text-[#F4F4F7] transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Skip to Workforce Snapshot
          </button>
          <button
            onClick={() => router.push('/company/dashboard')}
            className="w-full py-2 text-xs text-[#7E7E8E] hover:text-[#C7C7D1] transition-colors">
            Skip — go to dashboard
          </button>
        </div>
      </Screen>
    )
  }

  return (
    <div className="min-h-screen bg-[#060609]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                      linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(56, 189, 248, 0.15)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .field { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 16px; font-size: 14px; color: #F4F4F7; outline: none; transition: border-color 0.2s; }
        .field::placeholder { color: rgba(126,126,142,1); }
        .field:focus { border-color: rgba(56, 189, 248, 0.5); }
        label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #A6A6B4; margin-bottom: 8px; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <div className="flex items-center gap-4">
          {onSwitchToChat && (
            <button onClick={onSwitchToChat} className="text-[#38BDF8] text-sm font-medium hover:underline">
              ← Back to chat
            </button>
          )}
          <Link href="/company/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">← Dashboard</Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-24">

        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#F4F4F7] mb-2">Set up your company.</h1>
          <p className="text-[#A6A6B4] text-sm leading-relaxed">
            Two minutes. Public signal from Glassdoor, LinkedIn, Reddit and recent news is surfaced
            alongside what you write — so candidates see real evidence, not just self-marketing.
          </p>
        </div>

        {error && (
          <div className="bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3 mb-6 text-sm text-[#FB7185]">{error}</div>
        )}

        <div className="gradient-border-card rounded-2xl p-6 mb-5 space-y-4">
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Company details</p>

          <div>
            <label>Company name *</label>
            <input className="field" value={companyName} onChange={e => setCompanyName(e.target.value)}
              placeholder="Acme Corp" autoFocus />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label>Website</label>
              <input className="field" type="url" value={website} onChange={e => setWebsite(e.target.value)}
                placeholder="https://yourcompany.com" />
            </div>
            <div>
              <label>Headquarters</label>
              <input className="field" value={hq} onChange={e => setHq(e.target.value)}
                placeholder="Dubai, UAE" />
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-black text-[#F4F4F7] mb-0.5">✨ Auto-fill from your website</p>
                <p className="text-xs text-[#A6A6B4]">
                  We&apos;ll scan Glassdoor, LinkedIn, Reddit + news. ~15 seconds. Review + edit before saving.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePull}
                disabled={pulling || !website.trim()}
                className="text-xs font-black px-4 py-2 rounded-full whitespace-nowrap disabled:opacity-40"
                style={{ background: '#38BDF8', color: '#fff' }}
              >
                {pulling ? 'Pulling…' : 'Pull now'}
              </button>
            </div>
            {pullNote && (
              <p className="text-xs mt-3 leading-relaxed" style={{ color: '#34D399' }}>
                {pullNote}
              </p>
            )}
          </div>

          <div>
            <label>Company size</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {SIZES.map(s => (
                <button key={s} type="button" onClick={() => setSize(s)}
                  className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                    size === s
                      ? 'bg-[#38BDF8] text-[#fff]'
                      : 'bg-[rgba(255,255,255,0.05)] text-[#A6A6B4] hover:bg-[rgba(255,255,255,0.07)]'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label>What makes your company a great place to work? <span className="text-[#5C5C6A] normal-case font-normal">(optional)</span></label>
            <textarea className="field" rows={3} value={about} onChange={e => setAbout(e.target.value)}
              placeholder="Culture, mission, what kind of people thrive here..."
              style={{ resize: 'vertical' }} />
          </div>

          <div>
            <label>WhatsApp number <span className="text-[#5C5C6A] normal-case font-normal">(strongly recommended — most of Shapi runs through WhatsApp)</span></label>
            <PhoneInput value={whatsapp} onChange={setWhatsapp} placeholder="50 123 4567" />
            <p className="text-[10px] text-[#7E7E8E] mt-1.5">Shortlists, role drafts, voice org-design, candidate research — all via WhatsApp.</p>
          </div>
        </div>

        <div className="gradient-border-card rounded-2xl p-5 mb-6">
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-1">Always shown to candidates</p>
          <p className="text-[#5C5C6A] text-xs mb-3">
            These signals come from independent sources — Glassdoor, Reddit, news. They&apos;re visible
            alongside your own description and are not editable. That&apos;s the trust floor.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: '⭐', label: 'Glassdoor rating' },
              { icon: '💬', label: 'Reddit sentiment' },
              { icon: '📰', label: 'Recent news' },
              { icon: '🏢', label: 'Headcount & industry' },
            ].map((item, i) => (
              <div key={i} className="bg-[rgba(255,255,255,0.05)] rounded-xl p-3 text-center">
                <div className="text-lg mb-1">{item.icon}</div>
                <p className="text-[#A6A6B4] text-xs">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={submit}
          disabled={saving}
          className="w-full bg-gradient-to-r from-[#38BDF8] to-[#38BDF8] py-4 rounded-full font-black text-sm text-[#fff] hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? 'Setting up...' : 'Set up company — takes 15 seconds →'}
        </button>
      </div>
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060609] flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full">{children}</div>
    </div>
  )
}
