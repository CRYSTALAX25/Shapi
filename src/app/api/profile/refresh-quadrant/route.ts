// One-tap endpoint to compute (or recompute) skill_quadrant from the
// candidate's existing profile data. Useful when:
//   - The CV was uploaded before skill_quadrant extraction was added
//   - The candidate's work_history has changed significantly
//   - The score feels off and they want a fresh read
//
// Mirrors the calibration rubric used by cv-parse.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { getAnthropic } from '@/lib/anthropic'

export const maxDuration = 30

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, headline, summary, work_history, skills, matched_industries, ai_tier')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const anthropic = getAnthropic()
  const workHistory = Array.isArray(profile.work_history) ? profile.work_history : []
  const skills = Array.isArray(profile.skills) ? profile.skills : []

  const prompt = `Score this candidate 0-10 on each of 4 working-style axes — be honest and discriminating, not generous. Most people are STRONG on 1-2 axes, MODERATE on 1-2, WEAK on 0-1.

- HANDS (0-10): physical/practical work — tools, equipment, dexterity, building, manual skill, on-site operations. High: trades, F&B service, manufacturing, surgery, construction. Low: pure desk/analytical roles.
- HEART (0-10): interpersonal — leadership, customer-facing, persuasion, care, team building, stakeholder management. High: sales, HR, hospitality, teaching, nursing, management. Low: solo back-office work.
- HEAD (0-10): analytical/technical — data, systems thinking, problem-solving, technical depth. High: engineering, finance, data, research, accounting. Low: purely creative or hands-only roles.
- SPARK (0-10): creative synthesis — strategy, design, innovation, original concept work. High: creative direction, product, R&D, founders, marketing strategy. Low: routine execution roles.

Calibration:
  - Construction foreman: Hands 9, Heart 7, Head 4, Spark 3
  - Sales VP: Heart 9, Head 6, Spark 7, Hands 2
  - ML engineer: Head 9, Spark 7, Hands 4, Heart 5
  - Hotel GM: Heart 9, Head 6, Hands 6, Spark 5

CANDIDATE:
Name: ${profile.full_name || ''}
Headline: ${profile.headline || ''}
Summary: ${(profile.summary as string) || ''}
Industries: ${Array.isArray(profile.matched_industries) ? profile.matched_industries.join(', ') : ''}
Skills: ${skills.join(', ')}
Work history: ${JSON.stringify(workHistory)}

Return ONLY valid JSON:
{
  "hands": 0,
  "heart": 0,
  "head": 0,
  "spark": 0,
  "reasoning": "1-2 sentence explanation of these scores"
}`

  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Could not parse quadrant response')
    const parsed = JSON.parse(match[0])

    const quadrant = {
      hands: Math.max(0, Math.min(10, parsed.hands ?? 0)),
      heart: Math.max(0, Math.min(10, parsed.heart ?? 0)),
      head: Math.max(0, Math.min(10, parsed.head ?? 0)),
      spark: Math.max(0, Math.min(10, parsed.spark ?? 0)),
      reasoning: parsed.reasoning || '',
      assessed_at: new Date().toISOString(),
      assessed_from: 'refresh',
    }

    const admin = createAdminClient()
    await admin.from('profiles').update({
      skill_quadrant: quadrant,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)

    return NextResponse.json({ success: true, skill_quadrant: quadrant })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[refresh-quadrant] failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
