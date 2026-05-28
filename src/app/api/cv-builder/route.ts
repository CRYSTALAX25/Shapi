import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp'
import { NextResponse } from 'next/server'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages, profileData } = await request.json()

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `You are Shapi's CV builder assistant. Your job is to help candidates articulate their work experience, skills, and achievements in a way that gets them noticed by the right companies.

You are warm, encouraging, and direct. You ask one focused question at a time. You help people who may not know how to "sell themselves" — including people who have never written a CV before.

Current profile data: ${JSON.stringify(profileData || {})}

Your goals:
1. Help the candidate describe their most recent role with specific achievements and numbers
2. Uncover skills they take for granted but that are actually valuable
3. Identify what kind of role they want next and why
4. Build a compelling summary in their own voice

Rules:
- Ask one question at a time
- When they answer vaguely, ask for specifics ("Can you give me a number or example?")
- When they undersell themselves, reflect back what they said more powerfully
- After collecting enough for a role, summarise it back and ask if it's right
- When the full profile is complete (recent role + achievements + skills + what they want next are all captured), end your final message with the token [PROFILE_READY] on its own line
- Keep responses short — max 3 sentences + your question
- Never use jargon or corporate speak
- If they mention something impressive, acknowledge it genuinely before moving on`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const rawReply = response.content[0].type === 'text' ? response.content[0].text : ''
  const ready = rawReply.includes('[PROFILE_READY]')
  const reply = rawReply.replace('[PROFILE_READY]', '').trim()

  // Strike at peak motivation: the moment Claude emits [PROFILE_READY], fire
  // a WhatsApp to the candidate with their public profile link. This is the
  // user's celebration message + first taste of "your profile is live" + an
  // organic re-engagement hook (they'll tap to see what companies see).
  //
  // Best-effort. Failures don't block the API response — the page still gets
  // ready=true so the upsell gate renders regardless of the WA send.
  // Idempotency: profiles.profile_ready_wa_sent_at is set on first send so a
  // re-firing of the cv-builder loop doesn't double-text. Tolerate the column
  // not existing yet (Supabase returns error; we proceed without the stamp).
  if (ready) {
    try {
      const admin = createAdminClient()
      const { data: profile } = await admin
        .from('profiles')
        .select('id, whatsapp_number, profile_ready_wa_sent_at, full_name')
        .eq('id', user.id)
        .single()
      const alreadySent = !!(profile as { profile_ready_wa_sent_at?: string | null } | null)?.profile_ready_wa_sent_at
      if (profile?.whatsapp_number && !alreadySent) {
        const firstName = (profile.full_name as string | null)?.split(' ')[0] || 'there'
        const url = `${SITE}/p/${(profile.id as string).slice(0, 8)}`
        const msg = `🎉 ${firstName}, your verified profile is live.\n\nThis is what companies see when you apply — tap to view:\n\n${url}\n\nNothing to log into. Share it with any recruiter. ✓ Verified work history · ✓ AI-skills tier · ✓ References cascade in as your refs reply.`
        const send = await sendWhatsApp(profile.whatsapp_number as string, msg)
        if (send.success) {
          // Stamp so we don't re-send if [PROFILE_READY] fires again. Best-
          // effort — if the column doesn't exist (migration not run), ignore.
          await admin
            .from('profiles')
            .update({ profile_ready_wa_sent_at: new Date().toISOString() })
            .eq('id', user.id)
            .then(() => undefined, () => undefined)
        }
      }
    } catch (e) {
      console.warn('[cv-builder] profile-ready WA send skipped:', e)
    }
  }

  return NextResponse.json({ reply, ready })
}
