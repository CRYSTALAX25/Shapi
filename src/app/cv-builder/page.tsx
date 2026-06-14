'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const OPENING = `Hi! I'm here to help you build a profile that actually shows what you're worth — not just a list of job titles.

Let's start simple: **what's your most recent job title, and what company were you at?**`

// Roughly how many turns the Claude CV interview takes before it emits [DONE].
// Used only for the visible progress hint — the real `ready` flag is what
// drives the actual completion CTA, not this number.
const APPROX_TURNS = 8

export default function CVBuilder() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: OPENING }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [restored, setRestored] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Restore an in-flight chat saved by /api/cv-builder. The server persists
  // the running messages array on every turn (cv_draft.sql migration). If we
  // find one, swap it in so the candidate picks up where they left off.
  useEffect(() => {
    let cancelled = false
    fetch('/api/cv-builder/draft')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled) return
        const drafted = Array.isArray(d?.messages) ? d.messages as Message[] : []
        if (drafted.length > 1) {
          setMessages(drafted)
          setRestored(true)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // How many user replies the candidate has sent — drives the progress hint.
  const userTurns = messages.filter(m => m.role === 'user').length
  const turnPct = ready ? 100 : Math.min(95, Math.round((userTurns / APPROX_TURNS) * 100))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, error])

  const send = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError('')

    // On any failure: roll the optimistic message back, put the typed answer
    // back in the box, and show an inline error bubble so the candidate can
    // just hit Send again — same pattern as /company/onboarding.
    try {
      const res = await fetch('/api/cv-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      if (!res.ok) {
        setError(`Something went wrong (${res.status}). Your answer is back in the box — try sending again.`)
        setMessages(messages)
        setInput(userMessage.content)
        setLoading(false)
        return
      }
      const { reply, ready: profileReady } = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      if (profileReady) setReady(true)
      setLoading(false)
    } catch {
      setError('Network issue — your answer is back in the box. Check your connection and try again.')
      setMessages(messages)
      setInput(userMessage.content)
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="min-h-screen bg-[#060609] flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-[#060609]/80 backdrop-blur sticky top-0 z-10">
        <span className="font-bold text-xl tracking-tight" style={{
          background: 'linear-gradient(135deg, #38BDF8, #34D399)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</span>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#5C5C6A] hidden sm:inline">CV Builder</span>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-xs text-[#A6A6B4] font-medium hover:text-[#C7C7D1]"
            title="Your chat is saved — come back any time and pick up where you left off"
          >
            Save &amp; continue later →
          </button>
          <button
            onClick={() => router.push('/onboarding')}
            className="text-xs text-[#38BDF8] font-medium hover:underline"
            title="Switch to the manual form — your conversation here is not saved"
          >
            Skip to manual form →
          </button>
        </div>
      </nav>

      {/* Progress hint — tells the candidate this is short and how far in
          they are. Bar fills based on number of replies vs APPROX_TURNS; jumps
          to 100% the moment the AI emits [DONE] (drives `ready`). */}
      <div className="px-6 pt-3 pb-1 max-w-2xl mx-auto w-full">
        {restored && (
          <div className="mb-2 rounded-lg px-3 py-1.5 text-[11px]" style={{ background: 'rgba(56, 189, 248, 0.10)', border: '1px solid rgba(56, 189, 248, 0.25)', color: '#38BDF8' }}>
            ✓ Picked up where you left off — your answers are saved as you go.
          </div>
        )}
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-1.5">
          <span>{ready ? 'Profile ready ✓' : `Question ${Math.max(1, userTurns + 1)} · about ${Math.max(0, APPROX_TURNS - userTurns)} to go`}</span>
          <span className="text-[#5C5C6A]">~5 min total · save & continue later anytime</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${turnPct}%`,
              background: ready
                ? '#34D399'
                : 'linear-gradient(90deg, #38BDF8, #34D399)',
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
                  : 'bg-[#0D0C14] text-[#C7C7D1] border border-[rgba(255,255,255,0.08)] shadow-sm rounded-bl-sm'
              }`}
              style={m.role === 'user' ? { background: 'linear-gradient(135deg, #38BDF8, #34D399)' } : undefined}
            >
              {m.content.split('\n').map((line, j) => {
                // Bold **text**
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

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#0D0C14] border border-[rgba(255,255,255,0.08)] shadow-sm rounded-2xl rounded-bl-sm px-5 py-4">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#38BDF8]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#38BDF8]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#38BDF8]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 text-xs text-[#FB7185]" style={{ background: 'rgba(251, 113, 133, 0.10)', border: '1px solid rgba(251, 113, 133, 0.25)' }}>
              {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-[#060609]/80 backdrop-blur border-t border-[rgba(255,255,255,0.08)] px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type your answer... (Enter to send)"
            rows={1}
            className="flex-1 bg-[#0D0C14] border border-[rgba(255,255,255,0.08)] rounded-2xl px-5 py-3.5 text-sm text-[#F4F4F7] placeholder-[#5C5C6A] focus:outline-none focus:border-[#38BDF8] transition-colors resize-none"
            style={{ minHeight: '52px', maxHeight: '120px' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="text-white px-5 py-3.5 rounded-2xl font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}
          >
            Send
          </button>
        </div>
        {!ready && (
          <p className="text-center text-xs text-[#5C5C6A] mt-2">Your answers are saved as you go</p>
        )}
      </div>

      {/* Blurred CV preview gate — overlays the chat the moment Claude emits
          [PROFILE_READY]. Strike at peak motivation: the user just invested
          ~5 min, the CV is ready behind the gate, two clear unlock prices.
          Dismissable — they can keep editing or return to dashboard, in which
          case the dashboard's persistent "Your CV is ready" card pulls them
          back. */}
      {ready && <CVPreviewGate onClose={() => router.push('/dashboard')} />}
    </div>
  )
}

// ── CV preview gate ─────────────────────────────────────────────────────────
function CVPreviewGate({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(14,14,19,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="relative max-w-md w-full rounded-2xl p-6 text-center"
        style={{ background: '#0D0C14', border: '1px solid rgba(56, 189, 248, 0.40)', boxShadow: '0 30px 80px rgba(0,0,0,0.65)' }}>
        {/* Mock blurred CV "preview" — pure CSS so we don't have to render a
            real PDF. The user gets the unmistakeable shape of a 1-page CV
            with all detail unreadable, plus the lock overlay. */}
        <div className="relative rounded-xl overflow-hidden mb-5" style={{ background: '#060609', border: '1px solid rgba(255,255,255,0.06)', aspectRatio: '210 / 297' }}>
          <div className="absolute inset-0 p-5 text-left" style={{ filter: 'blur(7px)', opacity: 0.7 }}>
            <div className="h-3 w-32 rounded mb-2" style={{ background: 'linear-gradient(90deg,#38BDF8, #34D399)' }} />
            <div className="h-2 w-44 rounded mb-4" style={{ background: 'rgba(255,255,255,0.15)' }} />
            {[...Array(11)].map((_, i) => (
              <div key={i} className="h-1.5 rounded mb-1.5" style={{ width: `${50 + ((i * 17) % 45)}%`, background: 'rgba(255,255,255,0.10)' }} />
            ))}
            <div className="h-2 w-28 rounded mt-4 mb-2" style={{ background: 'rgba(255,255,255,0.18)' }} />
            {[...Array(5)].map((_, i) => (
              <div key={`b${i}`} className="h-1.5 rounded mb-1.5" style={{ width: `${55 + ((i * 13) % 40)}%`, background: 'rgba(255,255,255,0.10)' }} />
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
              style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}>
              <span className="text-xl">🔒</span>
            </div>
            <p className="text-[#F4F4F7] font-black text-sm">Your CV is ready</p>
            <p className="text-[#A6A6B4] text-[11px] mt-1">Industry-styled · ATS-optimised · {`Native + English`}</p>
          </div>
        </div>

        <h2 className="text-xl font-black text-[#F4F4F7] mb-1.5">Unlock your CV ✨</h2>
        <p className="text-[#A6A6B4] text-xs mb-5 leading-relaxed">
          You&apos;ve done the work — now download the version companies actually shortlist.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => router.push('/pay?tier=kit')}
            className="rounded-xl p-4 text-left transition-colors hover:bg-white/[0.03]"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-1">CV Kit</p>
            <p className="text-2xl font-black text-[#F4F4F7] mb-1">$25</p>
            <p className="text-[10px] text-[#A6A6B4] leading-relaxed">Industry-styled PDF · Native + English · One-time</p>
          </button>
          <button
            onClick={() => router.push('/pay?tier=pro')}
            className="rounded-xl p-4 text-left transition-colors hover:opacity-95"
            style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.14), rgba(56, 189, 248, 0.14))', border: '1px solid rgba(56, 189, 248, 0.45)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#38BDF8' }}>CV Pro · most picked</p>
            <p className="text-2xl font-black text-[#F4F4F7] mb-1">$59</p>
            <p className="text-[10px] text-[#A6A6B4] leading-relaxed">Kit + deep-dive industry interview + Pro CV</p>
          </button>
        </div>

        <button
          onClick={onClose}
          className="text-[#7E7E8E] text-xs font-medium hover:text-[#C7C7D1] transition-colors">
          Not now — take me to my dashboard
        </button>
      </div>
    </div>
  )
}
