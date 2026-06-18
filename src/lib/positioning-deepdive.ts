// ─────────────────────────────────────────────────────────────────────────────
// Positioning Deep-Dive — the WhatsApp interview that surfaces the PROOF that
// makes a candidate undeniable, for the Verified Positioning CV.
//
// This is NOT the industry-coverage deep-dive (which fills gaps against an
// industry brief). Its job is to extract, across all four skill axes, the
// single strongest QUANTIFIED, VERIFIABLE achievement per axis — and crucially
// the proudest achievements that NEVER make it onto a CV (the training school
// that placed 100+ young mothers; the company built from zero). Those off-CV
// stories are usually the strongest proof a person has, and a CV parser can
// never see them. This interview is how they enter the system.
//
// Design principles (non-negotiable — this feeds people's careers):
//   1. Hunt ACHIEVEMENTS, never duties.
//   2. Every story must end with a NUMBER and a VERIFIER (who can confirm it).
//      No number → keep pushing, gently. No verifier → it stays self-reported.
//   3. Deliberately cover all four axes so range shows — but never force a weak
//      story to fill an axis. A genuine gap is a gap.
//   4. Lead with the off-CV gem; it's the highest-value, most human proof.
//   5. Adapt to what the CV already shows — go deeper, don't re-ask the known.
//   6. One question at a time. Warm. Voice-notes welcome. Their language.
//   7. NEVER invent, inflate, or put words in their mouth. Verification-first
//      applies to the candidate's own story too.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Axis = 'Head' | 'Hands' | 'Spark' | 'Heart'

// What each axis means + what a STRONG proof for it looks like. Shared by the
// interviewer (to probe) and the extractor (to classify + score).
export const AXIS_GUIDE: Record<Axis, { meaning: string; strongProof: string; probe: string }> = {
  Head: {
    meaning: 'Strategy, structure, judgement — untangling complexity, turnarounds, restructures, decisions that saved or made serious money, governance.',
    strongProof: 'A complex or broken situation they turned around, with the money or risk impact named (e.g. "$40M saved restructuring a $56M contract").',
    probe: 'What is the most complex or broken situation you have turned around — where your judgement saved or made real money? Walk me through what you actually decided.',
  },
  Hands: {
    meaning: 'Execution and delivery at scale — running big, operationally demanding things; logistics; the buck-stops-here delivery where the stakes or the scale were highest.',
    strongProof: 'The largest / hardest thing they personally ran or delivered, with the scale named (people, sites, budget, throughput).',
    probe: 'What is the biggest, most operationally demanding thing you have personally run or delivered? How large was it — people, sites, budget — and where did the buck stop?',
  },
  Spark: {
    meaning: 'Building and creating from nothing — founding companies, launching products/programmes/teams, originating something that did not exist before they made it.',
    strongProof: 'Something built from zero, with the growth/outcome named (e.g. "0 → £1M turnover in 3 years").',
    probe: 'What have you built from nothing — a company, a team, a programme, a product — that did not exist until you made it? Where did it start and where did it get to?',
  },
  Heart: {
    meaning: 'People and human impact — building and developing teams, mentoring, changing lives, social impact; the difference they made to people, including outside formal "work".',
    strongProof: 'People developed or lifted, with the number named (e.g. "trained 100+ young mothers and placed them into work").',
    probe: 'Who have you developed or lifted? A team you built, people whose careers — or lives — you changed. Include the things you are proud of even if they were never a "job".',
  },
}

