// Client-safe helpers for generating wa.me deep-links to Shapi's WhatsApp.
//
// The Shapi WhatsApp number is stored in NEXT_PUBLIC_SHAPI_WHATSAPP_NUMBER
// (international format, no leading +). Pre-launch we're on Twilio's sandbox
// (+1 415 523 8886) which requires users to send a JOIN CODE first before any
// feature triggers reach our webhook. Set NEXT_PUBLIC_SHAPI_WHATSAPP_JOIN_CODE
// while we're on sandbox so the "Connect" link pre-types `join <code>`.
//
// Post-WABA: clear the join-code env var. The Connect link will pre-type a
// friendly first-touch message instead, and the user is in our webhook from
// the moment they hit Send.

const FALLBACK_NUMBER = '14155238886' // Twilio sandbox default

export function getShapiWhatsAppNumber(): string {
  const raw = process.env.NEXT_PUBLIC_SHAPI_WHATSAPP_NUMBER || FALLBACK_NUMBER
  return raw.replace(/[^0-9]/g, '')
}

function getJoinCode(): string | null {
  const c = process.env.NEXT_PUBLIC_SHAPI_WHATSAPP_JOIN_CODE
  return c && c.trim() ? c.trim() : null
}

function buildWaMe(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

// First-touch "Connect Shapi on WhatsApp" link.
// Sandbox mode (join code set): pre-types `join <code>` — user hits Send and
//   they're paired to Shapi. We then reply with a welcome message.
// Production (no join code): pre-types a friendly hello — Shapi's webhook
//   handles it directly with onboarding.
export function getShapiConnectUrl(): string {
  const number = getShapiWhatsAppNumber()
  const code = getJoinCode()
  const text = code ? `join ${code}` : 'Hi Shapi — connecting my account'
  return buildWaMe(number, text)
}

// Feature-trigger link — pre-types a specific command (e.g. "design my org via
// voice", "shortlist for Senior PM"). Use everywhere Shapi exposes a WhatsApp
// trigger so users can one-tap into the feature.
export function getShapiTriggerUrl(triggerText: string): string {
  return buildWaMe(getShapiWhatsAppNumber(), triggerText)
}

// Pretty-print the number for display, e.g. "+1 415 523 8886".
export function getShapiWhatsAppDisplay(): string {
  const digits = getShapiWhatsAppNumber()
  // US-style grouping (works for the Twilio sandbox). For other countries we
  // can extend this; for now Shapi's sandbox is US so this is fine.
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  return `+${digits}`
}

// True while we're on Twilio sandbox — UI can show a one-time "tap to join"
// reassurance ("we're inviting you into our beta WhatsApp sandbox") so the
// join-code message doesn't look bizarre to a user.
export function isShapiWhatsAppSandbox(): boolean {
  return !!getJoinCode()
}
