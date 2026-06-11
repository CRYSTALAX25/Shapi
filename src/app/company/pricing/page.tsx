'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// v5 PRICING — LOCKED 2026-06-10 (STRATEGY §2). Supersedes the v4 3-tier scheme.
// FOUR tiers + a Bespoke teaser. ANY change here must mirror
// /api/stripe/company-checkout (Stripe amounts) + STRATEGY.md §2.
//
// Free        — generous through launch (metering parked ~60-90 days post-
//               launch; FeatureGate stays OFF). CTA: signed-in → /company/spine,
//               signed-out → /signup?type=company.
// Pro $499/mo — 14-day card-required trial. company-checkout tier='pro'.
// Growth $1,500/mo 🆕 — 14-day card-required trial. tier='growth'. Full
//               diagnostic suite + Active Hiring + candidate pool. HR-OS /
//               Company Brain / Skill Density / audit trail stay Enterprise-only.
// Enterprise  — sales-led, "Custom" on the card. $2,500-5,000/mo band lives in
//               the sales conversation, NOT here. NO self-serve trial. CTA =
//               /book-call?intent=enterprise. POC $3-5k creditable to year 1.
// Bespoke Transformation $15-25k one-off — greyed teaser card.

export default function CompanyPricing() {
  const [loading, setLoading] = useState<string | null>(null)
  const [authed, setAuthed] = useState<boolean | null>(null)

  // We need to know whether the user is signed in to send the Free-tier CTA
  // to the right place: spine if already in the door, signup otherwise.
  useEffect(() => {
    fetch('/api/profile/get')
      .then(r => r.ok ? r.json() : null)
      .then(d => setAuthed(!!d?.profile))
      .catch(() => setAuthed(false))
  }, [])

  // Shared self-serve trial start for Pro + Growth.
  async function startTier(tier: 'pro' | 'growth') {
    setLoading(tier)
    if (!authed) {
      window.location.href = `/signup?type=company&plan=${tier}`
      return
    }
    const res = await fetch('/api/stripe/company-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    })
    const { url, error } = await res.json()
    if (error) { console.error('[pricing] checkout error', error); setLoading(null); return }
    if (url) window.location.href = url
  }

  function startFree() {
    if (authed) window.location.href = '/company/spine'
    else window.location.href = '/signup?type=company&plan=free'
  }

  function talkToSales() {
    window.location.href = '/book-call?intent=enterprise'
  }

  return (
    <div className="min-h-screen bg-[#0E0E13]">
      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        <Link href={authed ? '/company/dashboard' : '/login'} className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">
          {authed ? '← Dashboard' : 'Sign in'}
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-12 pb-20">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-[#F4F4F7] mb-4">
            Workforce intelligence that pays for itself.
          </h1>
          <p className="text-[#A6A6B4] text-lg max-w-2xl mx-auto">
            From a single org chart to a Living HR OS — every Shapi tool reads from your spine. Fill it once, every tool inherits.
          </p>
        </div>

        {/* Founding Partner banner — REAL cohort cap of 15 enforced at checkout. */}
        <div className="max-w-3xl mx-auto mb-10 rounded-xl px-5 py-3 text-center" style={{ background: 'rgba(240,140,174,0.08)', border: '1px solid rgba(240,140,174,0.25)' }}>
          <p className="text-sm font-bold" style={{ color: '#F08CAE' }}>
            ★ Founding Partners — the first 15 companies get 50% off their first paid tier for 6 months, then it reverts. Grandfathered for life.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">

          {/* ── FREE ─────────────────────────────────────────────────── */}
          <div className="bg-[#16161F] rounded-2xl p-7 flex flex-col" style={{ border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)' }}>
            <p className="text-xs font-bold text-[#7E7E8E] uppercase tracking-wider mb-2">Free</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-[#F4F4F7]">$0</span>
              <span className="text-[#7E7E8E] mb-1">/forever</span>
            </div>
            <p className="text-xs text-[#7E7E8E] mb-6">The data hook — start your org chart.</p>

            <div className="space-y-2.5 mb-7 flex-1">
              {[
                'Single-location org chart',
                '1 CSV upload-and-map',
                'Drag-and-drop seat editing',
                'AI-Proof a role (1/month)',
                'Salary benchmark (1/month)',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#6AA8F5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  <p className="text-sm text-[#C7C7D1]">{item}</p>
                </div>
              ))}
            </div>

            <button
              onClick={startFree}
              className="w-full py-3.5 rounded-full font-bold text-sm transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#F4F4F7' }}
            >
              {authed ? 'Open your spine →' : 'Start free →'}
            </button>
          </div>

          {/* ── PRO ──────────────────────────────────────────────────── */}
          <div className="rounded-2xl p-7 relative overflow-hidden text-white flex flex-col" style={{ background: 'linear-gradient(160deg, #0E0E13, #0b1228 60%, #0e1a2e)', boxShadow: '0 20px 50px rgba(106,168,245,0.22)', border: '1px solid rgba(106,168,245,0.30)' }}>
            <div className="absolute top-4 right-4 text-white text-[10px] font-black px-3 py-1 rounded-full" style={{ background: 'linear-gradient(135deg,#6AA8F5,#4F8FE8)' }}>
              Most popular
            </div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#6AA8F5' }}>Pro</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-white">$499</span>
              <span className="text-white/50 mb-1">/month</span>
            </div>
            <p className="text-xs text-white/60 mb-6">14-day free trial · card required · cancel anytime</p>

            <div className="space-y-2.5 mb-7 flex-1">
              {[
                'Everything in Free, plus:',
                'Multi-location org charts',
                'Talent Match Pipeline',
                'Active Hiring — daily AI shortlists',
                'Drafted outreach + interview prep',
                'Salary Benchmark · Hiring Roadmap',
                'Proof-Over-Polish verification',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke={i === 0 ? 'transparent' : '#6AA8F5'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  <p className={`text-sm ${i === 0 ? 'text-white/60 font-bold uppercase text-xs tracking-wider' : 'text-white/90'}`}>{item}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => startTier('pro')}
              disabled={loading === 'pro'}
              className="w-full py-3.5 rounded-full font-black text-sm transition-all disabled:opacity-50 text-white"
              style={{ background: 'linear-gradient(135deg, #6AA8F5, #4F8FE8)' }}
            >
              {loading === 'pro' ? 'Redirecting...' : 'Start 14-day trial →'}
            </button>
          </div>

          {/* ── GROWTH ──────────────────────────────────────────────────── */}
          <div className="bg-[#16161F] rounded-2xl p-7 flex flex-col" style={{ border: '1px solid rgba(52,211,153,0.30)', boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#34D399' }}>Growth</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-[#F4F4F7]">$1,500</span>
              <span className="text-[#7E7E8E] mb-1">/month</span>
            </div>
            <p className="text-xs text-[#7E7E8E] mb-6">14-day free trial · card required · cancel anytime</p>

            <div className="space-y-2.5 mb-7 flex-1">
              {[
                'Everything in Pro, plus:',
                'Full diagnostic suite',
                'Verified candidate-pool access',
                'Strategic workforce planning',
                'Span + turnover risk views',
                'Priority support',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke={i === 0 ? 'transparent' : '#34D399'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  <p className={`text-sm ${i === 0 ? 'text-[#7E7E8E] font-bold uppercase text-xs tracking-wider' : 'text-[#C7C7D1]'}`}>{item}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => startTier('growth')}
              disabled={loading === 'growth'}
              className="w-full py-3.5 rounded-full font-black text-sm transition-all disabled:opacity-50 text-white"
              style={{ background: 'linear-gradient(135deg, #34D399, #10B981)' }}
            >
              {loading === 'growth' ? 'Redirecting...' : 'Start 14-day trial →'}
            </button>
          </div>

          {/* ── ENTERPRISE ───────────────────────────────────────────── */}
          <div className="bg-[#16161F] rounded-2xl p-7 flex flex-col" style={{ border: '1px solid rgba(240,140,174,0.30)', boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#F08CAE' }}>Enterprise</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-[#F4F4F7]">Custom</span>
              <span className="text-[#7E7E8E] mb-1">pricing</span>
            </div>
            <p className="text-xs text-[#7E7E8E] mb-6">Built for HRBPs and Chief People Officers</p>

            <div className="space-y-2.5 mb-5 flex-1">
              {[
                'Everything in Growth, plus:',
                'Living HR OS + WhatsApp ops',
                'Company Brain (Seat Inheritance)',
                'Skill Density mapping',
                'Immutable audit trail',
                'Predictive turnover + span heatmaps',
                'Scenario modelling (1/3/5/10y)',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke={i === 0 ? 'transparent' : '#F08CAE'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  <p className={`text-sm ${i === 0 ? 'text-[#7E7E8E] font-bold uppercase text-xs tracking-wider' : 'text-[#C7C7D1]'}`}>{item}</p>
                </div>
              ))}
            </div>

            {/* POC line — paid diagnostic wedge, creditable to year 1. */}
            <p className="text-[11px] text-[#7E7E8E] mb-4 leading-relaxed">
              Start with an Enterprise POC ($3–5k) — fully creditable to your first year.
            </p>

            {/* Enterprise is SALES-LED. No self-serve trial. */}
            <button
              onClick={talkToSales}
              className="w-full py-3.5 rounded-full font-black text-sm transition-all text-white"
              style={{ background: 'linear-gradient(135deg, #F08CAE, #C8336B)' }}
            >
              Talk to sales →
            </button>
          </div>

        </div>

        {/* Bespoke Transformation — greyed teaser card (one-off door-opener). */}
        <div className="rounded-2xl p-6 mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 opacity-80" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(240,140,174,0.30)' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#F08CAE' }}>Bespoke Transformation · $15–25k one-off</p>
            <p className="text-sm text-[#A6A6B4] leading-relaxed max-w-2xl">
              One-shot engagement: custom severance multipliers, overhead %, taxonomy overrides + a leadership workshop. Scoped per-org — a door-opener that usually converts into a recurring Enterprise subscription.
            </p>
          </div>
          <Link href="/book-call?intent=enterprise" className="flex-shrink-0 text-center px-5 py-2.5 rounded-full font-bold text-xs" style={{ border: '1px solid rgba(240,140,174,0.40)', color: '#F08CAE', background: 'rgba(240,140,174,0.05)' }}>
            Enquire →
          </Link>
        </div>

        {/* Reassurance row */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: '🔒', label: 'Cancel anytime', sub: 'No lock-ins' },
            { icon: '🎁', label: '14-day Pro & Growth trial', sub: 'Card required, no surprise charge' },
            { icon: '📨', label: 'Migration help', sub: 'CSV import + setup call on request' },
          ].map((it, i) => (
            <div key={i} className="text-center p-4">
              <p className="text-2xl mb-1">{it.icon}</p>
              <p className="text-sm font-bold text-[#F4F4F7]">{it.label}</p>
              <p className="text-xs text-[#7E7E8E] mt-0.5">{it.sub}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-[#7E7E8E]">
          Questions? Email{' '}
          <a href="mailto:hello@shapi.io" className="underline">hello@shapi.io</a>
          {' '}or{' '}
          <Link href="/book-call?intent=general" className="underline">book a call</Link>.
        </p>
      </div>
    </div>
  )
}
