'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'

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

export default function CompanyOnboarding() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('profile')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Auto-fill state — fires the enrichment endpoint pre-submit so users see
  // the magic before they commit. ~15s spinner.
  const [pulling, setPulling] = useState(false)
  const [pullNote, setPullNote] = useState<string | null>(null)

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
  const [whatsapp, setWhatsapp] = useState('+971 ')

  const handlePull = async () => {
    setError(''); setPullNote(null)
    if (!website.trim()) { setError('Add a website first'); return }
    const nameForPull = companyName.trim() || nameFromWebsite(website.trim())
    if (!nameForPull) { setError('Could not derive a name from that URL. Add the company name.'); return }
    setPulling(true)
    try {
      const res = await fetch('/api/company/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: nameForPull, website: website.trim() }),
      })
      if (!res.ok) { setError('Pull failed. Add details manually.'); return }
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
      console.error('[onboarding] pull error:', err)
      setError('Pull failed. Add details manually.')
    } finally {
      setPulling(false)
    }
  }

  const submit = async () => {
    setError('')
    if (!companyName.trim()) { setError('Company name is required'); return }

    setSaving(true)

    // Save company profile
    await fetch('/api/profile/update', {
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

    // Trigger enrichment in background (non-blocking)
    setStage('enriching')
    setSaving(false)

    try {
      await fetch('/api/company/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName.trim(),
          website: website.trim() || null,
        }),
      })
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
            Takes 2 minutes. We pull your company data from public sources automatically — Glassdoor, LinkedIn, Reddit, news.
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
            <input className="field" type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
              placeholder="+971 50 123 4567" />
            <p className="text-[10px] text-[#7E7E8E] mt-1.5">Shortlists, role drafts, voice org-design, candidate research — all via WhatsApp. UAE +971 · KSA +966 · UK +44.</p>
          </div>
        </div>

        {/* What Shapi will pull automatically */}
        <div className="gradient-border-card rounded-2xl p-5 mb-6">
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-3">We&apos;ll pull automatically</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: '⭐', label: 'Glassdoor rating' },
              { icon: '💬', label: 'Reddit sentiment' },
              { icon: '📰', label: 'Recent news' },
              { icon: '🏢', label: 'Company size & industry' },
            ].map((item, i) => (
              <div key={i} className="bg-[rgba(255,255,255,0.05)] rounded-xl p-3 text-center">
                <div className="text-lg mb-1">{item.icon}</div>
                <p className="text-[#A6A6B4] text-xs">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[#5C5C6A] text-xs mt-3">
            Sourced from public data. Candidates see this alongside your job postings. You can edit anything.
          </p>
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
