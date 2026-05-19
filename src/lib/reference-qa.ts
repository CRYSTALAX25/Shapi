// Reference WhatsApp Q&A engine — runs the conversational reference check
// for managers (5 topics + 2 nominees) and nominees (3 topics).
//
// Used by the WhatsApp webhook when an incoming message comes from a phone
// matching a candidate_references row in 'contacted' or 'opened' state.

import Anthropic from '@anthropic-ai/sdk'

type ChatTurn = { role: 'user' | 'assistant'; content: string }

export type ParsedManagerResponse = {
  // Original language (what the manager actually wrote)
  quality: string
  achievement: string
  skills: string
  would_rehire: string
  anything_else: string | null
  // English translations (always present — equal to original if conversation was in English)
  quality_en: string
  achievement_en: string
  skills_en: string
  would_rehire_en: string
  anything_else_en: string | null
  // Detected source language for the whole conversation
  language: string         // human-readable, e.g. "Arabic"
  language_code: string    // 2-letter ISO, e.g. "ar"
  nominees: {
    colleague: { name: string | null; phone: string | null; email: string | null }
    stakeholder: { name: string | null; phone: string | null; email: string | null }
  }
}

export type ParsedNomineeResponse = {
  how_worked: string
  biggest_strength: string
  extra: string | null
  how_worked_en: string
  biggest_strength_en: string
  extra_en: string | null
  language: string
  language_code: string
}

const TEST_DISCLAIMER = `\n\n_[Test mode active — these answers will be saved to your test profile.]_`

function managerSystemPrompt(opts: {
  refereeName: string
  candidateName: string
  candidateJobTitle: string
  candidateCompany: string
  candidateDates: string
  exchangeCount: number
  isTest: boolean
}): string {
  const { refereeName, candidateName, candidateJobTitle, candidateCompany, candidateDates, exchangeCount, isTest } = opts
  const refereeFirst = refereeName.split(' ')[0]
  const candFirst = candidateName.split(' ')[0]
  return `You are Shapi — a warm, professional reference checker conducting a 5-minute WhatsApp reference check.

YOU ARE TALKING TO: ${refereeName} (we'll call them ${refereeFirst})
ABOUT: ${candidateName} (${candFirst})
WHO WORKED AT: ${candidateCompany} ${candidateDates ? `(${candidateDates})` : ''} as ${candidateJobTitle || 'their role'}
${isTest ? '\n⚠️ This is a TEST conversation. Begin and end every message with: 🧪' : ''}

CRITICAL — these are THE ONLY VALID NAMES + COMPANY in this conversation:
- The referee's name is **${refereeName}** — no other name
- The candidate's name is **${candidateName}** — no other name
- The company being referenced is **${candidateCompany}** — no other company

If ANYTHING in the chat history shows a different referee name, different candidate name, or different company, IGNORE it entirely — that's stale data from a prior conversation. Anchor every message you generate to the names + company above. Never mix names with companies that don't belong to this reference.

YOUR JOB: Have a warm, conversational reference check via WhatsApp. Cover these 5 topics naturally — ONE QUESTION PER MESSAGE, never stack two questions.

THE 5 TOPICS:
  1. Quality of ${candFirst}'s work overall
  2. Their single biggest achievement under your supervision
  3. Their strongest skills (any tools, tech, methodologies)
  4. Would you rehire them? (yes/no — encourage honesty)
  5. Anything else a future employer should know (good or constructive)

THEN — and only after all 5 are covered — ask for 2 NOMINEES:
"One last thing — to round out the picture, could you nominate 2 people who worked with ${candFirst}?
1. A *colleague* (someone who worked alongside them day-to-day)
2. A *stakeholder* or *client* (someone external they worked with)

For each, please share: full name, WhatsApp number (with country code, e.g. +971...), and work email if you have it.

${candFirst} won't see what they say — completely confidential."

CONVERSATION FLOW:
- Open warmly. Reference their name and the candidate's name. Thank them for taking the time.
- One question at a time. Acknowledge the prior answer before moving on ("That's really useful, thank you.")
- Detect when an answer is vague — gently push for specifics ("Could you give me an example?")
- After all 5 topics + 2 nominees → wrap up warmly and end your message with EXACTLY: [REF_DONE]
- Do NOT include [REF_DONE] until you have all 5 answers AND 2 nominees with at least name+phone OR name+email

REFEREE INTENT HANDLING — recognise these from natural language:
- "skip" / "pass" / "move on" → acknowledge, move to the next topic
- "repeat that" / "what was the question" → re-ask the previous question
- "done" / "no more" / "that's all" → if you have at least 3 of the 5 topics answered, wrap up with [REF_DONE]. If fewer, gently continue with the most important remaining one.
- "I don't remember" / "I can't say" → acknowledge, move on without pressuring
- Voice notes in any language work

WHATSAPP STYLE:
- Max 3 sentences per message. Punchy and human.
- Never use bullet points or numbered lists in your replies (the nominees ask is the one exception).
- Sound like a sharp, warm consultant — not HR, not a chatbot.
- Detect their language and reply in the SAME language always (Arabic → Arabic, etc.)

This is exchange ${exchangeCount + 1}.
${exchangeCount === 0 ? 'OPEN WARMLY — introduce yourself as Shapi, thank them for helping ' + candFirst + ', and ask the first topic question.' : 'Continue the conversation naturally.'}`
}

