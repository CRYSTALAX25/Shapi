import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp, sendReferenceOutreach } from '@/lib/whatsapp'
import { sendProfileLiveEmail, sendCompanyMatchEmail, sendNominatedReferenceEmail, sendReferencesVerifiedEmail } from '@/lib/email'
import { runReferenceTurn, parseManagerResponses, parseNomineeResponses } from '@/lib/reference-qa'
import { recomputeProfileLive, resolveOutreachContact, updateVerificationTier, runVerificationCrossCheck } from '@/lib/references'
import { extractProfileFromChat, saveExtractedProfile } from '@/lib/chat-to-profile'
import { interpretAndApplyEdit } from '@/lib/cv-edits'
import { INDUSTRY_BRIEFS, type Industry } from '@/lib/industry-briefs'
import { saveVoiceSample, pickNextLanguageToCapture, type VoiceSamplesMap } from '@/lib/voice-samples'
import { buildJDPrompt, extractRoleFromChat, saveDraftRole } from '@/lib/jd-extract'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

// ── Industry detection ───────────────────────────────────────────────────────
function detectIndustry(headline: string, workHistory: Array<{ title?: string; company?: string }>): string {
  const text = [
    headline,
    ...workHistory.map(w => `${w.title || ''} ${w.company || ''}`),
  ].join(' ').toLowerCase()

  if (/financ|bank|invest|trading|accounting|audit|cfo|treasury/.test(text)) return 'finance'
  if (/engineer|developer|software|tech|data|ai|ml|cloud|devops|it |product manager/.test(text)) return 'tech'
  if (/design|creative|art direct|brand|ux|ui|motion|illustrat|visual/.test(text)) return 'creative'
  if (/doctor|nurse|medical|clinical|health|pharma|hospital|surgeon/.test(text)) return 'healthcare'
  if (/legal|lawyer|counsel|solicitor|barrister|compliance|regulatory/.test(text)) return 'legal'
  if (/market|growth|content|social media|seo|campaign|pr |communications/.test(text)) return 'marketing'
  if (/operat|supply chain|logistics|warehouse|driver|construct|site manager|foreman|trades|electrician|plumb/.test(text)) return 'operations'
  if (/hospitality|hotel|restaurant|chef|front desk|tourism|travel/.test(text)) return 'hospitality'
  if (/teach|educat|school|university|professor|lecturer|tutor|curriculum/.test(text)) return 'education'
  if (/retail|sales|account manager|business develop|client|customer success/.test(text)) return 'sales'
  return 'general'
}

// ── Industry-specific CV writing instructions ────────────────────────────────
function getIndustryWritingGuide(industry: string): string {
  const guides: Record<string, string> = {
    finance: `CV STYLE — FINANCE:
- Lead every achievement with a number: revenue, AUM, cost savings, % return, headcount
- Use formal language. No casual phrasing.
- Certifications (CFA, ACCA, CPA) go immediately after name
- Focus on risk management, compliance, and fiduciary outcomes
- ATS keywords: P&L, reconciliation, due diligence, financial modelling, stakeholder reporting`,

    tech: `CV STYLE — TECHNOLOGY:
- Stack and tools matter: name specific languages, frameworks, platforms in context (not just as a list)
- Quantify scale: users, requests/second, uptime %, data volume, deployment frequency
- Show ownership: "built from scratch", "led migration", "reduced latency by X"
- GitHub, portfolio, or product links if mentioned
- ATS keywords: agile, CI/CD, cloud-native, full-stack, APIs, scalability`,

    creative: `CV STYLE — CREATIVE:
- Shorter bullets, more evocative language — show personality in the writing itself
- Name the brands, campaigns, or projects — specificity builds credibility
- Awards, publications, press mentions go in a separate section
- Metrics matter here too: campaign reach, engagement %, brand uplift
- Note portfolio link prominently — it matters more than the CV itself`,

    healthcare: `CV STYLE — HEALTHCARE:
- Licenses and certifications at the very top, with registration numbers if applicable
- Clinical hours, patient volumes, specialisations named precisely
- Formal and factual tone — no ambiguity
- Research, publications, or CPD listed separately
- Compliance and patient safety outcomes highlighted`,

    legal: `CV STYLE — LEGAL:
- Bar admission / jurisdiction at top
- Practice areas stated clearly, then deal/case experience
- Name significant transactions or cases (where confidentiality allows)
- Academic credentials weighted heavily — university and grades matter
- Formal, precise language — no contractions`,

    marketing: `CV STYLE — MARKETING:
- Every campaign gets a metric: reach, conversion rate, CAC, ROAS, revenue attributed
- Name the channels owned: paid social, SEO, email, influencer, OOH
- Brand names and company scale give context
- Creative and analytical balance — show both sides
- Awards or press features in a separate section`,

    operations: `CV STYLE — OPERATIONS / TRADES:
- Certifications, licences, and safety records front and centre
- Equipment, systems, and software named specifically
- Volume and scale: units managed, km covered, team size, sites operated
- On-time delivery rates, incident-free records, cost reduction
- No-nonsense tone — direct and factual`,

    hospitality: `CV STYLE — HOSPITALITY:
- Property name and star rating give immediate context
- Revenue metrics: RevPAR, covers per service, occupancy %
- Guest satisfaction scores (TripAdvisor, internal NPS)
- Languages spoken listed clearly — hugely valued in this sector
- Promotions and tenure show loyalty and growth`,

    education: `CV STYLE — EDUCATION:
- Qualifications and subject specialisms at top
- Student outcomes: grades improvement, pass rates, cohort size
- Curriculum development and programme innovation
- Research, publications, or conferences listed separately
- Safeguarding and DBS status noted`,

    sales: `CV STYLE — SALES:
- Quota attainment % every single role — this is the first thing hiring managers look for
- Revenue generated, deal size, sales cycle length
- Named key accounts or sectors where confidentiality allows
- Methodology: MEDDIC, Challenger, SPIN etc if used
- Progression from SDR → AE → Senior shows growth`,

    general: `CV STYLE — GENERAL:
- Lead with impact: what changed because of you?
- Quantify wherever possible: team size, budget, timelines, outcomes
- Career progression should read as a clear upward story
- Skills evidenced in context, not just listed
- Clean, professional language — confident but not boastful`,
  }

  return guides[industry] || guides.general
}

// ── Language picker validation ───────────────────────────────────────────────
// Only accept: numeric choice (1-4), explicit language name from a known list,
// or "both" / "other". Reject conversational filler like "yes/ok/go ahead".
const KNOWN_LANGUAGES = [
  'english', 'arabic', 'french', 'spanish', 'german', 'italian', 'portuguese',
  'russian', 'chinese', 'mandarin', 'japanese', 'korean', 'hindi', 'urdu',
  'turkish', 'dutch', 'polish', 'greek', 'hebrew', 'persian', 'farsi', 'pashto',
  'thai', 'vietnamese', 'indonesian', 'malay', 'filipino', 'tagalog',
  'swahili', 'amharic', 'yoruba', 'zulu', 'afrikaans', 'romanian', 'czech',
  'hungarian', 'finnish', 'swedish', 'norwegian', 'danish', 'ukrainian',
  'bulgarian', 'croatian', 'serbian', 'slovak', 'slovenian', 'bengali', 'punjabi',
  'tamil', 'telugu', 'marathi', 'gujarati', 'malayalam', 'kannada', 'sinhala',
  'nepali', 'burmese', 'khmer', 'lao', 'mongolian', 'kazakh', 'uzbek',
  'georgian', 'armenian', 'azerbaijani', 'kurdish', 'somali', 'hausa', 'igbo',
  'catalan', 'basque', 'galician', 'welsh', 'irish', 'scottish gaelic', 'icelandic',
]

// Reject saved language preferences that aren't actual languages
// (catches garbage like "Sure go ahead" that pre-validation code accepted)
function isValidLangPref(value: string | null | undefined): boolean {
  if (!value) return false
  const v = value.toLowerCase().trim()
  if (v === 'english') return true
  if (v.startsWith('both')) return true
  const cleaned = v.replace(/[^a-z\s]/g, '').trim()
  if (cleaned.length < 2 || cleaned.length > 30) return false
  return KNOWN_LANGUAGES.some(lang => cleaned === lang || cleaned.split(' ').includes(lang))
}

// Find ALL known languages mentioned in a free-text reply.
// "english croatian and italian please" → ['english', 'croatian', 'italian']
function extractLanguagesFromReply(reply: string): string[] {
  const lower = reply.toLowerCase()
  const tokens = lower.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(t => t.length >= 2)
  const found: string[] = []
  for (const lang of KNOWN_LANGUAGES) {
    if (tokens.includes(lang) && !found.includes(lang)) found.push(lang)
  }
  return found
}

function formatLanguageList(langs: string[]): string {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (langs.length === 1) return cap(langs[0])
  return langs.map(cap).join(' + ')
}

