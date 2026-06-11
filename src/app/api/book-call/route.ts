// Handles enterprise / Strategic Workforce Plan call-booking requests.
// Replaces the mailto: link that previously sent users into an OS app-picker
// dead-end.
//
// On submit:
//   1. INSERT into book_call_requests (so the lead survives even if Resend
//      is down, and /admin gets a triage table)
//   2. Email ANA the request details, reply-to set to the requester
//   3. Email the REQUESTER a confirmation so they know the request landed
//
// Auth-optional — public landing pages link here too.

import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TO = 'ana.vbarber@gmail.com'

// Reply-to on outbound emails. We brand from hello@shapi.io but until
// Cloudflare Email Routing / ImprovMX forwards hello@shapi.io → Ana's
// Gmail, replies to that address vanish. SHAPI_REPLY_EMAIL env var
// overrides; default falls through to Ana's reachable inbox so we don't
// orphan replies during the pre-launch / pre-forwarding window.
const REPLY_TO_SHAPI = process.env.SHAPI_REPLY_EMAIL || 'ana.vbarber@gmail.com'

export async function POST(request: Request) {
  let body: {
    name?: string; email?: string; company?: string; role?: string
    company_size?: string; timeline?: string; message?: string; topic?: string
    engagement_id?: string
  } = {}
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const name = (body.name || '').trim()
  const email = (body.email || '').trim()
  const company = (body.company || '').trim()
  if (!name || !email || !company) {
    return NextResponse.json({ error: 'Name, email, and company are required.' }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'That email doesn\'t look valid.' }, { status: 400 })
  }

  const role = (body.role || '').trim()
  const companySize = (body.company_size || '').trim()
  const timeline = (body.timeline || '').trim()
  const message = (body.message || '').trim().slice(0, 4000)
  const topic = (body.topic || '').trim() || 'strategy-call'
  const engagementId = (body.engagement_id || '').trim() || null

  const topicLabel = topic === 'strategic-plan' ? 'Strategic Workforce Plan enquiry'
    : topic === 'snapshot-followup' ? 'Workforce Snapshot follow-up'
    : topic === 'workforce-os' ? 'Workforce monitoring enquiry'
    : topic === 'workforce-intelligence' ? 'Workforce Intelligence enquiry'
    : topic === 'founder-session' ? 'Founder session (included with engagement)'
    : 'Strategy call request'

  // 1. Persist the request first — the email layer is best-effort. Even if
  // Resend is down, the lead is in our database + visible on /admin.
  let leadId: string | null = null
  try {
    // Use the signed-in user's id if available so we can link the lead to
    // their existing account on /admin.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const admin = createAdminClient()
    // If this booking is tied to a Strategic Workforce Plan engagement,
    // prefix the message so Ana sees the linkage on /admin without adding
    // a new column to book_call_requests.
    const messageWithContext = engagementId
      ? `[Engagement: ${engagementId.slice(0, 8)}]${message ? '\n\n' + message : ''}`
      : (message || null)
    const { data: row } = await admin
      .from('book_call_requests')
      .insert({
        user_id: user?.id || null,
        name, email, company, role: role || null,
        company_size: companySize || null,
        timeline: timeline || null,
        message: messageWithContext,
        topic: topic || 'strategy-call',
      })
      .select('id')
      .single()
    if (row) leadId = row.id as string
  } catch (e) {
    // Table may not be migrated yet — log + continue. Email is still tried.
    console.warn('[book-call] persist skipped (run supabase/book_call_requests.sql):', e)
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[book-call] RESEND_API_KEY missing — cannot send notification')
    // Still a success from the user's perspective if we logged the request.
    if (leadId) return NextResponse.json({ success: true, persisted: true })
    return NextResponse.json({ error: 'Booking system unavailable — email hello@shapi.io directly.' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const subject = `[Shapi · ${topicLabel}] ${company} — ${name}`

  // Plain-text fallback + a tidy HTML body. The HTML matches the existing
  // hello@shapi.io style so it doesn't look like a different system.
  const text = [
    `New booking request via /book-call`,
    ``,
    `Name:     ${name}`,
    `Email:    ${email}`,
    `Company:  ${company}`,
    role ? `Role:     ${role}` : null,
    companySize ? `Size:     ${companySize}` : null,
    timeline ? `Timeline: ${timeline}` : null,
    `Topic:    ${topicLabel}`,
    engagementId ? `Engagement: ${engagementId}` : null,
    ``,
    message ? `--- Message ---\n${message}` : '(No message provided)',
  ].filter(Boolean).join('\n')

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#060609;border-radius:16px;color:#F4F4F7">
      <p style="font-size:22px;font-weight:900;letter-spacing:-0.5px;margin:0 0 22px;background:linear-gradient(135deg, #9D8CFF, #34D399);-webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</p>
      <div style="background:#0D0C14;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:24px">
        <p style="font-size:10px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#9D8CFF;margin:0 0 6px">${topicLabel}</p>
        <h1 style="font-size:20px;font-weight:900;margin:0 0 18px">${escape(company)} — ${escape(name)}</h1>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#C7C7D1">
          <tr><td style="padding:6px 0;color:#7E7E8E;width:90px">Email</td><td><a href="mailto:${escape(email)}" style="color:#9D8CFF">${escape(email)}</a></td></tr>
          ${role ? `<tr><td style="padding:6px 0;color:#7E7E8E">Role</td><td>${escape(role)}</td></tr>` : ''}
          ${companySize ? `<tr><td style="padding:6px 0;color:#7E7E8E">Size</td><td>${escape(companySize)}</td></tr>` : ''}
          ${timeline ? `<tr><td style="padding:6px 0;color:#7E7E8E">Timeline</td><td>${escape(timeline)}</td></tr>` : ''}
        </table>
        ${message ? `<div style="margin-top:18px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.06)">
          <p style="font-size:10px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#7E7E8E;margin:0 0 8px">Message</p>
          <p style="font-size:13px;line-height:1.6;white-space:pre-wrap;margin:0">${escape(message)}</p>
        </div>` : ''}
      </div>
      <p style="color:rgba(255,255,255,0.30);font-size:11px;margin-top:16px;text-align:center">Reply to this email — it&apos;ll go straight to ${escape(email)}.</p>
    </div>
  `

  // 2. Notification to ANA — what landed + reply-to set so she can reply
  // straight back from her inbox without re-typing the address.
  try {
    await resend.emails.send({
      from: 'Shapi <hello@shapi.io>',
      to: TO,
      replyTo: email,
      subject,
      text,
      html,
    })
  } catch (err) {
    console.error('[book-call] resend (notify) failed:', err)
    // Persisted lead means it isn't lost — but tell the user about the email issue.
    if (leadId) return NextResponse.json({ success: true, persisted: true, note: 'email delayed' })
    return NextResponse.json({ error: 'Couldn\'t send the request — email hello@shapi.io directly.' }, { status: 502 })
  }

  // 3. Confirmation to the REQUESTER — they need to know the request landed
  // so they're not left wondering. Best-effort; not a hard failure if it
  // doesn't go through. Includes the Calendly link if configured so they
  // can self-book a time immediately rather than wait for Ana's reply.
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || process.env.CALENDLY_URL || ''
  try {
    const firstName = name.split(' ')[0] || 'there'
    const calendlyBlockHtml = calendlyUrl
      ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);text-align:center">
           <p style="font-size:13px;color:#C7C7D1;margin:0 0 12px">Pick a time that suits you — your invite lands instantly:</p>
           <a href="${escape(calendlyUrl)}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg, #9D8CFF, #34D399);color:#fff;font-size:13px;font-weight:900;border-radius:100px;text-decoration:none">Book a time →</a>
         </div>`
      : ''
    const calendlyBlockText = calendlyUrl
      ? `\n\nPick a time that suits you — invite lands instantly:\n${calendlyUrl}`
      : `\n\nWe’ll reply within one business day with two or three time slots that suit your timezone.`

    await resend.emails.send({
      from: 'Shapi <hello@shapi.io>',
      to: email,
      replyTo: REPLY_TO_SHAPI,
      subject: `We got your request — speak soon, ${firstName}`,
      text: `Hi ${firstName},\n\nThanks for reaching out about ${topicLabel}. We've got your request.${calendlyBlockText}\n\nIf you want to add anything else before the call, just reply to this email.\n\n— The Shapi team\nshapi.io`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#060609;border-radius:16px;color:#F4F4F7">
          <p style="font-size:22px;font-weight:900;letter-spacing:-0.5px;margin:0 0 22px;background:linear-gradient(135deg, #9D8CFF, #34D399);-webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</p>
          <div style="background:#0D0C14;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:24px">
            <h1 style="font-size:20px;font-weight:900;margin:0 0 12px">Got it — speak soon, ${escape(firstName)}.</h1>
            <p style="font-size:14px;line-height:1.6;color:#C7C7D1;margin:0 0 4px">
              Thanks for reaching out about <strong style="color:#F4F4F7">${escape(topicLabel)}</strong>. We've got your request.
            </p>
            ${calendlyBlockHtml}
            <p style="font-size:12px;line-height:1.6;color:#7E7E8E;margin:18px 0 0">
              If you want to add anything else before the call, just reply to this email.
            </p>
          </div>
          <p style="color:rgba(255,255,255,0.30);font-size:11px;margin-top:16px;text-align:center">shapi.io — the verified hiring platform</p>
        </div>
      `,
    })
  } catch (err) {
    console.warn('[book-call] resend (confirm-to-requester) failed:', err)
    // Don't fail the request — the user already saw the success UI. Ana
    // still has the notification email.
  }

  return NextResponse.json({ success: true, persisted: !!leadId })
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
