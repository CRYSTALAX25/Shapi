'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import SignupWhatsApp from './SignupWhatsApp'

function SignUpForm() {
  const searchParams = useSearchParams()
  const companyInvite = searchParams.get('company_invite') // company owner's user ID
  const unlock = searchParams.get('unlock') // crosssell unlock token (Trojan-candidate loop)
  const inviteEmail = searchParams.get('email') // pre-filled email from invite
  // Pre-select role via ?type= so homepage CTAs ("I'm a candidate" / "I'm
  // hiring") don't dump the user on a blank toggle. Honor candidate/company,
  // ignore anything else.
  const typeHint = searchParams.get('type')
  const initialType: 'candidate' | 'company' | null =
    companyInvite ? 'company'
    : unlock ? 'company'
    : typeHint === 'candidate' ? 'candidate'
    : typeHint === 'company' ? 'company'
    : null

  const [email, setEmail] = useState(inviteEmail || '')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  // If arriving via company invite OR ?type=, lock the type accordingly.
  const [type, setType] = useState<'candidate' | 'company' | null>(initialType)
  // Channel toggle — WhatsApp is the recommended MENA path (bypasses the
  // email-confirm wall, the #1 activation killer). Email signup remains the
  // fallback for users without WhatsApp on the device.
  //
  // 2026-06-02: defaulting to EMAIL until Twilio is upgraded post-Shapi-
  // incorporation. The WhatsApp tab is still here + working (with friendly
  // error if Phone Auth isn't configured), but new testers shouldn't dead-
  // end on the OTP flow. Flip this back to 'whatsapp' once Phone Auth is
  // live in Supabase + Twilio is off trial.
  const [mode, setMode] = useState<'whatsapp' | 'email'>('email')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [referralSource, setReferralSource] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  // Resend-email state — disabled for 30s after each send to discourage
  // mash-spamming + avoid Supabase rate-limit errors. Counts down to 0 then
  // re-enables the button.
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendNote, setResendNote] = useState<string | null>(null)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const resendConfirmation = async () => {
    if (resending || resendCooldown > 0 || !email) return
    setResending(true)
    setResendNote(null)
    const supabase = createClient()
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: companyInvite
          ? `${location.origin}/company/dashboard?joined=1`
          : unlock
          ? `${location.origin}/company/dashboard?unlocked=1`
          : type === 'company'
          ? `${location.origin}/company/onboarding`
          : `${location.origin}/upload-cv`,
      },
    })
    setResending(false)
    if (resendError) {
      setResendNote(`Couldn't resend — ${resendError.message}`)
    } else {
      setResendNote('Sent again — check your inbox + spam folder.')
      setResendCooldown(30)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!type) return
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          type,
          company_invite: companyInvite || undefined,
          marketing_opt_in: marketingOptIn,
          referral_source: referralSource || undefined,
        },
        emailRedirectTo: companyInvite
          ? `${location.origin}/company/dashboard?joined=1`
          : unlock
          ? `${location.origin}/company/dashboard?unlocked=1`
          : type === 'company'
          ? `${location.origin}/company/onboarding`
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

    // If unlock token (Trojan-candidate cross-sell): claim it so the new company
    // account is linked to the outreach + the candidate is revealed to them.
    if (!error && signUpData?.user && unlock && type === 'company') {
      fetch('/api/outreach/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: unlock, company_user_id: signUpData.user.id }),
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
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }} />
        <div className="relative z-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#38BDF8] to-[#38BDF8] flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-[#F4F4F7] mb-3">Check your email</h1>
          <p className="text-[#A6A6B4] leading-relaxed text-sm mb-6">
            We sent a confirmation link to <span className="text-[#F4F4F7] font-semibold">{email}</span>. Click it to activate your account and start building your profile.
          </p>

          {/* Resend + WhatsApp fallback — biggest signup drop-off was users who
              never got the email, never knew they could resend, and had no
              other way to reach us. Resend has a 30s cooldown to avoid abuse. */}
          <button
            onClick={resendConfirmation}
            disabled={resending || resendCooldown > 0}
            className="text-[#38BDF8] text-xs font-bold border border-[#38BDF8]/30 hover:border-[#38BDF8]/60 px-4 py-2 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {resending ? 'Resending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend confirmation email →'}
          </button>
          {resendNote && (
            <p className="text-[#C7C7D1] text-xs mt-3">{resendNote}</p>
          )}

          <p className="text-[#7E7E8E] text-[11px] leading-relaxed mt-8">
            Can&apos;t find it? Check spam, or try a different email.<br />
            <Link href="/login" className="text-[#38BDF8] hover:underline">Already confirmed? Sign in</Link>
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
          background: linear-gradient(#0D0C14, #0D0C14) padding-box,
                      linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(56, 189, 248, 0.2)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
          transition: all 0.25s ease;
        }
      `}</style>

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(56, 189, 248, 0.07) 0%, transparent 70%)',
      }} />

      <div className="relative z-10 max-w-md w-full">
        <div className="text-center mb-10">
          <Link href="/" className="font-black text-2xl tracking-tighter" style={{
            background: 'linear-gradient(135deg, #38BDF8, #34D399)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'gradientShift 5s ease infinite',
          }}>shapi</Link>
          {companyInvite ? (
            <>
              <h1 className="text-2xl font-black text-[#F4F4F7] mt-6 mb-2">You&apos;ve been invited</h1>
              <p className="text-[#7E7E8E] text-sm">Create your account to join your team on Shapi</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black text-[#F4F4F7] mt-6 mb-2">Create your account</h1>
              <p className="text-[#7E7E8E] text-sm">Start building your verified profile</p>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Type toggle — hidden if arriving via company invite */}
          {!companyInvite && (
            <div className="flex gap-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] p-1.5 rounded-full">
              <button
                type="button"
                onClick={() => setType('candidate')}
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${
                  type === 'candidate'
                    ? 'bg-gradient-to-r from-[#38BDF8] to-[#38BDF8] text-white'
                    : 'text-[#A6A6B4] hover:text-[#C7C7D1]'
                }`}
              >
                I&apos;m a candidate
              </button>
              <button
                type="button"
                onClick={() => setType('company')}
                className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${
                  type === 'company'
                    ? 'bg-gradient-to-r from-[#FB7185] to-[#38BDF8] text-white'
                    : 'text-[#A6A6B4] hover:text-[#C7C7D1]'
                }`}
              >
                I&apos;m hiring
              </button>
            </div>
          )}

          {/* Channel toggle — WhatsApp default (one-tap MENA UX) with Email
              as the fallback. */}
          <div className="flex gap-1 text-[11px] font-bold uppercase tracking-wider mt-1 mb-1">
            <button
              type="button"
              onClick={() => setMode('whatsapp')}
              className={`flex-1 py-2 rounded-lg transition-colors ${mode === 'whatsapp' ? 'text-[#34D399]' : 'text-[#7E7E8E] hover:text-[#A6A6B4]'}`}
              style={mode === 'whatsapp' ? { background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.30)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              💬 WhatsApp · fastest
            </button>
            <button
              type="button"
              onClick={() => setMode('email')}
              className={`flex-1 py-2 rounded-lg transition-colors ${mode === 'email' ? 'text-[#38BDF8]' : 'text-[#7E7E8E] hover:text-[#A6A6B4]'}`}
              style={mode === 'email' ? { background: 'rgba(56, 189, 248, 0.10)', border: '1px solid rgba(56, 189, 248, 0.30)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              ✉ Email
            </button>
          </div>

          {mode === 'whatsapp' ? (
            <SignupWhatsApp
              initialType={type}
              agreedToTerms={agreedToTerms}
              marketingOptIn={marketingOptIn}
              referralSource={referralSource}
              companyInvite={companyInvite}
              inviteEmail={inviteEmail}
              setError={setError}
            />
          ) : (
          <>
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
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
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

          {/* How did you hear about us */}
          <select
            value={referralSource}
            onChange={e => setReferralSource(e.target.value)}
            className="gradient-border-card w-full px-5 py-4 rounded-2xl text-sm bg-transparent focus:outline-none"
            style={{ color: referralSource ? '#F4F4F7' : '#7E7E8E' }}
          >
            <option value="" style={{ color: '#000' }}>How did you hear about us?</option>
            <option value="friend_referral" style={{ color: '#000' }}>Friend or colleague</option>
            <option value="instagram" style={{ color: '#000' }}>Instagram</option>
            <option value="linkedin" style={{ color: '#000' }}>LinkedIn</option>
            <option value="tiktok" style={{ color: '#000' }}>TikTok</option>
            <option value="search" style={{ color: '#000' }}>Google / search</option>
            <option value="event" style={{ color: '#000' }}>Event or talk</option>
            <option value="press" style={{ color: '#000' }}>News / press</option>
            <option value="other" style={{ color: '#000' }}>Other</option>
          </select>
          </>
          )}

          {/* Consent ticks */}
          <label className="flex items-start gap-3 cursor-pointer px-1 pt-1">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={e => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[#38BDF8]"
            />
            <span className="text-[#A6A6B4] text-xs leading-relaxed">
              I agree to the{' '}
              <Link href="/terms" target="_blank" className="text-[#38BDF8] hover:underline">Terms of Service</Link>{' '}
              and{' '}
              <Link href="/privacy" target="_blank" className="text-[#38BDF8] hover:underline">Privacy Policy</Link>.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer px-1">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={e => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[#38BDF8]"
            />
            <span className="text-[#A6A6B4] text-xs leading-relaxed">
              Send me product updates and job-market insights. <span className="text-[#7E7E8E]">(Optional — unsubscribe anytime.)</span>
            </span>
          </label>

          {error && (
            <p className="text-[#FB7185] text-xs bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {!type && (
            <p className="text-[#7E7E8E] text-xs text-center">Select candidate or hiring above first</p>
          )}

          {mode === 'email' && (
            <button
              type="submit"
              disabled={!type || !agreedToTerms || loading}
              className="w-full bg-gradient-to-r from-[#38BDF8] to-[#38BDF8] py-4 rounded-full font-black text-sm text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Creating account...' : 'Create account →'}
            </button>
          )}

          <p className="text-center text-xs text-[#7E7E8E] pt-1">
            Already have an account?{' '}
            <Link href="/login" className="text-[#38BDF8] font-semibold hover:opacity-80 transition-opacity">Sign in</Link>
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
        <div className="w-8 h-8 rounded-full border-2 border-[rgba(255,255,255,0.08)] border-t-[#38BDF8] animate-spin" />
      </div>
    }>
      <SignUpForm />
    </Suspense>
  )
}
