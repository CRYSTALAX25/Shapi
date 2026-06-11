'use client'

import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'

// Segmented tabs for the profile — server-rendered panels passed in as props,
// shown one at a time so the page is clicks, not a long scroll.
export default function ProfileTabs({ labels, panels }: { labels: string[]; panels: ReactNode[] }) {
  const [active, setActive] = useState(0)

  // Allow deep-linking to a tab via ?tab=verification (used by back-links).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (!t) return
    const i = labels.findIndex(l => l.toLowerCase() === t.toLowerCase())
    if (i >= 0) setActive(i)
  }, [labels])
  return (
    <div>
      <style>{`.ptab{color:#A6A6B4;transition:color .2s ease}.ptab:hover{color:#9D8CFF}`}</style>
      <div className="flex flex-wrap gap-1 p-1 rounded-2xl mb-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {labels.map((l, i) => (
          <button
            key={l}
            onClick={() => setActive(i)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${active === i ? '' : 'ptab'}`}
            style={active === i
              ? { background: 'transparent', color: '#9D8CFF' }
              : { background: 'transparent' }}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="space-y-4">{panels[active]}</div>
    </div>
  )
}
