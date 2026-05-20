// POST /api/work-style — save a candidate's work-style self-assessment.
// Body: { answers: { [questionId]: 1..5 } } → computed scores saved to
// profiles.work_style.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { scoreWorkStyle } from '@/lib/work-style'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const answers = body.answers as Record<string, number> | undefined
  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'answers required' }, { status: 400 })
  }

  const scores = scoreWorkStyle(answers)
  const work_style = { scores, assessed_at: new Date().toISOString() }

  const { error } = await supabase
    .from('profiles')
    .update({ work_style, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, work_style })
}
