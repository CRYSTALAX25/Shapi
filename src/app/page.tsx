'use client'

import { useState } from 'react'

export default function Home() {
  const [email, setEmail] = useState('')
  const [type, setType] = useState<'candidate' | 'company' | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !type) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, type }),
    })

    if (res.ok) {
      setSubmitted(true)
    } else if (res.status === 409) {
      setError("You're already on the list!")
      setSubmitted(true)
    } else {
      setError('Something went wrong. Try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F8F4EE]">

      {/* Nav */}
      <nav className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <span className="text-[#0B5563] font-bold text-2xl tracking-tight">shapi</span>
        <a
          href="#waitlist"
          className="bg-[#0B5563] text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-[#094450] transition-colors"
        >
          Get early access
        </a>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-block bg-[#0B5563]/10 text-[#0B5563] text-sm font-medium px-4 py-1.5 rounded-full mb-8">
          Launching in UAE — May 2026
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-[#1C1C2E] leading-tight mb-6">
          Shape what&apos;s next.
        </h1>

        <p className="text-xl text-[#1C1C2E]/70 max-w-2xl mx-auto leading-relaxed mb-10">
          The hiring platform built for the world that&apos;s coming — for every person
          navigating what AI means for their career, and every company trying to hire
          the humans who&apos;ll take them forward.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <a
            href="#waitlist"
            className="bg-[#0B5563] text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-[#094450] transition-colors"
          >
            I&apos;m looking for a role — $49
          </a>
          <a
            href="#waitlist"
            className="bg-[#E8745A] text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-[#d45e42] transition-colors"
          >
            I&apos;m hiring — 60 days free
          </a>
        </div>

        <p className="text-sm text-[#1C1C2E]/50">
          UAE · Saudi Arabia · GCC · Remote MENA
        </p>
      </section>

      {/* Manifesto */}
      <section className="bg-[#0B5563] py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-white/60 text-sm font-medium uppercase tracking-widest mb-8">
            Why we built this
          </p>
          <div className="space-y-6 text-white/90 text-lg leading-relaxed">
            <p>
              The world of work is changing faster than anyone planned. AI is taking over
              tasks that employed millions. Degrees that took four years to earn are becoming
              optional. Jobs that didn&apos;t exist five years ago are now the most in-demand
              roles on the planet.
            </p>
            <p>
              A construction worker in Dubai has skills that no algorithm has ever properly
              captured. An ops director leaving a giga-project has achievements that no CV
              template was designed to hold.
            </p>
            <p>
              Most platforms respond to this by adding more filters, more automation, more
              ways to screen people out faster.
            </p>
            <p className="text-white font-semibold text-xl">
              We went the other way.
            </p>
            <p>
              We built a platform that takes people seriously — all people. The chef who&apos;s
              never written a CV. The executive who undersells herself because she doesn&apos;t
              know how to quantify what she built. The company that genuinely wants the right
              person, not just the fastest hire.
            </p>
            <p>
              Because the future of work isn&apos;t humans vs. AI. It&apos;s humans using every
              tool available — including AI — to show the world what they&apos;re actually worth.
            </p>
            <p className="text-[#E8745A] font-semibold text-xl">
              Your skills are real. Your experience is real. Your future is yours to shape.
              We just make sure the right people see it.
            </p>
          </div>
        </div>
      </section>

      {/* What makes us different */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <p className="text-[#0B5563] text-sm font-medium uppercase tracking-widest mb-4 text-center">
          What makes Shapi different
        </p>
        <h2 className="text-3xl font-bold text-[#1C1C2E] text-center mb-14">
          Both sides. Verified. Finally.
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: '✓',
              title: 'Independent references',
              desc: 'We source references ourselves. Candidates don\'t choose who we contact — so what you hear is real.',
              color: '#0B5563'
            },
            {
              icon: '◈',
              title: 'AI skills verified by evidence',
              desc: 'Not checkboxes. Built something? Applied it to real work? That\'s what counts. Course certificates alone don\'t cut it.',
              color: '#0D6B7A'
            },
            {
              icon: '♦',
              title: 'Companies rated too',
              desc: 'Salary paid on time. Manager quality. Real working hours. Candidates see the truth before they apply.',
              color: '#0F8299'
            },
            {
              icon: '◎',
              title: 'No degree required',
              desc: 'Skills over paper. We verify what you can do — with visa intelligence built in for every country.',
              color: '#0B5563'
            },
            {
              icon: '▲',
              title: 'Blue and white collar',
              desc: 'The chef, the construction supervisor, the ops director. One platform. Every person taken seriously.',
              color: '#0D6B7A'
            },
            {
              icon: '→',
              title: 'Career transition engine',
              desc: 'AI taking over your role? We map your transferable skills and show you exactly where to go next.',
              color: '#0F8299'
            }
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-2xl p-7 shadow-sm border border-[#1C1C2E]/5">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mb-5 text-sm"
                style={{ backgroundColor: item.color }}
              >
                {item.icon}
              </div>
              <h3 className="font-semibold text-[#1C1C2E] text-lg mb-3">{item.title}</h3>
              <p className="text-[#1C1C2E]/60 leading-relaxed text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="bg-[#1C1C2E] py-20 px-6">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Get early access
          </h2>
          <p className="text-white/60 mb-10">
            First 50 candidates get early access. First 5 companies get 60 days free.
            UAE launch — May 2026.
          </p>

          {submitted ? (
            <div className="bg-[#0B5563] rounded-2xl p-8">
              <p className="text-white font-semibold text-lg mb-2">You&apos;re on the list.</p>
              <p className="text-white/70 text-sm">
                We&apos;ll be in touch before launch. You&apos;re helping shape what Shapi becomes.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-3 bg-white/10 p-1.5 rounded-full mb-6">
                <button
                  type="button"
                  onClick={() => setType('candidate')}
                  className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors ${
                    type === 'candidate'
                      ? 'bg-[#0B5563] text-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  I&apos;m a candidate
                </button>
                <button
                  type="button"
                  onClick={() => setType('company')}
                  className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors ${
                    type === 'company'
                      ? 'bg-[#E8745A] text-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  I&apos;m a company
                </button>
              </div>

              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-full px-6 py-4 text-sm focus:outline-none focus:border-[#E8745A] transition-colors"
              />

              <button
                type="submit"
                disabled={!type || loading}
                className="w-full bg-[#E8745A] text-white py-4 rounded-full font-semibold text-sm hover:bg-[#d45e42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Joining...' : 'Join the waitlist →'}
              </button>

              {error && (
                <p className="text-[#E8745A] text-xs">{error}</p>
              )}

              {!type && !error && (
                <p className="text-white/40 text-xs">
                  Select candidate or company above first
                </p>
              )}
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1C1C2E] border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-white font-bold text-xl tracking-tight">shapi</span>
          <p className="text-white/40 text-sm">
            Shape what&apos;s next. © 2026 Shapi. All rights reserved.
          </p>
          <a
            href="mailto:hello@shapi.io"
            className="text-white/40 text-sm hover:text-white/70 transition-colors"
          >
            hello@shapi.io
          </a>
        </div>
      </footer>

    </div>
  )
}
