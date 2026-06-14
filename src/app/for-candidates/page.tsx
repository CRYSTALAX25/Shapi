'use client'

import { useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import SiteFooter from '@/components/SiteFooter'
import { LocaleProvider, useTranslation } from '@/lib/i18n/LocaleContext'

type Score = 1 | 0 | 0.5

function Mark({ v }: { v: 1 | 0 | 0.5 }) {
  if (v === 1) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full" style={{ background: 'rgba(52, 211, 153, 0.15)' }}>
        <svg className="w-3.5 h-3.5" style={{ color: '#34D399' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full" style={{ background: 'rgba(251, 113, 133, 0.12)' }}>
      <svg className="w-3.5 h-3.5" style={{ color: '#FB7185' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  // Controlled accordion state — first group open. Without this, React's
  // controlled `open` prop fights the native <details> toggle (cards wouldn't
  // close + content desynced).
  const [openGroups, setOpenGroups] = useState<Set<number>>(() => new Set([0]))

  // The 15 benefits grouped into 4 themes — one colour each, shown as
  // click-to-expand cards (founder: tone down colour + don't dump 15 at once,
  // and keep it benefit-led rather than a copyable checklist for competitors).
  const uspGroups = [
    { color: '#34D399', title: 'Proof & Profile', keys: ['u1', 'u14', 'u13'] },
    { color: '#FB7185', title: 'Get Hired', keys: ['u11', 'u12', 'u8'] },
    { color: '#38BDF8', title: 'Navigate the AI Era', keys: ['u2', 'u3', 'u4', 'u5', 'u7'] },
    { color: '#FBBF24', title: 'Always-On, for Everyone', keys: ['u9', 'u10', 'u6', 'u15'] },
  ].map(g => ({
    ...g,
    items: g.keys.map(k => ({ title: t(`forCandidates.usps.${k}Title`), body: t(`forCandidates.usps.${k}Body`) })),
  }))

  // Softened comparison (founder): Shapi vs a single "traditional job boards"
  // column — no named competitors. `others` = the best any incumbent does on
  // that row, so it stays honest while dropping the named scorecard.
  const comparisonRows: Array<{ label: string; shapi: Score; others: Score }> = [
    { label: t('forCandidates.comparison.row1'), shapi: 1, others: 0 },
    { label: t('forCandidates.comparison.row2'), shapi: 1, others: 0 },
    { label: t('forCandidates.comparison.row3'), shapi: 1, others: 0.5 },
    { label: t('forCandidates.comparison.row4'), shapi: 1, others: 0 },
    { label: t('forCandidates.comparison.row5'), shapi: 1, others: 0.5 },
    { label: t('forCandidates.comparison.row6'), shapi: 1, others: 1 },
    { label: t('forCandidates.comparison.row7'), shapi: 1, others: 0 },
    { label: t('forCandidates.comparison.row8'), shapi: 1, others: 0 },
    { label: t('forCandidates.comparison.row9'), shapi: 1, others: 1 },
    { label: t('forCandidates.comparison.row10'), shapi: 1, others: 1 },
  ]

  return (
    <div className="min-h-screen bg-[#060609] text-[#F4F4F7] overflow-x-hidden">
      <style>{`
        .grad-text {
          background: linear-gradient(135deg, #38BDF8, #34D399);
          background-size: 300% 300%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .card {
          background: #0D0C14;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
          transition: all 0.3s ease;
        }
        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 20px 46px rgba(56, 189, 248, 0.14);
          border-color: rgba(56, 189, 248, 0.28);
        }
        .btn-primary {
          background: linear-gradient(135deg, #38BDF8, #34D399);
          color: #06121a;
          box-shadow: 0 8px 24px rgba(56, 189, 248, 0.28);
          transition: all 0.25s ease;
        }
        .btn-primary:hover { box-shadow: 0 12px 32px rgba(56, 189, 248, 0.42); transform: translateY(-1px); }
        .grad-border-cta {
          background: linear-gradient(#0D0C14,#0D0C14) padding-box, linear-gradient(135deg, #38BDF8, #34D399) border-box;
          border: 1.5px solid transparent; color: #F4F4F7;
          transition: all 0.25s ease;
        }
        .grad-border-cta:hover { box-shadow: 0 8px 24px rgba(56, 189, 248, 0.22); transform: translateY(-1px); }
        .btn-outline {
          background: transparent; border: 1px solid rgba(255,255,255,0.16); color: #F4F4F7;
          transition: all .25s ease;
        }
        .btn-outline:hover { border-color: rgba(157, 140, 255, 0.45); color: #fff; transform: translateY(-1px); }
        .nav-link { color:#A6A6B4; transition: color .2s ease; }
        .nav-link:hover { background: linear-gradient(135deg, #9D8CFF, #34D399); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .shapi-col { background: linear-gradient(180deg, rgba(251,113,133,0.10), rgba(251,113,133,0.02)); }
      `}</style>

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Shared top nav — North Star logo + locked IA */}
      <SiteNav active="candidates" />

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="text-center max-w-4xl mx-auto">
          <span className="mb-6 inline-block rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.25em]" style={{ background: 'rgba(251,113,133,0.12)', color: '#FB7185' }}>
            {t('forCandidates.hero.badge')}
          </span>

          <h1 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tighter mb-6" style={{ color: '#fff' }}>
            A profile that <span className="grad-text">proves</span><br />
            what you can do.
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

          {/* Free hook — blurred-profile preview, no signup required */}
          <p className="mt-5">
            <Link href="/preview" className="text-sm font-bold hover:underline" style={{ color: '#38BDF8' }}>
              ✨ Try it free — see your polished profile in 60 seconds →
            </Link>
          </p>
        </div>
      </section>

      {/* The pitch in 3 panels */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              tag: t('forCandidates.pitch.panel1Tag'),
              color: '#38BDF8',
              title: t('forCandidates.pitch.panel1Title'),
              body: t('forCandidates.pitch.panel1Body'),
            },
            {
              tag: t('forCandidates.pitch.panel2Tag'),
              color: '#34D399',
              title: t('forCandidates.pitch.panel2Title'),
              body: t('forCandidates.pitch.panel2Body'),
            },
            {
              tag: t('forCandidates.pitch.panel3Tag'),
              color: '#FB7185',
              title: t('forCandidates.pitch.panel3Title'),
              body: t('forCandidates.pitch.panel3Body'),
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
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: '#fff' }}>
            {t('forCandidates.usps.title')}
          </h2>
          <p className="text-[#A6A6B4] text-base mt-4 max-w-2xl mx-auto">
            {t('forCandidates.usps.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 items-start">
          {uspGroups.map((g, i) => {
            const isOpen = openGroups.has(i)
            return (
              <div key={i} className="card rounded-2xl p-6">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenGroups((prev) => {
                    const next = new Set(prev)
                    if (next.has(i)) next.delete(i); else next.add(i)
                    return next
                  })}
                  className="flex w-full items-center gap-3 text-left cursor-pointer"
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
                  <h3 className="font-black text-lg" style={{ color: g.color }}>{g.title}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${g.color}1f`, color: g.color }}>{g.items.length}</span>
                  <span className={`ml-auto text-sm transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'rgba(255,255,255,0.4)' }}>▾</span>
                </button>
                {isOpen && (
                  <div className="mt-5 space-y-4">
                    {g.items.map((it, j) => (
                      <div key={j} className="border-t border-white/[0.06] pt-3 first:border-0 first:pt-0">
                        <p className="font-bold text-sm text-[#F4F4F7]">{it.title}</p>
                        <p className="text-sm leading-relaxed text-[#A6A6B4] mt-1">{it.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Comparison table */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5" style={{ background: 'rgba(56,189,248,0.12)', color: '#38BDF8' }}>
            {t('forCandidates.comparison.eyebrow')}
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: '#fff' }}>
            {t('forCandidates.comparison.title')}
          </h2>
        </div>

        <div className="card rounded-3xl p-4 md:p-6 overflow-x-auto max-w-3xl mx-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-start p-3 text-[#7E7E8E] font-bold text-sm uppercase tracking-wider">{t('forCandidates.comparison.colCapability')}</th>
                <th className="p-3">
                  <span className="font-black text-base tracking-tighter" style={{ color: '#34D399' }}>{t('forCandidates.comparison.colShapi')}</span>
                </th>
                <th className="p-3 text-[#7E7E8E] font-bold text-sm">Traditional job boards</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <td className="p-3 text-sm text-[#C7C7D1] font-medium">{row.label}</td>
                  <td className="p-3 text-center shapi-col"><Mark v={row.shapi} /></td>
                  <td className="p-3 text-center"><Mark v={row.others} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center text-xs text-[#7E7E8E] mt-4">
          <span className="font-black" style={{ color: '#34D399' }}>✓</span> {t('forCandidates.comparison.legendIn')} · <span className="font-black text-[#A6A6B4]">~</span> {t('forCandidates.comparison.legendPartial')} · <span className="font-black" style={{ color: '#FB7185' }}>✗</span> {t('forCandidates.comparison.legendOut')}.
        </p>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: '#fff' }}>
            {t('forCandidates.how.title')}
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { step: t('forCandidates.how.step1Number'), color: '#38BDF8', title: t('forCandidates.how.step1Title'), body: t('forCandidates.how.step1Body') },
            { step: t('forCandidates.how.step2Number'), color: '#FB7185', title: t('forCandidates.how.step2Title'), body: t('forCandidates.how.step2Body') },
            { step: t('forCandidates.how.step3Number'), color: '#34D399', title: t('forCandidates.how.step3Title'), body: t('forCandidates.how.step3Body') },
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
          background: 'linear-gradient(135deg, rgba(56,189,248,0.08), rgba(52,211,153,0.06))',
          border: '1px solid rgba(255,255,255,0.10)',
        }}>
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#38BDF8' }}>{t('forCandidates.sources.eyebrow')}</p>
          <p className="text-base md:text-lg text-[#C7C7D1] leading-relaxed">
            {t('forCandidates.sources.body')}
          </p>
        </div>
      </section>

      {/* Pricing tease */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: '#fff' }}>
            <span className="grad-text">Clear</span> pricing.
          </h2>
          <p className="text-[#A6A6B4] text-base mt-3">{t('forCandidates.pricing.subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          {[
            { name: 'Free', price: '$0', sub: '', color: '#38BDF8', body: 'Your verified profile. Verification is always free — for everyone.' },
            { name: 'CV', price: '$25', sub: ' one-time', color: '#34D399', body: 'A polished, verified CV in every language and format that matters — yours to keep.' },
            { name: 'Pro', price: '$59', sub: '/mo', color: '#FB7185', popular: true, body: 'Everything in CV, plus Shapi Active: stay in the matching pool, get surfaced to companies, with daily outreach drafted in your voice.' },
            { name: 'Concierge', price: '$199', sub: '/mo', color: '#FBBF24', body: 'Done for you. We run the applications, outreach and interview prep until you land.' },
          ].map((tier, i) => (
            <div key={i} className="card rounded-2xl p-6 flex flex-col relative" style={tier.popular ? { border: '1px solid rgba(251,113,133,0.4)' } : undefined}>
              {tier.popular && <span className="absolute right-5 top-5 text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,113,133,0.15)', color: '#FB7185' }}>MOST POPULAR</span>}
              <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: tier.color }}>{tier.name}</p>
              <p className="text-3xl font-black text-[#F4F4F7]">{tier.price}<span className="text-sm font-bold text-[#7E7E8E]">{tier.sub}</span></p>
              <p className="text-xs text-[#A6A6B4] leading-relaxed mt-3">{tier.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl text-center py-20 px-8" style={{
          background: '#0D0C14', border: '1px solid rgba(251,113,133,0.20)',
        }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(251,113,133,0.16), transparent 60%)' }} />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-black mb-5 tracking-tighter max-w-3xl mx-auto leading-[1.05]" style={{ color: '#fff' }}>
              Become the candidate companies <span className="grad-text">trust</span> on sight.<br />
              Start shaping what&apos;s <span className="grad-text">next</span>.
            </h2>
            <p className="text-[#A6A6B4] mb-9 text-base max-w-xl mx-auto">
              {t('forCandidates.finalCta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup" className="btn-primary px-8 py-4 rounded-full font-black text-sm">
                {t('forCandidates.finalCta.ctaBuild')}
              </Link>
              <Link href="/ai-proof" className="btn-outline px-8 py-4 rounded-full font-bold text-sm">
                {t('forCandidates.finalCta.ctaAiProof')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Shared footer — North Star logo + full link set */}
      <SiteFooter />
    </div>
  )
}
