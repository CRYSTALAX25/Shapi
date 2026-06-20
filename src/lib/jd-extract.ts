// JD-via-WhatsApp: Claude-driven extraction from a freeform chat transcript
// into a structured roles row that the company can publish.
//
// Mirrors the candidate `chat-to-profile.ts` extractor but on the company
// side. The webhook accumulates messages into profiles.jd_chat; on [JD_DONE]
// (or after enough turns) we call extractRoleFromChat() to produce a draft
// `roles` insert.

import { getAnthropic } from '@/lib/anthropic'
import { createAdminClient } from '@/lib/supabase/admin'

const anthropic = getAnthropic()

export type ExtractedRole = {
  title: string
  department?: string | null
  location?: string | null
  remote?: boolean
  employment_type?: 'full_time' | 'part_time' | 'contract' | 'internship' | null
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string | null
  salary_visible?: boolean
  description?: string
  must_have_skills?: string[]
  nice_to_have_skills?: string[]
  years_experience_min?: number | null
  visa_sponsored?: boolean | null
  // Free-form notes for the hiring manager (extracted preferences,
  // dealbreakers, team context the AI heard but couldn't structure)
  hiring_notes?: string
}

// The system prompt for the JD intake interview. Designed to elicit the same
// content a CV would, but on the company side: title, required skills,
// location/remote, salary range, ideal candidate profile.
export const JD_SYSTEM_PROMPT = `You are Shapi, helping a hiring manager describe a role they want to fill. Be warm and concise — like a recruiter friend who knows what matters.

Your goal is to capture enough information to write a clear, accurate job description and to match candidates well.

ASK FOR (one or two questions per message — never a wall):
1. Role title + level (junior/mid/senior/lead/head?)
2. Department or team
3. Location — city, country, remote, hybrid?
4. Employment type — full-time, part-time, contract?
5. Must-have skills (3-5 things they truly need)
6. Nice-to-haves (things that would make you say yes)
7. Years of experience expected
8. Salary range + currency (or "negotiable" — but push gently for a range)
9. Visa sponsorship — yes/no/case-by-case?
10. Hiring context — what's the team like, what does success in 6 months look like, what's the dealbreaker

STYLE:
- Warm, conversational, no jargon
- Acknowledge what they say before asking the next thing
- If they answer vaguely, gently probe ("can you give me an example of what 'good' looks like for this role?")
- After 6-8 exchanges, or if you have enough, wrap with: "Got it — drafting your role now. You'll see it on your dashboard in a moment. Hit reply if anything needs tweaking." END YOUR MESSAGE with exactly: [JD_DONE]

DO NOT:
- Ask everything at once
- Be formal or template-y
- Suggest salary numbers — let them tell you
- End early if you don't have at least title + 2-3 skills + location`

// Build the full chat for Claude (system + history). When `userTurns >= 8`
// we tighten the prompt to force a wrap.
export function buildJDPrompt(userTurns: number): string {
  return `${JD_SYSTEM_PROMPT}

This is exchange ${userTurns + 1}. ${userTurns >= 8
    ? 'You have enough context. Wrap up now with [JD_DONE].'
    : userTurns >= 6
    ? 'You can wrap up with [JD_DONE] if you have title + skills + location + at least one of salary/experience. Otherwise ask the most important missing piece.'
    : 'Keep digging — there are still gaps to close.'}`
}

// Call Claude to extract the structured role from the JD chat history.
// Returns null on parse failure (caller can fall back to "draft with title only").
export async function extractRoleFromChat(
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  companyName: string,
): Promise<ExtractedRole | null> {
  const transcript = chatHistory
    .map(m => `${m.role === 'user' ? 'HIRING MANAGER' : 'SHAPI'}: ${m.content}`)
    .join('\n')

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      messages: [{
        role: 'user',
        content: `You're extracting a structured job listing from a WhatsApp conversation between a hiring manager at "${companyName}" and Shapi.

TRANSCRIPT:
${transcript}

Extract everything mentioned. Do NOT invent or pad — leave fields null if not stated. Be conservative: only mark must_have if the hiring manager called it out as required (not a nice-to-have).

Return ONLY valid JSON matching this schema (no markdown, no commentary):
{
  "title": "exact role title — capitalised properly",
  "department": "team or function (Engineering, Marketing, etc.) or null",
  "location": "city, country format (e.g. 'Dubai, UAE') or null",
  "remote": true | false,
  "employment_type": "full_time | part_time | contract | internship | null",
  "salary_min": number or null,
  "salary_max": number or null,
  "salary_currency": "USD | AED | EUR | GBP | etc. or null",
  "salary_visible": true | false (default true unless they said don't show it),
  "description": "2-4 paragraph job description in their voice, written from the company's perspective",
  "must_have_skills": ["skill 1", "skill 2", ...] (3-7 items, only if explicitly required),
  "nice_to_have_skills": ["skill", ...] (optional),
  "years_experience_min": number or null,
  "visa_sponsored": true | false | null,
  "hiring_notes": "any context Shapi heard about team culture, dealbreakers, what success looks like — anything that didn't fit in the structured fields"
}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    // Strip markdown fences if Claude added them
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[jd-extract] No JSON block found in response')
      return null
    }
    return JSON.parse(match[0]) as ExtractedRole
  } catch (err) {
    console.error('[jd-extract] failed:', err)
    return null
  }
}

// Insert/update the draft role row from an ExtractedRole. If `roleId` is
// provided, updates that draft; otherwise creates a new one.
// Returns the resulting role id.
export async function saveDraftRole(
  companyId: string,
  extracted: ExtractedRole,
  existingRoleId?: string,
): Promise<string | null> {
  const admin = createAdminClient()

  const payload = {
    company_id: companyId,
    title: extracted.title || 'Untitled role (draft)',
    department: extracted.department || null,
    location: extracted.location || null,
    remote: extracted.remote ?? false,
    employment_type: extracted.employment_type || 'full_time',
    salary_min: extracted.salary_min || null,
    salary_max: extracted.salary_max || null,
    salary_currency: extracted.salary_currency || null,
    salary_visible: extracted.salary_visible ?? true,
    description: extracted.description || '',
    must_have_skills: extracted.must_have_skills || [],
    nice_to_have_skills: extracted.nice_to_have_skills || [],
    years_experience_min: extracted.years_experience_min || null,
    visa_sponsored: extracted.visa_sponsored,
    hiring_notes: extracted.hiring_notes || '',
    status: 'draft' as const,
    updated_at: new Date().toISOString(),
  }

  if (existingRoleId) {
    const { error } = await admin.from('roles').update(payload).eq('id', existingRoleId)
    if (error) {
      console.error('[jd-extract] update failed:', error)
      return null
    }
    return existingRoleId
  }

  const { data, error } = await admin
    .from('roles')
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) {
    console.error('[jd-extract] insert failed:', error)
    return null
  }
  return data?.id ?? null
}
