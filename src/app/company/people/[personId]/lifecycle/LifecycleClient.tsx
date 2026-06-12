'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Accordion from '@/components/Accordion'
import type {
  LegalTemplate,
  TemplateCountry,
  TemplateProgramType,
} from '@/lib/legalTemplates'

// ────────────────────────────────────────────────────────────────────────────
// LifecycleClient — the interactive surface for PIP / Separation playbooks.
//
// Flow: pick PIP or Separation → pick country → see the matching VETTED legal
// template reference (NEVER AI-generated) → set 30/60/90 milestones + private
// notes → create. Existing programs can be advanced through statuses. The
// immutable decision audit trail for this person is shown at the bottom.
//
// All writes go through /api/company/lifecycle, which stamps company_id +
// decided_by_user_id from auth.uid() and writes the audit row server-side.
// ────────────────────────────────────────────────────────────────────────────

const ACCENT = '#9D8CFF'
const PURPLE = '#9D8CFF'
const SUCCESS = '#34D399'
const CORAL = '#FB7185'
const AMBER = '#FBBF24'
const CARD = '#0D0C14'
const HEADING_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }
const BODY_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }
const HAIRLINE = '1px solid rgba(255,255,255,0.06)'
const INPUT_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: 'rgba(255,255,255,0.9)',
}

type Program = {
  id: string
  person_id: string
  program_type: string
  status: string
  source_seat_id: string | null
  target_seat_id: string | null
  start_date: string
  target_end_date: string | null
  actual_end_date: string | null
  milestones_30d: unknown
  milestones_60d: unknown
  milestones_90d: unknown
  private_notes: string | null
  legal_template_ref: string | null
  assigned_hrbp_user_id: string | null
  reporting_manager_user_id: string | null
  created_at: string
}

type DecisionRow = {
  id: string
  decision_type: string
  justification: string
  impacted_person_id: string | null
  impacted_seat_id: string | null
  state_snapshot: unknown
  decided_at: string
}

const PROGRAM_TYPE_LABEL: Record<string, string> = {
  onboarding: 'Onboarding',
  pip: 'Performance plan (PIP)',
  separation: 'Separation',
  redeploy: 'Redeployment',
  reskill: 'Reskill',
  augment: 'Augmentation',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open: { bg: 'rgba(157, 140, 255, 0.14)', color: ACCENT },
  in_progress: { bg: 'rgba(157, 140, 255, 0.14)', color: PURPLE },
  completed: { bg: 'rgba(52,211,153,0.12)', color: SUCCESS },
  abandoned: { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' },
  escalated: { bg: 'rgba(251,113,133,0.12)', color: CORAL },
}

// Allowed forward transitions per status.
const NEXT_STATUSES: Record<string, string[]> = {
  open: ['in_progress', 'abandoned'],
  in_progress: ['completed', 'escalated', 'abandoned'],
  escalated: ['completed', 'abandoned'],
  completed: [],
  abandoned: [],
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Completed',
  abandoned: 'Abandoned',
  escalated: 'Escalated',
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return d
  }
}

function fmtDateTime(d: string): string {
  try {
    return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return d
  }
}

function toLines(m: unknown): string[] {
  if (Array.isArray(m)) return m.map((x) => String(x))
  return []
}

// ── Communications drafts ────────────────────────────────────────────────────
// STATIC, parameterized templates — NEVER AI-generated. Neutral, vetted wording
// that invites the employee to a discussion. The manager edits before sending.
function buildCommsSubject(programType: string): string {
  if (programType === 'separation') return 'Invitation to a meeting regarding your role'
  return 'Invitation to a performance discussion'
}

