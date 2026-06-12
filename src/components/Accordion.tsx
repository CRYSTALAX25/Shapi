import type React from 'react'

// ────────────────────────────────────────────────────────────────────────────
// Accordion — Violet Mint collapsible section built on native <details>/<summary>.
//
// No client JS required: works in both server and client components (no hooks,
// no 'use client'). The disclosure marker is hidden and replaced with a chevron
// that rotates via the `group-open:` Tailwind variant. Used to tame the long
// walls of cards on the HR portal + lifecycle pages.
// ────────────────────────────────────────────────────────────────────────────

const CARD = '#0D0C14'
const HAIRLINE = '1px solid rgba(255,255,255,0.06)'
const HEADING_STYLE: React.CSSProperties = { color: 'rgba(255,255,255,0.9)' }

export default function Accordion({
  icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon?: string
  title: string
  badge?: { label: string; color: string; bg: string }
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl overflow-hidden"
      style={{ background: CARD, border: HAIRLINE }}
    >
      <summary
        className="flex items-center gap-2 p-5 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden"
      >
        {icon && (
          <span className="text-lg" aria-hidden>
            {icon}
          </span>
        )}
        <h2 className="text-sm font-black" style={HEADING_STYLE}>
          {title}
        </h2>
        {badge && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
        )}
        <span
          className="ml-auto text-xs transition-transform duration-200 group-open:rotate-180"
          style={{ color: 'rgba(255,255,255,0.4)' }}
          aria-hidden
        >
          ▾
        </span>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  )
}
