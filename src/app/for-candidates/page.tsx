'use client'

import Link from 'next/link'
import LocalePicker from '@/components/LocalePicker'
import { LocaleProvider, useTranslation } from '@/lib/i18n/LocaleContext'

const usps: Array<{ icon: string; title: string; body: string }> = [
  {
    icon: '✓',
    title: 'Verified Profile',
    body: 'Independent references — we choose who to ask — plus AI cross-check across every answer. Companies see the real you, not a polished CV.',
  },
  {
    icon: '🛡',
    title: 'AI-Proof Check',
    body: 'Free, 30 seconds, no signup. An honest read on how exposed your role is to automation, plus the three smartest moves you can make next.',
  },
  {
    icon: '🧭',
    title: 'Career Translator',
    body: 'Any role to any role: the salary dip, the 3-year forecast, the courses with real timelines, and pivot paths that actually fit your life.',
  },
  {
    icon: '💸',
    title: 'What You’re Worth',
    body: 'Regional-vs-global salary benchmark for your role. Negotiate from facts — not gut feel. Synthesised from Mercer, Glassdoor and Numbeo.',
  },
  {
    icon: '🗺',
    title: 'Career Roadmap',
    body: 'A 5-year direction that respects where you are. The next role, the role after that, and the skills that unlock each step.',
  },
  {
    icon: '📚',
    title: 'Course Wallet',
    body: 'Heart-save free and paid courses, with ratings and the source. Verified on your profile the moment you finish — no extra paperwork.',
  },
  {
    icon: '💼',
    title: 'Plan Your Own Business',
    body: 'Sometimes the answer isn’t another job. We map the founder route — costs, market, what you already have — for your country.',
  },
  {
    icon: '✦',
    title: 'Ask Shapi',
    body: 'Concierge for the messy questions — quitting, counter-offers, salary letters, visa paperwork. A human reply when the AI isn’t enough.',
  },
  {
    icon: '🎙',
    title: 'Voice notes, any language',
    body: 'Arabic, Tagalog, Spanish, Hindi, Urdu, Tagalog and more. Build your whole profile by voice — no typing, no laptop, no formal CV.',
  },
  {
    icon: '💬',
    title: 'WhatsApp assistant',
    body: 'Reply "voice" / "references" / "share my profile" / "send my CV" — and it happens. Magic-link mobile actions, no app to install.',
  },
  {
    icon: '🛰',
    title: 'Shapi Active',
    body: 'Daily job scanner across the web. We draft outreach in your voice and walk you through interview prep tailored to each role.',
  },
  {
    icon: '✉',
    title: 'Active Concierge',
    body: 'Once you approve, Shapi sends the outreach every morning on your behalf — verified profile attached, employer trust score visible.',
  },
  {
    icon: '🌱',
    title: 'Shapi Upskilling Fund',
    body: 'A share of every subscription funds free training for unemployed candidates. Your subscription literally puts someone else back to work.',
  },
  {
    icon: '📄',
    title: 'CV Kit $25 / CV Pro $59',
    body: 'Verified profile in every language version that matters — region-targeted, industry-targeted, polished PDF. Yours to keep forever.',
  },
  {
    icon: '🔧',
    title: 'Blue + white collar',
    body: 'Voice-first for trades. Phone-only journey. The chef, the supervisor and the ops director are all taken equally seriously here.',
  },
]

type Score = 1 | 0 | 0.5
const comparisonRows: Array<{ label: string; shapi: Score; linkedin: Score; indeed: Score; glassdoor: Score; jackjill: Score; bayt: Score; gulftalent: Score }> = [
  { label: 'Independent verified references', shapi: 1, linkedin: 0, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0, gulftalent: 0 },
  { label: 'AI-displacement scoring (for your role)', shapi: 1, linkedin: 0, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0, gulftalent: 0 },
  { label: 'Career pivot / reskill engine', shapi: 1, linkedin: 0.5, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0, gulftalent: 0 },
  { label: 'Voice notes in the channel you already use (no app download)', shapi: 1, linkedin: 0, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0, gulftalent: 0 },
  { label: 'Multilingual native (Arabic / Tagalog / Urdu / Hindi)', shapi: 1, linkedin: 0, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0.5, gulftalent: 0 },
  { label: 'Blue + white collar coverage', shapi: 1, linkedin: 0.5, indeed: 1, glassdoor: 0.5, jackjill: 0, bayt: 1, gulftalent: 0 },
  { label: 'WhatsApp-first ops (always-on assistant)', shapi: 1, linkedin: 0, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0, gulftalent: 0 },
  { label: 'Free upskill fund', shapi: 1, linkedin: 0, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0, gulftalent: 0 },
  { label: 'Transparent pricing', shapi: 1, linkedin: 0.5, indeed: 0.5, glassdoor: 1, jackjill: 0.5, bayt: 0.5, gulftalent: 0 },
  { label: 'MENA-native (regional salary + visa intelligence)', shapi: 1, linkedin: 0.5, indeed: 0.5, glassdoor: 0, jackjill: 0, bayt: 1, gulftalent: 1 },
]