function buildCommsDraft(programType: string, name: string, roleTitle: string | null): string {
  const role = roleTitle ? ` as ${roleTitle}` : ''
  if (programType === 'separation') {
    return [
      `Dear ${name},`,
      ``,
      `I would like to arrange a meeting with you to discuss your employment and the next steps regarding your role${role}.`,
      ``,
      `We want this conversation to be handled respectfully and clearly. We will walk through the relevant process, the timelines involved, and any entitlements that apply, and you are welcome to ask questions and bring someone with you if you wish.`,
      ``,
      `Please let me know your availability over the coming days so we can confirm a suitable time.`,
      ``,
      `Kind regards,`,
      `HR`,
    ].join('\n')
  }
  return [
    `Dear ${name},`,
    ``,
    `I would like to invite you to a meeting to discuss your current performance and to talk through a Performance Improvement Plan (PIP) designed to support you in your role${role}.`,
    ``,
    `This is intended to be a constructive, two-way conversation. We will review specific objectives, the support available to you, and the review milestones over the coming weeks. You are very welcome to ask questions and share your perspective.`,
    ``,
    `Please let me know your availability over the next few days so we can confirm a suitable time.`,
    ``,
    `Kind regards,`,
    `HR`,
  ].join('\n')
}

// Default meeting slot: 10:00–10:45 local time, three days from now.
function defaultMeetingTimes(): { start: Date; end: Date } {
  const start = new Date()
  start.setDate(start.getDate() + 3)
  start.setHours(10, 0, 0, 0)
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + 45)
  return { start, end }
}

// Compact UTC stamp for ICS / Google Calendar: YYYYMMDDTHHMMSSZ.
function toCalStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function meetingTitle(programType: string, name: string): string {
  return programType === 'separation'
    ? `Meeting regarding role — ${name}`
    : `Performance (PIP) discussion — ${name}`
}

function meetingDetails(programType: string): string {
  return programType === 'separation'
    ? 'Confidential meeting to discuss employment and next steps. Booked via Shapi.'
    : 'Confidential meeting to discuss performance and the Performance Improvement Plan. Booked via Shapi.'
}

