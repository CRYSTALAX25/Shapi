const OPENING_MESSAGE = (name: string) =>
  `Hi ${name} 👋 I'm Shapi. I just read your CV.\n\nI want to build you a profile that actually shows who you are — not just job titles.\n\nQuick question: What's the achievement you're most proud of from the last 3 years? Something that made you think "I actually did that."\n\nText back or leave a voice note — whatever's easier.`

const NO_CV_MESSAGE = (name: string) =>
  `Hi ${name} 👋 I'm Shapi.\n\nNo CV needed — we'll build your profile together through this conversation.\n\nLet's start: What's your current or most recent job title, and where are you based?`

async function twilioSend(from: string, to: string, body: string): Promise<{ success: boolean; sid?: string; errorCode?: number; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) return { success: false, error: 'Twilio env vars not configured' }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
      }
    )
    const data = await res.json()
    if (!res.ok) return { success: false, errorCode: data.code, error: data.message }
    return { success: true, sid: data.sid }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ── WhatsApp (via Twilio WhatsApp Business number) ───────────────────────────
export async function sendWhatsApp(to: string, message: string): Promise<{ success: boolean; error?: string }> {
  const from = process.env.TWILIO_WHATSAPP_FROM
  if (!from) { console.error('[WhatsApp] TWILIO_WHATSAPP_FROM not set'); return { success: false, error: 'Not configured' } }

  const cleaned = to.replace(/\s/g, '')
  const recipient = cleaned.startsWith('whatsapp:') ? cleaned : `whatsapp:${cleaned}`
  console.log('[WhatsApp] Sending to:', recipient)

  const result = await twilioSend(from, recipient, message)
  if (result.success) { console.log('[WhatsApp] Sent OK, SID:', result.sid); return { success: true } }
  console.error('[WhatsApp] Error:', result.error, '| code:', result.errorCode)
  return { success: false, error: result.error }
}

// ── WhatsApp with media attachment (PDF, image, etc.) ────────────────────────
// Twilio fetches the MediaUrl and delivers as an attachment in the WhatsApp
// message. Max 16MB per file, one MediaUrl per message.
export async function sendWhatsAppMedia(to: string, caption: string, mediaUrl: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM
  if (!accountSid || !authToken || !from) {
    return { success: false, error: 'Twilio env vars not configured' }
  }

  const cleaned = to.replace(/\s/g, '')
  const recipient = cleaned.startsWith('whatsapp:') ? cleaned : `whatsapp:${cleaned}`
  console.log('[WhatsApp media] Sending to:', recipient, '| media:', mediaUrl)

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: from, To: recipient, Body: caption, MediaUrl: mediaUrl }).toString(),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      console.error('[WhatsApp media] Twilio error:', data.message, '| code:', data.code)
      return { success: false, error: data.message }
    }
    console.log('[WhatsApp media] Sent OK, SID:', data.sid)
    return { success: true, sid: data.sid }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ── SMS — falls back through TWILIO_SMS_FROM → TWILIO_FROM → TWILIO_WHATSAPP_FROM (stripped) ───
export async function sendSMS(to: string, message: string): Promise<{ success: boolean; error?: string }> {
  const raw = process.env.TWILIO_SMS_FROM || process.env.TWILIO_FROM || process.env.TWILIO_WHATSAPP_FROM
  const from = raw?.replace(/^whatsapp:/, '') || null
  if (!from) { console.warn('[SMS] No SMS number configured — SMS skipped'); return { success: false, error: 'SMS not configured' } }

  const cleaned = to.replace(/\s/g, '').replace(/^whatsapp:/, '')
  console.log('[SMS] Sending to:', cleaned)

  const result = await twilioSend(from, cleaned, message)
  if (result.success) { console.log('[SMS] Sent OK, SID:', result.sid); return { success: true } }
  console.error('[SMS] Error:', result.error)
  return { success: false, error: result.error }
}

// ── Reference outreach — WhatsApp first, SMS fallback, always log ─────────────
// Both channels are tried if phone is provided. Email is sent separately by the caller.
export async function sendReferenceOutreach(opts: {
  phone: string
  message: string
  label: string  // for logging only e.g. 'manager ref slot 1'
}): Promise<{ whatsapp: boolean; sms: boolean }> {
  const { phone, message, label } = opts

  // Try WhatsApp first
  const wa = await sendWhatsApp(phone, message)
  if (wa.success) {
    console.log(`[ref-outreach] WhatsApp OK — ${label}`)
    return { whatsapp: true, sms: false }
  }

  console.log(`[ref-outreach] WhatsApp failed for ${label}, trying SMS…`)
  const sms = await sendSMS(phone, message)
  console.log(`[ref-outreach] SMS ${sms.success ? 'OK' : 'failed'} — ${label}`)
  return { whatsapp: false, sms: sms.success }
}

export { OPENING_MESSAGE, NO_CV_MESSAGE }
