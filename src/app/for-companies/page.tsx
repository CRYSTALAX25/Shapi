'use client'

import Link from 'next/link'
import LocalePicker from '@/components/LocalePicker'
import { LocaleProvider, useTranslation } from '@/lib/i18n/LocaleContext'

export default function ForCompaniesPage() {
  return (
    <LocaleProvider>
      <ForCompaniesInner />
    </LocaleProvider>
  )
}

function ForCompaniesInner() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7] overflow-x-hidden">
      <style>{`
        .grad-text {
          background: linear-gradient(135deg, #6AA8F5, #F08CAE, #F58E9A, #6AA8F5);
          background-size: 300% 300%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .btn-primary {
          background: linear-gradient(135deg, #6AA8F5, #F08CAE, #F58E9A);
          color: #fff;
          box-shadow: 0 8px 24px rgba(240,140,174,0.28);
          transition: all 0.25s ease;
        }
        .btn-primary:hover { box-shadow: 0 12px 32px rgba(240,140,174,0.42); transform: translateY(-1px); }
        .btn-outline {
          background: #0B0B0F; color: #F4F4F7;
          border: 1px solid rgba(255,255,255,0.16);
          transition: all .25s ease;
        }
        .btn-outline:hover {
          border-color: rgba(240,140,174,0.4);
          box-shadow: 0 8px 24px rgba(240,140,174,0.18);
          transform: translateY(-1px);
        }
        .card {
          background: #16161F;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
          transition: all 0.3s ease;
        }
        .card:hover {
          transform: translateY(-3px);
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 20px 46px rgba(240,140,174,0.14);
          border-color: rgba(240,140,174,0.28);
        }
        .nav-link { color:#A6A6B4; transition: color .2s ease; }
        .nav-link:hover { color:#F4F4F7; }
      `}</style>

      {/* Dot grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      {/* Top nav */}
      <nav className="relative z-20 border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="font-black text-xl tracking-tighter grad-text">
            shapi
          </Link>
          <div className="flex items-center gap-4 md:gap-6 text-sm">
            <Link href="/" className="nav-link hidden sm:block">
              {t('forCompanies.nav.home')}
            </Link>
            <Link href="/for-candidates" className="nav-link hidden sm:block">
              {t('forCompanies.nav.forCandidates')}
            </Link>
            <Link href="/login" className="nav-link">
              {t('forCompanies.nav.signIn')}
            </Link>
            <LocalePicker />
            <Link
              href="/signup?type=company"
              className="btn-outline rounded-full px-4 py-2 text-xs font-black"
            >
              {t('forCompanies.nav.getStarted')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-20">
        <div className="absolute top-0 left-1/4 w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(106,168,245,0.16) 0%, transparent 70%)' }} />
        <div className="absolute top-10 right-1/4 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(240,140,174,0.14) 0%, transparent 70%)' }} />

        <div className="relative">
          <span className="inline-block text-[11px] font-black tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-7"
            style={{ background: 'rgba(106,168,245,0.12)', color: '#6AA8F5' }}>
            {t('forCompanies.hero.badge')}
          </span>
          <h1 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tighter mb-7"
            style={{ color: '#FB7185' }}>
            {t('forCompanies.hero.headline')}
          </h1>
          <p className="text-lg md:text-xl text-[#C7C7D1] max-w-3xl leading-relaxed mb-10">
            {t('forCompanies.hero.subhead')}
            <span className="block mt-3 text-[#A6A6B4]">
              {t('forCompanies.hero.subheadExtra')}
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-12">
            <Link
              href="/signup?type=company"
              className="btn-primary rounded-full px-7 py-4 text-sm font-black text-center"
            >
              {t('forCompanies.hero.ctaSnapshot')}
            </Link>
            <Link
              href="/book-call?topic=workforce-intelligence"
              className="btn-outline rounded-full px-7 py-4 text-sm font-bold text-center"
            >
              {t('forCompanies.hero.ctaTalk')}
            </Link>
          </div>

          {/* Trusted-by placeholder strip */}
          <div className="pt-8 border-t border-white/[0.06]">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#7E7E8E] mb-4">
              {t('forCompanies.hero.trustedByLabel')}
            </p>
            <div className="flex flex-wrap items-center gap-x-10 gap-y-3 text-[#5C5C6A] text-sm font-bold">
              <span>{t('forCompanies.hero.trusted1')}</span>
              <span>{t('forCompanies.hero.trusted2')}</span>
              <span>{t('forCompanies.hero.trusted3')}</span>
              <span>{t('forCompanies.hero.trusted4')}</span>
              <span>{t('forCompanies.hero.trusted5')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* The pitch — 3 panels */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-3"
            style={{ color: '#FB7185' }}>
            {t('forCompanies.pitch.title')}
          </h2>
          <p className="text-[#A6A6B4] text-lg max-w-2xl mx-auto">
            {t('forCompanies.pitch.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              icon: '🛡️',
              title: t('forCompanies.pitch.p1Title'),
              color: '#6AA8F5',
              desc: t('forCompanies.pitch.p1Desc'),
            },
            {
              icon: '🧠',
              title: t('forCompanies.pitch.p2Title'),
              color: '#F08CAE',
              desc: t('forCompanies.pitch.p2Desc'),
            },
            {
              icon: '⚡',
              title: t('forCompanies.pitch.p3Title'),
              color: '#F58E9A',
              desc: t('forCompanies.pitch.p3Desc'),
            },
          ].map((p) => (
            <div key={p.title} className="card rounded-2xl p-6">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ background: `${p.color}1f` }}
              >
                <span>{p.icon}</span>
              </div>
              <h3 className="font-black text-xl mb-2" style={{ color: p.color }}>
                {p.title}
              </h3>
              <p className="text-[#C7C7D1] text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Every USP mapped */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <span className="inline-block text-[11px] font-black tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-5"
            style={{ background: 'rgba(240,140,174,0.12)', color: '#F08CAE' }}>
            {t('forCompanies.usps.eyebrow')}
          </span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter max-w-3xl"
            style={{ color: '#FB7185' }}>
            {t('forCompanies.usps.title')}
          </h2>
          <p className="text-[#A6A6B4] text-lg mt-4 max-w-2xl">
            {t('forCompanies.usps.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: '📊', title: t('forCompanies.usps.u1Title'), desc: t('forCompanies.usps.u1Desc') },
            { icon: '🎯', title: t('forCompanies.usps.u2Title'), desc: t('forCompanies.usps.u2Desc') },
            { icon: '🛡️', title: t('forCompanies.usps.u3Title'), desc: t('forCompanies.usps.u3Desc') },
            { icon: '🗺️', title: t('forCompanies.usps.u4Title'), desc: t('forCompanies.usps.u4Desc') },
            { icon: '💸', title: t('forCompanies.usps.u5Title'), desc: t('forCompanies.usps.u5Desc') },
            { icon: '📋', title: t('forCompanies.usps.u6Title'), desc: t('forCompanies.usps.u6Desc') },
            { icon: '🏗️', title: t('forCompanies.usps.u7Title'), desc: t('forCompanies.usps.u7Desc') },
            { icon: '🧭', title: t('forCompanies.usps.u8Title'), desc: t('forCompanies.usps.u8Desc') },
            { icon: '🤖', title: t('forCompanies.usps.u9Title'), desc: t('forCompanies.usps.u9Desc') },
            { icon: '📨', title: t('forCompanies.usps.u10Title'), desc: t('forCompanies.usps.u10Desc') },
            { icon: '💬', title: t('forCompanies.usps.u11Title'), desc: t('forCompanies.usps.u11Desc') },
            { icon: '🔗', title: t('forCompanies.usps.u12Title'), desc: t('forCompanies.usps.u12Desc') },
            { icon: '🪞', title: t('forCompanies.usps.u13Title'), desc: t('forCompanies.usps.u13Desc') },
            { icon: '🤝', title: t('forCompanies.usps.u14Title'), desc: t('forCompanies.usps.u14Desc') },
          ].map((u) => (
            <div key={u.title} className="card rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: 'rgba(251,113,133,0.10)' }}
                >
                  <span>{u.icon}</span>
                </div>
                <div>
                  <h3 className="font-black text-base mb-1.5" style={{ color: '#FB7185' }}>
                    {u.title}
                  </h3>
                  <p className="text-[#C7C7D1] text-sm leading-relaxed">{u.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-3"
            style={{ color: '#FB7185' }}>
            {t('forCompanies.comparison.title')}
          </h2>
          <p className="text-[#A6A6B4] text-lg max-w-2xl mx-auto">
            {t('forCompanies.comparison.subtitle')}
          </p>
        </div>

        <div className="card rounded-3xl p-4 md:p-6 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr>
                <th className="text-start p-3 text-[#7E7E8E] font-bold text-sm">{t('forCompanies.comparison.colCapability')}</th>
                <th className="p-3">
                  <div
                    className="inline-flex items-center justify-center rounded-full px-3 py-1"
                    style={{ background: 'rgba(251,113,133,0.14)' }}
                  >
                    <span className="font-black text-base tracking-tighter" style={{ color: '#FB7185' }}>
                      {t('forCompanies.comparison.colShapi')}
                    </span>
                  </div>
                </th>
                {[
                  t('forCompanies.comparison.colWorkday'),
                  t('forCompanies.comparison.colEightfold'),
                  t('forCompanies.comparison.colLinkedinRecruiter'),
                  t('forCompanies.comparison.colMercer'),
                ].map((c) => (
                  <th key={c} className="p-3 text-[#7E7E8E] font-bold text-sm whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                [t('forCompanies.comparison.row1'), '✓', '✗', '~', '✗', '✗'],
                [t('forCompanies.comparison.row2'), '✓', '✗', '~', '✗', '~'],
                [t('forCompanies.comparison.row3'), '✓', '✗', '~', '✗', '~'],
                [t('forCompanies.comparison.row4'), '✓', '~', '~', '✗', '✓'],
                [t('forCompanies.comparison.row5'), '✓', '✗', '✗', '✗', '~'],
                [t('forCompanies.comparison.row6'), '✓', '✗', '~', '✓', '✗'],
                [t('forCompanies.comparison.row7'), '✓', '✗', '✗', '~', '✗'],
                [t('forCompanies.comparison.row8'), '✓', '✗', '✗', '~', '✗'],
              ].map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <td className="p-3 text-sm text-[#C7C7D1] font-medium">{row[0]}</td>
                  {[1, 2, 3, 4, 5].map((col) => {
                    const v = row[col] as string
                    const isShapi = col === 1
                    let color = '#7E7E8E'
                    if (v === '✓') color = isShapi ? '#FB7185' : '#34D399'
                    if (v === '✗') color = '#F58E9A'
                    if (v === '~') color = '#FBBF24'
                    return (
                      <td
                        key={col}
                        className="p-3 text-center font-black text-base"
                        style={{
                          color,
                          background: isShapi ? 'rgba(251,113,133,0.06)' : 'transparent',
                        }}
                      >
                        {v}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-[#7E7E8E] mt-4 px-2">
            <span className="font-bold" style={{ color: '#34D399' }}>✓</span> {t('forCompanies.comparison.legendIn')} ·{' '}
            <span className="font-bold" style={{ color: '#FBBF24' }}>~</span> {t('forCompanies.comparison.legendPartial')} ·{' '}
            <span className="font-bold" style={{ color: '#F58E9A' }}>✗</span> {t('forCompanies.comparison.legendOut')}.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-3"
            style={{ color: '#FB7185' }}>
            {t('forCompanies.how.title')}
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              step: t('forCompanies.how.step1Number'),
              color: '#6AA8F5',
              title: t('forCompanies.how.step1Title'),
              desc: t('forCompanies.how.step1Desc'),
            },
            {
              step: t('forCompanies.how.step2Number'),
              color: '#F08CAE',
              title: t('forCompanies.how.step2Title'),
              desc: t('forCompanies.how.step2Desc'),
            },
            {
              step: t('forCompanies.how.step3Number'),
              color: '#F58E9A',
              title: t('forCompanies.how.step3Title'),
              desc: t('forCompanies.how.step3Desc'),
            },
          ].map((s) => (
            <div key={s.step} className="card rounded-2xl p-7">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-5xl font-black" style={{ color: s.color }}>
                  {s.step}
                </span>
              </div>
              <h3 className="font-black text-xl mb-2">{s.title}</h3>
              <p className="text-[#C7C7D1] text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sourced confidence */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <div
          className="rounded-2xl p-6 md:p-8"
          style={{
            background: 'rgba(106,168,245,0.06)',
            border: '1px solid rgba(106,168,245,0.18)',
          }}
        >
          <p className="text-[11px] font-black tracking-[0.25em] uppercase mb-3" style={{ color: '#6AA8F5' }}>
            {t('forCompanies.sources.eyebrow')}
          </p>
          <p className="text-[#C7C7D1] text-base md:text-lg leading-relaxed">
            {t('forCompanies.sources.body')}
          </p>
        </div>
      </section>

      {/* Pricing tease */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-3"
            style={{ color: '#FB7185' }}>
            {t('forCompanies.pricing.title')}
          </h2>
          <p className="text-[#A6A6B4] text-lg max-w-2xl mx-auto">
            {t('forCompanies.pricing.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              name: t('forCompanies.pricing.t1Name'),
              price: t('forCompanies.pricing.t1Price'),
              color: '#6AA8F5',
              desc: t('forCompanies.pricing.t1Desc'),
              cta: t('forCompanies.pricing.t1Cta'),
              href: '/signup?type=company',
              priceSuffix: '',
              highlight: false,
            },
            {
              name: t('forCompanies.pricing.t2Name'),
              price: t('forCompanies.pricing.t2Price'),
              priceSuffix: t('forCompanies.pricing.t2Suffix'),
              color: '#F08CAE',
              desc: t('forCompanies.pricing.t2Desc'),
              cta: t('forCompanies.pricing.t2Cta'),
              href: '/signup?type=company',
              highlight: true,
            },
            {
              name: t('forCompanies.pricing.t3Name'),
              price: t('forCompanies.pricing.t3Price'),
              priceSuffix: t('forCompanies.pricing.t3Suffix'),
              color: '#F58E9A',
              desc: t('forCompanies.pricing.t3Desc'),
              cta: t('forCompanies.pricing.t3Cta'),
              href: '/signup?type=company',
              highlight: false,
            },
            {
              name: t('forCompanies.pricing.t4Name'),
              price: t('forCompanies.pricing.t4Price'),
              priceSuffix: t('forCompanies.pricing.t4Suffix'),
              color: '#FBBF24',
              desc: t('forCompanies.pricing.t4Desc'),
              cta: t('forCompanies.pricing.t4Cta'),
              href: '/book-call?intent=enterprise',
              highlight: false,
            },
          ].map((tier) => (
            <div
              key={tier.name}
              className="card rounded-2xl p-7 flex flex-col"
              style={
                tier.highlight
                  ? {
                      background: 'linear-gradient(160deg, #1A1622, #16161F)',
                      border: '1px solid rgba(240,140,174,0.3)',
                      boxShadow: '0 20px 50px rgba(240,140,174,0.18)',
                    }
                  : undefined
              }
            >
              <p
                className="text-sm font-bold uppercase tracking-wider mb-2"
                style={{ color: tier.color }}
              >
                {tier.name}
              </p>
              <p className="text-4xl font-black mb-1">{tier.price}</p>
              {tier.priceSuffix && (
                <p className="text-xs text-[#7E7E8E] mb-5">{tier.priceSuffix}</p>
              )}
              {!tier.priceSuffix && <div className="mb-5" />}
              <p className="text-[#C7C7D1] text-sm leading-relaxed mb-7 flex-1">{tier.desc}</p>
              <a
                href={tier.href}
                className={
                  tier.highlight
                    ? 'btn-primary rounded-full py-3 text-center text-sm font-black'
                    : 'btn-outline rounded-full py-3 text-center text-sm font-black'
                }
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div
          className="relative overflow-hidden rounded-3xl text-center py-16 md:py-20 px-8"
          style={{
            background: '#16161F',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 0%, rgba(251,113,133,0.16), transparent 60%)',
            }}
          />
          <div className="relative">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-5"
              style={{ color: '#FB7185' }}>
              {t('forCompanies.finalCta.title')}
            </h2>
            <p className="text-[#A6A6B4] text-lg mb-10 max-w-2xl mx-auto">
              {t('forCompanies.finalCta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/signup?type=company"
                className="btn-primary rounded-full px-8 py-4 font-black text-sm"
              >
                {t('forCompanies.finalCta.ctaSnapshot')}
              </Link>
              <Link
                href="/book-call?topic=workforce-intelligence"
                className="btn-outline rounded-full px-8 py-4 font-bold text-sm"
              >
                {t('forCompanies.finalCta.ctaTalk')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <Link href="/" className="font-black text-xl tracking-tighter grad-text">
            shapi
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#7E7E8E]">
            <Link href="/for-candidates" className="hover:text-[#F4F4F7] transition-colors">
              {t('common.footer.forCandidates')}
            </Link>
            <Link href="/company/pricing" className="hover:text-[#F4F4F7] transition-colors">
              {t('common.footer.companyPricing')}
            </Link>
            <Link href="/privacy" className="hover:text-[#F4F4F7] transition-colors">
              {t('common.footer.privacy')}
            </Link>
            <Link href="/terms" className="hover:text-[#F4F4F7] transition-colors">
              {t('common.footer.terms')}
            </Link>
            <a href="mailto:hello@shapi.io" className="hover:text-[#F4F4F7] transition-colors">
              {t('common.footer.email')}
            </a>
          </div>
          <p className="text-[#5C5C6A] text-sm">{t('common.footer.tagline')}</p>
        </div>
      </footer>
    </div>
  )
}
