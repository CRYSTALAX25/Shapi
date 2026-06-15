'use client'

import { useState } from 'react'

// Company Brain console — two surfaces:
//   1. INGEST  — paste/upload text, pick sensitivity + optional seat anchor.
//   2. SEARCH  — semantic (or keyword fallback) query over the brain.
// Both call the RLS-protected /api/brain/* routes. The UI never sees the
// service-role client; all access is gated server-side.

type Seat = { id: string; title: string }
type Team = { id: string; name: string }

type SearchResult = {
  id: string
  content: string
  sensitivity: string
  anchor_seat_id: string | null
  anchor_team_id: string | null
  created_at: string
  score: number | null
}

const ACCENT = '#38BDF8'
const SUCCESS = '#34D399'
const DANGER = '#FB7185'
const AMBER = '#FBBF24'
const HEADING_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }
const BODY_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.5)' }
const CTA_STYLE: React.CSSProperties = { background: '#eef1f6', color: '#060609' }
const INPUT_STYLE: React.CSSProperties = {
  background: '#060609',
  border: '1px solid rgba(56, 189, 248, 0.20)',
  color: 'rgba(255,255,255,0.9)',
}
const CARD_STYLE: React.CSSProperties = {
  background: '#0D0C14',
  border: '1px solid rgba(56, 189, 248, 0.14)',
  borderRadius: '1rem',
}

function sensitivityBadge(s: string): React.CSSProperties {
  if (s === 'manager') return { background: 'rgba(251,191,36,0.15)', color: AMBER }
  if (s === 'private') return { background: 'rgba(251,113,133,0.15)', color: DANGER }
  return { background: 'rgba(52,211,153,0.13)', color: SUCCESS }
}

