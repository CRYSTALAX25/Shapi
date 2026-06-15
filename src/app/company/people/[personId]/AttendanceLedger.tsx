'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ────────────────────────────────────────────────────────────────────────────
// AttendanceLedger — editable Time-off list for the HR portal.
//
// Renders the recent attendance entries and lets the manager CORRECT a record
// (wrong sick-leave date, a holiday that wasn't taken, etc.) or delete it.
// Writes go through PATCH / DELETE /api/company/attendance (company-scoped +
// auth'd). PDPL-aware: medical-consent rows arrive with notes already stripped
// by the server, so we never surface clinical detail and we hide the notes
// field for those rows.
// ────────────────────────────────────────────────────────────────────────────

const ACCENT = '#38BDF8'
const SUCCESS = '#34D399'
const CORAL = '#FB7185'
const HEADING_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }
const BODY_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }
const HAIRLINE = '1px solid rgba(255,255,255,0.06)'
const INPUT_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: 'rgba(255,255,255,0.9)',
}

export type AttendanceEntry = {
  id: string
  entry_type: string
  start_date: string
  end_date: string
  days: number
  notes: string | null
  medical_consent_logged: boolean
  logged_via: string
  approved_at: string | null
}

const ENTRY_TYPES = [
  'annual_leave',
  'sick_leave',
  'parental_leave',
  'bereavement',
  'personal',
  'unpaid',
  'public_holiday',
] as const

const ENTRY_TYPE_LABEL: Record<string, string> = {
  annual_leave: 'Annual leave',
  sick_leave: 'Sick leave',
  parental_leave: 'Parental leave',
  bereavement: 'Bereavement',
  personal: 'Personal',
  unpaid: 'Unpaid',
  public_holiday: 'Public holiday',
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return d
  }
}