function Mark({ v }: { v: 1 | 0 | 0.5 }) {
  if (v === 1) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full" style={{ background: 'rgba(106,168,245,0.15)' }}>
        <svg className="w-3.5 h-3.5" style={{ color: '#6AA8F5' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  if (v === 0.5) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black" style={{ background: 'rgba(255,255,255,0.06)', color: '#A6A6B4' }}>
        ~
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full" style={{ background: 'rgba(245,142,154,0.12)' }}>
      <svg className="w-3.5 h-3.5" style={{ color: '#F58E9A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  )
}

export default function ForCandidatesPage() {
  return (
    <LocaleProvider>
      <ForCandidatesInner />
    </LocaleProvider>
  )
}

function ForCandidatesInner() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7] overflow-x-hidden">
      <style>{`
        .grad-text {
          background: linear-gradient(135deg, #6AA8F5, #F08CAE, #F58E9A, #6AA8F5);
          background-size: 300% 300%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .card {
          background: #16161F;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
          transition: all 0.3s ease;
        }
        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 20px 46px rgba(240,140,174,0.14);
          border-color: rgba(240,140,174,0.28);
        }
        .btn-primary {
          background: linear-gradient(135deg, #6AA8F5, #F08CAE, #F58E9A);
          color: #fff;
          box-shadow: 0 8px 24px rgba(240,140,174,0.28);
          transition: all 0.25s ease;
        }
        .btn-primary:hover { box-shadow: 0 12px 32px rgba(240,140,174,0.42); transform: translateY(-1px); }
        .grad-border-cta {
          background: linear-gradient(#16161F,#16161F) padding-box, linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A) border-box;
          border: 1.5px solid transparent; color: #F4F4F7;
          transition: all 0.25s ease;
        }
        .grad-border-cta:hover { box-shadow: 0 8px 24px rgba(240,140,174,0.22); transform: translateY(-1px); }
        .btn-outline {
          background: transparent; border: 1px solid rgba(255,255,255,0.16); color: #F4F4F7;
          transition: all .25s ease;
        }
        .btn-outline:hover { border-color: rgba(240,140,174,0.45); color: #fff; transform: translateY(-1px); }
        .nav-link { color:#A6A6B4; transition: color .2s ease; }
        .nav-link:hover { background: linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .shapi-col { background: linear-gradient(180deg, rgba(251,113,133,0.10), rgba(251,113,133,0.02)); }
      `}</style>

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Nav */}
      <nav className="relative z-20 border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="font-black text-xl tracking-tighter grad-text">shapi</Link>
          <div className="flex items-center gap-5">
            <Link href="/" className="nav-link text-sm hidden sm:block">{t('forCandidates.nav.home')}</Link>
            <Link href="/for-companies" className="nav-link text-sm hidden sm:block">{t('forCandidates.nav.forCompanies')}</Link>
            <Link href="/login" className="nav-link text-sm">{t('forCandidates.nav.signIn')}</Link>
            <LocalePicker />
            <Link href="/signup" className="grad-border-cta px-4 py-2 rounded-full text-sm font-black">{t('forCandidates.nav.getStarted')}</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ background: 'rgba(251,113,133,0.10)', border: '1px solid rgba(251,113,133,0.25)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#FB7185' }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#FB7185' }}>{t('forCandidates.hero.badge')}</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tighter mb-6" style={{ color: '#FB7185' }}>
            {t('forCandidates.hero.headlineLine1')}<br />{t('forCandidates.hero.headlineLine2')}
          </h1>

          <p className="text-lg md:text-xl text-[#C7C7D1] max-w-2xl mx-auto leading-relaxed mb-3">
            {t('forCandidates.hero.subhead')}
          </p>
          <p className="text-base text-[#A6A6B4] max-w-2xl mx-auto leading-relaxed mb-10">
            {t('forCandidates.hero.subheadExtra')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className="btn-primary px-8 py-4 rounded-full text-sm font-black">
              {t('forCandidates.hero.ctaBuild')}
            </Link>
            <Link href="/ai-proof" className="btn-outline px-8 py-4 rounded-full text-sm font-bold">
              {t('forCandidates.hero.ctaAiProof')}
            </Link>
          </div>
        </div>
      </section>

      {/* The pitch in 3 panels */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              tag: 'The moat',
              color: '#FB7185',
              title: 'Verified',
              body: 'Independent references — sourced by us, not curated by you — plus AI cross-check across every answer. Companies actually trust this. So can you.',
            },
            {
              tag: 'The compass',
              color: '#F08CAE',
              title: 'AI-era guidance',
              body: 'AI-Proof check, Career Translator, pivot and shield plans, Course Wallet, "What you’re worth", and a "plan your own business" route — all in one place.',
            },
            {
              tag: 'Always on',
              color: '#6AA8F5',
              title: 'Always on, in WhatsApp',
              body: 'Voice notes in any language. Voice commands: "skip", "references", "voice". Reply-to-edit your CV. Magic-link actions on your phone — no app to install.',
            },
          ].map((p, i) => (
            <div key={i} className="card rounded-2xl p-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${p.color}1a`, color: p.color }}>{p.tag}</span>
              <h3 className="text-2xl font-black mt-4 mb-3 tracking-tight">{p.title}</h3>
              <p className="text-[#C7C7D1] text-sm leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Every USP mapped */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5" style={{ background: 'rgba(251,113,133,0.10)', color: '#FB7185' }}>
            {t('forCandidates.usps.eyebrow')}
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: '#FB7185' }}>
            {t('forCandidates.usps.title')}
          </h2>
          <p className="text-[#A6A6B4] text-base mt-4 max-w-2xl mx-auto">
            {t('forCandidates.usps.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {usps.map((u, i) => (
            <div key={i} className="card rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-base" style={{ background: 'rgba(251,113,133,0.12)', color: '#FB7185' }}>
                  {u.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-base mb-1.5" style={{ color: '#FB7185' }}>{u.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#C7C7D1' }}>{u.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5" style={{ background: 'rgba(106,168,245,0.12)', color: '#6AA8F5' }}>
            How Shapi compares
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: '#FB7185' }}>
            Built where the others stopped.
          </h2>
        </div>

        <div className="card rounded-3xl p-4 md:p-6 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 text-[#7E7E8E] font-bold text-sm uppercase tracking-wider">Capability</th>
                <th className="p-3">
                  <span className="font-black text-base tracking-tighter" style={{ color: '#FB7185' }}>Shapi</span>
                </th>
                {['LinkedIn', 'Indeed', 'Bayt', 'Glassdoor', 'GulfTalent', 'Jack & Jill'].map(c => (
                  <th key={c} className="p-3 text-[#7E7E8E] font-bold text-sm">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <td className="p-3 text-sm text-[#C7C7D1] font-medium">{row.label}</td>
                  <td className="p-3 text-center shapi-col"><Mark v={row.shapi} /></td>
                  <td className="p-3 text-center"><Mark v={row.linkedin} /></td>
                  <td className="p-3 text-center"><Mark v={row.indeed} /></td>
                  <td className="p-3 text-center"><Mark v={row.bayt} /></td>
                  <td className="p-3 text-center"><Mark v={row.glassdoor} /></td>
                  <td className="p-3 text-center"><Mark v={row.gulftalent} /></td>
                  <td className="p-3 text-center"><Mark v={row.jackjill} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center text-xs text-[#7E7E8E] mt-4">
          <span className="font-black" style={{ color: '#6AA8F5' }}>✓</span> in · <span className="font-black text-[#A6A6B4]">~</span> partial · <span className="font-black" style={{ color: '#F58E9A' }}>✗</span> not offered.
        </p>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: '#FB7185' }}>
            How it works.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { step: '01', color: '#6AA8F5', title: 'Build your verified profile', body: 'Drop your CV or send a voice note. Shapi extracts the substance in seconds and asks the right follow-up questions in WhatsApp.' },
            { step: '02', color: '#F08CAE', title: 'Get referenced + AI-checked', body: 'We source referees independently, cross-check what they say, and publish one honest report — owned by you, trusted by employers.' },
            { step: '03', color: '#FB7185', title: 'Match (or pivot) confidently', body: 'Apply with real evidence. Or use the Career Translator and Course Wallet to pivot before the market forces the move.' },
          ].map((s, i) => (
            <div key={i} className="card rounded-2xl p-7">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-4xl font-black" style={{ color: s.color }}>{s.step}</span>
                <h3 className="text-lg font-bold">{s.title}</h3>
              </div>
              <p className="text-[#C7C7D1] text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sourced confidence callout */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-20">
        <div className="rounded-2xl p-7 text-center" style={{
          background: 'linear-gradient(135deg, rgba(106,168,245,0.08), rgba(251,113,133,0.06))',
          border: '1px solid rgba(255,255,255,0.10)',
        }}>
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#F08CAE' }}>Sourced confidence</p>
          <p className="text-base md:text-lg text-[#C7C7D1] leading-relaxed">
            Synthesised from <span className="font-bold text-[#F4F4F7]">Mercer</span> /{' '}
            <span className="font-bold text-[#F4F4F7]">Glassdoor</span> /{' '}
            <span className="font-bold text-[#F4F4F7]">Numbeo</span> /{' '}
            <span className="font-bold text-[#F4F4F7]">WEF Future of Jobs</span> /{' '}
            <span className="font-bold text-[#F4F4F7]">your real reference responses</span>.
          </p>
        </div>
      </section>

      {/* Pricing tease */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: '#FB7185' }}>
            Honest pricing.
          </h2>
          <p className="text-[#A6A6B4] text-base mt-3">Start free. Layer on the tools when they pay off.</p>
        </div>

        <div className="grid md:grid-cols-5 gap-3">
          {[
            { name: 'Free', price: '$0', body: 'Verified profile + every free tool', color: '#6AA8F5' },
            { name: 'CV Kit', price: '$25', body: 'Every language + industry version', color: '#F08CAE' },
            { name: 'CV Pro', price: '$59', body: 'Full verification + cross-check', color: '#FB7185' },
            { name: 'Shapi Active', price: '$29/mo', body: 'Job scanner + drafted outreach', color: '#F58E9A' },
            { name: 'Active Concierge', price: '$79/mo', body: 'Auto-send approved outreach daily', color: '#6AA8F5' },
          ].map((t, i) => (
            <div key={i} className="card rounded-2xl p-5">
              <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: t.color }}>{t.name}</p>
              <p className="text-2xl font-black mb-2 text-[#F4F4F7]">{t.price}</p>
              <p className="text-xs text-[#A6A6B4] leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl text-center py-20 px-8" style={{
          background: '#16161F', border: '1px solid rgba(251,113,133,0.20)',
        }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(251,113,133,0.16), transparent 60%)' }} />
          <div className="relative">
            <h2 className="text-4xl md:text-6xl font-black mb-5 tracking-tighter max-w-3xl mx-auto" style={{ color: '#FB7185' }}>
              Don’t just job-hunt. Become the verified candidate companies fight over.
            </h2>
            <p className="text-[#A6A6B4] mb-9 text-base max-w-xl mx-auto">
              Free to start. Verified by independent references. Built for the AI era — in your language, on your phone.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup" className="btn-primary px-8 py-4 rounded-full font-black text-sm">
                Build my profile — free →
              </Link>
              <Link href="/ai-proof" className="btn-outline px-8 py-4 rounded-full font-bold text-sm">
                Check if your job is AI-proof
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <Link href="/" className="font-black text-xl tracking-tighter grad-text">shapi</Link>
          <div className="flex items-center gap-6 text-sm text-[#7E7E8E]">
            <Link href="/for-companies" className="hover:text-[#F4F4F7] transition-colors">For companies</Link>
            <Link href="/privacy" className="hover:text-[#F4F4F7] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#F4F4F7] transition-colors">Terms</Link>
            <a href="mailto:hello@shapi.io" className="hover:text-[#F4F4F7] transition-colors">hello@shapi.io</a>
          </div>
          <p className="text-[#5C5C6A] text-sm">© 2026 Shapi.</p>
        </div>
      </footer>
    </div>
  )
}
