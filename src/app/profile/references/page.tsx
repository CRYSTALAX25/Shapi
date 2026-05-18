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

type JobForm = {
  myTitle: string
  company: string
  dates: string
  managerName: string
  managerPhone: string   // primary — WhatsApp / SMS
  managerEmail: string   // secondary
  managerTitle: string
}

const EMPTY_JOB: JobForm = { myTitle: '', company: '', dates: '', managerName: '', managerPhone: '', managerEmail: '', managerTitle: '' }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Not sent',   color: 'rgba(255,255,255,0.3)',  bg: 'rgba(255,255,255,0.04)' },
  contacted: { label: 'Contacted',  color: '#22D3EE',               bg: 'rgba(34,211,238,0.08)' },
  opened:    { label: 'Opened',     color: '#A78BFA',               bg: 'rgba(167,139,250,0.08)' },
  completed: { label: 'Responded ✓', color: '#34D399',              bg: 'rgba(52,211,153,0.08)' },
  no_response: { label: 'No response', color: '#FB7185',            bg: 'rgba(251,113,133,0.08)' },
  declined:  { label: 'Declined',   color: '#FB7185',               bg: 'rgba(251,113,133,0.08)' },
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
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>{label}</p>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 10, padding: '11px 14px', fontSize: 14, color: 'white', outline: 'none', fontFamily: 'inherit',
        }}
      />
      {children}
    </div>
  )
}

