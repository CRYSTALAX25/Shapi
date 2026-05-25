'use client'

import { useState } from 'react'

export default function ShortlistButton({
  candidateId,
  roleId,
  initialShortlisted,
}: {
  candidateId: string
  roleId: string
  initialShortlisted: boolean
}) {
  const [shortlisted, setShortlisted] = useState(initialShortlisted)
  const [loading, setLoading] = useState(false)
  const [matched, setMatched] = useState(false)

  async function toggle() {
    if (loading || !roleId) return
    setLoading(true)
    try {
      if (shortlisted) {
        await fetch('/api/company/shortlist', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate_id: candidateId, role_id: roleId }),
        })
        setShortlisted(false)
        setMatched(false)
      } else {
        const res = await fetch('/api/company/shortlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate_id: candidateId, role_id: roleId }),
        })
        const data = await res.json()
        setShortlisted(true)
        if (data.mutual) setMatched(true)
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }

  if (matched) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black"
          style={{ background: 'rgba(106,168,245,0.15)', color: '#6AA8F5', border: '1px solid rgba(106,168,245,0.3)' }}>
          🤝 Mutual match!
        </span>
        <span className="text-[10px] text-white/25">Introduction sent</span>
      </div>
    )
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 disabled:opacity-50"
      style={
        shortlisted
          ? { background: 'rgba(106,168,245,0.12)', border: '1px solid rgba(106,168,245,0.3)', color: '#6AA8F5' }
          : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }
      }
    >
      {loading ? (
        <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : shortlisted ? (
        <>✓ Shortlisted</>
      ) : (
        <>+ Shortlist</>
      )}
    </button>
  )
}
