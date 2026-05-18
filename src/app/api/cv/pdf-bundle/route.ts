// Public PDF bundle endpoint — Twilio fetches this URL to attach to WhatsApp.
// Generates a merged PDF containing every selected CV version, on demand,
// from the candidate's cv_cache.
//
// URL shape:
//   /api/cv/pdf-bundle?uid=<user_id>&v=<comma-separated-selections>&exp=<unix>&sig=<hmac>
//
// Selection encoding (compact):
//   "english"           → English CV
//   "Italian"           → Italian-language CV
//   "Croatian"          → Croatian-language CV
//   "u"                 → Universal
//   "i:operations"      → Operations-targeted English CV
//   "i:hospitality"     → Hospitality-targeted English CV
//
// Signed with HMAC so the URL can't be guessed; expires after 7 days.

import { NextResponse } from 'next/server'
import { generateBundledPdf, type CVSelection } from '@/lib/cv-pdf-bundle'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 60

const SIGNING_SECRET = process.env.PDF_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'shapi-fallback-pdf-secret'

export function signBundlePayload(uid: string, v: string, ttlDays = 7): { sig: string; expires: number } {
  const expires = Math.floor(Date.now() / 1000) + ttlDays * 86400
  const data = `${uid}.${v}.${expires}`
  const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(data).digest('hex').slice(0, 24)
  return { sig, expires }
}

function verifyBundleSignature(uid: string, v: string, expires: number, sig: string): boolean {
  if (Date.now() / 1000 > expires) return false
  const data = `${uid}.${v}.${expires}`
  const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(data).digest('hex').slice(0, 24)
  if (sig.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < sig.length; i++) mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  return mismatch === 0
}

export function parseSelections(v: string): CVSelection[] {
  return v.split(',').map(token => {
    token = token.trim()
    if (!token) return null
    if (token === 'u' || token === 'universal') return { type: 'universal' as const, value: 'universal' }
    if (token.startsWith('i:')) return { type: 'industry' as const, value: token.slice(2) }
    return { type: 'language' as const, value: token }
  }).filter((s): s is CVSelection => s !== null)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const uid = url.searchParams.get('uid')
  const v = url.searchParams.get('v') || 'english'
  const expires = parseInt(url.searchParams.get('exp') || '0', 10)
  const sig = url.searchParams.get('sig') || ''

  if (!uid || !sig || !expires) return new NextResponse('Missing parameters', { status: 400 })
  if (!verifyBundleSignature(uid, v, expires, sig)) return new NextResponse('Invalid or expired signature', { status: 403 })

  const selections = parseSelections(v)
  if (selections.length === 0) return new NextResponse('No selections', { status: 400 })

  try {
    const { buffer, missing } = await generateBundledPdf(uid, selections)
    if (missing.length > 0) {
      console.warn('[pdf-bundle] missing CVs (not yet cached):', missing.map(s => s.value).join(','))
    }
    // Use the candidate's name in the file name
    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('full_name').eq('id', uid).single()
    const safeName = ((profile?.full_name as string) || 'cv').replace(/\s+/g, '_')
    const versionTag = selections.length === 1 ? selections[0].value : `${selections.length}_versions`
    const fileName = `${safeName}_${versionTag}_CV.pdf`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[pdf-bundle] generation failed:', msg)
    return new NextResponse(`PDF bundle generation failed: ${msg}`, { status: 500 })
  }
}
