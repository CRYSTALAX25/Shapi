// Voice sample helpers.
//
// During the WhatsApp interview we ask the candidate to send a short voice
// note in each language they speak. Each captured sample lives in the
// profile's `voice_samples` jsonb, keyed by language name (lowercased).
//
// We store Twilio media references rather than raw audio bytes; playback is
// proxied through /api/voice-sample which authenticates with Twilio.

import { createAdminClient } from '@/lib/supabase/admin'

export type VoiceSample = {
  media_sid: string
  message_sid: string
  media_url: string         // original Twilio CDN URL (auth-required)
  content_type?: string     // e.g. 'audio/ogg' or 'audio/mp4'
  transcript?: string
  duration_s?: number
  recorded_at: string       // ISO timestamp
  language: string          // language name as stored (lowercase)
}

export type VoiceSamplesMap = Record<string, VoiceSample>

export function normalizeLang(lang: string): string {
  return (lang || '').trim().toLowerCase()
}

export async function getVoiceSamples(candidateId: string): Promise<VoiceSamplesMap> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('voice_samples')
    .eq('id', candidateId)
    .single()
  return (data?.voice_samples as VoiceSamplesMap) || {}
}

export async function saveVoiceSample(
  candidateId: string,
  lang: string,
  sample: Omit<VoiceSample, 'recorded_at' | 'language'> & { recorded_at?: string },
): Promise<void> {
  const key = normalizeLang(lang)
  if (!key) return
  const admin = createAdminClient()
  const current = await getVoiceSamples(candidateId)
  const next: VoiceSamplesMap = {
    ...current,
    [key]: {
      ...sample,
      language: key,
      recorded_at: sample.recorded_at || new Date().toISOString(),
    },
  }
  await admin
    .from('profiles')
    .update({ voice_samples: next, awaiting_voice_sample_lang: null })
    .eq('id', candidateId)
}

// Pick the next language we still need a voice sample for. Returns null when
// every language in `languages_spoken` has a sample (or candidate has no
// listed languages).
export function pickNextLanguageToCapture(
  languagesSpoken: Array<{ language: string }> | null | undefined,
  samples: VoiceSamplesMap,
): string | null {
  if (!languagesSpoken || languagesSpoken.length === 0) return null
  for (const l of languagesSpoken) {
    const key = normalizeLang(l.language || '')
    if (!key) continue
    if (!samples[key]) return l.language  // return the original-cased name for prompts
  }
  return null
}

// Fetch the raw audio bytes from Twilio for streaming. Uses basic auth.
// Returns Response so the caller can pipe content-type + body through.
export async function fetchTwilioMedia(mediaUrl: string): Promise<Response> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) throw new Error('Twilio credentials not configured')
  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  return fetch(mediaUrl, {
    headers: { Authorization: `Basic ${auth}` },
    // Twilio CDN issues a 307 to a signed S3 URL; follow it
    redirect: 'follow',
  })
}
