'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

type Msg = { role: 'user' | 'assistant'; content: string }

// Don't show the concierge on marketing / auth pages — it's an in-app helper.
const HIDE_ON = ['/', '/login', '/signup', '/reset-password', '/blog', '/privacy', '/terms']
function isHidden(path: string | null): boolean {
  if (!path) return false
  if (HIDE_ON.includes(path)) return true
  if (path.startsWith('/blog/')) return true
  return false
}

// The current route tells us the audience INSTANTLY on audience-specific pages —
// no candidate→company flash, and never the wrong content on the companies page.
// Neutral pages (dashboard etc.) return null and fall back to the profile fetch.
function roleFromPath(path: string | null): 'candidate' | 'company' | null {
  if (!path) return null
  if (path === '/for-companies' || path.startsWith('/company') || path.startsWith('/business')) return 'company'
  if (path === '/for-candidates') return 'candidate'
  return null
}

// Two intros — Shapi serves candidates AND companies. The widget detects the
// signed-in user's profile.type on first open and shows the right one.
const INTRO_CANDIDATE: Msg = {
  role: 'assistant',
  content:
    "Hi, I'm Shapi ✦ — your career guide for the AI era. Ask me about pivots, courses, salaries by country, or starting something of your own.",
}
const INTRO_COMPANY: Msg = {
  role: 'assistant',
  content:
    "Hi, I'm Shapi ✦ — your workforce co-pilot. Ask me about hiring plans, comp benchmarks, role definition, restructuring, AI exposure, org design, or how to get the most out of Shapi's tools.",
}

// Theme tokens
const CANVAS = '#060609'
const PANEL = '#0D0C14'
const BORDER = 'rgba(255,255,255,0.08)'
const FILL = 'rgba(255,255,255,0.05)'
const TEXT = '#F4F4F7'
const TEXT_DIM = '#C7C7D1'
const TEXT_FAINT = '#A6A6B4'
const BLUE = '#38BDF8'
const CTA = 'linear-gradient(135deg, #38BDF8, #34D399)'

export default function AskShapi() {
  const pathname = usePathname()
  const pathRole = roleFromPath(pathname)
  const initialIntro = pathRole === 'company' ? INTRO_COMPANY : INTRO_CANDIDATE

  const [open, setOpen] = useState(false)
  // Seed intro + messages from the PATH so the right audience shows instantly
  // (no candidate→company flash, no candidate text on the companies page).
  const [intro, setIntro] = useState<Msg>(initialIntro)
  const [role, setRole] = useState<'candidate' | 'company' | null>(pathRole)
  const [messages, setMessages] = useState<Msg[]>([initialIntro])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the intro in sync with the audience. The path is authoritative on
  // audience-specific routes (instant); neutral pages fall back to the profile.
  useEffect(() => {
    const swapIntro = (type: 'candidate' | 'company') => {
      setRole(type)
      const nextIntro = type === 'company' ? INTRO_COMPANY : INTRO_CANDIDATE
      setIntro(nextIntro)
      // Only swap the canned intro if the user hasn't started a conversation.
      setMessages(prev => (prev.length === 1 && prev[0].role === 'assistant') ? [nextIntro] : prev)
    }

    if (pathRole) {
      if (role !== pathRole) swapIntro(pathRole)
      return
    }
    // Neutral page: detect from the signed-in profile on first open.
    if (!open || role) return
    let cancelled = false
    fetch('/api/profile/get')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled) return
        swapIntro(d?.profile?.type === 'company' ? 'company' : 'candidate')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open, role, pathRole])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (isHidden(pathname)) return null

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const next: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      // Only send real conversation turns (skip the canned intro)
      const payload = next.filter((m) => m !== intro)
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload }),
      })
      // Parse defensively — a timeout returns an HTML 504, not JSON.
      const raw = await res.text()
      let data: { reply?: string; error?: string } = {}
      try { data = JSON.parse(raw) } catch {
        data = { error: (res.status === 504 || /timeout|gateway/i.test(raw))
          ? 'That took a bit too long — try again, it usually works on the second go.'
          : `Hmm, I hit a snag (${res.status}). Try again in a moment.` }
      }
      const reply = data.reply || data.error || 'Something went wrong. Please try again.'
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Connection dropped — please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask Shapi"
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 18px',
            borderRadius: 999,
            border: 'none',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            background: CTA,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>✦</span>
          Ask Shapi
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Ask Shapi chat"
          className="ask-shapi-panel"
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            zIndex: 9999,
            width: 360,
            maxWidth: 'calc(100vw - 40px)',
            height: 520,
            maxHeight: 'calc(100vh - 40px)',
            display: 'flex',
            flexDirection: 'column',
            background: CANVAS,
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
            fontFamily: 'inherit',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: `1px solid ${BORDER}`,
              background: PANEL,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: BLUE, fontSize: 16 }}>✦</span>
              <span style={{ color: TEXT, fontWeight: 700, fontSize: 15 }}>
                Ask Shapi
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: 'none',
                color: TEXT_FAINT,
                fontSize: 20,
                lineHeight: 1,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '9px 12px',
                  borderRadius: 12,
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: m.role === 'user' ? '#fff' : TEXT_DIM,
                  background: m.role === 'user' ? BLUE : FILL,
                  border:
                    m.role === 'user' ? 'none' : `1px solid ${BORDER}`,
                }}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '9px 12px',
                  borderRadius: 12,
                  fontSize: 13.5,
                  color: TEXT_FAINT,
                  background: FILL,
                  border: `1px solid ${BORDER}`,
                }}
              >
                Shapi is thinking…
              </div>
            )}
          </div>

          {/* Input */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: 12,
              borderTop: `1px solid ${BORDER}`,
              background: PANEL,
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={role === 'company' ? 'Ask about hiring, comp, org design…' : 'Ask about your career…'}
              disabled={loading}
              style={{
                flex: 1,
                background: CANVAS,
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: '10px 12px',
                color: TEXT,
                fontSize: 13.5,
                outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Send"
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '0 16px',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: loading || !input.trim() ? 'default' : 'pointer',
                opacity: loading || !input.trim() ? 0.5 : 1,
                background: CTA,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Mobile: full-width sheet */}
      <style>{`
        @media (max-width: 480px) {
          .ask-shapi-panel {
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            max-width: 100vw !important;
            height: 88vh !important;
            border-radius: 16px 16px 0 0 !important;
          }
        }
      `}</style>
    </>
  )
}
