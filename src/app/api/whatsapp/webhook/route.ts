import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp, sendReferenceOutreach } from '@/lib/whatsapp'
import { sendProfileLiveEmail, sendCompanyMatchEmail, sendNominatedReferenceEmail, sendReferencesVerifiedEmail } from '@/lib/email'
import { runReferenceTurn, parseManagerResponses, parseNomineeResponses } from '@/lib/reference-qa'
import { recomputeProfileLive, resolveOutreachContact } from '@/lib/references'

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

function parseLanguageReply(
  reply: string,
  detectedNative: string | null,
  mode: 'choice' | 'custom',
): { preference?: string; askCustom?: boolean; clarify?: boolean } {
  const r = reply.trim()
  const lower = r.toLowerCase()

  if (mode === 'custom') {
    // They picked "Other" and are typing the language — accept if it looks like a language name
    const cleaned = lower.replace(/[^a-z\s]/g, '').trim()
    if (cleaned.length < 2 || cleaned.length > 30) return { clarify: true }
    if (KNOWN_LANGUAGES.includes(cleaned)) return { preference: cleaned.charAt(0).toUpperCase() + cleaned.slice(1) }
    // Allow unknown language but require single word or two-word language name
    if (/^[a-z]+( [a-z]+)?$/.test(cleaned)) return { preference: r.charAt(0).toUpperCase() + r.slice(1) }
    return { clarify: true }
  }

  // Mode: choice
  // Numeric replies
  if (r === '1' || lower === 'english only' || (lower === 'english' && !lower.includes('+'))) {
    return { preference: 'English' }
  }
  if (r === '2' && detectedNative) {
    return { preference: detectedNative }
  }
  if (r === '3' || lower === 'both' || lower.startsWith('both ')) {
    return { preference: detectedNative ? `Both — English and ${detectedNative}` : 'Both — English and native language' }
  }
  if (r === '4' || lower === 'other' || lower.includes('different language')) {
    return { askCustom: true }
  }

  // Language name typed directly
  const cleaned = lower.replace(/[^a-z\s]/g, '').trim()
  if (KNOWN_LANGUAGES.includes(cleaned)) {
    return { preference: cleaned.charAt(0).toUpperCase() + cleaned.slice(1) }
  }

  // Anything else — ask them to clarify
  return { clarify: true }
}

