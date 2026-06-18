'use client'

import { useState } from 'react'

// Build a positioning CV from the CV alone (no deep-dive) — an instant draft the
// deep-dive later enriches. Reloads on success to render the result.
export function GenerateFromCvButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  const go = async () => {
    setState('loading')
    setError('')
    try {
      const res = await fetch('/api/cv/positioning-generate', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.success) {
        window.location.reload()
        return
      }
      setState('error')
      setError(d.error || 'Something went wrong. Try again in a moment.')
    } catch {
      setState('error')
      setError('Network issue — try again.')
    }
  }

  return (
    <div className="text-center">
      <button
        onClick={go}
        disabled={state === 'loading'}
        className="text-sm font-bold text-[#38BDF8] hover:underline disabled:opacity-50"
      >
        {state === 'loading' ? 'Building a draft from your CV…' : 'or build a quick draft from my CV →'}
      </button>
      {error && <p className="mt-2 text-xs" style={{ color: '#FB7185' }}>{error}</p>}
    </div>
  )
}

// Print / save-as-PDF — the page's print CSS strips the chrome so only the CV
// card prints.
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-full px-5 py-2.5 text-xs font-bold transition-colors"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#C7C7D1' }}
    >
      ↓ Save as PDF
    </button>
  )
}