// The interview arc — the order matters. Lead with the off-CV gem (highest
// value, disarming), then the four axes, then the signature line. The
// interviewer follows the candidate's energy but ensures every item is hit.
export const INTERVIEW_ARC = [
  { id: 'frame', intent: 'Set the frame: we are finding the proof that makes you undeniable, including the things that never make it onto a CV.' },
  { id: 'off_cv', intent: 'The off-CV gem — the achievement they are PROUDEST of that is not written down anywhere. The thing they would tell a friend, not a recruiter. (This often becomes the strongest Heart or Spark proof.)' },
  { id: 'spark', intent: AXIS_GUIDE.Spark.probe },
  { id: 'head', intent: AXIS_GUIDE.Head.probe },
  { id: 'hands', intent: AXIS_GUIDE.Hands.probe },
  { id: 'heart', intent: AXIS_GUIDE.Heart.probe },
  { id: 'signature', intent: 'The signature line: if a hiring manager remembered ONE thing about you, what should it be?' },
] as const

// A proof extracted from the conversation (or the CV) for the positioning CV.
export type PositioningProof = {
  axis: Axis
  number: string                 // "$40M", "£1M", "100+", "2,000+"
  outcome: string                // "saved restructuring a $56M facilities contract"
  context: string                // "NEOM · Business Operations Manager"
  verifier: string | null        // who/what could confirm it (a person, company, body) — feeds verification
  source: 'cv' | 'deepdive'      // where it surfaced
  confidence: 'high' | 'medium' | 'low' // how concrete + quantified it is
}

function profileSummary(p: { full_name?: string | null; headline?: string | null; summary?: string | null; work_history?: unknown; skills?: unknown }) {
  const wh = Array.isArray(p.work_history) ? p.work_history : []
  return [
    `Name: ${p.full_name || 'Candidate'}`,
    `Headline: ${p.headline || '—'}`,
    `Summary: ${(p.summary as string) || '—'}`,
    `Skills: ${Array.isArray(p.skills) ? (p.skills as string[]).join(', ') : '—'}`,
    `Work history: ${JSON.stringify(wh)}`,
  ].join('\n')
}

// The SYSTEM PROMPT that drives the conversational interviewer (used per WhatsApp
// turn — fed the prior turns + this prompt). It already knows the candidate's CV
// so it never re-asks the known and goes straight for what's missing or thin.
export function buildInterviewerSystemPrompt(p: Parameters<typeof profileSummary>[0]): string {
  const firstName = (p.full_name as string || 'there').split(' ')[0]
  return `You are a warm, sharp career interviewer for Shapi, running a WhatsApp deep-dive to surface the PROOF that makes ${firstName} undeniable — for a new kind of CV that leads with verified achievements, not a job list.

WHAT YOU ALREADY KNOW (do NOT re-ask this — go deeper or find what's missing):
${profileSummary(p)}

YOUR MISSION
Surface the single strongest QUANTIFIED, VERIFIABLE achievement on EACH of four axes, plus the proudest achievements that are NOT on the CV (these are often the best — the company built from zero, the people whose lives they changed). A CV parser cannot see these; you are the only way they enter the system.

THE FOUR AXES (cover all four across the conversation):
- HEAD — ${AXIS_GUIDE.Head.meaning}
- HANDS — ${AXIS_GUIDE.Hands.meaning}
- SPARK — ${AXIS_GUIDE.Spark.meaning}
- HEART — ${AXIS_GUIDE.Heart.meaning}

THE ARC (follow their energy, but make sure every item is hit):
1. Frame it: you're finding the proof that makes them undeniable, including what never makes it onto a CV.
2. THE OFF-CV GEM first: "What's the achievement you're proudest of that isn't written down anywhere?"
3. SPARK: what have you built from nothing?
4. HEAD: the most complex/broken thing you turned around — where judgement saved or made money.
5. HANDS: the biggest, most operationally demanding thing you personally ran.
6. HEART: who have you developed or lifted — teams, careers, lives.
7. Signature: if a hiring manager remembered ONE thing about you, what should it be?

NON-NEGOTIABLE RULES
- ACHIEVEMENTS, never duties. "What did you DO and what changed?" — not "what were you responsible for?"
- Every story needs a NUMBER. If they don't give one, ask once, gently and specifically: "Roughly how much / how many / how big?" Don't badger.
- Every story needs a VERIFIER. Ask: "Who saw this — a name, a company, a body — who could confirm it?" This is what lets us verify it later; without it, it stays self-reported.
- NEVER invent, inflate, lead, or put numbers/words in their mouth. If they're unsure, that's fine — capture it honestly.
- ONE question per message. Short. Warm. Plain language. Voice notes are welcome — say so early.
- Skip axes the CV already proves richly; spend the time on gaps and on the off-CV stories.
- Acknowledge what they say before the next question — make it feel like a conversation with someone who's impressed, not a form.

WHEN YOU HAVE ENOUGH
Once you have a strong quantified story for each of the four axes (or an honest gap), at least one off-CV gem, and the signature line, warmly wrap up and end your message with the exact token [DEEP_DIVE_DONE] on its own line. Do not pad it out past that.

Write ONLY your next WhatsApp message (no preamble, no JSON).`
}

