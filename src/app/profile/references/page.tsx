'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type RefRow = {
  id: string
  ref_type: 'manager' | 'colleague' | 'stakeholder'
  job_slot: number
  referee_name: string
  referee_title: string | null
  candidate_company: string
  candidate_job_title: string | null
  candidate_dates: string | null
  status: string
  nominated_by: string | null
  nominator_name: string | null
}

type WorkEntry = {
  title?: string
  company?: string
  start?: string
  end?: string
  achievements?: string
}

type JobForm = {
  workIndex: number | null  // index into work_history; null = none selected
  myTitle: string
  company: string
  dates: string
  managerName: string
  managerPhone: string   // primary — WhatsApp / SMS
  managerEmail: string   // secondary
  managerTitle: string
}

const EMPTY_JOB: JobForm = { workIndex: null, myTitle: '', company: '', dates: '', managerName: '', managerPhone: '', managerEmail: '', managerTitle: '' }

function workEntryLabel(w: WorkEntry, i: number): string {
  const title = w.title || `Role ${i + 1}`
  const company = w.company || 'unknown company'
  const dates = w.start || w.end ? ` · ${w.start || '?'} – ${w.end || 'present'}` : ''
  return `${title} at ${company}${dates}`
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Not sent',   color: '#7E7E8E',               bg: 'rgba(255,255,255,0.05)' },
  contacted: { label: 'Contacted',  color: '#6AA8F5',               bg: 'rgba(106,168,245,0.08)' },
  opened:    { label: 'Opened',     color: '#F08CAE',               bg: 'rgba(240,140,174,0.08)' },
  completed: { label: 'Responded ✓', color: '#6AA8F5',              bg: 'rgba(106,168,245,0.08)' },
  no_response: { label: 'No response', color: '#F58E9A',            bg: 'rgba(245,142,154,0.08)' },
  declined:  { label: 'Declined',   color: '#F58E9A',               bg: 'rgba(245,142,154,0.08)' },
}

const REF_TYPE_LABEL: Record<string, string> = {
  manager: 'Manager',
  colleague: 'Colleague',
  stakeholder: 'Stakeholder',
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100 }}>
      {cfg.label}
    </span>
  )
}

function FieldStyle({ children, label, placeholder, value, onChange, type = 'text' }: {
  children?: React.ReactNode; label: string; placeholder?: string;
  value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#7E7E8E', marginBottom: 6 }}>{label}</p>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#F4F4F7', outline: 'none', fontFamily: 'inherit',
        }}
      />
      {children}
    </div>
  )
}

