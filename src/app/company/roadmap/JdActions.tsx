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

type Action = 'post' | 'scan' | 'phone'

export default function JdActions({ role, jd }: { role: string; jd: StarterJD }) {
  const [busy, setBusy] = useState<Action | null>(null)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const create = async (after: Action) => {
    if (busy) return
    setBusy(after); setErr(''); setOk('')
    try {
      // Step 1: create the draft role from the JD.
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

      if (after === 'phone') {
        // Step 2: ask backend to WhatsApp the JD + the magic link.
        const shareRes = await fetch('/api/company/roles/share', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role_id: d.id, send_whatsapp: true }),
        })
        const sd = await shareRes.json().catch(() => ({}))
        if (!shareRes.ok) {
          setErr(sd.error || 'Could not generate share link')
          setBusy(null)
          return
        }
        setOk(sd.whatsapp_sent
          ? '✓ Sent to WhatsApp — open from your phone, no login.'
          : `✓ Link ready: ${sd.link} (we couldn't send WhatsApp — add a number on your profile).`)
        setBusy(null)
        return
      }

      // post + scan → land on the role detail page; "scan" anchors to matches.
      window.location.href = after === 'scan'
        ? `/company/roles/${d.id}#candidates`
        : `/company/roles/${d.id}`
    } catch {
      setErr('Network error')
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2 mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => create('post')} disabled={!!busy}
          className="text-[11px] font-black px-3 py-1.5 rounded-full text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)' }}>
          {busy === 'post' ? 'Creating…' : '✚ Post this role'}
        </button>
        <button type="button" onClick={() => create('scan')} disabled={!!busy}
          className="text-[11px] font-bold px-3 py-1.5 rounded-full text-[#6AA8F5] border border-[#6AA8F5]/30 hover:border-[#6AA8F5]/60 disabled:opacity-50">
          {busy === 'scan' ? 'Creating…' : '🔍 Scan candidates'}
        </button>
        <button type="button" onClick={() => create('phone')} disabled={!!busy}
          className="text-[11px] font-bold px-3 py-1.5 rounded-full text-[#F08CAE] border border-[#F08CAE]/30 hover:border-[#F08CAE]/60 disabled:opacity-50">
          {busy === 'phone' ? 'Sending…' : '📱 Send to my phone'}
        </button>
      </div>
      {err && <p className="text-[10px] text-[#F58E9A]">{err}</p>}
      {ok && <p className="text-[10px] text-[#34D399]">{ok}</p>}
    </div>
  )
}
