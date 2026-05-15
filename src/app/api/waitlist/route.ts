import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const { email, type } = await request.json()

  if (!email || !type) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { error } = await supabase
    .from('waitlist')
    .insert({ email, type })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already on waitlist' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to join' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
