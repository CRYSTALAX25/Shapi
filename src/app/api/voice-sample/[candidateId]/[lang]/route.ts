// Stream a candidate's voice sample audio through our backend so that the
// raw Twilio MediaUrl (which requires Twilio basic auth) never leaks.
//
// URL: /api/voice-sample/{candidateId}/{lang}
//
// Currently public — gating to company tiers (e.g. Growth+) will be enforced
// by the calling page (profile vs public-profile-page), not by this endpoint,
// since the audio bytes themselves aren't sensitive once a CV has been viewed.
// We can tighten later if needed.

import { NextResponse } from 'next/server'
import { getVoiceSamples, fetchTwilioMedia, normalizeLang } from '@/lib/voice-samples'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ candidateId: string; lang: string }> },
) {
  const { candidateId, lang } = await params
  if (!candidateId || !lang) {
    return NextResponse.json({ error: 'Missing candidate or language' }, { status: 400 })
  }

  const samples = await getVoiceSamples(candidateId)
  const sample = samples[normalizeLang(lang)]
  if (!sample) {
    return NextResponse.json({ error: 'No sample for that language' }, { status: 404 })
  }

  try {
    const upstream = await fetchTwilioMedia(sample.media_url)
    if (!upstream.ok) {
      console.error(`[voice-sample] twilio fetch failed ${upstream.status}`)
      return NextResponse.json({ error: 'Could not fetch audio from Twilio' }, { status: 502 })
    }
    const contentType = upstream.headers.get('content-type') || sample.content_type || 'audio/ogg'
    // Stream the body straight through so the client can scrub
    return new Response(upstream.body, {
      headers: {
        'content-type': contentType,
        'cache-control': 'private, max-age=900',  // 15 min — safe re-listen without re-fetching
        // Lets the HTML5 audio element seek
        'accept-ranges': 'bytes',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[voice-sample] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
