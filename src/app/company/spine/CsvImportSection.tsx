'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

// CSV upload-and-map intake for the spine. Three states:
//   1. INTAKE — drag/drop or paste a CSV. AI parses on submit.
//   2. PREVIEW — show parsed rows in an editable table. User reviews,
//      can delete rows that look wrong, then confirms.
//   3. COMMITTED — show counts + refresh the page so the new locations/
//      teams/people/seats appear in the manual CRUD sections below.
//
// Free-tier guard: server returns 402 on the parse call if the company
// has already used their one upload. Surface the upgrade prompt clearly.

type ParsedRow = {
  full_name: string
  email?: string
  role_title: string
  team_name: string
  location_name?: string
  manager_email?: string
  seniority?: string
}

type ParseResult = {
  rows: ParsedRow[]
  detected_columns: string[]
  row_count: number
  skipped_count: number
  notes?: string
}

const ACCENT = '#7c93f5'
const SUCCESS = '#34D399'
const DANGER = '#FB7185'
const HEADING_STYLE: React.CSSProperties = { color: '#f4f6f9' }
const BODY_STYLE: React.CSSProperties = { color: '#9ca3af' }
const CTA_STYLE: React.CSSProperties = { background: '#eef1f6', color: '#0c0e11' }
const INPUT_STYLE: React.CSSProperties = {
  background: '#0c0e11',
  border: '1px solid rgba(124,147,245,0.20)',
  color: '#f4f6f9',
}

