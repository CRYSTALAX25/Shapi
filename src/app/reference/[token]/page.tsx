'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

type ReferenceData = {
  referee_name: string
  candidate_name: string
  referee_relationship: string
  status: string
}

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
        else setRef(data)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F4EE] flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 150, 300].map(d => (
            <div key={d} className="w-2.5 h-2.5 bg-[#0B5563]/40 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#F8F4EE] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-[#1C1C2E] mb-3">Link not found</h1>
          <p className="text-[#1C1C2E]/60">This reference link is invalid or has already been completed.</p>
        </div>
      </div>
    )
  }

  if (ref?.status === 'completed' || done) {
    return (
      <div className="min-h-screen bg-[#F8F4EE] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-[#0B5563] rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl">✓</div>
          <h1 className="text-2xl font-bold text-[#1C1C2E] mb-3">Thank you, {ref?.referee_name?.split(' ')[0]}.</h1>
          <p className="text-[#1C1C2E]/60 leading-relaxed">
            Your reference for {ref?.candidate_name} has been submitted. It will appear on their verified profile and help them find the right role.
          </p>
        </div>
      </div>
    )
  }

  const firstName = ref?.candidate_name?.split(' ')[0] || 'them'

  return (
    <div className="min-h-screen bg-[#F8F4EE]">
      <nav className="px-6 py-5 border-b border-[#1C1C2E]/5 bg-[#F8F4EE]">
        <span className="text-[#0B5563] font-bold text-xl tracking-tight">shapi</span>
      </nav>

      <div className="max-w-2xl mx-auto px-6 pt-10 pb-20">
        <div className="mb-8">
          <p className="text-sm text-[#0B5563] font-medium mb-2">Reference request</p>
          <h1 className="text-3xl font-bold text-[#1C1C2E] mb-3">
            A reference for {ref?.candidate_name}
          </h1>
          <p className="text-[#1C1C2E]/60 leading-relaxed">
            You've been listed as a reference by {ref?.candidate_name} ({ref?.referee_relationship}).
            Your honest answers take about 5 minutes and go directly onto their verified profile — {firstName} cannot edit them.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/10">
            <label className="block text-sm font-semibold text-[#1C1C2E] mb-1">
              How would you describe the quality of {firstName}&apos;s work? <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-[#1C1C2E]/50 mb-3">Be specific — vague answers are less useful than honest detail.</p>
            <textarea value={quality} onChange={e => setQuality(e.target.value)} rows={4}
              placeholder={`${firstName} was consistently... The quality of their work stood out because...`}
              className="w-full bg-[#F8F4EE] rounded-xl px-4 py-3 text-sm text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:ring-2 focus:ring-[#0B5563]/20 resize-none" />
          </div>

          <div className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/10">
            <label className="block text-sm font-semibold text-[#1C1C2E] mb-1">
              What&apos;s a specific achievement or moment that shows what {firstName} is capable of? <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-[#1C1C2E]/50 mb-3">Numbers, scale, or a specific project if you can.</p>
            <textarea value={achievement} onChange={e => setAchievement(e.target.value)} rows={4}
              placeholder="One example that comes to mind is..."
              className="w-full bg-[#F8F4EE] rounded-xl px-4 py-3 text-sm text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:ring-2 focus:ring-[#0B5563]/20 resize-none" />
          </div>

          <div className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/10">
            <label className="block text-sm font-semibold text-[#1C1C2E] mb-1">
              What skills or strengths does {firstName} have that might not be obvious from a CV? <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-[#1C1C2E]/50 mb-3">Hidden skills, soft skills, things they undersell themselves on.</p>
            <textarea value={skills} onChange={e => setSkills(e.target.value)} rows={3}
              placeholder="Something people don't always realise about them is..."
              className="w-full bg-[#F8F4EE] rounded-xl px-4 py-3 text-sm text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:ring-2 focus:ring-[#0B5563]/20 resize-none" />
          </div>

          <div className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/10">
            <label className="block text-sm font-semibold text-[#1C1C2E] mb-3">
              Would you work with {firstName} again? <span className="text-red-400">*</span>
            </label>
            <div className="space-y-2">
              {[
                { val: 'yes_definitely', label: 'Yes, without hesitation' },
                { val: 'yes_right_role', label: 'Yes, in the right role' },
                { val: 'not_sure', label: 'Not sure' },
                { val: 'no', label: 'No' },
              ].map(opt => (
                <label key={opt.val} onClick={() => setWouldRehire(opt.val)}
                  className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                    wouldRehire === opt.val ? 'border-[#0B5563] bg-[#0B5563]' : 'border-[#1C1C2E]/20'
                  }`} />
                  <span className="text-sm text-[#1C1C2E]">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-7 border border-[#1C1C2E]/10">
            <label className="block text-sm font-semibold text-[#1C1C2E] mb-1">
              Anything else you&apos;d want an employer to know?
            </label>
            <p className="text-xs text-[#1C1C2E]/50 mb-3">Optional — but often the most valuable part.</p>
            <textarea value={anythingElse} onChange={e => setAnythingElse(e.target.value)} rows={3}
              placeholder="Optional..."
              className="w-full bg-[#F8F4EE] rounded-xl px-4 py-3 text-sm text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:ring-2 focus:ring-[#0B5563]/20 resize-none" />
          </div>

          <button
            onClick={submit}
            disabled={!quality || !achievement || !skills || !wouldRehire || submitting}
            className="w-full bg-[#0B5563] text-white py-4 rounded-full font-semibold text-sm hover:bg-[#094450] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit reference →'}
          </button>

          <p className="text-center text-xs text-[#1C1C2E]/40">
            Your responses are final once submitted. {firstName} will see them but cannot edit them.
          </p>
        </div>
      </div>
    </div>
  )
}