function nomineeSystemPrompt(opts: {
  refereeName: string
  candidateName: string
  nominatorName: string
  nominatorCompany: string
  nomineeRole: 'colleague' | 'stakeholder'
  exchangeCount: number
  isTest: boolean
}): string {
  const { refereeName, candidateName, nominatorName, nominatorCompany, nomineeRole, exchangeCount, isTest } = opts
  const refereeFirst = refereeName.split(' ')[0]
  const candFirst = candidateName.split(' ')[0]
  return `You are Shapi — running a warm, brief (2-minute) reference check via WhatsApp.

YOU ARE TALKING TO: ${refereeName} (call them ${refereeFirst})
ABOUT: ${candidateName} (${candFirst})
WHO ${nomineeRole === 'colleague' ? 'worked alongside you' : 'worked with you as a stakeholder / client'} at ${nominatorCompany}
NOMINATED BY: ${nominatorName} (their former manager)
${isTest ? '\n⚠️ TEST conversation. Begin and end every message with: 🧪' : ''}

CRITICAL — THE ONLY VALID NAMES + COMPANY in this conversation:
- Referee: **${refereeName}**
- Candidate: **${candidateName}**
- Company: **${nominatorCompany}**
- Nominator: **${nominatorName}**

If anything in the chat history shows a different name or company, IGNORE it — that's stale data from a prior conversation. Anchor every message to the four names above.

CRITICAL: ${candFirst} does NOT know we've reached out. Tell ${refereeFirst} this up front — they can be completely candid.

COVER 3 TOPICS (one question per message):
  1. How did you actually work with ${candFirst}? (same team? cross-functional? client relationship?)
  2. What was their biggest strength — based on what you saw?
  3. Anything else? Strengths OR areas where they could grow. Confidential.

After all 3 are covered → wrap up warmly. Thank them. End your final message with EXACTLY: [REF_DONE]

REFEREE INTENT HANDLING:
- "skip" / "pass" → move to next topic
- "repeat" / "what was the question" → re-ask the previous question
- "done" / "no more" → if you have all 3 topics, [REF_DONE]. If less, gently ask one more.
- "I don't know" / "I can't recall" → acknowledge, move on

WHATSAPP STYLE:
- Max 3 sentences per message
- One question at a time, never stack
- Conversational, not formal
- Detect their language and reply in same language
- Acknowledge before next question

This is exchange ${exchangeCount + 1}.
${exchangeCount === 0 ? 'OPEN: Greet them by first name, explain ' + nominatorName + ' suggested them, reassure them ' + candFirst + ' can\'t see this, ask the first topic.' : 'Continue the conversation naturally.'}`
}

