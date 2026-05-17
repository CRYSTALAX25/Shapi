'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type ReferenceData = {
  referee_name: string
  candidate_name: string
  referee_relationship: string
  status: string
}

const REHIRE_OPTIONS = [
  { val: 'yes_definitely', label: 'Yes, without hesitation', icon: '🟢' },
  { val: 'yes_right_role', label: 'Yes, in the right role', icon: '🟡' },
  { val: 'not_sure', label: 'Not sure', icon: '🟠' },
  { val: 'no', label: 'No', icon: '🔴' },
]

export default function ReferencePage() {
  const { token } = useParams()
  const [ref, setRef] = useState<ReferenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const [quality, setQuality] = useState('')
  const [achievement, setAchievement] = useState('')
  const [skills, setSkills] = useState('')
  const [wouldRehire, setWouldRehire] = useState('')
  const [anythingElse, setAnythingElse] = useState('')

  useEffect(() => {
    fetch(`/api/references/form?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setNotFound(true)
        else { setRef(data); if (data.status === 'completed') setDone(true) }
        setLoading(false)
      })
  }, [token])

  const submit = async () => {
    if (!quality || !achievement || !skills || !wouldRehire) return
    setSubmitting(true)
    await fetch('/api/references/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, quality, achievement, skills, would_rehire: wouldRehire, anything_else: anythingElse }),
    })
    setDone(true)
    setSubmitting(false)
  }

  const canSubmit = quality.trim() && achievement.trim() && skills.trim() && wouldRehire

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center">
        <div className="flex gap-2">
          {[0, 150, 300].map(d => (
            <div key={d} className="w-2 h-2 rounded-full bg-[#22D3EE]/40 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-2xl font-black text-white mb-3">Link not found</h1>
          <p className="text-white/40 text-sm leading-relaxed">This reference link is invalid or has already been completed.</p>
        </div>
      </div>
    )
  }

  if (done) {
    const firstName = ref?.referee_name?.split(' ')[0] || 'there'
    const candidateFirst = ref?.candidate_name?.split(' ')[0] || 'them'
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center px-6">
        <div className="fixed inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.07) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }} />
        <div className="relative z-10 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center text-2xl"
            style={{ background: 'linear-gradient(135deg, #22D3EE, #A78BFA)' }}>✓</div>
          <h1 className="text-2xl font-black text-white mb-3">Thank you, {firstName}.</h1>
          <p className="text-white/45 text-sm leading-relaxed mb-6">
            Your reference for {ref?.candidate_name} has been submitted and will appear on their verified Shapi profile.
            {candidateFirst} cannot edit your responses — they appear exactly as you wrote them.
          </p>
          <p className="text-white/20 text-xs">
            Built on <Link href="/" className="text-white/30 hover:text-white/50">shapi.io</Link>
          </p>
        </div>
      </div>
    )
  }

  const firstName = ref?.candidate_name?.split(' ')[0] || 'them'

  return (
    <div className="min-h-screen bg-[#060609]">
      <style>{`
        .field {
          width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
          border-radius: 12px; padding: 14px 16px; font-size: 14px; color: white; outline: none;
          transition: border-color 0.2s; resize: vertical; font-family: inherit; line-height: 1.6;
        }
        .field::placeholder { color: rgba(255,255,255,0.18); }
        .field:focus { border-color: rgba(34,211,238,0.4); }
        .gradient-border-card {
          background: linear-gradient(#0d0d14, #0d0d14) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.12), rgba(139,92,246,0.12)) border-box;
          border: 1px solid transparent;
        }
        .q-label { display: block; font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.85); margin-bottom: 4px; }
        .q-hint { font-size: 12px; color: rgba(255,255,255,0.28); margin-bottom: 12px; line-height: 1.5; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.06) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-5 border-b border-white/[0.06]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-24">

        {/* Header */}
        <div className="mb-8">
          <span className="text-[#22D3EE] text-xs font-bold uppercase tracking-wider">Reference request</span>
          <h1 className="text-3xl font-black text-white mt-2 mb-3">
            A reference for {ref?.candidate_name}
          </h1>
          <p className="text-white/40 text-sm leading-relaxed max-w-lg">
            {ref?.candidate_name} listed you as their <strong className="text-white/60">{ref?.referee_relationship}</strong>.
            Takes about 5 minutes. Your answers appear verbatim on their verified profile
            — {firstName} cannot edit them.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 mb-8">
          {[quality, achievement, skills, wouldRehire].map((val, i) => (
            <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ background: val ? 'linear-gradient(90deg, #22D3EE, #A78BFA)' : 'rgba(255,255,255,0.08)' }} />
          ))}
        </div>

        <div className="space-y-4">

          {/* Q1 — Quality */}
          <div className="gradient-border-card rounded-2xl p-6">
            <label className="q-label">
              How would you describe the quality of {firstName}&apos;s work?
              <span className="text-[#FB7185] ml-1">*</span>
            </label>
            <p className="q-hint">Be specific — vague answers are less useful than honest detail.</p>
            <textarea className="field" rows={4} value={quality} onChange={e => setQuality(e.target.value)}
              placeholder={`${firstName} was consistently… The quality of their work stood out because…`} />
          </div>

          {/* Q2 — Achievement */}
          <div className="gradient-border-card rounded-2xl p-6">
            <label className="q-label">
              What&apos;s a specific achievement that shows what {firstName} is capable of?
              <span className="text-[#FB7185] ml-1">*</span>
            </label>
            <p className="q-hint">Numbers, scale, or a specific project if you can — one concrete example is worth ten adjectives.</p>
            <textarea className="field" rows={4} value={achievement} onChange={e => setAchievement(e.target.value)}
              placeholder="One example that comes to mind is…" />
          </div>

          {/* Q3 — Skills */}
          <div className="gradient-border-card rounded-2xl p-6">
            <label className="q-label">
              What skills or strengths does {firstName} have that might not be obvious from a CV?
              <span className="text-[#FB7185] ml-1">*</span>
            </label>
            <p className="q-hint">Hidden skills, soft skills, things they undersell themselves on.</p>
            <textarea className="field" rows={3} value={skills} onChange={e => setSkills(e.target.value)}
              placeholder="Something people don&apos;t always realise about them is…" />
          </div>

          {/* Q4 — Would rehire */}
          <div className="gradient-border-card rounded-2xl p-6">
            <label className="q-label mb-4 block">
              Would you work with {firstName} again?
              <span className="text-[#FB7185] ml-1">*</span>
            </label>
            <div className="space-y-2">
              {REHIRE_OPTIONS.map(opt => (
                <button key={opt.val} type="button" onClick={() => setWouldRehire(opt.val)}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-150 text-left"
                  style={{
                    background: wouldRehire === opt.val ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.03)',
                    border: wouldRehire === opt.val ? '1px solid rgba(34,211,238,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  }}>
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    wouldRehire === opt.val
                      ? 'border-[#22D3EE] bg-[#22D3EE]'
                      : 'border-white/20'
                  }`}>
                    {wouldRehire === opt.val && <div className="w-2 h-2 rounded-full bg-[#060609]" />}
                  </div>
                  <span className="text-sm" style={{ color: wouldRehire === opt.val ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Q5 — Optional */}
          <div className="gradient-border-card rounded-2xl p-6">
            <label className="q-label">Anything else you&apos;d want an employer to know?</label>
            <p className="q-hint">Optional — but often the most valuable part.</p>
            <textarea className="field" rows={3} value={anythingElse} onChange={e => setAnythingElse(e.target.value)}
              placeholder="Optional…" />
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="w-full py-4 rounded-full font-black text-sm transition-opacity disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #22D3EE, #A78BFA)', color: '#060609' }}>
            {submitting ? 'Submitting…' : 'Submit reference →'}
          </button>

          <p className="text-center text-xs text-white/20">
            Your responses are final once submitted. {firstName} will see them but cannot edit them.
          </p>
        </div>
      </div>
    </div>
  )
}
