// Reference WhatsApp Q&A engine — runs the conversational reference check
// for managers (5 topics + 2 nominees) and nominees (3 topics).
//
// Used by the WhatsApp webhook when an incoming message comes from a phone
// matching a candidate_references row in 'contacted' or 'opened' state.

import Anthropic from '@anthropic-ai/sdk'

type ChatTurn = { role: 'user' | 'assistant'; content: string }

export type ParsedManagerResponse = {
  quality: string
  achievement: string
  skills: string
  would_rehire: string
  anything_else: string | null
  nominees: {
    colleague: { name: string | null; phone: string | null; email: string | null }
    stakeholder: { name: string | null; phone: string | null; email: string | null }
  }
}

export type ParsedNomineeResponse = {
  how_worked: string
  biggest_strength: string
  extra: string | null
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

CRITICAL: ${candFirst} does NOT know we've reached out. Tell ${refereeFirst} this up front — they can be completely candid.

COVER 3 TOPICS (one question per message):
  1. How did you actually work with ${candFirst}? (same team? cross-functional? client relationship?)
  2. What was their biggest strength — based on what you saw?
  3. Anything else? Strengths OR areas where they could grow. Confidential.

After all 3 are covered → wrap up warmly. Thank them. End your final message with EXACTLY: [REF_DONE]

WHATSAPP STYLE:
- Max 3 sentences per message
- One question at a time, never stack
- Conversational, not formal
- Detect their language and reply in same language
- Acknowledge before next question

This is exchange ${exchangeCount + 1}.
${exchangeCount === 0 ? 'OPEN: Greet them by first name, explain ' + nominatorName + ' suggested them, reassure them ' + candFirst + ' can\'t see this, ask the first topic.' : 'Continue the conversation naturally.'}`
}

export async function runReferenceTurn(opts: {
  refType: 'manager' | 'colleague' | 'stakeholder'
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
export async function parseManagerResponses(history: ChatTurn[]): Promise<ParsedManagerResponse> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const transcript = history.map(m => `${m.role === 'user' ? 'REFEREE' : 'SHAPI'}: ${m.content}`).join('\n')

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Extract structured reference answers from this manager reference check conversation. The referee was the candidate's manager.

TRANSCRIPT:
${transcript}

Return ONLY valid JSON in this exact shape:
{
  "quality": "1-3 sentence summary of what the manager said about quality of work",
  "achievement": "the biggest achievement they described, verbatim or close to it",
  "skills": "specific skills/tools/methodologies they mentioned",
  "would_rehire": "yes / no / conditional — followed by a 1-sentence explanation",
  "anything_else": "any additional context they shared, OR null if none",
  "nominees": {
    "colleague": { "name": "...", "phone": "+xxx... or null", "email": "x@y.com or null" },
    "stakeholder": { "name": "...", "phone": "+xxx... or null", "email": "x@y.com or null" }
  }
}

Rules:
- If the manager didn't provide a phone or email for a nominee, use null for that field
- If a nominee was not provided at all, set name to null
- Use the candidate's actual words wherever possible — don't paraphrase aggressively`,
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
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Extract structured reference answers from this colleague/stakeholder reference check conversation.

TRANSCRIPT:
${transcript}

Return ONLY valid JSON:
{
  "how_worked": "1-2 sentence summary of the working relationship",
  "biggest_strength": "the strength they highlighted",
  "extra": "additional context — strengths OR growth areas — or null"
}`,
    }],
  })

  const text = res.content[0].type === 'text' ? res.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Failed to parse nominee reference responses')
  return JSON.parse(match[0]) as ParsedNomineeResponse
}
