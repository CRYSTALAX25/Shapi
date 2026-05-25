'use client'

// Post-checkout success page. Stripe redirects here after a successful payment.
// Why this exists: the webhook that sets cv_kit_purchased=true runs ASYNC
// (Stripe → our webhook URL, can take 0-15s). If we redirected straight to
// /cv-ready, the gate would see cv_kit_purchased=false briefly and bounce
// back to /profile — confusing the candidate about whether payment worked.
//
// This page polls the profile until cv_kit_purchased becomes true, shows a
// clear "Payment received" state, then forwards to /cv-ready. Bounded by a
// 30-second timeout — after that we show a soft message + manual continue.

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ShapiCharacter from '@/components/ShapiCharacter'
import Link from 'next/link'

function PaySuccessContent() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session_id')

  const [stage, setStage] = useState<'checking' | 'confirmed' | 'slow'>('checking')
  const [tier, setTier] = useState<'kit' | 'pro' | null>(null)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let stopped = false
    let attempts = 0

    const poll = async () => {
      attempts++
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: p } = await supabase
        .from('profiles')
        .select('cv_kit_purchased, cv_tier')
        .eq('id', user.id)
        .single()

      if (!stopped && (p?.cv_kit_purchased || p?.cv_tier === 'pro')) {
        setTier((p.cv_tier as 'kit' | 'pro') || 'kit')
        setStage('confirmed')
        // Hold the confirmed state visible for ~1.5s so it feels intentional
        setTimeout(() => { if (!stopped) router.replace('/cv-ready') }, 1500)
        return
      }

      if (attempts >= 20 && !stopped) {
        // 20 polls × 1.5s = 30s — webhook should have fired by now
        setStage('slow')
        return
      }
      if (!stopped) setTimeout(poll, 1500)
    }

    poll()

    // Visible counter so candidate sees something is happening
    const counter = setInterval(() => setSeconds(s => s + 1), 1000)

    return () => { stopped = true; clearInterval(counter) }
  }, [router, sessionId])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#060609',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
        {stage === 'checking' && (
          <>
            <ShapiCharacter mood="thinking" size={100} className="mx-auto mb-6" />
            <div style={{ display: 'inline-block', width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(106,168,245,0.2)', borderTopColor: '#6AA8F5', animation: 'spin 0.9s linear infinite', marginBottom: 20 }} />
            <h1 className="text-3xl font-black text-white mb-2">Payment received ✓</h1>
            <p className="text-white/55 text-sm mb-2">Setting up your CV Kit…</p>
            <p className="text-white/30 text-xs">({seconds}s — usually under 10)</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}

        {stage === 'confirmed' && (
          <>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)',
              margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 40,
            }}>✓</div>
            <h1 className="text-3xl font-black text-white mb-2">
              CV {tier === 'pro' ? 'Pro' : 'Kit'} unlocked 🎉
            </h1>
            <p className="text-white/55 text-sm mb-1">Taking you to your CV…</p>
            <p className="text-white/30 text-xs">Bookmark this — your CVs are saved forever.</p>
          </>
        )}

        {stage === 'slow' && (
          <>
            <ShapiCharacter mood="thinking" size={100} className="mx-auto mb-6" />
            <h1 className="text-2xl font-black text-white mb-3">Payment received — finalising</h1>
            <p className="text-white/55 text-sm mb-4 leading-relaxed">
              Your payment went through. Our system is taking a bit longer than usual to confirm — Stripe sometimes runs slow.
            </p>
            <p className="text-white/35 text-xs mb-6">
              You can safely close this tab and check your dashboard in a couple of minutes — you&apos;ll see the green CV Kit badge.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/dashboard"
                className="px-5 py-2.5 rounded-full font-bold text-sm transition-opacity hover:opacity-90"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
                Go to dashboard
              </Link>
              <Link href="/cv-ready"
                className="px-5 py-2.5 rounded-full font-black text-sm transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)', color: '#fff' }}>
                Open CV Kit →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PaySuccess() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#060609' }} />}>
      <PaySuccessContent />
    </Suspense>
  )
}
