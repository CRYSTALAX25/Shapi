'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [type, setType] = useState<'candidate' | 'company' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!type) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { type },
        emailRedirectTo: `${location.origin}/upload-cv`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-[#F8F4EE] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#0B5563] rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl">✓</div>
          <h1 className="text-2xl font-bold text-[#1C1C2E] mb-3">Check your email</h1>
          <p className="text-[#1C1C2E]/60 leading-relaxed">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account and start building your profile.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F4EE] flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <Link href="/" className="text-[#0B5563] font-bold text-2xl tracking-tight">shapi</Link>
          <h1 className="text-2xl font-bold text-[#1C1C2E] mt-6 mb-2">Create your account</h1>
          <p className="text-[#1C1C2E]/60 text-sm">Start building your verified profile</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3 bg-[#1C1C2E]/5 p-1.5 rounded-full">
            <button
              type="button"
              onClick={() => setType('candidate')}
              className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors ${
                type === 'candidate' ? 'bg-[#0B5563] text-white' : 'text-[#1C1C2E]/60 hover:text-[#1C1C2E]'
              }`}
            >
              I&apos;m a candidate
            </button>
            <button
              type="button"
              onClick={() => setType('company')}
              className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors ${
                type === 'company' ? 'bg-[#E8745A] text-white' : 'text-[#1C1C2E]/60 hover:text-[#1C1C2E]'
              }`}
            >
              I&apos;m hiring
            </button>
          </div>

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-white border border-[#1C1C2E]/10 rounded-2xl px-5 py-4 text-[#1C1C2E] placeholder-[#1C1C2E]/40 focus:outline-none focus:border-[#0B5563] transition-colors text-sm"
          />

          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-white border border-[#1C1C2E]/10 rounded-2xl px-5 py-4 text-[#1C1C2E] placeholder-[#1C1C2E]/40 focus:outline-none focus:border-[#0B5563] transition-colors text-sm"
          />

          {error && <p className="text-red-500 text-xs">{error}</p>}

          {!type && (
            <p className="text-[#1C1C2E]/40 text-xs text-center">Select candidate or hiring above first</p>
          )}

          <button
            type="submit"
            disabled={!type || loading}
            className="w-full bg-[#0B5563] text-white py-4 rounded-full font-semibold text-sm hover:bg-[#094450] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create account →'}
          </button>

          <p className="text-center text-xs text-[#1C1C2E]/40">
            Already have an account?{' '}
            <Link href="/login" className="text-[#0B5563] font-medium hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
