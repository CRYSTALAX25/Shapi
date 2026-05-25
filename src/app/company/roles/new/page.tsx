'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'

type Stage = 'form' | 'generating' | 'done'

const CURRENCIES = ['USD', 'AED', 'SAR', 'GBP', 'EUR', 'INR']

export default function NewRole() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('form')
  const [error, setError] = useState('')

  // JD paste
  const [jdText, setJdText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsedOk, setParsedOk] = useState(false)

  // Core fields
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [location, setLocation] = useState('')
  const [remote, setRemote] = useState(false)
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [salaryVisible, setSalaryVisible] = useState(true)
  const [engagementType, setEngagementType] = useState<'permanent' | 'contract' | 'temp'>('permanent')
  const [acceptsPivot, setAcceptsPivot] = useState(false)

  // WhatsApp-style deep questions
  const [problemToSolve, setProblemToSolve] = useState('')
  const [idealCandidate, setIdealCandidate] = useState('')
  const [teamContext, setTeamContext] = useState('')
  const [successLooksLike, setSuccessLooksLike] = useState('')
  const [dealBreakers, setDealBreakers] = useState('')
  const [growthPath, setGrowthPath] = useState('')

  const parseJD = async () => {
    if (!jdText.trim()) return
    setParsing(true)
    setParsedOk(false)
    setError('')
    try {
      const res = await fetch('/api/company/parse-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd_text: jdText }),
      })
      const d = await res.json()
      if (!res.ok || d.error) { setError(d.error || 'Parse failed'); return }

      const p = d.parsed
      if (p.title) setTitle(p.title)
      if (p.department) setDepartment(p.department)
      if (p.location) setLocation(p.location)
      if (typeof p.remote === 'boolean') setRemote(p.remote)
      if (p.salary_min) setSalaryMin(String(p.salary_min))
      if (p.salary_max) setSalaryMax(String(p.salary_max))
      if (p.salary_currency && CURRENCIES.includes(p.salary_currency)) setCurrency(p.salary_currency)
      if (p.problem_to_solve) setProblemToSolve(p.problem_to_solve)
      if (p.ideal_candidate) setIdealCandidate(p.ideal_candidate)
      if (p.team_context) setTeamContext(p.team_context)
      if (p.what_success_looks_like) setSuccessLooksLike(p.what_success_looks_like)
      if (p.deal_breakers) setDealBreakers(p.deal_breakers)
      if (p.growth_path) setGrowthPath(p.growth_path)
      setParsedOk(true)
    } catch {
      setError('Failed to parse JD — please try again.')
    } finally {
      setParsing(false)
    }
  }

  const submit = async () => {
    setError('')
    if (!title.trim()) { setError('Role title is required'); return }
    if (!salaryMin || !salaryMax) { setError('Salary range is required — candidates need to know'); return }
    if (parseInt(salaryMin) >= parseInt(salaryMax)) { setError('Salary max must be greater than min'); return }
    if (!problemToSolve.trim()) { setError('Tell us the problem this person needs to solve'); return }

    setStage('generating')

    const res = await fetch('/api/company/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        department: department.trim() || null,
        location: location.trim() || null,
        remote,
        salary_min: parseInt(salaryMin),
        salary_max: parseInt(salaryMax),
        salary_currency: currency,
        salary_visible: salaryVisible,
        engagement_type: engagementType,
        accepts_pivot_candidates: acceptsPivot,
        problem_to_solve: problemToSolve.trim(),
        ideal_candidate: idealCandidate.trim(),
        team_context: teamContext.trim(),
        what_success_looks_like: successLooksLike.trim(),
        deal_breakers: dealBreakers.trim(),
        growth_path: growthPath.trim(),
      }),
    })

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Something went wrong — try again')
      setStage('form')
      return
    }

    setStage('done')
  }

  if (stage === 'generating') {
    return (
      <Screen>
        <div className="text-center max-w-sm">
          <ShapiCharacter mood="thinking" size={90} className="mx-auto mb-6" />
          <h2 className="text-2xl font-black text-[#F4F4F7] mb-3">Writing your job description...</h2>
          <p className="text-[#A6A6B4] text-sm leading-relaxed">
            Claude is turning your answers into a real, specific JD — not a template. About 15 seconds.
          </p>
        </div>
      </Screen>
    )
  }

  if (stage === 'done') {
    return (
      <Screen>
        <div className="text-center max-w-sm">
          <ShapiCharacter mood="happy" size={90} className="mx-auto mb-6" />
          <h2 className="text-2xl font-black text-[#F4F4F7] mb-3">Role posted.</h2>
          <p className="text-[#A6A6B4] text-sm leading-relaxed mb-8">
            Claude has written your job description. We&apos;ll start matching verified candidates to it now.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/company/dashboard')}
              className="w-full bg-gradient-to-r from-[#6AA8F5] to-[#F08CAE] py-4 rounded-full font-black text-sm text-[#fff] hover:opacity-90 transition-opacity">
              View all roles →
            </button>
            <button
              onClick={() => { setStage('form'); setTitle(''); setProblemToSolve(''); setSalaryMin(''); setSalaryMax('') }}
              className="w-full py-3 text-sm text-[#7E7E8E] hover:text-[#C7C7D1] transition-colors">
              Post another role
            </button>
          </div>
        </div>
      </Screen>
    )
  }

  return (
    <div className="min-h-screen bg-[#0E0E13]">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.15), rgba(240,140,174,0.15)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
        .field { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 16px; font-size: 14px; color: #F4F4F7; outline: none; transition: border-color 0.2s; }
        .field::placeholder { color: rgba(126,126,142,1); }
        .field:focus { border-color: rgba(106,168,245,0.5); }
        label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #A6A6B4; margin-bottom: 8px; }
        .required::after { content: " *"; color: #F58E9A; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-3xl mx-auto border-b border-[rgba(255,255,255,0.08)]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <Link href="/company/dashboard" className="text-[#A6A6B4] text-sm hover:text-[#C7C7D1] transition-colors">
          ← Dashboard
        </Link>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-24">

        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#F4F4F7] mb-2">Post a new role.</h1>
          <p className="text-[#A6A6B4] text-sm leading-relaxed">
            Answer honestly — Claude will write the job description from your answers. The more specific you are, the better your matches.
          </p>
        </div>

        {error && (
          <div className="bg-[#F58E9A]/10 border border-[#F58E9A]/20 rounded-xl px-4 py-3 mb-6 text-sm text-[#F58E9A]">{error}</div>
        )}

        {/* JD paste — optional shortcut */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Already have a JD?</p>
              <p className="text-[#7E7E8E] text-xs mt-0.5">Paste it and we&apos;ll extract the fields for you. You can edit anything after.</p>
            </div>
            {parsedOk && (
              <span className="flex-shrink-0 bg-emerald-500/15 text-emerald-600 text-xs font-bold px-3 py-1 rounded-full">✓ Fields filled</span>
            )}
          </div>
          <textarea
            className="field"
            rows={4}
            value={jdText}
            onChange={e => { setJdText(e.target.value); setParsedOk(false) }}
            placeholder="Paste your existing job description here…"
            style={{ resize: 'vertical' }}
          />
          <button
            type="button"
            onClick={parseJD}
            disabled={parsing || !jdText.trim()}
            className="mt-3 px-5 py-2 rounded-full text-xs font-black transition-opacity disabled:opacity-40"
            style={{ background: 'rgba(106,168,245,0.12)', color: '#6AA8F5', border: '1px solid rgba(106,168,245,0.2)' }}>
            {parsing ? 'Extracting…' : 'Extract fields →'}
          </button>
          {parsedOk && (
            <p className="text-[#7E7E8E] text-xs mt-2">Fields below have been filled from your JD. Review and add anything missing.</p>
          )}
        </div>

        {/* Section 1 — basics */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5 space-y-4">
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Role basics</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="required">Job title</label>
              <input className="field" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Head of Operations" />
            </div>
            <div>
              <label>Department</label>
              <input className="field" value={department} onChange={e => setDepartment(e.target.value)}
                placeholder="Operations, Finance, Tech..." />
            </div>
            <div>
              <label>Location</label>
              <input className="field" value={location} onChange={e => setLocation(e.target.value)}
                placeholder="Dubai, UAE" />
            </div>
          </div>

          <div>
            <label>Engagement type</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'permanent', l: 'Permanent', s: 'Full-time hire' },
                { v: 'contract', l: 'Contract', s: 'Fixed-term / day rate' },
                { v: 'temp', l: 'Temp / Shift', s: 'Short-term cover' },
              ] as const).map(o => (
                <button key={o.v} type="button" onClick={() => setEngagementType(o.v)}
                  className="text-left rounded-xl px-3 py-2.5 transition-all"
                  style={engagementType === o.v
                    ? { background: 'rgba(106,168,245,0.1)', border: '1px solid rgba(106,168,245,0.45)' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-sm font-bold" style={{ color: engagementType === o.v ? '#6AA8F5' : '#C7C7D1' }}>{o.l}</p>
                  <p className="text-[#7E7E8E] text-[10px] leading-tight">{o.s}</p>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setRemote(!remote)}
              className={`w-10 h-6 rounded-full transition-colors relative ${remote ? 'bg-[#6AA8F5]' : 'bg-[rgba(255,255,255,0.05)]'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${remote ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-[#A6A6B4] text-sm">Remote / hybrid OK</span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <div
              onClick={() => setAcceptsPivot(!acceptsPivot)}
              className={`mt-0.5 flex-shrink-0 w-10 h-6 rounded-full transition-colors relative ${acceptsPivot ? 'bg-[#6AA8F5]' : 'bg-[rgba(255,255,255,0.05)]'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${acceptsPivot ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-sm">
              <span className="text-[#A6A6B4]">🌱 Open to career-changers — we&apos;ll train on the job</span>
              <span className="block text-[#7E7E8E] text-xs mt-0.5">Train-to-Hire: surfaces this role to pivoters who don&apos;t yet match every requirement.</span>
            </span>
          </label>
        </div>

        {/* Section 2 — salary (mandatory) */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Salary range</p>
            <span className="text-[#F58E9A] text-xs font-bold">Required</span>
          </div>
          <p className="text-[#7E7E8E] text-xs mb-4 leading-relaxed">
            Mandatory on Shapi. Candidates pre-qualify themselves — you only hear from people who&apos;re genuinely interested at this range.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="required">Currency</label>
              <select className="field" value={currency} onChange={e => setCurrency(e.target.value)}
                style={{ appearance: 'none' }}>
                {CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#16161F' }}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="required">Minimum</label>
              <input className="field" type="number" value={salaryMin} onChange={e => setSalaryMin(e.target.value)}
                placeholder="80000" />
            </div>
            <div>
              <label className="required">Maximum</label>
              <input className="field" type="number" value={salaryMax} onChange={e => setSalaryMax(e.target.value)}
                placeholder="120000" />
            </div>
          </div>

          {salaryMin && salaryMax && parseInt(salaryMin) < parseInt(salaryMax) && (
            <p className="text-[#6AA8F5] text-xs font-semibold">
              {currency} {parseInt(salaryMin).toLocaleString()} – {parseInt(salaryMax).toLocaleString()} per year
            </p>
          )}

          <label className="flex items-center gap-3 cursor-pointer mt-4">
            <div
              onClick={() => setSalaryVisible(!salaryVisible)}
              className={`w-10 h-6 rounded-full transition-colors relative ${salaryVisible ? 'bg-[#6AA8F5]' : 'bg-[rgba(255,255,255,0.05)]'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${salaryVisible ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-[#A6A6B4] text-sm">Show salary publicly on role listing</span>
          </label>
        </div>

        {/* Section 3 — the real questions */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5 space-y-5">
          <div>
            <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-1">The honest brief</p>
            <p className="text-[#7E7E8E] text-xs">This is what Shapi uses to write your JD and match candidates. Be specific.</p>
          </div>

          <div>
            <label className="required">What problem does this person need to solve in the first 90 days?</label>
            <textarea className="field" rows={3} value={problemToSolve} onChange={e => setProblemToSolve(e.target.value)}
              placeholder="E.g. We're scaling from 3 to 8 markets and our ops infrastructure is breaking. We need someone to rebuild our vendor management and reporting from scratch before Q3."
              style={{ resize: 'vertical' }} />
          </div>

          <div>
            <label>What does the ideal candidate look like? Think of the best person you've hired for something similar.</label>
            <textarea className="field" rows={3} value={idealCandidate} onChange={e => setIdealCandidate(e.target.value)}
              placeholder="E.g. Someone who's done this in a high-growth environment before — not necessarily our industry. Execution-first, doesn't need to be told twice, builds systems not just fixes symptoms."
              style={{ resize: 'vertical' }} />
          </div>

          <div>
            <label>What&apos;s the team they&apos;re joining like?</label>
            <textarea className="field" rows={2} value={teamContext} onChange={e => setTeamContext(e.target.value)}
              placeholder="E.g. Team of 6, mostly under 35, fast-moving, direct culture. Reports to the COO. Two direct reports from day one."
              style={{ resize: 'vertical' }} />
          </div>

          <div>
            <label>What does success look like at the end of year one?</label>
            <textarea className="field" rows={2} value={successLooksLike} onChange={e => setSuccessLooksLike(e.target.value)}
              placeholder="E.g. All 8 markets on one reporting system, vendor cost down 15%, and the team doesn't need me in ops decisions anymore."
              style={{ resize: 'vertical' }} />
          </div>

          <div>
            <label>What would make you reject an otherwise strong candidate?</label>
            <textarea className="field" rows={2} value={dealBreakers} onChange={e => setDealBreakers(e.target.value)}
              placeholder="E.g. Anyone who needs a lot of structure or hand-holding. We move fast and expect people to drive themselves."
              style={{ resize: 'vertical' }} />
          </div>

          <div>
            <label>Where does this role lead in 2 years?</label>
            <textarea className="field" rows={2} value={growthPath} onChange={e => setGrowthPath(e.target.value)}
              placeholder="E.g. This is a stepping stone to a regional VP role as we expand. We promote from within wherever possible."
              style={{ resize: 'vertical' }} />
          </div>
        </div>

        <button
          onClick={submit}
          className="w-full bg-gradient-to-r from-[#6AA8F5] to-[#F08CAE] py-4 rounded-full font-black text-sm text-[#fff] hover:opacity-90 transition-opacity"
        >
          Post role — Claude writes the JD →
        </button>
        <p className="text-center text-[#5C5C6A] text-xs mt-3">You can edit the generated description after posting</p>
      </div>
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0E0E13] flex items-center justify-center px-6">
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">{children}</div>
    </div>
  )
}
