'use client'

// Post a new role — mirrors the candidate CV workflow:
//   1. PRIMARY: upload your internal JD (PDF/DOCX/TXT) or paste it — AI
//      parses it into the structured role fields.
//   2. No JD yet? Describe the role and AI drafts one — but the draft ALWAYS
//      lands in this editable form. Nothing is ever auto-published.
//   3. Optional WhatsApp deep-dive (same pattern as the CV builder hand-off).
//   4. Translate the JD into the languages your offices hire in — editable,
//      saved with the role.

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'
import SubscribeButton from '@/components/SubscribeButton'
import { LOCALES } from '@/lib/i18n/locales'
import { getShapiTriggerUrl } from '@/lib/shapi-whatsapp-url'

type Stage = 'intake' | 'parsing' | 'form' | 'publishing' | 'done'

const CURRENCIES = ['USD', 'AED', 'SAR', 'GBP', 'EUR', 'INR']

// Languages the JD can be translated into (all app locales except English)
const JD_LANGS = LOCALES.filter(l => l.code !== 'en')

type Translation = { title: string; description: string; requirements: string }

export default function NewRole() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('intake')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')

  // JD paste
  const [jdText, setJdText] = useState('')
  const [parsing, setParsing] = useState(false)

  // True once the form was filled by AI (parse or draft) — drives the
  // "Drafted for you — review and edit" banner.
  const [aiFilled, setAiFilled] = useState<'parsed' | 'drafted' | null>(null)

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

  // The JD itself — always visible, always editable before publish
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [drafting, setDrafting] = useState(false)

  // WhatsApp-style deep questions (the honest brief)
  const [problemToSolve, setProblemToSolve] = useState('')
  const [idealCandidate, setIdealCandidate] = useState('')
  const [teamContext, setTeamContext] = useState('')
  const [successLooksLike, setSuccessLooksLike] = useState('')
  const [dealBreakers, setDealBreakers] = useState('')
  const [growthPath, setGrowthPath] = useState('')

  // Translations — { ar: { title, description, requirements }, ... }
  const [translations, setTranslations] = useState<Record<string, Translation>>({})
  const [translateLang, setTranslateLang] = useState<string>('ar')
  const [activeTransTab, setActiveTransTab] = useState<string>('')
  const [translating, setTranslating] = useState(false)
  const [transError, setTransError] = useState('')

  // Post-publish
  const [roleId, setRoleId] = useState('')
  const [publishWarning, setPublishWarning] = useState('')
  const [waState, setWaState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [waLink, setWaLink] = useState('')

  // ── Apply parsed/drafted fields into the form ────────────────────────────
  const applyParsed = (p: Record<string, unknown>) => {
    if (typeof p.title === 'string' && p.title) setTitle(p.title)
    if (typeof p.department === 'string' && p.department) setDepartment(p.department)
    if (typeof p.location === 'string' && p.location) setLocation(p.location)
    if (typeof p.remote === 'boolean') setRemote(p.remote)
    if (typeof p.engagement_type === 'string' && ['permanent', 'contract', 'temp'].includes(p.engagement_type)) {
      setEngagementType(p.engagement_type as 'permanent' | 'contract' | 'temp')
    }
    if (p.salary_min) setSalaryMin(String(p.salary_min))
    if (p.salary_max) setSalaryMax(String(p.salary_max))
    if (typeof p.salary_currency === 'string' && CURRENCIES.includes(p.salary_currency)) setCurrency(p.salary_currency)
    if (typeof p.description === 'string' && p.description) setDescription(p.description)
    if (typeof p.requirements === 'string' && p.requirements) setRequirements(p.requirements)
    if (typeof p.problem_to_solve === 'string' && p.problem_to_solve) setProblemToSolve(p.problem_to_solve)
    if (typeof p.ideal_candidate === 'string' && p.ideal_candidate) setIdealCandidate(p.ideal_candidate)
    if (typeof p.team_context === 'string' && p.team_context) setTeamContext(p.team_context)
    if (typeof p.what_success_looks_like === 'string' && p.what_success_looks_like) setSuccessLooksLike(p.what_success_looks_like)
    if (typeof p.deal_breakers === 'string' && p.deal_breakers) setDealBreakers(p.deal_breakers)
    if (typeof p.growth_path === 'string' && p.growth_path) setGrowthPath(p.growth_path)
  }

  // ── Path 1a: upload internal JD file ─────────────────────────────────────
  const handleFile = async (file: File) => {
    const okType = /\.(pdf|docx|txt)$/i.test(file.name)
      || ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)
    if (!okType) { setError('Please upload a PDF, DOCX or TXT file'); return }
    if (file.size > 5 * 1024 * 1024) { setError('File too large (max 5MB)'); return }

    setFileName(file.name)
    setError('')
    setStage('parsing')

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/company/roles/parse-jd', { method: 'POST', body: form })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) {
        setError(d.error || 'Could not read that JD — try again or paste it instead')
        setStage('intake')
        return
      }
      applyParsed(d.parsed || {})
      setAiFilled('parsed')
      setStage('form')
    } catch {
      setError('Could not read that JD — try again or paste it instead')
      setStage('intake')
    }
  }

  // ── Path 1b: paste internal JD text ──────────────────────────────────────
  const parsePasted = async () => {
    if (!jdText.trim()) return
    setParsing(true)
    setError('')
    try {
      const res = await fetch('/api/company/roles/parse-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd_text: jdText }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) { setError(d.error || 'Parse failed'); return }
      applyParsed(d.parsed || {})
      setAiFilled('parsed')
      setStage('form')
    } catch {
      setError('Failed to parse JD — please try again.')
    } finally {
      setParsing(false)
    }
  }

  // ── Path 2: AI drafts the JD from the honest brief ───────────────────────
  const draftJD = async () => {
    setError('')
    if (!title.trim()) { setError('Add the role title first — the draft needs it'); return }
    if (!problemToSolve.trim()) { setError('Tell us the problem this person needs to solve — that’s what makes the draft specific'); return }

    setDrafting(true)
    try {
      const res = await fetch('/api/company/roles/draft-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          department: department.trim() || null,
          location: location.trim() || null,
          remote,
          salary_min: salaryMin ? parseInt(salaryMin) : null,
          salary_max: salaryMax ? parseInt(salaryMax) : null,
          salary_currency: currency,
          problem_to_solve: problemToSolve.trim(),
          ideal_candidate: idealCandidate.trim(),
          team_context: teamContext.trim(),
          what_success_looks_like: successLooksLike.trim(),
          deal_breakers: dealBreakers.trim(),
          growth_path: growthPath.trim(),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) { setError(d.error || 'Drafting failed — try again'); return }
      setDescription(d.description || '')
      setRequirements(d.requirements || '')
      setAiFilled('drafted')
      // Bring the freshly drafted JD into view
      setTimeout(() => document.getElementById('jd-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch {
      setError('Drafting failed — try again')
    } finally {
      setDrafting(false)
    }
  }

  // ── Path 4: translate the JD ─────────────────────────────────────────────
  const translate = async () => {
    setTransError('')
    if (!description.trim() && !title.trim()) {
      setTransError('Nothing to translate yet — add the JD first')
      return
    }
    setTranslating(true)
    try {
      const res = await fetch('/api/company/jd-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_language: translateLang,
          title: title.trim(),
          description,
          requirements,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) { setTransError(d.error || 'Translation failed — try again'); return }
      setTranslations(prev => ({ ...prev, [translateLang]: d.translated }))
      setActiveTransTab(translateLang)
    } catch {
      setTransError('Translation failed — try again')
    } finally {
      setTranslating(false)
    }
  }

  const updateTranslation = (lang: string, field: keyof Translation, value: string) => {
    setTranslations(prev => ({ ...prev, [lang]: { ...prev[lang], [field]: value } }))
  }

  const removeTranslation = (lang: string) => {
    setTranslations(prev => {
      const next = { ...prev }
      delete next[lang]
      const remaining = Object.keys(next)
      setActiveTransTab(remaining[0] || '')
      return next
    })
  }

  // ── Publish ──────────────────────────────────────────────────────────────
  const submit = async () => {
    setError('')
    if (!title.trim()) { setError('Role title is required'); return }
    if (!salaryMin || !salaryMax) { setError('Salary range is required — candidates need to know'); return }
    if (parseInt(salaryMin) >= parseInt(salaryMax)) { setError('Salary max must be greater than min'); return }
    if (!description.trim()) { setError('The job description is empty — paste/upload your JD, or hit "Draft my JD with AI"'); return }

    setStage('publishing')

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
        // The reviewed JD — published exactly as the company sees it
        description,
        requirements,
        translations: Object.keys(translations).length ? translations : undefined,
        problem_to_solve: problemToSolve.trim(),
        ideal_candidate: idealCandidate.trim(),
        team_context: teamContext.trim(),
        what_success_looks_like: successLooksLike.trim(),
        deal_breakers: dealBreakers.trim(),
        growth_path: growthPath.trim(),
      }),
    })

    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(d.error || 'Something went wrong — try again')
      setStage('form')
      return
    }

    setRoleId(d.role?.id || '')
    setPublishWarning(d.warning || '')
    setStage('done')
  }

  // ── Post-publish: WhatsApp deep-dive (reuses /api/company/roles/share) ───
  const whatsappDeepDive = async () => {
    if (!roleId) return
    setWaState('sending')
    try {
      const res = await fetch('/api/company/roles/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, send_whatsapp: true }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) { setWaState('failed'); return }
      setWaLink(d.link || '')
      setWaState(d.whatsapp_sent ? 'sent' : 'failed')
    } catch {
      setWaState('failed')
    }
  }

  const resetAll = () => {
    setStage('intake'); setAiFilled(null); setError(''); setJdText(''); setFileName('')
    setTitle(''); setDepartment(''); setLocation(''); setRemote(false)
    setSalaryMin(''); setSalaryMax(''); setCurrency('USD'); setSalaryVisible(true)
    setEngagementType('permanent'); setAcceptsPivot(false)
    setDescription(''); setRequirements('')
    setProblemToSolve(''); setIdealCandidate(''); setTeamContext(''); setSuccessLooksLike(''); setDealBreakers(''); setGrowthPath('')
    setTranslations({}); setActiveTransTab(''); setTransError('')
    setRoleId(''); setPublishWarning(''); setWaState('idle'); setWaLink('')
  }

  // ════ Parsing screen ════
  if (stage === 'parsing') {
    return (
      <Screen>
        <div className="text-center max-w-sm">
          <ShapiCharacter mood="thinking" size={90} className="mx-auto mb-6" />
          <h2 className="text-2xl font-black text-[#F4F4F7] mb-3">Reading your JD...</h2>
          {fileName && <p className="text-[#7E7E8E] text-sm mb-2">{fileName}</p>}
          <p className="text-[#A6A6B4] text-sm leading-relaxed">
            Extracting the title, salary, requirements and the real brief. About 15 seconds — then you review and edit everything.
          </p>
        </div>
      </Screen>
    )
  }

  // ════ Publishing screen ════
  if (stage === 'publishing') {
    return (
      <Screen>
        <div className="text-center max-w-sm">
          <ShapiCharacter mood="thinking" size={90} className="mx-auto mb-6" />
          <h2 className="text-2xl font-black text-[#F4F4F7] mb-3">Publishing your role...</h2>
          <p className="text-[#A6A6B4] text-sm leading-relaxed">
            Saving the JD you reviewed{Object.keys(translations).length ? ` plus ${Object.keys(translations).length} translation${Object.keys(translations).length > 1 ? 's' : ''}` : ''} and starting candidate matching.
          </p>
        </div>
      </Screen>
    )
  }

  // ════ Done screen ════
  if (stage === 'done') {
    return (
      <Screen>
        <div className="text-center max-w-md w-full">
          <ShapiCharacter mood="happy" size={90} className="mx-auto mb-6" />
          <h2 className="text-2xl font-black text-[#F4F4F7] mb-3">Role posted.</h2>
          <p className="text-[#A6A6B4] text-sm leading-relaxed mb-6">
            Your reviewed JD is live. We&apos;ll start matching verified candidates to it now.
          </p>

          {publishWarning && (
            <div className="bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3 mb-5 text-xs text-[#FB7185] text-left">
              {publishWarning}
            </div>
          )}

          {/* WhatsApp deep-dive — same post-parse hand-off pattern as the CV
              builder. Reuses /api/company/roles/share: texts the JD + a
              no-login magic link; replies land in the existing JD-intake chat. */}
          <div className="gradient-border-card rounded-2xl p-5 mb-5 text-left">
            <p className="text-[#F4F4F7] font-black text-sm mb-0.5">Deep-dive on WhatsApp <span className="text-[#7E7E8E] font-bold text-xs">(optional)</span></p>
            <p className="text-[#A6A6B4] text-[11px] leading-relaxed mb-3">
              We&apos;ll WhatsApp you this JD + a one-tap edit link. Reply in the chat (&quot;raise salary to…&quot;, &quot;add a must-have…&quot;) and Shapi updates the role — or just talk through the nuances no JD captures.
            </p>
            {waState === 'sent' ? (
              <p className="text-emerald-500 text-xs font-bold">✓ Sent — check your WhatsApp and reply with anything you&apos;d change.</p>
            ) : waState === 'failed' ? (
              <div className="text-xs text-[#A6A6B4] space-y-1.5">
                <p className="text-[#FB7185] font-bold">Couldn&apos;t send to your WhatsApp — is your number on your <Link href="/company/profile" className="underline">company profile</Link>?</p>
                {waLink && <p>Direct edit link (valid 14 days): <a href={waLink} className="text-[#38BDF8] underline break-all">{waLink}</a></p>}
                <p>
                  Or message Shapi directly:{' '}
                  <a href={getShapiTriggerUrl(`Deep-dive on my ${title || 'new'} role — ask me the hard questions`)} target="_blank" rel="noopener noreferrer" className="text-[#38BDF8] underline">
                    open WhatsApp chat →
                  </a>
                </p>
              </div>
            ) : (
              <button
                onClick={whatsappDeepDive}
                disabled={waState === 'sending'}
                className="w-full py-3 rounded-full font-black text-xs transition-opacity disabled:opacity-60"
                style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                {waState === 'sending' ? 'Sending…' : 'WhatsApp me the JD — I want to go deeper →'}
              </button>
            )}
          </div>

          {/* Active Hiring 7-day trial — STRATEGY: peak-intent moment.
              They JUST posted a role; offering Shapi to AI-shortlist
              + draft outreach converts 3-5x better here than on
              /company/pricing. Card collected via Stripe Checkout;
              auto-charges after 7 days unless cancelled. */}
          <div className="rounded-2xl p-5 mb-5 text-left" style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.14), rgba(56, 189, 248, 0.10))', border: '1px solid rgba(56, 189, 248, 0.40)' }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg,#38BDF8, #34D399)' }}>⚡</div>
              <div className="flex-1 min-w-0">
                <p className="text-[#F4F4F7] font-black text-sm mb-0.5">Let Shapi do the shortlisting for you</p>
                <p className="text-[#A6A6B4] text-[11px] leading-relaxed">
                  <strong className="text-[#F4F4F7]">Active Hiring ($499/mo) — 7 days free.</strong> Daily AI-shortlist of verified candidates + drafted intro emails awaiting your one-tap approval.
                </p>
              </div>
            </div>
            <SubscribeButton
              product="active_hiring_monthly"
              trial={7}
              className="w-full py-3 rounded-full font-black text-xs text-white hover:opacity-90 transition-opacity disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}
            >
              Start 7-day free trial → no charge for a week
            </SubscribeButton>
            <p className="text-[#7E7E8E] text-[10px] mt-2 leading-relaxed">
              Card on file via Stripe. Cancel anytime in the next 7 days — you won&apos;t be charged. After that, $499/month.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/company/dashboard')}
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.10)] py-3 rounded-full font-bold text-sm text-[#C7C7D1] hover:bg-[rgba(255,255,255,0.07)] transition-colors">
              Maybe later — view roles
            </button>
            <button
              onClick={resetAll}
              className="w-full py-2 text-xs text-[#7E7E8E] hover:text-[#C7C7D1] transition-colors">
              Post another role
            </button>
          </div>
        </div>
      </Screen>
    )
  }

  // ════ Intake screen — upload / paste / describe ════
  if (stage === 'intake') {
    return (
      <div className="min-h-screen bg-[#060609]">
        <PageStyles />
        <DotGrid />
        <Nav />

        <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-24">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-[#F4F4F7] mb-2">Post a new role.</h1>
            <p className="text-[#A6A6B4] text-sm leading-relaxed">
              Already have a JD written internally? Drop it here — we read it, fill the role for you, and you review every word before it goes live.
            </p>
          </div>

          {error && (
            <div className="bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3 mb-6 text-sm text-[#FB7185]">{error}</div>
          )}

          {/* PRIMARY: upload the internal JD */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            onClick={() => fileRef.current?.click()}
            className={`gradient-border-card rounded-2xl p-10 text-center cursor-pointer mb-5 ${dragging ? 'drop-zone-active' : 'hover:bg-[rgba(255,255,255,0.03)]'}`}
          >
            <div className="w-14 h-14 rounded-xl bg-[rgba(56, 189, 248, 0.10)] flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-[#38BDF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-[#F4F4F7] font-bold mb-1">Drop your job description here</p>
            <p className="text-sm text-[#7E7E8E]">or click to browse · PDF, DOCX or TXT · Max 5MB</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
            />
          </div>

          {/* Paste box */}
          <div className="gradient-border-card rounded-2xl p-6 mb-5">
            <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Or paste it</p>
            <p className="text-[#7E7E8E] text-xs mt-0.5 mb-3">Copy your JD from anywhere — we&apos;ll extract the fields. You edit everything after.</p>
            <textarea
              className="field"
              rows={5}
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              placeholder="Paste your existing job description here…"
              style={{ resize: 'vertical' }}
            />
            <button
              type="button"
              onClick={parsePasted}
              disabled={parsing || !jdText.trim()}
              className="mt-3 px-5 py-2 rounded-full text-xs font-black transition-opacity disabled:opacity-40"
              style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              {parsing ? 'Reading your JD…' : 'Read my JD →'}
            </button>
          </div>

          {/* Tertiary: no JD yet — describe it, AI drafts */}
          <button
            onClick={() => { setError(''); setStage('form') }}
            className="w-full py-3.5 text-sm text-[#7E7E8E] hover:text-[#C7C7D1] transition-colors"
          >
            No JD yet? Describe the role and we&apos;ll draft one for you →
          </button>
        </div>
      </div>
    )
  }

  // ════ Form screen — review/edit everything before publishing ════
  const transCount = Object.keys(translations).length
  const activeTrans = activeTransTab && translations[activeTransTab] ? translations[activeTransTab] : null
  const activeTransMeta = JD_LANGS.find(l => l.code === activeTransTab)

  return (
    <div className="min-h-screen bg-[#060609]">
      <PageStyles />
      <DotGrid />
      <Nav />

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-24">

        <div className="mb-6">
          <button onClick={() => { setError(''); setStage('intake') }} className="text-[#7E7E8E] text-xs hover:text-[#C7C7D1] transition-colors mb-3">
            ← Start over with a different JD
          </button>
          <h1 className="text-3xl font-black text-[#F4F4F7] mb-2">Review your role.</h1>
          <p className="text-[#A6A6B4] text-sm leading-relaxed">
            {aiFilled
              ? 'Everything below came from your JD — check it, change anything, then publish.'
              : 'Fill in the basics and the honest brief, then hit "Draft my JD with AI". You review the draft before anything goes live.'}
          </p>
        </div>

        {/* "Drafted for you" banner — explicit, obvious edit step */}
        {aiFilled && (
          <div className="rounded-xl px-4 py-3 mb-6 flex items-start gap-3" style={{ background: 'rgba(56, 189, 248, 0.10)', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
            <span className="text-base leading-none mt-0.5">✍️</span>
            <div>
              <p className="text-[#38BDF8] text-sm font-black">
                {aiFilled === 'parsed' ? 'Filled from your JD' : 'Drafted for you'} — review and edit anything before publishing.
              </p>
              <p className="text-[#A6A6B4] text-xs mt-0.5">Nothing goes live until you hit Publish. Every field below is yours to change.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3 mb-6 text-sm text-[#FB7185]">{error}</div>
        )}

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
                    ? { background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.45)' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-sm font-bold" style={{ color: engagementType === o.v ? '#38BDF8' : '#C7C7D1' }}>{o.l}</p>
                  <p className="text-[#7E7E8E] text-[10px] leading-tight">{o.s}</p>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setRemote(!remote)}
              className={`w-10 h-6 rounded-full transition-colors relative ${remote ? 'bg-[#38BDF8]' : 'bg-[rgba(255,255,255,0.05)]'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${remote ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-[#A6A6B4] text-sm">Remote / hybrid OK</span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <div
              onClick={() => setAcceptsPivot(!acceptsPivot)}
              className={`mt-0.5 flex-shrink-0 w-10 h-6 rounded-full transition-colors relative ${acceptsPivot ? 'bg-[#38BDF8]' : 'bg-[rgba(255,255,255,0.05)]'}`}>
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
            <span className="text-[#FB7185] text-xs font-bold">Required</span>
          </div>
          <p className="text-[#7E7E8E] text-xs mb-4 leading-relaxed">
            Mandatory on Shapi. Candidates pre-qualify themselves — you only hear from people who&apos;re genuinely interested at this range.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="required">Currency</label>
              <select className="field" value={currency} onChange={e => setCurrency(e.target.value)}
                style={{ appearance: 'none' }}>
                {CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#0D0C14' }}>{c}</option>)}
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
            <p className="text-[#38BDF8] text-xs font-semibold">
              {currency} {parseInt(salaryMin).toLocaleString()} – {parseInt(salaryMax).toLocaleString()} per year
            </p>
          )}

          <label className="flex items-center gap-3 cursor-pointer mt-4">
            <div
              onClick={() => setSalaryVisible(!salaryVisible)}
              className={`w-10 h-6 rounded-full transition-colors relative ${salaryVisible ? 'bg-[#38BDF8]' : 'bg-[rgba(255,255,255,0.05)]'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${salaryVisible ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-[#A6A6B4] text-sm">Show salary publicly on role listing</span>
          </label>
        </div>

        {/* Section 3 — the honest brief (feeds matching + the AI draft) */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5 space-y-5">
          <div>
            <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-1">The honest brief</p>
            <p className="text-[#7E7E8E] text-xs">
              {aiFilled === 'parsed'
                ? 'Pulled from your JD where we could — fill the gaps. Shapi uses this to match candidates, not just keywords.'
                : 'This is what Shapi uses to draft your JD and match candidates. Be specific.'}
            </p>
          </div>

          <div>
            <label className={aiFilled ? '' : 'required'}>What problem does this person need to solve in the first 90 days?</label>
            <textarea className="field" rows={3} value={problemToSolve} onChange={e => setProblemToSolve(e.target.value)}
              placeholder="E.g. We're scaling from 3 to 8 markets and our ops infrastructure is breaking. We need someone to rebuild our vendor management and reporting from scratch before Q3."
              style={{ resize: 'vertical' }} />
          </div>

          <div>
            <label>What does the ideal candidate look like? Think of the best person you&apos;ve hired for something similar.</label>
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

        {/* Section 4 — the JD itself, always editable before publish */}
        <div id="jd-section" className="gradient-border-card rounded-2xl p-6 mb-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-1">The job description</p>
              <p className="text-[#7E7E8E] text-xs">This is exactly what candidates will read. Edit freely.</p>
            </div>
            <button
              type="button"
              onClick={draftJD}
              disabled={drafting}
              className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-black transition-opacity disabled:opacity-40"
              style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              {drafting ? 'Drafting… ~15s' : description ? '↻ Redraft with AI' : 'Draft my JD with AI →'}
            </button>
          </div>

          <div>
            <label className="required">Description</label>
            <textarea className="field" rows={10} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What the role is, why it matters, what they'll actually do. Upload/paste your JD above — or fill the honest brief and hit 'Draft my JD with AI'."
              style={{ resize: 'vertical' }} />
          </div>

          <div>
            <label>Requirements / must-haves</label>
            <textarea className="field" rows={6} value={requirements} onChange={e => setRequirements(e.target.value)}
              placeholder={'- 5+ years leading multi-site operations\n- Has built vendor management from scratch\n- ...'}
              style={{ resize: 'vertical' }} />
          </div>
        </div>

        {/* Section 5 — translations */}
        <div className="gradient-border-card rounded-2xl p-6 mb-5">
          <div className="mb-4">
            <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-1">Translations <span className="text-[#7E7E8E] normal-case font-bold">(optional)</span></p>
            <p className="text-[#7E7E8E] text-xs leading-relaxed">
              Hiring across countries? Publish this JD in the languages your offices and candidates actually read. AI-translated, fully editable, saved with the role.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="flex-1 min-w-[180px]">
              <label>Language</label>
              <select className="field" value={translateLang} onChange={e => setTranslateLang(e.target.value)} style={{ appearance: 'none' }}>
                {JD_LANGS.map(l => (
                  <option key={l.code} value={l.code} style={{ background: '#0D0C14' }}>
                    {l.label} · {l.native}{translations[l.code] ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={translate}
              disabled={translating || (!description.trim() && !title.trim())}
              className="px-5 py-3 rounded-full text-xs font-black transition-opacity disabled:opacity-40"
              style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              {translating ? 'Translating…' : translations[translateLang] ? '↻ Re-translate' : 'Translate →'}
            </button>
          </div>

          {transError && (
            <div className="bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3 mb-4 text-xs text-[#FB7185]">{transError}</div>
          )}

          {transCount > 0 && (
            <>
              {/* Language tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.keys(translations).map(code => {
                  const meta = JD_LANGS.find(l => l.code === code)
                  const active = activeTransTab === code
                  return (
                    <button key={code} type="button" onClick={() => setActiveTransTab(code)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                      style={active
                        ? { background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.45)' }
                        : { background: 'rgba(255,255,255,0.05)', color: '#A6A6B4', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {meta?.native || code}
                    </button>
                  )
                })}
              </div>

              {activeTrans && (
                <div className="space-y-4 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-[#7E7E8E] text-[11px]">
                      AI-translated into {activeTransMeta?.label} — edit anything before publishing.
                    </p>
                    <button type="button" onClick={() => removeTranslation(activeTransTab)}
                      className="text-[#FB7185] text-[11px] font-bold hover:opacity-80 transition-opacity">
                      Remove {activeTransMeta?.label}
                    </button>
                  </div>
                  <div>
                    <label>Title ({activeTransMeta?.native})</label>
                    <input className="field" dir={activeTransMeta?.rtl ? 'rtl' : 'ltr'}
                      value={activeTrans.title}
                      onChange={e => updateTranslation(activeTransTab, 'title', e.target.value)} />
                  </div>
                  <div>
                    <label>Description ({activeTransMeta?.native})</label>
                    <textarea className="field" rows={8} dir={activeTransMeta?.rtl ? 'rtl' : 'ltr'}
                      value={activeTrans.description}
                      onChange={e => updateTranslation(activeTransTab, 'description', e.target.value)}
                      style={{ resize: 'vertical' }} />
                  </div>
                  <div>
                    <label>Requirements ({activeTransMeta?.native})</label>
                    <textarea className="field" rows={5} dir={activeTransMeta?.rtl ? 'rtl' : 'ltr'}
                      value={activeTrans.requirements}
                      onChange={e => updateTranslation(activeTransTab, 'requirements', e.target.value)}
                      style={{ resize: 'vertical' }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <button
          onClick={submit}
          className="w-full bg-gradient-to-r from-[#38BDF8] to-[#38BDF8] py-4 rounded-full font-black text-sm text-[#fff] hover:opacity-90 transition-opacity"
        >
          Publish role{transCount > 0 ? ` (+${transCount} translation${transCount > 1 ? 's' : ''})` : ''} →
        </button>
        <p className="text-center text-[#5C5C6A] text-xs mt-3">Nothing goes live until you hit publish — and you can edit the role any time after.</p>
      </div>
    </div>
  )
}

// ── Shared chrome ────────────────────────────────────────────────────────────

function PageStyles() {
  return (
    <style>{`
      .gradient-border-card {
        background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                    linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(56, 189, 248, 0.15)) border-box;
        border: 1px solid transparent;
        box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
      }
      .drop-zone-active {
        background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                    linear-gradient(135deg, rgba(56, 189, 248, 0.6), rgba(56, 189, 248, 0.6)) border-box !important;
        transform: scale(1.01);
      }
      .field { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 16px; font-size: 14px; color: #F4F4F7; outline: none; transition: border-color 0.2s; }
      .field::placeholder { color: rgba(126,126,142,1); }
      .field:focus { border-color: rgba(56, 189, 248, 0.5); }
      label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #A6A6B4; margin-bottom: 8px; }
      .required::after { content: " *"; color: #FB7185; }
    `}</style>
  )
}

function DotGrid() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{
      backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
      backgroundSize: '44px 44px',
    }} />
  )
}

function Nav() {
  return (
    <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-6xl mx-auto">
      <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
      <Link href="/company/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">← Dashboard</Link>
    </nav>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center px-6">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                      linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(56, 189, 248, 0.15)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />
      <div className="relative z-10 w-full max-w-md flex flex-col items-center py-10">{children}</div>
    </div>
  )
}
