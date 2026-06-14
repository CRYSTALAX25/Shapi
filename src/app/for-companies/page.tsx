'use client'

import { useState } from 'react'
import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import SiteFooter from '@/components/SiteFooter'
import { LocaleProvider, useTranslation } from '@/lib/i18n/LocaleContext'

// ============================================================================
// /for-companies — TWO PRODUCTS, clearly divided (Ana, 2026-06-14):
//   • Shapi Hire — Recruitment (find & hire what's proven)
//   • Shapi Workforce — HR & Restructuring (understand & reshape who you have)
// Shared SiteNav/SiteFooter (North-Star logo), ocean-emerald palette, title
// rule (white titles + coloured eyebrows), USPs grouped under the two products
// as expandable cards, softened (de-named) comparison.
// ============================================================================

const OCEAN = '#38BDF8'
const MINT = '#34D399'
const CORAL = '#FB7185'
const AMBER = '#FBBF24'

type Mark = '✓' | '~' | '✗'

export default function ForCompaniesPage() {
  return (
    <LocaleProvider>
      <ForCompaniesInner />
    </LocaleProvider>
  )
}

function ForCompaniesInner() {
  const { t } = useTranslation()

  // 14 USPs split across the two products.
  const hireKeys = ['u4', 'u5', 'u6', 'u9', 'u10', 'u11', 'u12', 'u13']
  const workforceKeys = ['u1', 'u2', 'u3', 'u7', 'u8', 'u14']
  const usp = (k: string) => ({ title: t(`forCompanies.usps.${k}Title`), body: t(`forCompanies.usps.${k}Desc`) })

  // Softened comparison: Shapi vs a single "traditional HR & hiring tools"
  // column (no named vendors). others = best any incumbent manages per row.
  const compRows: Array<{ label: string; others: Mark }> = [
    { label: t('forCompanies.comparison.row1'), others: '~' },
    { label: t('forCompanies.comparison.row2'), others: '~' },
    { label: t('forCompanies.comparison.row3'), others: '~' },
    { label: t('forCompanies.comparison.row4'), others: '✓' },
    { label: t('forCompanies.comparison.row5'), others: '~' },
    { label: t('forCompanies.comparison.row6'), others: '✓' },
    { label: t('forCompanies.comparison.row7'), others: '~' },
    { label: t('forCompanies.comparison.row8'), others: '~' },
  ]

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#060609] text-[#F4F4F7]">
      <style>{`
        .c-card { background:#0D0C14; border:1px solid rgba(255,255,255,0.08); box-shadow:0 1px 2px rgba(0,0,0,0.45),0 16px 40px rgba(0,0,0,0.35); transition:all .3s ease; }
        .c-card:hover { transform:translateY(-3px); box-shadow:0 1px 2px rgba(0,0,0,0.45),0 20px 46px rgba(56,189,248,0.14); border-color:rgba(56,189,248,0.28); }
        .c-grad { background:linear-gradient(135deg,#38BDF8,#34D399); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .c-btn { background:linear-gradient(135deg,#38BDF8,#34D399); color:#06121a; box-shadow:0 8px 24px rgba(56,189,248,0.28); transition:all .25s ease; }
        .c-btn:hover { box-shadow:0 12px 32px rgba(56,189,248,0.44); transform:translateY(-1px); }
        .c-outline { background:#0B0B0F; color:#F4F4F7; border:1px solid rgba(255,255,255,0.16); transition:all .25s ease; }
        .c-outline:hover { border-color:rgba(56,189,248,0.4); transform:translateY(-1px); }
      `}</style>

      <div className="pointer-events-none fixed inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(56,189,248,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <SiteNav active="companies" />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-16">
        <div className="pointer-events-none absolute left-1/4 top-0 h-[480px] w-[480px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.16) 0%, transparent 70%)' }} />
        <div className="pointer-events-none absolute right-1/4 top-10 h-[400px] w-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.12) 0%, transparent 70%)' }} />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="mb-7 inline-block rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.25em]" style={{ background: 'rgba(56,189,248,0.12)', color: OCEAN }}>
            {t('forCompanies.hero.badge')}
          </span>
          <h1 className="mb-7 text-5xl font-black leading-[0.95] tracking-tighter text-[#F4F4F7] md:text-7xl">
            <Hl text={t('forCompanies.hero.headline')} word="verified talent" />
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[#E6E6EC] md:text-xl">
            {t('forCompanies.hero.subhead')}
            <span className="mt-3 block text-[#A6A6B4]">{t('forCompanies.hero.subheadExtra')}</span>
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup?type=company" className="c-btn rounded-full px-7 py-4 text-center text-sm font-black">{t('forCompanies.hero.ctaSnapshot')}</Link>
            <Link href="/book-call?topic=workforce-intelligence" className="c-outline rounded-full px-7 py-4 text-center text-sm font-bold">{t('forCompanies.hero.ctaTalk')}</Link>
          </div>
        </div>
      </section>

      {/* ── TWO PRODUCTS ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 text-center">
          <span className="inline-flex rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest" style={{ background: `${MINT}1f`, color: MINT }}>Two products, one platform</span>
          <h2 className="mt-5 text-4xl font-black tracking-tighter text-[#F4F4F7] md:text-5xl">Hire what&apos;s <span style={{ color: OCEAN }}>proven.</span><br />Reshape what you <span style={{ color: MINT }}>have.</span></h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <ProductCard
            color={OCEAN}
            kicker="Shapi Hire"
            label="Recruitment"
            title="Find & hire what's proven"
            body="Candidates arrive already verified — independent references, evidence-based skills, a real trust score on both sides. Add active hiring, a candidate pool, salary benchmarks and starter JDs."
            points={['Verified candidates before they reach you', 'Active hiring + candidate pool', 'Salary benchmarks & starter JDs', 'Hiring-manager WhatsApp + mobile review']}
            cta="See recruitment plans →"
            href="#pricing"
          />
          <ProductCard
            color={MINT}
            kicker="Shapi Workforce"
            label="HR & Restructuring"
            title="Understand & reshape who you have"
            body="A living view of the workforce you already employ — readiness score, skills map, AI-exposure per role, org design and a defensible, immutable audit trail for every restructuring decision."
            points={['Workforce readiness + skills density map', 'AI-exposure scored per role', 'Org design & redeployment before you hire', 'Immutable restructuring audit + outplacement']}
            cta="Talk to us →"
            href="/book-call?intent=enterprise"
          />
        </div>
      </section>

      {/* Pitch — 3 panels */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-black tracking-tighter text-[#F4F4F7] md:text-5xl"><Hl text={t('forCompanies.pitch.title')} word="three layers" /></h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-[#E6E6EC]">{t('forCompanies.pitch.subtitle')}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { c: MINT, icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', title: t('forCompanies.pitch.p1Title'), desc: t('forCompanies.pitch.p1Desc') },
            { c: OCEAN, icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z', title: t('forCompanies.pitch.p2Title'), desc: t('forCompanies.pitch.p2Desc') },
            { c: CORAL, icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z', title: t('forCompanies.pitch.p3Title'), desc: t('forCompanies.pitch.p3Desc') },
          ].map((p) => (
            <div key={p.title} className="c-card rounded-2xl p-6">
              <svg className="mb-4 h-7 w-7" style={{ color: p.c }} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={p.icon} /></svg>
              <h3 className="mb-2 text-xl font-black" style={{ color: p.c }}>{p.title}</h3>
              <p className="text-sm leading-relaxed text-[#C7C7D1]">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* USPs grouped under the two products (expandable) */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 text-center">
          <span className="mb-5 inline-block rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.25em]" style={{ background: `${OCEAN}1f`, color: OCEAN }}>{t('forCompanies.usps.eyebrow')}</span>
          <h2 className="mx-auto max-w-3xl text-4xl font-black tracking-tighter text-[#F4F4F7] md:text-5xl"><Hl text={t('forCompanies.usps.title')} word="plain terms" /></h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <UspGroup color={OCEAN} title="In Shapi Hire" sub="Recruitment" items={hireKeys.map(usp)} open />
          <UspGroup color={MINT} title="In Shapi Workforce" sub="HR & Restructuring" items={workforceKeys.map(usp)} />
        </div>
      </section>

      {/* Comparison — softened, 2-col */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-black tracking-tighter text-[#F4F4F7] md:text-5xl">{t('forCompanies.comparison.title')}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-[#A6A6B4]">{t('forCompanies.comparison.subtitle')}</p>
        </div>
        <div className="c-card mx-auto max-w-3xl overflow-x-auto rounded-3xl p-4 md:p-6">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-3 text-start text-sm font-bold text-[#7E7E8E]">{t('forCompanies.comparison.colCapability')}</th>
                <th className="p-3 text-base font-black tracking-tighter" style={{ color: MINT }}>{t('forCompanies.comparison.colShapi')}</th>
                <th className="p-3 text-sm font-bold text-[#7E7E8E]">Traditional HR & hiring tools</th>
              </tr>
            </thead>
            <tbody>
              {compRows.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <td className="p-3 text-sm font-medium text-[#C7C7D1]">{row.label}</td>
                  <td className="p-3 text-center text-base font-black" style={{ color: MINT, background: 'rgba(52,211,153,0.06)' }}>✓</td>
                  <td className="p-3 text-center text-base font-black" style={{ color: row.others === '✓' ? MINT : row.others === '~' ? AMBER : CORAL }}>{row.others}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 px-2 text-[11px] text-[#7E7E8E]">
            <span className="font-bold" style={{ color: MINT }}>✓</span> {t('forCompanies.comparison.legendIn')} · <span className="font-bold" style={{ color: AMBER }}>~</span> {t('forCompanies.comparison.legendPartial')} · <span className="font-bold" style={{ color: CORAL }}>✗</span> {t('forCompanies.comparison.legendOut')}.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-black tracking-tighter text-[#F4F4F7] md:text-5xl">{t('forCompanies.how.title')}</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { step: t('forCompanies.how.step1Number'), c: OCEAN, title: t('forCompanies.how.step1Title'), desc: t('forCompanies.how.step1Desc') },
            { step: t('forCompanies.how.step2Number'), c: CORAL, title: t('forCompanies.how.step2Title'), desc: t('forCompanies.how.step2Desc') },
            { step: t('forCompanies.how.step3Number'), c: MINT, title: t('forCompanies.how.step3Title'), desc: t('forCompanies.how.step3Desc') },
          ].map((s) => (
            <div key={s.step} className="c-card rounded-2xl p-7">
              <span className="text-5xl font-black" style={{ color: s.c }}>{s.step}</span>
              <h3 className="mb-2 mt-4 text-xl font-black">{s.title}</h3>
              <p className="text-sm leading-relaxed text-[#C7C7D1]">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sources */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-2xl p-6 md:p-8" style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.18)' }}>
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.25em]" style={{ color: OCEAN }}>{t('forCompanies.sources.eyebrow')}</p>
          <p className="text-base leading-relaxed text-[#C7C7D1] md:text-lg">{t('forCompanies.sources.body')}</p>
        </div>
      </section>

      {/* Pricing — divided by product */}
      <section id="pricing" className="relative z-10 mx-auto max-w-6xl px-6 py-16 scroll-mt-20">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-black tracking-tighter text-[#F4F4F7] md:text-5xl"><Hl text={t('forCompanies.pricing.title')} word="clear pricing" /></h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-[#A6A6B4]">{t('forCompanies.pricing.subtitle')}</p>
        </div>

        <p className="mb-4 text-sm font-black uppercase tracking-widest" style={{ color: OCEAN }}>Recruitment · Shapi Hire</p>
        <div className="mb-12 grid gap-5 md:grid-cols-3">
          {[
            { name: t('forCompanies.pricing.t1Name'), price: t('forCompanies.pricing.t1Price'), suffix: '', desc: t('forCompanies.pricing.t1Desc'), cta: t('forCompanies.pricing.t1Cta'), href: '/signup?type=company', c: OCEAN, hot: false },
            { name: t('forCompanies.pricing.t2Name'), price: t('forCompanies.pricing.t2Price'), suffix: t('forCompanies.pricing.t2Suffix'), desc: t('forCompanies.pricing.t2Desc'), cta: t('forCompanies.pricing.t2Cta'), href: '/signup?type=company', c: MINT, hot: true },
            { name: t('forCompanies.pricing.t3Name'), price: t('forCompanies.pricing.t3Price'), suffix: t('forCompanies.pricing.t3Suffix'), desc: t('forCompanies.pricing.t3Desc'), cta: t('forCompanies.pricing.t3Cta'), href: '/signup?type=company', c: CORAL, hot: false },
          ].map((tier) => <PriceCard key={tier.name} tier={tier} />)}
        </div>

        <p className="mb-4 text-sm font-black uppercase tracking-widest" style={{ color: MINT }}>HR &amp; Restructuring · Shapi Workforce</p>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="md:col-span-3">
            <PriceCard wide tier={{ name: t('forCompanies.pricing.t4Name'), price: t('forCompanies.pricing.t4Price'), suffix: t('forCompanies.pricing.t4Suffix'), desc: t('forCompanies.pricing.t4Desc'), cta: t('forCompanies.pricing.t4Cta'), href: '/book-call?intent=enterprise', c: AMBER, hot: false }} />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="relative overflow-hidden rounded-3xl px-8 py-16 text-center md:py-20" style={{ background: '#0D0C14', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(56,189,248,0.16), transparent 60%)' }} />
          <div className="relative">
            <h2 className="mb-5 text-4xl font-black tracking-tighter text-[#F4F4F7] md:text-6xl"><Hl text={t('forCompanies.finalCta.title')} word="stands" /></h2>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-[#A6A6B4]">{t('forCompanies.finalCta.subtitle')}</p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup?type=company" className="c-btn rounded-full px-8 py-4 text-sm font-black">{t('forCompanies.finalCta.ctaSnapshot')}</Link>
              <Link href="/book-call?topic=workforce-intelligence" className="c-outline rounded-full px-8 py-4 text-sm font-bold">{t('forCompanies.finalCta.ctaTalk')}</Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}

// Highlights one English word/phrase inside a (possibly translated) title with
// the brand gradient. If the word isn't present (non-English locale), renders
// the title plain — i18n-safe.
function Hl({ text, word }: { text: string; word: string }) {
  const i = text.indexOf(word)
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <span className="c-grad">{word}</span>
      {text.slice(i + word.length)}
    </>
  )
}

function ProductCard({ color, kicker, label, title, body, points, cta, href }: { color: string; kicker: string; label: string; title: string; body: string; points: string[]; cta: string; href: string }) {
  return (
    <div className="c-card flex flex-col rounded-3xl p-8">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-lg font-black" style={{ color }}>{kicker}</span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: `${color}1f`, color }}>{label}</span>
      </div>
      <h3 className="mb-3 text-2xl font-black tracking-tight text-[#F4F4F7]">{title}</h3>
      <p className="mb-5 text-sm leading-relaxed text-[#C7C7D1]">{body}</p>
      <ul className="mb-6 space-y-2.5">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-[#C7C7D1]">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            {p}
          </li>
        ))}
      </ul>
      <Link href={href} className="mt-auto inline-block text-sm font-black" style={{ color }}>{cta}</Link>
    </div>
  )
}

function UspGroup({ color, title, sub, items, open = false }: { color: string; title: string; sub: string; items: { title: string; body: string }[]; open?: boolean }) {
  // Self-managed open state — controlled `open` + onToggle so the native
  // <details> toggle and React stay in sync (avoids the content-desync bug).
  const [isOpen, setIsOpen] = useState(open)
  return (
    <details className="group c-card rounded-2xl p-6" open={isOpen} onToggle={(e) => setIsOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="flex cursor-pointer list-none select-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: color }} />
        <span>
          <span className="block text-lg font-black leading-tight" style={{ color }}>{title}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E]">{sub}</span>
        </span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${color}1f`, color }}>{items.length}</span>
        <span className="ml-auto text-sm transition-transform duration-200 group-open:rotate-180" style={{ color: 'rgba(255,255,255,0.4)' }}>▾</span>
      </summary>
      <div className="mt-5 space-y-4">
        {items.map((it, j) => (
          <div key={j} className="border-t border-white/[0.06] pt-3 first:border-0 first:pt-0">
            <p className="text-sm font-bold text-[#F4F4F7]">{it.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-[#A6A6B4]">{it.body}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

function PriceCard({ tier, wide = false }: { tier: { name: string; price: string; suffix: string; desc: string; cta: string; href: string; c: string; hot: boolean }; wide?: boolean }) {
  return (
    <div className={`c-card flex rounded-2xl p-7 ${wide ? 'flex-col md:flex-row md:items-center md:gap-8' : 'flex-col'}`} style={tier.hot ? { border: '1px solid rgba(52,211,153,0.35)' } : undefined}>
      <div className={wide ? 'md:flex-1' : ''}>
        {tier.hot && <span className="mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>MOST POPULAR</span>}
        <p className="mb-2 text-sm font-bold uppercase tracking-wider" style={{ color: tier.c }}>{tier.name}</p>
        <p className="text-4xl font-black">{tier.price}</p>
        {tier.suffix && <p className="mb-5 mt-1 text-xs text-[#7E7E8E]">{tier.suffix}</p>}
        <p className={`text-sm leading-relaxed text-[#C7C7D1] ${wide ? 'mt-2' : 'mb-7 flex-1'}`}>{tier.desc}</p>
      </div>
      <Link href={tier.href} className={`${tier.hot ? 'c-btn' : 'c-outline'} rounded-full py-3 text-center text-sm font-black ${wide ? 'mt-4 md:mt-0 md:w-56' : ''}`} style={!wide ? { display: 'block' } : undefined}>{tier.cta}</Link>
    </div>
  )
}
