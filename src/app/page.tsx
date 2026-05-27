'use client'

import Link from 'next/link'
import ShapiCharacter from '@/components/ShapiCharacter'
import LocalePicker from '@/components/LocalePicker'
import { LocaleProvider, useTranslation } from '@/lib/i18n/LocaleContext'

export default function Home() {
  return (
    <LocaleProvider>
      <HomeInner />
    </LocaleProvider>
  )
}

function HomeInner() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-[#0E0E13] text-[#F4F4F7] overflow-x-hidden">
      <style>{`
        @keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes pulseGlow { 0%,100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.08); } }
        @keyframes floatCard { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        .orb-a { animation: pulseGlow 5s ease-in-out infinite; }
        .orb-b { animation: pulseGlow 6s ease-in-out infinite 1.5s; }
        .orb-c { animation: pulseGlow 7s ease-in-out infinite 3s; }
        .float-card { animation: floatCard 6s ease-in-out infinite; }
        .grad-text {
          background: linear-gradient(135deg, #6AA8F5, #F08CAE, #F58E9A, #6AA8F5);
          background-size: 300% 300%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: gradientShift 6s ease infinite;
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
        /* Black button that turns colourful on hover */
        .btn-dark-hover { background:#0B0B0F; color:#F4F4F7; border:1px solid rgba(255,255,255,0.12); transition: all .25s ease; }
        .btn-dark-hover:hover { background: linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A); color:#fff; border-color:transparent; box-shadow:0 12px 32px rgba(240,140,174,0.34); transform: translateY(-1px); }
        /* Back-illuminate on hover (for cards that have their own background) */
        .card-hover { transition: all .3s ease; }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 22px 48px rgba(240,140,174,0.20); border-color: rgba(240,140,174,0.32); }
        /* Nav links go colourful (gradient text) on hover */
        .nav-link { color:#A6A6B4; transition: color .2s ease; }
        .nav-link:hover { background: linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
      `}</style>

      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* Nav — floating pill island */}
      <nav className="relative z-20 px-4 pt-5 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-3 rounded-full ps-4 pe-2 py-2" style={{ background: 'rgba(22,22,31,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
          <div className="flex items-center gap-2">
            <ShapiCharacter size={30} />
            <span className="font-black text-xl tracking-tighter grad-text">shapi</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/ai-proof" className="nav-link text-sm hidden md:block">{t('common.nav.aiRiskCheck')}</Link>
            <Link href="/worth" className="nav-link text-sm hidden md:block">{t('common.nav.worth')}</Link>
            <Link href="#why" className="nav-link text-sm hidden md:block">{t('common.nav.whyShapi')}</Link>
            <Link href="#pricing" className="nav-link text-sm hidden sm:block">{t('common.nav.pricing')}</Link>
            <Link href="/blog" className="nav-link text-sm hidden sm:block">{t('common.nav.blog')}</Link>
            <Link href="/for-companies" className="nav-link text-sm hidden md:block">{t('common.nav.forCompanies')}</Link>
            <Link href="/login" className="nav-link text-sm">{t('common.nav.signIn')}</Link>
            <LocalePicker />
            <Link href="/signup" className="grad-border-cta px-4 py-2 rounded-full text-sm font-black">{t('common.nav.getStarted')}</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-12">
        <div className="orb-a absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(106,168,245,0.18) 0%, transparent 70%)' }} />
        <div className="orb-b absolute top-10 right-1/4 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(240,140,174,0.16) 0%, transparent 70%)' }} />
        <div className="orb-c absolute -bottom-20 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(245,142,154,0.14) 0%, transparent 70%)' }} />

        <div className="text-center max-w-5xl mx-auto">
          <div className="flex justify-center mb-5"><ShapiCharacter size={76} mood="happy" /></div>
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#6AA8F5] animate-pulse" />
            <span className="text-[#A6A6B4] text-xs font-medium">{t('home.hero.badgeDate')}</span>
            <span className="text-white/15">·</span>
            <span className="text-xs font-bold" style={{ color: '#F08CAE' }}>{t('home.hero.badgeAccess')}</span>
          </div>

          {/* Audience chooser — like Stripe/Zapier's gateway. Candidates land
              on this homepage by default; companies tap through to the dedicated
              workforce-intelligence page. */}
          <div className="flex flex-wrap justify-center gap-2 mb-8 text-xs font-bold">
            <span className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(240,140,174,0.15)', color: '#F08CAE', border: '1px solid rgba(240,140,174,0.30)' }}>
              {t('home.chooser.candidate')}
            </span>
            <Link href="/for-companies" className="px-3 py-1.5 rounded-full hover:bg-white/[0.06] transition-colors" style={{ color: '#A6A6B4', border: '1px solid rgba(255,255,255,0.10)' }}>
              {t('home.chooser.company')}
            </Link>
          </div>

          <h1 className="text-6xl md:text-[88px] font-black leading-[0.92] tracking-tighter mb-7">
            <span className="block">{t('home.hero.headlineLine1')}</span>
            <span className="block grad-text">{t('home.hero.headlineLine2')}</span>
          </h1>

          <p className="text-lg md:text-xl text-[#A6A6B4] max-w-2xl mx-auto leading-relaxed mb-10">
            {t('home.hero.subhead')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link href="/signup" className="btn-dark-hover px-8 py-4 rounded-full text-sm font-black">
              {t('home.hero.ctaBuild')}
            </Link>
            <Link href="/signup" className="btn-dark-hover px-8 py-4 rounded-full text-sm font-bold">
              {t('home.hero.ctaHire')}
            </Link>
          </div>

          {/* Floating verified-profile card — the real product, 2 clean chips up top */}
          <div className="relative max-w-md mx-auto">
            <div className="hidden lg:block">
              <FloatChip text={t('home.hero.chipRefs')} color="#6AA8F5" pos="-left-28 top-2" />
              <FloatChip text={t('home.hero.chipCrossCheck')} color="#F08CAE" pos="-right-28 top-8" />
            </div>
            <div className="float-card">
            <div className="card rounded-2xl p-6 text-start">
              {/* identity */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)' }}>A</div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-black text-[#F4F4F7]">{t('home.hero.cardName')}</div>
                  <div className="text-xs text-[#7E7E8E]">{t('home.hero.cardRole')}</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6AA8F5]/15 text-[#6AA8F5] flex-shrink-0">{t('home.hero.cardVerifiedBadge')}</span>
              </div>
              {/* profile strength — the one vibrant pop */}
              <div className="flex items-center gap-3 mb-4">
                <div className="text-2xl font-black" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>94%</div>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-full" style={{ width: '94%', background: 'linear-gradient(90deg,#6AA8F5,#F08CAE,#F58E9A)' }} />
                  </div>
                  <p className="text-[#7E7E8E] text-[10px] mt-1">{t('home.hero.cardScoreLabel')}</p>
                </div>
              </div>
              {/* the USPs — what Shapi verifies that no one else does */}
              <div className="space-y-2.5">
                {[
                  [t('home.hero.cardItem1Label'), t('home.hero.cardItem1Sub')],
                  [t('home.hero.cardItem2Label'), t('home.hero.cardItem2Sub')],
                  [t('home.hero.cardItem3Label'), t('home.hero.cardItem3Sub')],
                  [t('home.hero.cardItem4Label'), t('home.hero.cardItem4Sub')],
                  [t('home.hero.cardItem5Label'), t('home.hero.cardItem5Sub')],
                ].map(([label, sub], i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(106,168,245,0.14)' }}>
                      <svg className="w-3 h-3 text-[#6AA8F5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </span>
                    <div className="min-w-0 text-xs">
                      <span className="font-bold text-[#F4F4F7]">{label}</span>
                      <span className="text-[#7E7E8E]"> — {sub}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* footer — two-sided trust */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.08]">
                <span className="text-xs text-[#7E7E8E]">{t('home.hero.cardFooterText')}</span>
                <span className="text-xs font-black" style={{ color: '#6AA8F5' }}>{t('home.hero.cardFooterTrust')}</span>
              </div>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 py-12 my-4" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[
            { n: t('home.stats.stat1Number'), label: t('home.stats.stat1Label'), color: '#6AA8F5' },
            { n: t('home.stats.stat2Number'), label: t('home.stats.stat2Label'), color: '#F08CAE' },
            { n: t('home.stats.stat3Number'), label: t('home.stats.stat3Label'), color: '#F58E9A' },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-4xl md:text-5xl font-black mb-1.5" style={{ color: s.color }}>{s.n}</p>
              <p className="text-[#A6A6B4] text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5" style={{ background: 'rgba(106,168,245,0.12)', color: '#6AA8F5' }}>
            {t('home.how.eyebrow')}
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">
            {t('home.how.titleLine1')}<br />{t('home.how.titleLine2')}
          </h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-5">
          {[
            { step: t('home.how.step1Number'), title: t('home.how.step1Title'), desc: t('home.how.step1Desc'), color: '#6AA8F5',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
            { step: t('home.how.step2Number'), title: t('home.how.step2Title'), desc: t('home.how.step2Desc'), color: '#F08CAE',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> },
            { step: t('home.how.step3Number'), title: t('home.how.step3Title'), desc: t('home.how.step3Desc'), color: '#F58E9A',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /> },
          ].map((item, i) => (
            <div key={i} className="card rounded-2xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}30`, color: item.color }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{item.icon}</svg>
                </div>
                <span className="text-5xl font-black" style={{ color: item.color }}>{item.step}</span>
              </div>
              <h3 className="text-lg font-bold mb-3">{item.title}</h3>
              <p className="text-[#A6A6B4] text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Shapi — comparison table */}
      <section id="why" className="relative z-10 max-w-5xl mx-auto px-6 py-24 scroll-mt-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5" style={{ background: 'rgba(240,140,174,0.12)', color: '#F08CAE' }}>
            {t('home.comparison.eyebrow')}
          </div>
          <h2 className="text-5xl md:text-6xl font-black tracking-tighter">{t('home.comparison.title')}</h2>
          <p className="text-[#A6A6B4] text-lg mt-4 max-w-2xl mx-auto">{t('home.comparison.subtitle')}</p>
        </div>

        <div className="card rounded-3xl p-4 md:p-6 overflow-x-auto">
          <table className="w-full min-w-[660px] border-collapse">
            <thead>
              <tr>
                <th className="text-start p-3"></th>
                <th className="p-3">
                  <div className="flex flex-col items-center gap-1.5">
                    <ShapiCharacter size={40} mood="happy" />
                    <span className="grad-text font-black text-base tracking-tighter">shapi</span>
                  </div>
                </th>
                {[t('home.comparison.colLinkedin'), t('home.comparison.colJobBoards'), t('home.comparison.colRecruiters')].map(c => (
                  <th key={c} className="p-3 text-[#7E7E8E] font-bold text-sm">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                [t('home.comparison.row1'), true, false, false, false],
                [t('home.comparison.row2'), true, false, false, false],
                [t('home.comparison.row3'), true, false, false, false],
                [t('home.comparison.row4'), true, false, false, false],
                [t('home.comparison.row5'), true, false, false, false],
                [t('home.comparison.row6'), true, false, false, false],
                [t('home.comparison.row7'), true, false, false, false],
                [t('home.comparison.row8'), true, false, false, false],
                [t('home.comparison.row9'), true, false, false, false],
                [t('home.comparison.row10'), true, false, false, false],
                [t('home.comparison.row11'), true, false, false, false],
                [t('home.comparison.row12'), true, true, true, false],
              ].map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <td className="p-3 text-sm text-[#C7C7D1] font-medium">{row[0] as string}</td>
                  {[1, 2, 3, 4].map(col => (
                    <td key={col} className="p-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full" style={{
                        background: row[col] ? 'rgba(106,168,245,0.15)' : 'rgba(245,142,154,0.12)',
                      }}>
                        {row[col]
                          ? <svg className="w-3.5 h-3.5" style={{ color: '#6AA8F5' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          : <svg className="w-3.5 h-3.5" style={{ color: '#F58E9A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>}
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
          background: 'linear-gradient(135deg, rgba(106,168,245,0.10) 0%, rgba(240,140,174,0.06) 50%, rgba(245,142,154,0.08) 100%)',
          border: '1px solid rgba(240,140,174,0.16)',
        }}>
          <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(240,140,174,0.12) 0%, transparent 70%)' }} />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-8" style={{ background: 'rgba(240,140,174,0.12)', color: '#F08CAE' }}>
              {t('home.manifesto.eyebrow')}
            </div>
            <div className="space-y-5 text-[#C7C7D1] text-lg leading-relaxed">
              <p>{t('home.manifesto.p1')}</p>
              <p>{t('home.manifesto.p2')}</p>
              <p className="text-[#F4F4F7] font-bold text-xl">{t('home.manifesto.p3')}</p>
              <p className="font-semibold" style={{ color: '#F58E9A' }}>{t('home.manifesto.p4')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5" style={{ background: 'rgba(255,255,255,0.06)', color: '#A6A6B4' }}>
            {t('home.differentiators.eyebrow')}
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">{t('home.differentiators.title')}</h2>
          <p className="text-[#A6A6B4] text-lg mt-4 max-w-2xl mx-auto">{t('home.differentiators.subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: t('home.differentiators.item1Title'), tag: t('home.differentiators.item1Tag'), color: '#6AA8F5', desc: t('home.differentiators.item1Desc'),
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
            { title: t('home.differentiators.item2Title'), tag: t('home.differentiators.item2Tag'), color: '#F08CAE', desc: t('home.differentiators.item2Desc'),
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /> },
            { title: t('home.differentiators.item3Title'), tag: t('home.differentiators.item3Tag'), color: '#F58E9A', desc: t('home.differentiators.item3Desc'),
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /> },
            { title: t('home.differentiators.item4Title'), tag: t('home.differentiators.item4Tag'), color: '#6AA8F5', desc: t('home.differentiators.item4Desc'),
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
            { title: t('home.differentiators.item5Title'), tag: t('home.differentiators.item5Tag'), color: '#F08CAE', desc: t('home.differentiators.item5Desc'),
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
            { title: t('home.differentiators.item6Title'), tag: t('home.differentiators.item6Tag'), color: '#F58E9A', desc: t('home.differentiators.item6Desc'),
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /> },
          ].map((item, i) => (
            <div key={i} className="card rounded-2xl p-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}1f`, color: item.color }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{item.icon}</svg>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${item.color}1a`, color: item.color }}>{item.tag}</span>
              </div>
              <h3 className="font-bold mb-2">{item.title}</h3>
              <p className="text-[#A6A6B4] text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Career navigation — more than verification */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5" style={{ background: 'rgba(244,114,182,0.12)', color: '#F08CAE' }}>
            {t('home.careerNav.eyebrow')}
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">{t('home.careerNav.title')}</h2>
          <p className="text-[#A6A6B4] text-lg mt-4 max-w-2xl mx-auto">{t('home.careerNav.subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            { href: '/translate', tag: t('home.careerNav.item1Tag'), color: '#6AA8F5', title: t('home.careerNav.item1Title'), desc: t('home.careerNav.item1Desc') },
            { href: '/ai-proof', tag: t('home.careerNav.item2Tag'), color: '#F08CAE', title: t('home.careerNav.item2Title'), desc: t('home.careerNav.item2Desc') },
            { href: '/course-wallet', tag: t('home.careerNav.item3Tag'), color: '#F58E9A', title: t('home.careerNav.item3Title'), desc: t('home.careerNav.item3Desc') },
            { href: '/worth', tag: t('home.careerNav.item4Tag'), color: '#6AA8F5', title: t('home.careerNav.item4Title'), desc: t('home.careerNav.item4Desc') },
          ].map((item, i) => (
            <Link key={i} href={item.href} className="card rounded-2xl p-7 block">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${item.color}1a`, color: item.color }}>{item.tag}</span>
              <h3 className="font-black text-lg mt-3 mb-2">{item.title}</h3>
              <p className="text-[#A6A6B4] text-sm leading-relaxed">{item.desc}</p>
              <span className="inline-block mt-3 text-sm font-bold" style={{ color: item.color }}>{t('home.careerNav.ctaTry')}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 max-w-6xl mx-auto px-6 pb-24 scroll-mt-20">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-5" style={{ background: 'rgba(106,168,245,0.12)', color: '#6AA8F5' }}>
            {t('home.pricing.eyebrow')}
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">{t('home.pricing.title')}</h2>
        </div>

        {/* Candidates */}
        <div className="mb-6 flex items-center gap-3">
          <h3 className="text-xl font-black">{t('home.pricing.candidatesTitle')}</h3>
          <span className="text-[#7E7E8E] text-sm">{t('home.pricing.candidatesSub')}</span>
        </div>
        <div className="grid md:grid-cols-3 gap-5 mb-6">
          {/* Free */}
          <div className="card rounded-2xl p-7 flex flex-col">
            <p className="text-sm font-bold text-[#7E7E8E] uppercase tracking-wider mb-2">{t('home.pricing.freeName')}</p>
            <p className="text-4xl font-black mb-1">{t('home.pricing.freePrice')}</p>
            <p className="text-[#7E7E8E] text-sm mb-6">{t('home.pricing.freeSub')}</p>
            <ul className="space-y-2.5 text-sm text-[#C7C7D1] mb-7 flex-1">
              {[t('home.pricing.freeF1'), t('home.pricing.freeF2'), t('home.pricing.freeF3'), t('home.pricing.freeF4')].map((f, i) => (
                <li key={i} className="flex gap-2.5"><Check c="#6AA8F5" />{f}</li>
              ))}
            </ul>
            <Link href="/signup" className="rounded-full py-3 text-center text-sm font-bold text-[#F4F4F7]" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>{t('home.pricing.freeCta')}</Link>
          </div>

          {/* CV Pro — highlighted */}
          <div className="card-hover rounded-2xl p-7 flex flex-col relative" style={{ background: 'linear-gradient(160deg, #1A1622, #16161F)', border: '1px solid rgba(240,140,174,0.3)', boxShadow: '0 20px 50px rgba(240,140,174,0.18)' }}>
            <span className="absolute top-5 right-5 text-[10px] font-black px-2.5 py-1 rounded-full text-white" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)' }}>{t('home.pricing.proBadge')}</span>
            <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: '#F08CAE' }}>{t('home.pricing.proName')}</p>
            <p className="text-4xl font-black mb-1">{t('home.pricing.proPrice')} <span className="text-base font-bold text-[#7E7E8E]">{t('home.pricing.proPriceSuffix')}</span></p>
            <p className="text-[#A6A6B4] text-sm mb-6">{t('home.pricing.proSub')}</p>
            <ul className="space-y-2.5 text-sm text-[#C7C7D1] mb-7 flex-1">
              {[t('home.pricing.proF1'), t('home.pricing.proF2'), t('home.pricing.proF3'), t('home.pricing.proF4'), t('home.pricing.proF5')].map((f, i) => (
                <li key={i} className="flex gap-2.5"><Check c="#6AA8F5" />{f}</li>
              ))}
            </ul>
            <Link href="/signup" className="btn-primary rounded-full py-3 text-center text-sm font-black">{t('home.pricing.proCta')}</Link>
          </div>

          {/* CV Kit */}
          <div className="card rounded-2xl p-7 flex flex-col">
            <p className="text-sm font-bold text-[#7E7E8E] uppercase tracking-wider mb-2">{t('home.pricing.kitName')}</p>
            <p className="text-4xl font-black mb-1">{t('home.pricing.kitPrice')} <span className="text-base font-bold text-[#7E7E8E]">{t('home.pricing.kitPriceSuffix')}</span></p>
            <p className="text-[#7E7E8E] text-sm mb-6">{t('home.pricing.kitSub')}</p>
            <ul className="space-y-2.5 text-sm text-[#C7C7D1] mb-7 flex-1">
              {[t('home.pricing.kitF1'), t('home.pricing.kitF2'), t('home.pricing.kitF3'), t('home.pricing.kitF4')].map((f, i) => (
                <li key={i} className="flex gap-2.5"><Check c="#F08CAE" />{f}</li>
              ))}
            </ul>
            <Link href="/signup" className="rounded-full py-3 text-center text-sm font-bold text-[#F4F4F7]" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>{t('home.pricing.kitCta')}</Link>
          </div>
        </div>

        {/* Candidate add-ons */}
        <div className="rounded-2xl p-6 mb-16" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-sm font-bold mb-1">{t('home.pricing.addonsTitle')}</p>
          <p className="text-[#7E7E8E] text-sm mb-4">{t('home.pricing.addonsSub')}</p>
          <div className="flex flex-wrap gap-3">
            {[
              { n: t('home.pricing.addon1Name'), p: t('home.pricing.addon1Price'), c: '#6AA8F5' },
              { n: t('home.pricing.addon2Name'), p: t('home.pricing.addon2Price'), c: '#F08CAE' },
              { n: t('home.pricing.addon3Name'), p: t('home.pricing.addon3Price'), c: '#6AA8F5' },
              { n: t('home.pricing.addon4Name'), p: t('home.pricing.addon4Price'), c: '#F58E9A' },
            ].map((a, i) => (
              <div key={i} className="card-hover rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="text-sm font-bold">{a.n}</span>
                <span className="text-sm font-black" style={{ color: a.c }}>{a.p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Companies */}
        <div className="mb-2 flex items-center gap-3">
          <h3 className="text-xl font-black">{t('home.pricing.companiesTitle')}</h3>
          <span className="text-[#7E7E8E] text-sm">{t('home.pricing.companiesSub')}</span>
        </div>
        <p className="text-sm font-bold mb-6" style={{ color: '#F08CAE' }}>{t('home.pricing.foundingBadge')}</p>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { name: t('home.pricing.tierStarterName'), standard: t('home.pricing.tierStarterStandard'), founding: t('home.pricing.tierStarterFounding'), per: t('home.pricing.tierStarterPer'), custom: false, popular: false, color: '#6AA8F5',
              features: [t('home.pricing.tierStarterF1'), t('home.pricing.tierStarterF2'), t('home.pricing.tierStarterF3'), t('home.pricing.tierStarterF4')] },
            { name: t('home.pricing.tierGrowthName'), standard: t('home.pricing.tierGrowthStandard'), founding: t('home.pricing.tierGrowthFounding'), per: t('home.pricing.tierGrowthPer'), custom: false, popular: true, color: '#F08CAE',
              features: [t('home.pricing.tierGrowthF1'), t('home.pricing.tierGrowthF2'), t('home.pricing.tierGrowthF3'), t('home.pricing.tierGrowthF4'), t('home.pricing.tierGrowthF5')] },
            { name: t('home.pricing.tierEnterpriseName'), standard: '', founding: t('home.pricing.tierEnterpriseFounding'), per: '', custom: true, popular: false, color: '#F58E9A',
              features: [t('home.pricing.tierEnterpriseF1'), t('home.pricing.tierEnterpriseF2'), t('home.pricing.tierEnterpriseF3'), t('home.pricing.tierEnterpriseF4'), t('home.pricing.tierEnterpriseF5')] },
          ].map((tier, i) => (
            <div key={i} className="card-hover rounded-2xl p-7 flex flex-col"
              style={tier.popular ? { background: 'linear-gradient(160deg, #1A1622, #16161F)', border: '1px solid rgba(240,140,174,0.3)', boxShadow: '0 20px 50px rgba(240,140,174,0.18)' } : { background: '#16161F', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold uppercase tracking-wider" style={{ color: tier.popular ? '#F08CAE' : '#7E7E8E' }}>{tier.name}</p>
                {tier.popular && <span className="text-[10px] font-black px-2.5 py-1 rounded-full text-white" style={{ background: 'linear-gradient(135deg,#6AA8F5,#F08CAE)' }}>{t('home.pricing.tierGrowthBadge')}</span>}
              </div>
              {tier.custom ? (
                <p className="text-4xl font-black mb-6">{tier.founding}</p>
              ) : (
                <div className="mb-6">
                  <p className="text-4xl font-black">{tier.founding}<span className="text-base font-bold text-[#7E7E8E]">{tier.per}</span></p>
                  <p className="text-xs mt-1 text-[#7E7E8E]">
                    <span className="line-through">{tier.standard}{tier.per}</span> {t('home.pricing.ctaStandard')}
                  </p>
                </div>
              )}
              <ul className="space-y-2.5 text-sm mb-7 flex-1 text-[#C7C7D1]">
                {tier.features.map((f, j) => (
                  <li key={j} className="flex gap-2.5"><Check c={tier.color} />{f}</li>
                ))}
              </ul>
              <Link href="/signup" className={`rounded-full py-3 text-center text-sm font-black ${tier.popular ? 'btn-primary text-white' : 'text-[#F4F4F7]'}`} style={tier.popular ? undefined : { border: '1px solid rgba(255,255,255,0.12)' }}>
                {tier.custom ? t('home.pricing.ctaTalk') : t('home.pricing.ctaTrial')}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-[#7E7E8E] text-sm mt-6">
          {t('home.pricing.tierFootnote')}
        </p>
      </section>

      {/* FAQ */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">{t('home.faq.title')}</h2>
        </div>
        <div className="space-y-3">
          {[
            { q: t('home.faq.q1'), a: t('home.faq.a1') },
            { q: t('home.faq.q2'), a: t('home.faq.a2') },
            { q: t('home.faq.q3'), a: t('home.faq.a3') },
            { q: t('home.faq.q4'), a: t('home.faq.a4') },
            { q: t('home.faq.q5'), a: t('home.faq.a5') },
            { q: t('home.faq.q6'), a: t('home.faq.a6') },
          ].map((f, i) => (
            <details key={i} className="group card rounded-2xl px-5 py-4">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="font-bold text-[#F4F4F7] pe-4">{f.q}</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[#F08CAE] transition-transform group-open:rotate-45" style={{ background: 'rgba(240,140,174,0.12)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                </span>
              </summary>
              <p className="text-[#A6A6B4] text-sm leading-relaxed mt-3">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl text-center py-20 px-8" style={{
          background: '#16161F', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(106,168,245,0.14), transparent 60%)' }} />
          <div className="relative">
            <h2 className="text-5xl md:text-6xl font-black grad-text mb-4 tracking-tighter">{t('home.finalCta.title')}</h2>
            <p className="text-[#A6A6B4] mb-10 text-base">{t('home.finalCta.subtitle')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup" className="btn-dark-hover px-8 py-4 rounded-full font-black text-sm">
                {t('home.finalCta.ctaBuild')}
              </Link>
              <Link href="/signup" className="btn-dark-hover px-8 py-4 rounded-full font-bold text-sm">
                {t('home.finalCta.ctaHire')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <span className="font-black text-xl tracking-tighter grad-text">shapi</span>
          <div className="flex items-center gap-6 text-sm text-[#7E7E8E]">
            <Link href="/worth" className="hover:text-[#F4F4F7] transition-colors">{t('common.footer.worth')}</Link>
            <Link href="#pricing" className="hover:text-[#F4F4F7] transition-colors">{t('common.footer.pricing')}</Link>
            <Link href="/blog" className="hover:text-[#F4F4F7] transition-colors">{t('common.footer.blog')}</Link>
            <Link href="/privacy" className="hover:text-[#F4F4F7] transition-colors">{t('common.footer.privacy')}</Link>
            <Link href="/terms" className="hover:text-[#F4F4F7] transition-colors">{t('common.footer.terms')}</Link>
            <a href="mailto:hello@shapi.io" className="hover:text-[#F4F4F7] transition-colors">{t('common.footer.email')}</a>
          </div>
          <p className="text-[#5C5C6A] text-sm">{t('common.footer.tagline')}</p>
        </div>
      </footer>
    </div>
  )
}

function FloatChip({ text, color, pos }: { text: string; color: string; pos: string }) {
  return (
    <div className={`float-card absolute z-20 ${pos} rounded-full pl-2 pr-3 py-1.5 flex items-center gap-2 whitespace-nowrap`}
      style={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs font-bold text-[#C7C7D1]">{text}</span>
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
