// Fetch the candidate's in-flight CV-builder chat so the /cv-builder page can
// restore where they left off. Returns { messages: [] } if no draft.
// Tolerates the cv_draft.sql migration not yet being run — degrades to empty.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type ChatTurn = { role: 'user' | 'assistant'; content: string }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('cv_builder_chat, cv_builder_chat_updated_at')
    .eq('id', user.id)
    .single()

  const raw = (profile as { cv_builder_chat?: unknown } | null)?.cv_builder_chat
  const messages: ChatTurn[] = Array.isArray(raw)
    ? (raw as ChatTurn[]).filter(
        (m): m is ChatTurn =>
          !!m &&
          typeof m === 'object' &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string',
      )
    : []

  return NextResponse.json({
    messages,
    updatedAt: (profile as { cv_builder_chat_updated_at?: string | null } | null)?.cv_builder_chat_updated_at || null,
  })
}
