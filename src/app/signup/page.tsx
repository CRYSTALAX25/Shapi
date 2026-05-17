'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignUpForm() {
  const searchParams = useSearchParams()
  const companyInvite = searchParams.get('company_invite') // company owner's user ID
  const inviteEmail = searchParams.get('email') // pre-filled email from invite

  const [email, setEmail] = useState(inviteEmail || '')
  const [password, setPassword] = useState('')
  // If arriving via company invite, type is locked to 'company'
  const [type, setType] = useState<'candidate' | 'company' | null>(companyInvite ? 'company' : null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!type) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { type, company_invite: companyInvite || undefined },
        emailRedirectTo: companyInvite
          ? `${location.origin}/company/dashboard?joined=1`
          : `${location.origin}/upload-cv`,
      },
    })

    // If invite: link this user to the company immediately
    if (!error && signUpData?.user && companyInvite) {
      await fetch('/api/company/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyInvite, user_id: signUpData.user.id, email }),
      }).catch(() => {})
    }

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
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
          <p className="text-white/40 leading-relaxed text-sm">
            We sent a confirmation link to <span className="text-white font-semibold">{email}</span>. Click it to activate your account and start building your profile.
          </p>
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
          transition: all 0.25s ease;
        }
      `}</style>

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.08) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)',
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
          {companyInvite ? (
            <>
              <h1 className="text-2xl font-black text-white mt-6 mb-2">You&apos;ve been invited</h1>
              <p className="text-white/35 text-sm">Create your account to join your team on Shapi</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black text-white mt-6 mb-2">Create your account</h1>
              <p className="text-white/35 text-sm">Start building your verified profile</p>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Type toggle — hidden if arriving via company invite */}
          {!companyInvite && (
            <div className="flex gap-2 bg-white/[0.04] border border-white/[0.08] p-1.5 rounded-full">
              <button
                type="button"
                onClick={() => setType('candidate')}
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${
                  type === 'candidate'
                    ? 'bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] text-[#060609]'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                I&apos;m a candidate
              </button>
              <button
                type="button"
                onClick={() => setType('company')}
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${
                  type === 'company'
                    ? 'bg-gradient-to-r from-[#FB7185] to-[#A78BFA] text-[#060609]'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                I&apos;m hiring
              </button>
            </div>
          )}

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="gradient-border-card w-full px-5 py-4 rounded-2xl text-white placeholder-white/25 focus:outline-none text-sm bg-transparent"
          />

          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className="gradient-border-card w-full px-5 py-4 rounded-2xl text-white placeholder-white/25 focus:outline-none text-sm bg-transparent"
          />

          {error && (
            <p className="text-[#FB7185] text-xs bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {!type && (
            <p className="text-white/25 text-xs text-center">Select candidate or hiring above first</p>
          )}

          <button
            type="submit"
            disabled={!type || loading}
            className="w-full bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] py-4 rounded-full font-black text-sm text-[#060609] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Creating account...' : 'Create account →'}
          </button>

          <p className="text-center text-xs text-white/30 pt-1">
            Already have an account?{' '}
            <Link href="/login" className="text-[#22D3EE] font-semibold hover:opacity-80 transition-opacity">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default function SignUp() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060609] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-[#22D3EE] animate-spin" />
      </div>
    }>
      <SignUpForm />
    </Suspense>
  )
}
