import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET — list all evidence for the current user with signed URLs
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rows, error } = await supabase
    .from('evidence')
    .select('id, file_name, file_type, file_size, caption, status, created_at, storage_path')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Generate signed URLs (valid 1 hour) so images can be previewed
  const items = await Promise.all((rows || []).map(async (row) => {
    let url: string | null = null
    try {
      const { data: signed } = await supabase.storage
        .from('evidence')
        .createSignedUrl(row.storage_path, 3600)
      url = signed?.signedUrl || null
    } catch { /* non-fatal */ }
    return { ...row, url }
  }))

  return NextResponse.json({ items })
}

// POST — upload a file
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const caption = formData.get('caption') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })

  const ext = file.name.split('.').pop()
  const storagePath = `${user.id}/${Date.now()}.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('evidence')
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[evidence/upload] Storage error:', uploadError.message)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: row, error: dbError } = await supabase.from('evidence').insert({
    user_id: user.id,
    storage_path: storagePath,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    caption: caption || null,
    status: 'pending',
  }).select('id').single()

  if (dbError) {
    console.error('[evidence/upload] DB error:', dbError.message)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Bump completion % for adding evidence (non-fatal)
  try {
    const { data: prof } = await supabase.from('profiles').select('completion_pct').eq('id', user.id).single()
    const current = (prof?.completion_pct as number) || 0
    if (current < 75) {
      await supabase.from('profiles').update({ completion_pct: 75 }).eq('id', user.id)
    }
  } catch { /* non-fatal */ }

  // Return a signed URL for immediate preview
  let url: string | null = null
  try {
    const { data: signed } = await supabase.storage.from('evidence').createSignedUrl(storagePath, 3600)
    url = signed?.signedUrl || null
  } catch { /* non-fatal */ }

  return NextResponse.json({ success: true, id: row?.id, path: storagePath, url })
}

// DELETE — remove a single evidence item
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Fetch to verify ownership and get storage path
  const { data: row } = await supabase
    .from('evidence')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete from storage
  await supabase.storage.from('evidence').remove([row.storage_path])

  // Delete from DB
  await supabase.from('evidence').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
