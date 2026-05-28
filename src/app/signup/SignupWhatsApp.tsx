'use client'

// WhatsApp OTP signup flow — bypasses the email-confirm wall (the #1 MENA
// activation killer). User enters phone → Supabase sends a 6-digit OTP via
// Twilio (channel: 'whatsapp' once the Supabase Auth → Phone provider is
// enabled with a WA-capable Twilio Messaging Service). User enters code →
// Supabase signs them in immediately. We then write type + whatsapp_number
// to the profile so the rest of the platform behaves as if they'd gone
// through email signup.
//
// Pre-launch sandbox state: Supabase will send via whichever channel Ana
// has configured (sandbox channel = WhatsApp if she set the WA messaging
// service SID, else SMS). Either way the email wall is gone.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  initialType: 'candidate' | 'company' | null
  agreedToTerms: boolean
  marketingOptIn: boolean
  referralSource: string
  companyInvite: string | null
  inviteEmail: string | null
  setError: (s: string | null) => void
}

export default function SignupWhatsApp({
  initialType,
  agreedToTerms,
  marketingOptIn,
  referralSource,
  companyInvite,
  inviteEmail,
  setError,
}: Props) {
  const [phone, setPhone] = useState('+971 ')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'phone' | 'code'>('phone')
  const [loading, setLoading] = useState(false)
  // Resend cooldown — Supabase OTPs have rate limits per phone.
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  // Normalise phone — strip everything that isn't +digits and require E.164.
  const normalisedPhone = phone.replace(/[^+0-9]/g, '')
  const phoneValid = /^\+[1-9][0-9]{6,14}$/.test(normalisedPhone)

  const sendCode = async () => {
    if (loading) return
    setError(null)
    if (!initialType) { setError('Select candidate or hiring above first.'); return }
    if (!agreedToTerms) { setError('Please agree to the Terms of Service and Privacy Policy to continue.'); return }
    if (!phoneValid) { setError('Enter your phone in international format — e.g. +971 50 123 4567.'); return }

    setLoading(true)
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: normalisedPhone,
      options: {
        // Asks Supabase to route via the WhatsApp channel of the configured
        // Twilio Messaging Service. Requires Phone Auth + a WA-enabled
        // Messaging Service SID in Supabase Auth settings. If WA isn't
        // configured, Supabase falls back to SMS — still bypasses the email
        // wall, just over a different channel.
        channel: 'whatsapp',
        data: {
          type: initialType,
          company_invite: companyInvite || undefined,
          marketing_opt_in: marketingOptIn,
          referral_source: referralSource || undefined,
          email_from_invite: inviteEmail || undefined,
        },
      },
    })
    setLoading(false)
    if (otpError) {
      setError(otpError.message)
      return
    }
    setStage('code')
    setResendCooldown(30)
  }

  const resend = async () => {
    if (resendCooldown > 0 || loading) return
    await sendCode()
  }

  const verifyCode = async () => {
    if (loading) return
    setError(null)
    if (code.replace(/\D/g, '').length < 6) { setError('Enter the 6-digit code we just sent.'); return }

    setLoading(true)
    const supabase = createClient()
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone: normalisedPhone,
      token: code.replace(/\D/g, ''),
      type: 'sms', // Supabase uses 'sms' for both SMS + WhatsApp verification.
    })
    if (verifyError) {
      setError(verifyError.message)
      setLoading(false)
      return
    }

    // Pair the WhatsApp number to the profile + set type so the rest of the
    // platform routes correctly. Best-effort — profile row is auto-created
    // by Supabase trigger on signup; this just fills in the fields the
    // existing trigger doesn't know about (it can't read raw_user_meta_data
    // reliably across providers).
    if (data?.user) {
      try {
        await fetch('/api/profile/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: initialType,
            whatsapp_number: normalisedPhone,
          }),
        })
      } catch { /* non-fatal */ }
    }

    // Route by role.
    const target = companyInvite
      ? `/company/dashboard?joined=1`
      : initialType === 'company'
      ? `/company/onboarding`
      : `/upload-cv`
    window.location.href = target
  }

  if (stage === 'code') {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(106,168,245,0.10)', border: '1px solid rgba(106,168,245,0.30)' }}>
          <p className="text-[#6AA8F5] text-xs font-bold mb-1">📱 Code sent to {normalisedPhone}</p>
          <p className="text-[#A6A6B4] text-xs leading-relaxed">Check WhatsApp (or SMS) — enter the 6-digit code below. Takes a minute to land.</p>
        </div>

        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          className="gradient-border-card w-full px-5 py-4 rounded-2xl text-center font-mono tracking-[0.4em] text-2xl font-black text-[#F4F4F7] placeholder-[#7E7E8E] focus:outline-none bg-transparent"
        />

        <button
          type="button"
          onClick={verifyCode}
          disabled={loading || code.replace(/\D/g, '').length < 6}
          className="w-full bg-gradient-to-r from-[#6AA8F5] to-[#F08CAE] py-4 rounded-full font-black text-sm text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Verifying…' : 'Verify and continue →'}
        </button>

        <div className="flex items-center justify-between text-xs">
          <button type="button" onClick={() => { setStage('phone'); setCode(''); setError(null) }} className="text-[#7E7E8E] hover:text-[#C7C7D1] transition-colors">
            ← Change number
          </button>
          <button type="button" onClick={resend} disabled={resendCooldown > 0 || loading} className="text-[#6AA8F5] hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <input
        type="tel"
        placeholder="+971 50 123 4567"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        className="gradient-border-card w-full px-5 py-4 rounded-2xl text-[#F4F4F7] placeholder-[#7E7E8E] focus:outline-none text-sm bg-transparent"
      />
      <p className="text-[#7E7E8E] text-[11px] -mt-1 px-1">Include country code · UAE: +971 · KSA: +966 · UK: +44</p>

      <button
        type="button"
        onClick={sendCode}
        disabled={!initialType || !agreedToTerms || loading || !phoneValid}
        className="w-full bg-gradient-to-r from-[#6AA8F5] to-[#F08CAE] py-4 rounded-full font-black text-sm text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Sending code…' : 'Send WhatsApp code →'}
      </button>

      <p className="text-[#7E7E8E] text-[11px] text-center leading-relaxed">
        We&apos;ll WhatsApp you a 6-digit code. No password to remember, no email confirmation, no app to download.
      </p>
    </div>
  )
}