export default function AttendanceLedger({
  entries,
  personId,
}: {
  entries: AttendanceEntry[]
  personId: string
}) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{
    entry_type: string
    start_date: string
    end_date: string
    days: string
    notes: string
  } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function openEdit(a: AttendanceEntry) {
    setError(null)
    setEditingId(a.id)
    setDraft({
      entry_type: a.entry_type,
      start_date: a.start_date ? a.start_date.slice(0, 10) : '',
      end_date: a.end_date ? a.end_date.slice(0, 10) : '',
      days: String(a.days ?? ''),
      // Medical rows arrive with notes stripped — keep the field empty + hidden.
      notes: a.medical_consent_logged ? '' : a.notes || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
    setError(null)
  }

  async function saveEdit(a: AttendanceEntry) {
    if (!draft) return
    setError(null)
    const daysNum = Number(draft.days)
    if (!draft.start_date || !draft.end_date) {
      setError('Start and end dates are required.')
      return
    }
    if (Number.isNaN(daysNum) || daysNum < 0) {
      setError('Days must be a number ≥ 0.')
      return
    }
    setBusyId(a.id)
    try {
      const payload: Record<string, unknown> = {
        id: a.id,
        person_id: personId,
        entry_type: draft.entry_type,
        start_date: draft.start_date,
        end_date: draft.end_date,
        days: daysNum,
      }
      // Never write notes back onto a medical-consent row from this UI.
      if (!a.medical_consent_logged) payload.notes = draft.notes
      const res = await fetch('/api/company/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.message || json.error || 'Could not save the correction.')
        setBusyId(null)
        return
      }
      setBusyId(null)
      cancelEdit()
      router.refresh()
    } catch {
      setError('Network error — try again.')
      setBusyId(null)
    }
  }

  async function deleteEntry(a: AttendanceEntry) {
    setError(null)
    if (!confirm('Delete this leave entry? This removes the record.')) return
    setBusyId(a.id)
    try {
      const res = await fetch('/api/company/attendance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, person_id: personId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.message || json.error || 'Could not delete the entry.')
        setBusyId(null)
        return
      }
      setBusyId(null)
      if (editingId === a.id) cancelEdit()
      router.refresh()
    } catch {
      setError('Network error — try again.')
      setBusyId(null)
    }
  }

  if (entries.length === 0) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.10)' }}
      >
        <p className="text-xs leading-relaxed" style={BODY_STYLE}>
          No leave logged yet. Entries appear here as staff log time off — including via WhatsApp
          (&quot;I&apos;m sick today&quot;), which stamps the entry and notifies the manager.
        </p>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <p className="text-[11px] mb-2 font-bold" style={{ color: CORAL }}>
          {error}
        </p>
      )}
      <ul className="space-y-1.5">
        {entries.map((a) => {
          const isMedical = a.medical_consent_logged
          const isEditing = editingId === a.id
          return (
            <li
              key={a.id}
              className="rounded-lg px-3 py-2"
              style={{
                background: isMedical ? 'rgba(251, 113, 133, 0.06)' : 'rgba(255,255,255,0.02)',
                border: isMedical ? '1px solid rgba(251, 113, 133, 0.25)' : HAIRLINE,
              }}
            >
              {!isEditing ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold" style={HEADING_STYLE}>
                      {ENTRY_TYPE_LABEL[a.entry_type] || a.entry_type}
                      <span className="font-normal" style={BODY_STYLE}>
                        {' '}· {a.days} day{a.days === 1 ? '' : 's'}
                      </span>
                    </p>
                    <p className="text-[10px]" style={BODY_STYLE}>
                      {fmtDate(a.start_date)} → {fmtDate(a.end_date)}
                      {a.logged_via === 'whatsapp' ? ' · via WhatsApp' : ''}
                    </p>
                    {isMedical ? (
                      <p className="text-[10px] mt-0.5 font-bold" style={{ color: CORAL }}>
                        🔒 Medical — consent-logged, HRBP-visible only
                      </p>
                    ) : (
                      a.notes && (
                        <p className="text-[10px] mt-0.5 truncate" style={BODY_STYLE}>
                          {a.notes}
                        </p>
                      )
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={
                        a.approved_at
                          ? { background: 'rgba(52,211,153,0.12)', color: SUCCESS }
                          : { background: 'rgba(251,191,36,0.12)', color: '#FBBF24' }
                      }
                    >
                      {a.approved_at ? 'Approved' : 'Pending'}
                    </span>
                    <button
                      onClick={() => openEdit(a)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                      style={{ background: 'rgba(56, 189, 248, 0.14)', color: ACCENT }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ) : (
                draft && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
                          Type
                        </label>
                        <select
                          value={draft.entry_type}
                          onChange={(e) => setDraft({ ...draft, entry_type: e.target.value })}
                          className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                          style={INPUT_STYLE}
                        >
                          {ENTRY_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {ENTRY_TYPE_LABEL[t]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
                          Days
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={draft.days}
                          onChange={(e) => setDraft({ ...draft, days: e.target.value })}
                          className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                          style={INPUT_STYLE}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
                          Start date
                        </label>
                        <input
                          type="date"
                          value={draft.start_date}
                          onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                          className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                          style={INPUT_STYLE}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
                          End date
                        </label>
                        <input
                          type="date"
                          value={draft.end_date}
                          onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                          className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                          style={INPUT_STYLE}
                        />
                      </div>
                    </div>

                    {isMedical ? (
                      <p className="text-[10px]" style={{ color: CORAL }}>
                        🔒 Medical entry — notes are consent-gated and not editable here.
                      </p>
                    ) : (
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
                          Notes
                        </label>
                        <input
                          value={draft.notes}
                          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                          placeholder="Correction note (optional)"
                          className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                          style={INPUT_STYLE}
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => saveEdit(a)}
                        disabled={busyId === a.id}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50"
                        style={{ background: '#eef1f6', color: '#060609' }}
                      >
                        {busyId === a.id ? 'Saving…' : 'Save correction'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
                        style={{ color: 'rgba(255,255,255,0.5)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => deleteEntry(a)}
                        disabled={busyId === a.id}
                        className="ml-auto px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50"
                        style={{ background: 'rgba(251,113,133,0.12)', color: CORAL, border: '1px solid rgba(251,113,133,0.28)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