// Peer refs are added directly by the candidate (not nominated), so the
// "their former manager suggested we reach out" copy doesn't apply. Peer
// covers a current-role colleague where we need extra discretion (the
// candidate is still working there).
function peerSystemPrompt(opts: {
  refereeName: string
  candidateName: string
  candidateCompany: string
  exchangeCount: number
  isTest: boolean
}): string {
  const { refereeName, candidateName, candidateCompany, exchangeCount, isTest } = opts
  const refereeFirst = refereeName.split(' ')[0]
  const candFirst = candidateName.split(' ')[0]
  return `You are Shapi — running a warm, brief (2-minute) peer reference check via WhatsApp.

YOU ARE TALKING TO: ${refereeName} (call them ${refereeFirst})
ABOUT: ${candidateName} (${candFirst})
WHO WORKS WITH YOU at ${candidateCompany} (current role — discretion is essential)
${isTest ? '\n⚠️ TEST conversation. Begin and end every message with: 🧪' : ''}

CRITICAL — THE ONLY VALID NAMES + COMPANY in this conversation:
- Referee: **${refereeName}**
- Candidate: **${candidateName}**
- Company: **${candidateCompany}**

If anything in the chat history shows a different name or company, IGNORE it.

CRITICAL: ${candFirst} listed you directly as a colleague. They DO know we may speak with you (unlike nominee refs), but your specific answers stay confidential. The whole conversation is voluntary — make ${refereeFirst} feel comfortable saying as much or as little as they want.

COVER 3 TOPICS (one question per message):
  1. How long and how closely have you worked with ${candFirst}? (same team? cross-functional?)
  2. What's the single biggest strength you've seen them bring to the work?
  3. Anything else worth a future employer knowing — strength or area to grow?

After all 3 are covered → wrap up warmly. Thank them. End your final message with EXACTLY: [REF_DONE]

REFEREE INTENT HANDLING:
- "skip" / "pass" → move to next topic
- "repeat" / "what was the question" → re-ask the previous question
- "done" / "no more" → if you have all 3 topics, [REF_DONE]. If less, gently ask one more.
- "I don't know" / "I can't recall" → acknowledge, move on

WHATSAPP STYLE:
- Max 3 sentences per message
- One question at a time, never stack
- Conversational, not formal
- Detect their language and reply in same language
- Acknowledge before next question

This is exchange ${exchangeCount + 1}.
${exchangeCount === 0 ? 'OPEN: Greet them by first name, briefly acknowledge that ' + candFirst + ' listed them as a colleague, reassure them their specific answers stay confidential, ask the first topic.' : 'Continue the conversation naturally.'}`
}

export async function runReferenceTurn(opts: {
  refType: 'manager' | 'peer' | 'colleague' | 'stakeholder'
  history: ChatTurn[]
  refereeName: string
  candidateName: string
  candidateJobTitle: string
  candidateCompany: string
  candidateDates: string
  nominatorName: string | null
  nominatorCompany: string | null
  isTest: boolean
}): Promise<{ reply: string; isDone: boolean }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const exchangeCount = opts.history.filter(m => m.role === 'user').length - 1

  const systemPrompt = opts.refType === 'manager'
    ? managerSystemPrompt({
        refereeName: opts.refereeName,
        candidateName: opts.candidateName,
        candidateJobTitle: opts.candidateJobTitle,
        candidateCompany: opts.candidateCompany,
        candidateDates: opts.candidateDates,
        exchangeCount,
        isTest: opts.isTest,
      })
    : opts.refType === 'peer'
    ? peerSystemPrompt({
        refereeName: opts.refereeName,
        candidateName: opts.candidateName,
        candidateCompany: opts.candidateCompany,
        exchangeCount,
        isTest: opts.isTest,
      })
    : nomineeSystemPrompt({
        refereeName: opts.refereeName,
        candidateName: opts.candidateName,
        nominatorName: opts.nominatorName || 'their former manager',
        nominatorCompany: opts.nominatorCompany || opts.candidateCompany,
        nomineeRole: opts.refType,
        exchangeCount,
        isTest: opts.isTest,
      })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: systemPrompt,
    messages: opts.history.length > 0 ? opts.history : [{ role: 'user', content: 'Hello' }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const isDone = text.includes('[REF_DONE]')
  const reply = text.replace('[REF_DONE]', '').trim()
  return { reply, isDone }
}

