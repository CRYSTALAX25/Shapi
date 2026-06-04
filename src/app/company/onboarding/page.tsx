'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

export default function CompanyOnboarding() {
  const router = useRouter()
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

  // Restore on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        if (d.companyName) setCompanyName(d.companyName)
        if (d.website) setWebsite(d.website)
        if (d.hq) setHq(d.hq)
        if (d.size) setSize(d.size)
        if (d.about) setAbout(d.about)
        if (d.whatsapp) setWhatsapp(d.whatsapp)
      }
    } catch { /* corrupt draft — ignore */ }
    setRestored(true)
  }, [])

  // Persist on any field change AFTER the restore has happened (otherwise
  // the first render with empty state would clobber the saved draft).
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
    // 90s client-side abort — the server has 120s headroom, the client kills
    // it at 90s if something hangs and shows a friendly retry. Prevents the
    // "page couldn't load" Chrome-level error Ana hit on cold starts.
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
      // Prefill empties only — don't clobber user typing.
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

    // Save company profile — and ACTUALLY check the response. Previous version
    // ignored errors silently which meant a failed save still advanced to the
    // 'enriching' spinner and ultimately redirected the user to a page they
    // had no permission to see, bouncing them back to onboarding with empty
    // form state. Now we surface errors and keep the form populated.
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
          // Only persist whatsapp_number if it's more than the +country-code stub.
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
      saveOk = true
    } catch (err) {
      console.error('[onboarding] save error:', err)
      setError("Network issue saving your details. They're still here — try again.")
      setSaving(false)
      return
    }

    if (!saveOk) return

    // Save succeeded — safe to clear the localStorage draft.
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }

    // Trigger enrichment in background (non-blocking)
    setStage('enriching')
    setSaving(false)

    // Background enrichment — best-effort, capped at 90s. The user is
    // already on the 'enriching' spinner; if it hangs, the Done stage still
    // fires and the workforce-snapshot redirect proceeds.
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

  // Auto-redirect to the Workforce Snapshot 2s after the Done celebration —
  // the Snapshot is the §16 Tier A acquisition wedge and MUST be the first
  // real experience, not a buried dashboard card. The "Skip — dashboard"
  // button gives an escape hatch for testers / returning users.
  useEffect(() => {
    if (stage !== 'done') return
    const t = setTimeout(() => router.push('/company/workforce-snapshot?first=true'), 2000)
    return () => clearTimeout(t)
  }, [stage, router])

  if (stage === 'done') {
    return (
      <Screen>
        <ShapiCharacter mood="happy" size={90} className="mb-6" />
        <h2 className="text-2xl font-black text-[#F4F4F7] mb-3 text-center">
          {companyName} is set up.
        </h2>
        <p className="text-[#A6A6B4] text-sm text-center leading-relaxed mb-6 max-w-xs">
          Taking you to your free 30-second Workforce Snapshot — the move that anchors everything else.
        </p>
        <div className="flex items-center gap-2 mb-8" style={{ color: '#F08CAE' }}>
          <div className="w-4 h-4 rounded-full border-2 border-[#F08CAE]/30 border-t-[#F08CAE] animate-spin" />
          <span className="text-xs font-bold">Loading your Snapshot…</span>
        </div>
        <div className="w-full max-w-sm space-y-3">
          {/* Workforce Snapshot is the wedge (STRATEGY §16 Tier A). It's the
              first thing new companies should run — frames everything else
              (roadmap, org design, AI exposure). Posting a role first means
              hiring blind. */}
          <button
            onClick={() => router.push('/company/workforce-snapshot?first=true')}
            className="w-full py-4 rounded-full font-black text-sm text-[#fff] hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
            ✦ Run your Snapshot now →
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
    <div className="min-h-screen bg-[#0E0E13]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.15), rgba(79,143,232,0.15)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .field { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 16px; font-size: 14px; color: #F4F4F7; outline: none; transition: border-color 0.2s; }
        .field::placeholder { color: rgba(126,126,142,1); }
        .field:focus { border-color: rgba(106,168,245,0.5); }
        label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #A6A6B4; margin-bottom: 8px; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/company/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">← Dashboard</Link>
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
          <div className="bg-[#F58E9A]/10 border border-[#F58E9A]/20 rounded-xl px-4 py-3 mb-6 text-sm text-[#F58E9A]">{error}</div>
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

          {/* ── Pull-from-website button ─────────────────────────────────────
              Fires /api/company/enrich now (not after submit) so the user
              sees HQ + size + description appear in the form. Closes the
              "the page promises auto-fill but nothing happens" gap. */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(106,168,245,0.08)', border: '1px solid rgba(106,168,245,0.25)' }}>
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
                style={{ background: '#6AA8F5', color: '#fff' }}
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
                      ? 'bg-[#6AA8F5] text-[#fff]'
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

        {/* Public signals on the company profile. Always visible to
            candidates — companies cannot hide or override them. This is the
            verification floor; transparency is the moat. The only editable
            content is what the company writes themselves (description,
            "what makes us great"). Public-source signals stay. */}
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
          className="w-full bg-gradient-to-r from-[#6AA8F5] to-[#4F8FE8] py-4 rounded-full font-black text-sm text-[#fff] hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? 'Setting up...' : 'Set up company — takes 15 seconds →'}
        </button>
      </div>
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0E0E13] flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full">{children}</div>
    </div>
  )
}