// A strong opening message (sent first). Personalised, references the CV so it
// feels like the interviewer has read them, and disarms with the off-CV ask.
export function buildOpeningMessage(p: Parameters<typeof profileSummary>[0]): string {
  const firstName = (p.full_name as string || 'there').split(' ')[0]
  return (
    `Hi ${firstName} 👋 This is the part most CVs get wrong.\n\n` +
    `I've read your background — now I want the *proof* behind it, including the things that never make it onto a CV. Honestly, those are often the best: the thing you built from nothing, or the people whose lives you changed.\n\n` +
    `So let's start there: *what's the achievement you're most proud of that isn't written down anywhere?* The one you'd tell a friend about, not a recruiter.\n\n` +
    `Take your time — text or a voice note, whatever's easier.`
  )
}

// The EXTRACTION prompt — turns the full transcript (+ CV) into structured,
// axis-tagged proofs for the selection engine. Pulls from BOTH the conversation
// and the CV, dedupes, and is strict about numbers + verifiers.
export function buildExtractionPrompt(p: Parameters<typeof profileSummary>[0], transcript: string): string {
  return `You are extracting a candidate's strongest achievements into structured proofs for their Verified Positioning CV. Use BOTH their CV and the deep-dive interview transcript. The interview often contains their best, off-CV stories — weight those highly.

THEIR CV:
${profileSummary(p)}

THE DEEP-DIVE TRANSCRIPT:
${transcript}

THE FOUR AXES (classify each proof to exactly one):
- Head — ${AXIS_GUIDE.Head.meaning}  Strong proof: ${AXIS_GUIDE.Head.strongProof}
- Hands — ${AXIS_GUIDE.Hands.meaning}  Strong proof: ${AXIS_GUIDE.Hands.strongProof}
- Spark — ${AXIS_GUIDE.Spark.meaning}  Strong proof: ${AXIS_GUIDE.Spark.strongProof}
- Heart — ${AXIS_GUIDE.Heart.meaning}  Strong proof: ${AXIS_GUIDE.Heart.strongProof}

RULES
- Select the SINGLE STRONGEST proof per axis. Magnitude wins ($/£/people/scale); founding / 0→X / turnarounds rank highest; recency does NOT.
- A proof MUST have a concrete number. If a story has no number, lower its confidence; never invent one.
- 'verifier' = the specific person, company, or body that could confirm it (from what they said). null if none was given.
- 'source' = 'deepdive' if it came (mainly) from the interview, else 'cv'.
- 'confidence' = high (concrete + quantified + verifiable), medium (quantified but soft verifier), low (no hard number).
- Prefer DIFFERENT experiences across the four proofs to show career breadth — but if one experience is genuinely the strongest on two axes and nothing else is close, it may anchor both (say so via context).
- Do NOT inflate, merge unrelated facts, or put words in their mouth.

Return ONLY valid JSON:
{
  "headline": "a bold first-person positioning statement (their throughline across the WHOLE career, not the latest job), with the single most memorable phrase wrapped in ⟦…⟧. Honest — no inflation.",
  "roleLabel": "a short positioning label (e.g. 'Founder · Operations & Commercial Leader') — breadth over latest title",
  "narrative": "2 sentences carrying the range + the human story",
  "proofs": [
    { "axis": "Head|Hands|Spark|Heart", "number": "...", "outcome": "...", "context": "company · role", "verifier": "name/company/body or null", "source": "cv|deepdive", "confidence": "high|medium|low" }
  ]
}`
}

