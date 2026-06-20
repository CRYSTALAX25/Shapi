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
import { getAnthropic } from '@/lib/anthropic'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Axis = 'Head' | 'Hands' | 'Spark' | 'Heart'

// What each axis means + what a STRONG proof for it looks like. Shared by the
// interviewer (to probe) and the extractor (to classify + score).
// Each axis is written to fit BOTH white- AND blue-collar work. The texture of
// the proof differs by trade (a chef's number is covers served; an exec's is
// $ saved) but every axis is equally real for a carer, an electrician, a driver
// and a director. The interviewer/extractor must honour both.
export const AXIS_GUIDE: Record<Axis, { meaning: string; strongProof: string; probe: string }> = {
  Head: {
    meaning: 'Judgement and problem-solving. Office: strategy, turnarounds, decisions that saved or made money, untangling complexity. On the tools / on shift: diagnosing the fault no one else could, fixing the job that was going wrong, the call made under pressure that saved the day.',
    strongProof: 'A hard problem only they could solve, with the stakes named — money saved, a disaster averted, or the job rescued.',
    probe: 'What is the trickiest problem you have ever cracked — the fault, the mess or the situation that others were stuck on, and you sorted it?',
  },
  Hands: {
    meaning: 'Skill and delivery — getting the work DONE, to a high standard. For trades/service work this is often the HERO axis: the craft itself, the output, the hardest job done well, the most ever produced/served/built, the safety record. For office work: running large or complex operations, logistics, delivery at scale.',
    strongProof: 'Their best hands-on work or the biggest thing they ran — output, scale, quality or safety named (covers served, units made, sites run, years with no accidents, budget).',
    probe: 'What is the best or biggest job you have ever done with your own hands — or the biggest thing you have run? How much, how many, how big?',
  },
  Spark: {
    meaning: 'Making something new or better. Office: founding companies, launching products or programmes. On the ground: setting up their own round or business, inventing a faster or safer way to do the job, a signature dish or technique, building something from scratch.',
    strongProof: 'Something they created, or a better way they found, with the result named.',
    probe: 'What have you made or set up from scratch — a business of your own, or a smarter, faster, safer way of doing the work that became how it is done?',
  },
  Heart: {
    meaning: 'People — training, looking after, leading, going above and beyond. Office: teams built, careers changed. On the ground: an apprentice trained up, a customer/patient/regular they went the extra mile for, keeping a crew together, looking after the new starters — including good they did that was never a "job".',
    strongProof: 'People they developed or served, with the number/impact named (apprentices trained, customers kept, a team led, lives changed).',
    probe: 'Who have you trained, looked after or gone the extra mile for? Include the things you are proud of even if they were never part of a job.',
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

SPEAK THEIR LANGUAGE (this works for EVERY kind of worker)
- Read their work and match their world. To a director: strategy, budgets, turnarounds. To a chef, electrician, carer, driver, cleaner, hairdresser: plain words — "the trickiest job you nailed", "the most you've ever done in a shift", "someone you trained up", "a customer you went the extra mile for".
- NEVER use office jargon (governance, P&L, stakeholders, restructuring) with a trades or service worker. It makes people feel small. A blue-collar career is every bit as worthy of proof as a boardroom one — treat it that way.
- For hands-on workers, HANDS is usually their strongest axis. Let it shine; don't force an equal "strategy" answer if their genius is the craft.

WHAT COUNTS AS A NUMBER (money is just one kind)
- Equally strong, depending on the trade: covers/meals served, units made or fixed, jobs completed, speed, square metres, customers or regulars kept, ratings/reviews, repeat business, years of service, a SAFETY RECORD ("10 years, zero accidents"), apprentices trained, a hygiene/inspection score. Push for whichever number fits THEIR work — not £ by default.

VERIFIERS (who could confirm it)
- A name, a company, a foreman, a head chef, a site manager, a long-standing customer, a previous employer — or a certificate/card/licence (NVQ, City & Guilds, CSCS, a trade licence). Ask for whichever fits. Without one it stays honestly self-reported.

NON-NEGOTIABLE RULES
- ACHIEVEMENTS, never duties. "What did you DO and what changed?" — not "what were you responsible for?"
- Every story needs a NUMBER (any of the kinds above). If they don't give one, ask once, gently and specifically. Don't badger.
- Every story needs a VERIFIER (any of the kinds above). This is what lets us verify it later.
- NEVER invent, inflate, lead, or put numbers/words in their mouth. If they're unsure, that's fine — capture it honestly.
- ONE question per message. Short. Warm. Plain language. VOICE NOTES IN ANY LANGUAGE are welcome — say so early and warmly; many people (especially hands-on workers, or anyone easier in another language) speak far better than they type.
- Skip axes the CV already proves richly; spend the time on gaps and on the off-CV stories.
- Acknowledge what they say before the next question — a conversation with someone who's impressed, not a form.

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
    `I've read your background — now I want the *real proof* of what you're great at, including the things that never make it onto a CV. Honestly, those are often the best bit: the toughest job you nailed, the thing you built, or someone you helped that you're proud of.\n\n` +
    `So let's start there: *what are you most proud of — in your work or even outside it — that isn't written down anywhere?*\n\n` +
    `Tell me however's easiest — a voice note, in any language, works great.`
  )
}

