// Public PDF download endpoint — used by Twilio WhatsApp as a MediaUrl source.
// The PDF is generated on demand from the cached CV JSON (cv_cache).
//
// URL: /api/cv/pdf?uid=<user_id>&lang=<language>&sig=<hmac>
//
// Why HMAC signed:
//   - Twilio fetches PDFs from public URLs — no auth headers possible
//   - We sign the URL with a server-side secret so it can't be guessed
//   - Signature expires after 7 days (replay protection)
//
// This route runs on Node runtime (not Edge) because @react-pdf/renderer
// needs Node APIs (Buffer, etc.).

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateCVPdfBuffer, type CVData, type CVProfile } from '@/lib/cv-pdf'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 30

const SIGNING_SECRET = process.env.PDF_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'shapi-fallback-pdf-secret'

// Sign a payload — used by /api/cv/send to mint the URL, verified here.
export function signPdfPayload(uid: string, lang: string, ttlDays = 7): { sig: string; expires: number } {
  const expires = Math.floor(Date.now() / 1000) + ttlDays * 86400
  const data = `${uid}.${lang}.${expires}`
  const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(data).digest('hex').slice(0, 24)
  return { sig, expires }
}

function verifyPdfSignature(uid: string, lang: string, expires: number, sig: string): boolean {
  if (Date.now() / 1000 > expires) return false
  const data = `${uid}.${lang}.${expires}`
  const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(data).digest('hex').slice(0, 24)
  // Constant-time compare
  if (sig.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < sig.length; i++) mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  return mismatch === 0
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const uid = url.searchParams.get('uid')
  const lang = url.searchParams.get('lang') || 'english'
  const expires = parseInt(url.searchParams.get('exp') || '0', 10)
  const sig = url.searchParams.get('sig') || ''

  if (!uid || !sig || !expires) {
    return new NextResponse('Missing parameters', { status: 400 })
  }
  if (!verifyPdfSignature(uid, lang, expires, sig)) {
    return new NextResponse('Invalid or expired signature', { status: 403 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, cv_cache, skill_quadrant, ai_tier, verification_tier')
    .eq('id', uid)
    .single()

  if (!profile) return new NextResponse('Profile not found', { status: 404 })

  const cache = (profile.cv_cache as Record<string, { cv?: CVData }>) || {}
  const cacheKey = lang === 'english'
    ? 'english'
    : lang === 'universal'
      ? 'universal'
      : `lang_${lang.toLowerCase().replace(/\s+/g, '_')}`

  const cached = cache[cacheKey]
  if (!cached?.cv) {
    return new NextResponse(`CV for "${lang}" not yet generated. Visit /cv-ready first.`, { status: 404 })
  }

  try {
    const pdfBuffer = await generateCVPdfBuffer(cached.cv as CVData, {
      skill_quadrant: profile.skill_quadrant as CVProfile['skill_quadrant'],
      ai_tier: profile.ai_tier as string | null,
      verification_tier: profile.verification_tier as string | null,
      id: uid,
    })

    const fileName = `${(profile.full_name as string || 'cv').replace(/\s+/g, '_')}_${lang}_CV.pdf`
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cv/pdf] PDF generation failed:', msg)
    return new NextResponse(`PDF generation failed: ${msg}`, { status: 500 })
  }
}
