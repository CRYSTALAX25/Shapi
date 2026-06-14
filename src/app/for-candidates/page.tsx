'use client'

import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import SiteFooter from '@/components/SiteFooter'
import { LocaleProvider, useTranslation } from '@/lib/i18n/LocaleContext'

type Score = 1 | 0 | 0.5

function Mark({ v }: { v: 1 | 0 | 0.5 }) {
  if (v === 1) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full" style={{ background: 'rgba(157, 140, 255, 0.15)' }}>
        <svg className="w-3.5 h-3.5" style={{ color: '#9D8CFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  const usps: Array<{ icon: string; title: string; body: string }> = [
    { icon: '✓', title: t('forCandidates.usps.u1Title'), body: t('forCandidates.usps.u1Body') },
    { icon: '🛡', title: t('forCandidates.usps.u2Title'), body: t('forCandidates.usps.u2Body') },
    { icon: '🧭', title: t('forCandidates.usps.u3Title'), body: t('forCandidates.usps.u3Body') },
    { icon: '💸', title: t('forCandidates.usps.u4Title'), body: t('forCandidates.usps.u4Body') },
    { icon: '🗺', title: t('forCandidates.usps.u5Title'), body: t('forCandidates.usps.u5Body') },
    { icon: '📚', title: t('forCandidates.usps.u6Title'), body: t('forCandidates.usps.u6Body') },
    { icon: '💼', title: t('forCandidates.usps.u7Title'), body: t('forCandidates.usps.u7Body') },
    { icon: '✦', title: t('forCandidates.usps.u8Title'), body: t('forCandidates.usps.u8Body') },
    { icon: '🎙', title: t('forCandidates.usps.u9Title'), body: t('forCandidates.usps.u9Body') },
    { icon: '💬', title: t('forCandidates.usps.u10Title'), body: t('forCandidates.usps.u10Body') },
    { icon: '🛰', title: t('forCandidates.usps.u11Title'), body: t('forCandidates.usps.u11Body') },
    { icon: '✉', title: t('forCandidates.usps.u12Title'), body: t('forCandidates.usps.u12Body') },
    { icon: '🌱', title: t('forCandidates.usps.u13Title'), body: t('forCandidates.usps.u13Body') },
    { icon: '📄', title: t('forCandidates.usps.u14Title'), body: t('forCandidates.usps.u14Body') },
    { icon: '🔧', title: t('forCandidates.usps.u15Title'), body: t('forCandidates.usps.u15Body') },
  ]

  const comparisonRows: Array<{ label: string; shapi: Score; linkedin: Score; indeed: Score; glassdoor: Score; jackjill: Score; bayt: Score; gulftalent: Score }> = [
    { label: t('forCandidates.comparison.row1'), shapi: 1, linkedin: 0, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0, gulftalent: 0 },
    { label: t('forCandidates.comparison.row2'), shapi: 1, linkedin: 0, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0, gulftalent: 0 },
    { label: t('forCandidates.comparison.row3'), shapi: 1, linkedin: 0.5, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0, gulftalent: 0 },
    { label: t('forCandidates.comparison.row4'), shapi: 1, linkedin: 0, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0, gulftalent: 0 },
    { label: t('forCandidates.comparison.row5'), shapi: 1, linkedin: 0, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0.5, gulftalent: 0 },
    { label: t('forCandidates.comparison.row6'), shapi: 1, linkedin: 0.5, indeed: 1, glassdoor: 0.5, jackjill: 0, bayt: 1, gulftalent: 0 },
    { label: t('forCandidates.comparison.row7'), shapi: 1, linkedin: 0, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0, gulftalent: 0 },
    { label: t('forCandidates.comparison.row8'), shapi: 1, linkedin: 0, indeed: 0, glassdoor: 0, jackjill: 0, bayt: 0, gulftalent: 0 },
    { label: t('forCandidates.comparison.row9'), shapi: 1, linkedin: 0.5, indeed: 0.5, glassdoor: 1, jackjill: 0.5, bayt: 0.5, gulftalent: 0 },
    { label: t('forCandidates.comparison.row10'), shapi: 1, linkedin: 0.5, indeed: 0.5, glassdoor: 0, jackjill: 0, bayt: 1, gulftalent: 1 },
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ background: 'rgba(251,113,133,0.10)', border: '1px solid rgba(251,113,133,0.25)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#FB7185' }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#FB7185' }}>{t('forCandidates.hero.badge')}</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tighter mb-6" style={{ color: '#fff' }}>
            {t('forCandidates.hero.headlineLine1')}<br />
            <span className="grad-text">{t('forCandidates.hero.headlineLine2')}</span>
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
            <Link href="/preview" className="text-sm font-bold hover:underline" style={{ color: '#9D8CFF' }}>
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

        <div className="grid md:grid-cols-2 gap-4">
          {usps.map((u, i) => {
            const c = ['#38BDF8', '#34D399', '#FB7185', '#FBBF24'][i % 4]
            return (
              <div key={i} className="card rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-base" style={{ background: `${c}1f`, color: c }}>
                    {u.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-base mb-1.5" style={{ color: c }}>{u.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#C7C7D1' }}>{u.body}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Comparison table */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5" style={{ background: 'rgba(157, 140, 255, 0.12)', color: '#9D8CFF' }}>
            {t('forCandidates.comparison.eyebrow')}
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: '#fff' }}>
            {t('forCandidates.comparison.title')}
          </h2>
        </div>

        <div className="card rounded-3xl p-4 md:p-6 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr>
                <th className="text-start p-3 text-[#7E7E8E] font-bold text-sm uppercase tracking-wider">{t('forCandidates.comparison.colCapability')}</th>
                <th className="p-3">
                  <span className="font-black text-base tracking-tighter" style={{ color: '#FB7185' }}>{t('forCandidates.comparison.colShapi')}</span>
                </th>
                {[
                  t('forCandidates.comparison.colLinkedin'),
                  t('forCandidates.comparison.colIndeed'),
                  t('forCandidates.comparison.colBayt'),
                  t('forCandidates.comparison.colGlassdoor'),
                  t('forCandidates.comparison.colGulftalent'),
                  t('forCandidates.comparison.colJackJill'),
                ].map(c => (
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
          <span className="font-black" style={{ color: '#9D8CFF' }}>✓</span> {t('forCandidates.comparison.legendIn')} · <span className="font-black text-[#A6A6B4]">~</span> {t('forCandidates.comparison.legendPartial')} · <span className="font-black" style={{ color: '#FB7185' }}>✗</span> {t('forCandidates.comparison.legendOut')}.
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
          background: 'linear-gradient(135deg, rgba(157, 140, 255, 0.08), rgba(251,113,133,0.06))',
          border: '1px solid rgba(255,255,255,0.10)',
        }}>
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#9D8CFF' }}>{t('forCandidates.sources.eyebrow')}</p>
          <p className="text-base md:text-lg text-[#C7C7D1] leading-relaxed">
            {t('forCandidates.sources.body')}
          </p>
        </div>
      </section>

      {/* Pricing tease */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: '#fff' }}>
            {t('forCandidates.pricing.title')}
          </h2>
          <p className="text-[#A6A6B4] text-base mt-3">{t('forCandidates.pricing.subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-5 gap-3">
          {[
            { name: t('forCandidates.pricing.t1Name'), price: t('forCandidates.pricing.t1Price'), body: t('forCandidates.pricing.t1Body'), color: '#38BDF8' },
            { name: t('forCandidates.pricing.t2Name'), price: t('forCandidates.pricing.t2Price'), body: t('forCandidates.pricing.t2Body'), color: '#34D399' },
            { name: t('forCandidates.pricing.t3Name'), price: t('forCandidates.pricing.t3Price'), body: t('forCandidates.pricing.t3Body'), color: '#FB7185' },
            { name: t('forCandidates.pricing.t4Name'), price: t('forCandidates.pricing.t4Price'), body: t('forCandidates.pricing.t4Body'), color: '#FBBF24' },
            { name: t('forCandidates.pricing.t5Name'), price: t('forCandidates.pricing.t5Price'), body: t('forCandidates.pricing.t5Body'), color: '#38BDF8' },
          ].map((tier, i) => (
            <div key={i} className="card rounded-2xl p-5">
              <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: tier.color }}>{tier.name}</p>
              <p className="text-2xl font-black mb-2 text-[#F4F4F7]">{tier.price}</p>
              <p className="text-xs text-[#A6A6B4] leading-relaxed">{tier.body}</p>
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
            <h2 className="text-4xl md:text-6xl font-black mb-5 tracking-tighter max-w-3xl mx-auto" style={{ color: '#fff' }}>
              {t('forCandidates.finalCta.title')}
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
