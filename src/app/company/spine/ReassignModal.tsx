'use client'

// ReassignModal — the justification gate for drag-drop seat reassignment.
//
// When a seat card is dropped on a different team header, OrgCanvas opens this
// modal instead of silently committing. The user MUST type a real justification
// (min 20 chars, matching the organizational_decisions schema floor) before the
// move commits. Confirm = PATCH seat.team_id + POST the decision with the typed
// reason. Cancel / Escape = abort, no DB write.
//
// Native to the dark canvas: card surface #13161b, accent #7c93f5, Plus Jakarta
// Sans inherited from the app shell.

import { useEffect, useRef, useState } from 'react'

const ACCENT = '#7c93f5'
const MIN_CHARS = 20

// Mirrors the decision_type CHECK constraint in blueprint_v4_06_decisions.sql,
// surfaced via /api/company/spine/decision. Drag-drop defaults to "restructure".
const DECISION_TYPES: { value: string; label: string }[] = [
  { value: 'restructure', label: 'Restructure' },
  { value: 'redeploy', label: 'Redeploy' },
  { value: 'promote', label: 'Promote' },
  { value: 'demote', label: 'Demote' },
  { value: 'team_split', label: 'Team split' },
  { value: 'team_merge', label: 'Team merge' },
  { value: 'location_change', label: 'Location change' },
  { value: 'hire', label: 'Hire' },
  { value: 'separate', label: 'Separate' },
  { value: 'reskill_assign', label: 'Reskill assignment' },
  { value: 'augment_assign', label: 'Augment assignment' },
  { value: 'comp_change', label: 'Comp change' },
]

export type ReassignContext = {
  seatId: string
  seatTitle: string
  personId: string | null
  fromTeamId: string
  fromTeamName: string
  toTeamId: string
  toTeamName: string
}

type Props = {
  ctx: ReassignContext
  onCancel: () => void
  // Resolve when both the PATCH and the decision POST succeed. Reject (throw)
  // with a message to keep the modal open and surface the error.
  onConfirm: (args: { decisionType: string; justification: string }) => Promise<void>
}

export default function ReassignModal({ ctx, onCancel, onConfirm }: Props) {
  const [justification, setJustification] = useState('')
  const [decisionType, setDecisionType] = useState('restructure')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const trimmedLen = justification.trim().length
  const valid = trimmedLen >= MIN_CHARS
  const remaining = MIN_CHARS - trimmedLen

  // Focus the textarea on open.
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Escape closes (= Cancel). Don't intercept while submitting.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [submitting, onCancel])

  async function handleConfirm() {
    if (!valid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm({ decisionType, justification: justification.trim() })
      // Parent unmounts the modal on success.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setSubmitting(false) // keep modal open, preserve typed justification
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reassign-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(6,6,9,0.72)', backdropFilter: 'blur(2px)' }}
      onMouseDown={e => {
        // Click on the backdrop (not the card) = Cancel.
        if (e.target === e.currentTarget && !submitting) onCancel()
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5"
        style={{
          background: '#13161b',
          border: `1px solid ${ACCENT}55`,
          boxShadow: '0 24px 60px -12px rgba(0,0,0,0.7)',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-wider mb-2"
          style={{ color: ACCENT }}
        >
          Confirm reassignment
        </p>

        <h2
          id="reassign-modal-title"
          className="text-sm font-black leading-snug mb-1"
          style={{ color: '#f4f6f9' }}
        >
          Move &ldquo;{ctx.seatTitle}&rdquo;
        </h2>
        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <span style={{ color: '#9ca3af' }}>{ctx.fromTeamName}</span>
          <span style={{ color: ACCENT }}> &rarr; </span>
          <span style={{ color: '#f4f6f9', fontWeight: 700 }}>{ctx.toTeamName}</span>
        </p>

        {/* Decision type */}
        <label
          className="block text-[10px] font-bold uppercase tracking-wider mb-1.5"
          style={{ color: 'rgba(255,255,255,0.4)' }}
          htmlFor="reassign-decision-type"
        >
          Decision type
        </label>
        <select
          id="reassign-decision-type"
          value={decisionType}
          onChange={e => setDecisionType(e.target.value)}
          disabled={submitting}
          className="w-full rounded-lg px-3 py-2 text-xs mb-4 outline-none"
          style={{
            background: '#0c0e11',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.9)',
          }}
        >
          {DECISION_TYPES.map(d => (
            <option key={d.value} value={d.value} style={{ background: '#0c0e11' }}>
              {d.label}
            </option>
          ))}
        </select>

        {/* Justification */}
        <div className="flex items-center justify-between mb-1.5">
          <label
            className="block text-[10px] font-bold uppercase tracking-wider"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            htmlFor="reassign-justification"
          >
            Why this move? <span style={{ color: '#FB7185' }}>*</span>
          </label>
          <span
            className="text-[10px] font-bold tabular-nums"
            style={{ color: valid ? '#34D399' : '#FBBF24' }}
          >
            {valid ? `${trimmedLen} chars` : `${remaining} more`}
          </span>
        </div>
        <textarea
          id="reassign-justification"
          ref={textareaRef}
          value={justification}
          onChange={e => setJustification(e.target.value)}
          disabled={submitting}
          rows={3}
          placeholder="Give the real reason — this is logged immutably in your decisions audit trail."
          className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none"
          style={{
            background: '#0c0e11',
            border: `1px solid ${valid ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: 'rgba(255,255,255,0.9)',
          }}
        />
        <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Minimum {MIN_CHARS} characters. This record cannot be edited or deleted later.
        </p>

        {error && (
          <div
            className="mt-3 rounded-lg px-3 py-2 text-[11px]"
            style={{
              background: 'rgba(251,113,133,0.12)',
              border: '1px solid rgba(251,113,133,0.4)',
              color: '#FB7185',
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="text-xs font-bold px-4 py-2 rounded-full transition-colors"
            style={{
              background: '#0c0e11',
              color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.1)',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!valid || submitting}
            className="text-xs font-bold px-4 py-2 rounded-full transition-colors"
            style={{
              background: !valid || submitting ? 'rgba(124,147,245,0.2)' : ACCENT,
              color: !valid || submitting ? 'rgba(255,255,255,0.4)' : '#0b0d12',
              border: `1px solid ${!valid || submitting ? `${ACCENT}55` : ACCENT}`,
              cursor: !valid || submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Saving…' : 'Confirm move'}
          </button>
        </div>
      </div>
    </div>
  )
}
