'use client'

// Booking form for enterprise / Strategic Workforce Plan enquiries. Replaces
// the old mailto: links that triggered the OS app-picker (Microsoft / Google
// / etc.) and landed users nowhere — a real conversion-killing UX bug Ana
// hit in testing.
//
// On submit we POST to /api/book-call which fires a Resend email to Ana +
// optionally logs the lead. The form captures enough context (role, company,
// company size, timeline, budget) that Ana doesn't need to dig before
// responding.

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function BookCallInner() {
  const searchParams = useSearchParams()
  // Optional ?topic= prefill so different CTAs can pre-set context
  // ("strategic-plan", "snapshot-followup", etc.). The form just surfaces
  // it back as a subject-line hint to Ana.
  //
  // ?intent=enterprise is the v4 pricing-page Enterprise CTA — alias that
  // to topic='enterprise-sales' so the existing flow handles it cleanly.
  const rawTopic = searchParams.get('topic') || ''
  const intent = searchParams.get('intent') || ''
  const topic = intent === 'enterprise' ? 'enterprise-sales' : rawTopic

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [timeline, setTimeline] = useState('')
  const [message, setMessage] = useState('')

  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  // Track auth state — back link points to /company/dashboard for signed-in
  // users but to '/' for anonymous prospects (Enterprise leads who haven't
  // signed up yet). Ana caught the "Dashboard" link showing for anonymous
  // users that goes nowhere meaningful.
  const [authed, setAuthed] = useState(false)

  // If the user is signed in, prefill name/email/company/size from their
  // profile so they don't re-type basics they already gave us.
  useEffect(() => {
    fetch('/api/profile/get')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const p = d?.profile
        if (!p) return
        setAuthed(true)
        if (!name && p.full_name) setName(p.full_name)
        if (!company && p.company_name) setCompany(p.company_name)
        // Prefill company_size — Ana flagged this gap 2026-06-04. The
        // onboarding form saves it onto profiles.company_size in the
        // exact label-string form the book-call dropdown expects.
        if (!companySize && p.company_size) setCompanySize(p.company_size)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    setErrMsg('')
    try {
      const res = await fetch('/api/book-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          role: role.trim(),
          company_size: companySize,
          timeline,
          message: message.trim(),
          topic,
          engagement_id: engagement || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErrMsg(d?.error || `Couldn't send (${res.status})`)
        setStatus('error')
        return
      }
      setStatus('sent')
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Network error')
      setStatus('error')
    }
  }

  const topicLabel = topic === 'strategic-plan' ? 'Strategic Workforce Plan'
    : topic === 'snapshot-followup' ? 'Workforce Snapshot follow-up'
    : topic === 'workforce-os' ? 'Workforce monitoring'
    : topic === 'workforce-intelligence' ? 'Workforce Intelligence'
    : topic === 'founder-session' ? 'Founder strategy session — included'
    : topic === 'enterprise-sales' ? 'Enterprise plan — sales conversation'
    : 'Strategy call'

  // Optional engagement context — when a Strategic Workforce Plan client
  // taps the in-product Founder Call CTA, this links the booking back to
  // their engagement so Ana sees it in admin.
  const engagement = searchParams.get('engagement') || ''

  return (
    <div className="min-h-screen bg-[#060609]">
      {/* Force dark UI for native <select> dropdowns + kill Chrome's white
          autofill background. Without this, opened dropdowns showed a white
          panel (impossible to read), and prefilled inputs landed in
          off-white because of the browser autofill style. */}
      <style>{`
        .book-call-form select, .book-call-form option {
          color-scheme: dark;
          background-color: #0D0C14;
          color: #F4F4F7;
        }
        .book-call-form option {
          background-color: #0D0C14 !important;
          color: #F4F4F7 !important;
        }
        .book-call-form input:-webkit-autofill,
        .book-call-form input:-webkit-autofill:hover,
        .book-call-form input:-webkit-autofill:focus,
        .book-call-form input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #0D0C14 inset !important;
          -webkit-text-fill-color: #F4F4F7 !important;
          caret-color: #F4F4F7 !important;
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>shapi</Link>
        {authed ? (
          <Link href="/company/dashboard" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1]">← Dashboard</Link>
        ) : (
          <Link href="/" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1]">← Home</Link>
        )}
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-20">
        {status === 'sent' ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.30)' }}>
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl" style={{ background: '#34D399' }}>✓</div>
            <h1 className="text-2xl font-black text-[#F4F4F7] mb-2">Got it — speak soon.</h1>
            <p className="text-[#A6A6B4] text-sm leading-relaxed max-w-md mx-auto mb-5">
              We&apos;ve got your request. {process.env.NEXT_PUBLIC_CALENDLY_URL
                ? 'Pick a time that suits you below — your invite lands instantly.'
                : 'We’ll reply within one business day with two or three time slots that suit your timezone.'}
            </p>
            {process.env.NEXT_PUBLIC_CALENDLY_URL && (
              <a
                href={process.env.NEXT_PUBLIC_CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 rounded-full font-black text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}
              >
                Pick a time on the calendar →
              </a>
            )}
            <p className="text-[#7E7E8E] text-[11px] mt-5">
              Confirmation email sent to your inbox. Look out for <strong className="text-[#C7C7D1]">hello@shapi.io</strong>.
            </p>
            <Link href="/company/dashboard" className="inline-block mt-3 text-[#38BDF8] text-sm font-bold hover:underline">
              Back to dashboard
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#38BDF8' }}>{topicLabel}</p>
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-2" style={{ color: '#FB7185' }}>{topic === 'founder-session' ? 'Book your founder session' : 'Book a call'}</h1>
              <p className="text-[#A6A6B4] text-sm leading-relaxed">
                {topic === 'founder-session'
                  ? '30 minutes with Ana, included with your engagement. Tell us what you want to pressure-test and we’ll come prepared. We reply with two or three slots — or pick one straight from the calendar after submit.'
                  : topic === 'enterprise-sales'
                  ? 'Enterprise is sales-led — $2,500–12,000/mo, scaled to workforce size, with optional Bespoke Transformation ($15-25k) for custom severance modelling, taxonomy overrides, and a leadership workshop. Tell us roughly what you need and we’ll come with a scoped proposal.'
                  : '30 minutes with our team. We’ll walk through where you are, what you’re trying to solve, and whether Shapi is the right fit — and we’ll tell you plainly if it isn’t.'}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4 book-call-form">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Your name *" value={name} onChange={setName} required />
                <Field label="Work email *" value={email} onChange={setEmail} type="email" required />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Company *" value={company} onChange={setCompany} required />
                <Field label="Your role" value={role} onChange={setRole} placeholder="e.g. CEO, Head of People" />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider mb-1.5 block">Company size</label>
                  <select value={companySize} onChange={e => setCompanySize(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[#F4F4F7] focus:outline-none focus:border-[#38BDF8]/40">
                    <option value="">Select…</option>
                    <option value="<10">&lt;10</option>
                    <option value="10-50">10–50</option>
                    <option value="50-200">50–200</option>
                    <option value="200-1000">200–1000</option>
                    <option value="1000+">1000+</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider mb-1.5 block">Timeline</label>
                  <select value={timeline} onChange={e => setTimeline(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[#F4F4F7] focus:outline-none focus:border-[#38BDF8]/40">
                    <option value="">Select…</option>
                    <option value="this-month">This month</option>
                    <option value="next-quarter">Next quarter</option>
                    <option value="exploring">Exploring options</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider mb-1.5 block">What&apos;s on your mind?</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
                  placeholder="What are you trying to solve? What does success look like? Anything specific you'd like Ana to bring to the call."
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#38BDF8]/40"
                  style={{ resize: 'vertical' }} />
              </div>

              {status === 'error' && (
                <p className="text-[#FB7185] text-xs bg-[#FB7185]/10 border border-[#FB7185]/20 rounded-xl px-4 py-3">
                  {errMsg || 'Something went wrong — try again.'}
                </p>
              )}

              <button type="submit" disabled={status === 'sending' || !name.trim() || !email.trim() || !company.trim()}
                className="w-full py-4 rounded-full font-black text-sm text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}>
                {status === 'sending' ? 'Sending…' : 'Request a call →'}
              </button>
              <p className="text-[#7E7E8E] text-[11px] text-center">We reply within one business day.</p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="text-[#7E7E8E] text-[10px] font-bold uppercase tracking-wider mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder}
        className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[#F4F4F7] placeholder-[#7E7E8E] outline-none focus:border-[#38BDF8]/40" />
    </div>
  )
}

export default function BookCallPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#060609]" />}>
      <BookCallInner />
    </Suspense>
  )
}