export default function References() {
  const [refs, setRefs] = useState<RefRow[]>([])
  const [loadingRefs, setLoadingRefs] = useState(true)
  const [workHistory, setWorkHistory] = useState<WorkEntry[]>([])
  const [job1, setJob1] = useState<JobForm>(EMPTY_JOB)
  const [job2, setJob2] = useState<JobForm>(EMPTY_JOB)
  const [peerJob, setPeerJob] = useState<JobForm>(EMPTY_JOB)
  const [sending1, setSending1] = useState(false)
  const [sending2, setSending2] = useState(false)
  const [sendingPeer, setSendingPeer] = useState(false)
  const [sent1, setSent1] = useState(false)
  const [sent2, setSent2] = useState(false)
  const [sentPeer, setSentPeer] = useState(false)
  const [error1, setError1] = useState('')
  const [error2, setError2] = useState('')
  const [errorPeer, setErrorPeer] = useState('')
  // Test mode — when on, all reference outreach (manager + nominees) routes to
  // the candidate's own WhatsApp + email. Lets the founder/QA play all 3 roles.
  const [testMode, setTestMode] = useState(false)
  // Smart-picker suggestion from /api/references/suggest — Claude analyses
  // work_history + target industries and proposes the best 3 references
  type Suggestion = {
    currentRole: { index: number; reason: string }
    pastManagers: Array<{ index: number; reason: string }>
    reasoning: string
  } | null
  const [suggestion, setSuggestion] = useState<Suggestion>(null)
  const [loadingSuggestion, setLoadingSuggestion] = useState(true)

  const loadRefs = () => {
    fetch('/api/references/request')
      .then(r => r.json())
      .then(({ refs: rows }) => { setRefs(rows || []); setLoadingRefs(false) })
      .catch(() => setLoadingRefs(false))
  }

  const loadWorkHistory = () => {
    fetch('/api/profile/get')
      .then(r => r.json())
      .then(({ profile }) => {
        const wh = Array.isArray(profile?.work_history) ? (profile.work_history as WorkEntry[]) : []
        setWorkHistory(wh)
      })
      .catch(() => {})
  }

  const loadSuggestion = () => {
    setLoadingSuggestion(true)
    fetch('/api/references/suggest', { method: 'POST' })
      .then(r => r.json())
      .then((s: Suggestion) => { if (s && 'currentRole' in s) setSuggestion(s) })
      .catch(() => {})
      .finally(() => setLoadingSuggestion(false))
  }

  useEffect(() => { loadRefs(); loadWorkHistory(); loadSuggestion() }, [])

  // Pre-fill all 3 forms from Shapi's smart picker — only fires once workHistory + suggestion both loaded
  useEffect(() => {
    if (!suggestion || workHistory.length === 0) return
    const setFormFromIndex = (idx: number, setForm: (fn: (f: JobForm) => JobForm) => void) => {
      if (idx < 0 || idx >= workHistory.length) return
      const w = workHistory[idx]
      const dates = w.start || w.end ? `${w.start || ''} – ${w.end || 'present'}` : ''
      setForm(f => f.workIndex !== null ? f : ({ ...f, workIndex: idx, myTitle: w.title || '', company: w.company || '', dates }))
    }
    setFormFromIndex(suggestion.currentRole.index, setPeerJob)
    if (suggestion.pastManagers[0]) setFormFromIndex(suggestion.pastManagers[0].index, setJob1)
    if (suggestion.pastManagers[1]) setFormFromIndex(suggestion.pastManagers[1].index, setJob2)
  }, [suggestion, workHistory])

  // When a candidate picks a work-history entry from the dropdown, auto-populate the role context fields
  const pickWorkEntry = (slot: 1 | 2 | 'peer', idxStr: string) => {
    const idx = idxStr === '' ? null : parseInt(idxStr, 10)
    const setForm = slot === 1 ? setJob1 : slot === 2 ? setJob2 : setPeerJob
    if (idx === null || Number.isNaN(idx) || idx < 0 || idx >= workHistory.length) {
      setForm(f => ({ ...f, workIndex: null, myTitle: '', company: '', dates: '' }))
      return
    }
    const w = workHistory[idx]
    const dates = w.start || w.end ? `${w.start || ''} – ${w.end || 'present'}` : ''
    setForm(f => ({
      ...f,
      workIndex: idx,
      myTitle: w.title || '',
      company: w.company || '',
      dates,
    }))
  }

  // Peer reference for current role — uses the same form shape but writes ref_type='peer' + is_current_role=true
  const sendPeerRequest = async () => {
    const form = peerJob
    if (!form.managerName || !form.company || (!form.managerPhone && !form.managerEmail)) {
      setErrorPeer('Colleague name, company, and at least a phone number or email are required.')
      return
    }
    setSendingPeer(true)
    setErrorPeer('')
    const reason = suggestion?.currentRole.reason || ''
    const res = await fetch('/api/references/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_slot: 1,                       // peer always lives on slot 1 for simplicity (one peer per candidate)
        ref_type: 'peer',
        is_current_role: true,
        suggested_reason: reason,
        referee_name: form.managerName,
        referee_phone: form.managerPhone || undefined,
        referee_email: form.managerEmail || undefined,
        referee_title: form.managerTitle || undefined,
        candidate_job_title: form.myTitle || undefined,
        candidate_company: form.company,
        candidate_dates: form.dates || undefined,
        is_test_outreach: testMode,
      }),
    })
    setSendingPeer(false)
    if (res.ok) {
      setSentPeer(true)
      loadRefs()
    } else {
      const d = await res.json().catch(() => ({}))
      setErrorPeer(d.error || 'Something went wrong — try again.')
    }
  }

  const sendRequest = async (slot: 1 | 2) => {
    const form = slot === 1 ? job1 : job2
    const setSending = slot === 1 ? setSending1 : setSending2
    const setSent = slot === 1 ? setSent1 : setSent2
    const setError = slot === 1 ? setError1 : setError2

    if (!form.managerName || !form.company || (!form.managerPhone && !form.managerEmail)) {
      setError('Manager name, company, and at least a phone number or email are required.')
      return
    }
    setSending(true)
    setError('')
    const reason = suggestion?.pastManagers?.[slot - 1]?.reason || ''
    const res = await fetch('/api/references/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_slot: slot,
        ref_type: 'manager',
        is_current_role: false,
        suggested_reason: reason,
        referee_name: form.managerName,
        referee_phone: form.managerPhone || undefined,
        referee_email: form.managerEmail || undefined,
        referee_title: form.managerTitle || undefined,
        candidate_job_title: form.myTitle || undefined,
        candidate_company: form.company,
        candidate_dates: form.dates || undefined,
        is_test_outreach: testMode,
      }),
    })
    setSending(false)
    if (res.ok) {
      setSent(true)
      loadRefs()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Something went wrong — try again.')
    }
  }

  // Organise refs by slot
  const bySlot = (slot: number) => refs.filter(r => r.job_slot === slot)
  const completedCount = refs.filter(r => r.status === 'completed').length
  const totalCount = refs.length

  // Determine if a slot already has a manager reference sent
  const managerSent = (slot: number) => refs.some(r => r.job_slot === slot && r.ref_type === 'manager')

  return (
    <div className="min-h-screen bg-[#0E0E13]">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.05) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />

      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-3xl mx-auto border-b border-white/[0.08]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/profile?tab=verification" className="text-[#A6A6B4] text-sm hover:text-[#C7C7D1] transition-colors">← Profile</Link>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-24">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2" style={{ color: '#FB7185' }}>Get Vouched.</h1>
          <p className="text-[#7E7E8E] text-sm leading-relaxed max-w-xl">
            Give us your manager&apos;s details for two jobs. We email them independently — they fill in a short form and nominate a colleague and stakeholder from their team.
            Those people get reached out to directly. <strong className="text-[#C7C7D1]">You don&apos;t find out who was nominated or what was said.</strong> That&apos;s what makes it credible.
          </p>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mb-8 p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Verification progress</p>
              <p className="text-[#F4F4F7] font-black text-sm">{completedCount} / {totalCount} responded</p>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`, background: 'linear-gradient(90deg,#6AA8F5,#F08CAE)' }} />
            </div>
            {completedCount >= 3 && (
              <p className="text-[#6AA8F5] text-xs font-bold mt-2">✓ Verification threshold reached — your profile now shows verified references.</p>
            )}
          </div>
        )}

        {/* Status tracker — shown once refs exist */}
        {refs.length > 0 && (
          <div className="mb-8">
            {[1, 2].map(slot => {
              const slotRefs = bySlot(slot)
              if (slotRefs.length === 0) return null
              const mgr = slotRefs.find(r => r.ref_type === 'manager')
              return (
                <div key={slot} className="mb-5 p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider mb-4">
                    Job {slot} — {mgr?.candidate_company || `Slot ${slot}`}
                  </p>
                  <div className="space-y-2">
                    {slotRefs.map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[#7E7E8E] text-xs w-20 flex-shrink-0">{REF_TYPE_LABEL[r.ref_type]}</span>
                          <span className="text-[#C7C7D1] text-sm truncate">
                            {r.referee_name}
                            {r.nominator_name && <span className="text-[#7E7E8E] text-xs ml-2">nominated by {r.nominator_name}</span>}
                          </span>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                    ))}
                    {/* Show pending slots for colleague + stakeholder if not nominated yet */}
                    {slotRefs.filter(r => r.ref_type !== 'manager').length === 0 && mgr?.status === 'contacted' && (
                      <p className="text-[#5C5C6A] text-xs mt-2 pl-[92px]">Colleague and stakeholder will be nominated by the manager when they respond.</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Test mode toggle — routes ALL outreach (manager + nominees) to the candidate */}
        <label className="flex items-center gap-3 mb-6 p-4 rounded-xl cursor-pointer transition-colors"
          style={{
            background: testMode ? 'rgba(240,140,174,0.08)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${testMode ? 'rgba(240,140,174,0.3)' : 'rgba(255,255,255,0.08)'}`,
          }}>
          <input type="checkbox" checked={testMode} onChange={e => setTestMode(e.target.checked)}
            className="w-4 h-4 accent-[#F08CAE]" />
          <div>
            <p className={`text-sm font-bold ${testMode ? 'text-[#F08CAE]' : 'text-[#C7C7D1]'}`}>
              🧪 Test mode — send all outreach to me
            </p>
            <p className="text-[#7E7E8E] text-xs mt-0.5">
              Everything that would go to the manager, colleague, and stakeholder routes to your own WhatsApp + email. Use this to validate the full chain end-to-end without involving real contacts.
            </p>
          </div>
        </label>

        {/* Shapi's smart-picker recommendation banner */}
        {suggestion && (
          <div className="mb-6 p-4 rounded-2xl" style={{
            background: 'rgba(240,140,174,0.06)',
            border: '1px solid rgba(240,140,174,0.18)',
          }}>
            <p className="text-[#F08CAE] text-xs font-bold uppercase tracking-wider mb-2">💡 Shapi recommends</p>
            <p className="text-[#C7C7D1] text-sm leading-relaxed mb-2">{suggestion.reasoning}</p>
            <p className="text-[#7E7E8E] text-xs">You can change any of the picks below if you prefer different roles.</p>
          </div>
        )}
        {loadingSuggestion && (
          <div className="mb-6 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-[#7E7E8E] text-xs">✨ Shapi is picking the best references for your CV…</p>
          </div>
        )}

        {/* ─── Peer reference for CURRENT role (discretion-protected) ─── */}
        <div className="mb-6 rounded-2xl p-6" style={{
          background: 'linear-gradient(#16161F,#16161F) padding-box,linear-gradient(135deg,rgba(106,168,245,0.15),rgba(245,142,154,0.12)) border-box',
          border: '1px solid transparent',
          boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)',
        }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[#6AA8F5] text-xs font-bold uppercase tracking-wider">Current role · peer reference</p>
            {sentPeer && <span className="text-[#6AA8F5] text-xs font-bold">✓ Sent</span>}
          </div>
          <p className="text-[#7E7E8E] text-xs mb-5">A <strong>colleague</strong> (not your manager) from your current job. Keeps your job-hunt discreet — we never contact your current boss.</p>

          {sentPeer ? (
            <p className="text-[#A6A6B4] text-sm">Peer reference request sent to {peerJob.managerName}. They&apos;ll have 3 quick questions to answer.</p>
          ) : (
            <div className="space-y-4">
              {workHistory.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#7E7E8E', marginBottom: 6 }}>
                    Which is your current role?
                  </p>
                  <select
                    value={peerJob.workIndex === null ? '' : peerJob.workIndex.toString()}
                    onChange={e => pickWorkEntry('peer', e.target.value)}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#F4F4F7', outline: 'none',
                      fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    <option value="" style={{ background: '#16161F' }}>— Pick your current role —</option>
                    {workHistory.map((w, i) => (
                      <option key={i} value={i} style={{ background: '#16161F' }}>
                        {workEntryLabel(w, i)}
                      </option>
                    ))}
                  </select>
                  {suggestion?.currentRole && peerJob.workIndex === suggestion.currentRole.index && (
                    <p style={{ fontSize: 11, color: '#6AA8F5', marginTop: 6 }}>
                      💡 Shapi&apos;s pick: {suggestion.currentRole.reason}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldStyle label="Your job title" placeholder="Head of Operations" value={peerJob.myTitle} onChange={v => setPeerJob(f => ({ ...f, myTitle: v }))} />
                <FieldStyle label="Company" placeholder="NEOM" value={peerJob.company} onChange={v => setPeerJob(f => ({ ...f, company: v }))} />
              </div>
              <FieldStyle label="Dates" placeholder="2024 – present" value={peerJob.dates} onChange={v => setPeerJob(f => ({ ...f, dates: v }))} />

              <div className="border-t border-white/[0.08] pt-4">
                <div className="flex items-start justify-between mb-4">
                  <p className="text-[#7E7E8E] text-xs font-bold uppercase tracking-wider">Colleague (not manager)</p>
                  <p className="text-[#5C5C6A] text-xs">At least one contact method required</p>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FieldStyle label="Colleague's full name *" placeholder="Lara Hassan" value={peerJob.managerName} onChange={v => setPeerJob(f => ({ ...f, managerName: v }))} />
                    <FieldStyle label="Their role" placeholder="Head of Marketing" value={peerJob.managerTitle} onChange={v => setPeerJob(f => ({ ...f, managerTitle: v }))} />
                  </div>
                  <FieldStyle label="WhatsApp / Phone number" placeholder="+971 50 123 4567" value={peerJob.managerPhone} onChange={v => setPeerJob(f => ({ ...f, managerPhone: v }))} type="tel" />
                  <FieldStyle label="Work email" placeholder="lara@company.com" value={peerJob.managerEmail} onChange={v => setPeerJob(f => ({ ...f, managerEmail: v }))} type="email" />
                </div>
              </div>

              {errorPeer && <p className="text-[#F58E9A] text-xs bg-[#F58E9A]/10 border border-[#F58E9A]/20 rounded-xl px-4 py-3">{errorPeer}</p>}

              <button
                onClick={sendPeerRequest}
                disabled={sendingPeer || sentPeer}
                className="w-full py-3.5 rounded-full font-black text-sm transition-opacity disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', color: '#060609' }}>
                {sentPeer ? '✓ Peer reference sent' : sendingPeer ? 'Sending…' : 'Send peer reference →'}
              </button>
            </div>
          )}
        </div>

        {/* ─── Past role manager references (2 of them) ─── */}
        <div className="mb-3 mt-8">
          <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">Past role manager references</p>
          <p className="text-[#7E7E8E] text-xs mt-1">2 line managers from past roles. They&apos;ll each nominate a colleague + stakeholder — those nominees get contacted independently.</p>
        </div>

        {/* Job forms */}
        {[1, 2].map(slot => {
          const form = slot === 1 ? job1 : job2
          const setForm = slot === 1 ? setJob1 : setJob2
          const sending = slot === 1 ? sending1 : sending2
          const sent = slot === 1 ? sent1 : sent2
          const err = slot === 1 ? error1 : error2
          const alreadySent = managerSent(slot)

          return (
            <div key={slot} className="mb-6 rounded-2xl p-6" style={{
              background: 'linear-gradient(#16161F,#16161F) padding-box,linear-gradient(135deg,rgba(106,168,245,0.12),rgba(240,140,174,0.12)) border-box',
              border: '1px solid transparent',
              boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)',
            }}>
              <div className="flex items-center justify-between mb-5">
                <p className="text-[#A6A6B4] text-xs font-bold uppercase tracking-wider">
                  Reference {slot} of 2
                </p>
                {alreadySent && <span className="text-[#6AA8F5] text-xs font-bold">✓ Sent</span>}
              </div>

              {alreadySent && !sent ? (
                <p className="text-[#7E7E8E] text-sm">Reference request sent. You can re-send with updated details if needed.</p>
              ) : (
                <div className="space-y-4">
                  {/* Role picker — pick which job from work_history this reference is for.
                      Lets candidates aligned to a target sector pick the relevant roles
                      (not just the chronologically latest 2). */}
                  {workHistory.length > 0 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#7E7E8E', marginBottom: 6 }}>
                        Which role is this reference for?
                      </p>
                      <select
                        value={form.workIndex === null ? '' : form.workIndex.toString()}
                        onChange={e => pickWorkEntry(slot as 1 | 2, e.target.value)}
                        style={{
                          width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#F4F4F7', outline: 'none',
                          fontFamily: 'inherit', cursor: 'pointer',
                        }}
                      >
                        <option value="" style={{ background: '#16161F' }}>— Pick a role from your CV —</option>
                        {workHistory.map((w, i) => {
                          // Disable in this dropdown if the OTHER form already picked this role
                          const otherForm = slot === 1 ? job2 : job1
                          const isUsedByOther = otherForm.workIndex === i
                          return (
                            <option key={i} value={i} disabled={isUsedByOther} style={{ background: '#16161F' }}>
                              {workEntryLabel(w, i)}{isUsedByOther ? '  (used for the other reference)' : ''}
                            </option>
                          )
                        })}
                      </select>
                      <p style={{ fontSize: 11, color: '#A6A6B4', marginTop: 6, lineHeight: 1.5 }}>
                        💡 Pick the role most <strong>relevant to where you&apos;re applying</strong> — not necessarily your latest. If you&apos;re moving into sales, pick a sales role even if your last job was operations.
                      </p>
                      {suggestion?.pastManagers?.[slot - 1] && form.workIndex === suggestion.pastManagers[slot - 1].index && (
                        <p style={{ fontSize: 11, color: '#F08CAE', marginTop: 6 }}>
                          💡 Shapi&apos;s pick: {suggestion.pastManagers[slot - 1].reason}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldStyle label="Your job title" placeholder="Head of Operations" value={form.myTitle} onChange={v => setForm(f => ({ ...f, myTitle: v }))} />
                    <FieldStyle label="Company" placeholder="NEOM" value={form.company} onChange={v => setForm(f => ({ ...f, company: v }))} />
                  </div>
                  <FieldStyle label="Dates (approx)" placeholder="2022 – 2024" value={form.dates} onChange={v => setForm(f => ({ ...f, dates: v }))} />

                  <div className="border-t border-white/[0.08] pt-4">
                    <div className="flex items-start justify-between mb-4">
                      <p className="text-[#7E7E8E] text-xs font-bold uppercase tracking-wider">Direct manager</p>
                      <p className="text-[#5C5C6A] text-xs">At least one contact method required</p>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FieldStyle label="Manager's full name *" placeholder="Sarah Al-Mutairi" value={form.managerName} onChange={v => setForm(f => ({ ...f, managerName: v }))} />
                        <FieldStyle label="Their job title" placeholder="VP Operations" value={form.managerTitle} onChange={v => setForm(f => ({ ...f, managerTitle: v }))} />
                      </div>
                      <FieldStyle label="WhatsApp / Phone number (primary)" placeholder="+971 50 123 4567" value={form.managerPhone} onChange={v => setForm(f => ({ ...f, managerPhone: v }))} type="tel">
                        <p style={{ fontSize: 11, color: '#5C5C6A', marginTop: 5 }}>We try WhatsApp first — if they&apos;re not on it, we fall back to SMS automatically.</p>
                      </FieldStyle>
                      <FieldStyle label="Work email (secondary)" placeholder="sarah@company.com" value={form.managerEmail} onChange={v => setForm(f => ({ ...f, managerEmail: v }))} type="email">
                        <p style={{ fontSize: 11, color: '#5C5C6A', marginTop: 5 }}>Sent alongside WhatsApp — they click whichever they see first.</p>
                      </FieldStyle>
                    </div>
                  </div>

                  {err && <p className="text-[#F58E9A] text-xs bg-[#F58E9A]/10 border border-[#F58E9A]/20 rounded-xl px-4 py-3">{err}</p>}

                  <button
                    onClick={() => sendRequest(slot as 1 | 2)}
                    disabled={sending || sent}
                    className="w-full py-3.5 rounded-full font-black text-sm transition-opacity disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', color: '#060609' }}>
                    {sent ? '✓ Reference request sent' : sending ? 'Sending…' : `Send reference request →`}
                  </button>

                  {sent && (
                    <p className="text-[#7E7E8E] text-xs text-center">
                      Email sent to {form.managerName}. Once they respond, they&apos;ll nominate a colleague and stakeholder — we&apos;ll contact those people independently.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <p className="text-[#5C5C6A] text-xs text-center leading-relaxed max-w-md mx-auto">
          References are independent — you won&apos;t be told who the colleague and stakeholder are, and you can&apos;t see their responses. The count and summary appear on your public profile.
        </p>
      </div>
    </div>
  )
}
