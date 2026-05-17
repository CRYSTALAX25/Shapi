import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp'

export async function POST(request: Request) {
  const formData = await request.formData()
  const from = formData.get('From') as string        // whatsapp:+966...
  const body = formData.get('Body') as string
  const numMedia = parseInt((formData.get('NumMedia') as string) || '0')
  const mediaType = (formData.get('MediaContentType0') as string) || ''

  // Normalise: strip whatsapp: prefix and ALL spaces so +966 50 250 6355 → +966502506355
  const phone = from?.replace('whatsapp:', '').replace(/\s+/g, '').trim()
  if (!phone) return new NextResponse('', { status: 200 })

  console.log('[webhook] Message from:', phone, '| body:', body?.slice(0, 80), '| media:', numMedia, mediaType)

  const admin = createAdminClient()

  // Look up profile by WhatsApp number — use limit(1) to survive duplicate rows
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, headline, skills, work_history, whatsapp_chat, completion_pct, cv_parsed')
    .eq('whatsapp_number', phone)
    .order('cv_parsed', { ascending: false })
    .limit(1)

  const profile = profiles?.[0] ?? null

  if (!profile) {
    console.log('[webhook] No profile found for:', phone)
    return new NextResponse('', { status: 200 })
  }

  // ── Voice note handling — Deepgram transcription ────────────────────────
  let userMessage = body?.trim() || ''

  if (numMedia > 0 && mediaType.startsWith('audio/')) {
    const mediaUrl = formData.get('MediaUrl0') as string
    console.log('[webhook] Voice note received, transcribing:', mediaUrl)

    try {
      // Download audio from Twilio (requires Basic auth)
      const accountSid = process.env.TWILIO_ACCOUNT_SID!
      const authToken = process.env.TWILIO_AUTH_TOKEN!
      const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

      const audioRes = await fetch(mediaUrl, {
        headers: { Authorization: `Basic ${twilioAuth}` },
      })
      if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`)
      const audioBuffer = await audioRes.arrayBuffer()

      // Send to Deepgram for transcription
      const deepgramRes = await fetch(
        'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&detect_language=true',
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': mediaType,
          },
          body: audioBuffer,
        }
      )

      if (!deepgramRes.ok) throw new Error(`Deepgram error: ${deepgramRes.status}`)
      const deepgramData = await deepgramRes.json()
      const transcript = deepgramData?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim()

      if (transcript) {
        console.log('[webhook] Transcribed:', transcript.slice(0, 100))
        userMessage = transcript
      } else {
        console.log('[webhook] Empty transcript from Deepgram')
        await sendWhatsApp(phone, `I got your voice note 🎙️ but couldn't make it out clearly — could you try again or type it?`)
        return new NextResponse('', { status: 200 })
      }
    } catch (err) {
      console.error('[webhook] Transcription error:', err)
      await sendWhatsApp(phone, `I got your voice note 🎙️ but hit a snag transcribing it — could you type your answer? Don't want to miss anything.`)
      return new NextResponse('', { status: 200 })
    }
  }

  if (!userMessage) return new NextResponse('', { status: 200 })

  // ── Conversation history ─────────────────────────────────────────────────
  const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> =
    Array.isArray(profile.whatsapp_chat) ? profile.whatsapp_chat : []

  const userTurns = chatHistory.filter(m => m.role === 'user').length

  // Add incoming message
  chatHistory.push({ role: 'user', content: userMessage })

  // ── Claude conversation engine ───────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const skillsList = Array.isArray(profile.skills) ? (profile.skills as string[]).join(', ') : ''
  const workSummary = Array.isArray(profile.work_history)
    ? (profile.work_history as Array<{ title?: string; company?: string }>)
        .slice(0, 2)
        .map(w => `${w.title || ''} at ${w.company || ''}`)
        .join('; ')
    : ''

  const systemPrompt = `You are Shapi — a warm, sharp AI building a professional profile for ${profile.full_name || 'this candidate'} through a WhatsApp conversation.

What we know from their CV:
- Title: ${profile.headline || 'not specified'}
- Skills: ${skillsList || 'see CV'}
- Recent roles: ${workSummary || 'see CV'}

Your goal is to uncover what the CV can't show — in 4 to 5 exchanges total. Cover:
1. A real achievement with actual impact (not just responsibilities)
2. How they work best — environment, team, pace
3. What they're genuinely looking for next
4. What makes them stand out from people with similar CVs

WhatsApp rules:
- LANGUAGE: Detect what language the candidate writes in and respond in that SAME language. Arabic → Arabic. French → French. Hindi → Hindi. English → English. Never switch languages mid-conversation.
- Short messages only. Max 3 sentences. Never use bullet points.
- Always acknowledge what they said first, then ask the next thing.
- Sound human. Not HR. Not a form.
- One question per message, always.

This is exchange ${userTurns + 1} of the conversation.
${userTurns >= 4 ? 'You have enough. Wrap up warmly — tell them their profile is being built and they\'ll hear from us soon. End your message with exactly: [DONE]' : ''}
${userTurns < 4 ? 'Do NOT end the conversation yet — keep asking.' : ''}`

  let aiReply = ''
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: systemPrompt,
      messages: chatHistory,
    })
    aiReply = response.content[0].type === 'text' ? response.content[0].text : ''
  } catch (err) {
    console.error('[webhook] Claude error:', err)
    await sendWhatsApp(phone, 'Thanks for that — I\'ll follow up with you shortly.')
    return new NextResponse('', { status: 200 })
  }

  const isDone = aiReply.includes('[DONE]')
  const cleanReply = aiReply.replace('[DONE]', '').trim()

  // Add AI reply to history
  chatHistory.push({ role: 'assistant', content: cleanReply })

  // Update profile
  const updates: Record<string, unknown> = {
    whatsapp_chat: chatHistory,
    updated_at: new Date().toISOString(),
  }

  if (isDone) {
    updates.completion_pct = Math.max((profile.completion_pct as number) || 0, 60)
    updates.whatsapp_conversation_active = false
  }

  await admin.from('profiles').update(updates).eq('id', profile.id)

  // Send reply
  await sendWhatsApp(phone, cleanReply)

  console.log('[webhook] Replied to:', phone, '| done:', isDone)
  return new NextResponse('', { status: 200 })
}
