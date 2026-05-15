'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const OPENING = `Hi! I'm here to help you build a profile that actually shows what you're worth — not just a list of job titles.

Let's start simple: **what's your most recent job title, and what company were you at?**`

export default function CVBuilder() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: OPENING }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const res = await fetch('/api/cv-builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages }),
    })

    const { reply } = await res.json()
    setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    setLoading(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F4EE] flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-[#1C1C2E]/5 bg-[#F8F4EE]/80 backdrop-blur sticky top-0 z-10">
        <span className="text-[#0B5563] font-bold text-xl tracking-tight">shapi</span>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#1C1C2E]/40">CV Builder</span>
          <button
            onClick={() => router.push('/onboarding')}
            className="text-xs text-[#0B5563] font-medium hover:underline"
          >
            Skip to manual form →
          </button>
        </div>
      </nav>

      {/* Chat */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#0B5563] text-white rounded-br-sm'
                  : 'bg-white text-[#1C1C2E] border border-[#1C1C2E]/5 shadow-sm rounded-bl-sm'
              }`}
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
            <div className="bg-white border border-[#1C1C2E]/5 shadow-sm rounded-2xl rounded-bl-sm px-5 py-4">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#0B5563]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#0B5563]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#0B5563]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-[#F8F4EE]/80 backdrop-blur border-t border-[#1C1C2E]/5 px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type your answer... (Enter to send)"
            rows={1}
            className="flex-1 bg-white border border-[#1C1C2E]/10 rounded-2xl px-5 py-3.5 text-sm text-[#1C1C2E] placeholder-[#1C1C2E]/30 focus:outline-none focus:border-[#0B5563] transition-colors resize-none"
            style={{ minHeight: '52px', maxHeight: '120px' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="bg-[#0B5563] text-white px-5 py-3.5 rounded-2xl font-medium text-sm hover:bg-[#094450] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            Send
          </button>
        </div>
        <p className="text-center text-xs text-[#1C1C2E]/30 mt-2">Your answers are saved as you go</p>
      </div>
    </div>
  )
}
