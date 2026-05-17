import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { company_id, user_id, email } = await request.json()
  if (!company_id || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const admin = createAdminClient()

  // Mark the invite as accepted
  await admin
    .from('company_members')
    .update({ accepted_at: new Date().toISOString() })
    .eq('company_id', company_id)
    .eq('email', email)

  // Set the new user's profile type to 'company' and link to company
  if (user_id) {
    await admin
      .from('profiles')
      .upsert({
        id: user_id,
        type: 'company',
        company_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
  }

  return NextResponse.json({ success: true })
}
