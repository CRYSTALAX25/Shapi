'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#060609] text-white overflow-x-hidden">
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.08); }
        }
        @keyframes floatCard {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .orb-teal { animation: pulseGlow 5s ease-in-out infinite; }
        .orb-purple { animation: pulseGlow 6s ease-in-out infinite 1.5s; }
        .orb-coral { animation: pulseGlow 7s ease-in-out infinite 3s; }
        .float-card { animation: floatCard 6s ease-in-out infinite; }
        .animated-gradient-text {
          background: linear-gradient(135deg, #A78BFA, #22D3EE, #FB7185, #A78BFA);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 5s ease infinite;
        }
        .gradient-border-card {
          background: linear-gradient(#060609, #060609) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.25), rgba(139,92,246,0.25)) border-box;
          border: 1px solid transparent;
          transition: all 0.3s ease;
        }
        .gradient-border-card:hover {
          background: linear-gradient(#0a0a10, #0a0a10) padding-box,
                      linear-gradient(135deg, rgba(34,211,238,0.6), rgba(139,92,246,0.6)) border-box;
        }
        .btn-glow:hover {
          box-shadow: 0 0 40px rgba(34,211,238,0.35), 0 0 80px rgba(139,92,246,0.15);
        }
      `}</style>

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.12) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Nav */}
      <nav className="relative z-20 px-6 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <span className="text-white font-black text-xl tracking-tighter">shapi</span>
          <span className="text-[10px] font-bold text-white/30 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full uppercase tracking-wider">beta</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-white/40 text-sm hover:text-white/80 transition-colors">Sign in</Link>
          <Link href="/signup"
            className="relative group">
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] blur-sm opacity-60 group-hover:opacity-100 transition-opacity" />
            <span className="relative block bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] px-5 py-2.5 rounded-full text-sm font-bold text-[#060609]">
              Get started →
            </span>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-12">
        {/* Orbs */}
        <div className="orb-teal absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.10) 0%, transparent 70%)' }} />
        <div className="orb-purple absolute top-10 right-1/4 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)' }} />
        <div className="orb-coral absolute -bottom-20 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(251,113,133,0.08) 0%, transparent 70%)' }} />

        <div className="text-center max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.08] px-4 py-2 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE] animate-pulse" />
            <span className="text-white/40 text-xs font-medium">UAE launch · May 2026</span>
            <span className="text-white/15">·</span>
            <span className="text-[#22D3EE] text-xs font-bold">Early access open</span>
          </div>

          <h1 className="text-7xl md:text-[88px] font-black leading-[0.92] tracking-tighter mb-7">
            <span className="block text-white">Hiring that actually</span>
            <span className="block animated-gradient-text">works for humans.</span>
          </h1>

          <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto leading-relaxed mb-10">
            Not another job board. A verified profile platform — candidates understood deeply,
            references independent, companies knowing exactly who they're hiring.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link href="/signup"
              className="btn-glow bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] px-8 py-4 rounded-full text-sm font-black text-[#060609] hover:opacity-90 transition-all hover:scale-[1.02]">
              Build my verified profile — $49 →
            </Link>
            <Link href="/signup"
              className="gradient-border-card px-8 py-4 rounded-full text-sm font-bold text-white/60 hover:text-white transition-all">
              I'm hiring — post a role free →
            </Link>
          </div>

          {/* Floating profile card */}
          <div className="float-card max-w-lg mx-auto">
            <div className="gradient-border-card rounded-2xl p-6 backdrop-blur-sm text-left">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#22D3EE] to-[#8B5CF6] flex items-center justify-center text-sm font-black text-[#060609]">A</div>
                  <div>
                    <div className="text-sm font-bold text-white">Ahmed K.</div>
                    <div className="text-xs text-white/40">Operations Director · Dubai</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-[#22D3EE]/10 border border-[#22D3EE]/25 rounded-full px-3 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22D3EE] animate-pulse" />
                  <span className="text-[#22D3EE] text-xs font-bold">Verified</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {['P&L management', 'NEOM experience', 'Team of 200+', 'Arabic / English', 'Giga-project ops', 'Visa: available'].map((s, i) => (
                  <span key={i} className="text-xs text-white/50 bg-white/[0.04] border border-white/[0.07] px-3 py-1.5 rounded-full">{s}</span>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span className="text-xs text-white/35">3 refs verified</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-[#8B5CF6]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <span className="text-xs text-white/35">AI skills mapped</span>
                  </div>
                </div>
                <div className="text-xs text-white/20">Profile score: 94%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 border-y border-white/[0.05] py-10 my-4">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[
            { n: '3 min', label: 'to build a complete profile', color: '#22D3EE' },
            { n: '100%', label: 'independently verified', color: '#A78BFA' },
            { n: '0', label: 'forms to fill in — ever', color: '#FB7185' },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-4xl md:text-5xl font-black mb-1.5" style={{ color: s.color }}>{s.n}</p>
              <p className="text-white/30 text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#22D3EE]/8 border border-[#22D3EE]/20 text-[#22D3EE] text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5">
            How it works
          </div>
          <h2 className="text-5xl font-black text-white tracking-tighter">
            Three minutes.<br />Then we do the work.
          </h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-5">
          {/* Connecting line */}
          <div className="absolute top-10 left-[calc(16.666%+24px)] right-[calc(16.666%+24px)] h-px bg-gradient-to-r from-[#22D3EE]/30 via-[#8B5CF6]/30 to-[#FB7185]/30 hidden md:block" />

          {[
            {
              step: '01',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ),
              title: 'Drop your CV',
              desc: 'We read everything. No forms. Our AI extracts your experience, skills, and achievements in seconds.',
              color: '#22D3EE',
            },
            {
              step: '02',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              ),
              title: 'We ask the right questions',
              desc: "A few WhatsApp messages — not a form. Text or voice note. We find skills you didn't know you had.",
              color: '#A78BFA',
            },
            {
              step: '03',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ),
              title: 'Your profile goes live',
              desc: 'Independently verified. References sourced by us. Companies see the real you — not a polished CV.',
              color: '#FB7185',
            },
          ].map((item, i) => (
            <div key={i} className="gradient-border-card rounded-2xl p-8 hover:bg-white/[0.02] transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}18`, color: item.color }}>
                  {item.icon}
                </div>
                <span className="text-4xl font-black" style={{ color: item.color, opacity: 0.25 }}>{item.step}</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Manifesto */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl p-12 md:p-16" style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(34,211,238,0.04) 50%, rgba(251,113,133,0.08) 100%)',
          border: '1px solid rgba(139,92,246,0.18)',
        }}>
          <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#A78BFA] text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-8">
              Why we built this
            </div>
            <div className="space-y-5 text-white/55 text-lg leading-relaxed">
              <p>
                AI is taking over tasks that employed millions. Degrees that took four years to earn
                are becoming optional. Jobs that didn't exist five years ago are the most in-demand
                roles on the planet.
              </p>
              <p>
                A construction worker in Dubai has skills no algorithm has properly captured.
                An ops director leaving a giga-project has achievements no CV template was built to hold.
              </p>
              <p className="text-white font-bold text-xl">
                Most platforms respond by adding more filters to screen people out faster.
                We went the other way.
              </p>
              <p className="font-semibold" style={{ color: '#FB7185' }}>
                Your skills are real. Your experience is real. Your future is yours to shape.
                We just make sure the right people see it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] text-white/40 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5">
            What makes Shapi different
          </div>
          <h2 className="text-5xl font-black text-white tracking-tighter">Both sides. Verified. Finally.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ),
              title: 'Independent references',
              desc: "We source references ourselves. Candidates don't choose who we contact — so what you hear is real.",
              tag: 'Verification',
              color: '#22D3EE',
            },
            {
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              ),
              title: 'AI skills by evidence',
              desc: "Not checkboxes. Built something? Applied it to real work? That's what counts.",
              tag: 'AI-powered',
              color: '#A78BFA',
            },
            {
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              ),
              title: 'Companies rated too',
              desc: 'Salary paid on time. Manager quality. Real working hours. Candidates see the truth before they apply.',
              tag: 'Trust',
              color: '#FB7185',
            },
            {
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              ),
              title: 'Blue and white collar',
              desc: 'The chef, the construction supervisor, the ops director. One platform. Every person taken seriously.',
              tag: 'Inclusive',
              color: '#22D3EE',
            },
            {
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
              ),
              title: 'No degree required',
              desc: 'Skills over paper. We verify what you can do — with visa intelligence built in for every country.',
              tag: 'Skills-first',
              color: '#A78BFA',
            },
            {
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              ),
              title: 'Career transition engine',
              desc: "AI taking over your role? We map your transferable skills and show you exactly where to go next.",
              tag: 'Future-proof',
              color: '#FB7185',
            },
          ].map((item, i) => (
            <div key={i} className="gradient-border-card rounded-2xl p-7 hover:bg-white/[0.02] transition-all group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}15`, color: item.color }}>
                  {item.icon}
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${item.color}12`, color: item.color }}>
                  {item.tag}
                </span>
              </div>
              <h3 className="font-bold text-white mb-2">{item.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl text-center py-20 px-8" style={{
          background: 'linear-gradient(135deg, #0891B2 0%, #7C3AED 50%, #E11D48 100%)',
        }}>
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="relative">
            <h2 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tighter">Shape what&apos;s next.</h2>
            <p className="text-white/60 mb-10 text-base">UAE · Saudi Arabia · GCC · Remote MENA</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup"
                className="bg-white text-[#060609] px-8 py-4 rounded-full font-black text-sm hover:bg-white/90 transition-all hover:scale-[1.02]">
                Build my verified profile — $49 →
              </Link>
              <Link href="/signup"
                className="bg-white/10 border border-white/25 text-white px-8 py-4 rounded-full font-bold text-sm hover:bg-white/20 transition-all backdrop-blur-sm">
                Start hiring →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.05] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-black text-xl tracking-tighter animated-gradient-text" style={{ WebkitTextFillColor: undefined }}>shapi</span>
          <p className="text-white/20 text-sm">Shape what&apos;s next. © 2026 Shapi.</p>
          <a href="mailto:hello@shapi.io" className="text-white/20 text-sm hover:text-white/50 transition-colors">
            hello@shapi.io
          </a>
        </div>
      </footer>
    </div>
  )
}
