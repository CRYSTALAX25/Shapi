'use client'

import { useState } from 'react'
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
        <h2 className="text-2xl font-black text-white mb-3 text-center">Setting up your company profile...</h2>
        <p className="text-white/40 text-sm text-center leading-relaxed max-w-xs">
          Pulling public data — Glassdoor rating, Reddit sentiment, recent news. About 15 seconds.
        </p>
      </Screen>
    )
  }

  if (stage === 'done') {
    return (
      <Screen>
        <ShapiCharacter mood="happy" size={90} className="mb-6" />
        <h2 className="text-2xl font-black text-white mb-3 text-center">
          {companyName} is set up.
        </h2>
        <p className="text-white/40 text-sm text-center leading-relaxed mb-8 max-w-xs">
          We&apos;ve pulled your company intelligence from public sources. Post your first role and we&apos;ll start matching.
        </p>
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => router.push('/company/roles/new')}
            className="w-full bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] py-4 rounded-full font-black text-sm text-[#060609] hover:opacity-90 transition-opacity">
            Post your first role →
          </button>
          <button
            onClick={() => router.push('/company/dashboard')}
            className="w-full py-3 text-sm text-white/30 hover:text-white/60 transition-colors">
            Go to dashboard first
          </button>
        </div>
      </Screen>
    )
  }

  return (
    <div className="min-h-screen bg-[#060609]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#0d0d14, #0d0d14) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.15), rgba(139,92,246,0.15)) border-box;
          border: 1px solid transparent;
        }
        .field { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 16px; font-size: 14px; color: white; outline: none; transition: border-color 0.2s; }
        .field::placeholder { color: rgba(255,255,255,0.2); }
        .field:focus { border-color: rgba(34,211,238,0.5); }
        label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.35); margin-bottom: 8px; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.07) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-3xl mx-auto border-b border-white/[0.05]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <span className="text-white/25 text-xs">Company setup</span>
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-24">

        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Set up your company.</h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Takes 2 minutes. We pull your company data from public sources automatically — Glassdoor, LinkedIn, Reddit, news.
          </p>
        </div>

        {error && (
          <div className="bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3 mb-6 text-sm text-[#FB7185]">{error}</div>
        )}

        <div className="gradient-border-card rounded-2xl p-6 mb-5 space-y-4">
          <p className="text-white/50 text-xs font-bold uppercase tracking-wider">Company details</p>

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
                      ? 'bg-[#22D3EE] text-[#060609]'
                      : 'bg-white/[0.05] text-white/40 hover:bg-white/[0.08]'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label>What makes your company a great place to work? <span className="text-white/20 normal-case font-normal">(optional)</span></label>
            <textarea className="field" rows={3} value={about} onChange={e => setAbout(e.target.value)}
              placeholder="Culture, mission, what kind of people thrive here..."
              style={{ resize: 'vertical' }} />
          </div>
        </div>

        {/* What Shapi will pull automatically */}
        <div className="gradient-border-card rounded-2xl p-5 mb-6">
          <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">We&apos;ll pull automatically</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: '⭐', label: 'Glassdoor rating' },
              { icon: '💬', label: 'Reddit sentiment' },
              { icon: '📰', label: 'Recent news' },
              { icon: '🏢', label: 'Company size & industry' },
            ].map((item, i) => (
              <div key={i} className="bg-white/[0.03] rounded-xl p-3 text-center">
                <div className="text-lg mb-1">{item.icon}</div>
                <p className="text-white/40 text-xs">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="text-white/20 text-xs mt-3">
            Sourced from public data. Candidates see this alongside your job postings. You can edit anything.
          </p>
        </div>

        <button
          onClick={submit}
          disabled={saving}
          className="w-full bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] py-4 rounded-full font-black text-sm text-[#060609] hover:opacity-90 transition-opacity disabled:opacity-50">
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
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.08) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full">{children}</div>
    </div>
  )
}
