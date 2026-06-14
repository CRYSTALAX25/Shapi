'use client'

import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import SiteFooter from '@/components/SiteFooter'
import NeuralGlobe from '@/components/NeuralGlobe'
import { LocaleProvider } from '@/lib/i18n/LocaleContext'

// ============================================================================
// Homepage — WHO WE ARE / WHAT WE DO / MISSION. Agnostic to both audiences.
// ============================================================================
// Repositioned 2026-06-14 (Ana): the homepage is no longer a candidate CV
// funnel. It tells the Shapi story — the problem (AI is rewriting work; hiring
// and restructuring are slow, costly, guesswork), what we are (one verification
// + intelligence + transition platform), and routes each side to its dedicated
// page (/for-candidates, /for-companies). Candidate/company specifics + pricing
// live on those pages, not here.
//
// Copy is intentionally English-direct (not i18n) while the positioning settles;
// it gets pushed back through the 9-locale dict once the words are locked.
// ============================================================================

const OCEAN = '#38BDF8'
const MINT = '#34D399'
const CORAL = '#FB7185'
const AMBER = '#FBBF24'

export default function Home() {
  return (
    <LocaleProvider>
      <main className="min-h-screen overflow-x-hidden bg-[#060609] text-[#F4F4F7]">
        <style>{`
          .h-card { background:#0D0C14; border:1px solid rgba(255,255,255,0.08); box-shadow:0 1px 2px rgba(0,0,0,0.45),0 16px 40px rgba(0,0,0,0.35); transition:all .3s ease; }
          .h-card:hover { transform:translateY(-4px); box-shadow:0 1px 2px rgba(0,0,0,0.45),0 22px 48px rgba(56,189,248,0.16); border-color:rgba(56,189,248,0.30); }
          .h-grad { background:linear-gradient(135deg,#38BDF8,#34D399); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
          .h-btn { background:linear-gradient(135deg,#38BDF8,#34D399); color:#06121a; box-shadow:0 8px 24px rgba(56,189,248,0.30); transition:all .25s ease; }
          .h-btn:hover { box-shadow:0 12px 34px rgba(56,189,248,0.46); transform:translateY(-1px); }
          .h-outline { border:1px solid rgba(255,255,255,0.16); color:#F4F4F7; transition:all .25s ease; }
          .h-outline:hover { border-color:rgba(56,189,248,0.5); transform:translateY(-1px); }
        `}</style>

        {/* dot grid */}
        <div className="pointer-events-none fixed inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(56,189,248,0.05) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

        <SiteNav active="pricing" />

        {/* ───────── Hero — agnostic / mission ───────── */}
        <section className="relative z-10 mx-auto max-w-6xl overflow-visible px-6 pb-16 pt-16">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <NeuralGlobe opacity={0.5} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 62% 55% at 50% 40%, rgba(6,6,9,0.84) 0%, rgba(6,6,9,0.4) 55%, transparent 100%)' }} />
          </div>

          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: MINT }} />
              <span className="text-xs font-bold" style={{ color: OCEAN }}>The verification layer for the AI era of work</span>
            </div>

            <h1 className="text-5xl font-black leading-[0.95] tracking-tighter md:text-[78px]">
              <span className="block">Shape</span>
              <span className="block">what&apos;s <span className="h-grad">next.</span></span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[#F4F4F7] md:text-xl">
              AI is rewriting every role. Hiring and restructuring have never been
              slower, costlier, or more uncertain. Shapi is the one platform that
              verifies talent, gives companies the intelligence to restructure with
              confidence, and helps people prove their worth and navigate what&apos;s
              next — both sides, one source of truth.
            </p>

            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/for-candidates" className="h-btn rounded-full px-8 py-4 text-sm font-black">
                I&apos;m a candidate →
              </Link>
              <Link href="/for-companies" className="h-outline rounded-full px-8 py-4 text-sm font-bold">
                I&apos;m hiring / restructuring →
              </Link>
            </div>
            <p className="mt-5 text-xs text-[#7E7E8E]">Free to start · UAE-first · built for blue & white collar</p>
          </div>
        </section>

        {/* ───────── The gap ───────── */}
        <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
          <Eyebrow color={CORAL}>The gap</Eyebrow>
          <SectionTitle>Work is changing faster<br />than anyone can verify.</SectionTitle>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base text-[#E6E6EC]">
            The cost of getting people decisions wrong has never been higher — and the
            tools everyone uses were built for a world that no longer exists.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <GapCard color={OCEAN} stat="Months" label="to restructure or fill a senior role — guesswork, agencies, and back-and-forth that drains time and budget." />
            <GapCard color={CORAL} stat="5+ tools" label="HR teams juggle to plan headcount, check references, and assess skills — none of them talk to each other." />
            <GapCard color={AMBER} stat="Unverified" label="The average CV is self-reported and impossible to trust. Both sides are deciding on guesswork." />
          </div>
        </section>

        {/* ───────── What we do ───────── */}
        <section className="relative z-10 mx-auto max-w-5xl px-6 py-20">
          <Eyebrow color={OCEAN}>What we do</Eyebrow>
          <SectionTitle>One platform for the people<br />and the companies navigating the change.</SectionTitle>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base text-[#E6E6EC]">
            Shapi replaces the scattered, costly, slow process of proving and finding
            talent with a single source of truth — and supports both sides through
            their transition, not just the hire.
          </p>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {[
              { c: MINT, t: 'We verify, not assume', d: 'References sourced independently, skills proven with evidence, work history cross-checked. Every claim is labelled Verified, Shapi-assessed, or self-reported — never blurred.' },
              { c: OCEAN, t: 'We give companies intelligence', d: 'See your real skills map, redeploy before you hire, restructure with a defensible audit trail, and carry a trust score that holds you accountable too.' },
              { c: AMBER, t: 'We support the transition', d: 'AI-exposure checks, reskilling, native-language and voice-first onboarding, and career-pivot tools — for the people whose roles are being rewritten.' },
              { c: CORAL, t: 'We cut the cost & the time', d: 'One platform instead of five. Faster, fairer decisions for blue and white collar alike — from a verified profile to a confident hire to a humane restructure.' },
            ].map((x, i) => (
              <div key={i} className="h-card rounded-2xl p-7">
                <div className="mb-4 h-9 w-9 rounded-xl" style={{ background: `${x.c}22`, border: `1px solid ${x.c}55` }} />
                <h3 className="mb-2 text-lg font-black" style={{ color: x.c }}>{x.t}</h3>
                <p className="text-sm leading-relaxed text-[#C7C7D1]">{x.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── Two paths ───────── */}
        <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
          <Eyebrow color={MINT}>Both sides, one source of truth</Eyebrow>
          <SectionTitle>Wherever you are in the change,<br />there&apos;s a way through.</SectionTitle>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <PathCard
              href="/for-candidates"
              color={OCEAN}
              kicker="For candidates"
              title="Prove your worth. Navigate what's next."
              points={['A verified profile that says more than a CV', 'References sourced for you — fairly', 'Know your AI-exposure and your real market worth', 'Reskill and pivot with a clear map']}
              cta="Explore for candidates →"
            />
            <PathCard
              href="/for-companies"
              color={MINT}
              kicker="For companies"
              title="Hire what's proven. Restructure with intelligence."
              points={['Candidates verified before they reach you', 'See your skills map and redeploy first', 'Plan headcount with a defensible audit trail', 'A living HR layer, not five disconnected tools']}
              cta="Explore for companies →"
            />
          </div>
        </section>

        {/* ───────── Mission ───────── */}
        <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-3xl p-12 md:p-16" style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.10) 0%, rgba(56,189,248,0.04) 50%, rgba(52,211,153,0.08) 100%)', border: '1px solid rgba(56,189,248,0.16)' }}>
            <div className="pointer-events-none absolute -right-20 -top-20 h-[400px] w-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)' }} />
            <div className="relative max-w-3xl">
              <Eyebrow color={OCEAN} left>Why we built Shapi</Eyebrow>
              <div className="mt-5 space-y-5 text-lg leading-relaxed text-[#C7C7D1]">
                <p>The world of work is being rewritten in real time. Roles are disappearing and reappearing in new shapes. Companies are restructuring under pressure, and good people are being asked to prove themselves all over again.</p>
                <p>The old tools make it worse — slow, expensive, and built on guesswork. CVs nobody can trust. Hiring that takes months. Restructuring that treats people as line items.</p>
                <p className="text-xl font-bold text-[#F4F4F7]">We built Shapi to close that gap: to make truth the default, decisions faster and fairer, and the transition survivable for everyone in it.</p>
                <p className="font-semibold" style={{ color: MINT }}>One platform. Both sides. Shape what&apos;s next.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── Final CTA ───────── */}
        <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-3xl px-8 py-20 text-center" style={{ background: '#0D0C14', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(56,189,248,0.14), transparent 60%)' }} />
            <div className="relative">
              <h2 className="mb-4 text-4xl font-black tracking-tighter text-[#F4F4F7] md:text-6xl">Shape what&apos;s <span className="h-grad">next.</span></h2>
              <p className="mb-10 text-base text-[#A6A6B4]">Free to start. Pick your side.</p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/for-candidates" className="h-btn rounded-full px-8 py-4 text-sm font-black">I&apos;m a candidate →</Link>
                <Link href="/for-companies" className="h-outline rounded-full px-8 py-4 text-sm font-bold">I&apos;m hiring / restructuring →</Link>
              </div>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </LocaleProvider>
  )
}

function Eyebrow({ children, color, left = false }: { children: React.ReactNode; color: string; left?: boolean }) {
  return (
    <div className={left ? '' : 'text-center'}>
      <span className="inline-flex items-center rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest" style={{ background: `${color}1f`, color }}>
        {children}
      </span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  // Section titles always ocean (founder rule, 2026-06-14). Hero + closing
  // titles keep the white + one-highlighted-word treatment ("next." / "proven.").
  return <h2 className="mt-5 text-center text-4xl font-black leading-[1.02] tracking-tighter md:text-5xl" style={{ color: '#38BDF8' }}>{children}</h2>
}

function GapCard({ color, stat, label }: { color: string; stat: string; label: string }) {
  return (
    <div className="h-card rounded-2xl p-7 text-center">
      <p className="text-4xl font-black md:text-5xl" style={{ color }}>{stat}</p>
      <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-[#A6A6B4]">{label}</p>
    </div>
  )
}

function PathCard({ href, color, kicker, title, points, cta }: { href: string; color: string; kicker: string; title: string; points: string[]; cta: string }) {
  return (
    <Link href={href} className="h-card group block rounded-3xl p-8">
      <span className="text-xs font-black uppercase tracking-widest" style={{ color }}>{kicker}</span>
      <h3 className="mb-5 mt-3 text-2xl font-black tracking-tight text-[#F4F4F7] md:text-3xl">{title}</h3>
      <ul className="mb-6 space-y-2.5">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-[#C7C7D1]">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            {p}
          </li>
        ))}
      </ul>
      <span className="inline-block text-sm font-black transition-transform group-hover:translate-x-1" style={{ color }}>{cta}</span>
    </Link>
  )
}