// ── runtime: conversational turn + extraction ────────────────────────────────

const MODEL = 'claude-sonnet-4-6'

type Turn = { role: 'assistant' | 'user'; content: string }
type DeepDiveState = {
  status?: string
  chat?: Turn[]
  started_at?: string
  completed_at?: string
  result?: unknown
}

// Is a positioning deep-dive currently active for this candidate? (Used by the
// WhatsApp webhook to route an incoming reply to this interview.)
export function isPositioningActive(positioning: unknown): boolean {
  return !!positioning && (positioning as DeepDiveState).status === 'in_progress'
}

// Process ONE candidate WhatsApp turn. Appends their message, asks the
// interviewer for the next question, persists the chat, and — when the
// interviewer signals completion — flips to 'completed' and kicks off
// extraction. Returns the message to send back (and whether we're done).
export async function runPositioningTurn(
  admin: SupabaseClient,
  userId: string,
  userMessage: string,
): Promise<{ reply: string; done: boolean } | null> {
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, headline, summary, work_history, skills, positioning_deepdive')
    .eq('id', userId)
    .single()
  if (!profile) return null
  const state = (profile.positioning_deepdive as DeepDiveState) || {}
  if (state.status !== 'in_progress') return null

  const chat: Turn[] = Array.isArray(state.chat) ? state.chat : []
  chat.push({ role: 'user', content: userMessage })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: buildInterviewerSystemPrompt(profile),
    messages: chat.map(t => ({ role: t.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: t.content })),
  })
  let reply = res.content[0].type === 'text' ? res.content[0].text : ''
  const done = /\[DEEP_DIVE_DONE\]/.test(reply)
  reply = reply.replace(/\[DEEP_DIVE_DONE\]/g, '').trim()
  chat.push({ role: 'assistant', content: reply })

  const nextState: DeepDiveState = {
    ...state,
    chat,
    status: done ? 'completed' : 'in_progress',
    ...(done ? { completed_at: new Date().toISOString() } : {}),
  }
  await admin.from('profiles').update({ positioning_deepdive: nextState }).eq('id', userId)

  if (done) {
    // Extract in the background — don't make the candidate wait on the reply.
    runPositioningExtraction(admin, userId).catch(e => console.error('[positioning] extraction failed:', e))
  }
  return { reply, done }
}

// Turn the full transcript (+ CV) into structured, axis-tagged proofs + the
// headline/narrative for the Verified Positioning CV. Stored on
// positioning_deepdive.result for the CV generator + selection engine.
export async function runPositioningExtraction(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, headline, summary, work_history, skills, positioning_deepdive')
    .eq('id', userId)
    .single()
  if (!profile) return
  const state = (profile.positioning_deepdive as DeepDiveState) || {}
  const chat: Turn[] = Array.isArray(state.chat) ? state.chat : []
  const transcript = chat
    .map(t => `${t.role === 'assistant' ? 'INTERVIEWER' : 'CANDIDATE'}: ${t.content}`)
    .join('\n\n')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1600,
    messages: [{ role: 'user', content: buildExtractionPrompt(profile, transcript) }],
  })
  const text = res.content[0].type === 'text' ? res.content[0].text : ''
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) {
    console.error('[positioning] extraction: no JSON in response')
    return
  }
  let result: unknown
  try {
    result = JSON.parse(m[0])
  } catch (e) {
    console.error('[positioning] extraction: JSON parse failed:', e)
    return
  }
  await admin.from('profiles').update({ positioning_deepdive: { ...state, result } }).eq('id', userId)
}
