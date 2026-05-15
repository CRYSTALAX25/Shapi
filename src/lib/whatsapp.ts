const OPENING_MESSAGE = (name: string) =>
  `Hi ${name} 👋 I'm Shapi. I just read your CV.\n\nI want to build you a profile that actually shows who you are — not just job titles.\n\nQuick question: What's the achievement you're most proud of from the last 3 years? Something that made you think "I actually did that."\n\nText back or leave a voice note — whatever's easier.`

const NO_CV_MESSAGE = (name: string) =>
  `Hi ${name} 👋 I'm Shapi.\n\nNo CV needed — we'll build your profile together through this conversation.\n\nLet's start: What's your current or most recent job title, and where are you based?`

export async function sendWhatsApp(
  to: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || !authToken || !from) {
    console.log('[WhatsApp] Twilio not configured — simulating send to:', to)
    return { success: true }
  }

  const cleaned = to.replace(/\s/g, '')
  const recipient = cleaned.startsWith('whatsapp:') ? cleaned : `whatsapp:${cleaned}`

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: from, To: recipient, Body: message }).toString(),
      }
    )

    if (!res.ok) {
      const err = await res.json()
      console.error('[WhatsApp] Twilio error:', err)
      return { success: false, error: err.message || 'Send failed' }
    }

    return { success: true }
  } catch (err) {
    console.error('[WhatsApp] Network error:', err)
    return { success: false, error: 'Network error' }
  }
}

export { OPENING_MESSAGE, NO_CV_MESSAGE }