function parseLanguageReply(
  reply: string,
  offeredLangs: string[],         // languages we listed in the picker (in order, lowercase)
  mode: 'choice' | 'custom',
): { preference?: string; askCustom?: boolean; clarify?: boolean } {
  const r = reply.trim()
  const lower = r.toLowerCase()

  if (mode === 'custom') {
    // Whatever they typed IS the language(s) — multi-language ok
    const matches = extractLanguagesFromReply(r)
    if (matches.length > 0) return { preference: formatLanguageList(matches) }
    const cleaned = lower.replace(/[^a-z\s]/g, '').trim()
    if (cleaned.length >= 2 && cleaned.length <= 30 && /^[a-z]+( [a-z]+)?$/.test(cleaned)) {
      return { preference: r.charAt(0).toUpperCase() + r.slice(1) }
    }
    return { clarify: true }
  }

  // Mode: choice — numeric pick from the offered list, OR free-text language names
  const num = parseInt(r, 10)
  if (!Number.isNaN(num)) {
    if (num >= 1 && num <= offeredLangs.length) {
      return { preference: formatLanguageList([offeredLangs[num - 1]]) }
    }
    if (num === offeredLangs.length + 1) {
      return { askCustom: true }
    }
  }

  if (lower === 'other' || lower.includes('different language')) {
    return { askCustom: true }
  }
  // "Both" / "all" / "every" → all offered languages
  if (lower === 'both' || lower.startsWith('both ') || lower === 'all' || lower.startsWith('all of') || lower === 'every' || lower === 'everything') {
    return { preference: formatLanguageList(offeredLangs) }
  }

  // Free-text — match against KNOWN_LANGUAGES (supports multi-language replies)
  const matches = extractLanguagesFromReply(r)
  if (matches.length >= 1) return { preference: formatLanguageList(matches) }

  return { clarify: true }
}

// Build the picker dynamically from ALL languages on their CV — English first,
// then native, then any other languages they speak. So a Croatian who also
// speaks Italian + French sees ALL of them as options.
function getOfferedLanguagesForPicker(
  profile: { native_language?: string | null; languages_spoken?: unknown } | null,
): string[] {
  const offered: string[] = ['english']
  const native = (profile?.native_language as string | null)?.toLowerCase().trim()
  if (native && KNOWN_LANGUAGES.includes(native) && native !== 'english') offered.push(native)
  const spoken = Array.isArray(profile?.languages_spoken)
    ? (profile.languages_spoken as Array<{ language?: string }>)
    : []
  for (const l of spoken) {
    const lang = l.language?.toLowerCase().trim()
    if (lang && KNOWN_LANGUAGES.includes(lang) && !offered.includes(lang)) offered.push(lang)
  }
  return offered
}

const NUM_EMOJI = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣']

const buildLangPrompt = (offeredLangs: string[]): string => {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const lines: string[] = [
    'One last thing before we build your CV 🎨',
    '',
    'Which language(s) do you want it in? Reply with the number — or type the languages.',
    '',
  ]
  offeredLangs.forEach((l, i) => {
    lines.push(`${NUM_EMOJI[i] || (i + 1) + '.'} ${cap(l)}`)
  })
  const otherIdx = offeredLangs.length
  lines.push(`${NUM_EMOJI[otherIdx] || (otherIdx + 1) + '.'} Other — type the language you need`)
  if (offeredLangs.length >= 2) {
    lines.push('', `Or say "all" to get all ${offeredLangs.length} of your languages.`)
  }
  return lines.join('\n')
}

export async function POST(request: Request) {
  // Wrap the whole handler in a try/catch so we can never silently fail —
  // if anything below throws, we at least log + send the sender a "the bot
  // crashed" message so the user knows it ran (rather than wondering whether
  // their text vanished into the void).
  let _phone: string | null = null
  try {
    return await handleWebhookRequest(request, (p: string) => { _phone = p })
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error('[webhook] top-level crash:', msg, err instanceof Error ? err.stack : '')
    if (_phone) {
      try {
        await sendWhatsApp(_phone, `🤖 Hit an error processing that message: ${msg.slice(0, 200)}\n\nThe team has been notified. Try once more in a minute, or text "references" to see your queue.`)
      } catch { /* swallow nested send failures */ }
    }
    // Always return 200 so Twilio doesn't keep retrying and stacking on the user
    return new NextResponse('', { status: 200 })
  }
}

