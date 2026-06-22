// Candidate-facing company page — the public side of the workplace trust score.
//
// The full CompanyTrustCard used to render ONLY on /company/profile (the company
// viewing itself). Candidates browsing /roles saw a one-line badge and had
// nowhere to click through. This is that click-through: the independent,
// anonymous workplace-trust breakdown + public signals + the company's open
// roles — exactly what a candidate needs to vet an employer before applying.
//
// Public (no auth), shareable, server-rendered. Reads via the admin client
// because the culture aggregate has no company-side SELECT policy (Plane B) and
// is only ever exposed as an anonymised aggregate. See memory:
// project_trust_score_model, public_signals_no_hide.

import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCultureAggregate } from '@/lib/culture-references'
import { getPrestigeForCompany, topAccolade } from '@/lib/company-prestige'
import CompanyTrustCard from '@/components/company/CompanyTrustCard'

// profiles.id is a UUID — support both a full UUID and the short 8-hex-char
// share prefix (matched as a UUID range). Mirrors /p/[id].
function uuidMatch(raw: string): { full: string } | { lo: string; hi: string } {
  const s = raw.trim().toLowerCase()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)) {
    return { full: s }
  }
  const hex = s.replace(/[^0-9a-f]/g, '').slice(0, 8)
  return {
    lo: `${hex.padEnd(8, '0')}-0000-0000-0000-000000000000`,
    hi: `${hex.padEnd(8, 'f')}-ffff-ffff-ffff-ffffffffffff`,
  }
}

const SELECT =
  'id, full_name, type, company_name, company_data, company_size, company_website, location, summary, industry'

async function loadCompany(idParam: string) {
  const admin = createAdminClient()
  const m = uuidMatch(idParam)
  let q = admin.from('profiles').select(SELECT)
  q = 'full' in m ? q.eq('id', m.full) : q.gte('id', m.lo).lte('id', m.hi)
  const { data } = await q.eq('type', 'company').limit(1)
  return (data?.[0] as Record<string, unknown> | undefined) || null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = await loadCompany(id)
  const name = (company?.company_name || company?.full_name) as string | undefined
  return {
    title: name ? `${name} — Workplace trust on Shapi` : 'Company — Shapi',
    description: name
      ? `Independent, anonymous workplace trust score for ${name}: paid-on-time, hours respected, manager quality, and more — sourced by Shapi from current & former employees.`
      : 'Independent workplace trust on Shapi',
  }
}

const cardStyle = {
  background: '#0D0C14',
  border: '1px solid rgba(255,255,255,0.08)',
} as const