export default function BrainConsole({
  seats,
  teams,
  hasEntries,
  enabled,
}: {
  seats: Seat[]
  teams: Team[]
  hasEntries: boolean
  enabled: boolean
}) {
  const seatTitle = (id: string | null) => seats.find((s) => s.id === id)?.title || null
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name || null

  // ---- Ingest state ----
  const [content, setContent] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sensitivity, setSensitivity] = useState<'team' | 'manager' | 'private'>('team')
  const [anchorSeatId, setAnchorSeatId] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [ingestMsg, setIngestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // ---- Search state ----
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [searchMode, setSearchMode] = useState<string>('')
  const [searchErr, setSearchErr] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setContent(text.slice(0, 50000))
    if (!sourceName) setSourceName(file.name)
  }

  async function ingest() {
    if (!content.trim() || ingesting) return
    setIngesting(true)
    setIngestMsg(null)
    try {
      const res = await fetch('/api/brain/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          source_name: sourceName.trim() || undefined,
          sensitivity,
          anchor_seat_id: anchorSeatId || undefined,
          source_type: 'manual_note',
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setIngestMsg({ ok: false, text: json.error || 'Ingestion failed' })
      } else {
        setIngestMsg({
          ok: true,
          text: json.embedded
            ? 'Saved and embedded. It is now semantically searchable.'
            : 'Saved. No embedding yet (OpenAI key not configured) — searchable by keyword for now, embeds automatically once the key is added.',
        })
        setContent('')
        setSourceName('')
        setAnchorSeatId('')
      }
    } catch {
      setIngestMsg({ ok: false, text: 'Network error' })
    } finally {
      setIngesting(false)
    }
  }

  async function search() {
    if (!query.trim() || searching) return
    setSearching(true)
    setSearchErr(null)
    setResults(null)
    try {
      const res = await fetch('/api/brain/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSearchErr(json.error || 'Search failed')
      } else {
        setResults(json.results || [])
        setSearchMode(json.mode || '')
      }
    } catch {
      setSearchErr('Network error')
    } finally {
      setSearching(false)
    }
  }

  const disabled = !enabled

  return (
    <div className="space-y-5">
      {/* INGEST */}
      <section className="p-5" style={CARD_STYLE}>
        <h2 className="text-base font-bold mb-1" style={HEADING_STYLE}>Add to the brain</h2>
        <p className="text-xs mb-4" style={BODY_STYLE}>
          Paste text or drop a .txt / .md file. Choose who can see it and, optionally, which seat it
          belongs to.
        </p>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={disabled}
          placeholder="Paste a handover note, process doc, meeting summary…"
          rows={6}
          className="w-full rounded-lg px-3 py-2 text-sm mb-3 disabled:opacity-50"
          style={INPUT_STYLE}
        />

        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <input
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            disabled={disabled}
            placeholder="Source name (e.g. Q3 Strategy Meeting)"
            className="flex-1 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
            style={INPUT_STYLE}
          />
          <label
            className="text-xs font-bold px-3 py-2 rounded-lg cursor-pointer text-center"
            style={{ border: `1px solid ${ACCENT}40`, color: ACCENT, opacity: disabled ? 0.5 : 1 }}
          >
            Upload file
            <input type="file" accept=".txt,.md,.csv" onChange={handleFile} disabled={disabled} className="hidden" />
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: ACCENT }}>
              Sensitivity
            </label>
            <select
              value={sensitivity}
              onChange={(e) => setSensitivity(e.target.value as 'team' | 'manager' | 'private')}
              disabled={disabled}
              className="w-full rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              style={INPUT_STYLE}
            >
              <option value="team">Team — visible to the company</option>
              <option value="manager">Manager — owner / chain only</option>
              <option value="private">Private — never surfaced in search</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: ACCENT }}>
              Anchor to seat (optional)
            </label>
            <select
              value={anchorSeatId}
              onChange={(e) => setAnchorSeatId(e.target.value)}
              disabled={disabled}
              className="w-full rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              style={INPUT_STYLE}
            >
              <option value="">— no seat —</option>
              {seats.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={ingest}
          disabled={disabled || ingesting || !content.trim()}
          className="text-sm font-bold px-5 py-2.5 rounded-lg disabled:opacity-50"
          style={CTA_STYLE}
        >
          {ingesting ? 'Saving…' : 'Add to brain'}
        </button>

        {ingestMsg && (
          <p className="text-xs mt-3" style={{ color: ingestMsg.ok ? SUCCESS : DANGER }}>
            {ingestMsg.text}
          </p>
        )}
      </section>

      {/* SEARCH */}
      <section className="p-5" style={CARD_STYLE}>
        <h2 className="text-base font-bold mb-1" style={HEADING_STYLE}>Ask the brain</h2>
        <p className="text-xs mb-4" style={BODY_STYLE}>
          Semantic search across everything you can see. Falls back to keyword match until embeddings
          are configured. Private and sensitive HR content is never returned.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search() }}
            disabled={disabled}
            placeholder="e.g. how do we handle vendor onboarding?"
            className="flex-1 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
            style={INPUT_STYLE}
          />
          <button
            onClick={search}
            disabled={disabled || searching || !query.trim()}
            className="text-sm font-bold px-5 py-2.5 rounded-lg disabled:opacity-50"
            style={CTA_STYLE}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {searchMode && (
          <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {searchMode === 'semantic' ? 'Semantic (vector) match' : 'Keyword fallback (embeddings off)'}
          </p>
        )}

        {searchErr && <p className="text-xs mt-2" style={{ color: DANGER }}>{searchErr}</p>}

        {results && results.length === 0 && (
          <p className="text-xs mt-2" style={BODY_STYLE}>No matching entries.</p>
        )}

        {results && results.length > 0 && (
          <div className="space-y-3 mt-2">
            {results.map((r) => (
              <div key={r.id} className="p-3 rounded-lg" style={{ background: '#060609', border: '1px solid rgba(56, 189, 248, 0.10)' }}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={sensitivityBadge(r.sensitivity)}>
                    {r.sensitivity}
                  </span>
                  {seatTitle(r.anchor_seat_id) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(56, 189, 248, 0.12)', color: ACCENT }}>
                      seat · {seatTitle(r.anchor_seat_id)}
                    </span>
                  )}
                  {teamName(r.anchor_team_id) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8' }}>
                      team · {teamName(r.anchor_team_id)}
                    </span>
                  )}
                  {typeof r.score === 'number' && (
                    <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {(r.score * 100).toFixed(0)}% match
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {r.content.length > 600 ? r.content.slice(0, 600) + '…' : r.content}
                </p>
              </div>
            ))}
          </div>
        )}

        {!results && !hasEntries && (
          <div className="mt-4 p-4 rounded-xl text-center" style={{ background: '#060609', border: `1px dashed ${ACCENT}40` }}>
            <p className="text-sm font-bold mb-1" style={HEADING_STYLE}>The brain is empty</p>
            <p className="text-xs" style={BODY_STYLE}>
              Add your first handover note or process doc above. Once it&apos;s in, you can ask
              questions over it here.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