async function handleWebhookRequest(request: Request, registerPhone: (p: string) => void): Promise<NextResponse> {
  const formData = await request.formData()
  const from = formData.get('From') as string
  const body = formData.get('Body') as string
  const numMedia = parseInt((formData.get('NumMedia') as string) || '0')
  const mediaType = (formData.get('MediaContentType0') as string) || ''

  // Normalise: strip whatsapp: prefix and ALL spaces
  const phone = from?.replace('whatsapp:', '').replace(/\s+/g, '').trim()
  if (!phone) return new NextResponse('', { status: 200 })
  registerPhone(phone)

  console.log('[webhook] Message from:', phone, '| body:', body?.slice(0, 80), '| media:', numMedia, mediaType)

  const admin = createAdminClient()

  // Look up candidate profile FIRST — needed for precedence decisions below.
  //
  // CRITICAL: when multiple profiles share the same phone (Gmail +addressing
  // test accounts, etc.), the NEWEST signup ALWAYS wins. Simple, predictable,
  // no state-dependent flip-flops. The previous "prefer active interview"
  // ordering caused +test2 messages to land on the main account whenever main
  // had conversation_active flipped one way or another — chaos.
  // Profile lookup — duplicate phone numbers are a real problem (signup flow
  // bug lets the same phone exist on multiple accounts). The naive
  // "newest profile wins" picks the orphan when a stale signup is more recent
  // than the candidate's actual main account. So: prefer the profile that
  // has (a) candidate_references attached, then (b) cv_parsed=true, falling
  // back to most-recently-created.
  const { data: profileCandidates } = await admin
    .from('profiles')
    .select('id, full_name, headline, skills, work_history, whatsapp_chat, completion_pct, cv_parsed, native_language, awaiting_cv_language, cv_language_preference, languages_spoken, cv_tier, industry_chats, whatsapp_conversation_active, created_at, voice_samples, awaiting_voice_sample_lang, type, company_name, jd_chat')
    .eq('whatsapp_number', phone)
    .order('created_at', { ascending: false })

  let profile = profileCandidates?.[0] ?? null
  if (profileCandidates && profileCandidates.length > 1) {
    // Multiple profiles share this phone — pick the one with the most signal
    const candidateIds = profileCandidates.map(p => p.id)
    const { data: refCounts } = await admin
      .from('candidate_references')
      .select('candidate_id')
      .in('candidate_id', candidateIds)
    const refHits: Record<string, number> = {}
    for (const r of refCounts || []) {
      refHits[r.candidate_id as string] = (refHits[r.candidate_id as string] || 0) + 1
    }
    // Sort: most refs first, then cv_parsed, then most-recent
    const scored = [...profileCandidates].sort((a, b) => {
      const aRefs = refHits[a.id as string] || 0
      const bRefs = refHits[b.id as string] || 0
      if (aRefs !== bRefs) return bRefs - aRefs
      const aParsed = a.cv_parsed ? 1 : 0
      const bParsed = b.cv_parsed ? 1 : 0
      if (aParsed !== bParsed) return bParsed - aParsed
      return new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
    })
    profile = scored[0]
    console.log('[webhook] Multiple profiles for phone — picked', profile?.id, '(refs:', refHits[profile?.id as string] || 0, 'cv_parsed:', profile?.cv_parsed, ')')
  }

  // ═══ PRIORITY 0: Reference reply routing ═══════════════════════════════
  // Two distinct rules:
  //
  // RULE A — TEST-MODE SELF REFS (candidate's own phone = referee phone):
  //   When the candidate uses test mode to send themselves a reference
  //   request, the same phone gets BOTH the candidate interview prompt AND
  //   the reference prompt. The candidate is acting as both sides. We give
  //   the ref the right of way as long as the ref is theirs AND it hasn't
  //   completed yet — regardless of whatsapp_conversation_active or whether
  //   outreach succeeded (status='pending' counts).
  //
  // RULE B — REAL REFS (someone else's phone):
  //   The candidate flow wins UNLESS the candidate has EXPLICITLY finished
  //   their own interview (whatsapp_conversation_active === false). null /
  //   undefined / true all mean "candidate flow is the right path" — this
  //   covers fresh signups whose conversation_active hasn't been flipped.
  //   For real refs we require status='contacted' or 'opened' — pending
  //   means outreach hasn't gone out, so any reply would be unsolicited.
  const interviewExplicitlyDone = profile?.whatsapp_conversation_active === false

  // First try: TEST-MODE SELF REFS — most permissive, always fires.
  //
  // CRITICAL: stickiness. When a user is mid-conversation with one referee,
  // every reply must land on THAT referee until it's completed. Priority:
  //   1) NAME PICKER — user texted a single first name matching a pending
  //      ref → route there and mark it opened (lets the user explicitly
  //      pick which of several pending refs to talk to next)
  //   2) status='opened' (already in conversation)
  //   3) ref we last spoke to (has any chat history)
  //   4) only one fresh pending/contacted ref → auto-start it
  //   5) multiple fresh refs → send picker, don't auto-route
  if (profile) {
    const { data: selfRefs } = await admin
      .from('candidate_references')
      .select('id, candidate_id, ref_type, job_slot, status, referee_name, candidate_company, candidate_job_title, candidate_dates, whatsapp_chat, is_test_outreach, nominator_name, response_channel, first_responded_at, token, updated_at')
      .eq('referee_phone', phone)
      .eq('candidate_id', profile.id)
      .eq('is_test_outreach', true)
      .in('status', ['pending', 'contacted', 'opened'])

    if (selfRefs && selfRefs.length > 0) {
      type RefRowLite = typeof selfRefs[number] & { whatsapp_chat?: Array<unknown> | null; updated_at?: string }

      // (1) NAME PICKER — single-word message that exactly matches a pending ref's first name
      const trimmed = (body || '').trim()
      const isSingleNameInput = /^[A-Za-zÀ-ſ]{2,30}$/.test(trimmed)
      if (isSingleNameInput) {
        const namedRef = (selfRefs as RefRowLite[]).find(r =>
          (r.referee_name as string)?.split(' ')[0].toLowerCase() === trimmed.toLowerCase()
        )
        if (namedRef) {
          await admin.from('candidate_references').update({ status: 'opened' }).eq('id', namedRef.id)
          await sendWhatsApp(phone, `🧪 Switching to *${(namedRef.referee_name as string).split(' ')[0]}*'s conversation. Send anything to start (or just say hi).`)
          console.log('[webhook] Name picker matched ref:', namedRef.id, 'name:', namedRef.referee_name)
          return new NextResponse('', { status: 200 })
        }
      }

      // "pause" command — stop the chain
      if (/^pause$/i.test(trimmed)) {
        await sendWhatsApp(phone, `🧪 Paused. Text *references* anytime to see what's pending, or text a name to resume.`)
        return new NextResponse('', { status: 200 })
      }

      // (2) ref currently in conversation
      const opened = selfRefs.find(r => r.status === 'opened')
      // (3) ref we last spoke to (has any chat history)
      const withChat = (selfRefs as RefRowLite[])
        .filter(r => Array.isArray(r.whatsapp_chat) && r.whatsapp_chat.length > 0)
        .sort((a, b) => (new Date(b.updated_at || 0).getTime()) - (new Date(a.updated_at || 0).getTime()))
      // Fresh refs (never opened a chat)
      const fresh = (selfRefs as RefRowLite[])
        .filter(r => !Array.isArray(r.whatsapp_chat) || r.whatsapp_chat.length === 0)
        .sort((a, b) => (new Date(a.updated_at || 0).getTime()) - (new Date(b.updated_at || 0).getTime()))

      // (2) and (3) — stick with active/in-progress
      const sticky = opened || withChat[0]
      if (sticky) {
        console.log('[webhook] Sticky route to test ref:', sticky.id, 'name:', sticky.referee_name, 'status:', sticky.status, 'chat:', Array.isArray(sticky.whatsapp_chat) ? sticky.whatsapp_chat.length : 0)
        return handleReferenceReply(sticky, body || '', formData, numMedia, mediaType, phone)
      }

      // (4) exactly one fresh — auto-start it
      if (fresh.length === 1) {
        console.log('[webhook] Auto-starting only fresh test ref:', fresh[0].id, 'name:', fresh[0].referee_name)
        return handleReferenceReply(fresh[0], body || '', formData, numMedia, mediaType, phone)
      }

      // (5) multiple fresh — show picker, DON'T auto-route
      if (fresh.length > 1) {
        const lines = fresh.map(r => `• *${(r.referee_name as string).split(' ')[0]}* — ${r.ref_type} at ${r.candidate_company}`).join('\n')
        await sendWhatsApp(phone, `🧪 You have ${fresh.length} pending refs to start:\n\n${lines}\n\n*Reply with a first name* to begin that conversation (e.g. "${(fresh[0].referee_name as string).split(' ')[0]}").`)
        return new NextResponse('', { status: 200 })
      }
    }
  }

  // Second try: REAL REFS — only after candidate's own interview is done
  if (interviewExplicitlyDone || !profile) {
    const { data: refRows } = await admin
      .from('candidate_references')
      .select('id, candidate_id, ref_type, job_slot, status, referee_name, candidate_company, candidate_job_title, candidate_dates, whatsapp_chat, is_test_outreach, nominator_name, response_channel, first_responded_at, token')
      .eq('referee_phone', phone)
      .in('status', ['contacted', 'opened'])
      .order('contacted_at', { ascending: true })
      .limit(1)

    if (refRows && refRows.length > 0) {
      const ref = refRows[0]
      const refBelongsToCurrentCandidate = profile && ref.candidate_id === profile.id
      const refIsTestModeFromAnyAccount = ref.is_test_outreach === true
      if (refBelongsToCurrentCandidate || (!profile && refIsTestModeFromAnyAccount)) {
        return handleReferenceReply(ref, body || '', formData, numMedia, mediaType, phone)
      } else if (!refBelongsToCurrentCandidate && profile) {
        console.log('[webhook] Skipping reference routing — ref belongs to another candidate:', ref.candidate_id, 'vs current:', profile.id)
      } else {
        return handleReferenceReply(ref, body || '', formData, numMedia, mediaType, phone)
      }
    }
  } else {
    console.log('[webhook] Candidate interview active/pending for', phone, '— skipping non-test reference routing (conversation_active:', profile?.whatsapp_conversation_active, ')')
  }
  // ═══════════════════════════════════════════════════════════════════════

  if (!profile) {
    console.log('[webhook] No profile or reference found for:', phone)
    return new NextResponse('', { status: 200 })
  }

  // ── Voice note transcription — always first, sets userMessage ───────────
  let userMessage = body?.trim() || ''

  if (numMedia > 0 && mediaType.startsWith('audio/')) {
    const mediaUrl = formData.get('MediaUrl0') as string
    console.log('[webhook] Voice note received, transcribing:', mediaUrl)

    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID!
      const authToken = process.env.TWILIO_AUTH_TOKEN!
      const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

      const audioRes = await fetch(mediaUrl, {
        headers: { Authorization: `Basic ${twilioAuth}` },
      })
      if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`)
      const audioBuffer = await audioRes.arrayBuffer()

      const deepgramRes = await fetch(
        'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&detect_language=true',
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': mediaType,
          },
          body: audioBuffer,
        }
      )

      if (!deepgramRes.ok) throw new Error(`Deepgram error: ${deepgramRes.status}`)
      const deepgramData = await deepgramRes.json()
      const transcript = deepgramData?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim()

      if (transcript) {
        console.log('[webhook] Transcribed:', transcript.slice(0, 100))
        userMessage = transcript

        // ── Voice sample capture ──────────────────────────────────────────
        // If we're explicitly waiting for a voice sample (the post-[DONE] flow
        // set awaiting_voice_sample_lang), this voice note IS the sample.
        // Save it + advance to the next language (or finish).
        const awaitingLang = profile.awaiting_voice_sample_lang as string | null
        if (awaitingLang) {
          const mediaSid = (formData.get('MediaSid0') as string) || ''
          const messageSid = (formData.get('MessageSid') as string) || (formData.get('SmsMessageSid') as string) || ''
          const durationGuess = Math.max(8, Math.min(60, Math.ceil(transcript.split(/\s+/).length / 2.5)))
          await saveVoiceSample(profile.id as string, awaitingLang, {
            media_sid: mediaSid,
            message_sid: messageSid,
            media_url: mediaUrl,
            content_type: mediaType,
            transcript,
            duration_s: durationGuess,
          })

          // Pick the next language that still needs a sample
          const samplesMap = ((profile.voice_samples as VoiceSamplesMap) || {})
          samplesMap[awaitingLang.toLowerCase()] = {
            media_sid: mediaSid, message_sid: messageSid, media_url: mediaUrl,
            transcript, duration_s: durationGuess, language: awaitingLang.toLowerCase(),
            recorded_at: new Date().toISOString(),
          }
          const next = pickNextLanguageToCapture(
            profile.languages_spoken as Array<{ language: string }> | null,
            samplesMap,
          )
          if (next) {
            await admin.from('profiles').update({ awaiting_voice_sample_lang: next }).eq('id', profile.id)
            await sendWhatsApp(phone, `Got it ✓ — your ${awaitingLang} sample is saved.\n\nOne more: send a short voice note in *${next}* (15–30s, anything natural — introduce yourself, talk about your work). This helps companies hear how you communicate.`)
          } else {
            await admin.from('profiles').update({ awaiting_voice_sample_lang: null }).eq('id', profile.id)
            await sendWhatsApp(phone, `Got it ✓ — voice sample${(profile.languages_spoken as Array<{ language: string }> | null || []).length > 1 ? 's' : ''} saved. Companies viewing your profile will hear how you sound — much more powerful than text.`)
          }
          return new NextResponse('', { status: 200 })
        }
      } else {
        await sendWhatsApp(phone, `I got your voice note 🎙️ but couldn't make it out clearly — could you try again or type it?`)
        return new NextResponse('', { status: 200 })
      }
    } catch (err) {
      console.error('[webhook] Transcription error:', err)
      await sendWhatsApp(phone, `I got your voice note 🎙️ but hit a snag — could you type your answer? Don't want to miss anything.`)
      return new NextResponse('', { status: 200 })
    }
  }

  if (!userMessage) return new NextResponse('', { status: 200 })

  // ═══ Manual "references" command — safety hatch if routing missed ═════
  // If the candidate types "references" / "refs" / "ref status" we list
  // their reference rows directly so they can see what state things are in.
  // Works even if status is 'pending' or whatsapp_conversation_active is true.
  const lowerMsg = userMessage.toLowerCase().trim()
  if (/^(references?|refs|ref status|my refs?)$/.test(lowerMsg)) {
    const { data: myRefs } = await admin
      .from('candidate_references')
      .select('referee_name, ref_type, job_slot, status, candidate_company, referee_phone, is_test_outreach, contacted_at')
      .eq('candidate_id', profile.id)
      .order('job_slot', { ascending: true })
      .order('ref_type', { ascending: true })

    if (!myRefs || myRefs.length === 0) {
      await sendWhatsApp(phone, `You don't have any reference requests yet. Add them at ${SITE}/profile/references and I'll start the chain.`)
      return new NextResponse('', { status: 200 })
    }

    const statusEmoji: Record<string, string> = {
      pending: '⏳', contacted: '📤', opened: '💬', completed: '✅', failed: '❌',
    }
    const lines = myRefs.map(r => {
      const emoji = statusEmoji[r.status as string] || '•'
      const test = r.is_test_outreach ? ' 🧪' : ''
      return `${emoji} ${r.referee_name} — ${r.ref_type}, job ${r.job_slot}${test}\n   status: *${r.status}* · at ${r.candidate_company}`
    }).join('\n\n')

    await sendWhatsApp(phone, `📋 *Your reference requests:*\n\n${lines}\n\n*Legend:* ⏳ pending (not yet sent) · 📤 contacted (awaiting reply) · 💬 opened (in conversation) · ✅ completed · 🧪 test mode\n\nIf a test-mode ref is stuck, just text me anything from this number — I'll route it to that ref.`)
    return new NextResponse('', { status: 200 })
  }

  // ═══ Manual "voice" command — start/continue voice-sample capture ════════
  // Lets the candidate record a voice sample per CV language on demand (the
  // automatic prompt only fires right after [DONE]). Sets the awaiting flag to
  // the next language without a sample, then each inbound voice note is captured
  // by the voice-sample handler above.
  if (/^(voice|voice samples?|record voice|voice notes?)$/.test(lowerMsg)) {
    const samples = (profile.voice_samples as VoiceSamplesMap) || {}
    const langs = profile.languages_spoken as Array<{ language: string }> | null
    if (!langs || langs.length === 0) {
      await sendWhatsApp(phone, `I don't see any languages on your profile yet. Add the languages you speak at ${SITE}/profile/edit, then text "voice" again.`)
      return new NextResponse('', { status: 200 })
    }
    const next = pickNextLanguageToCapture(langs, samples)
    if (!next) {
      const done = Object.keys(samples).join(', ')
      await admin.from('profiles').update({ awaiting_voice_sample_lang: langs[0].language }).eq('id', profile.id)
      await sendWhatsApp(phone, `You've already got voice samples for: ${done}. Want to redo one? Send a fresh voice note in *${langs[0].language}* and I'll replace it. (Or text "voice" then a note for any language.)`)
      return new NextResponse('', { status: 200 })
    }
    await admin.from('profiles').update({ awaiting_voice_sample_lang: next }).eq('id', profile.id)
    const remaining = langs.filter(l => !samples[l.language.toLowerCase()]).map(l => l.language)
    await sendWhatsApp(phone, `🎙️ Let's capture your voice samples (${remaining.length} to go: ${remaining.join(', ')}).\n\nSend me a 15–30 second voice note in *${next}* — introduce yourself or talk about your work. Companies viewing your profile will hear how you communicate in each language.`)
    return new NextResponse('', { status: 200 })
  }

  // ═══ PRIORITY 0.5: Company JD-via-WhatsApp intake ════════════════════════
  // If the matched profile is a company user, this conversation isn't a
  // candidate interview — it's a hiring manager describing a role they want
  // to fill. We run an analogous chat loop and on [JD_DONE] we extract a
  // structured role into a draft `roles` row.
  if (profile.type === 'company') {
    const jdChat = Array.isArray(profile.jd_chat)
      ? (profile.jd_chat as Array<{ role: 'user' | 'assistant'; content: string }>)
      : []
    const userTurns = jdChat.filter(m => m.role === 'user').length
    jdChat.push({ role: 'user', content: userMessage })

    try {
      const completion = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: buildJDPrompt(userTurns),
        messages: jdChat.map(m => ({ role: m.role, content: m.content })),
      })
      let aiReply = completion.content[0].type === 'text' ? completion.content[0].text : ''
      const isJdDone = aiReply.includes('[JD_DONE]')
      aiReply = aiReply.replace('[JD_DONE]', '').trim()
      jdChat.push({ role: 'assistant', content: aiReply })

      const updates: Record<string, unknown> = {
        jd_chat: jdChat,
        jd_conversation_active: !isJdDone,
        updated_at: new Date().toISOString(),
      }

      // On wrap-up: extract structured role + save as draft, hand off to dashboard
      if (isJdDone) {
        try {
          const extracted = await extractRoleFromChat(jdChat, (profile.company_name as string) || 'Company')
          if (extracted) {
            const roleId = await saveDraftRole(
              profile.id as string,
              extracted,
              (profile.jd_active_role_id as string) || undefined,
            )
            if (roleId) {
              updates.jd_active_role_id = roleId
              await admin.from('profiles').update(updates).eq('id', profile.id)
              await sendWhatsApp(phone, aiReply)
              await sendWhatsApp(phone, `📝 Your draft role is ready: ${SITE}/company/dashboard\n\nReview, tweak salary or skills, then hit *Publish*. Candidates start matching the moment you go live.`)
              return new NextResponse('', { status: 200 })
            }
          }
          // Extraction failed — keep chat, ask company to try again
          await admin.from('profiles').update({ ...updates, jd_conversation_active: true }).eq('id', profile.id)
          await sendWhatsApp(phone, aiReply || 'I caught most of that but want to be sure I got the details right — can you confirm the role title + must-have skills again?')
          return new NextResponse('', { status: 200 })
        } catch (err) {
          console.error('[webhook] JD extraction failed:', err)
        }
      }

      await admin.from('profiles').update(updates).eq('id', profile.id)
      await sendWhatsApp(phone, aiReply || `Tell me about the role you want to fill — title, key skills, location, what success looks like.`)
      return new NextResponse('', { status: 200 })
    } catch (err) {
      console.error('[webhook] JD intake claude failed:', err)
      await sendWhatsApp(phone, `Hmm, my brain glitched. Could you send that again?`)
      return new NextResponse('', { status: 200 })
    }
  }

  // ── State (single source of truth, computed once) ───────────────────────
  const isPro = profile.cv_tier === 'pro'
  type IndustryChatEntry = {
    status?: string
    answers?: string[]
    questions?: string
    sent_at?: string
    missing_areas?: string[]
    thin_roles?: string[]
    coverage_level?: string
    whatsapp_chat?: Array<{ role: 'user' | 'assistant'; content: string }>
    delivered?: boolean
  }
  const industryChats = (profile.industry_chats as Record<string, IndustryChatEntry> | null) || {}
  // New conversational deep-dive uses status='in_progress'; legacy batched
  // flow used status='questions_sent'. Treat both as active.
  const activeDeepDiveEntries = Object.entries(industryChats)
    .filter(([, v]) => v.status === 'in_progress' || v.status === 'questions_sent')
  const isInDeepDive = isPro && activeDeepDiveEntries.length > 0
  const awaitingLang = profile.awaiting_cv_language as 'choice' | 'custom' | null
  const hasLangPref = isValidLangPref(profile.cv_language_preference as string | null)
  const interviewDone = profile.whatsapp_conversation_active === false
  const detectedNative = (profile.native_language as string | null) || null
  const firstName = (profile.full_name as string || 'there').split(' ')[0]

  // ── Priority 1: Pro deep-dive — conversational per-industry interview ────
  // Each industry gets its own 5-8 turn Q&A driven by Claude. The webhook
  // generates the next question based on the industry brief + prior turns +
  // the residual gaps Claude identified at start. Wraps with [DEEP_DIVE_DONE]
  // when the candidate has covered enough.
  if (isInDeepDive) {
    // Pick the most recently started industry as the active one
    const [activeIndustry, activeEntry] = activeDeepDiveEntries[0]
    const chat: Array<{ role: 'user' | 'assistant'; content: string }> =
      Array.isArray(activeEntry.whatsapp_chat) ? [...activeEntry.whatsapp_chat] : []
    chat.push({ role: 'user', content: userMessage })

    // Build industry-scoped Claude prompt
    const workHistory = Array.isArray(profile.work_history)
      ? (profile.work_history as Array<{ title?: string; company?: string; start?: string; end?: string; achievements?: string }>)
      : []
    const userTurns = chat.filter(m => m.role === 'user').length
    const industryBrief = INDUSTRY_BRIEFS[activeIndustry as Industry] || `Focus on quantified impact, scope, named achievements for ${activeIndustry}.`

    const deepDivePrompt = `You're running a focused WhatsApp deep-dive interview for a CV writer, helping ${profile.full_name || 'this candidate'} surface the SPECIFIC details that will make their ${activeIndustry.toUpperCase()} CV exceptional.

═══ CANDIDATE CONTEXT ═══
Headline: ${profile.headline || 'not provided'}
Work history (full): ${JSON.stringify(workHistory)}

═══ WHAT AN EXCEPTIONAL CV IN ${activeIndustry.toUpperCase()} LOOKS LIKE ═══
${industryBrief}

═══ COVERAGE GAPS YOU IDENTIFIED AT START (priority to close) ═══
Thin roles needing detail: ${JSON.stringify(activeEntry.thin_roles || [])}
Missing brief areas: ${JSON.stringify(activeEntry.missing_areas || [])}

═══ YOUR JOB ═══
Read the conversation history. Ask the NEXT single question that closes the biggest remaining gap from above. Drill specifically into thin roles or missing brief areas — don't ask generic questions when there's a specific thin role or missing area to target.

RULES:
- One question per message, never stack
- Max 3 sentences per message
- Reference SPECIFICS from their CV when you can (role names, companies, dates) to show you're paying attention
- For thin roles in their history, ask about that specific role by name (e.g. "Tell me about your time at European Times 2011-2012 — what did sales coordination across Brussels and Mongolia actually involve?")
- Acknowledge their previous answer briefly before asking the next
- Use industry-appropriate vocabulary from the brief
- Sound like a sharp recruiter who actually knows ${activeIndustry}, not HR

LANGUAGE — detect what they wrote in and respond in the SAME language always.

WRAP-UP RULE — end your message with EXACTLY: [DEEP_DIVE_DONE]
- After 7 of their replies, OR
- When you've covered all thin_roles + missing_areas from above
- When ending, thank them warmly + tell them the ${activeIndustry} CV is being built

This is exchange ${userTurns + 1}. ${userTurns >= 8 ? 'WRAP UP NOW with [DEEP_DIVE_DONE].' : userTurns >= 6 ? 'You can wrap up with [DEEP_DIVE_DONE] if you have covered the major gaps, or ask one more if a critical gap remains.' : 'Keep digging — there are still gaps to close.'}`

    let aiReply = ''
    let isDeepDiveDone = false
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: deepDivePrompt,
        messages: chat,
      })
      aiReply = response.content[0].type === 'text' ? response.content[0].text : ''
      isDeepDiveDone = aiReply.includes('[DEEP_DIVE_DONE]')
      aiReply = aiReply.replace('[DEEP_DIVE_DONE]', '').trim()
    } catch (err) {
      console.error('[webhook] Deep-dive Claude error:', err)
      await sendWhatsApp(phone, "Thanks for sharing that — I'll pick this up with you shortly.")
      return new NextResponse('', { status: 200 })
    }

    chat.push({ role: 'assistant', content: aiReply })
    const newAnswers = [...(activeEntry.answers || []), userMessage]

    const updatedChats: Record<string, IndustryChatEntry> = {
      ...industryChats,
      [activeIndustry]: {
        ...activeEntry,
        answers: newAnswers,
        whatsapp_chat: chat,
        status: isDeepDiveDone ? 'completed' : 'in_progress',
        ...(isDeepDiveDone ? { completed_at: new Date().toISOString() } : {}),
      },
    }

    await admin.from('profiles').update({
      industry_chats: updatedChats,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id)

    await sendWhatsApp(phone, aiReply)

    console.log('[webhook] Deep-dive turn for', activeIndustry, '| user turn:', userTurns, '| done:', isDeepDiveDone)
    return new NextResponse('', { status: 200 })
  }

  // ── Priority 2: Language preference reply ────────────────────────────────
  if (awaitingLang === 'choice' || awaitingLang === 'custom') {
    const offeredLangs = getOfferedLanguagesForPicker(profile)
    const parsed = parseLanguageReply(userMessage, offeredLangs, awaitingLang)

    if (parsed.clarify) {
      // Don't accept ambiguous replies like "yes / ok / go ahead" as a language
      await sendWhatsApp(
        phone,
        awaitingLang === 'custom'
          ? `Sorry — I need the language name itself (e.g. "Italian" or "Tagalog"). Just type the language you want your CV in.`
          : `Hmm, didn't quite catch that. Reply with the *number* (1, 2, 3, or 4) — or type the language name directly (e.g. "English" or "Spanish").`,
      )
      return new NextResponse('', { status: 200 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    let responseMsg: string

    if (parsed.askCustom) {
      updates.awaiting_cv_language = 'custom'
      responseMsg = `No problem — just type the language you want your CV in and we'll handle it.`
    } else if (parsed.preference) {
      updates.cv_language_preference = parsed.preference
      updates.awaiting_cv_language = null
      responseMsg = `Got it — *${parsed.preference}* CV it is. Head to the app to generate and download it 🎉`
    } else {
      // Shouldn't reach here, but safe fallback
      await sendWhatsApp(phone, `Hmm, didn't quite catch that. Reply with 1, 2, 3, or 4.`)
      return new NextResponse('', { status: 200 })
    }

    await admin.from('profiles').update(updates).eq('id', profile.id)
    await sendWhatsApp(phone, responseMsg)
    console.log('[webhook] CV language captured:', parsed.preference || 'awaiting custom', '| phone:', phone)
    return new NextResponse('', { status: 200 })
  }

  // ── Priority 3: Interview already done — friendly ack, no Claude re-run ──
  // Once whatsapp_conversation_active=false, the main interview is over. Don't
  // re-run Claude (which would awkwardly re-send the wrap-up + language picker).
  if (interviewDone) {
    const mainChat = Array.isArray(profile.whatsapp_chat) ? profile.whatsapp_chat : []
    mainChat.push({ role: 'user', content: userMessage })

    // If language preference is missing or invalid (e.g. someone typed "yes" earlier
    // and it was saved as their "language"), re-ask the picker.
    if (!hasLangPref && !awaitingLang) {
      await admin.from('profiles').update({
        whatsapp_chat: mainChat,
        awaiting_cv_language: 'choice',
        cv_language_preference: null,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id)

      await sendWhatsApp(
        phone,
        `Hey ${firstName} 👋 Your profile is ready — one last thing before we finalise your CV:\n\n${buildLangPrompt(getOfferedLanguagesForPicker(profile))}`,
      )
      console.log('[webhook] Re-asking language picker for:', phone)
      return new NextResponse('', { status: 200 })
    }

    // Post-interview + has lang pref → run the conversational CV editor.
    // Claude reads the message, figures out edit / question / chat, applies
    // changes to the master profile if it's an edit, clears cv_cache so the
    // updated content flows into the next CV view.
    await admin.from('profiles').update({
      whatsapp_chat: mainChat,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id)

    try {
      const editResult = await interpretAndApplyEdit(profile.id as string, userMessage)
      await sendWhatsApp(phone, editResult.reply)
      console.log('[webhook] Post-interview edit/chat for', phone, '| intent:', editResult.intent, '| cv_cache cleared:', editResult.affected_cv_caches === 'all')
    } catch (err) {
      console.error('[webhook] CV edit interpreter failed:', err)
      await sendWhatsApp(
        phone,
        `Hey ${firstName} 👋 Got your message. If you want to change something on your CV, tell me exactly what (e.g. "change my headline to Director of Operations" or "add Spanish to my languages").`,
      )
    }
    return new NextResponse('', { status: 200 })
  }

  // ── Priority 3.5: "Start over" intent — clear chat, restart interview ────
  // Server-side detection (faster + more reliable than asking Claude to do it).
  // Matches natural variations: "start over", "restart", "begin again", "reset",
  // "from scratch", "let's start again", "let me restart".
  const startOverIntent = /^\s*(start over|restart|reset|begin again|let'?s\s+(start|begin)\s+again|let me (start|begin)( over| again)?|from (the )?start|from scratch|start again|begin from( the)? start)\b/i.test(userMessage)
  if (startOverIntent) {
    console.log('[webhook] Start-over intent from:', phone)
    // Wipe chat history + reset interview state so Claude treats this as a fresh start
    const firstName = (profile.full_name as string || 'there').split(' ')[0]
    const fresh: Array<{ role: 'user' | 'assistant'; content: string }> = []
    await admin.from('profiles').update({
      whatsapp_chat: fresh,
      whatsapp_conversation_active: true,
      awaiting_cv_language: null,  // also clear any pending language picker
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id)

    const restartMsg = `Got it ${firstName} 👋 Starting over — clean slate.\n\nLet's begin: what's the achievement from your work you're most proud of in the last 3 years? Something that made you think "I actually did that."\n\nText back or send a voice note — whatever's easier.`
    await sendWhatsApp(phone, restartMsg)
    return new NextResponse('', { status: 200 })
  }

  // ── Priority 4: Main Claude interview ────────────────────────────────────
  const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> =
    Array.isArray(profile.whatsapp_chat) ? profile.whatsapp_chat : []

  const userTurns = chatHistory.filter(m => m.role === 'user').length
  chatHistory.push({ role: 'user', content: userMessage })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const workHistory = Array.isArray(profile.work_history)
    ? (profile.work_history as Array<{ title?: string; company?: string; achievements?: string }>)
    : []

  const skillsList = Array.isArray(profile.skills)
    ? (profile.skills as string[]).join(', ')
    : ''

  const workSummary = workHistory
    .map(w => `${w.title || '—'} at ${w.company || '—'}${w.achievements ? ': ' + w.achievements.slice(0, 120) : ''}`)
    .join('\n')

  const industry = detectIndustry(profile.headline || '', workHistory)
  const industryGuide = getIndustryWritingGuide(industry)

  console.log('[webhook] Detected industry:', industry, '| cv_parsed:', profile.cv_parsed)

  // ── Two interview modes depending on whether a CV was uploaded ─────────────
  // WITH CV (cv_parsed=true): 6 quality signals interview, ~9 exchanges.
  // WITHOUT CV (cv_parsed=false): deeper, longer interview — first builds work
  // history role-by-role, THEN goes into the 6 signals. ~13-17 exchanges total.
  // At [DONE], if !cv_parsed, an extraction Claude call populates the profile.

  const SHARED_INTENT_HANDLING = `CANDIDATE INTENT HANDLING — recognise these from natural language (any phrasing):
- "skip" / "next" / "move on" / "pass" → acknowledge briefly + move on. Don't push them.
- "repeat that" / "what was the question" / "say it again" → re-ask your previous question, slightly rephrased
- "done" / "I'm finished" / "that's all" / "let's wrap up" → wrap up with [DONE] if you have enough context; otherwise say "a couple more quick questions" and continue
- "I don't know" / "I don't have a number" → reassure, ask for their best estimate or a story example instead. Don't insist on precision.
- Voice notes in any language work — the transcript is what you read`

  // Languages the candidate has on their CV — Claude uses this to know which languages are "expected"
  const languagesOnCV = Array.isArray(profile.languages_spoken)
    ? (profile.languages_spoken as Array<{ language?: string; level?: string }>)
        .map(l => l.language ? `${l.language}${l.level ? ` (${l.level})` : ''}` : null)
        .filter(Boolean)
        .join(', ')
    : ''

  const SHARED_WHATSAPP_RULES = `WHATSAPP RULES (non-negotiable):

LANGUAGE BEHAVIOUR — 3 rules:
1. KNOWN LANGUAGES FROM CV: ${languagesOnCV || '(none listed yet — accept what they write in)'}
2. If they write/voice-note in a language already on their CV → respond in that SAME language. They can switch between any CV languages mid-conversation — follow them every time.
3. If they switch to a language NOT on their CV → ONE quick confirmation: "I notice you're writing in [X]. I see [list CV languages] on your CV — should I add [X] to your spoken languages too?" Wait for their answer. If yes → add it mentally, continue in [X]. If no (typo / spell-check confused) → switch back to the previous language they were using.

OTHER RULES:
- Maximum 3 sentences per message. Short. Punchy. Human.
- Never use bullet points or numbered lists in your reply.
- Always acknowledge what they said before asking the next thing.
- One question per message — never stack two questions.
- Sound like a sharp, warm human — not HR, not a chatbot, not a form.
- If they give a vague answer (e.g. "I improved things"), gently push for the number or specific outcome before moving on.`

  const systemPrompt = profile.cv_parsed
    ? // ─────────────── WITH CV: 6-signal interview ───────────────
`You are Shapi — an expert career coach and headhunter building a world-class profile for ${profile.full_name || 'this candidate'} through WhatsApp.

WHAT WE KNOW FROM THEIR CV:
- Headline: ${profile.headline || 'not provided'}
- Industry detected: ${industry}
- Skills: ${skillsList || 'not listed'}
- Work history:
${workSummary || 'not available'}

YOUR MISSION:
Extract the 6 quality signals that separate CVs that get interview calls from CVs that get ignored. Read the conversation history and internally assess which are still missing.

THE 6 SIGNALS TO HUNT:
1. QUANTIFIED IMPACT — A real number, metric, or measurable outcome (%, $, volume, time saved, units, team size). "Improved operations" is not enough. "Cut handover time by 40% across 6 sites" is.
2. SCOPE OF RESPONSIBILITY — Scale they operated at: budget owned, team managed, revenue controlled, number of sites/clients/units. Gives hiring managers instant context.
3. A REAL CHALLENGE — Something that was genuinely hard and how they handled it. Not just wins. Shows character, resilience, problem-solving under pressure.
4. CAREER PROGRESSION LOGIC — Why did they move from role to role? The story of their growth, not just a list of jobs.
5. EVIDENCED SKILLS — Skills that appear as proof in their stories, not just listed on the CV. If they listed "leadership" — where did that actually show up?
6. HIDDEN GEM (always ask last) — "Is there anything on your CV that didn't come across properly — a role, a project, something you're proud of that got squeezed into one line?"

CONVERSATION FLOW:
- Exchanges 1–3: Warm opening — best achievement, working style, what they want next. These naturally surface signals 1–3.
- Exchanges 4+: Target whichever signals are still missing from the history. One at a time. Naturally.
- When 5 signals are covered: Ask the Hidden Gem question (signal 6).
- After signal 6 is answered, OR after 9 exchanges total: Wrap up warmly. Tell them their profile is being built. End your message with exactly: [DONE]

${industryGuide}

${SHARED_INTENT_HANDLING}

${SHARED_WHATSAPP_RULES}

This is exchange ${userTurns + 1}. ${userTurns >= 9 ? 'You have enough. Wrap up now with [DONE].' : 'Do NOT end yet unless all 6 signals are clearly covered.'}`
    : // ─────────────── WITHOUT CV: deep two-phase interview ───────────────
`You are Shapi — building this candidate's profile entirely through WhatsApp because they have NO CV uploaded. You must extract EVERYTHING a great CV would have through conversation: work history, education, skills, languages, achievements, certifications.

WHAT WE KNOW SO FAR:
- Name: ${profile.full_name || 'not yet provided — ask early'}
- Industry detected from chat: ${industry === 'general' ? 'not yet' : industry}

YOUR MISSION — TWO PHASES, much longer than the CV-backed interview:

═══ PHASE 1: WORK HISTORY (exchanges 1–9) ═══
Walk through their career role by role, current first, then back. For EACH role capture:
  • Job title + company name + location + dates (start → end / present)
  • What they were responsible for day-to-day (2-3 main responsibilities)
  • One concrete achievement from that role (with a number where possible)
  • Then ask: "Before [that role], what were you doing?"

Cover at least 2 past roles + their current/most-recent role = 3 roles minimum. 4 if they have a richer history.

ALSO cover during Phase 1:
  • Highest qualification / degree (institution + year)
  • Industry certifications (PMP, CFA, AWS, etc.)
  • Languages spoken + level

═══ PHASE 2: QUALITY SIGNALS (exchanges 10–16) ═══
Now go DEEPER on the 6 signals across the roles you've captured:
  1. QUANTIFIED IMPACT — numbers from any of their roles
  2. SCOPE — biggest team / budget / accounts they've owned
  3. CHALLENGE — hardest thing they handled
  4. PROGRESSION LOGIC — why they moved roles
  5. EVIDENCED SKILLS — skills shown through stories, not claims
  6. HIDDEN GEM — anything they haven't mentioned that's noteworthy

═══ WRAP-UP ═══
After Phase 2 is complete (or after 16 exchanges total), wrap up warmly with: "Brilliant — that's everything I needed. Building your profile now. Check your dashboard in a minute." End your message with exactly: [DONE]

${industryGuide}

${SHARED_INTENT_HANDLING}

${SHARED_WHATSAPP_RULES}

CURRENT PHASE: ${userTurns < 9 ? 'PHASE 1 (work history)' : 'PHASE 2 (quality signals)'}
This is exchange ${userTurns + 1}.
${userTurns >= 16
  ? 'You have enough. Wrap up now with [DONE].'
  : userTurns < 9
    ? 'Keep building work history — do NOT skip to signals yet unless you already have 3 roles + education + certs + languages.'
    : 'Move into Phase 2 signals. Reference specific roles they mentioned. Do NOT end until you have enough.'}`

  let aiReply = ''
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 350,
      system: systemPrompt,
      messages: chatHistory,
    })
    aiReply = response.content[0].type === 'text' ? response.content[0].text : ''
  } catch (err) {
    console.error('[webhook] Claude error:', err)
    await sendWhatsApp(phone, "Thanks for sharing that — I'll pick this up with you shortly.")
    return new NextResponse('', { status: 200 })
  }

  const isDone = aiReply.includes('[DONE]')
  const cleanReply = aiReply.replace('[DONE]', '').trim()

  chatHistory.push({ role: 'assistant', content: cleanReply })

  const updates: Record<string, unknown> = {
    whatsapp_chat: chatHistory,
    industry,
    updated_at: new Date().toISOString(),
  }

  if (isDone) {
    updates.completion_pct = Math.max((profile.completion_pct as number) || 0, 65)
    updates.whatsapp_conversation_active = false

    // ─── Chat-to-profile extraction ──────────────────────────────────────
    // When the candidate had no CV, the deeper Phase-1+2 interview just
    // captured everything a CV would have. Extract it into structured fields
    // (work_history, skills, education, languages, skill_quadrant, etc.) so
    // downstream features (cv/generate, matching, references picker) work
    // identically to the CV-uploaded path.
    if (!profile.cv_parsed) {
      try {
        console.log('[webhook] No-CV path complete — extracting profile from chat')
        const extracted = await extractProfileFromChat(chatHistory)
        if (extracted) {
          await saveExtractedProfile(profile.id as string, extracted)
          console.log('[webhook] Chat-to-profile extracted + saved for:', profile.id)
        } else {
          console.error('[webhook] Chat-to-profile returned null — leaving profile partial')
        }
      } catch (err) {
        console.error('[webhook] Chat-to-profile extraction failed:', err)
      }
    }

    // Language proficiency assessment from the conversation
    const userMessages = chatHistory.filter(m => m.role === 'user').map(m => m.content)
    if (userMessages.length >= 3) {
      try {
        const langAssess = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `Analyse the language quality of these WhatsApp messages written by a job candidate. Assess their proficiency in whichever language(s) they wrote in.

MESSAGES:
${userMessages.map((m, i) => `${i + 1}. "${m}"`).join('\n')}

Return ONLY valid JSON:
{
  "conversation_language": "the main language they wrote in e.g. English, Arabic, Italian, French",
  "conversation_language_code": "2-letter ISO code e.g. en, ar, it, fr",
  "cefr_level": "A1 | A2 | B1 | B2 | C1 | C2 — their proficiency in the conversation language",
  "ielts_equivalent": "e.g. 7.0-8.0 — IELTS band equivalent of the CEFR level",
  "english_level": "CEFR level specifically for English — A1/A2/B1/B2/C1/C2. If they wrote in English, same as cefr_level. If another language, estimate from any English words used or mark as 'unassessed'",
  "proficiency_notes": "1 sentence: what's strong and what's a gap e.g. 'Strong vocabulary and complex sentences, minor grammar errors — native-level fluency evident'"
}`,
          }],
        })

        const langText = langAssess.content[0].type === 'text' ? langAssess.content[0].text : ''
        const langMatch = langText.match(/\{[\s\S]*\}/)
        if (langMatch) {
          const langData = JSON.parse(langMatch[0])
          updates.language_proficiency = langData
          if (langData.english_level && langData.english_level !== 'unassessed') {
            updates.english_level = langData.english_level
          }
          if (langData.conversation_language_code !== 'en') {
            updates.whatsapp_language = langData.conversation_language
          }
        }
      } catch (err) {
        console.error('[webhook] Language assessment failed:', err)
      }
    }
  }

  await admin.from('profiles').update(updates).eq('id', profile.id)

  await sendWhatsApp(phone, cleanReply)

  // ── Language picker after [DONE] — only if not already set or asked ──────
  if (isDone && !hasLangPref && !awaitingLang) {
    await sendWhatsApp(phone, buildLangPrompt(getOfferedLanguagesForPicker(profile)))
    await admin.from('profiles').update({ awaiting_cv_language: 'choice' }).eq('id', profile.id)
  }

  // ── Voice sample collection after [DONE] — only first time, only if multilingual ──
  if (isDone) {
    const samples = (profile.voice_samples as VoiceSamplesMap) || {}
    const languagesSpoken = profile.languages_spoken as Array<{ language: string }> | null
    const nextLang = pickNextLanguageToCapture(languagesSpoken, samples)
    // Only prompt if at least one language is listed AND we haven't already
    // asked + there's something to capture
    if (nextLang && !profile.awaiting_voice_sample_lang) {
      await admin.from('profiles').update({ awaiting_voice_sample_lang: nextLang }).eq('id', profile.id)
      const multi = (languagesSpoken?.length ?? 0) > 1
      await sendWhatsApp(phone, `One more thing 🎙️ — send me a short voice note in *${nextLang}* (15–30 seconds, just introduce yourself or talk about your work).${multi ? `\n\nWe'll do one per language so companies viewing your profile can hear how you communicate in each.` : `\n\nCompanies viewing your profile will hear how you sound — much more authentic than text alone.`}`)
    }
  }

  // ── Post-completion emails (non-blocking) ────────────────────────────────
  if (isDone) {
    const { data: authUser } = await admin.auth.admin.getUserById(profile.id as string)
    const candidateEmail = authUser?.user?.email

    if (candidateEmail) {
      sendProfileLiveEmail(candidateEmail, profile.full_name as string || '', profile.id as string)
        .catch(err => console.error('[email] profile-live failed:', err))

      const { data: activeRoles } = await admin
        .from('roles')
        .select('id, title, company_id')
        .eq('status', 'active')

      if (activeRoles && activeRoles.length > 0) {
        const candidateSkillsLower = ((profile.skills as string[]) || []).map((s: string) => s.toLowerCase())
        const headlineLower = ((profile.headline as string) || '').toLowerCase()

        for (const role of activeRoles) {
          const roleText = role.title.toLowerCase()
          const skillHits = candidateSkillsLower.filter(s => roleText.includes(s)).length
          const headlineHit = roleText.split(/\s+/).some((w: string) => w.length > 3 && headlineLower.includes(w))
          const quickScore = Math.min(100, skillHits * 20 + (headlineHit ? 30 : 0) + 20)

          if (quickScore >= 40) {
            const { data: companyAuth } = await admin.auth.admin.getUserById(role.company_id)
            const companyEmail = companyAuth?.user?.email
            if (companyEmail) {
              sendCompanyMatchEmail(companyEmail, '', role.title, quickScore, 1)
                .catch(err => console.error('[email] company-match failed:', err))
            }
          }
        }
      }
    }
  }

  console.log('[webhook] Replied to:', phone, '| exchange:', userTurns + 1, '| industry:', industry, '| done:', isDone)
  return new NextResponse('', { status: 200 })
}

