'use client'

import { useState } from 'react'

const steps = ['Your story', 'Work history', 'Skills', 'References', 'Done']

type WorkEntry = {
  title: string
  company: string
  start: string
  end: string
  achievements: string
}

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step 0 — Your story
  const [name, setName] = useState('')
  const [headline, setHeadline] = useState('')
  const [location, setLocation] = useState('')
  const [summary, setSummary] = useState('')

  // Step 1 — Work history
  const [work, setWork] = useState<WorkEntry[]>([
    { title: '', company: '', start: '', end: '', achievements: '' }
  ])

  // Step 2 — Skills
  const [aiTier, setAiTier] = useState<'user' | 'integrator' | 'builder' | ''>('')
  const [skillsInput, setSkillsInput] = useState('')

  // Step 3 — References
  const [refName, setRefName] = useState('')
  const [refEmail, setRefEmail] = useState('')
  const [refRelationship, setRefRelationship] = useState('')

  const saveStep = async (data: Record<string, unknown>) => {
    setSaving(true)
    await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, onboarding_step: step + 1 }),
    })
    setSaving(false)
  }

  const next = async () => {
    if (step === 0) {
      await saveStep({ full_name: name, headline, location, summary })
    } else if (step === 1) {
      await saveStep({ work_history: work })
    } else if (step === 2) {
      const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean)
      await saveStep({ skills, ai_tier: aiTier || null })
    } else if (step === 3) {
      await saveStep({
        onboarding_complete: true,
        completion_pct: 70,
      })
      // TODO: trigger reference outreach email via Resend
    }
    setStep(s => s + 1)
  }

  const updateWork = (i: number, field: keyof WorkEntry, value: string) => {
    setWork(prev => prev.map((w, idx) => idx === i ? { ...w, [field]: value } : w))
  }

  return (
    <div className="min-h-screen bg-[#0E0E13]">
      <nav className="px-6 py-5 flex items-center justify-between max-w-4xl mx-auto">
        <span className="font-bold text-2xl tracking-tight" style={{
          background: 'linear-gradient(135deg, #F08CAE, #6AA8F5, #F58E9A)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</span>
        <span className="text-[#5C5C6A] text-sm">Step {step + 1} of {steps.length}</span>
      </nav>

      {/* Progress bar */}
      <div className="max-w-4xl mx-auto px-6">
        <div className="h-1 bg-[rgba(255,255,255,0.08)] rounded-full">
          <div
            className="h-1 rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%`, background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)' }}
          />
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((s, i) => (
            <span key={i} className={`text-xs font-medium ${i <= step ? 'text-[#6AA8F5]' : 'text-[#5C5C6A]'}`}>
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 pt-12 pb-20">

        {/* Step 0 — Your story */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-[#F4F4F7] mb-2">Let&apos;s start with you.</h1>
              <p className="text-[#A6A6B4]">No CV template. Just tell us who you are.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#C7C7D1] mb-2">Full name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ana Barber"
                  className="w-full bg-[#16161F] border border-[rgba(255,255,255,0.08)] rounded-2xl px-5 py-4 text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#C7C7D1] mb-2">Your headline</label>
                <input type="text" value={headline} onChange={e => setHeadline(e.target.value)}
                  placeholder="Operations Director | Giga-project delivery | MENA"
                  className="w-full bg-[#16161F] border border-[rgba(255,255,255,0.08)] rounded-2xl px-5 py-4 text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#C7C7D1] mb-2">Location</label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Dubai, UAE"
                  className="w-full bg-[#16161F] border border-[rgba(255,255,255,0.08)] rounded-2xl px-5 py-4 text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#C7C7D1] mb-2">In your own words — who are you and what are you looking for?</label>
                <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={5}
                  placeholder="I've spent 8 years delivering large-scale operations across the GCC. I'm looking for a Chief of Staff or Operations Director role..."
                  className="w-full bg-[#16161F] border border-[rgba(255,255,255,0.08)] rounded-2xl px-5 py-4 text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors resize-none" />
                <p className="text-xs text-[#5C5C6A] mt-2">Write like you&apos;re explaining to someone at a networking event.</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 1 — Work history */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-[#F4F4F7] mb-2">Your work history.</h1>
              <p className="text-[#A6A6B4]">Add your most relevant roles. We verify these independently.</p>
            </div>
            {work.map((w, i) => (
              <div key={i} className="bg-[#16161F] rounded-2xl p-6 border border-[rgba(255,255,255,0.08)] space-y-4">
                <p className="text-sm font-medium text-[#6AA8F5]">{i === 0 ? 'Most recent role' : `Role ${i + 1}`}</p>
                <input type="text" placeholder="Job title" value={w.title} onChange={e => updateWork(i, 'title', e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-transparent rounded-xl px-4 py-3 text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors text-sm" />
                <input type="text" placeholder="Company name" value={w.company} onChange={e => updateWork(i, 'company', e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-transparent rounded-xl px-4 py-3 text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Start (e.g. Jan 2022)" value={w.start} onChange={e => updateWork(i, 'start', e.target.value)}
                    className="bg-[rgba(255,255,255,0.05)] border border-transparent rounded-xl px-4 py-3 text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors text-sm" />
                  <input type="text" placeholder="End or 'Present'" value={w.end} onChange={e => updateWork(i, 'end', e.target.value)}
                    className="bg-[rgba(255,255,255,0.05)] border border-transparent rounded-xl px-4 py-3 text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors text-sm" />
                </div>
                <textarea placeholder="What did you actually achieve? Numbers, scale, impact. Don't undersell yourself." rows={4}
                  value={w.achievements} onChange={e => updateWork(i, 'achievements', e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-transparent rounded-xl px-4 py-3 text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors text-sm resize-none" />
              </div>
            ))}
            <button
              onClick={() => setWork(prev => [...prev, { title: '', company: '', start: '', end: '', achievements: '' }])}
              className="text-sm text-[#6AA8F5] font-medium flex items-center gap-2"
            >
              <span className="w-6 h-6 rounded-full border-2 border-[#6AA8F5] flex items-center justify-center text-xs">+</span>
              Add another role
            </button>
          </div>
        )}

        {/* Step 2 — Skills */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-[#F4F4F7] mb-2">Skills & AI proficiency.</h1>
              <p className="text-[#A6A6B4]">We verify by evidence — not just what you claim.</p>
            </div>
            <div className="bg-[#16161F] rounded-2xl p-6 border border-[rgba(255,255,255,0.08)] space-y-4">
              <p className="text-sm font-medium text-[#C7C7D1]">How do you use AI in your work?</p>
              {[
                { val: 'user', label: 'I use AI tools in my daily work', sub: 'ChatGPT, Claude, Copilot etc.' },
                { val: 'integrator', label: 'I integrate AI into workflows and processes', sub: 'Automations, prompting, building pipelines' },
                { val: 'builder', label: 'I build AI-powered tools or systems', sub: 'APIs, agents, custom models' },
              ].map(opt => (
                <label key={opt.val} onClick={() => setAiTier(opt.val as 'user' | 'integrator' | 'builder')}
                  className="flex items-start gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex-shrink-0 transition-colors ${aiTier === opt.val ? 'border-[#6AA8F5] bg-[#6AA8F5]' : 'border-[#6AA8F5]/30 group-hover:border-[#6AA8F5]'}`} />
                  <div>
                    <p className="text-sm text-[#F4F4F7] font-medium">{opt.label}</p>
                    <p className="text-xs text-[#5C5C6A]">{opt.sub}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="bg-[#16161F] rounded-2xl p-6 border border-[rgba(255,255,255,0.08)]">
              <label className="block text-sm font-medium text-[#C7C7D1] mb-3">Top skills (comma-separated)</label>
              <input type="text" value={skillsInput} onChange={e => setSkillsInput(e.target.value)}
                placeholder="Operations Management, Stakeholder Engagement, P&L, Team Leadership..."
                className="w-full bg-[rgba(255,255,255,0.05)] border border-transparent rounded-xl px-4 py-3 text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors text-sm" />
              <p className="text-xs text-[#5C5C6A] mt-2">Our AI will also find hidden skills from your work history and references.</p>
            </div>
          </div>
        )}

        {/* Step 3 — References */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-[#F4F4F7] mb-2">One reference to start.</h1>
              <p className="text-[#A6A6B4]">We contact them directly. You don&apos;t choose what they say — that&apos;s what makes Shapi references different.</p>
            </div>
            <div className="bg-[rgba(106,168,245,0.08)] rounded-2xl p-5 border border-[rgba(106,168,245,0.15)]">
              <p className="text-sm text-[#6AA8F5] font-medium mb-1">How it works</p>
              <p className="text-sm text-[#A6A6B4] leading-relaxed">
                We reach out with structured questions. Their responses appear on your profile — including skills you may have forgotten. You can&apos;t edit or remove reference content.
              </p>
            </div>
            <div className="bg-[#16161F] rounded-2xl p-6 border border-[rgba(255,255,255,0.08)] space-y-4">
              <input type="text" value={refName} onChange={e => setRefName(e.target.value)} placeholder="Reference full name"
                className="w-full bg-[rgba(255,255,255,0.05)] border border-transparent rounded-xl px-4 py-3 text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors text-sm" />
              <input type="email" value={refEmail} onChange={e => setRefEmail(e.target.value)} placeholder="Reference work email"
                className="w-full bg-[rgba(255,255,255,0.05)] border border-transparent rounded-xl px-4 py-3 text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors text-sm" />
              <input type="text" value={refRelationship} onChange={e => setRefRelationship(e.target.value)}
                placeholder="How did they know your work? (e.g. Direct manager at NEOM 2022–2024)"
                className="w-full bg-[rgba(255,255,255,0.05)] border border-transparent rounded-xl px-4 py-3 text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors text-sm" />
            </div>
          </div>
        )}

        {/* Step 4 — Done */}
        {step === 4 && (
          <div className="text-center space-y-6 pt-8">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto text-white text-3xl"
              style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)' }}>✓</div>
            <div>
              <h1 className="text-3xl font-bold text-[#F4F4F7] mb-3">Profile submitted.</h1>
              <p className="text-[#A6A6B4] max-w-md mx-auto leading-relaxed">
                We&apos;re verifying your information and contacting your reference. Your profile goes live once verification is complete — usually within 48 hours.
              </p>
            </div>
            <div className="bg-[#16161F] rounded-2xl p-6 border border-[rgba(255,255,255,0.08)] text-left space-y-3">
              <p className="text-sm font-medium text-[#C7C7D1]">What happens next</p>
              {[
                'Reference outreach sent within 24 hours',
                'AI skills verification runs on your work history',
                'Profile goes live once 70% complete',
                'Matched companies can view your verified profile',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[rgba(106,168,245,0.12)] flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-[#6AA8F5]" />
                  </div>
                  <p className="text-sm text-[#A6A6B4]">{item}</p>
                </div>
              ))}
            </div>
            <a href="/dashboard" className="inline-block text-white px-8 py-4 rounded-full font-semibold text-sm hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)' }}>
              Go to dashboard →
            </a>
          </div>
        )}

        {/* Nav buttons */}
        {step < 4 && (
          <div className="flex gap-3 mt-10">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="px-6 py-4 rounded-full border border-[rgba(255,255,255,0.08)] text-[#A6A6B4] text-sm font-medium hover:border-[rgba(255,255,255,0.15)] transition-colors">
                Back
              </button>
            )}
            <button onClick={next} disabled={saving}
              className="flex-1 text-white py-4 rounded-full font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)' }}>
              {saving ? 'Saving...' : step === 3 ? 'Submit profile →' : 'Continue →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
