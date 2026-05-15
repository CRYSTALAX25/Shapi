'use client'

import { useState } from 'react'

const steps = ['Your story', 'Work history', 'Skills', 'References', 'Done']

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState({
    name: '',
    headline: '',
    location: '',
    message: '',
    roles: [] as string[],
    skills: [] as string[],
    refName: '',
    refEmail: '',
    refRelationship: '',
  })

  const update = (field: string, value: string) =>
    setData(prev => ({ ...prev, [field]: value }))

  return (
    <div className="min-h-screen bg-[#F8F4EE]">
      {/* Nav */}
      <nav className="px-6 py-5 flex items-center justify-between max-w-4xl mx-auto">
        <span className="text-[#0B5563] font-bold text-2xl tracking-tight">shapi</span>
        <span className="text-[#1C1C2E]/40 text-sm">Step {step + 1} of {steps.length}</span>
      </nav>

      {/* Progress bar */}
      <div className="max-w-4xl mx-auto px-6">
        <div className="h-1 bg-[#1C1C2E]/10 rounded-full">
          <div
            className="h-1 bg-[#0B5563] rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((s, i) => (
            <span
              key={i}
              className={`text-xs font-medium ${i <= step ? 'text-[#0B5563]' : 'text-[#1C1C2E]/30'}`}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="max-w-2xl mx-auto px-6 pt-12 pb-20">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-[#1C1C2E] mb-2">Let's start with you.</h1>
              <p className="text-[#1C1C2E]/60">Tell us who you are. No CV template needed — just talk to us.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1C1C2E] mb-2">Your full name</label>
                <input
                  type="text"
                  value={data.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="Ana Barber"
                  className="w-full bg-white border border-[#1C1C2E]/10 rounded-2xl px-5 py-4 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1C1C2E] mb-2">Your headline</label>
                <input
                  type="text"
                  value={data.headline}
                  onChange={e => update('headline', e.target.value)}
                  placeholder="e.g. Operations Director | Giga-project delivery | MENA"
                  className="w-full bg-white border border-[#1C1C2E]/10 rounded-2xl px-5 py-4 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1C1C2E] mb-2">Location</label>
                <input
                  type="text"
                  value={data.location}
                  onChange={e => update('location', e.target.value)}
                  placeholder="e.g. Dubai, UAE"
                  className="w-full bg-white border border-[#1C1C2E]/10 rounded-2xl px-5 py-4 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1C1C2E] mb-2">
                  In your own words — what do you do, and what are you looking for?
                </label>
                <textarea
                  value={data.message}
                  onChange={e => update('message', e.target.value)}
                  placeholder="I've spent 8 years delivering large-scale operations across the GCC. I'm now looking for a Chief of Staff or Operations Director role where I can help a leadership team scale fast..."
                  rows={5}
                  className="w-full bg-white border border-[#1C1C2E]/10 rounded-2xl px-5 py-4 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors resize-none"
                />
                <p className="text-xs text-[#1C1C2E]/40 mt-2">
                  Write like you're explaining to someone at a networking event. Our AI will help shape this into a verified profile.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-[#1C1C2E] mb-2">Your work history.</h1>
              <p className="text-[#1C1C2E]/60">Add your most recent and relevant roles. We'll verify these independently.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#1C1C2E]/10 space-y-4">
              <p className="text-sm font-medium text-[#0B5563]">Most recent role</p>
              <input
                type="text"
                placeholder="Job title"
                className="w-full bg-[#F8F4EE] border border-transparent rounded-xl px-4 py-3 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors text-sm"
              />
              <input
                type="text"
                placeholder="Company name"
                className="w-full bg-[#F8F4EE] border border-transparent rounded-xl px-4 py-3 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Start (e.g. Jan 2022)"
                  className="bg-[#F8F4EE] border border-transparent rounded-xl px-4 py-3 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors text-sm"
                />
                <input
                  type="text"
                  placeholder="End (or 'Present')"
                  className="bg-[#F8F4EE] border border-transparent rounded-xl px-4 py-3 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors text-sm"
                />
              </div>
              <textarea
                placeholder="What did you actually achieve here? Numbers, scale, impact. Don't undersell yourself."
                rows={4}
                className="w-full bg-[#F8F4EE] border border-transparent rounded-xl px-4 py-3 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors text-sm resize-none"
              />
            </div>
            <button className="text-sm text-[#0B5563] font-medium flex items-center gap-2">
              <span className="w-6 h-6 rounded-full border-2 border-[#0B5563] flex items-center justify-center text-xs">+</span>
              Add another role
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-[#1C1C2E] mb-2">Skills & AI proficiency.</h1>
              <p className="text-[#1C1C2E]/60">We verify skills by evidence — not just what you claim.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#1C1C2E]/10 space-y-5">
              <p className="text-sm font-medium text-[#1C1C2E]">AI tools you use in your work</p>
              {['I use AI tools in my daily work (User)', 'I integrate AI into workflows and processes (Integrator)', 'I build AI-powered tools or systems (Builder)'].map((label, i) => (
                <label key={i} className="flex items-start gap-3 cursor-pointer group">
                  <div className="w-5 h-5 rounded-full border-2 border-[#0B5563]/30 mt-0.5 flex-shrink-0 group-hover:border-[#0B5563] transition-colors" />
                  <span className="text-sm text-[#1C1C2E]/70 group-hover:text-[#1C1C2E] transition-colors">{label}</span>
                </label>
              ))}
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#1C1C2E]/10">
              <p className="text-sm font-medium text-[#1C1C2E] mb-4">Top skills (add up to 10)</p>
              <input
                type="text"
                placeholder="e.g. Operations Management, Stakeholder Engagement, P&L..."
                className="w-full bg-[#F8F4EE] border border-transparent rounded-xl px-4 py-3 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors text-sm"
              />
              <p className="text-xs text-[#1C1C2E]/40 mt-2">Separate with commas. Our AI will also discover hidden skills from your work history and references.</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-[#1C1C2E] mb-2">One reference to start.</h1>
              <p className="text-[#1C1C2E]/60">
                We contact them directly — you don't choose what they say. That's what makes Shapi references different.
              </p>
            </div>
            <div className="bg-[#0B5563]/5 rounded-2xl p-5 border border-[#0B5563]/10">
              <p className="text-sm text-[#0B5563] font-medium mb-1">How our references work</p>
              <p className="text-sm text-[#1C1C2E]/60 leading-relaxed">
                We reach out to your reference with structured questions. Their responses are displayed on your profile — including skills you may have forgotten to mention. Candidates can't edit or remove reference content.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#1C1C2E]/10 space-y-4">
              <input
                type="text"
                value={data.refName}
                onChange={e => update('refName', e.target.value)}
                placeholder="Reference full name"
                className="w-full bg-[#F8F4EE] border border-transparent rounded-xl px-4 py-3 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors text-sm"
              />
              <input
                type="email"
                value={data.refEmail}
                onChange={e => update('refEmail', e.target.value)}
                placeholder="Reference work email"
                className="w-full bg-[#F8F4EE] border border-transparent rounded-xl px-4 py-3 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors text-sm"
              />
              <input
                type="text"
                value={data.refRelationship}
                onChange={e => update('refRelationship', e.target.value)}
                placeholder="How did they know your work? (e.g. Direct manager at NEOM)"
                className="w-full bg-[#F8F4EE] border border-transparent rounded-xl px-4 py-3 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors text-sm"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center space-y-6 pt-8">
            <div className="w-20 h-20 bg-[#0B5563] rounded-full flex items-center justify-center mx-auto text-white text-3xl">✓</div>
            <div>
              <h1 className="text-3xl font-bold text-[#1C1C2E] mb-3">Profile submitted.</h1>
              <p className="text-[#1C1C2E]/60 max-w-md mx-auto leading-relaxed">
                We're now verifying your information and contacting your reference. Your profile will go live once verification is complete — usually within 48 hours.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#1C1C2E]/10 text-left space-y-3">
              <p className="text-sm font-medium text-[#1C1C2E]">What happens next</p>
              {[
                'Reference outreach sent within 24 hours',
                'AI skills verification runs on your work history',
                'Profile goes live once 70% complete',
                'Matched companies can view your verified profile',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#0B5563]/10 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-[#0B5563]" />
                  </div>
                  <p className="text-sm text-[#1C1C2E]/70">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-10">
          {step > 0 && step < 4 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-6 py-4 rounded-full border border-[#1C1C2E]/20 text-[#1C1C2E]/60 text-sm font-medium hover:border-[#1C1C2E]/40 transition-colors"
            >
              Back
            </button>
          )}
          {step < 4 && (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex-1 bg-[#0B5563] text-white py-4 rounded-full font-semibold text-sm hover:bg-[#094450] transition-colors"
            >
              {step === 3 ? 'Submit profile' : 'Continue →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
