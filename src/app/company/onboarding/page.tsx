'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'

type Stage = 'profile' | 'enriching' | 'done'

const SIZES = ['1–10', '11–50', '51–200', '201–500', '500–2000', '2000+']

export default function CompanyOnboarding() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('profile')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
