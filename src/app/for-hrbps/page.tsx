'use client'

import Link from 'next/link'
import LocalePicker from '@/components/LocalePicker'
import { LocaleProvider } from '@/lib/i18n/LocaleContext'

export default function ForHrbpsPage() {
  return (
    <LocaleProvider>
      <ForHrbpsInner />
    </LocaleProvider>
  )
}

function ForHrbpsInner() {
  return (
    <div className="min-h-screen bg-[#060609] text-[#F4F4F7] overflow-x-hidden">
      <style>{`
        .grad-text {
          background: linear-gradient(135deg, #38BDF8, #34D399);
          background-size: 300% 300%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .btn-primary {
          background: linear-gradient(135deg, #38BDF8, #34D399);
          color: #fff;
          box-shadow: 0 8px 24px rgba(56, 189, 248, 0.28);
          transition: all 0.25s ease;
        }
        .btn-primary:hover { box-shadow: 0 12px 32px rgba(56, 189, 248, 0.42); transform: translateY(-1px); }
        .btn-outline {
          background: #0B0B0F; color: #F4F4F7;
          border: 1px solid rgba(255,255,255,0.16);
          transition: all .25s ease;
        }
        .btn-outline:hover {
          border-color: rgba(56, 189, 248, 0.4);
          box-shadow: 0 8px 24px rgba(56, 189, 248, 0.18);
          transform: translateY(-1px);
        }
        .card {
          background: #0D0C14;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
          transition: all 0.3s ease;
        }
        .card:hover {
          transform: translateY(-3px);
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 20px 46px rgba(56, 189, 248, 0.14);
          border-color: rgba(56, 189, 248, 0.28);
        }
        .nav-link { color:#A6A6B4; transition: color .2s ease; }
        .nav-link:hover { color:#F4F4F7; }
        .tool-chip {
          background: #0D0C14;
          border: 1px solid rgba(255,255,255,0.10);
          transition: all 0.3s ease;
        }
        .tool-chip.collapsed {
          opacity: 0.45;
          text-decoration: line-through;
          text-decoration-color: rgba(251, 113, 133, 0.7);
        }
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
              Home
            </Link>
            <Link href="/for-candidates" className="nav-link hidden sm:block">
              For candidates
            </Link>
            <Link href="/for-companies" className="nav-link hidden sm:block">
              For companies
            </Link>
            <Link href="/login" className="nav-link">
              Sign in
            </Link>
            <LocalePicker />
            <Link
              href="/book-call?intent=enterprise"
              className="btn-outline rounded-full px-4 py-2 text-xs font-black"
            >
              Book a call
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-20">
        <div className="absolute top-0 left-1/4 w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, transparent 70%)' }} />
        <div className="absolute top-10 right-1/4 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(56, 189, 248, 0.14) 0%, transparent 70%)' }} />

        <div className="relative">
          <span className="inline-block text-[11px] font-black tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-7"
            style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8' }}>
            For HR Business Partners
          </span>
          <h1 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tighter mb-7"
            style={{ color: '#FB7185' }}>
            You were hired to shape the workforce, not babysit six dashboards.
          </h1>
          <p className="text-lg md:text-xl text-[#C7C7D1] max-w-3xl leading-relaxed mb-10">
            Shapi gives the HRBP one verified system of record for skills, capacity, performance and exits.
            <span className="block mt-3 text-[#A6A6B4]">
              You stay the strategic owner. The platform retires the busywork that buried the work you were actually brought in to do.
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-12">
            <Link
              href="/book-call?intent=enterprise"
              className="btn-primary rounded-full px-7 py-4 text-sm font-black text-center"
            >
              Book an Enterprise walkthrough
            </Link>
            <Link
              href="/for-companies"
              className="btn-outline rounded-full px-7 py-4 text-sm font-bold text-center"
            >
              See the company view
            </Link>
          </div>

          <div className="pt-8 border-t border-white/[0.06]">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#7E7E8E] mb-4">
              Where the HRBP sits
            </p>
            <p className="text-[#A6A6B4] text-sm max-w-3xl leading-relaxed">
              Between the C-suite that sets the mandate and the business-unit heads who run the teams. You hold
              the workforce strategy, but the data to execute it is scattered across six tools that do not talk
              to each other. Shapi is the layer that makes you the single source of truth.
            </p>
          </div>
        </div>
      </section>

      {/* The 6-tool problem */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <span className="inline-block text-[11px] font-black tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-5"
            style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8' }}>
            The six-tool problem
          </span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-3"
            style={{ color: '#FB7185' }}>
            You are running six logins to answer one question.
          </h2>
          <p className="text-[#A6A6B4] text-lg max-w-2xl mx-auto">
            Who do we have, what can they do, and where are we exposed. Today that takes a week of exports.
            Shapi collapses five of these six tools into one verified view.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-center">
          {/* The stack */}
          <div className="card rounded-3xl p-7">
            <p className="text-[11px] font-black tracking-[0.25em] uppercase mb-5" style={{ color: '#7E7E8E' }}>
              Your stack today
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { name: 'ChartHop', note: 'Org chart + headcount', collapsed: true },
                { name: 'Lattice / 15Five', note: 'Performance + reviews', collapsed: true },
                { name: 'Culture Amp', note: 'Engagement surveys', collapsed: true },
                { name: 'Greenhouse', note: 'Hiring pipeline', collapsed: true },
                { name: 'Excel', note: 'The real source of truth', collapsed: true },
                { name: 'Workday', note: 'System of record (stays)', collapsed: false },
              ].map((tool) => (
                <div
                  key={tool.name}
                  className={`tool-chip rounded-xl px-4 py-3 ${tool.collapsed ? 'collapsed' : ''}`}
                >
                  <p className="font-black text-sm" style={{ color: tool.collapsed ? '#A6A6B4' : '#34D399' }}>
                    {tool.name}
                  </p>
                  <p className="text-[11px] text-[#7E7E8E] no-underline">{tool.note}</p>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-[#7E7E8E] mt-5 leading-relaxed">
              Five tools struck through collapse into Shapi. Workday stays as your payroll and HRIS system of
              record — Shapi reads from it, it does not replace it.
            </p>
          </div>

          {/* The collapse */}
          <div
            className="rounded-3xl p-7"
            style={{
              background: 'linear-gradient(160deg, #131220, #0D0C14)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              boxShadow: '0 20px 50px rgba(56, 189, 248, 0.18)',
            }}
          >
            <p className="text-[11px] font-black tracking-[0.25em] uppercase mb-4" style={{ color: '#FB7185' }}>
              With Shapi
            </p>
            <p className="font-black text-3xl tracking-tighter mb-4 grad-text">One verified workforce view</p>
            <ul className="space-y-3">
              {[
                'Verified skills and capability density per team',
                'Live capacity and overload signals on the org chart',
                'Performance, calibration and exit workflows in one place',
                'Country-correct compliance built into every action',
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-[#C7C7D1] text-sm leading-relaxed">
                  <span className="mt-0.5 flex-shrink-0" style={{ color: '#34D399' }}>✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Three Enterprise champion features */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <span className="inline-block text-[11px] font-black tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-5"
            style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8' }}>
            Built for the HRBP
          </span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter max-w-3xl"
            style={{ color: '#FB7185' }}>
            Three tools that make you the workforce strategist again.
          </h2>
          <p className="text-[#A6A6B4] text-lg mt-4 max-w-2xl">
            Each one removes a recurring fire drill and replaces it with a verified, defensible decision.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              tag: 'Keystone',
              tagColor: '#FBBF24',
              icon: '🧭',
              color: '#38BDF8',
              title: 'Skill Density',
              subtitle: 'The redeploy-not-rehire engine',
              desc:
                'Before you approve three external data-analyst hires, Shapi shows you that Riyadh Ops already has two verified people doing admin who hold the skill. Match internal capability against open vacancies before a single requisition goes out.',
            },
            {
              tag: 'Retention',
              tagColor: '#FB7185',
              icon: '🔥',
              color: '#38BDF8',
              title: 'Strategic Calibration Lens',
              subtitle: 'Your org chart as a heatmap',
              desc:
                'Gold means a top performer carrying too much — a retention risk you can see before they resign. Crimson means a seat with high AI exposure and no transition timeline. One overlay turns calibration from a spreadsheet ritual into a strategic map.',
            },
            {
              tag: 'Compliance',
              tagColor: '#34D399',
              icon: '📋',
              color: '#FB7185',
              title: 'PIP & Separation Playbooks',
              subtitle: '30 / 60 / 90 with an audit trail',
              desc:
                'Run improvement plans and exits on structured 30/60/90 milestones with an immutable audit log. Wording routes to vetted country templates for the UAE, KSA and India, so the process is correct and defensible from day one.',
            },
          ].map((f) => (
            <div key={f.title} className="card rounded-2xl p-7 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: `${f.color}1f` }}
                >
                  <span>{f.icon}</span>
                </div>
                <span
                  className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{ background: `${f.tagColor}1f`, color: f.tagColor }}
                >
                  {f.tag}
                </span>
              </div>
              <h3 className="font-black text-xl mb-1" style={{ color: f.color }}>
                {f.title}
              </h3>
              <p className="text-sm font-bold text-[#A6A6B4] mb-3">{f.subtitle}</p>
              <p className="text-[#C7C7D1] text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why this matters strip */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-5">
          <div
            className="rounded-2xl p-7 md:p-8"
            style={{
              background: 'rgba(52,211,153,0.06)',
              border: '1px solid rgba(52,211,153,0.18)',
            }}
          >
            <p className="text-[11px] font-black tracking-[0.25em] uppercase mb-3" style={{ color: '#34D399' }}>
              The redeploy story
            </p>
            <p className="text-4xl font-black tracking-tighter mb-3" style={{ color: '#34D399' }}>
              $150k saved per quarter
            </p>
            <p className="text-[#C7C7D1] text-base leading-relaxed">
              One redeployment instead of three external hires is the kind of number a Chief People Officer
              repeats to the board. Skill Density closes the loop between the talent you already have and the
              roles you are about to pay an agency to fill.
            </p>
          </div>

          <div
            className="rounded-2xl p-7 md:p-8"
            style={{
              background: 'rgba(56, 189, 248, 0.06)',
              border: '1px solid rgba(56, 189, 248, 0.18)',
            }}
          >
            <p className="text-[11px] font-black tracking-[0.25em] uppercase mb-3" style={{ color: '#38BDF8' }}>
              The MENA legal moat
            </p>
            <p className="text-4xl font-black tracking-tighter mb-3" style={{ color: '#38BDF8' }}>
              12–24 months severance
            </p>
            <p className="text-[#C7C7D1] text-base leading-relaxed">
              That is what a wrongful-termination dispute can cost in the UAE. A complete, immutable audit trail
              on every PIP and exit is the difference between a defensible decision and an expensive one. The
              playbook protects the company and the HRBP who ran it.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div
          className="relative overflow-hidden rounded-3xl text-center py-16 md:py-20 px-8"
          style={{
            background: '#0D0C14',
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
            <p className="text-[11px] font-black tracking-[0.25em] uppercase mb-5" style={{ color: '#38BDF8' }}>
              Built for HRBPs and Chief People Officers
            </p>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-5"
              style={{ color: '#FB7185' }}>
              See it on your own org chart.
            </h2>
            <p className="text-[#A6A6B4] text-lg mb-10 max-w-2xl mx-auto">
              Enterprise is a guided rollout, not a self-serve trial. Book a walkthrough and we will map Skill
              Density, the Calibration Lens and the Separation Playbooks to your structure.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/book-call?intent=enterprise"
                className="btn-primary rounded-full px-8 py-4 font-black text-sm"
              >
                Book an Enterprise walkthrough
              </Link>
              <Link
                href="/for-companies"
                className="btn-outline rounded-full px-8 py-4 font-bold text-sm"
              >
                See the company view
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
              For candidates
            </Link>
            <Link href="/for-companies" className="hover:text-[#F4F4F7] transition-colors">
              For companies
            </Link>
            <Link href="/company/pricing" className="hover:text-[#F4F4F7] transition-colors">
              Company pricing
            </Link>
            <Link href="/privacy" className="hover:text-[#F4F4F7] transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[#F4F4F7] transition-colors">
              Terms
            </Link>
            <a href="mailto:hello@shapi.io" className="hover:text-[#F4F4F7] transition-colors">
              hello@shapi.io
            </a>
          </div>
          <p className="text-[#5C5C6A] text-sm">Shape what&apos;s next.</p>
        </div>
      </footer>
    </div>
  )
}
