'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const steps = ['Company profile', 'Post a role', 'Done']

export default function CompanyOnboarding() {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  // Step 0 — Company profile
  const [companyName, setCompanyName] = useState('')
  const [website, setWebsite] = useState('')
  const [size, setSize] = useState('')
  const [location, setLocation] = useState('')
  const [about, setAbout] = useState('')

  // Step 1 — First job
  const [jobTitle, setJobTitle] = useState('')
  const [jobLocation, setJobLocation] = useState('')
  const [remote, setRemote] = useState(false)
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [description, setDescription] = useState('')
  const [visaSponsorship, setVisaSponsorship] = useState(false)
  const [aiTier, setAiTier] = useState('')

  const saveCompanyProfile = async () => {
    setSaving(true)
    await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: companyName,
        company_website: website,
        company_size: size,
        location,
        summary: about,
        onboarding_complete: false,
      }),
    })
    setSaving(false)
  }

  const postJob = async () => {
    setSaving(true)
    await fetch('/api/jobs/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: jobTitle,
        location: jobLocation,
        remote,
        salary_min: salaryMin ? parseInt(salaryMin) : null,
        salary_max: salaryMax ? parseInt(salaryMax) : null,
        description,
        visa_sponsorship: visaSponsorship,
        ai_tier_required: aiTier || 'any',
        status: 'live',
      }),
    })
    await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding_complete: true, completion_pct: 100 }),
    })
    setSaving(false)
  }

  const next = async () => {
    if (step === 0) await saveCompanyProfile()
    if (step === 1) await postJob()
    setStep(s => s + 1)
  }

  const inputCls = "w-full bg-white border border-[#1C1C2E]/10 rounded-2xl px-5 py-4 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors text-sm"
  const innerCls = "w-full bg-[#F8F4EE] border border-transparent rounded-xl px-4 py-3 text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors text-sm"

  return (
    <div className="min-h-screen bg-[#F8F4EE]">
      <nav className="px-6 py-5 flex items-center justify-between max-w-4xl mx-auto">
        <span className="text-[#0B5563] font-bold text-2xl tracking-tight">shapi</span>
        <span className="text-[#1C1C2E]/40 text-sm">Step {step + 1} of {steps.length}</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6">
        <div className="h-1 bg-[#1C1C2E]/10 rounded-full">
          <div className="h-1 bg-[#E8745A] rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((s, i) => (
            <span key={i} className={`text-xs font-medium ${i <= step ? 'text-[#E8745A]' : 'text-[#1C1C2E]/30'}`}>{s}</span>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 pt-12 pb-20">

        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-3xl font-bold text-[#1C1C2E] mb-2">Tell us about your company.</h1>
              <p className="text-[#1C1C2E]/60">Candidates see this when they match with you.</p>
            </div>
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
              placeholder="Company name" className={inputCls} />
            <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
              placeholder="Website (e.g. https://yourcompany.com)" className={inputCls} />
            <input type="text" value={location} onChange={e => setLocation(e.target.value)}
              placeholder="Headquarters location (e.g. Dubai, UAE)" className={inputCls} />
            <div className="bg-white border border-[#1C1C2E]/10 rounded-2xl px-5 py-4">
              <label className="block text-sm font-medium text-[#1C1C2E] mb-3">Company size</label>
              <div className="grid grid-cols-3 gap-2">
                {['1–10', '11–50', '51–200', '201–500', '500–2000', '2000+'].map(s => (
                  <button key={s} onClick={() => setSize(s)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      size === s ? 'bg-[#0B5563] text-white' : 'bg-[#F8F4EE] text-[#1C1C2E]/60 hover:bg-[#0B5563]/10'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <textarea value={about} onChange={e => setAbout(e.target.value)} rows={4}
                placeholder="What does your company do, and what kind of people thrive there?"
                className={`${inputCls} resize-none`} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-3xl font-bold text-[#1C1C2E] mb-2">Post your first role.</h1>
              <p className="text-[#1C1C2E]/60">We'll match it to verified candidates immediately.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#1C1C2E]/10 space-y-4">
              <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                placeholder="Job title" className={innerCls} />
              <input type="text" value={jobLocation} onChange={e => setJobLocation(e.target.value)}
                placeholder="Location (e.g. Dubai, UAE)" className={innerCls} />
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setRemote(r => !r)}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${remote ? 'bg-[#0B5563]' : 'bg-[#1C1C2E]/20'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${remote ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm text-[#1C1C2E]">Remote or hybrid OK</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={salaryMin} onChange={e => setSalaryMin(e.target.value)}
                  placeholder="Salary min (USD)" className={innerCls} />
                <input type="number" value={salaryMax} onChange={e => setSalaryMax(e.target.value)}
                  placeholder="Salary max (USD)" className={innerCls} />
              </div>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5}
                placeholder="Role description — what will this person actually do day to day?"
                className={`${innerCls} resize-none`} />
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setVisaSponsorship(v => !v)}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${visaSponsorship ? 'bg-[#0B5563]' : 'bg-[#1C1C2E]/20'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${visaSponsorship ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm text-[#1C1C2E]">Visa sponsorship available</span>
              </label>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#1C1C2E]/10">
              <p className="text-sm font-medium text-[#1C1C2E] mb-3">AI proficiency required</p>
              {[
                { val: 'any', label: 'Any / not important' },
                { val: 'user', label: 'User — uses AI tools in daily work' },
                { val: 'integrator', label: 'Integrator — builds AI workflows' },
                { val: 'builder', label: 'Builder — builds AI systems' },
              ].map(opt => (
                <label key={opt.val} onClick={() => setAiTier(opt.val)}
                  className="flex items-center gap-3 cursor-pointer mb-2">
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                    aiTier === opt.val ? 'border-[#0B5563] bg-[#0B5563]' : 'border-[#1C1C2E]/20'
                  }`} />
                  <span className="text-sm text-[#1C1C2E]">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center space-y-6 pt-8">
            <div className="w-20 h-20 bg-[#E8745A] rounded-full flex items-center justify-center mx-auto text-white text-3xl">✓</div>
            <div>
              <h1 className="text-3xl font-bold text-[#1C1C2E] mb-3">You&apos;re live.</h1>
              <p className="text-[#1C1C2E]/60 max-w-md mx-auto leading-relaxed">
                Your role is live and we&apos;re matching it to verified candidates now. You&apos;ll be notified when there&apos;s a strong match.
              </p>
            </div>
            <button onClick={() => router.push('/dashboard')}
              className="bg-[#E8745A] text-white px-8 py-4 rounded-full font-semibold text-sm hover:bg-[#d4614a] transition-colors">
              Go to dashboard →
            </button>
          </div>
        )}

        {step < 2 && (
          <div className="flex gap-3 mt-10">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="px-6 py-4 rounded-full border border-[#1C1C2E]/20 text-[#1C1C2E]/60 text-sm font-medium hover:border-[#1C1C2E]/40 transition-colors">
                Back
              </button>
            )}
            <button onClick={next} disabled={saving}
              className="flex-1 bg-[#E8745A] text-white py-4 rounded-full font-semibold text-sm hover:bg-[#d4614a] transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : step === 1 ? 'Post role & go live →' : 'Continue →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