const buildLangPrompt = (detectedNative: string | null): string => {
  if (detectedNative) {
    return `One last thing before we build your CV 🎨

Which language do you want it in?

1️⃣ English
2️⃣ ${detectedNative}
3️⃣ Both — English + ${detectedNative}
4️⃣ Other — just type the language you need`
  }
  return `One last thing before we build your CV 🎨

Which language do you want it in?

1️⃣ English
2️⃣ Other — just type the language you need`
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const from = formData.get('From') as string
  const body = formData.get('Body') as string
  const numMedia = parseInt((formData.get('NumMedia') as string) || '0')
  const mediaType = (formData.get('MediaContentType0') as string) || ''

  // Normalise: strip whatsapp: prefix and ALL spaces
  const phone = from?.replace('whatsapp:', '').replace(/\s+/g, '').trim()
  if (!phone) return new NextResponse('', { status: 200 })

  console.log('[webhook] Message from:', phone, '| body:', body?.slice(0, 80), '| media:', numMedia, mediaType)

  const admin = createAdminClient()

  // ═══ PRIORITY 0: Reference reply routing ═══════════════════════════════
  // If this phone matches a candidate_references row in 'contacted' or 'opened'
  // state, route the message to the reference Q&A flow (not the candidate flow).
  // In test mode multiple rows can share the phone — pick the oldest active.
  const { data: refRows } = await admin
    .from('candidate_references')
    .select('id, candidate_id, ref_type, job_slot, status, referee_name, candidate_company, candidate_job_title, candidate_dates, whatsapp_chat, is_test_outreach, nominator_name, response_channel, first_responded_at, token')
    .eq('referee_phone', phone)
    .in('status', ['contacted', 'opened'])
    .order('contacted_at', { ascending: true })
    .limit(1)

  if (refRows && refRows.length > 0) {
    return handleReferenceReply(refRows[0], body || '', formData, numMedia, mediaType, phone)
  }
  // ═══════════════════════════════════════════════════════════════════════

  // Look up candidate profile — limit(1) survives duplicate rows
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, headline, skills, work_history, whatsapp_chat, completion_pct, cv_parsed, native_language, awaiting_cv_language, cv_language_preference, cv_tier, industry_chats, whatsapp_conversation_active')
    .eq('whatsapp_number', phone)
    .order('cv_parsed', { ascending: false })
    .limit(1)

  const profile = profiles?.[0] ?? null

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

  // ── State (single source of truth, computed once) ───────────────────────
  const isPro = profile.cv_tier === 'pro'
  const industryChats = (profile.industry_chats as Record<string, { status?: string; answers?: string[]; questions?: string; sent_at?: string }> | null) || {}
  const activeDeepDiveInds = Object.entries(industryChats)
    .filter(([, v]) => v.status === 'questions_sent')
    .map(([k]) => k)
  const isInDeepDive = isPro && activeDeepDiveInds.length > 0
  const awaitingLang = profile.awaiting_cv_language as 'choice' | 'custom' | null
  const hasLangPref = isValidLangPref(profile.cv_language_preference as string | null)
  const interviewDone = profile.whatsapp_conversation_active === false
  const detectedNative = (profile.native_language as string | null) || null
  const firstName = (profile.full_name as string || 'there').split(' ')[0]

  // ── Priority 1: Pro deep-dive answer routing ─────────────────────────────
  // If a Pro user has active deep-dive questions out, their replies are answers
  // — not language picks, not main interview. This wins over everything.
  if (isInDeepDive) {
    const updatedChats = { ...industryChats }
    let totalAnswersSoFar = 0
    for (const ind of activeDeepDiveInds) {
      const prev = updatedChats[ind]
      const answers = [...(prev.answers || []), userMessage]
      updatedChats[ind] = { ...prev, answers }
      totalAnswersSoFar = Math.max(totalAnswersSoFar, answers.length)
    }

    const mainChat = Array.isArray(profile.whatsapp_chat) ? profile.whatsapp_chat : []
    mainChat.push({ role: 'user', content: userMessage })

    await admin.from('profiles').update({
      industry_chats: updatedChats,
      whatsapp_chat: mainChat,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id)

    if (totalAnswersSoFar === 1) {
      const indLabels = activeDeepDiveInds.map(i => i.charAt(0).toUpperCase() + i.slice(1)).join(', ')
      await sendWhatsApp(phone, `Got it 👍 Answer each question when you're ready — no rush. Once you're done, head to the app and your ${indLabels} CV${activeDeepDiveInds.length > 1 ? 's' : ''} will be ready to download.`)
    }

    console.log('[webhook] Deep-dive answer captured for:', activeDeepDiveInds, '| answer #', totalAnswersSoFar)
    return new NextResponse('', { status: 200 })
  }

  // ── Priority 2: Language preference reply ────────────────────────────────
  if (awaitingLang === 'choice' || awaitingLang === 'custom') {
    const parsed = parseLanguageReply(userMessage, detectedNative, awaitingLang)

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
        `Hey ${firstName} 👋 Your profile is ready — one last thing before we finalise your CV:\n\n${buildLangPrompt(detectedNative)}`,
      )
      console.log('[webhook] Re-asking language picker for:', phone)
      return new NextResponse('', { status: 200 })
    }

    await admin.from('profiles').update({
      whatsapp_chat: mainChat,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id)

    await sendWhatsApp(
      phone,
      `Hey ${firstName} 👋 Got your message — noted. Your profile is being prepared. Head to shapi.io to download your CV. If you want to update something specific, just let me know.`,
    )
    console.log('[webhook] Post-interview ack sent to:', phone)
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

  console.log('[webhook] Detected industry:', industry)

  const systemPrompt = `You are Shapi — an expert career coach and headhunter building a world-class profile for ${profile.full_name || 'this candidate'} through WhatsApp.

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
- After signal 6 is answered, OR after 9 exchanges total: Wrap up warmly. Tell them their profile is being built and they'll hear from us. End your message with exactly: [DONE]

${industryGuide}

WHATSAPP RULES (non-negotiable):
- LANGUAGE: Detect what language they write in and respond in that SAME language always. Arabic → Arabic. Hindi → Hindi. French → French.
- Maximum 3 sentences per message. Short. Punchy. Human.
- Never use bullet points or numbered lists in your reply.
- Always acknowledge what they said before asking the next thing.
- One question per message — never stack two questions.
- Sound like a sharp, warm human — not HR, not a chatbot, not a form.
- If they give a vague answer (e.g. "I improved things"), gently push for the number or specific outcome before moving on.

This is exchange ${userTurns + 1}. ${userTurns >= 9 ? 'You have enough. Wrap up now with [DONE].' : 'Do NOT end the conversation yet unless all 6 signals are clearly covered.'}`

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
    await sendWhatsApp(phone, buildLangPrompt(detectedNative))
    await admin.from('profiles').update({ awaiting_cv_language: 'choice' }).eq('id', profile.id)
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
          responses: {
            quality: parsed.quality,
            achievement: parsed.achievement,
            skills: parsed.skills,
            would_rehire: parsed.would_rehire,
            anything_else: parsed.anything_else,
          },
          nominees: parsed.nominees,
        }).eq('id', ref.id)

        // Cascade — create + reach out to the colleague and stakeholder
        const isTest = !!ref.is_test_outreach
        const candidateFirst = candidateName.split(' ')[0]

        for (const nomineeKey of ['colleague', 'stakeholder'] as const) {
          const nom = parsed.nominees[nomineeKey]
          if (!nom?.name || (!nom.phone && !nom.email)) continue

          try {
            const { data: inserted } = await admin.from('candidate_references').insert({
              candidate_id: ref.candidate_id,
              ref_type: nomineeKey,
              job_slot: ref.job_slot,
              nominated_by: ref.id,
              nominator_name: ref.referee_name,
              referee_name: nom.name,
              referee_phone: nom.phone,
              referee_email: nom.email,
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
            const outreach = await resolveOutreachContact(ref.candidate_id, nom.phone, nom.email, isTest)
            const testBanner = outreach.testMode ? '🧪 *TEST MODE*\n\n' : ''
            const channels: string[] = []

            if (outreach.phone) {
              const waMsg =
                `${testBanner}Hi ${nom.name.split(' ')[0]} 👋 ${ref.referee_name} at ${ref.candidate_company} suggested you worked with ${candidateName}.\n\n` +
                `${candidateFirst} doesn't know we've reached out — you can be completely candid.\n\n` +
                `Just reply to this message and we'll chat through a few quick questions (2 mins), or use the web form: ${refUrl}`
              const { whatsapp, sms } = await sendReferenceOutreach({
                phone: outreach.phone,
                message: waMsg,
                label: `${nomineeKey} ref for ${candidateName}${isTest ? ' [TEST]' : ''}`,
              })
              if (whatsapp) channels.push('whatsapp')
              else if (sms) channels.push('sms')
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
            }
          } catch (err) {
            console.error(`[ref-webhook] ${nomineeKey} cascade failed:`, err)
          }
        }
      } else {
        // Colleague or stakeholder — parse 3-topic response
        const parsed = await parseNomineeResponses(history)
        await admin.from('candidate_references').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          responses: parsed,
        }).eq('id', ref.id)
      }

      // After any ref completes, recompute profile_live for the candidate
      await recomputeProfileLive(ref.candidate_id)

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
