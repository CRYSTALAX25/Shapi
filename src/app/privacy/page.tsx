import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Shapi',
  description: 'How Shapi collects, uses, and protects your data.',
}

const UPDATED = '21 May 2026'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#F1F2F7]">
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(14,14,26,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      <nav className="relative z-10 px-6 py-4 border-b border-[#0E0E1A]/[0.08] max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-black text-xl tracking-tighter" style={{
          background: 'linear-gradient(135deg, #A78BFA, #22D3EE)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>shapi</Link>
        <Link href="/terms" className="text-[#5A5A6E] text-sm hover:text-[#3F3F4E] transition-colors">Terms →</Link>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-12 prose-shapi">
        <h1 className="text-3xl font-black text-[#0E0E1A] mb-2">Privacy Policy</h1>
        <p className="text-[#8A8A99] text-sm mb-10">Last updated: {UPDATED}</p>

        <div className="space-y-8 text-[#3F3F4E] text-sm leading-relaxed">
          <p>
            Shapi (&ldquo;Shapi&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the job-matching platform at
            shapi.io. This policy explains what personal data we collect, why, how we use it, and the rights you
            have. By creating an account you agree to this policy.
          </p>

          <Section title="1. Who we are">
            Shapi is operated by Ana O. Barber. For any privacy question or request, contact us at{' '}
            <a href="mailto:hello@shapi.io" className="text-[#0891B2]">hello@shapi.io</a>. We are the data
            controller for the personal data described below.
          </Section>

          <Section title="2. Data we collect">
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong className="text-[#0E0E1A]">Account data</strong> — email address and password (stored hashed).</li>
              <li><strong className="text-[#0E0E1A]">Profile data</strong> — your CV, work history, skills, summary, headline, location, languages, profile photo, online-presence links, and right-to-work declarations.</li>
              <li><strong className="text-[#0E0E1A]">Conversation data</strong> — messages you exchange with Shapi (web and WhatsApp) and any voice notes you record, which we transcribe.</li>
              <li><strong className="text-[#0E0E1A]">Reference data</strong> — the names and contact details of referees you nominate, and the responses those referees provide about you.</li>
              <li><strong className="text-[#0E0E1A]">Payment data</strong> — handled by our payment processor (Stripe). We do not store your card number.</li>
              <li><strong className="text-[#0E0E1A]">Usage data</strong> — basic technical logs needed to run and secure the service.</li>
              <li><strong className="text-[#0E0E1A]">Marketing preferences</strong> — whether you have opted in to product and job-market emails, and how you heard about us.</li>
            </ul>
          </Section>

          <Section title="3. How we use your data">
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>To build and display your verified profile.</li>
              <li>To contact the referees you nominate and compile an independent verification report.</li>
              <li>To match candidates with companies and surface relevant roles.</li>
              <li>To process payments and provide the features you have purchased.</li>
              <li>To send service emails (account, verification status). Marketing emails are sent only if you opt in, and you can unsubscribe at any time.</li>
              <li>To improve and secure the platform.</li>
            </ul>
          </Section>

          <Section title="4. References — important">
            When you ask Shapi to verify you, we contact the referees you nominate (and the colleagues they in
            turn nominate). We tell each referee who we are, why we are contacting them, and that their input is
            confidential. Referees can decline. Their responses are used to produce your verification report; you
            are not shown who said what. If you are a referee and want your data removed, email{' '}
            <a href="mailto:hello@shapi.io" className="text-[#0891B2]">hello@shapi.io</a>.
          </Section>

          <Section title="5. AI processing">
            We use AI services to build your CV, transcribe voice notes, translate reference responses, and
            cross-check claims across your references. These services process the relevant text/audio to provide
            the feature and do not use your data to train their public models under our agreements.
          </Section>

          <Section title="6. Service providers (processors)">
            We share data only with providers that help us run Shapi, under contract:
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong className="text-[#0E0E1A]">Supabase</strong> — database, authentication, file storage.</li>
              <li><strong className="text-[#0E0E1A]">Vercel</strong> — application hosting.</li>
              <li><strong className="text-[#0E0E1A]">Stripe</strong> — payment processing.</li>
              <li><strong className="text-[#0E0E1A]">Resend</strong> — transactional and (opt-in) marketing email.</li>
              <li><strong className="text-[#0E0E1A]">Twilio</strong> — WhatsApp messaging.</li>
              <li><strong className="text-[#0E0E1A]">OpenAI / Deepgram</strong> — voice transcription.</li>
              <li><strong className="text-[#0E0E1A]">Anthropic</strong> — AI conversation, drafting, and cross-checking.</li>
            </ul>
            We do not sell your personal data.
          </Section>

          <Section title="7. Who can see your profile">
            Your profile becomes visible to companies on Shapi once it is verified and live. Your public profile
            link (shapi.io/p/…) can be opened by anyone you share it with. References are summarised on your
            profile (counts and an aggregated report) — individual referee identities and verbatim responses are
            not published.
          </Section>

          <Section title="8. Data retention">
            We keep your data for as long as your account is active. You can ask us to delete your account and
            associated data at any time by emailing{' '}
            <a href="mailto:hello@shapi.io" className="text-[#0891B2]">hello@shapi.io</a>. Some records may be
            retained where required by law (e.g. payment records).
          </Section>

          <Section title="9. Your rights">
            Depending on where you live, you may have the right to access, correct, export, or delete your data,
            to object to or restrict processing, and to withdraw consent. To exercise any of these, email{' '}
            <a href="mailto:hello@shapi.io" className="text-[#0891B2]">hello@shapi.io</a>. You can also unsubscribe
            from marketing email using the link in any such email.
          </Section>

          <Section title="10. Data location & security">
            Your data may be processed in the UAE, EU, UK, and US by us and our providers. We use access controls,
            encryption in transit, and row-level security to protect it. No system is perfectly secure, but we
            take reasonable steps to safeguard your information.
          </Section>

          <Section title="11. Children">
            Shapi is not intended for anyone under 18. We do not knowingly collect data from children.
          </Section>

          <Section title="12. Changes">
            We may update this policy. We will post the new version here and update the date above. Significant
            changes will be notified by email where appropriate.
          </Section>

          <Section title="13. Contact">
            Questions or requests: <a href="mailto:hello@shapi.io" className="text-[#0891B2]">hello@shapi.io</a>.
          </Section>
        </div>

        <div className="mt-12 pt-6 border-t border-[#0E0E1A]/[0.08]">
          <Link href="/signup" className="text-[#0891B2] text-sm font-bold hover:opacity-80">← Back to sign up</Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[#0E0E1A] font-bold text-base mb-2">{title}</h2>
      <div>{children}</div>
    </div>
  )
}
