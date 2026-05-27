import { createAdminClient } from '@/lib/supabase/admin'
import CultureSurveyForm from './CultureSurveyForm'

export const metadata = {
  title: 'Anonymous culture survey — Shapi',
  description: 'Share your perspective on what it was really like working here.',
}

// 90-day token expiry: links sent more than 90 days ago no longer work.
const TOKEN_TTL_DAYS = 90

function isExpired(invitedAt: string | null): boolean {
  if (!invitedAt) return true
  const invited = new Date(invitedAt).getTime()
  if (Number.isNaN(invited)) return true
  return Date.now() - invited > TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0E0E13]">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <nav className="relative z-10 px-6 py-4 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between max-w-3xl mx-auto">
        <a
          href="https://shapi.io"
          className="font-black text-xl tracking-tighter"
          style={{
            background: 'linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          shapi
        </a>
        <span className="text-[#7E7E8E] text-xs">Anonymous · aggregated</span>
      </nav>
      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-10 pb-20">{children}</div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .culture-card {
          background: linear-gradient(#16161F, #16161F) padding-box,
                      linear-gradient(135deg, rgba(251,113,133,0.28), rgba(240,140,174,0.18)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.35);
        }
      `}</style>
      <div className="culture-card rounded-3xl p-8">{children}</div>
    </>
  )
}

export default async function CultureSurveyPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('company_culture_references')
    .select('id, token, invited_at, submitted_at, company_id')
    .eq('token', token)
    .maybeSingle()

  if (!row) {
    return (
      <Shell>
        <Card>
          <h1 className="text-3xl font-black mb-3" style={{ color: '#FB7185' }}>
            This link isn&apos;t valid.
          </h1>
          <p className="text-[#C7C7D1] text-base leading-relaxed">
            The survey link you opened doesn&apos;t match anything in our system. It may have been mistyped, or
            the invite may have been withdrawn. If you believe this is a mistake, reply to the email it came in.
          </p>
        </Card>
      </Shell>
    )
  }

  if (row.submitted_at) {
    return (
      <Shell>
        <Card>
          <h1 className="text-3xl font-black mb-3" style={{ color: '#FB7185' }}>
            You&apos;ve already shared your perspective.
          </h1>
          <p className="text-[#C7C7D1] text-base leading-relaxed">
            Thank you — your response is in. Every survey link is single-use to keep the aggregate honest, so
            this page won&apos;t accept another submission.
          </p>
        </Card>
      </Shell>
    )
  }

  if (isExpired(row.invited_at)) {
    return (
      <Shell>
        <Card>
          <h1 className="text-3xl font-black mb-3" style={{ color: '#FB7185' }}>
            This link has expired.
          </h1>
          <p className="text-[#C7C7D1] text-base leading-relaxed">
            Culture invites are valid for 90 days. If you&apos;d still like to share your perspective, reply to
            the email and ask the company to re-send the invite.
          </p>
        </Card>
      </Shell>
    )
  }

  // Fetch company display name (best effort — don't block on it)
  const { data: companyProfile } = await admin
    .from('profiles')
    .select('company_name, full_name')
    .eq('id', row.company_id)
    .maybeSingle()

  const companyName =
    (companyProfile?.company_name as string | undefined) ||
    (companyProfile?.full_name as string | undefined) ||
    'this company'

  return (
    <Shell>
      <Card>
        <h1 className="text-3xl font-black mb-3" style={{ color: '#FB7185' }}>
          What was it really like at {companyName}?
        </h1>
        <p className="text-[#C7C7D1] text-base leading-relaxed mb-2">
          Three questions. Anonymous. Aggregated with other past and current employees, so no single answer
          can be traced back to you.
        </p>
        <p className="text-[#7E7E8E] text-sm leading-relaxed mb-6">
          {companyName} sees the combined picture only — never your individual answers, never that you took part.
        </p>
        <CultureSurveyForm token={token} companyName={companyName} />
      </Card>
    </Shell>
  )
}
