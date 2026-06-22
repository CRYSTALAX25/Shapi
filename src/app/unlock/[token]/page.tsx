// Public unlock landing for the "Trojan candidate" cross-sell loop.
//
// A hiring manager receives an anonymized teaser email ("a verified candidate is
// pursuing your {role}") with a link to /unlock/{token}. This page renders the
// anonymized framing + the signup CTA that turns the company into a Shapi
// account. We deliberately DO NOT expose the candidate's identity here — the
// reveal happens only after the company signs up (server-side hook resolves the
// token). See SPEC_ACTIVE_CROSSSELL.md §6 and memory:project_company_side_state.
//
// Reads the outreach row via the admin client because crosssell_outreach is
// service-role-only (RLS, no client policies). Mirrors the look of /c/[id].

import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

type OutreachRow = {
  company_name: string | null
  target_role: string | null
  status: string | null
  hm_name: string | null
}

async function loadOutreach(token: string): Promise<OutreachRow | null> {
  if (!token) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('crosssell_outreach')
    .select('company_name, target_role, status, hm_name')
    .eq('unlock_token', token)
    .limit(1)
  return (data?.[0] as OutreachRow | undefined) || null
}

// Terminal/used states → show the graceful expired view instead of the CTA.
function isSpent(status: string | null | undefined): boolean {
  return status === 'unlocked' || status === 'declined'
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const row = await loadOutreach(token)
  const role = row?.target_role || 'open role'
  return {
    title: row ? `A verified candidate is interested in your ${role} — Shapi` : 'Shapi',
    description: row
      ? `A Shapi-verified candidate is actively interested in your ${role}. Sign up free to unlock their name and contact.`
      : 'Verified job matching on Shapi.',
    openGraph: {
      title: row ? `A verified candidate is interested in your ${role}` : 'Shapi',
      description: 'Sign up free to unlock their verified profile, name and contact.',
    },
  }
}

const cardStyle = {
  background: '#0D0C14',
  border: '1px solid rgba(255,255,255,0.08)',
} as const

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060609]">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <nav className="relative z-10 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-4xl mx-auto">
        <Link
          href="/"
          className="font-black text-xl tracking-tighter"
          style={{
            background: 'linear-gradient(135deg, #38BDF8, #34D399)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          shapi
        </Link>
        <Link href="/roles" className="text-[#7E7E8E] text-sm hover:text-[#C7C7D1] transition-colors">
          Browse verified talent →
        </Link>
      </nav>
      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-12 pb-20">{children}</div>
    </div>
  )
}

export default async function UnlockPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const row = await loadOutreach(token)

  // Missing token or already-used invitation → friendly, non-dead-end state.
  if (!row || isSpent(row.status)) {
    return (
      <Shell>
        <div className="rounded-2xl p-8 md:p-10 text-center" style={cardStyle}>
          <p className="text-4xl mb-4">🔗</p>
          <h1 className="text-2xl font-black text-[#F4F4F7] mb-3">This invitation has expired</h1>
          <p className="text-[#A6A6B4] text-sm leading-relaxed max-w-md mx-auto mb-6">
            The candidate may have withdrawn it, or it&apos;s already been claimed. There are plenty more
            Shapi-verified candidates — every one with independently checked references and verified skills.
          </p>
          <Link
            href="/roles"
            className="inline-block px-6 py-3 rounded-full font-black text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}
          >
            Browse verified talent →
          </Link>
        </div>
      </Shell>
    )
  }

  const role = row.target_role || 'open role'
  const companyName = row.company_name || 'your company'
  const signupHref = `/signup?type=company&unlock=${encodeURIComponent(token)}`

  return (
    <Shell>
      {/* Header */}
      <div className="mb-8">
        <span
          className="inline-block text-xs font-bold px-3 py-1.5 rounded-full mb-4"
          style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.25)' }}
        >
          ✓ Verified candidate · actively interested
        </span>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-[#F4F4F7] leading-tight">
          A verified candidate is actively interested in your {role}
        </h1>
        <p className="text-[#A6A6B4] text-sm leading-relaxed mt-4 max-w-xl">
          They asked Shapi to share their profile with {companyName} for this exact role. Their references have been
          independently checked and their skills verified — this isn&apos;t a cold application, it&apos;s a vetted
          candidate raising their hand.
        </p>
      </div>

      {/* What you'll unlock — anonymized */}
      <div className="rounded-2xl p-6 mb-4" style={cardStyle}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-4">What you&apos;ll unlock</p>
        <ul className="space-y-3">
          {[
            ['🪪', 'Their name & contact details', 'Reach out directly — no recruiter in between.'],
            ['✓', 'Independently verified references', 'Sourced by Shapi, not hand-picked by the candidate.'],
            ['📊', 'Verified skill assessment', 'User / Integrator / Builder tier, evidence-backed.'],
            ['🎯', 'Why they fit this exact role', 'Their verified strengths mapped to your opening.'],
          ].map(([icon, title, body]) => (
            <li key={title} className="flex gap-3">
              <span className="flex-shrink-0 text-base">{icon}</span>
              <div>
                <p className="text-[#F4F4F7] text-sm font-bold">{title}</p>
                <p className="text-[#7E7E8E] text-xs leading-relaxed">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        {/* Blurred identity teaser — reinforces there's a real person behind this. */}
        <div className="mt-5 rounded-xl p-4 relative overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="select-none" style={{ filter: 'blur(6px)', opacity: 0.5 }}>
            <p className="text-[#F4F4F7] text-base font-black">████████ ██████</p>
            <p className="text-[#A6A6B4] text-sm">Verified candidate · {role}</p>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(6,6,9,0.7)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)' }}>
              🔒 Unlocks when you sign up
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-2xl p-6 text-center" style={cardStyle}>
        <Link
          href={signupHref}
          className="inline-block w-full md:w-auto px-8 py-4 rounded-full font-black text-base text-white"
          style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}
        >
          Sign up free to unlock their name &amp; contact
        </Link>
        <p className="text-[#7E7E8E] text-xs mt-4 leading-relaxed">
          Free to start — no card required. You&apos;ll get this candidate plus access to Shapi&apos;s pool of
          independently verified talent.
        </p>
      </div>

      {/* Trust footer */}
      <p className="text-[#5C5C6A] text-xs leading-relaxed mt-6 text-center max-w-lg mx-auto">
        Shapi is a two-sided verified job-matching platform. You received this because a verified candidate asked us
        to share their profile with you for your open {role}. We never share who responded to anything anonymously.
      </p>
    </Shell>
  )
}
