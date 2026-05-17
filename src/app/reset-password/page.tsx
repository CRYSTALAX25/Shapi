'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ResetPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/update-password`,
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center px-6">
        <div className="fixed inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.08) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }} />
        <div className="relative z-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#22D3EE] to-[#A78BFA] flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-[#060609]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white mb-3">Check your email</h1>
          <p className="text-white/40 text-sm leading-relaxed">
            We sent a reset link to <span className="text-white font-semibold">{email}</span>. Click it to set a new password.
          </p>
          <Link href="/login" className="inline-block mt-6 text-[#22D3EE] text-sm font-semibold hover:opacity-80">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center px-6">
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .gradient-border-card {
          background: linear-gradient(#060609, #060609) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.2), rgba(139,92,246,0.2)) border-box;
          border: 1px solid transparent;
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.08) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <div className="relative z-10 max-w-md w-full">
        <div className="text-center mb-10">
          <Link href="/" className="font-black text-2xl tracking-tighter" style={{
            background: 'linear-gradient(135deg, #A78BFA, #22D3EE, #FB7185)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'gradientShift 5s ease infinite',
          }}>shapi</Link>
          <h1 className="text-2xl font-black text-white mt-6 mb-2">Reset your password</h1>
          <p className="text-white/35 text-sm">We&apos;ll email you a link to set a new one</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="gradient-border-card w-full px-5 py-4 rounded-2xl text-white placeholder-white/25 focus:outline-none text-sm bg-transparent"
          />

          {error && (
            <p className="text-[#FB7185] text-xs bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] py-4 rounded-full font-black text-sm text-[#060609] hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
          >
            {loading ? 'Sending...' : 'Send reset link →'}
          </button>

          <p className="text-center text-xs text-white/30 pt-1">
            <Link href="/login" className="text-[#22D3EE] font-semibold hover:opacity-80">Back to sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
