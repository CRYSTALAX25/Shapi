import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// Can be called by a cron job weekly, or triggered manually from admin panel
// Secret header prevents unauthorized calls
export const maxDuration = 60

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

type Candidate = {
  id: string
  full_name: string | null
  headline: string | null
  location: string | null
  skills: string[]
  completion_pct: number
  industry: string | null
}

type Role = {
  id: string
  title: string
  department: string | null
  location: string | null
  requirements: string | null
  description: string | null
}

function scoreCandidate(c: Candidate, r: Role): number {
  let score = 0
  const reqText = `${r.requirements || ''} ${r.description || ''} ${r.title}`.toLowerCase()
  const skills = (c.skills || []).map(s => s.toLowerCase())
  if (skills.length > 0) {
    const hits = skills.filter(s => {
      const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`\\b${esc}\\b`).test(reqText)
    }).length
    score += Math.round((hits / skills.length) * 50)
  }
  if (r.location && c.location) {
    const rl = r.location.toLowerCase(); const cl = c.location.toLowerCase()
    if (rl.includes(cl) || cl.includes(rl)) score += 20
    else if (rl.split(/[\s,]+/).some(w => w.length > 2 && cl.includes(w))) score += 10
  } else if (!r.location) score += 10
  const dept = `${r.department || ''} ${r.title}`.toLowerCase()
  const head = `${c.headline || ''} ${c.industry || ''}`.toLowerCase()
  if (dept.split(/\s+/).filter(w => w.length > 3).some(w => head.includes(w))) score += 15
  score += Math.round((c.completion_pct / 100) * 15)
  return Math.min(score, 100)
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-digest-secret')
  if (secret !== process.env.DIGEST_SECRET && secret !== 'manual-admin-trigger') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'No Resend key' }, { status: 500 })

  const admin = createAdminClient()
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Fetch all paid companies with active roles
  const { data: companies } = await admin
    .from('profiles')
    .select('id, company_name, full_name, paid, subscription_status')
    .eq('type', 'company')
    .eq('paid', true)
    .eq('subscription_status', 'active')

  if (!companies?.length) return NextResponse.json({ sent: 0 })

  // Fetch all verified candidates
  const { data: candidates } = await admin
    .from('profiles')
    .select('id, full_name, headline, location, skills, completion_pct, industry')
    .eq('type', 'candidate')
    .gte('completion_pct', 30)
    .order('completion_pct', { ascending: false })
    .limit(300)

  let sent = 0

  for (const company of companies) {
    // Get company's active roles
    const { data: roles } = await admin
      .from('roles')
      .select('id, title, department, location, requirements, description')
      .eq('company_id', company.id)
      .eq('status', 'active')
      .limit(3)

    if (!roles?.length) continue

    // Get company auth email
    const { data: authUser } = await admin.auth.admin.getUserById(company.id)
    const email = authUser?.user?.email
    if (!email) continue

    const companyName = company.company_name || company.full_name || 'your company'
    const topRole = roles[0]

    // Score candidates against top role, take top 3
    const scored = (candidates || [])
      .map(c => ({ ...c, score: scoreCandidate(c as Candidate, topRole as Role) }))
      .filter(c => c.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    if (!scored.length) continue

    const matchLabel = (s: number) =>
      s >= 75 ? 'Strong match' : s >= 50 ? 'Good match' : 'Possible match'
    const matchColor = (s: number) =>
      s >= 75 ? '#34D399' : s >= 50 ? '#9D8CFF' : '#9D8CFF'

    const candidateRows = scored.map(c => `
      <div style="background:#0D0C14;border:1px solid rgba(157, 140, 255, 0.1);border-radius:12px;padding:16px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <p style="color:rgba(255,255,255,0.8);font-weight:700;font-size:15px;margin:0 0 2px">Verified Candidate</p>
            <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0">${c.headline || '—'}</p>
            ${c.location ? `<p style="color:rgba(255,255,255,0.25);font-size:12px;margin:4px 0 0">📍 ${c.location}</p>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:22px;font-weight:900;color:${matchColor(c.score)}">${c.score}%</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.3)">match</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          <span style="background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4);font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700">${matchLabel(c.score)}</span>
          ${(c.skills || []).slice(0, 3).map((s: string) => `<span style="background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.35);font-size:11px;padding:2px 8px;border-radius:999px">${s}</span>`).join('')}
        </div>
        <a href="${SITE}/company/dashboard" style="font-size:12px;color:#9D8CFF;font-weight:700;text-decoration:none">View profile →</a>
      </div>
    `).join('')

    const html = `
      <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;background:#060609">
        <p style="font-size:22px;font-weight:900;letter-spacing:-0.5px;margin:0 0 24px;
          background:linear-gradient(135deg, #9D8CFF, #34D399);-webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</p>
        <div style="background:#0D0C14;border:1px solid rgba(157, 140, 255, 0.15);border-radius:16px;padding:28px">
          <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 6px">Your weekly talent digest</h1>
          <p style="color:rgba(255,255,255,0.4);font-size:14px;margin:0 0 20px">
            Top ${scored.length} candidate${scored.length !== 1 ? 's' : ''} matched to your <strong style="color:rgba(255,255,255,0.6)">${topRole.title}</strong> role this week
          </p>
          ${candidateRows}
          <a href="${SITE}/company/dashboard" style="display:inline-block;margin-top:8px;padding:13px 26px;
            background:linear-gradient(135deg,#9D8CFF, #34D399);color:#060609;font-size:14px;
            font-weight:900;border-radius:100px;text-decoration:none">
            View all matches →
          </a>
        </div>
        <p style="color:rgba(255,255,255,0.15);font-size:12px;margin-top:20px;text-align:center">
          ${companyName} · Shapi weekly digest · <a href="${SITE}" style="color:rgba(255,255,255,0.2);text-decoration:none">shapi.io</a>
        </p>
      </div>
    `

    await resend.emails.send({
      from: 'Shapi <hello@shapi.io>',
      to: email,
      subject: `${scored.length} new match${scored.length !== 1 ? 'es' : ''} for your ${topRole.title} role — weekly digest`,
      html,
    }).catch(err => console.error('[digest] email failed for', company.id, err))

    sent++
  }

  return NextResponse.json({ sent, companies: companies.length })
}
