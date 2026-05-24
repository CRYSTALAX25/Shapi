'use client'

import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F1F2F7] text-[#0E0E1A] overflow-x-hidden">
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.08); }
        }
        @keyframes floatCard {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .orb-teal { animation: pulseGlow 5s ease-in-out infinite; }
        .orb-purple { animation: pulseGlow 6s ease-in-out infinite 1.5s; }
        .orb-coral { animation: pulseGlow 7s ease-in-out infinite 3s; }
        .float-card { animation: floatCard 6s ease-in-out infinite; }
        .grad-text {
          background: linear-gradient(135deg, #7C3AED, #06B6D4, #F43F5E, #7C3AED);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 6s ease infinite;
        }
        .card {
          background: #ffffff;
          border: 1px solid rgba(14,14,26,0.08);
          box-shadow: 0 1px 3px rgba(14,14,26,0.04), 0 10px 30px rgba(14,14,26,0.05);
          transition: all 0.3s ease;
        }
        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 1px 3px rgba(14,14,26,0.05), 0 18px 44px rgba(124,58,237,0.12);
          border-color: rgba(124,58,237,0.25);
        }
        .btn-primary {
          background: linear-gradient(135deg, #06B6D4, #7C3AED);
          color: #fff;
          transition: all 0.25s ease;
        }
        .btn-primary:hover {
          box-shadow: 0 10px 30px rgba(124,58,237,0.30);
          transform: translateY(-1px);
        }
        .grad-border-cta {
          background: linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg,#06B6D4,#7C3AED,#F43F5E) border-box;
          border: 1.5px solid transparent;
          color: #0E0E1A;
          transition: all 0.25s ease;
        }
        .grad-border-cta:hover { box-shadow: 0 8px 24px rgba(124,58,237,0.20); transform: translateY(-1px); }
      `}</style>

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(14,14,26,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Nav — floating pill island (Holo-style) */}
      <nav className="relative z-20 px-4 pt-5 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-3 bg-white/90 backdrop-blur-md border border-[#0E0E1A]/[0.08] rounded-full pl-4 pr-2 py-2" style={{ boxShadow: '0 8px 30px rgba(14,14,26,0.07)' }}>
          <div className="flex items-center gap-2">
            <ShapiCharacter size={30} />
            <span className="font-black text-xl tracking-tighter grad-text">shapi</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/worth" className="text-[#5A5A6E] text-sm hover:text-[#0E0E1A] transition-colors hidden md:block">What you&apos;re worth</Link>
            <Link href="#why" className="text-[#5A5A6E] text-sm hover:text-[#0E0E1A] transition-colors hidden md:block">Why Shapi</Link>
            <Link href="#pricing" className="text-[#5A5A6E] text-sm hover:text-[#0E0E1A] transition-colors hidden sm:block">Pricing</Link>
            <Link href="/blog" className="text-[#5A5A6E] text-sm hover:text-[#0E0E1A] transition-colors hidden sm:block">Blog</Link>
            <Link href="/login" className="text-[#5A5A6E] text-sm hover:text-[#0E0E1A] transition-colors">Sign in</Link>
            <Link href="/signup" className="grad-border-cta px-4 py-2 rounded-full text-sm font-black">
              Get started →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-12">
        {/* Orbs */}
        <div className="orb-teal absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.16) 0%, transparent 70%)' }} />
        <div className="orb-purple absolute top-10 right-1/4 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)' }} />
        <div className="orb-coral absolute -bottom-20 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.12) 0%, transparent 70%)' }} />

        <div className="text-center max-w-5xl mx-auto">
          {/* Mascot */}
          <div className="flex justify-center mb-5"><ShapiCharacter size={76} mood="happy" /></div>
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 bg-white border border-[#0E0E1A]/[0.08] px-4 py-2 rounded-full mb-8 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] animate-pulse" />
            <span className="text-[#5A5A6E] text-xs font-medium">UAE launch · 2026</span>
            <span className="text-[#0E0E1A]/15">·</span>
            <span className="text-xs font-bold" style={{ color: '#7C3AED' }}>Early access open</span>
          </div>

          <h1 className="text-6xl md:text-[88px] font-black leading-[0.92] tracking-tighter mb-7">
            <span className="block">Hiring that actually</span>
            <span className="block grad-text">works for humans.</span>
          </h1>

          <p className="text-lg md:text-xl text-[#5A5A6E] max-w-2xl mx-auto leading-relaxed mb-10">
            Not another job board. The <span className="text-[#0E0E1A] font-semibold">verification layer for hiring</span> —
            references sourced independently, skills proven by evidence, companies you can actually trust.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link href="/signup" className="btn-primary px-8 py-4 rounded-full text-sm font-black">
              Build my verified profile — free to start →
            </Link>
            <Link href="/signup" className="card px-8 py-4 rounded-full text-sm font-bold text-[#0E0E1A]">
              I&apos;m hiring — post a role free →
            </Link>
          </div>

          {/* Floating profile card + verification chips (Holo-style) */}
          <div className="relative max-w-lg mx-auto">
            <div className="hidden lg:block">
              <FloatChip text="3 references verified" color="#10B981" pos="-left-24 top-4" />
              <FloatChip text="AI cross-check passed" color="#7C3AED" pos="-right-28 top-0" />
              <FloatChip text="Right to work ✓" color="#06B6D4" pos="-left-20 bottom-10" />
              <FloatChip text="Trust score 94" color="#F43F5E" pos="-right-20 bottom-6" />
            </div>
            <div className="float-card">
            <div className="card rounded-2xl p-6 text-left">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white" style={{ background: 'linear-gradient(135deg, #06B6D4, #7C3AED)' }}>A</div>
                  <div>
                    <div className="text-sm font-bold">Ahmed K.</div>
                    <div className="text-xs text-[#8A8A99]">Operations Director · Dubai</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="text-[#059669] text-xs font-bold">Verified</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {['P&L management', 'NEOM experience', 'Team of 200+', 'Arabic / English', 'Giga-project ops', 'Visa: available'].map((s, i) => (
                  <span key={i} className="text-xs text-[#5A5A6E] bg-[#0E0E1A]/[0.03] border border-[#0E0E1A]/[0.06] px-3 py-1.5 rounded-full">{s}</span>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#0E0E1A]/[0.07]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span className="text-xs text-[#8A8A99]">3 refs verified</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <span className="text-xs text-[#8A8A99]">AI skills mapped</span>
                  </div>
                </div>
                <div className="text-xs font-bold" style={{ color: '#7C3AED' }}>Profile score: 94%</div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 py-12 my-4" style={{ background: 'linear-gradient(180deg, #FAFAFC, #F4F5F9)' }}>
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[
            { n: '3 min', label: 'to build a complete profile', color: '#06B6D4' },
            { n: '100%', label: 'independently verified', color: '#7C3AED' },
            { n: '0', label: 'forms to fill in — ever', color: '#F43F5E' },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-4xl md:text-5xl font-black mb-1.5" style={{ color: s.color }}>{s.n}</p>
              <p className="text-[#5A5A6E] text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5" style={{ background: 'rgba(6,182,212,0.10)', color: '#0891B2' }}>
            How it works
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">
            Three minutes.<br />Then we do the work.
          </h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-5">
          {[
            { step: '01', title: 'Drop your CV', desc: 'We read everything. No forms. Our AI extracts your experience, skills, and achievements in seconds.', color: '#06B6D4',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
            { step: '02', title: 'We ask the right questions', desc: "A few WhatsApp messages — not a form. Text or voice note. We find skills you didn't know you had.", color: '#7C3AED',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> },
            { step: '03', title: 'Your profile goes live', desc: 'Independently verified. References sourced by us. Companies see the real you — not a polished CV.', color: '#F43F5E',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /> },
          ].map((item, i) => (
            <div key={i} className="card rounded-2xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}16`, color: item.color }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{item.icon}</svg>
                </div>
                <span className="text-4xl font-black" style={{ color: item.color, opacity: 0.22 }}>{item.step}</span>
              </div>
              <h3 className="text-lg font-bold mb-3">{item.title}</h3>
              <p className="text-[#5A5A6E] text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Shapi — comparison table (Holo-style) */}
      <section id="why" className="relative z-10 max-w-5xl mx-auto px-6 py-24 scroll-mt-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5" style={{ background: 'rgba(124,58,237,0.10)', color: '#7C3AED' }}>
            Why Shapi
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">One platform built on proof.</h2>
          <p className="text-[#5A5A6E] text-lg mt-4 max-w-2xl mx-auto">Job boards match. Recruiters gatekeep. We verify — independently, for both sides.</p>
        </div>

        <div className="card rounded-3xl p-4 md:p-6 overflow-x-auto">
          <table className="w-full min-w-[660px] border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3"></th>
                <th className="p-3">
                  <div className="flex flex-col items-center gap-1.5">
                    <ShapiCharacter size={40} mood="happy" />
                    <span className="grad-text font-black text-base tracking-tighter">shapi</span>
                  </div>
                </th>
                {['LinkedIn', 'Job boards', 'Recruiters'].map(c => (
                  <th key={c} className="p-3 text-[#8A8A99] font-bold text-sm">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Independent reference checks — we choose who', true, false, false, false],
                ['AI cross-check across all references', true, false, false, false],
                ['Skills proven by evidence', true, false, false, false],
                ['Company trust score for candidates', true, false, false, false],
                ['Right-to-work intelligence by country', true, false, false, false],
                ['Blue + white collar — voice-note first', true, false, false, false],
                ['You own your verification report', true, false, false, false],
                ['No placement / per-hire fees', true, true, true, false],
              ].map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(14,14,26,0.07)' }}>
                  <td className="p-3 text-sm text-[#3F3F4E] font-medium">{row[0] as string}</td>
                  {[1, 2, 3, 4].map(col => (
                    <td key={col} className="p-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full" style={{
                        background: row[col] ? (col === 1 ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.12)') : 'rgba(244,63,94,0.10)',
                      }}>
                        {row[col]
                          ? <svg className="w-3.5 h-3.5" style={{ color: '#10B981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          : <svg className="w-3.5 h-3.5" style={{ color: '#F43F5E' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Manifesto */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl p-12 md:p-16" style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.07) 0%, rgba(6,182,212,0.04) 50%, rgba(244,63,94,0.06) 100%)',
          border: '1px solid rgba(124,58,237,0.14)',
        }}>
          <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)' }} />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-8" style={{ background: 'rgba(124,58,237,0.10)', color: '#7C3AED' }}>
              Why we built this
            </div>
            <div className="space-y-5 text-[#3F3F4E] text-lg leading-relaxed">
              <p>
                AI is taking over tasks that employed millions. Degrees that took four years to earn
                are becoming optional. Jobs that didn&apos;t exist five years ago are the most in-demand
                roles on the planet.
              </p>
              <p>
                A construction worker in Dubai has skills no algorithm has properly captured.
                An ops director leaving a giga-project has achievements no CV template was built to hold.
              </p>
              <p className="text-[#0E0E1A] font-bold text-xl">
                Most platforms respond by adding more filters to screen people out faster.
                We went the other way.
              </p>
              <p className="font-semibold" style={{ color: '#E11D48' }}>
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
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5" style={{ background: '#0E0E1A0a', color: '#5A5A6E' }}>
            What makes Shapi different
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">The verification layer for hiring.</h2>
          <p className="text-[#5A5A6E] text-lg mt-4 max-w-2xl mx-auto">Others match people to jobs. We prove who they really are — for both sides.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: 'Independent references', tag: 'Our edge', color: '#06B6D4', desc: "We choose who to contact and keep it confidential — you don't curate the answers. That's a real reference, not a testimonial.",
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
            { title: 'AI cross-check', tag: 'The moat', color: '#7C3AED', desc: 'We read every reference at once, confirm what multiple people agree on, and flag conflicts honestly. One report, owned by you.',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /> },
            { title: 'Companies rated too', tag: 'Two-sided', color: '#F43F5E', desc: 'Salary paid on time. Manager quality. Real working hours. Candidates see the truth before they apply.',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /> },
            { title: 'Blue and white collar', tag: 'Inclusive', color: '#06B6D4', desc: 'The chef, the construction supervisor, the ops director. One platform. Every person taken seriously — by text or voice note.',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
            { title: 'Right-to-work intelligence', tag: 'Region-smart', color: '#7C3AED', desc: 'Visa and right-to-work captured per country, UAE-first. Skills over paper — no degree required to prove you can do the job.',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
            { title: 'Career transition engine', tag: 'Future-proof', color: '#F43F5E', desc: "AI taking over your role? We map your transferable skills and show you exactly where to go next — and how to get there.",
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /> },
          ].map((item, i) => (
            <div key={i} className="card rounded-2xl p-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}15`, color: item.color }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{item.icon}</svg>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${item.color}12`, color: item.color }}>{item.tag}</span>
              </div>
              <h3 className="font-bold mb-2">{item.title}</h3>
              <p className="text-[#5A5A6E] text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 max-w-6xl mx-auto px-6 pb-24 scroll-mt-20">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5" style={{ background: 'rgba(6,182,212,0.10)', color: '#0891B2' }}>
            Pricing
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">Start free. Pay when it pays off.</h2>
        </div>

        {/* Candidates */}
        <div className="mb-6 flex items-center gap-3">
          <h3 className="text-xl font-black">For candidates</h3>
          <span className="text-[#8A8A99] text-sm">Build it free — upgrade when you&apos;re ready.</span>
        </div>
        <div className="grid md:grid-cols-3 gap-5 mb-6">
          {/* Free */}
          <div className="card rounded-2xl p-7 flex flex-col">
            <p className="text-sm font-bold text-[#8A8A99] uppercase tracking-wider mb-2">Free</p>
            <p className="text-4xl font-black mb-1">$0</p>
            <p className="text-[#8A8A99] text-sm mb-6">Get started</p>
            <ul className="space-y-2.5 text-sm text-[#3F3F4E] mb-7 flex-1">
              {['Drop your CV — AI builds your profile', 'WhatsApp interview (text or voice)', 'Your basic profile page', 'Skills extracted automatically'].map((f, i) => (
                <li key={i} className="flex gap-2.5"><Check c="#06B6D4" />{f}</li>
              ))}
            </ul>
            <Link href="/signup" className="card rounded-full py-3 text-center text-sm font-bold text-[#0E0E1A]">Start free →</Link>
          </div>

          {/* CV Pro — highlighted */}
          <div className="rounded-2xl p-7 flex flex-col relative text-white" style={{ background: 'linear-gradient(160deg, #0E0E1A, #2A1759 60%, #0E2B33)', boxShadow: '0 20px 50px rgba(124,58,237,0.25)' }}>
            <span className="absolute top-5 right-5 text-[10px] font-black px-2.5 py-1 rounded-full" style={{ background: 'linear-gradient(135deg,#06B6D4,#7C3AED)' }}>MOST POPULAR</span>
            <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: '#67E8F9' }}>CV Pro</p>
            <p className="text-4xl font-black mb-1">$59 <span className="text-base font-bold text-white/50">one-time</span></p>
            <p className="text-white/55 text-sm mb-6">Everything to get verified &amp; hired</p>
            <ul className="space-y-2.5 text-sm text-white/85 mb-7 flex-1">
              {['Multi-language + industry CVs (Kit included)', 'WhatsApp deep-dive interviews', 'Independent reference verification chain', 'AI cross-check report', 'Career Roadmap + upskilling'].map((f, i) => (
                <li key={i} className="flex gap-2.5"><Check c="#34D399" />{f}</li>
              ))}
            </ul>
            <Link href="/signup" className="btn-primary rounded-full py-3 text-center text-sm font-black">Get Pro →</Link>
          </div>

          {/* CV Kit */}
          <div className="card rounded-2xl p-7 flex flex-col">
            <p className="text-sm font-bold text-[#8A8A99] uppercase tracking-wider mb-2">CV Kit</p>
            <p className="text-4xl font-black mb-1">$25 <span className="text-base font-bold text-[#8A8A99]">one-time</span></p>
            <p className="text-[#8A8A99] text-sm mb-6">Just the CVs</p>
            <ul className="space-y-2.5 text-sm text-[#3F3F4E] mb-7 flex-1">
              {['Multi-language CV versions', 'Industry-targeted versions', 'Polished, downloadable PDF', 'Yours to keep forever'].map((f, i) => (
                <li key={i} className="flex gap-2.5"><Check c="#7C3AED" />{f}</li>
              ))}
            </ul>
            <Link href="/signup" className="card rounded-full py-3 text-center text-sm font-bold text-[#0E0E1A]">Get the Kit →</Link>
          </div>
        </div>

        {/* Candidate add-ons */}
        <div className="rounded-2xl p-6 mb-16" style={{ background: '#F7F8FB', border: '1px solid rgba(14,14,26,0.06)' }}>
          <p className="text-sm font-bold mb-1">Power-ups for Pro members</p>
          <p className="text-[#8A8A99] text-sm mb-4">Optional subscriptions once you&apos;re verified.</p>
          <div className="flex flex-wrap gap-3">
            {[
              { n: 'Open Roles Board', p: '$19/mo', c: '#06B6D4' },
              { n: 'Shapi Active', p: '$29/mo', c: '#7C3AED' },
              { n: 'Career Bundle', p: '$39/mo', c: '#10B981' },
              { n: 'Active Concierge', p: '$79/mo', c: '#F43F5E' },
            ].map((a, i) => (
              <div key={i} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3" style={{ border: '1px solid rgba(14,14,26,0.07)' }}>
                <span className="text-sm font-bold">{a.n}</span>
                <span className="text-sm font-black" style={{ color: a.c }}>{a.p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Companies */}
        <div className="mb-2 flex items-center gap-3">
          <h3 className="text-xl font-black">For companies</h3>
          <span className="text-[#8A8A99] text-sm">30-day free trial. Cancel anytime.</span>
        </div>
        <p className="text-sm font-bold mb-6" style={{ color: '#7C3AED' }}>★ Founding Partners: the first 25 companies get 50% off for 3 months.</p>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { name: 'Starter', standard: '$299', founding: '$149', per: '/mo', custom: false, popular: false, color: '#06B6D4',
              features: ['Post unlimited roles', 'Access verified candidate profiles', 'Match scoring', 'Up to 3 seats'] },
            { name: 'Growth', standard: '$799', founding: '$399', per: '/mo', custom: false, popular: true, color: '#7C3AED',
              features: ['Everything in Starter', 'AI shortlisting + outreach', 'Company trust score', 'Priority placement', 'Up to 10 seats'] },
            { name: 'Enterprise', standard: '', founding: 'Custom', per: '', custom: true, popular: false, color: '#F43F5E',
              features: ['Everything in Growth', 'Private API + ATS integration', 'Dedicated success manager', 'Custom verification SLAs', 'Unlimited seats'] },
          ].map((tier, i) => (
            <div key={i} className={`rounded-2xl p-7 flex flex-col ${tier.popular ? 'text-white' : 'card'}`}
              style={tier.popular ? { background: 'linear-gradient(160deg, #0E0E1A, #2A1759 60%, #0E2B33)', boxShadow: '0 20px 50px rgba(124,58,237,0.25)' } : undefined}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold uppercase tracking-wider" style={{ color: tier.popular ? '#67E8F9' : '#8A8A99' }}>{tier.name}</p>
                {tier.popular && <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{ background: 'linear-gradient(135deg,#06B6D4,#7C3AED)' }}>POPULAR</span>}
              </div>
              {tier.custom ? (
                <p className="text-4xl font-black mb-6">Custom</p>
              ) : (
                <div className="mb-6">
                  <p className="text-4xl font-black">{tier.founding}<span className={`text-base font-bold ${tier.popular ? 'text-white/50' : 'text-[#8A8A99]'}`}>{tier.per}</span></p>
                  <p className={`text-xs mt-1 ${tier.popular ? 'text-white/55' : 'text-[#8A8A99]'}`}>
                    <span className="line-through">{tier.standard}{tier.per}</span> standard · founding rate, 3 mo
                  </p>
                </div>
              )}
              <ul className={`space-y-2.5 text-sm mb-7 flex-1 ${tier.popular ? 'text-white/85' : 'text-[#3F3F4E]'}`}>
                {tier.features.map((f, j) => (
                  <li key={j} className="flex gap-2.5"><Check c={tier.popular ? '#34D399' : tier.color} />{f}</li>
                ))}
              </ul>
              <Link href="/signup" className={`rounded-full py-3 text-center text-sm font-black ${tier.popular ? 'btn-primary' : 'card text-[#0E0E1A]'}`}>
                {tier.custom ? 'Talk to us →' : 'Start 30-day free trial →'}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-[#8A8A99] text-sm mt-6">
          Simple subscription — <span className="font-bold text-[#0E0E1A]">no placement fees, no per-hire costs</span>. Cancel anytime.
        </p>
      </section>

      {/* FAQ */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">FAQ</h2>
        </div>
        <div className="space-y-3">
          {[
            { q: 'Is Shapi free to start?', a: 'Yes. Drop your CV and build your profile for free — AI extracts your experience and a few WhatsApp questions fill the gaps. You only pay when you want the CV Kit, full verification, or career tools.' },
            { q: 'How are references actually verified?', a: 'We source and contact referees ourselves and keep their answers confidential — you don’t pick what they say. That’s a real reference, not a testimonial you curated.' },
            { q: 'What is the AI cross-check?', a: 'We read every reference together, confirm what multiple people independently agree on, and flag conflicts honestly. The result is one report you own — proof, not spin.' },
            { q: 'Do I need a degree?', a: 'No. Shapi is skills-first. We capture right-to-work by country and prove ability through evidence and references — paper qualifications are optional.' },
            { q: 'Blue collar, or no formal CV — can I still join?', a: 'Absolutely. You can build your whole profile by voice note in your own language. The chef, the supervisor and the director are all taken seriously here.' },
            { q: 'When does Shapi launch?', a: 'UAE-first in 2026, expanding across the GCC and remote MENA. Early access is open now — get in before public launch.' },
          ].map((f, i) => (
            <details key={i} className="group card rounded-2xl px-5 py-4">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="font-bold text-[#0E0E1A] pr-4">{f.q}</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[#7C3AED] transition-transform group-open:rotate-45" style={{ background: 'rgba(124,58,237,0.10)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                </span>
              </summary>
              <p className="text-[#5A5A6E] text-sm leading-relaxed mt-3">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl text-center py-20 px-8" style={{
          background: 'linear-gradient(135deg, #06B6D4 0%, #7C3AED 50%, #F43F5E 100%)',
        }}>
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />
          <div className="relative">
            <h2 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tighter">Shape what&apos;s next.</h2>
            <p className="text-white/70 mb-10 text-base">UAE · Saudi Arabia · GCC · Remote MENA</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup" className="bg-white text-[#0E0E1A] px-8 py-4 rounded-full font-black text-sm hover:bg-white/90 transition-all hover:scale-[1.02]">
                Build my verified profile →
              </Link>
              <Link href="/signup" className="bg-white/15 border border-white/30 text-white px-8 py-4 rounded-full font-bold text-sm hover:bg-white/25 transition-all backdrop-blur-sm">
                Start hiring →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#0E0E1A]/[0.07] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <span className="font-black text-xl tracking-tighter grad-text">shapi</span>
          <div className="flex items-center gap-6 text-sm text-[#8A8A99]">
            <Link href="/worth" className="hover:text-[#0E0E1A] transition-colors">What you&apos;re worth</Link>
            <Link href="#pricing" className="hover:text-[#0E0E1A] transition-colors">Pricing</Link>
            <Link href="/blog" className="hover:text-[#0E0E1A] transition-colors">Blog</Link>
            <Link href="/privacy" className="hover:text-[#0E0E1A] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#0E0E1A] transition-colors">Terms</Link>
            <a href="mailto:hello@shapi.io" className="hover:text-[#0E0E1A] transition-colors">hello@shapi.io</a>
          </div>
          <p className="text-[#B0B0BC] text-sm">Shape what&apos;s next. © 2026 Shapi.</p>
        </div>
      </footer>
    </div>
  )
}

function FloatChip({ text, color, pos }: { text: string; color: string; pos: string }) {
  return (
    <div className={`float-card absolute z-20 ${pos} bg-white rounded-full pl-2 pr-3 py-1.5 flex items-center gap-2 whitespace-nowrap`}
      style={{ border: '1px solid rgba(14,14,26,0.08)', boxShadow: '0 8px 24px rgba(14,14,26,0.10)' }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs font-bold text-[#3F3F4E]">{text}</span>
    </div>
  )
}

function Check({ c }: { c: string }) {
  return (
    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: c }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}
