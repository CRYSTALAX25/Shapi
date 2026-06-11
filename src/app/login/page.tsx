'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Where to send the user after login. Set by src/proxy.ts when an
  // anonymous visitor hits a protected route. Only accept internal paths
  // ('/...' but not '//...') to prevent open redirects.
  const rawNext = searchParams.get('next')
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
    ? rawNext
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Incorrect email or password')
    } else {
      router.push(next || '/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0E0E13] flex items-center justify-center px-6">
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .gradient-border-card {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.2), rgba(240,140,174,0.2)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
          transition: all 0.25s ease;
        }
        input:focus {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(106,168,245,0.5), rgba(240,140,174,0.5)) border-box !important;
        }
      `}</style>

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Orb */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(240,140,174,0.08) 0%, transparent 70%)',
      }} />

      <div className="relative z-10 max-w-md w-full">
        <div className="text-center mb-10">
          <Link href="/" className="font-black text-2xl tracking-tighter" style={{
            background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'gradientShift 5s ease infinite',
          }}>shapi</Link>
          <h1 className="text-2xl font-black text-[#F4F4F7] mt-6 mb-2">Welcome back</h1>
          <p className="text-[#7E7E8E] text-sm">Sign in to your Shapi account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="gradient-border-card w-full px-5 py-4 rounded-2xl text-[#F4F4F7] placeholder-[#7E7E8E] focus:outline-none text-sm bg-transparent"
          />

          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="gradient-border-card w-full px-5 py-4 pr-12 rounded-2xl text-[#F4F4F7] placeholder-[#7E7E8E] focus:outline-none text-sm bg-transparent"
            />
            <button type="button" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7E7E8E] hover:text-[#C7C7D1] transition-colors">
              {showPw ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 4.24A9.1 9.1 0 0112 4c5 0 9 4.5 9 8a9.7 9.7 0 01-1.67 3.16M6.6 6.6C4.4 7.9 3 10 3 12c0 0 4 8 9 8a9 9 0 003.4-.66" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" strokeWidth={1.8} /></svg>
              )}
            </button>
          </div>

          {error && (
            <p className="text-[#F58E9A] text-xs bg-[#F58E9A]/10 border border-[#F58E9A]/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#6AA8F5] to-[#F08CAE] py-4 rounded-full font-black text-sm text-white hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
          >
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>

          <div className="flex justify-between text-xs pt-1">
            <Link href="/signup" className="text-[#6AA8F5] font-semibold hover:opacity-80 transition-opacity">Create account</Link>
            <Link href="/reset-password" className="text-[#7E7E8E] hover:text-[#C7C7D1] transition-colors">Forgot password?</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
