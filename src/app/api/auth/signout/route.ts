import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // 303 See Other — converts the POST→ redirect into a GET on '/'. Without
  // this the default 307 preserves the POST method and the browser POSTs to
  // '/' which returns 405 ("this page isn't working" in Chrome's UI).
  return NextResponse.redirect(
    new URL('/', process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'),
    { status: 303 }
  )
}