// ═══════════════════════════════════════════════════════════════════════════
// Reference reply handler — runs the Claude reference Q&A flow
// ═══════════════════════════════════════════════════════════════════════════

type RefRow = {
  id: string
  candidate_id: string
  ref_type: 'manager' | 'colleague' | 'stakeholder'
  job_slot: number
  status: string
  referee_name: string
  candidate_company: string | null
  candidate_job_title: string | null
  candidate_dates: string | null
  whatsapp_chat: Array<{ role: 'user' | 'assistant'; content: string }> | null
  is_test_outreach: boolean | null
  nominator_name: string | null
  response_channel: string | null
  first_responded_at: string | null
  token: string
}

async function handleReferenceReply(
  ref: RefRow,
  bodyText: string,
  formData: FormData,
  numMedia: number,
  mediaType: string,
  phone: string,
): Promise<NextResponse> {
  const admin = createAdminClient()

  // Voice note transcription (same as candidate flow) — graceful fallback
  let userMessage = bodyText.trim()
  if (numMedia > 0 && mediaType.startsWith('audio/')) {
    const mediaUrl = formData.get('MediaUrl0') as string
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID!
      const authToken = process.env.TWILIO_AUTH_TOKEN!
      const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
      const audioRes = await fetch(mediaUrl, { headers: { Authorization: `Basic ${twilioAuth}` } })
      if (!audioRes.ok) throw new Error(`fetch audio ${audioRes.status}`)
      const audioBuffer = await audioRes.arrayBuffer()
      const deepgramRes = await fetch(
        'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&detect_language=true',
        {
          method: 'POST',
          headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': mediaType },
          body: audioBuffer,
        }
      )
      if (!deepgramRes.ok) throw new Error(`deepgram ${deepgramRes.status}`)
      const dg = await deepgramRes.json()
      const transcript = dg?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim()
      if (transcript) userMessage = transcript
      else {
        await sendWhatsApp(phone, "I couldn't catch that voice note clearly — could you try again or type it?")
        return new NextResponse('', { status: 200 })
      }
    } catch (err) {
      console.error('[ref-webhook] voice transcription failed:', err)
      await sendWhatsApp(phone, "I got your voice note 🎙️ but hit a snag transcribing — could you type your answer instead?")
      return new NextResponse('', { status: 200 })
    }
  }

  if (!userMessage) return new NextResponse('', { status: 200 })

  console.log('[ref-webhook] Reference reply from', phone, '| ref:', ref.id, 'type:', ref.ref_type, 'job:', ref.job_slot)

  // Fetch the candidate's name for Claude context
  const { data: cProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', ref.candidate_id)
    .single()
  const candidateName = (cProfile?.full_name as string) || 'the candidate'

  // Build conversation history
  const history = Array.isArray(ref.whatsapp_chat) ? ref.whatsapp_chat : []
  history.push({ role: 'user', content: userMessage })

  // Run Claude
  let reply = ''
  let isDone = false
  try {
    const result = await runReferenceTurn({
      refType: ref.ref_type,
      history,
      refereeName: ref.referee_name,
      candidateName,
      candidateJobTitle: ref.candidate_job_title || '',
      candidateCompany: ref.candidate_company || '',
      candidateDates: ref.candidate_dates || '',
      nominatorName: ref.nominator_name,
      nominatorCompany: ref.candidate_company,
      isTest: !!ref.is_test_outreach,
    })
    reply = result.reply
    isDone = result.isDone
  } catch (err) {
    console.error('[ref-webhook] Claude error:', err)
    await sendWhatsApp(phone, "Thanks for sharing that — I'll pick this up with you shortly.")
    return new NextResponse('', { status: 200 })
  }

  history.push({ role: 'assistant', content: reply })

  // Stamp first-response metadata on the very first inbound message
  const firstReplyUpdates: Record<string, unknown> = {}
  if (!ref.first_responded_at) {
    firstReplyUpdates.response_channel = 'whatsapp'
    firstReplyUpdates.first_responded_at = new Date().toISOString()
  }
  if (ref.status === 'contacted') {
    firstReplyUpdates.status = 'opened'
  }

  await admin.from('candidate_references').update({
    whatsapp_chat: history,
    updated_at: new Date().toISOString(),
    ...firstReplyUpdates,
  }).eq('id', ref.id)

  await sendWhatsApp(phone, reply)

  // ── On [REF_DONE]: extract structured responses + cascade ───────────────
  if (isDone) {
    try {
      if (ref.ref_type === 'manager') {
        const parsed = await parseManagerResponses(history)

        await admin.from('candidate_references').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          // Store both source-language answers AND English translations in one jsonb.
          // The *_en fields equal source if conversation was already in English.
          responses: {
            language: parsed.language,
            language_code: parsed.language_code,
            quality: parsed.quality,
            quality_en: parsed.quality_en,
            achievement: parsed.achievement,
            achievement_en: parsed.achievement_en,
            skills: parsed.skills,
            skills_en: parsed.skills_en,
            would_rehire: parsed.would_rehire,
            would_rehire_en: parsed.would_rehire_en,
            anything_else: parsed.anything_else,
            anything_else_en: parsed.anything_else_en,
          },
          nominees: parsed.nominees,
        }).eq('id', ref.id)

        // Cascade — create + reach out to the colleague and stakeholder.
        //
        // TEST MODE behaviour: all outreach routes to the candidate's own
        // phone. Sending 2 separate "Hi Kelly" / "Hi Keith" messages floods
        // their inbox. Instead we just create the rows + bump status to
        // 'contacted' (so the webhook can route replies), then send ONE
        // consolidated summary after the loop telling them how to pick the
        // next conversation.
        const isTest = !!ref.is_test_outreach
        const candidateFirst = candidateName.split(' ')[0]
        const cascadedRefs: Array<{ name: string; role: 'colleague' | 'stakeholder' }> = []

        for (const nomineeKey of ['colleague', 'stakeholder'] as const) {
          const nom = parsed.nominees[nomineeKey]
          if (!nom?.name || (!nom.phone && !nom.email)) continue

          try {
            // Resolve outreach contact FIRST so the row stores the routing phone
            // (test mode = candidate's phone, so webhook can match replies)
            const outreach = await resolveOutreachContact(ref.candidate_id, nom.phone, nom.email, isTest)

            const { data: inserted } = await admin.from('candidate_references').insert({
              candidate_id: ref.candidate_id,
              ref_type: nomineeKey,
              job_slot: ref.job_slot,
              nominated_by: ref.id,
              nominator_name: ref.referee_name,
              referee_name: nom.name,
              referee_phone: outreach.phone || null,
              referee_email: outreach.email || null,
              referee_relationship: nomineeKey,
              candidate_job_title: ref.candidate_job_title,
              candidate_company: ref.candidate_company,
              candidate_dates: ref.candidate_dates,
              is_test_outreach: isTest,
              status: 'pending',
            }).select('id, token').single()

            if (!inserted) continue
            const row = inserted as { id: string; token: string }
            const refUrl = `${SITE}/reference/${row.token}`
            const testBanner = outreach.testMode ? '🧪 *TEST MODE*\n\n' : ''
            const channels: string[] = []

            // TEST MODE: skip individual WhatsApp outreach (would flood the candidate's phone).
            // Still send email (different inbox) if provided.
            if (outreach.phone && !isTest) {
              const waMsg =
                `${testBanner}Hi ${nom.name.split(' ')[0]} 👋 I'm Shapi.\n\n` +
                `${ref.referee_name} at ${ref.candidate_company} suggested you worked with ${candidateName} and might share a perspective. ${candidateFirst} doesn't know we've reached out — completely candid is welcome.\n\n` +
                `*Just reply to this message* — 3 short questions, voice notes or text, any language. Takes 2 minutes.\n\n` +
                `(Prefer a web form? ${refUrl})`
              const { whatsapp, sms } = await sendReferenceOutreach({
                phone: outreach.phone,
                message: waMsg,
                label: `${nomineeKey} ref for ${candidateName}`,
              })
              if (whatsapp) channels.push('whatsapp')
              else if (sms) channels.push('sms')
            } else if (isTest && outreach.phone) {
              // Test mode — pretend WhatsApp succeeded (since the phone is the candidate's own)
              channels.push('whatsapp')
            }

            if (outreach.email) {
              try {
                await sendNominatedReferenceEmail({
                  to: outreach.email,
                  refereeName: isTest ? `${nom.name} [TEST]` : nom.name,
                  candidateName,
                  nominatorName: ref.referee_name,
                  nominatorCompany: ref.candidate_company || '',
                  nomineeRole: nomineeKey,
                  referenceUrl: refUrl,
                })
                channels.push('email')
              } catch (err) {
                console.error('[ref-webhook] nominee email failed:', err)
              }
            }

            if (channels.length > 0) {
              await admin.from('candidate_references').update({
                status: 'contacted',
                contacted_at: new Date().toISOString(),
                last_contacted_at: new Date().toISOString(),
                outreach_channel: channels.length > 1 ? channels.join('+') : channels[0],
              }).eq('id', row.id)
              cascadedRefs.push({ name: nom.name, role: nomineeKey })
            }
          } catch (err) {
            console.error(`[ref-webhook] ${nomineeKey} cascade failed:`, err)
          }
        }

        // TEST MODE: send one consolidated summary instead of 2 separate intros.
        // Lists newly-cascaded nominees PLUS any other pending refs for this candidate
        // so the candidate knows what they can start next, and gives them a clear
        // "type the name" path to pick the next conversation.
        if (isTest) {
          const { data: otherPending } = await admin
            .from('candidate_references')
            .select('referee_name, ref_type, candidate_company')
            .eq('candidate_id', ref.candidate_id)
            .in('status', ['pending', 'contacted'])
            .neq('id', ref.id)
            .order('updated_at', { ascending: true })

          const cascadeLines = cascadedRefs.map(c => `• *${c.name.split(' ')[0]}* — ${c.role}`).join('\n')
          // De-dupe cascaded names from the "other pending" list
          const cascadedFirstNames = new Set(cascadedRefs.map(c => c.name.split(' ')[0].toLowerCase()))
          const pendingLines = (otherPending || [])
            .filter(r => !cascadedFirstNames.has((r.referee_name as string).split(' ')[0].toLowerCase()))
            .map(r => `• *${(r.referee_name as string).split(' ')[0]}* — ${r.ref_type} at ${r.candidate_company}`)
            .join('\n')

          const sections: string[] = [
            `🧪 *Test cascade fired*`,
            ``,
            `${ref.referee_name.split(' ')[0]}'s reference is complete ✓`,
          ]
          if (cascadeLines) {
            sections.push(``, `Newly contacted nominees (routing here in test mode):`, cascadeLines)
          }
          if (pendingLines) {
            sections.push(``, `Other pending refs ready to start:`, pendingLines)
          }
          sections.push(``, `*Reply with a first name to start that conversation* (e.g. "${cascadedRefs[0]?.name.split(' ')[0] || (otherPending?.[0]?.referee_name as string)?.split(' ')[0] || 'name'}"). Or text "pause" to stop here.`)

          // Brief pause so this message lands AFTER the [REF_DONE] wrap-up that's
          // already been queued in the existing code path.
          await new Promise(r => setTimeout(r, 800))
          await sendWhatsApp(phone, sections.join('\n'))
        }
      } else {
        // Colleague or stakeholder (or peer) — parse 3-topic response
        const parsed = await parseNomineeResponses(history)
        await admin.from('candidate_references').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          responses: parsed,
        }).eq('id', ref.id)

        // TEST MODE: nominee/peer just completed — show the "what's next"
        // picker so the candidate knows the chain isn't over. Without this,
        // it falls silent after the wrap-up and the candidate is left
        // wondering "is that it?"
        if (ref.is_test_outreach) {
          const { data: stillPending } = await admin
            .from('candidate_references')
            .select('referee_name, ref_type, candidate_company')
            .eq('candidate_id', ref.candidate_id)
            .eq('is_test_outreach', true)
            .in('status', ['pending', 'contacted', 'opened'])
            .neq('id', ref.id)
            .order('updated_at', { ascending: true })

          await new Promise(r => setTimeout(r, 800))
          if (stillPending && stillPending.length > 0) {
            const lines = stillPending.map(r =>
              `• *${(r.referee_name as string).split(' ')[0]}* — ${r.ref_type} at ${r.candidate_company}`
            ).join('\n')
            const firstName = (stillPending[0].referee_name as string).split(' ')[0]
            await sendWhatsApp(phone, `🧪 ${ref.referee_name.split(' ')[0]}'s reference is complete ✓\n\nStill pending:\n${lines}\n\n*Reply with a first name to start* (e.g. "${firstName}"). Or text "pause" to stop here.`)
          } else {
            await sendWhatsApp(phone, `🧪 ${ref.referee_name.split(' ')[0]}'s reference is complete ✓\n\nThat was your last pending ref — chain complete! Check your profile at ${SITE}/profile to see the verification tier update.`)
          }
        }
      }

      // After any ref completes, recompute profile_live for the candidate
      await recomputeProfileLive(ref.candidate_id)

      // Verification tier + AI cross-check — only triggers cross-check when
      // enough refs are in to give Claude something to analyse (≥3 completed)
      try {
        const { data: completed } = await admin
          .from('candidate_references')
          .select('id')
          .eq('candidate_id', ref.candidate_id)
          .eq('status', 'completed')
        if ((completed?.length || 0) >= 3) {
          await runVerificationCrossCheck(ref.candidate_id)
        }
        await updateVerificationTier(ref.candidate_id)
      } catch (err) {
        console.error('[ref-webhook] verification pipeline failed:', err)
      }

      // Notify candidate when a job's chain hits 3 refs
      try {
        const { data: completedThisJob } = await admin
          .from('candidate_references')
          .select('id')
          .eq('candidate_id', ref.candidate_id)
          .eq('job_slot', ref.job_slot)
          .eq('status', 'completed')
        if ((completedThisJob?.length || 0) === 3) {
          const { data: authUser } = await admin.auth.admin.getUserById(ref.candidate_id)
          const { data: profile } = await admin.from('profiles').select('full_name').eq('id', ref.candidate_id).single()
          if (authUser?.user?.email) {
            await sendReferencesVerifiedEmail(authUser.user.email, (profile?.full_name as string) || '', 3)
          }
        }
      } catch (err) {
        console.error('[ref-webhook] candidate notification failed:', err)
      }
    } catch (err) {
      console.error('[ref-webhook] [REF_DONE] processing failed:', err)
    }
  }

  return new NextResponse('', { status: 200 })
}