export default function CsvImportSection({
  planTier,
  // When set, this importer is scoped to a single location. Every parsed row is
  // pre-tagged with this location name before commit, so a multi-site company
  // can upload (e.g.) Riyadh's roster directly onto the Riyadh location without
  // the CSV needing a Location column. The commit API matches/creates by name.
  lockedLocationName = null,
  // Compact variant for embedding inside the Locations section (no big hero).
  compact = false,
  // Optional callback after a successful commit (e.g. to collapse the panel).
  onCommitted,
}: {
  planTier: string
  lockedLocationName?: string | null
  compact?: boolean
  onCommitted?: () => void
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [csvText, setCsvText] = useState('')
  const [stage, setStage] = useState<'intake' | 'preview' | 'committed'>('intake')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [committed, setCommitted] = useState<{
    locations_new: number
    teams_new: number
    persons_new: number
    seats_new: number
    rows_processed: number
  } | null>(null)

  function onFile(file: File) {
    if (file.size > 200_000) {
      setErr('CSV is too large — keep it under 200KB or split it into chunks.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setCsvText(String(reader.result || ''))
      setErr(null)
    }
    reader.readAsText(file)
  }

  async function parse() {
    if (!csvText.trim()) { setErr('Paste or upload a CSV first'); return }
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/company/spine/import-csv', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csv_text: csvText }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.error === 'free_tier_upload_limit_exceeded') {
          setErr('Free tier allows one upload-and-map. Upgrade to Pro for unlimited.')
        } else {
          setErr(data.message || data.error || `Parse failed (${res.status})`)
        }
        return
      }
      setParsed({
        rows: data.rows || [],
        detected_columns: data.detected_columns || [],
        row_count: data.row_count || 0,
        skipped_count: data.skipped_count || 0,
        notes: data.notes,
      })
      setStage('preview')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Parse failed')
    } finally { setBusy(false) }
  }

  async function commit() {
    if (!parsed) return
    setBusy(true); setErr(null)
    try {
      // Per-location mode: force every row onto this location, overriding any
      // Location column the CSV may carry. The commit API keys locations by
      // name (create-if-missing), so pre-tagging routes the whole roster here.
      const rowsToCommit = lockedLocationName
        ? parsed.rows.map(r => ({ ...r, location_name: lockedLocationName }))
        : parsed.rows
      const res = await fetch('/api/company/spine/import-commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows: rowsToCommit }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.error === 'free_tier_location_limit_exceeded') {
          setErr('Your CSV has multiple locations but your plan supports one. Upgrade to Pro for multi-location.')
        } else {
          setErr(data.message || data.error || `Commit failed (${res.status})`)
        }
        return
      }
      setCommitted({
        locations_new: data.locations_new || 0,
        teams_new: data.teams_new || 0,
        persons_new: data.persons_new || 0,
        seats_new: data.seats_new || 0,
        rows_processed: data.rows_processed || 0,
      })
      setStage('committed')
      onCommitted?.()
      // Refresh the page after a moment so the manual CRUD sections show
      // the newly-created data.
      setTimeout(() => router.refresh(), 1500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Commit failed')
    } finally { setBusy(false) }
  }

  function removeRow(idx: number) {
    if (!parsed) return
    setParsed({ ...parsed, rows: parsed.rows.filter((_, i) => i !== idx) })
  }

  function reset() {
    setCsvText('')
    setParsed(null)
    setCommitted(null)
    setStage('intake')
    setErr(null)
  }

  function downloadTemplate() {
    const csv = [
      'Name,Email,Role,Team,Location,Manager Email,Seniority',
      'Ahmed Al-Saud,ahmed@bupa.com,Senior Backend Engineer,Engineering,Riyadh HQ,cto@bupa.com,senior',
      'Layla Hassan,layla@bupa.com,Product Manager,Product,London HQ,vp-product@bupa.com,mid',
      'James Khoury,james@bupa.com,Sales Director,Sales,Dubai Office,coo@bupa.com,director',
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'shapi-spine-template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /* ── COMMITTED SCREEN ─────────────────────────────────────────────── */
  if (stage === 'committed' && committed) {
    return (
      <div className="rounded-2xl p-5" style={{ background: '#13161b', border: `1px solid ${SUCCESS}55` }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: SUCCESS }}>
          ✓ Imported
        </p>
        <h2 className="text-lg font-black mb-3" style={HEADING_STYLE}>
          {committed.rows_processed} {committed.rows_processed === 1 ? 'row' : 'rows'} mapped into your spine
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'New locations', value: committed.locations_new },
            { label: 'New teams', value: committed.teams_new },
            { label: 'New people', value: committed.persons_new },
            { label: 'New seats', value: committed.seats_new },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: '#0c0e11' }}>
              <p className="text-2xl font-black" style={{ color: SUCCESS }}>{s.value}</p>
              <p className="text-[10px] uppercase tracking-wider" style={BODY_STYLE}>{s.label}</p>
            </div>
          ))}
        </div>
        <button
          onClick={reset}
          className="text-xs font-bold px-4 py-2 rounded-full"
          style={CTA_STYLE}
        >
          Import another CSV
        </button>
      </div>
    )
  }

  /* ── PREVIEW SCREEN ───────────────────────────────────────────────── */
  if (stage === 'preview' && parsed) {
    return (
      <div className="rounded-2xl p-5" style={{ background: '#13161b', border: `1px solid ${ACCENT}55` }}>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Preview · {parsed.row_count} rows</p>
            <p className="text-xs mt-0.5" style={BODY_STYLE}>
              Detected columns: <span className="font-mono">{parsed.detected_columns.join(', ') || '—'}</span>
            </p>
            {parsed.notes && <p className="text-xs mt-1" style={BODY_STYLE}>📝 {parsed.notes}</p>}
            {lockedLocationName && (
              <p className="text-xs mt-1" style={{ color: ACCENT }}>
                📍 All rows will be assigned to <strong>{lockedLocationName}</strong> (Location column ignored).
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: '#0c0e11', color: BODY_STYLE.color, border: '1px solid rgba(255,255,255,0.08)' }}>
              Start over
            </button>
            <button onClick={commit} disabled={busy || parsed.rows.length === 0} className="text-xs font-black px-4 py-2 rounded-full disabled:opacity-40" style={CTA_STYLE}>
              {busy ? 'Saving…' : `Confirm + create ${parsed.rows.length} →`}
            </button>
          </div>
        </div>

        {err && (
          <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(251,113,133,0.12)', border: `1px solid ${DANGER}55`, color: DANGER }}>
            {err}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg" style={{ background: '#0c0e11' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'rgba(124,147,245,0.08)' }}>
                <th className="text-left px-3 py-2" style={BODY_STYLE}>Name</th>
                <th className="text-left px-3 py-2" style={BODY_STYLE}>Role</th>
                <th className="text-left px-3 py-2" style={BODY_STYLE}>Team</th>
                <th className="text-left px-3 py-2" style={BODY_STYLE}>Location</th>
                <th className="text-left px-3 py-2" style={BODY_STYLE}>Email</th>
                <th className="text-left px-3 py-2" style={BODY_STYLE}>Level</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-3 py-2 font-bold" style={HEADING_STYLE}>{r.full_name}</td>
                  <td className="px-3 py-2" style={HEADING_STYLE}>{r.role_title}</td>
                  <td className="px-3 py-2" style={BODY_STYLE}>{r.team_name}</td>
                  <td className="px-3 py-2" style={BODY_STYLE}>{r.location_name || '—'}</td>
                  <td className="px-3 py-2" style={BODY_STYLE}>{r.email || '—'}</td>
                  <td className="px-3 py-2" style={BODY_STYLE}>{r.seniority || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => removeRow(i)} className="text-xs" style={{ color: DANGER }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  /* ── INTAKE SCREEN ────────────────────────────────────────────────── */
  return (
    <div
      className={compact ? 'rounded-xl p-4' : 'rounded-2xl p-5'}
      style={compact
        ? { background: '#0c0e11', border: `1px dashed ${ACCENT}40` }
        : { background: '#13161b', border: `1px solid ${ACCENT}55` }}
    >
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          {lockedLocationName ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
                ✨ Upload roster · {lockedLocationName}
              </p>
              <p className="text-xs mt-0.5" style={BODY_STYLE}>
                Names, roles and teams only — every row lands in <span style={{ color: ACCENT }}>{lockedLocationName}</span>.
                No Location column needed. AI maps the rest.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: ACCENT }}>
                ✨ Upload-and-map · the fast way
              </p>
              <h2 className="text-lg font-black" style={HEADING_STYLE}>Upload your org chart CSV</h2>
              <p className="text-xs mt-0.5" style={BODY_STYLE}>
                Drop a CSV with names, roles, teams, locations. AI maps the columns. Preview, confirm, done.
              </p>
            </>
          )}
        </div>
        <button onClick={downloadTemplate} className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap" style={{ background: 'rgba(124,147,245,0.10)', color: ACCENT, border: `1px solid ${ACCENT}40` }}>
          ↓ Template
        </button>
      </div>

      {planTier === 'free' && (
        <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#FBBF24' }}>
          <strong>Free tier:</strong> one upload-and-map allowed. Upgrade to Pro for unlimited bulk imports.
        </div>
      )}

      {err && (
        <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(251,113,133,0.12)', border: `1px solid ${DANGER}55`, color: DANGER }}>
          {err}
        </div>
      )}

      <div className="space-y-3">
        {/* File picker */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-bold px-4 py-2 rounded-full"
            style={{ background: 'rgba(124,147,245,0.14)', color: ACCENT, border: `1px solid ${ACCENT}55` }}
          >
            📄 Pick CSV file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = '' }}
          />
          <span className="text-xs" style={BODY_STYLE}>or paste rows below</span>
        </div>

        {/* Paste textarea */}
        <textarea
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          rows={6}
          placeholder="Name,Email,Role,Team,Location,Manager Email,Seniority&#10;Ahmed Al-Saud,ahmed@bupa.com,Senior Backend Engineer,Engineering,Riyadh HQ,cto@bupa.com,senior"
          className="w-full px-3 py-2.5 rounded-lg text-xs font-mono"
          style={INPUT_STYLE}
        />

        <button
          onClick={parse}
          disabled={busy || !csvText.trim()}
          className="text-xs font-black px-5 py-2.5 rounded-full disabled:opacity-40"
          style={CTA_STYLE}
        >
          {busy ? 'Parsing with AI…' : 'Parse with AI →'}
        </button>
      </div>
    </div>
  )
}
