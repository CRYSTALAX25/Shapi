'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Incorrect email or password')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F8F4EE] flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <Link href="/" className="text-[#0B5563] font-bold text-2xl tracking-tight">shapi</Link>
          <h1 className="text-2xl font-bold text-[#1C1C2E] mt-6 mb-2">Welcome back</h1>
          <p className="text-[#1C1C2E]/60 text-sm">Sign in to your Shapi account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-white border border-[#1C1C2E]/10 rounded-2xl px-5 py-4 text-[#1C1C2E] placeholder-[#1C1C2E]/40 focus:outline-none focus:border-[#0B5563] transition-colors text-sm"
          />

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0B5563] text-white py-4 rounded-full font-semibold text-sm hover:bg-[#094450] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>

          <div className="flex justify-between text-xs text-[#1C1C2E]/40">
            <Link href="/signup" className="text-[#0B5563] font-medium hover:underline">Create account</Link>
            <Link href="/reset-password" className="hover:text-[#1C1C2E]/70 transition-colors">Forgot password?</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
