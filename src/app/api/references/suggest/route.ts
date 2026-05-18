// Smart reference picker — reads the candidate's work_history + matched_industries
// and recommends:
//   - 2 PAST roles whose managers should be contacted (most relevant to target sectors)
//   - 1 CURRENT role for the peer reference (discretion-protected — no current manager)
//
// Returns indices into the work_history array + Claude's reasoning, surfaced to the
// candidate as "Shapi recommends these references because…"

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

type WorkEntry = {
  title?: string
  company?: string
  start?: string
  end?: string
  achievements?: string
}

export const maxDuration = 30

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('work_history, matched_industries, headline')
    .eq('id', user.id)
    .single()

  const workHistory: WorkEntry[] = Array.isArray(profile?.work_history) ? profile.work_history : []
  const targetIndustries: string[] = Array.isArray(profile?.matched_industries) ? profile.matched_industries : []
  const headline: string = (profile?.headline as string) || ''

  if (workHistory.length === 0) {
    return NextResponse.json({ error: 'No work history found — upload your CV first' }, { status: 400 })
  }

  // Edge case: only 1 job → can't pick 2 past managers AND a current peer
  // Just suggest the 1 job for manager + flag missing-context
  if (workHistory.length === 1) {
    return NextResponse.json({
      currentRole: { index: 0, reason: 'Your only role on the CV — used as both current peer and historical reference.' },
      pastManagers: [{ index: 0, reason: 'Same role — peer + manager reference give different perspectives on the same job.' }],
      reasoning: 'You only have 1 role on your CV — we recommend a peer reference from this role. Add more work history to unlock 2-manager verification.',
    })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are advising on reference selection for a verified-hiring platform. Your task: pick the BEST 2 past-role managers + 1 current-role peer reference for this candidate, weighted by relevance to their target industries.

CANDIDATE HEADLINE: ${headline || 'not provided'}
TARGET INDUSTRIES (where they want to be hired): ${targetIndustries.length > 0 ? targetIndustries.join(', ') : 'not specified'}

WORK HISTORY (index, title @ company, dates):
${workHistory.map((w, i) => `[${i}] ${w.title || 'role'} @ ${w.company || 'unknown'} (${w.start || '?'} – ${w.end || 'present'})${w.achievements ? ' — ' + w.achievements.slice(0, 100) : ''}`).join('\n')}

THE 2 RULES:
1. CURRENT ROLE = whichever entry has end="present" or is the most recent. Pick a PEER (colleague) from that role, NOT manager. This protects the candidate from tipping off their current employer.
2. PAST MANAGERS = pick the 2 PAST roles (not current) whose managers can BEST attest to the candidate's experience in the target industries. Prioritise:
   - Roles in or adjacent to a target industry
   - Roles with substantial tenure (not 3-month stints)
   - Roles where the candidate had meaningful achievements (use the "—" snippets)
   - DIVERSITY of perspective: if possible, pick 2 different companies and 2 different functions, not 2 roles at the same company

If the candidate only has 1 past role, suggest that one twice with an explanation.
If the candidate has only the current role, return all 3 picks pointing to index 0 with explanation.

Return ONLY valid JSON in this exact shape:
{
  "currentRole": {
    "index": <number — index into work_history for current role>,
    "reason": "<1 sentence why this is the current role>"
  },
  "pastManagers": [
    { "index": <number>, "reason": "<1-2 sentences: why this role's manager strengthens the verification for the target industries>" },
    { "index": <number>, "reason": "<1-2 sentences: why this role complements the first pick>" }
  ],
  "reasoning": "<1-2 sentences: overall strategy — why these 3 references together best demonstrate the candidate's value for [target industries]>"
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[references/suggest] Claude returned no JSON:', text.slice(0, 200))
      return NextResponse.json({ error: 'Could not parse suggestion' }, { status: 500 })
    }
    const parsed = JSON.parse(match[0])
    return NextResponse.json(parsed)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[references/suggest] Claude error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