export default function References() {
  const [refs, setRefs] = useState<RefRow[]>([])
  const [loadingRefs, setLoadingRefs] = useState(true)
  const [job1, setJob1] = useState<JobForm>(EMPTY_JOB)
  const [job2, setJob2] = useState<JobForm>(EMPTY_JOB)
  const [sending1, setSending1] = useState(false)
  const [sending2, setSending2] = useState(false)
  const [sent1, setSent1] = useState(false)
  const [sent2, setSent2] = useState(false)
  const [error1, setError1] = useState('')
  const [error2, setError2] = useState('')
  // Test mode — when on, all reference outreach (manager + nominees) routes to
  // the candidate's own WhatsApp + email. Lets the founder/QA play all 3 roles.
  const [testMode, setTestMode] = useState(false)

  const loadRefs = () => {
    fetch('/api/references/request')
      .then(r => r.json())
      .then(({ refs: rows }) => { setRefs(rows || []); setLoadingRefs(false) })
      .catch(() => setLoadingRefs(false))
  }

  useEffect(() => { loadRefs() }, [])

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
    const res = await fetch('/api/references/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_slot: slot,
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
    <div className="min-h-screen bg-[#060609]">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle,rgba(34,211,238,0.07) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />

      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-3xl mx-auto border-b border-white/[0.05]">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#A78BFA,#22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href="/profile" className="text-white/40 text-sm hover:text-white/60 transition-colors">← Profile</Link>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-24">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Get Vouched.</h1>
          <p className="text-white/35 text-sm leading-relaxed max-w-xl">
            Give us your manager&apos;s details for two jobs. We email them independently — they fill in a short form and nominate a colleague and stakeholder from their team.
            Those people get reached out to directly. <strong className="text-white/55">You don&apos;t find out who was nominated or what was said.</strong> That&apos;s what makes it credible.
          </p>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mb-8 p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/50 text-xs font-bold uppercase tracking-wider">Verification progress</p>
              <p className="text-white font-black text-sm">{completedCount} / {totalCount} responded</p>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`, background: 'linear-gradient(90deg,#22D3EE,#A78BFA)' }} />
            </div>
            {completedCount >= 3 && (
              <p className="text-[#34D399] text-xs font-bold mt-2">✓ Verification threshold reached — your profile now shows verified references.</p>
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
                <div key={slot} className="mb-5 p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-4">
                    Job {slot} — {mgr?.candidate_company || `Slot ${slot}`}
                  </p>
                  <div className="space-y-2">
                    {slotRefs.map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-white/25 text-xs w-20 flex-shrink-0">{REF_TYPE_LABEL[r.ref_type]}</span>
                          <span className="text-white/60 text-sm truncate">
                            {r.referee_name}
                            {r.nominator_name && <span className="text-white/25 text-xs ml-2">nominated by {r.nominator_name}</span>}
                          </span>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                    ))}
                    {/* Show pending slots for colleague + stakeholder if not nominated yet */}
                    {slotRefs.filter(r => r.ref_type !== 'manager').length === 0 && mgr?.status === 'contacted' && (
                      <p className="text-white/20 text-xs mt-2 pl-[92px]">Colleague and stakeholder will be nominated by the manager when they respond.</p>
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
            background: testMode ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${testMode ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)'}`,
          }}>
          <input type="checkbox" checked={testMode} onChange={e => setTestMode(e.target.checked)}
            className="w-4 h-4 accent-[#FBBF24]" />
          <div>
            <p className={`text-sm font-bold ${testMode ? 'text-[#FBBF24]' : 'text-white/60'}`}>
              🧪 Test mode — send all outreach to me
            </p>
            <p className="text-white/30 text-xs mt-0.5">
              Everything that would go to the manager, colleague, and stakeholder routes to your own WhatsApp + email. Use this to validate the full chain end-to-end without involving real contacts.
            </p>
          </div>
        </label>

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
              background: 'linear-gradient(#0d0d14,#0d0d14) padding-box,linear-gradient(135deg,rgba(34,211,238,0.12),rgba(139,92,246,0.12)) border-box',
              border: '1px solid transparent',
            }}>
              <div className="flex items-center justify-between mb-5">
                <p className="text-white/50 text-xs font-bold uppercase tracking-wider">
                  {slot === 1 ? 'Most recent job' : 'Previous job'}
                </p>
                {alreadySent && <span className="text-[#22D3EE] text-xs font-bold">✓ Sent</span>}
              </div>

              {alreadySent && !sent ? (
                <p className="text-white/30 text-sm">Reference request sent. You can re-send with updated details if needed.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldStyle label="Your job title" placeholder="Head of Operations" value={form.myTitle} onChange={v => setForm(f => ({ ...f, myTitle: v }))} />
                    <FieldStyle label="Company" placeholder="NEOM" value={form.company} onChange={v => setForm(f => ({ ...f, company: v }))} />
                  </div>
                  <FieldStyle label="Dates (approx)" placeholder="2022 – 2024" value={form.dates} onChange={v => setForm(f => ({ ...f, dates: v }))} />

                  <div className="border-t border-white/[0.06] pt-4">
                    <div className="flex items-start justify-between mb-4">
                      <p className="text-white/35 text-xs font-bold uppercase tracking-wider">Direct manager</p>
                      <p className="text-white/20 text-xs">At least one contact method required</p>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FieldStyle label="Manager's full name *" placeholder="Sarah Al-Mutairi" value={form.managerName} onChange={v => setForm(f => ({ ...f, managerName: v }))} />
                        <FieldStyle label="Their job title" placeholder="VP Operations" value={form.managerTitle} onChange={v => setForm(f => ({ ...f, managerTitle: v }))} />
                      </div>
                      <FieldStyle label="WhatsApp / Phone number (primary)" placeholder="+971 50 123 4567" value={form.managerPhone} onChange={v => setForm(f => ({ ...f, managerPhone: v }))} type="tel">
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 5 }}>We try WhatsApp first — if they&apos;re not on it, we fall back to SMS automatically.</p>
                      </FieldStyle>
                      <FieldStyle label="Work email (secondary)" placeholder="sarah@company.com" value={form.managerEmail} onChange={v => setForm(f => ({ ...f, managerEmail: v }))} type="email">
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 5 }}>Sent alongside WhatsApp — they click whichever they see first.</p>
                      </FieldStyle>
                    </div>
                  </div>

                  {err && <p className="text-[#FB7185] text-xs bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3">{err}</p>}

                  <button
                    onClick={() => sendRequest(slot as 1 | 2)}
                    disabled={sending || sent}
                    className="w-full py-3.5 rounded-full font-black text-sm transition-opacity disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#22D3EE,#A78BFA)', color: '#060609' }}>
                    {sent ? '✓ Reference request sent' : sending ? 'Sending…' : `Send reference request →`}
                  </button>

                  {sent && (
                    <p className="text-white/25 text-xs text-center">
                      Email sent to {form.managerName}. Once they respond, they&apos;ll nominate a colleague and stakeholder — we&apos;ll contact those people independently.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <p className="text-white/20 text-xs text-center leading-relaxed max-w-md mx-auto">
          References are independent — you won&apos;t be told who the colleague and stakeholder are, and you can&apos;t see their responses. The count and summary appear on your public profile.
        </p>
      </div>
    </div>
  )
}
