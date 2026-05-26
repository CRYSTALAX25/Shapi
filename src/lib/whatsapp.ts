// Sent once at the very start of a candidate's WhatsApp chat (see profile/update
// + whatsapp/resend). Appended to both welcome messages so candidates learn the
// commands in context — NOT repeated on later interview turns.
const COMMAND_HINTS =
  `\n\n💡 Quick tip — anytime you can say: "skip" to move on · "repeat" to hear a question again · "voice" to record a voice note in any language · "references" to check your reference status · or just ask me anything.`

const OPENING_MESSAGE = (name: string) =>
  `Hi ${name} 👋 I'm Shapi. I just read your CV.\n\nI want to build you a profile that actually shows who you are — not just job titles.\n\nQuick question: What's the achievement you're most proud of from the last 3 years? Something that made you think "I actually did that."\n\nText back or leave a voice note — whatever's easier.${COMMAND_HINTS}`

const NO_CV_MESSAGE = (name: string) =>
  `Hi ${name} 👋 I'm Shapi.\n\nNo CV needed — we'll build your profile together through this conversation.\n\nLet's start: What's your current or most recent job title, and where are you based?${COMMAND_HINTS}`

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

// ── Daily digest message builder ─────────────────────────────────────────────
// Short, warm summary sent once per day to opted-in subscribers. Hides any
// line whose count is 0; returns null when there's literally nothing to say
// so the caller can skip the send instead of pinging an empty digest.
//
// Kept deliberately tight (< ~600 chars) so WhatsApp doesn't truncate and the
// candidate can scan it in one breath.
export function buildDigestMessage(opts: {
  firstName?: string | null
  upcomingInterviewsCount: number
  needFeedbackCount: number
  pendingDraftsCount: number
  pendingRefsCount: number
  // Saved but not started yet (status='interested' AND liked=true) — gentle "you
  // wanted to take this, want to start?" nudge.
  savedCoursesCount?: number
  // In-progress (status='in_progress') — gentle "pick it back up" nudge.
  inProgressCoursesCount?: number
  profileCompletion?: number | null
}): string | null {
  const lines: string[] = []

  if (opts.upcomingInterviewsCount > 0) {
    const word = opts.upcomingInterviewsCount === 1 ? 'interview' : 'interviews'
    lines.push(`• ${opts.upcomingInterviewsCount} ${word} this week`)
  }
  if (opts.pendingDraftsCount > 0) {
    const word = opts.pendingDraftsCount === 1 ? 'draft' : 'drafts'
    lines.push(`• ${opts.pendingDraftsCount} ${word} to approve`)
  }
  if (opts.needFeedbackCount > 0) {
    const word = opts.needFeedbackCount === 1 ? 'interview' : 'interviews'
    lines.push(`• ${opts.needFeedbackCount} ${word} need your feedback`)
  }
  if (opts.pendingRefsCount > 0) {
    const word = opts.pendingRefsCount === 1 ? 'reference' : 'references'
    lines.push(`• ${opts.pendingRefsCount} ${word} still pending`)
  }
  if ((opts.inProgressCoursesCount ?? 0) > 0) {
    const n = opts.inProgressCoursesCount as number
    const word = n === 1 ? 'course' : 'courses'
    lines.push(`• ${n} ${word} in progress — pick back up?`)
  }
  if ((opts.savedCoursesCount ?? 0) > 0) {
    const n = opts.savedCoursesCount as number
    const word = n === 1 ? 'saved course' : 'saved courses'
    lines.push(`• ${n} ${word} waiting to start`)
  }
  if (typeof opts.profileCompletion === 'number' && opts.profileCompletion < 80) {
    lines.push(`• Profile ${opts.profileCompletion}% complete — finish it to surface to companies`)
  }

  if (lines.length === 0) return null

  const name = (opts.firstName || '').trim().split(' ')[0]
  const greeting = name ? `Morning ${name} 👋` : 'Morning 👋'
  const header = `${greeting} — quick run-down for today:`
  const footer = `Reply anytime — "approve all", "prep me for X", or ask me anything.`

  return `${header}\n${lines.join('\n')}\n\n${footer}`
}