function buildICS(programType: string, name: string): string {
  const { start, end } = defaultMeetingTimes()
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@shapi.io`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shapi//Lifecycle//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toCalStamp(new Date())}`,
    `DTSTART:${toCalStamp(start)}`,
    `DTEND:${toCalStamp(end)}`,
    `SUMMARY:${meetingTitle(programType, name)}`,
    `DESCRIPTION:${meetingDetails(programType)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

function googleCalendarUrl(programType: string, name: string): string {
  const { start, end } = defaultMeetingTimes()
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: meetingTitle(programType, name),
    details: meetingDetails(programType),
    dates: `${toCalStamp(start)}/${toCalStamp(end)}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export default function LifecycleClient({
  personId,
  displayName,
  personEmail,
  roleTitle,
  programs,
  decisions,
  templates,
  countries,
  attachedTemplates,
}: {
  personId: string
  displayName: string
  personEmail: string | null
  roleTitle: string | null
  programs: Program[]
  decisions: DecisionRow[]
  templates: LegalTemplate[]
  countries: { code: TemplateCountry; label: string }[]
  attachedTemplates: LegalTemplate[]
}) {
  const router = useRouter()

  // ── Create form state ──────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [programType, setProgramType] = useState<TemplateProgramType>('pip')
  const [country, setCountry] = useState<TemplateCountry | ''>('')
  const [m30, setM30] = useState('')
  const [m60, setM60] = useState('')
  const [m90, setM90] = useState('')
  const [targetEnd, setTargetEnd] = useState('')
  const [justification, setJustification] = useState('')
  const [privateNotes, setPrivateNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTemplate =
    country ? templates.find((t) => t.country === country && t.programType === programType) || null : null

  function lookupTemplate(ref: string | null): LegalTemplate | null {
    if (!ref) return null
    return attachedTemplates.find((t) => t.ref === ref) || templates.find((t) => t.ref === ref) || null
  }

  function resetForm() {
    setCountry('')
    setM30('')
    setM60('')
    setM90('')
    setTargetEnd('')
    setJustification('')
    setPrivateNotes('')
    setError(null)
  }

  async function handleCreate() {
    setError(null)
    if (!country || !selectedTemplate) {
      setError('Pick a country to load the vetted legal template.')
      return
    }
    if (justification.trim().length < 20) {
      setError('Justification must be at least 20 characters — it is written to the immutable audit log.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/company/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: personId,
          program_type: programType,
          status: 'open',
          legal_template_ref: selectedTemplate.ref,
          justification: justification.trim(),
          target_end_date: targetEnd || undefined,
          private_notes: privateNotes || undefined,
          milestones_30d: m30.split('\n').map((s) => s.trim()).filter(Boolean),
          milestones_60d: m60.split('\n').map((s) => s.trim()).filter(Boolean),
          milestones_90d: m90.split('\n').map((s) => s.trim()).filter(Boolean),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.message || json.error || 'Could not create the program.')
        setSubmitting(false)
        return
      }
      resetForm()
      setShowForm(false)
      setSubmitting(false)
      router.refresh()
    } catch {
      setError('Network error — try again.')
      setSubmitting(false)
    }
  }

  // ── Advance an existing program ─────────────────────────────────────────────
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [advanceStatus, setAdvanceStatus] = useState<string>('')
  const [advanceJustification, setAdvanceJustification] = useState('')
  const [advanceErr, setAdvanceErr] = useState<string | null>(null)
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false)

  function openAdvance(p: Program, status: string) {
    setAdvancingId(p.id)
    setAdvanceStatus(status)
    setAdvanceJustification('')
    setAdvanceErr(null)
  }

  async function handleAdvance() {
    if (!advancingId) return
    setAdvanceErr(null)
    if (advanceJustification.trim().length < 20) {
      setAdvanceErr('Justification must be at least 20 characters — it is written to the immutable audit log.')
      return
    }
    setAdvanceSubmitting(true)
    try {
      const res = await fetch('/api/company/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: advancingId,
          status: advanceStatus,
          justification: advanceJustification.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAdvanceErr(json.message || json.error || 'Could not advance the program.')
        setAdvanceSubmitting(false)
        return
      }
      setAdvancingId(null)
      setAdvanceSubmitting(false)
      router.refresh()
    } catch {
      setAdvanceErr('Network error — try again.')
      setAdvanceSubmitting(false)
    }
  }

  // ── PIP / Separation communications ─────────────────────────────────────────
  const [commsOpenId, setCommsOpenId] = useState<string | null>(null)
  const [commsSubject, setCommsSubject] = useState<Record<string, string>>({})
  const [commsBody, setCommsBody] = useState<Record<string, string>>({})
  const [commsStatus, setCommsStatus] = useState<Record<string, 'idle' | 'sending' | 'sent' | 'error'>>({})
  const [commsFeedback, setCommsFeedback] = useState<Record<string, string>>({})

  function toggleComms(p: Program) {
    if (commsOpenId === p.id) {
      setCommsOpenId(null)
      return
    }
    // Seed the editable draft from the static parameterized template the first
    // time this program's comms area is opened.
    setCommsSubject((prev) =>
      prev[p.id] !== undefined ? prev : { ...prev, [p.id]: buildCommsSubject(p.program_type) }
    )
    setCommsBody((prev) =>
      prev[p.id] !== undefined ? prev : { ...prev, [p.id]: buildCommsDraft(p.program_type, displayName, roleTitle) }
    )
    setCommsOpenId(p.id)
  }

  async function handleCopyComms(p: Program) {
    const text = commsBody[p.id] ?? buildCommsDraft(p.program_type, displayName, roleTitle)
    try {
      await navigator.clipboard.writeText(text)
      setCommsFeedback((prev) => ({ ...prev, [p.id]: 'Copied to clipboard.' }))
    } catch {
      setCommsFeedback((prev) => ({ ...prev, [p.id]: 'Copy failed — select and copy manually.' }))
    }
  }

  async function handleSendComms(p: Program) {
    setCommsFeedback((prev) => ({ ...prev, [p.id]: '' }))
    if (!personEmail) {
      setCommsStatus((prev) => ({ ...prev, [p.id]: 'error' }))
      setCommsFeedback((prev) => ({ ...prev, [p.id]: 'This employee has no email on file.' }))
      return
    }
    const subject = (commsSubject[p.id] ?? buildCommsSubject(p.program_type)).trim()
    const body = (commsBody[p.id] ?? buildCommsDraft(p.program_type, displayName, roleTitle)).trim()
    if (body.length < 20) {
      setCommsStatus((prev) => ({ ...prev, [p.id]: 'error' }))
      setCommsFeedback((prev) => ({ ...prev, [p.id]: 'The message is too short to send.' }))
      return
    }
    setCommsStatus((prev) => ({ ...prev, [p.id]: 'sending' }))
    try {
      const res = await fetch('/api/company/lifecycle/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: p.id, subject, body }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCommsStatus((prev) => ({ ...prev, [p.id]: 'error' }))
        setCommsFeedback((prev) => ({ ...prev, [p.id]: json.message || json.error || 'Could not send.' }))
        return
      }
      setCommsStatus((prev) => ({ ...prev, [p.id]: 'sent' }))
      setCommsFeedback((prev) => ({ ...prev, [p.id]: `Sent to ${personEmail} · audit row recorded.` }))
      router.refresh()
    } catch {
      setCommsStatus((prev) => ({ ...prev, [p.id]: 'error' }))
      setCommsFeedback((prev) => ({ ...prev, [p.id]: 'Network error — try again.' }))
    }
  }

  function handleDownloadIcs(p: Program) {
    const ics = buildICS(p.program_type, displayName)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${p.program_type === 'separation' ? 'separation' : 'pip'}-discussion-${displayName.replace(/\s+/g, '-').toLowerCase()}.ics`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {/* ── Start a playbook ───────────────────────────────────────────────── */}
      {!showForm ? (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { setProgramType('pip'); setShowForm(true); resetForm() }}
            className="px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(157, 140, 255, 0.14)', color: PURPLE, border: `1px solid ${PURPLE}44` }}
          >
            Start a PIP
          </button>
          <button
            onClick={() => { setProgramType('separation'); setShowForm(true); resetForm() }}
            className="px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(251,113,133,0.12)', color: CORAL, border: `1px solid ${CORAL}44` }}
          >
            Start a Separation
          </button>
        </div>
      ) : (
        <section className="rounded-2xl p-5" style={{ background: CARD, border: HAIRLINE }}>
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-sm font-black" style={HEADING_STYLE}>
              New {programType === 'pip' ? 'Performance Improvement Plan' : 'Separation'} · {displayName}
            </h2>
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="text-xs font-bold"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Cancel
            </button>
          </div>

          {/* Program type toggle */}
          <div className="flex gap-2 mb-4">
            {(['pip', 'separation'] as TemplateProgramType[]).map((pt) => (
              <button
                key={pt}
                onClick={() => setProgramType(pt)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={
                  programType === pt
                    ? { background: ACCENT, color: '#060609' }
                    : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: HAIRLINE }
                }
              >
                {pt === 'pip' ? 'PIP' : 'Separation'}
              </button>
            ))}
          </div>

          {/* Country */}
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
            Country (drives the vetted template)
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value as TemplateCountry | '')}
            className="w-full rounded-lg px-3 py-2 text-sm mb-4 outline-none"
            style={INPUT_STYLE}
          >
            <option value="">Select a country…</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>

          {/* Matching VETTED template reference — NOT AI-generated. */}
          {country && (
            selectedTemplate ? (
              <div
                className="rounded-xl p-4 mb-4"
                style={{ background: 'rgba(157, 140, 255, 0.06)', border: `1px solid ${ACCENT}33` }}
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'rgba(52,211,153,0.12)', color: SUCCESS }}>
                    Vetted template
                  </span>
                  <span className="text-xs font-black" style={HEADING_STYLE}>{selectedTemplate.title}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                    {selectedTemplate.ref}
                  </span>
                </div>
                <p className="text-[11px] mb-2" style={BODY_STYLE}>
                  Governing law: {selectedTemplate.governingLaw} · counsel-reviewed {fmtDate(selectedTemplate.vettedOn)}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>Jurisdiction notes</p>
                <ul className="list-disc pl-4 mb-2 space-y-0.5">
                  {selectedTemplate.jurisdictionNotes.map((n, i) => (
                    <li key={i} className="text-[11px] leading-relaxed" style={BODY_STYLE}>{n}</li>
                  ))}
                </ul>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>Process</p>
                <ol className="list-decimal pl-4 mb-2 space-y-0.5">
                  {selectedTemplate.processSteps.map((s, i) => (
                    <li key={i} className="text-[11px] leading-relaxed" style={BODY_STYLE}>{s}</li>
                  ))}
                </ol>
                <p className="text-[10px] leading-relaxed" style={{ color: AMBER }}>
                  Shapi links you to this counsel-authored document — it does not draft the legal wording.
                  Human-filled slots: {selectedTemplate.placeholders.map((p) => p.token).join(', ')}.
                </p>
              </div>
            ) : (
              <div className="rounded-xl p-3 mb-4 text-[11px]" style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.25)', color: CORAL }}>
                No vetted template on file for this country / program type yet. Contact your Shapi
                legal-ops partner before proceeding.
              </div>
            )
          )}

          {/* Milestones */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {[
              { label: '30-day milestones', val: m30, set: setM30 },
              { label: '60-day milestones', val: m60, set: setM60 },
              { label: '90-day milestones', val: m90, set: setM90 },
            ].map((m) => (
              <div key={m.label}>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
                  {m.label}
                </label>
                <textarea
                  value={m.val}
                  onChange={(e) => m.set(e.target.value)}
                  rows={3}
                  placeholder="One per line…"
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-y"
                  style={INPUT_STYLE}
                />
              </div>
            ))}
          </div>

          {/* Target end date */}
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
            Target end date (optional)
          </label>
          <input
            type="date"
            value={targetEnd}
            onChange={(e) => setTargetEnd(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm mb-4 outline-none"
            style={INPUT_STYLE}
          />

          {/* Private notes with restricted badge */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <label className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
              Private notes
            </label>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251, 113, 133, 0.12)', color: CORAL }}>
              🔒 Restricted — excluded from Company Brain RAG
            </span>
          </div>
          <textarea
            value={privateNotes}
            onChange={(e) => setPrivateNotes(e.target.value)}
            rows={2}
            placeholder="HRBP-only context. Restricted to owner / assigned HRBP / reporting manager and never indexed."
            className="w-full rounded-lg px-3 py-2 text-xs mb-4 outline-none resize-y"
            style={INPUT_STYLE}
          />

          {/* Justification (audit) */}
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
            Justification (written to the immutable audit log · min 20 chars)
          </label>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={2}
            placeholder="Why this plan is being opened — the legally defensible reason."
            className="w-full rounded-lg px-3 py-2 text-xs mb-1 outline-none resize-y"
            style={INPUT_STYLE}
          />
          <p className="text-[10px] mb-4" style={BODY_STYLE}>
            {justification.trim().length}/20 characters minimum.
          </p>

          {error && (
            <p className="text-xs mb-3 font-bold" style={{ color: CORAL }}>{error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: '#eef1f6', color: '#060609' }}
          >
            {submitting ? 'Creating…' : `Open ${programType === 'pip' ? 'PIP' : 'Separation'}`}
          </button>
        </section>
      )}

      {/* ── Active / past programs ─────────────────────────────────────────── */}
      <Accordion title={`Programs (${programs.length})`} defaultOpen>
        {programs.length === 0 ? (
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.10)' }}>
            <p className="text-xs leading-relaxed" style={BODY_STYLE}>
              No lifecycle programs for {displayName} yet. Start a PIP or Separation above — you&apos;ll
              pick the country, get the matching vetted legal template, set 30 / 60 / 90 milestones,
              and every step is written to the immutable audit trail.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {programs.map((p) => {
              const s = STATUS_STYLE[p.status] || STATUS_STYLE.open
              const tpl = lookupTemplate(p.legal_template_ref)
              const next = NEXT_STATUSES[p.status] || []
              return (
                <li key={p.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: HAIRLINE }}>
                  <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                    <p className="text-xs font-black" style={HEADING_STYLE}>
                      {PROGRAM_TYPE_LABEL[p.program_type] || p.program_type}
                    </p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: s.bg, color: s.color }}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </div>
                  <p className="text-[11px] mb-2" style={BODY_STYLE}>
                    Started {fmtDate(p.start_date)}
                    {p.target_end_date ? ` · target ${fmtDate(p.target_end_date)}` : ''}
                    {p.actual_end_date ? ` · closed ${fmtDate(p.actual_end_date)}` : ''}
                  </p>

                  {tpl && (
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'rgba(52,211,153,0.12)', color: SUCCESS }}>
                        Vetted template
                      </span>
                      <span className="text-[11px]" style={BODY_STYLE}>{tpl.title}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>{tpl.ref}</span>
                    </div>
                  )}

                  {/* Milestones */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                    {[
                      { label: '30d', lines: toLines(p.milestones_30d) },
                      { label: '60d', lines: toLines(p.milestones_60d) },
                      { label: '90d', lines: toLines(p.milestones_90d) },
                    ].map((m) => (
                      <div key={m.label} className="rounded-lg p-2" style={{ background: 'rgba(157, 140, 255, 0.06)' }}>
                        <p className="text-[10px] font-bold mb-1" style={{ color: ACCENT }}>{m.label}</p>
                        {m.lines.length === 0 ? (
                          <p className="text-[10px]" style={BODY_STYLE}>—</p>
                        ) : (
                          <ul className="list-disc pl-3 space-y-0.5">
                            {m.lines.map((l, i) => (
                              <li key={i} className="text-[10px]" style={BODY_STYLE}>{l}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Private notes — restricted badge */}
                  {p.private_notes && (
                    <div className="rounded-lg p-2 mb-2" style={{ background: 'rgba(251, 113, 133, 0.06)', border: '1px solid rgba(251, 113, 133, 0.20)' }}>
                      <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: CORAL }}>
                        🔒 Private notes · restricted — excluded from Company Brain RAG
                      </p>
                      <p className="text-[11px] leading-relaxed" style={{ color: '#d8b4bb' }}>{p.private_notes}</p>
                    </div>
                  )}

                  {/* Advance controls */}
                  {next.length > 0 && advancingId !== p.id && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {next.map((ns) => (
                        <button
                          key={ns}
                          onClick={() => openAdvance(p, ns)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
                          style={{ background: (STATUS_STYLE[ns] || STATUS_STYLE.open).bg, color: (STATUS_STYLE[ns] || STATUS_STYLE.open).color }}
                        >
                          → {STATUS_LABEL[ns] || ns}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Inline advance form */}
                  {advancingId === p.id && (
                    <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: HAIRLINE }}>
                      <p className="text-[11px] font-bold mb-2" style={HEADING_STYLE}>
                        Advance to {STATUS_LABEL[advanceStatus] || advanceStatus} — justification required
                      </p>
                      <textarea
                        value={advanceJustification}
                        onChange={(e) => setAdvanceJustification(e.target.value)}
                        rows={2}
                        placeholder="Why this transition (min 20 chars) — written to the immutable audit log."
                        className="w-full rounded-lg px-3 py-2 text-xs mb-2 outline-none resize-y"
                        style={INPUT_STYLE}
                      />
                      {advanceErr && <p className="text-[11px] mb-2 font-bold" style={{ color: CORAL }}>{advanceErr}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={handleAdvance}
                          disabled={advanceSubmitting}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50"
                          style={{ background: '#eef1f6', color: '#060609' }}
                        >
                          {advanceSubmitting ? 'Saving…' : 'Confirm + audit'}
                        </button>
                        <button
                          onClick={() => setAdvancingId(null)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
                          style={{ color: 'rgba(255,255,255,0.5)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Communications — PIP / Separation only */}
                  {(p.program_type === 'pip' || p.program_type === 'separation') && (
                    <div className="mt-3 pt-3" style={{ borderTop: HAIRLINE }}>
                      <button
                        onClick={() => toggleComms(p)}
                        className="text-[11px] font-bold inline-flex items-center gap-1.5"
                        style={{ color: ACCENT }}
                      >
                        ✉️ Communications
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>{commsOpenId === p.id ? '▴' : '▾'}</span>
                      </button>

                      {commsOpenId === p.id && (
                        <div className="mt-2 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: HAIRLINE }}>
                          <p className="text-[10px] leading-relaxed mb-3" style={BODY_STYLE}>
                            Vetted, neutral draft you can edit before sending. Shapi never AI-drafts
                            legal wording — this is a parameterized invitation to a{' '}
                            {p.program_type === 'separation' ? 'separation meeting' : 'PIP discussion'}.
                          </p>

                          <p className="text-[10px] mb-2" style={BODY_STYLE}>
                            To:{' '}
                            {personEmail ? (
                              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{personEmail}</span>
                            ) : (
                              <span style={{ color: CORAL }}>no email on file</span>
                            )}
                          </p>

                          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
                            Subject
                          </label>
                          <input
                            value={commsSubject[p.id] ?? buildCommsSubject(p.program_type)}
                            onChange={(e) => setCommsSubject((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            className="w-full rounded-lg px-3 py-2 text-xs mb-3 outline-none"
                            style={INPUT_STYLE}
                          />

                          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
                            Message (editable)
                          </label>
                          <textarea
                            value={commsBody[p.id] ?? buildCommsDraft(p.program_type, displayName, roleTitle)}
                            onChange={(e) => setCommsBody((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            rows={10}
                            className="w-full rounded-lg px-3 py-2 text-xs mb-2 outline-none resize-y"
                            style={INPUT_STYLE}
                          />

                          {commsFeedback[p.id] && (
                            <p
                              className="text-[11px] mb-2 font-bold"
                              style={{ color: commsStatus[p.id] === 'error' ? CORAL : SUCCESS }}
                            >
                              {commsFeedback[p.id]}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleCopyComms(p)}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
                              style={{ background: 'rgba(157, 140, 255, 0.14)', color: PURPLE, border: `1px solid ${PURPLE}33` }}
                            >
                              Copy
                            </button>
                            <button
                              onClick={() => handleSendComms(p)}
                              disabled={commsStatus[p.id] === 'sending' || !personEmail}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50"
                              style={{ background: '#eef1f6', color: '#060609' }}
                            >
                              {commsStatus[p.id] === 'sending' ? 'Sending…' : 'Send via Shapi'}
                            </button>
                            <button
                              onClick={() => handleDownloadIcs(p)}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
                              style={{ background: 'rgba(52,211,153,0.10)', color: SUCCESS, border: '1px solid rgba(52,211,153,0.28)' }}
                            >
                              Add to calendar (.ics)
                            </button>
                            <a
                              href={googleCalendarUrl(p.program_type, displayName)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
                              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', border: HAIRLINE }}
                            >
                              Google Calendar →
                            </a>
                          </div>
                          <p className="text-[10px] mt-2" style={BODY_STYLE}>
                            Sending emails the employee via Shapi and records an immutable audit row.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Accordion>

      {/* ── Immutable decision audit trail ─────────────────────────────────── */}
      <Accordion
        title={`Decision audit trail (${decisions.length})`}
        badge={{ label: 'Immutable', color: AMBER, bg: 'rgba(251,191,36,0.12)' }}
      >
        <p className="text-[11px] mb-3" style={BODY_STYLE}>
          Every lifecycle transition for {displayName} is recorded here permanently and cannot be
          edited or deleted — the legally defensible trail for disputes, filings and due diligence.
        </p>
        {decisions.length === 0 ? (
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.10)' }}>
            <p className="text-xs" style={BODY_STYLE}>
              No decisions recorded yet. Opening or advancing a program writes an immutable audit row here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {decisions.map((d) => {
              const snap = (d.state_snapshot || {}) as { transition?: { from: string; to: string }; event?: string; program_type?: string }
              return (
                <li key={d.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: HAIRLINE }}>
                  <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'rgba(157, 140, 255, 0.12)', color: ACCENT }}>
                      {d.decision_type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px]" style={BODY_STYLE}>{fmtDateTime(d.decided_at)}</span>
                  </div>
                  {snap.event === 'created' && snap.program_type && (
                    <p className="text-[11px] mb-1" style={BODY_STYLE}>
                      Opened {PROGRAM_TYPE_LABEL[snap.program_type] || snap.program_type}
                    </p>
                  )}
                  {snap.transition && (
                    <p className="text-[11px] mb-1" style={BODY_STYLE}>
                      {STATUS_LABEL[snap.transition.from] || snap.transition.from} → {STATUS_LABEL[snap.transition.to] || snap.transition.to}
                    </p>
                  )}
                  <p className="text-xs leading-relaxed" style={{ color: '#d4d8e0' }}>{d.justification}</p>
                </li>
              )
            })}
          </ul>
        )}
      </Accordion>
    </div>
  )
}
