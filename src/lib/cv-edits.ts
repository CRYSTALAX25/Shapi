// WhatsApp conversational CV edits — interprets a candidate's incoming message,
// decides if it's an edit request or just chat, applies the edit to the right
// profile field, invalidates affected cv_cache entries, and returns a confirmation.
//
// Triggered from the webhook's post-interview branch (Priority 3) — replaces the
// generic "got it, your profile is being prepared" ack with a Claude-powered
// edit interpreter.

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

type WorkEntry = {
  title?: string
  company?: string
  start?: string
  end?: string
  achievements?: string
}

type LanguageEntry = { language: string; level: string }

type ProfileSnapshot = {
  full_name: string | null
  headline: string | null
  location: string | null
  summary: string | null
  work_history: WorkEntry[]
  skills: string[]
  languages_spoken: LanguageEntry[]
}

type EditResponse = {
  intent: 'edit' | 'question' | 'chat'
  updates?: Partial<ProfileSnapshot>
  affected_cv_caches: 'all' | 'none'   // 'all' = clear cv_cache + sessionStorage; 'none' = no CV regen needed
  reply: string                          // what we send back on WhatsApp
}

export async function interpretAndApplyEdit(
  candidateId: string,
  userMessage: string,
): Promise<EditResponse> {
  const admin = createAdminClient()

  // Load the current profile snapshot
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, headline, location, summary, work_history, skills, languages_spoken')
    .eq('id', candidateId)
    .single()

  if (!profile) {
    return {
      intent: 'chat',
      affected_cv_caches: 'none',
      reply: "Hey 👋 I can't find your profile right now. Try again in a moment, or head to shapi.io.",
    }
  }

  const snapshot: ProfileSnapshot = {
    full_name: (profile.full_name as string) || null,
    headline: (profile.headline as string) || null,
    location: (profile.location as string) || null,
    summary: (profile.summary as string) || null,
    work_history: Array.isArray(profile.work_history) ? profile.work_history as WorkEntry[] : [],
    skills: Array.isArray(profile.skills) ? profile.skills as string[] : [],
    languages_spoken: Array.isArray(profile.languages_spoken) ? profile.languages_spoken as LanguageEntry[] : [],
  }

  const firstName = snapshot.full_name?.split(' ')[0] || 'there'
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are Shapi handling a post-interview WhatsApp message from a candidate whose CV has already been generated. Your job: figure out what they want and act on it.

═══ CURRENT PROFILE (read carefully) ═══
${JSON.stringify(snapshot, null, 2)}

═══ THEIR MESSAGE ═══
${userMessage}

═══ POSSIBLE INTENTS ═══

A) "edit" — they want to change something on their CV. Examples:
   - "Change my headline to X" → update headline
   - "Remove the bit about Crystalax revenue from my summary" → edit summary
   - "Add to my NEOM role: I led the $40M contract restructuring" → edit work_history[i].achievements (find the right role by company/title match)
   - "My time at NEOM was actually 2023-2025 not 2023-2024" → update work_history[i].start/end
   - "Add Spanish to my languages" → push to languages_spoken
   - "Remove the European Times role entirely" → filter work_history
   - "Make my summary shorter" → rewrite summary briefer
   - "Move my NEOM job to the top" → reorder work_history (NEOM first)

B) "question" — they're asking ABOUT their profile/CV, not editing it. Examples:
   - "What did you put as my headline?"
   - "When does the verification get done?"
   - "Can I download in Spanish too?"
   Answer them concisely from what's known. Don't fabricate.

C) "chat" — small talk, thanks, anything that doesn't need profile changes
   - "Thanks!" / "Great, looks good"

═══ INTENT RULES ═══

For "edit":
- Identify which profile field(s) change. Possible fields: full_name, headline, location, summary, work_history, skills, languages_spoken.
- For work_history edits: find the right role by matching the candidate's reference (company name, title, dates). If ambiguous, pick the most recent matching role.
- Return the FULL NEW VALUE of every changed field (not just a diff). For arrays, return the entire updated array.
- Be conservative — don't make changes the user didn't explicitly ask for.
- Reply on WhatsApp: confirm what you changed, in 1-2 sentences max. Friendly.
- Set affected_cv_caches='all' so the CV regenerates next time they hit print.

For "question":
- Answer from snapshot only. Don't invent.
- Set affected_cv_caches='none'.
- Don't include updates field.

For "chat":
- Brief, warm reply. Set affected_cv_caches='none'.

═══ LANGUAGE ═══
Detect what language the user wrote in and respond in that SAME language. Arabic → Arabic, Italian → Italian, etc.

═══ OUTPUT ═══
Return ONLY valid JSON in this exact shape (no markdown fences, no commentary):
{
  "intent": "edit" | "question" | "chat",
  "updates": {
    "headline": "..." OR omit if unchanged,
    "summary": "..." OR omit if unchanged,
    "work_history": [...] OR omit if unchanged,
    "skills": [...] OR omit if unchanged,
    "languages_spoken": [...] OR omit if unchanged,
    "location": "..." OR omit if unchanged,
    "full_name": "..." OR omit if unchanged
  },
  "affected_cv_caches": "all" | "none",
  "reply": "the actual WhatsApp message text — what they'll see, 1-2 sentences max"
}

If intent is "question" or "chat", omit the "updates" field entirely.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[cv-edits] no JSON in response:', text.slice(0, 200))
      return {
        intent: 'chat',
        affected_cv_caches: 'none',
        reply: `Hey ${firstName} 👋 Got your message. If you wanted to change something on your CV, tell me exactly what — e.g. "change my headline to Director of Operations".`,
      }
    }
    const parsed = JSON.parse(match[0]) as EditResponse

    // Apply edits if any
    if (parsed.intent === 'edit' && parsed.updates && Object.keys(parsed.updates).length > 0) {
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      // Allowlist fields that Claude is allowed to change
      const allowedFields: Array<keyof ProfileSnapshot> = [
        'full_name', 'headline', 'location', 'summary',
        'work_history', 'skills', 'languages_spoken',
      ]
      for (const field of allowedFields) {
        if (parsed.updates[field] !== undefined) {
          updatePayload[field] = parsed.updates[field]
        }
      }

      // If any change was applied, clear the cv_cache (forces regeneration on next view)
      if (parsed.affected_cv_caches === 'all') {
        updatePayload.cv_cache = {}
      }

      await admin.from('profiles').update(updatePayload).eq('id', candidateId)
      console.log('[cv-edits] applied edit to:', Object.keys(parsed.updates).join(','), '| cv_cache cleared:', parsed.affected_cv_caches === 'all')
    }

    return parsed
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cv-edits] Claude error:', msg)
    return {
      intent: 'chat',
      affected_cv_caches: 'none',
      reply: "Hmm, didn't catch that. Try again? You can ask me to change your headline, summary, a role's details, or your skills.",
    }
  }
}
