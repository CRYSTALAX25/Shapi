import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sendProfileLiveEmail } from '@/lib/email'

const ADMIN_EMAIL = 'ana.vbarber@gmail.com'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Handle both form POST and JSON
  let candidateId: string | null = null
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const body = await request.json()
    candidateId = body.id
  } else {
    const form = await request.formData()
    candidateId = form.get('id') as string
  }

  if (!candidateId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()

  await admin
    .from('profiles')
    .update({
      profile_live: true,
      completion_pct: 80,
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidateId)

  // Send profile live email
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', candidateId)
    .single()

  const { data: authUser } = await admin.auth.admin.getUserById(candidateId)
  const email = authUser?.user?.email

  if (email) {
    sendProfileLiveEmail(email, profile?.full_name || '', candidateId)
      .catch(err => console.error('[admin/verify] email failed:', err))
  }

  // Redirect back to admin panel (for form POST)
  return NextResponse.redirect(new URL('/admin', request.url))
}
