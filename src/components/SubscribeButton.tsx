'use client'

import { useState } from 'react'

// Starts a candidate subscription checkout for a given product key
// (e.g. 'roles_board_monthly') and redirects to Stripe. Used by the dashboard
// "Your plan" upsell rows.
export default function SubscribeButton({
  product,
  trial,
  className,
  style,
  children,
}: {
  product: string
  // Number of trial days to request. Server caps to 14 and rejects on
  // products that don't support trials.
  trial?: number
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const [loading, setLoading] = useState(false)

  const go = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, ...(trial ? { trial } : {}) }),
      })
      const raw = await res.text()
      let d: { url?: string } = {}
      try { d = JSON.parse(raw) } catch {}
      if (d.url) { window.location.href = d.url; return }
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  return (
    <button type="button" onClick={go} disabled={loading} className={className} style={style}>
      {loading ? 'Loading…' : children}
    </button>
  )
}
