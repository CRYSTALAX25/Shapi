// POST /api/profile/avatar — upload a profile photo to Supabase Storage and
// save its public URL on the profile. Uses the admin client to write to the
// 'avatars' bucket (creates the bucket if missing) so it works regardless of
// storage RLS setup.

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

  // Ensure the bucket exists (idempotent)
  try {
    await admin.storage.createBucket('avatars', { public: true })
  } catch { /* already exists — fine */ }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/gif' ? 'gif' : 'jpg'
  const path = `${user.id}/avatar-${Date.now()}.${ext}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await admin.storage
    .from('avatars')
    .upload(path, bytes, { contentType: file.type, upsert: true })
  if (upErr) {
    console.error('[profile/avatar] upload failed:', upErr.message)
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  const { data: pub } = admin.storage.from('avatars').getPublicUrl(path)
  const url = pub.publicUrl

  const { error: saveErr } = await admin
    .from('profiles')
    .update({ profile_image_url: url, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (saveErr) {
    console.error('[profile/avatar] save failed:', saveErr.message)
    return NextResponse.json({ error: saveErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, url })
}
