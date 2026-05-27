'use client'

// Action buttons on each Hiring Roadmap starter JD: "Post as draft role"
// and "Scan candidates". Both create a draft role from the JD; they differ
// only in where they land you next.

import { useState } from 'react'

type StarterJD = {
  headline?: string
  responsibilities?: string[]
  must_haves?: string[]
  nice_to_haves?: string[]
  salary_band?: string
}

export default function JdActions({ role, jd }: { role: string; jd: StarterJD }) {
  const [busy, setBusy] = useState<'post' | 'scan' | null>(null)
  const [err, setErr] = useState('')

  const create = async (after: 'post' | 'scan') => {
    if (busy) return
    setBusy(after); setErr('')
    try {
      const res = await fetch('/api/company/roles/from-jd', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, starter_jd: jd }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.id) {
        setErr(d.error || 'Could not create role')
        setBusy(null)
        return
      }
      // Both routes go through the role detail page — the company can review,
      // tweak, and publish there. "Scan" hints to scroll to the candidate match
      // section via a hash anchor.
      window.location.href = after === 'scan'
        ? `/company/roles/${d.id}#candidates`
        : `/company/roles/${d.id}`
    } catch {
      setErr('Network error')
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <button type="button" onClick={() => create('post')} disabled={!!busy}
        className="text-[11px] font-black px-3 py-1.5 rounded-full text-white disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
        {busy === 'post' ? 'Creating…' : '✚ Post this role'}
      </button>
      <button type="button" onClick={() => create('scan')} disabled={!!busy}
        className="text-[11px] font-bold px-3 py-1.5 rounded-full text-[#6AA8F5] border border-[#6AA8F5]/30 hover:border-[#6AA8F5]/60 disabled:opacity-50">
        {busy === 'scan' ? 'Creating…' : '🔍 Scan candidates'}
      </button>
      {err && <span className="text-[10px] text-[#F58E9A]">{err}</span>}
    </div>
  )
}
