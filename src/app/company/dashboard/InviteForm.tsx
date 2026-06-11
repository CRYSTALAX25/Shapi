'use client'

// Team-invite form for the company dashboard. Was previously a raw HTML
// <form action="/api/company/invite" method="post"> which posted as
// application/x-www-form-urlencoded, but the API tries to parse the body as
// JSON — request.json() threw, uncaught, and Vercel served the generic 500
// page. Converting to a client-side fetch fixes the bug and gives us proper
// inline feedback (sending / invited / error) instead of dumping the JSON
// response into the browser as a new page.

import { useState } from 'react'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function InviteForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/company/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data?.error || `Invite failed (${res.status})`)
        setStatus('error')
        return
      }
      setStatus('sent')
      setEmail('')
      // Soft-refresh the page so the new "Invited" row shows up in the list.
      setTimeout(() => window.location.reload(), 700)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error')
      setStatus('error')
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="colleague@company.com"
          value={email}
          onChange={e => { setEmail(e.target.value); if (status === 'error') setStatus('idle') }}
          disabled={status === 'sending'}
          className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white/90 placeholder-white/25 outline-none focus:border-[#9D8CFF]/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === 'sending' || !email.trim()}
          className="flex-shrink-0 text-white text-xs font-black px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #9D8CFF, #34D399)' }}
        >
          {status === 'sending' ? 'Inviting…' : 'Invite'}
        </button>
      </form>

      {status === 'sent' && (
        <p className="mt-2 text-[#34D399] text-xs font-bold">✓ Invite sent — refreshing list…</p>
      )}
      {status === 'error' && (
        <p className="mt-2 text-[#FB7185] text-xs">{errorMsg || 'Something went wrong — try again.'}</p>
      )}
    </div>
  )
}
