'use client'

// StepCard — one wizard step in the Tier B engagement workspace.
// Numbered card with header, status pill, collapsible body, and Save action.

import { useState, ReactNode } from 'react'

export type StepStatus = 'not-started' | 'in-progress' | 'done'

const STATUS_COLOR: Record<StepStatus, { bg: string; fg: string; label: string }> = {
  'not-started': { bg: 'rgba(255,255,255,0.06)', fg: '#A6A6B4', label: 'Not started' },
  'in-progress': { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24', label: 'In progress' },
  'done': { bg: 'rgba(52,211,153,0.15)', fg: '#34D399', label: 'Done' },
}

export default function StepCard({
  step,
  title,
  subtitle,
  status,
  children,
  onSave,
  saveLabel = 'Run this step',
  saving = false,
  defaultOpen = false,
}: {
  step: number
  title: string
  subtitle?: string
  status: StepStatus
  children: ReactNode
  onSave?: () => void | Promise<void>
  saveLabel?: string
  saving?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const s = STATUS_COLOR[status]

  return (
    <div
      className="rounded-2xl"
      style={{ background: '#0D0C14', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        <span
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-black"
          style={{
            background: status === 'done' ? 'rgba(52,211,153,0.18)' : 'rgba(56, 189, 248, 0.15)',
            color: status === 'done' ? '#34D399' : '#38BDF8',
          }}
        >
          {step}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[#F4F4F7] font-bold text-sm md:text-base">{title}</p>
          {subtitle && <p className="text-[#A6A6B4] text-xs leading-relaxed mt-0.5">{subtitle}</p>}
        </div>
        <span
          className="text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap uppercase tracking-wider"
          style={{ background: s.bg, color: s.fg }}
        >
          {s.label}
        </span>
        <span className="text-[#7E7E8E] text-xs ml-2">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-white/[0.06]">
          <div className="pt-4 space-y-3">{children}</div>
          {onSave && (
            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-end">
              <button
                onClick={() => onSave()}
                disabled={saving}
                className="px-5 py-2.5 rounded-full font-black text-xs text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}
              >
                {saving ? 'Working…' : saveLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