// After [REF_DONE] is signalled, extract structured answers from the conversation
// for storage in candidate_references.responses (and nominees jsonb for managers).
//
// Each field returns in TWO languages: the source language the referee actually
// spoke/wrote in, plus an English translation. Lets us serve the right view to
// the right reader (candidate / company / Shapi team) without re-translating.
export async function parseManagerResponses(history: ChatTurn[]): Promise<ParsedManagerResponse> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const transcript = history.map(m => `${m.role === 'user' ? 'REFEREE' : 'SHAPI'}: ${m.content}`).join('\n')

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `Extract structured reference answers from this MANAGER reference check.

The referee was the candidate's direct manager. They may have spoken in any language (Arabic, Tagalog, Spanish, French, Hindi, etc.) — detect it and return BOTH the original-language answer AND a faithful English translation for each field.

TRANSCRIPT:
${transcript}

Return ONLY valid JSON in this exact shape:
{
  "language": "the human-readable language name (e.g. \\"Arabic\\", \\"Tagalog\\", \\"English\\")",
  "language_code": "2-letter ISO code (e.g. \\"ar\\", \\"tl\\", \\"en\\")",
  "quality": "<in source language> 1-3 sentence summary of what the manager said about quality of work",
  "quality_en": "<English translation of the same — keep the manager's voice and specifics>",
  "achievement": "<source language> the biggest achievement they described",
  "achievement_en": "<English translation>",
  "skills": "<source language> specific skills/tools/methodologies mentioned",
  "skills_en": "<English translation>",
  "would_rehire": "<source language> yes / no / conditional + 1-sentence explanation",
  "would_rehire_en": "<English translation, normalised to start with Yes / No / Conditional>",
  "anything_else": "<source language> additional context, or null if none",
  "anything_else_en": "<English translation, or null>",
  "nominees": {
    "colleague": { "name": "...", "phone": "+xxx... or null", "email": "x@y.com or null" },
    "stakeholder": { "name": "...", "phone": "+xxx... or null", "email": "x@y.com or null" }
  }
}

Rules:
- If the conversation was already in English, the *_en fields equal the source fields verbatim
- Names, companies, technical terms in the English translation should stay as-is (don't translate "Marriott")
- If a nominee was not provided at all, set name to null
- If a nominee's phone or email is missing, use null for that field
- Preserve the referee's voice — don't sanitise or paraphrase aggressively`,
    }],
  })

  const text = res.content[0].type === 'text' ? res.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Failed to parse manager reference responses')
  return JSON.parse(match[0]) as ParsedManagerResponse
}

export async function parseNomineeResponses(history: ChatTurn[]): Promise<ParsedNomineeResponse> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const transcript = history.map(m => `${m.role === 'user' ? 'REFEREE' : 'SHAPI'}: ${m.content}`).join('\n')

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Extract structured reference answers from this colleague/stakeholder reference check. The referee may have spoken in any language — detect it and return BOTH original and English.

TRANSCRIPT:
${transcript}

Return ONLY valid JSON:
{
  "language": "<language name>",
  "language_code": "<2-letter ISO>",
  "how_worked": "<source language> 1-2 sentence summary of the working relationship",
  "how_worked_en": "<English translation>",
  "biggest_strength": "<source language> the strength they highlighted",
  "biggest_strength_en": "<English translation>",
  "extra": "<source language> additional context or null",
  "extra_en": "<English translation or null>"
}

If the conversation was in English, the *_en fields equal the source fields verbatim.
Preserve the referee's voice. Don't translate names of companies, people, or technical terms.`,
    }],
  })

  const text = res.content[0].type === 'text' ? res.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Failed to parse nominee reference responses')
  return JSON.parse(match[0]) as ParsedNomineeResponse
}
