'use client'

// Conversational company onboarding — mirrors the candidate /cv-builder chat.
// Claude (via /api/company/onboarding-chat) runs a short interview collecting
// company name, size, industry, HQ location, what they do, website + WhatsApp,
// then emits [COMPANY_READY] + structured fields. We persist the SAME profile
// fields the old static form wrote (company_name, company_website, company_size,
// location, summary, whatsapp_number, onboarding_complete, completion_pct) via
// /api/profile/update, then route to the spine/dashboard.
//
// A visible "Prefer a form?" toggle reveals the original static form (preserved
// verbatim in ManualForm.tsx) so nothing is lost. Route guard: the page is
// auth-protected via src/proxy.ts (/company/*); non-company profiles are
// bounced to /dashboard on mount.

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ManualForm from './ManualForm'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type Extracted = {
  company_name?: string | null
  company_website?: string | null
  industry?: string | null
  location?: string | null
  company_size?: string | null
  summary?: string | null
  whatsapp_number?: string | null
}

const OPENING = `Welcome to Shapi. Let's set up your company profile — just a quick chat, no long form.

Candidates on Shapi see independent signals (Glassdoor, Reddit, news) right next to what you tell them, so this is your chance to tell your story.

**First up: what's the name of your company?**`

const APPROX_TURNS = 7

export default function CompanyOnboarding() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0E0E13]" />}>
      <CompanyOnboardingInner />
    </Suspense>
  )
}

