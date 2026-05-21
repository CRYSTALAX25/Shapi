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
    <div className="min-h-screen bg-[#F1F2F7] flex items-center justify-center px-6">
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .gradient-border-card {
          background: linear-gradient(#ffffff, #ffffff) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.2), rgba(139,92,246,0.2)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05);
          transition: all 0.25s ease;
        }
        input:focus {
          background: linear-gradient(#ffffff, #ffffff) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.5), rgba(139,92,246,0.5)) border-box !important;
        }
      `}</style>

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(14,14,26,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Orb */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
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
          <h1 className="text-2xl font-black text-[#0E0E1A] mt-6 mb-2">Welcome back</h1>
          <p className="text-[#8A8A99] text-sm">Sign in to your Shapi account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="gradient-border-card w-full px-5 py-4 rounded-2xl text-[#0E0E1A] placeholder-[#9A9AA8] focus:outline-none text-sm bg-transparent"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="gradient-border-card w-full px-5 py-4 rounded-2xl text-[#0E0E1A] placeholder-[#9A9AA8] focus:outline-none text-sm bg-transparent"
          />

          {error && (
            <p className="text-[#E11D48] text-xs bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] py-4 rounded-full font-black text-sm text-[#060609] hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
          >
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>

          <div className="flex justify-between text-xs pt-1">
            <Link href="/signup" className="text-[#0891B2] font-semibold hover:opacity-80 transition-opacity">Create account</Link>
            <Link href="/reset-password" className="text-[#8A8A99] hover:text-[#3F3F4E] transition-colors">Forgot password?</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
