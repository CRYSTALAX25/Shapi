'use client'

// OkrEditor — view + edit a seat's objectives & key results.
//
// "Templates + import" model: adopt a role-based template, paste your existing
// OKRs, or build from scratch — then edit freely. Key-result progress drives
// the objective and overall completion live; on save we PATCH the seat and the
// Calibration Lens (okr_completion_pct) updates with it.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  templatesForFunction,
  objectiveProgress,
  overallCompletion,
  parseOkrText,
  clampPct,
  type OkrObjective,
} from '@/lib/okrTemplates'

const ACCENT = '#38BDF8'
const GREEN = '#34D399'
const HEADING_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }
const BODY_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }
const HAIRLINE = '1px solid rgba(255,255,255,0.06)'
const INPUT_STYLE: React.CSSProperties = {
  background: '#060609',
  border: '1px solid rgba(56, 189, 248,0.20)',
  color: 'rgba(255,255,255,0.9)',
}

function Bar({ pct, color = ACCENT }: { pct: number; color?: string }) {
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${clampPct(pct)}%`, background: color }} />
    </div>
  )
}

export default function OkrEditor({
  seatId,
  seatFunction,
  initialOkrs,
}: {
  seatId: string | null
  seatFunction: string | null
  initialOkrs: OkrObjective[]
}) {
  const router = useRouter()
  const [okrs, setOkrs] = useState<OkrObjective[]>(initialOkrs)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')

  const templates = useMemo(() => templatesForFunction(seatFunction), [seatFunction])
  const completion = overallCompletion(okrs)

  if (!seatId) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.10)' }}>
        <p className="text-xs leading-relaxed" style={BODY_STYLE}>
          No seat on the spine yet — assign this person to a seat to set objectives.
        </p>
      </div>
    )
  }

  function update(next: OkrObjective[]) { setOkrs(next) }

  function applyTemplate(id: string) {
    const t = templates.find(x => x.id === id)
    if (!t) return
    // Deep clone so edits don't mutate the shared template.
    update(t.objectives.map(o => ({ objective: o.objective, key_results: o.key_results.map(k => ({ ...k })) })))
  }

  function applyImport() {
    const parsed = parseOkrText(importText)
    if (parsed.length === 0) { setErr('Couldn\u2019t find any objectives in that text.'); return }
    update(parsed)
    setShowImport(false)
    setImportText('')
    setErr(null)
  }

  function setObjective(i: number, text: string) {
    update(okrs.map((o, idx) => (idx === i ? { ...o, objective: text } : o)))
  }
  function addObjective() {
    update([...okrs, { objective: '', key_results: [{ text: '', progress_pct: 0, target: null, current: null, unit: null }] }])
  }
  function removeObjective(i: number) {
    update(okrs.filter((_, idx) => idx !== i))
  }
  function setKr(oi: number, ki: number, patch: Partial<OkrObjective['key_results'][number]>) {
    update(okrs.map((o, idx) => idx !== oi ? o : { ...o, key_results: o.key_results.map((k, kidx) => kidx === ki ? { ...k, ...patch } : k) }))
  }
  function addKr(oi: number) {
    update(okrs.map((o, idx) => idx !== oi ? o : { ...o, key_results: [...o.key_results, { text: '', progress_pct: 0, target: null, current: null, unit: null }] }))
  }
  function removeKr(oi: number, ki: number) {
    update(okrs.map((o, idx) => idx !== oi ? o : { ...o, key_results: o.key_results.filter((_, kidx) => kidx !== ki) }))
  }

  async function save() {
    setBusy(true); setErr(null)
    try {
      const clean = okrs
        .map(o => ({ objective: o.objective.trim(), key_results: o.key_results.filter(k => k.text.trim()).map(k => ({ ...k, text: k.text.trim() })) }))
        .filter(o => o.objective && o.key_results.length > 0)
      const res = await fetch('/api/company/okr', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seat_id: seatId, okrs: clean }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErr(d.error || 'Save failed.')
        return
      }
      setOkrs(clean)
      setEditing(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  // ── READ VIEW ────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold" style={HEADING_STYLE}>Overall</span>
            <span className="text-xs font-black" style={{ color: completion >= 70 ? GREEN : ACCENT }}>{completion}%</span>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(56, 189, 248,0.14)', color: ACCENT }}
          >
            {okrs.length === 0 ? 'Set objectives' : 'Edit objectives'}
          </button>
        </div>

        {okrs.length === 0 ? (
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.10)' }}>
            <p className="text-xs leading-relaxed" style={BODY_STYLE}>
              No objectives set yet. Tap <strong style={{ color: ACCENT }}>Set objectives</strong> to adopt a
              role-based template, paste your existing OKRs, or build from scratch. Progress here feeds the seat&apos;s
              OKR-completion signal on the org chart.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {okrs.map((o, i) => {
              const op = objectiveProgress(o)
              return (
                <li key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: HAIRLINE }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-bold" style={HEADING_STYLE}>{o.objective}</p>
                    <span className="text-[11px] font-black flex-shrink-0" style={{ color: op >= 70 ? GREEN : ACCENT }}>{op}%</span>
                  </div>
                  <Bar pct={op} color={op >= 70 ? GREEN : ACCENT} />
                  <ul className="mt-2.5 space-y-2">
                    {o.key_results.map((k, ki) => (
                      <li key={ki}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px]" style={BODY_STYLE}>{k.text}</span>
                          <span className="text-[10px] font-bold flex-shrink-0" style={{ color: 'rgba(255,255,255,0.6)' }}>{clampPct(k.progress_pct)}%</span>
                        </div>
                        <Bar pct={k.progress_pct} />
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  // ── EDIT VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {err && (
        <div className="p-2.5 rounded-lg text-xs" style={{ background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.30)', color: '#FB7185' }}>
          {err}
        </div>
      )}

      {/* Template + import row */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          onChange={e => { if (e.target.value) applyTemplate(e.target.value); e.currentTarget.value = '' }}
          defaultValue=""
          className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
          style={INPUT_STYLE}
        >
          <option value="">✦ Use a template…</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button
          onClick={() => setShowImport(v => !v)}
          className="text-xs font-bold px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(56, 189, 248,0.14)', color: ACCENT }}
        >
          {showImport ? 'Close import' : '↥ Import / paste'}
        </button>
        <span className="text-[11px]" style={BODY_STYLE}>or edit below</span>
      </div>

      {showImport && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: HAIRLINE }}>
          <p className="text-[10px] mb-2" style={BODY_STYLE}>
            Paste your OKRs — each unindented line is an objective; bullets / indented lines under it become key results.
          </p>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            rows={6}
            placeholder={'Grow revenue in MENA\n- Close $2M new ARR\n- Land 5 enterprise logos\nImprove retention\n- Cut churn to under 5%'}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono"
            style={INPUT_STYLE}
          />
          <button onClick={applyImport} className="mt-2 text-xs font-black px-3 py-1.5 rounded-lg" style={{ background: '#eef1f6', color: '#060609' }}>
            Parse + load
          </button>
        </div>
      )}

      {/* Editable objectives */}
      <ul className="space-y-3">
        {okrs.map((o, i) => (
          <li key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: HAIRLINE }}>
            <div className="flex items-center gap-2 mb-2">
              <input
                value={o.objective}
                onChange={e => setObjective(i, e.target.value)}
                placeholder="Objective"
                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                style={INPUT_STYLE}
              />
              <button onClick={() => removeObjective(i)} className="text-xs font-bold flex-shrink-0" style={{ color: '#FB7185' }}>Remove</button>
            </div>
            <ul className="space-y-2 pl-1">
              {o.key_results.map((k, ki) => (
                <li key={ki} className="flex items-center gap-2">
                  <input
                    value={k.text}
                    onChange={e => setKr(i, ki, { text: e.target.value })}
                    placeholder="Key result"
                    className="flex-1 px-2.5 py-1.5 rounded-lg text-xs"
                    style={INPUT_STYLE}
                  />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={clampPct(k.progress_pct)}
                      onChange={e => setKr(i, ki, { progress_pct: Number(e.target.value) })}
                      className="w-20"
                      style={{ accentColor: ACCENT }}
                    />
                    <span className="text-[10px] font-bold w-8 text-right" style={{ color: 'rgba(255,255,255,0.6)' }}>{clampPct(k.progress_pct)}%</span>
                  </div>
                  <button onClick={() => removeKr(i, ki)} className="text-xs font-bold flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} title="Remove key result">✕</button>
                </li>
              ))}
            </ul>
            <button onClick={() => addKr(i)} className="mt-2 text-[11px] font-bold" style={{ color: ACCENT }}>+ Add key result</button>
          </li>
        ))}
      </ul>

      <button onClick={addObjective} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: 'rgba(56, 189, 248,0.10)', color: ACCENT, border: `1px solid ${ACCENT}33` }}>
        + Add objective
      </button>

      <div className="flex items-center gap-2 pt-1">
        <button onClick={save} disabled={busy} className="text-xs font-black px-4 py-2 rounded-full disabled:opacity-40" style={{ background: '#eef1f6', color: '#060609' }}>
          {busy ? 'Saving…' : 'Save objectives'}
        </button>
        <button onClick={() => { setOkrs(initialOkrs); setEditing(false); setErr(null) }} className="text-xs font-bold px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
          Cancel
        </button>
        <span className="text-[11px] ml-1" style={BODY_STYLE}>Overall: <strong style={{ color: completion >= 70 ? GREEN : ACCENT }}>{completion}%</strong></span>
      </div>
    </div>
  )
}
