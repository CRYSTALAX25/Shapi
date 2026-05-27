import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import crypto from 'crypto'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'
const FROM = 'Shapi <hello@shapi.io>'
const MAX_INVITES_PER_REQUEST = 20

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

function newToken(): string {
  // 32 bytes → 64-char hex token, unguessable
  return crypto.randomBytes(32).toString('hex')
}

function getInviteIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip') || null
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function inviteEmailHtml(companyName: string, surveyUrl: string) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060609;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="margin-bottom:32px">
      <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;
                   background:linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A);
                   -webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</span>
    </div>
    <div style="background:#0d0d14;border:1px solid rgba(251,113,133,0.18);border-radius:16px;padding:32px">
      <h1 style="color:#FB7185;font-size:22px;font-weight:900;margin:0 0 12px">Two minutes on what it&apos;s really like at ${companyName}.</h1>
      <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 16px">
        You worked at <strong style="color:rgba(255,255,255,0.8)">${companyName}</strong>. Shapi is the verified hiring platform candidates use to vet companies before they apply — and your perspective shapes what they see.
      </p>
      <p style="color:rgba(255,255,255,0.55);font-size:15px;line-height:1.65;margin:0 0 16px">
        Three questions. Anonymous. Aggregated with other employees so no single voice can be picked out.
      </p>
      <div style="background:rgba(251,113,133,0.06);border:1px solid rgba(251,113,133,0.18);border-radius:10px;padding:14px 18px;margin:18px 0">
        <p style="color:#FB7185;font-size:13px;font-weight:700;margin:0">
          Paid on time · Real hours respected · Manager quality
        </p>
      </div>
      <a href="${surveyUrl}" style="display:inline-block;margin-top:4px;padding:14px 28px;
        background:linear-gradient(135deg,#FB7185,#F08CAE);color:#0E0E13;font-size:14px;
        font-weight:900;border-radius:100px;text-decoration:none">Share your perspective →</a>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:24px 0">
      <p style="color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6;margin:0">
        Your response is anonymous. ${companyName} sees only the aggregate, never your individual answers, and never that you took part. The link is single-use.
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.2);font-size:12px;margin-top:24px;text-align:center">
      Shapi · Verification layer for hiring · <a href="${SITE}" style="color:rgba(255,255,255,0.3);text-decoration:none">shapi.io</a>
    </p>
  </div>
</body></html>`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: company } = await supabase
    .from('profiles')
    .select('type, company_name, full_name')
    .eq('id', user.id)
    .single()

  if (!company || company.type !== 'company') {
    return NextResponse.json({ error: 'Company account required' }, { status: 403 })
  }

  let body: { emails?: unknown } = {}
  try { body = await request.json() } catch {}

  const rawEmails = Array.isArray(body.emails) ? body.emails : []
  const emails = [...new Set(
    rawEmails
      .filter((e): e is string => typeof e === 'string')
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0 && isValidEmail(e)),
  )]

  if (emails.length === 0) {
    return NextResponse.json({ error: 'Provide at least one valid email' }, { status: 400 })
  }
  if (emails.length > MAX_INVITES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Cap is ${MAX_INVITES_PER_REQUEST} invites per request` },
      { status: 400 },
    )
  }

  const inviteIp = getInviteIp(request.headers)
  const companyName = company.company_name || company.full_name || 'this company'
  const admin = createAdminClient()
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

  let sent = 0
  const failed: string[] = []

  for (const email of emails) {
    const token = newToken()
    const surveyUrl = `${SITE}/culture/${token}`

    const { error: insertError } = await admin
      .from('company_culture_references')
      .insert({
        company_id: user.id,
        token,
        invited_email_hash: hashEmail(email),
        invite_ip: inviteIp,
      })

    if (insertError) {
      console.error('[culture-references/invite] insert', email, insertError.message)
      failed.push(email)
      continue
    }

    if (!resend) {
      // No mailer configured — count as failed so caller knows nothing went out.
      failed.push(email)
      continue
    }

    try {
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: `Two minutes on what it's like at ${companyName}`,
        html: inviteEmailHtml(companyName, surveyUrl),
      })
      sent++
    } catch (err) {
      console.error('[culture-references/invite] send', email, err)
      failed.push(email)
    }
  }

  return NextResponse.json({ ok: true, sent, failed })
}