function CompanyOnboardingInner() {
  const router = useRouter()
  // Toggle: chat (default) vs the preserved manual form.
  const [mode, setMode] = useState<'chat' | 'form'>('chat')
  const [guardChecked, setGuardChecked] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: OPENING },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Route guard + already-onboarded redirect. The proxy already blocks
  // unauthenticated users; here we additionally bounce non-company profiles
  // to /dashboard, and already-onboarded companies straight to their
  // dashboard (matching the old form's behaviour). ?edit=true keeps them here.
  useEffect(() => {
    let cancelled = false
    const isEditMode = typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('edit') === 'true'
    async function guard() {
      try {
        const res = await fetch('/api/profile/get')
        if (!cancelled && res.ok) {
          const d = await res.json()
          const profile = d?.profile || null
          if (profile && profile.type !== 'company') {
            setRedirecting(true)
            router.replace('/dashboard')
            return
          }
          if (profile?.onboarding_complete && !isEditMode) {
            setRedirecting(true)
            router.replace('/company/dashboard')
            return
          }
        }
      } catch { /* network blip — let them proceed */ }
      if (!cancelled) setGuardChecked(true)
    }
    guard()
    return () => { cancelled = true }
  }, [router])

  const userTurns = messages.filter(m => m.role === 'user').length
  const turnPct = saving ? 100 : Math.min(95, Math.round((userTurns / APPROX_TURNS) * 100))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Persist the collected fields (same set the manual form writes) and route on.
  const finish = async (extracted: Extracted | null) => {
    setSaving(true)
    setError('')
    const wa = extracted?.whatsapp_number?.trim()
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: extracted?.company_name?.trim() || null,
          company_website: extracted?.company_website?.trim() || null,
          company_size: extracted?.company_size || null,
          location: extracted?.location?.trim() || null,
          summary: extracted?.summary?.trim() || null,
          industry: extracted?.industry?.trim() || null,
          whatsapp_number: wa && wa.length > 5 ? wa : null,
          onboarding_complete: true,
          completion_pct: 100,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Couldn't save (${res.status}). Try again, or use the manual form below.`)
        setSaving(false)
        return
      }
      // Fire enrichment in the background (best-effort) — same as the form did.
      const companyName = extracted?.company_name?.trim()
      if (companyName) {
        fetch('/api/company/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_name: companyName,
            website: extracted?.company_website?.trim() || null,
          }),
        }).catch(() => {})
      }
      router.push('/company/spine?welcome=true')
    } catch {
      setError('Network issue saving your details. Try again, or use the manual form below.')
      setSaving(false)
    }
  }

  const send = async () => {
    if (!input.trim() || loading || saving) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/company/onboarding-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      if (!res.ok) {
        setError(`Something went wrong (${res.status}). Try again, or switch to the manual form.`)
        setLoading(false)
        return
      }
      const { reply, ready, extracted } = await res.json() as {
        reply: string; ready: boolean; extracted: Extracted | null
      }
      if (reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      }
      setLoading(false)
      if (ready) {
        await finish(extracted)
      }
    } catch {
      setError('Network issue. Try again, or switch to the manual form.')
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Already-onboarded / wrong-type redirect handoff.
  if (redirecting) {
    return (
      <div className="min-h-screen bg-[#0E0E13] flex flex-col items-center justify-center px-6">
        <div className="flex items-center gap-2" style={{ color: '#F08CAE' }}>
          <div className="w-4 h-4 rounded-full border-2 border-[#F08CAE]/30 border-t-[#F08CAE] animate-spin" />
          <span className="text-xs font-bold">Loading…</span>
        </div>
      </div>
    )
  }

  // Manual-form fallback — the preserved original static form.
  if (mode === 'form') {
    return <ManualForm onSwitchToChat={() => setMode('chat')} />
  }

  // Brief loading shell while the guard checks the profile, so we don't flash
  // the chat and then redirect.
  if (!guardChecked) {
    return (
      <div className="min-h-screen bg-[#0E0E13] flex flex-col items-center justify-center px-6">
        <p className="text-[#A6A6B4] text-sm">Loading your company…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0E0E13] flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-[#0E0E13]/80 backdrop-blur sticky top-0 z-10">
        <Link href="/" className="font-bold text-xl tracking-tight" style={{
          background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#5C5C6A] hidden sm:inline">Company setup</span>
          <button
            onClick={() => setMode('form')}
            className="text-xs text-[#6AA8F5] font-medium hover:underline"
            title="Switch to the classic form — fill the fields yourself"
          >
            Prefer a form? Skip to manual entry →
          </button>
        </div>
      </nav>

      {/* Progress hint */}
      <div className="px-6 pt-3 pb-1 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-1.5">
          <span>{saving ? 'Setting up your company ✓' : `Question ${Math.max(1, userTurns + 1)} · about ${Math.max(0, APPROX_TURNS - userTurns)} to go`}</span>
          <span className="text-[#5C5C6A]">~2 min · just a chat</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${turnPct}%`,
              background: saving
                ? '#34D399'
                : 'linear-gradient(90deg,#6AA8F5,#F08CAE,#F58E9A)',
            }}
          />
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'text-white rounded-br-sm'
                  : 'bg-[#16161F] text-[#C7C7D1] border border-[rgba(255,255,255,0.08)] shadow-sm rounded-bl-sm'
              }`}
              style={m.role === 'user' ? { background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)' } : undefined}
            >
              {m.content.split('\n').map((line, j) => {
                const parts = line.split(/\*\*(.*?)\*\*/g)
                return (
                  <p key={j} className={j > 0 ? 'mt-2' : ''}>
                    {parts.map((part, k) =>
                      k % 2 === 1 ? <strong key={k}>{part}</strong> : part
                    )}
                  </p>
                )
              })}
            </div>
          </div>
        ))}

        {(loading || saving) && (
          <div className="flex justify-start">
            <div className="bg-[#16161F] border border-[rgba(255,255,255,0.08)] shadow-sm rounded-2xl rounded-bl-sm px-5 py-4">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#6AA8F5]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#6AA8F5]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#6AA8F5]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 text-xs text-[#F58E9A]" style={{ background: 'rgba(245,142,154,0.10)', border: '1px solid rgba(245,142,154,0.25)' }}>
              {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-[#0E0E13]/80 backdrop-blur border-t border-[rgba(255,255,255,0.08)] px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type your answer... (Enter to send)"
            rows={1}
            disabled={saving}
            className="flex-1 bg-[#16161F] border border-[rgba(255,255,255,0.08)] rounded-2xl px-5 py-3.5 text-sm text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#6AA8F5] transition-colors resize-none disabled:opacity-50"
            style={{ minHeight: '52px', maxHeight: '120px' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading || saving}
            className="text-white px-5 py-3.5 rounded-2xl font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6AA8F5, #F08CAE)' }}
          >
            Send
          </button>
        </div>
        <p className="text-center text-xs text-[#5C5C6A] mt-2">
          Prefer to fill it in yourself?{' '}
          <button onClick={() => setMode('form')} className="text-[#6AA8F5] hover:underline font-medium">
            Skip to manual entry
          </button>
        </p>
      </div>
    </div>
  )
}