// The EXTRACTION prompt — turns the full transcript (+ CV) into structured,
// axis-tagged proofs for the selection engine. Pulls from BOTH the conversation
// and the CV, dedupes, and is strict about numbers + verifiers.
export function buildExtractionPrompt(
  p: Parameters<typeof profileSummary>[0],
  transcript: string,
  verifiedClaims: string[] = [],
): string {
  const verifiedBlock = verifiedClaims.length
    ? `These claims have been INDEPENDENTLY CONFIRMED by the candidate's reference cross-check (you may mark a matching proof "verified"):\n- ${verifiedClaims.join('\n- ')}`
    : `No independent reference confirmation is available yet — so NO proof may be marked "verified". Use "assessed" or "self".`

  return `You are extracting a candidate's strongest achievements into structured proofs for their Verified Positioning CV. Use BOTH their CV and the deep-dive interview transcript (which may be empty — then work from the CV alone). The interview often contains their best, off-CV stories — weight those highly.

THEIR CV:
${profileSummary(p)}

THE DEEP-DIVE TRANSCRIPT (may be empty):
${transcript || '(no interview yet — extract from the CV alone)'}

INDEPENDENT VERIFICATION STATUS:
${verifiedBlock}

THE FOUR AXES (classify each proof to exactly one):
- Head — ${AXIS_GUIDE.Head.meaning}  Strong proof: ${AXIS_GUIDE.Head.strongProof}
- Hands — ${AXIS_GUIDE.Hands.meaning}  Strong proof: ${AXIS_GUIDE.Hands.strongProof}
- Spark — ${AXIS_GUIDE.Spark.meaning}  Strong proof: ${AXIS_GUIDE.Spark.strongProof}
- Heart — ${AXIS_GUIDE.Heart.meaning}  Strong proof: ${AXIS_GUIDE.Heart.strongProof}

RULES
- Select the SINGLE STRONGEST proof per axis. Magnitude wins — but magnitude is NOT only money. Depending on the trade it can be covers served, units made/fixed, customers kept, years of service, a safety record, apprentices trained, a rating/inspection score, or $/£/people/scale. Founding / 0→X / turnarounds / "the hardest job, done right" rank highest; recency does NOT.
- A proof MUST have a concrete number (of any of those kinds). If a story has no number, lower its confidence; never invent one.
- 'verifier' = the specific person, company, or body that could confirm it (from what they said). null if none was given.
- 'source' = 'deepdive' if it came (mainly) from the interview, else 'cv'.
- 'confidence' = high (concrete + quantified + verifiable), medium (quantified but soft verifier), low (no hard number).
- 'verification' = "verified" ONLY if the proof clearly matches one of the independently-confirmed claims listed above; "assessed" if it came from the CV or interview with a credible verifier named but is NOT yet independently confirmed; "self" if it's their word alone with no verifier. NEVER mark "verified" without a confirmed match — this is a promise to employers.
- Prefer DIFFERENT experiences across the four proofs to show career breadth — but if one experience is genuinely the strongest on two axes and nothing else is close, it may anchor both (say so via context).
- Do NOT inflate, merge unrelated facts, or put words in their mouth.

Return ONLY valid JSON:
{
  "headline": "a bold first-person positioning statement in THEIR voice (plain and proud for a tradesperson — e.g. 'I run a kitchen that ⟦never sends a bad plate⟧'; sharper for an exec). Their throughline across the WHOLE career, not the latest job, with the single most memorable phrase wrapped in ⟦…⟧. Honest — no inflation, no corporate jargon forced onto a hands-on worker.",
  "roleLabel": "a short positioning label (e.g. 'Founder · Operations & Commercial Leader') — breadth over latest title",
  "narrative": "2 sentences carrying the range + the human story",
  "proofs": [
    { "axis": "Head|Hands|Spark|Heart", "number": "...", "outcome": "...", "context": "company · role", "verifier": "name/company/body or null", "source": "cv|deepdive", "confidence": "high|medium|low", "verification": "verified|assessed|self" }
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

  const anthropic = getAnthropic()
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
    .select('full_name, headline, summary, work_history, skills, verification_report, positioning_deepdive')
    .eq('id', userId)
    .single()
  if (!profile) return
  const state = (profile.positioning_deepdive as DeepDiveState) || {}
  const chat: Turn[] = Array.isArray(state.chat) ? state.chat : []
  const transcript = chat
    .map(t => `${t.role === 'assistant' ? 'INTERVIEWER' : 'CANDIDATE'}: ${t.content}`)
    .join('\n\n')

  // Claims the reference cross-check has independently confirmed — only these
  // may earn a proof the ✓ Verified badge.
  const report = profile.verification_report as { claims_verified?: string[] } | null
  const verifiedClaims = Array.isArray(report?.claims_verified) ? report!.claims_verified! : []

  const anthropic = getAnthropic()
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1600,
    messages: [{ role: 'user', content: buildExtractionPrompt(profile, transcript, verifiedClaims) }],
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
