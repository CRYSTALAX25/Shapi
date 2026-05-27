import Link from 'next/link'

export const metadata = {
  title: 'Shapi for Companies — Verified Workforce Intelligence',
  description:
    "The plan you'd get from McKinsey, the talent you'd get from LinkedIn, the verification nobody else has. Run a free Workforce Snapshot, generate your 5-year plan, and execute through Shapi.",
}

export default function ForCompaniesPage() {
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
              ← Home
            </Link>
            <Link href="/for-candidates" className="nav-link hidden sm:block">
              For candidates →
            </Link>
            <Link href="/login" className="nav-link">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="btn-outline rounded-full px-4 py-2 text-xs font-black"
            >
              Get started
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
            For companies
          </span>
          <h1 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tighter mb-7"
            style={{ color: '#FB7185' }}>
            Verified workforce intelligence — the plan you&apos;d get from McKinsey, the talent you&apos;d get from LinkedIn, the verification nobody else has.
          </h1>
          <p className="text-lg md:text-xl text-[#C7C7D1] max-w-3xl leading-relaxed mb-10">
            Workforce planning and AI integration aren&apos;t two problems — they&apos;re one. You can&apos;t plan headcount without an AI rollout plan, and you can&apos;t plan AI rollout without a talent plan.
            <span className="block mt-3 text-[#A6A6B4]">
              We score your readiness, plan your transformation, and supply the verified talent to execute — all in one platform.
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-12">
            <Link
              href="/company/workforce-snapshot"
              className="btn-primary rounded-full px-7 py-4 text-sm font-black text-center"
            >
              Run your free Workforce Snapshot →
            </Link>
            <a
              href="mailto:ana.vbarber@gmail.com?subject=Shapi%20-%20Workforce%20Intelligence%20enquiry"
              className="btn-outline rounded-full px-7 py-4 text-sm font-bold text-center"
            >
              Talk to Ana
            </a>
          </div>

          {/* Trusted-by placeholder strip */}
          <div className="pt-8 border-t border-white/[0.06]">
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#7E7E8E] mb-4">
              Built for hiring teams from
            </p>
            <div className="flex flex-wrap items-center gap-x-10 gap-y-3 text-[#5C5C6A] text-sm font-bold">
              <span>UAE family holdings</span>
              <span>GCC mega-projects</span>
              <span>MENA scale-ups</span>
              <span>Regional consulting firms</span>
              <span>Future logos welcome</span>
            </div>
          </div>
        </div>
      </section>

      {/* The pitch — 3 panels */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-3"
            style={{ color: '#FB7185' }}>
            One platform, three layers.
          </h2>
          <p className="text-[#A6A6B4] text-lg max-w-2xl mx-auto">
            Verified data feeds the intelligence. Intelligence drives the plan. The plan executes through our talent supply.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              icon: '🛡️',
              title: 'Verified',
              color: '#6AA8F5',
              desc:
                'Independent references + AI cross-check + work-history verification. Every signal in our intelligence layer is grounded in evidence — not self-reported claims.',
            },
            {
              icon: '🧠',
              title: 'Workforce Intelligence',
              color: '#F08CAE',
              desc:
                'AI-Proof scoring, Hiring Roadmap, Salary Benchmark, Workforce Snapshot, Org Design, Cognitive Load, Hiring Plan, Active Hiring, Autonomous Staffing.',
            },
            {
              icon: '⚡',
              title: 'Execution',
              color: '#F58E9A',
              desc:
                'Outplacement-as-a-service, Train-to-Hire, and talent sourced from the same verified pool. The plan ships through Shapi — not handed to another vendor.',
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
            The full product
          </span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter max-w-3xl"
            style={{ color: '#FB7185' }}>
            Every capability, mapped — no fluff.
          </h2>
          <p className="text-[#A6A6B4] text-lg mt-4 max-w-2xl">
            Fourteen workforce-intelligence capabilities, all reading from the same verified data layer.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            {
              icon: '📊',
              title: 'Workforce Future Readiness Score',
              desc:
                'A single 0–100 number per organisation — AI exposure, skills maturity, leadership adaptability, innovation density, resilience. The CEO conversation opener.',
            },
            {
              icon: '🎯',
              title: 'Workforce Snapshot (free)',
              desc:
                'Categorical inputs, 7-day turnaround. Headline score, heatmap, top at-risk roles, AI integration cost estimate, talent gap summary.',
            },
            {
              icon: '🛡️',
              title: 'AI-Proof every role',
              desc:
                'Six-dimension scoring — repetitiveness, rules-based work, admin intensity, data dependency, creativity, human interaction. Role-by-role, evidence-backed.',
            },
            {
              icon: '🗺️',
              title: 'Hiring Roadmap with starter JDs',
              desc:
                'Given team + open roles + market, what to hire next, what to reskill internally, what to redeploy — with draft JDs ready to publish in one click.',
            },
            {
              icon: '💸',
              title: 'Salary Benchmark — regional vs global',
              desc:
                'Both regional and global figures shown side-by-side, with the gap named and reasoning shown. Sourced from Mercer, Glassdoor, Numbeo, Shapi placement data.',
            },
            {
              icon: '📋',
              title: 'Hiring Plan',
              desc:
                'Perm / temp / fractional split with monthly comp range and projected burden. Walks you from team-as-is to target-state with cost deltas at every step.',
            },
            {
              icon: '🏗️',
              title: 'Org Design (target-state Y1/Y2/Y5)',
              desc:
                'AI-generated target-state org chart on a 1-, 2- and 5-year horizon. Per-BU operating-model tagging — Centralised, Agile Pod, Skills Marketplace, Hybrid Human+AI.',
            },
            {
              icon: '🧭',
              title: 'Cognitive Load Check',
              desc:
                'Surface managers and individuals running hot, before they burn out or leave. Continuous signal — not an annual survey.',
            },
            {
              icon: '🤖',
              title: 'Autonomous Staffing Recommendations',
              desc:
                'The system proactively flags staffing moves you should make — reskill A, redeploy B, protect C. Subscription stickiness, not a one-shot report.',
            },
            {
              icon: '📨',
              title: 'Active Hiring subscription',
              desc:
                'Daily AI-shortlisted verified candidates per open role, with drafted outreach awaiting your approval. Hiring on autopilot — you stay in control.',
            },
            {
              icon: '💬',
              title: 'Hiring-manager WhatsApp commands',
              desc:
                'Text "shortlist for ops director", "research [company]", "send the JD link" — Shapi does the work and reports back. The same chat you already live in.',
            },
            {
              icon: '🔗',
              title: 'Magic-link mobile JD review',
              desc:
                'Hiring managers approve shortlists, leave feedback, and move candidates through the pipeline on their phone — with no login, ever.',
            },
            {
              icon: '🪞',
              title: 'Employee-side culture references',
              desc:
                'Past and current employees vouch (anonymously aggregated) for paid-on-time, real hours, manager quality. Anti-employer-manipulation; feeds the company trust score.',
            },
            {
              icon: '🤝',
              title: 'Verified Restructuring + Outplacement',
              desc:
                'Restructure Studio + comms drafter + per-country compliance checks + 90-day Pro accounts for every leaver. Done humanely, with auditable decisions.',
            },
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
            How we compare — honestly.
          </h2>
          <p className="text-[#A6A6B4] text-lg max-w-2xl mx-auto">
            We&apos;re not vs job boards. The real comparison is workforce intelligence + verified talent supply.
          </p>
        </div>

        <div className="card rounded-3xl p-4 md:p-6 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 text-[#7E7E8E] font-bold text-sm">Capability</th>
                <th className="p-3">
                  <div
                    className="inline-flex items-center justify-center rounded-full px-3 py-1"
                    style={{ background: 'rgba(251,113,133,0.14)' }}
                  >
                    <span className="font-black text-base tracking-tighter" style={{ color: '#FB7185' }}>
                      shapi
                    </span>
                  </div>
                </th>
                {['Workday', 'Eightfold / Gloat', 'LinkedIn Recruiter', 'Mercer / McKinsey'].map((c) => (
                  <th key={c} className="p-3 text-[#7E7E8E] font-bold text-sm whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Verified candidate data (refs + cross-check)', '✓', '✗', '~', '✗', '✗'],
                ['AI-displacement scoring per role', '✓', '✗', '~', '✗', '~'],
                ['Workforce Future Readiness Score', '✓', '✗', '~', '✗', '~'],
                ['5-year scenario modelling', '✓', '~', '~', '✗', '✓'],
                ['Outplacement-as-a-service', '✓', '✗', '✗', '✗', '~'],
                ['Talent supplied from same platform', '✓', '✗', '~', '✓', '✗'],
                ['Mobile / WhatsApp ops', '✓', '✗', '✗', '~', '✗'],
                ['Pricing transparent ($/mo)', '✓', '✗', '✗', '~', '✗'],
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
            Legend: <span className="font-bold" style={{ color: '#34D399' }}>✓</span> in market ·{' '}
            <span className="font-bold" style={{ color: '#FBBF24' }}>~</span> partial / limited ·{' '}
            <span className="font-bold" style={{ color: '#F58E9A' }}>✗</span> not offered.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-3"
            style={{ color: '#FB7185' }}>
            How it works.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              step: '01',
              color: '#6AA8F5',
              title: 'Run the free Snapshot',
              desc:
                'Categorical inputs — industry, size, AI maturity, roster. 30 seconds in, 7 days to your Workforce Future Readiness Score + at-risk role list.',
            },
            {
              step: '02',
              color: '#F08CAE',
              title: 'Generate your 5-year Plan',
              desc:
                'Operating model diagnostic → Org DNA → workforce + AI integration plan on 3y / 5y / 10y horizons → execution playbook with cost deltas.',
            },
            {
              step: '03',
              color: '#F58E9A',
              title: 'Execute through Shapi',
              desc:
                'Hiring, outplacement, autonomous staffing, train-to-hire — all powered by the same verified talent pool the intelligence layer reads from.',
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
            Sourced, not invented
          </p>
          <p className="text-[#C7C7D1] text-base md:text-lg leading-relaxed">
            Every figure on this page and inside the product is synthesised from real, citable data:{' '}
            <span className="text-[#F4F4F7] font-bold">
              Mercer · Glassdoor · Anthropic &amp; OpenAI published API pricing · WEF Future of Jobs · Shapi platform data
            </span>
            . Confidence bands on projections, named variance drivers, sources footer on every report. We don&apos;t give you hedged numbers — we give you sourced answers and honest projections, so you can decide, not guess.
          </p>
        </div>
      </section>

      {/* Pricing tease */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-3"
            style={{ color: '#FB7185' }}>
            Three tiers. Honest pricing.
          </h2>
          <p className="text-[#A6A6B4] text-lg max-w-2xl mx-auto">
            Start free. Pay for the plan when you&apos;re ready. Subscribe to the OS once you want it running continuously.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              name: 'Snapshot',
              price: 'Free',
              color: '#6AA8F5',
              desc:
                'One-shot Workforce Future Readiness Score, heatmap, top at-risk roles, AI integration cost estimate. 7-day turnaround.',
              cta: 'Run the Snapshot →',
              href: '/company/workforce-snapshot',
            },
            {
              name: '5-year Plan',
              price: '$25–100k',
              priceSuffix: 'per engagement',
              color: '#F08CAE',
              desc:
                'Operating-model diagnostic, Org DNA, workforce + AI integration plan, execution playbook. Annual refresh available.',
              cta: 'Talk to us →',
              href: 'mailto:ana.vbarber@gmail.com?subject=Shapi%20-%205-year%20Workforce%20Plan',
              highlight: true,
            },
            {
              name: 'Workforce OS',
              price: '$5–25k',
              priceSuffix: 'per month',
              color: '#F58E9A',
              desc:
                'Continuous monitoring, Team Compatibility Matrix, succession intelligence, leadership-risk detection. Integrated with the marketplace.',
              cta: 'Get started →',
              href: 'mailto:ana.vbarber@gmail.com?subject=Shapi%20-%20Workforce%20OS',
            },
          ].map((t) => (
            <div
              key={t.name}
              className="card rounded-2xl p-7 flex flex-col"
              style={
                t.highlight
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
                style={{ color: t.color }}
              >
                {t.name}
              </p>
              <p className="text-4xl font-black mb-1">{t.price}</p>
              {t.priceSuffix && (
                <p className="text-xs text-[#7E7E8E] mb-5">{t.priceSuffix}</p>
              )}
              {!t.priceSuffix && <div className="mb-5" />}
              <p className="text-[#C7C7D1] text-sm leading-relaxed mb-7 flex-1">{t.desc}</p>
              <a
                href={t.href}
                className={
                  t.highlight
                    ? 'btn-primary rounded-full py-3 text-center text-sm font-black'
                    : 'btn-outline rounded-full py-3 text-center text-sm font-black'
                }
              >
                {t.cta}
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
              Ready to see your team&apos;s future-readiness?
            </h2>
            <p className="text-[#A6A6B4] text-lg mb-10 max-w-2xl mx-auto">
              Free Snapshot, ~30 seconds of inputs, sourced answers on the way back.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/company/workforce-snapshot"
                className="btn-primary rounded-full px-8 py-4 font-black text-sm"
              >
                Run the Snapshot — free, ~30s →
              </Link>
              <a
                href="mailto:ana.vbarber@gmail.com?subject=Shapi%20-%20Workforce%20Intelligence%20enquiry"
                className="btn-outline rounded-full px-8 py-4 font-bold text-sm"
              >
                Talk to Ana
              </a>
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
          <p className="text-[#5C5C6A] text-sm">Shape what&apos;s next. © 2026 Shapi.</p>
        </div>
      </footer>
    </div>
  )
}
