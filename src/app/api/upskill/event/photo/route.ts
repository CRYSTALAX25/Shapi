// POST /api/upskill/event/photo — upload a proof photo for an attended event to
// the public 'event-photos' bucket and return its URL. Modeled on profile/avatar.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Use a JPG, PNG, WebP or GIF image' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })
  }

  const admin = createAdminClient()
  try {
    await admin.storage.createBucket('event-photos', { public: true })
  } catch { /* already exists — fine */ }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/gif' ? 'gif' : 'jpg'
  const path = `${user.id}/event-${Date.now()}.${ext}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await admin.storage
    .from('event-photos')
    .upload(path, bytes, { contentType: file.type, upsert: true })
  if (upErr) {
    console.error('[upskill/event/photo] upload failed:', upErr.message)
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  const { data: pub } = admin.storage.from('event-photos').getPublicUrl(path)
  return NextResponse.json({ ok: true, url: pub.publicUrl })
}
