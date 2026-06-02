// Handles enterprise / Strategic Workforce Plan call-booking requests.
// Replaces the mailto: link that previously sent users into an OS app-picker
// dead-end. Fires a Resend email to Ana with the form context so she can
// reply with time slots. Auth-optional — public landing pages link here too.

import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const TO = 'ana.vbarber@gmail.com'

export async function POST(request: Request) {
  let body: {
    name?: string; email?: string; company?: string; role?: string
    company_size?: string; timeline?: string; message?: string; topic?: string
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

  const topicLabel = topic === 'strategic-plan' ? 'Strategic Workforce Plan enquiry'
    : topic === 'snapshot-followup' ? 'Workforce Snapshot follow-up'
    : topic === 'workforce-os' ? 'Workforce monitoring enquiry'
    : 'Strategy call request'

  if (!process.env.RESEND_API_KEY) {
    console.error('[book-call] RESEND_API_KEY missing — cannot send notification')
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
    ``,
    message ? `--- Message ---\n${message}` : '(No message provided)',
  ].filter(Boolean).join('\n')

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#0E0E13;border-radius:16px;color:#F4F4F7">
      <p style="font-size:22px;font-weight:900;letter-spacing:-0.5px;margin:0 0 22px;background:linear-gradient(135deg,#6AA8F5,#F08CAE,#F58E9A);-webkit-background-clip:text;-webkit-text-fill-color:transparent">shapi</p>
      <div style="background:#16161F;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:24px">
        <p style="font-size:10px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#F08CAE;margin:0 0 6px">${topicLabel}</p>
        <h1 style="font-size:20px;font-weight:900;margin:0 0 18px">${escape(company)} — ${escape(name)}</h1>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#C7C7D1">
          <tr><td style="padding:6px 0;color:#7E7E8E;width:90px">Email</td><td><a href="mailto:${escape(email)}" style="color:#6AA8F5">${escape(email)}</a></td></tr>
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
    console.error('[book-call] resend failed:', err)
    return NextResponse.json({ error: 'Couldn\'t send the request — email hello@shapi.io directly.' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
