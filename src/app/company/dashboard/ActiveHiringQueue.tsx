'use client'

import { useEffect, useState, useCallback } from 'react'

type Item = {
  id: string
  matchScore: number
  matchReasons: string[]
  draftSubject: string | null
  draftBody: string | null
  roleTitle: string
  candidateName: string
  candidateHeadline: string
  candidateTier: string
}

const TIER_LABEL: Record<string, string> = { premium: 'Premium verified', strong: 'Strongly verified', basic: 'Verified' }

export default function ActiveHiringQueue() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/company/active-hiring')
      const d = await r.json().catch(() => ({}))
      setItems(Array.isArray(d.items) ? d.items : [])
    } catch { /* leave as-is */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (id: string, action: 'approve' | 'dismiss') => {
    setBusy(id)
    try {
      await fetch('/api/company/active-hiring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })
      setItems(prev => prev.filter(i => i.id !== id))
      if (action === 'approve') setNote('Sent — the candidate will get your message and can reply directly.')
    } catch { setNote('Something went wrong — try again.') } finally { setBusy(null) }
  }

  const scan = async () => {
    setScanning(true); setNote('')
    try {
      const r = await fetch('/api/company/active-hiring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scan' }) })
      const d = await r.json().catch(() => ({}))
      if (d.ok) { setNote(d.queued > 0 ? `Found ${d.queued} new matches across ${d.roles} role${d.roles === 1 ? '' : 's'}.` : 'No new matches right now — check back as the pool grows.'); await load() }
      else setNote(d.error || 'Scan failed.')
    } catch { setNote('Scan failed — try again.') } finally { setScanning(false) }
  }

  return (
    <div className="gradient-border-card rounded-2xl p-5 mb-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-[#34D399] text-xs font-bold uppercase tracking-wider">⚡ Active Hiring · daily shortlist</p>
        <button onClick={scan} disabled={scanning} className="text-[11px] font-bold text-[#38BDF8] hover:underline disabled:opacity-50">
          {scanning ? 'Finding…' : 'Find matches now →'}
        </button>
      </div>
      <p className="text-[#7E7E8E] text-xs mb-4">Verified candidates matched to your open roles, with outreach drafted. Approve to send — one tap.</p>

      {note && <p className="text-[#A6A6B4] text-xs mb-3">{note}</p>}

      {loading ? (
        <p className="text-[#7E7E8E] text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[#7E7E8E] text-sm">No matches waiting. Tap <span className="text-[#38BDF8] font-bold">Find matches now</span> or post a role.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map(i => (
            <div key={i.id} className="rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[#F4F4F7] text-sm font-bold truncate">{i.candidateName} <span className="text-[#7E7E8E] font-normal">· {i.roleTitle}</span></p>
                  <p className="text-[#7E7E8E] text-xs truncate">{i.candidateHeadline}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(56,189,248,0.12)', color: '#38BDF8' }}>{i.matchScore}% match</span>
                    {TIER_LABEL[i.candidateTier] && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399' }}>✓ {TIER_LABEL[i.candidateTier]}</span>}
                    {(i.matchReasons || []).slice(0, 2).map((r, k) => <span key={k} className="text-[10px] text-[#7E7E8E]">· {r}</span>)}
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(open === i.id ? null : i.id)} className="text-[11px] text-[#38BDF8] mt-2 hover:underline">
                {open === i.id ? 'Hide draft' : 'Preview drafted message'}
              </button>
              {open === i.id && (
                <div className="mt-2 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap" style={{ background: 'rgba(0,0,0,0.25)', color: '#C7C7D1' }}>
                  {i.draftSubject && <p className="font-bold text-[#F4F4F7] mb-1">{i.draftSubject}</p>}
                  {i.draftBody || '(no draft — approve to send a standard intro)'}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button onClick={() => act(i.id, 'approve')} disabled={busy === i.id} className="flex-1 py-2 rounded-lg text-xs font-black text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#38BDF8,#34D399)' }}>
                  {busy === i.id ? '…' : 'Approve & send →'}
                </button>
                <button onClick={() => act(i.id, 'dismiss')} disabled={busy === i.id} className="px-3 py-2 rounded-lg text-xs font-bold text-[#7E7E8E]" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
