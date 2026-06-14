import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — Shapi',
  description: 'The terms that govern your use of Shapi.',
}

const UPDATED = '21 May 2026'

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#060609]">
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-4 border-b border-[rgba(255,255,255,0.08)] max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #38BDF8, #34D399)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <Link href="/privacy" className="text-[#A6A6B4] text-sm hover:text-[#C7C7D1] transition-colors">Privacy →</Link>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black text-[#F4F4F7] mb-2">Terms of Service</h1>
        <p className="text-[#7E7E8E] text-sm mb-10">Last updated: {UPDATED}</p>

        <div className="space-y-8 text-[#C7C7D1] text-sm leading-relaxed">
          <p>
            These terms govern your use of Shapi (shapi.io). By creating an account or using the service you agree
            to them. If you do not agree, do not use Shapi.
          </p>

          <Section title="1. The service">
            Shapi is a verified job-matching platform. We help candidates build a verified profile (including
            independent reference checks and AI-assisted CV building) and help companies find and connect with
            candidates. We may add, change, or remove features over time.
          </Section>

          <Section title="2. Your account">
            You must be at least 18 and provide accurate information. You are responsible for keeping your
            password secure and for activity under your account. Tell us promptly at{' '}
            <a href="mailto:hello@shapi.io" className="text-[#38BDF8]">hello@shapi.io</a> if you suspect
            unauthorised use.
          </Section>

          <Section title="3. Your content & accuracy">
            You keep ownership of the information you submit (CV, profile, messages). You grant Shapi a licence to
            host, process, and display it to operate the service — including showing your verified profile to
            companies and generating your CV and verification report. You confirm that the information you give us
            is true and that you have the right to share it. Misrepresenting your experience or credentials may
            result in removal from the platform.
          </Section>

          <Section title="4. References">
            When you ask to be verified, you confirm that the referees you nominate are genuine and that you are
            entitled to share their contact details so we can contact them. References are sourced independently —
            you do not choose what referees say and you will not see their individual responses.
          </Section>

          <Section title="5. Payments">
            Paid features are described at the point of purchase and billed through Stripe. Subscriptions renew
            until cancelled. Except where required by law, payments are non-refundable. Prices may change with
            notice for future billing periods.
          </Section>

          <Section title="6. Acceptable use">
            You agree not to: post false, misleading, unlawful, or infringing content; impersonate others; scrape
            or harvest data; attempt to disrupt or gain unauthorised access to the platform; or use Shapi to
            discriminate unlawfully or harass anyone.
          </Section>

          <Section title="7. For companies">
            If you use Shapi to hire, you agree to use candidate data only for legitimate recruitment, to comply
            with applicable employment and data-protection law, and not to share candidate data outside your
            hiring process. Placement and subscription terms are as described at purchase.
          </Section>

          <Section title="8. Verification disclaimer">
            Shapi provides verification and matching tools in good faith, but we do not guarantee employment, the
            accuracy of third-party (e.g. referee) statements, or any particular hiring outcome. Hiring decisions
            remain the responsibility of the company.
          </Section>

          <Section title="9. Availability">
            We aim to keep Shapi available but provide it &ldquo;as is&rdquo; without warranties. We may suspend
            or modify the service for maintenance or other operational reasons.
          </Section>

          <Section title="10. Limitation of liability">
            To the extent permitted by law, Shapi is not liable for indirect or consequential losses, lost
            profits, or loss of data. Our total liability for any claim is limited to the amount you paid us in
            the 12 months before the claim.
          </Section>

          <Section title="11. Termination">
            You may close your account at any time. We may suspend or terminate accounts that breach these terms.
            Provisions that by their nature should survive termination will do so.
          </Section>

          <Section title="12. Changes & governing law">
            We may update these terms; the updated version will be posted here. Continued use means you accept the
            changes. These terms are governed by the laws of the United Arab Emirates, without prejudice to any
            mandatory consumer rights in your country of residence.
          </Section>

          <Section title="13. Contact">
            <a href="mailto:hello@shapi.io" className="text-[#38BDF8]">hello@shapi.io</a>
          </Section>
        </div>

        <div className="mt-12 pt-6 border-t border-[rgba(255,255,255,0.08)]">
          <Link href="/signup" className="text-[#38BDF8] text-sm font-bold hover:opacity-80">← Back to sign up</Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[#F4F4F7] font-bold text-base mb-2">{title}</h2>
      <div>{children}</div>
    </div>
  )
}
