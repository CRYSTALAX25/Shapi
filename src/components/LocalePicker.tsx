'use client'

import { useEffect, useRef, useState } from 'react'
import { LOCALES, type Locale } from '@/lib/i18n/locales'
import { useLocale } from '@/lib/i18n/LocaleContext'

export default function LocalePicker() {
  const { locale, setLocale } = useLocale()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Click-outside-to-close: listen on document and close when the click target
  // is not inside the wrapper. Also close on Escape.
  useEffect(() => {
    if (!open) return
    function handlePointer(e: MouseEvent) {
      const target = e.target as Node | null
      if (wrapperRef.current && target && !wrapperRef.current.contains(target)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const current = LOCALES.find(l => l.code === locale) ?? LOCALES[0]

  function handleSelect(next: Locale) {
    setLocale(next)
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose language"
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
        style={{
          background: '#0D0C14',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#C7C7D1',
        }}
      >
        {/* Globe SVG (no emoji) */}
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a13.5 13.5 0 0 1 0 18" />
          <path d="M12 3a13.5 13.5 0 0 0 0 18" />
        </svg>
        <span className="uppercase tracking-wider">{current.code}</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Languages"
          className="absolute right-0 top-full mt-2 z-50 rounded-xl py-1 min-w-[180px]"
          style={{
            background: '#0D0C14',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
          }}
        >
          {LOCALES.map(l => {
            const active = l.code === locale
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => handleSelect(l.code)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors"
                style={{
                  background: active ? 'rgba(56, 189, 248, 0.10)' : 'transparent',
                  color: active ? '#F4F4F7' : '#C7C7D1',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  }
                }}
              >
                <span className="font-bold">{l.native}</span>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: '#7E7E8E' }}>
                  {l.code}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
