'use client'

// Landing page for the Supabase password-reset link. The /reset-password
// page emails a link with redirectTo=`${origin}/update-password`. Supabase
// verifies the recovery token, sets a temporary recovery session, and lands
// the user here. This page collects the new password and calls
// auth.updateUser({ password }), then routes them to /dashboard.
//
// ROOT CAUSE of "reset link goes to homepage" bug: this page didn't exist.
// The Supabase redirect target was a 404 and Next.js was bouncing to /.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function UpdatePassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [recoverable, setRecoverable] = useState<null | boolean>(null)

  // Confirm we're in a recovery session. Supabase parses the URL hash
  // fragment on its own (PKCE/recovery flow) and emits PASSWORD_RECOVERY +
  // creates a session. If there's no session by the time we mount, the
  // link is invalid/expired and we tell the user.
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    // Subscribe FIRST so we don't miss the immediate PASSWORD_RECOVERY emit.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setRecoverable(true)
      }
    })

    // Also check current state once — handles the case where the SDK already
    // processed the fragment before our subscribe call landed.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data.session) setRecoverable(true)
      else setTimeout(() => { if (!cancelled && recoverable === null) setRecoverable(false) }, 1200)
    })

    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [recoverable])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords don\'t match.'); return }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
    // Give the user a beat to see the confirmation before redirecting.
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center px-6">
      <style>{`
        .gradient-border-card {
          background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                      linear-gradient(135deg, rgba(157, 140, 255, 0.2), rgba(157, 140, 255, 0.2)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <div className="relative z-10 max-w-md w-full">
        <div className="text-center mb-10">
          <Link href="/" className="font-black text-2xl tracking-tighter" style={{ background: 'linear-gradient(135deg, #9D8CFF, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
          <h1 className="text-2xl font-black text-[#F4F4F7] mt-6 mb-2">
            {done ? 'Password updated' : 'Set a new password'}
          </h1>
          <p className="text-[#7E7E8E] text-sm">
            {done ? 'Signing you in…' : 'Pick something you\'ll remember. 8+ characters.'}
          </p>
        </div>

        {recoverable === false && !done && (
          <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(251, 113, 133, 0.10)', border: '1px solid rgba(251, 113, 133, 0.30)' }}>
            <p className="text-[#FB7185] font-bold mb-2">This reset link is invalid or expired.</p>
            <p className="text-[#A6A6B4] text-xs leading-relaxed mb-4">
              Reset links are single-use and expire after ~1 hour. Request a fresh one.
            </p>
            <Link href="/reset-password" className="inline-block px-5 py-2.5 rounded-full font-black text-xs text-white" style={{ background: 'linear-gradient(135deg,#9D8CFF, #34D399)' }}>
              Send a new link →
            </Link>
          </div>
        )}

        {recoverable !== false && !done && (
          <form onSubmit={submit} className="space-y-3">
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="New password (8+ chars)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="gradient-border-card w-full px-5 py-4 pr-12 rounded-2xl text-[#F4F4F7] placeholder-[#7E7E8E] focus:outline-none text-sm bg-transparent"
              />
              <button type="button" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7E7E8E] hover:text-[#C7C7D1] transition-colors">
                {showPw ? '🙈' : '👁'}
              </button>
            </div>

            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="gradient-border-card w-full px-5 py-4 rounded-2xl text-[#F4F4F7] placeholder-[#7E7E8E] focus:outline-none text-sm bg-transparent"
            />

            {error && (
              <p className="text-[#FB7185] text-xs bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || recoverable !== true}
              className="w-full bg-gradient-to-r from-[#9D8CFF] to-[#9D8CFF] py-4 rounded-full font-black text-sm text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Updating…' : recoverable === null ? 'Verifying link…' : 'Set new password →'}
            </button>
          </form>
        )}

        {done && (
          <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.30)' }}>
            <p className="text-[#34D399] font-bold mb-1">✓ Password updated</p>
            <p className="text-[#A6A6B4] text-xs">Taking you to your dashboard…</p>
          </div>
        )}
      </div>
    </div>
  )
}