export default async function PublicCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = await loadCompany(id)
  if (!company) notFound()

  const companyId = company.id as string
  const companyName = (company.company_name as string) || (company.full_name as string) || 'Company'
  const cd = (company.company_data || {}) as Record<string, unknown>

  const admin = createAdminClient()
  const [aggregate, rolesRes] = await Promise.all([
    getCultureAggregate(admin, companyId),
    admin
      .from('roles')
      .select('id, title, location, remote, engagement_type, created_at')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(12),
  ])
  const openRoles = (rolesRes.data as Array<Record<string, unknown>> | null) || []

  const glassdoor = cd.glassdoor_rating != null ? Number(cd.glassdoor_rating) : null
  const redditSentiment = cd.reddit_sentiment as string | undefined
  const prestige = getPrestigeForCompany(companyName)
  const accolade = prestige ? topAccolade(prestige) : null

  const industry = (company.industry as string) || (cd.industry as string | undefined) || null
  const size = (company.company_size as string) || (cd.size as string | undefined) || null
  const location = (company.location as string) || (cd.headquarters as string | undefined) || null
  const about = (company.summary as string) || (cd.description as string | undefined) || null

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
          Browse verified roles →
        </Link>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-20">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-[#F4F4F7]">{companyName}</h1>
            {accolade && (
              <span
                title={accolade.tooltip}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full cursor-help"
                style={
                  {
                    gold: { background: 'rgba(251,191,36,0.13)', color: '#D97706' },
                    teal: { background: 'rgba(56,189,248,0.12)', color: '#38BDF8' },
                    purple: { background: 'rgba(56,189,248,0.13)', color: '#38BDF8' },
                  }[accolade.tone]
                }
              >
                ★ {accolade.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-[#7E7E8E] flex-wrap">
            {industry && <span>{industry}</span>}
            {size && <span>· {size}</span>}
            {location && <span>· 📍 {location}</span>}
            {company.company_website ? (
              <a
                href={
                  String(company.company_website).startsWith('http')
                    ? (company.company_website as string)
                    : `https://${company.company_website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#38BDF8] hover:underline"
              >
                Website ↗
              </a>
            ) : null}
          </div>
          {about && <p className="text-[#A6A6B4] text-sm leading-relaxed mt-4 max-w-2xl">{about}</p>}
        </div>

        {/* Public signals — ALWAYS visible, the company cannot hide these. */}
        {(glassdoor != null || redditSentiment) && (
          <div className="rounded-2xl p-6 mb-4" style={cardStyle}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-3">Public signals</p>
            <div className="flex flex-wrap gap-3">
              {glassdoor != null && (
                <div className="bg-[#38BDF8]/10 rounded-xl px-4 py-3 text-center min-w-[100px]">
                  <p className="text-2xl font-black text-[#38BDF8]">{glassdoor}</p>
                  <p className="text-[10px] text-[#7E7E8E]">Glassdoor</p>
                </div>
              )}
              {redditSentiment && (
                <div
                  className={`rounded-xl px-4 py-3 text-center min-w-[100px] ${
                    redditSentiment === 'positive'
                      ? 'bg-[#34D399]/15'
                      : redditSentiment === 'negative'
                        ? 'bg-[#FB7185]/15'
                        : 'bg-[#FBBF24]/15'
                  }`}
                >
                  <p
                    className={`text-base font-black capitalize ${
                      redditSentiment === 'positive'
                        ? 'text-[#34D399]'
                        : redditSentiment === 'negative'
                          ? 'text-[#FB7185]'
                          : 'text-[#FBBF24]'
                    }`}
                  >
                    {redditSentiment}
                  </p>
                  <p className="text-[10px] text-[#7E7E8E]">Reddit sentiment</p>
                </div>
              )}
            </div>
            <p className="text-[#7E7E8E] text-[10px] mt-3">
              Synthesised from public ratings &amp; mentions. Shown to every candidate — companies can&apos;t edit or
              remove them.
            </p>
          </div>
        )}

        {/* The independent workplace trust score — the reason this page exists. */}
        <div className="mb-4">
          <CompanyTrustCard companyName={companyName} aggregate={aggregate} glassdoor={glassdoor} />
        </div>

        {/* Open roles */}
        <div className="rounded-2xl p-6 mb-4" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E]">
              Open roles{openRoles.length ? ` · ${openRoles.length}` : ''}
            </p>
            <Link href="/roles" className="text-[#38BDF8] text-xs font-bold hover:underline">
              All verified roles →
            </Link>
          </div>
          {openRoles.length === 0 ? (
            <p className="text-[#7E7E8E] text-sm">No open roles right now.</p>
          ) : (
            <div className="space-y-2">
              {openRoles.map((r) => (
                <Link
                  key={r.id as string}
                  href="/roles"
                  className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.03]"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="min-w-0">
                    <p className="text-[#F4F4F7] text-sm font-bold truncate">{r.title as string}</p>
                    <p className="text-[#7E7E8E] text-xs">
                      {[r.location as string | null, (r.remote as boolean) ? 'Remote OK' : null]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                  {r.engagement_type && r.engagement_type !== 'permanent' && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0"
                      style={{ background: 'rgba(56,189,248,0.14)', color: '#38BDF8' }}
                    >
                      {r.engagement_type === 'temp' ? 'Temp / Shift' : (r.engagement_type as string)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* How Shapi builds this — reinforces the independence/anonymity moat */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#7E7E8E] mb-2">
            How this trust score works
          </p>
          <p className="text-[#A6A6B4] text-sm leading-relaxed">
            Shapi independently surveys {companyName}&apos;s current &amp; former employees across 9 dimensions —
            anonymously, and without the company&apos;s involvement. {companyName} sees only the combined averages,
            never who responded or any individual answer, and a score only appears once at least 3 people have replied.
            That&apos;s the picture you wish you had before accepting an offer.
          </p>
          <Link
            href="/roles"
            className="inline-block mt-4 px-5 py-2.5 rounded-full font-black text-xs text-white"
            style={{ background: 'linear-gradient(135deg, #38BDF8, #34D399)' }}
          >
            See verified roles →
          </Link>
        </div>
      </div>
    </div>
  )
}
