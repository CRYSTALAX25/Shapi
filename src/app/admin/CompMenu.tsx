'use client'

// Inline comp / set-flag menu for the admin tables. One small dropdown
// per row so Ana can comp a candidate to Pro, hand them a subscription,
// or toggle the legacy paid flag — all without going through Stripe.

import { useState } from 'react'

type Action =
  | 'comp_pro' | 'comp_kit' | 'uncomp_cv'
  | 'comp_active' | 'comp_concierge' | 'comp_roles_board' | 'uncomp_subscription'
  | 'comp_active_hiring'
  | 'toggle_paid'
  | 'set_live'

const ACTION_LABELS: Record<Action, string> = {
  comp_pro: '+ Pro CV',
  comp_kit: '+ Kit CV',
  uncomp_cv: '− Reset CV tier',
  comp_active: '+ Shapi Active ($29)',
  comp_concierge: '+ Concierge ($89)',
  comp_roles_board: '+ Roles Board ($19)',
  uncomp_subscription: '− Clear subs',
  comp_active_hiring: '+ Active Hiring ($499)',
  toggle_paid: 'Toggle legacy paid',
  set_live: 'Set profile_live',
}

export default function CompMenu({ userId, kind }: { userId: string; kind: 'candidate' | 'company' }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<Action | null>(null)
  const [msg, setMsg] = useState('')

  const run = async (action: Action) => {
    if (busy) return
    setBusy(action); setMsg('')
    try {
      const res = await fetch('/api/admin/comp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg('✓')
        setTimeout(() => window.location.reload(), 400)
      } else {
        setMsg(d.error || 'Failed')
      }
    } catch {
      setMsg('Network err')
    } finally {
      setBusy(null)
    }
  }

  const actions: Action[] = kind === 'candidate'
    ? ['comp_pro', 'comp_kit', 'uncomp_cv', 'comp_active', 'comp_concierge', 'comp_roles_board', 'uncomp_subscription', 'toggle_paid', 'set_live']
    : ['comp_active_hiring', 'toggle_paid']

  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="text-xs font-bold text-[#38BDF8] hover:text-[#38BDF8] px-2 py-1 rounded border border-[#38BDF8]/30 hover:border-[#38BDF8]/50">
        Comp ▾
      </button>
      {msg && <span className="ml-2 text-[10px] text-[#38BDF8]">{msg}</span>}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-50 min-w-[200px] rounded-lg shadow-2xl py-1"
            style={{ background: '#0D0C14', border: '1px solid rgba(255,255,255,0.12)' }}>
            {actions.map(a => (
              <button key={a} type="button" onClick={() => { setOpen(false); run(a) }} disabled={busy === a}
                className="w-full text-left px-3 py-1.5 text-xs text-[#C7C7D1] hover:bg-white/[0.05] disabled:opacity-50">
                {busy === a ? '…' : ACTION_LABELS[a]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
