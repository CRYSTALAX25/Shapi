'use client'

import { useState } from 'react'

// Kicks off the positioning deep-dive — the WhatsApp interview that surfaces the
// proof for the Verified Positioning CV. On success the opening question lands on
// the candidate's WhatsApp; the conversation continues there.
export default function StartDeepDiveButton({ label = 'Start my deep-dive →', restart = false }: { label?: string; restart?: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  const go = async () => {
    setState('loading')
    setError('')
    try {
      const res = await fetch('/api/cv/positioning-deepdive', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.success) {
        setState('sent')
      } else if (d.whatsapp_failed) {
        setState('error')
        setError('We couldn’t reach your WhatsApp. Check the number on your profile and try again.')
      } else {
        setState('error')
        setError(d.error || 'Something went wrong. Try again in a moment.')
      }
    } catch {
      setState('error')
      setError('Network issue — check your connection and try again.')
    }
  }

  if (state === 'sent') {
    return (
      <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.28)', color: '#34D399' }}>
        ✅ Sent — check WhatsApp. Answer the questions there (voice notes welcome, any language) and your Verified
        Positioning CV builds itself. You can close this page.
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={state === 'loading'}
        className="rounded-full px-6 py-3.5 text-sm font-black text-white transition-opacity disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}
      >
        {state === 'loading' ? 'Sending to WhatsApp…' : restart ? 'Redo my deep-dive →' : label}
      </button>
      {error && <p className="mt-2 text-xs" style={{ color: '#FB7185' }}>{error}</p>}
    </div>
  )
}
