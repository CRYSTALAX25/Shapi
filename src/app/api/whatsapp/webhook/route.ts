import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp'
import { sendProfileLiveEmail, sendCompanyMatchEmail } from '@/lib/email'

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

  // Look up profile — limit(1) survives duplicate rows
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, headline, skills, work_history, whatsapp_chat, completion_pct, cv_parsed, native_language, awaiting_cv_language')
    .eq('whatsapp_number', phone)
    .order('cv_parsed', { ascending: false })
    .limit(1)

  const profile = profiles?.[0] ?? null

  if (!profile) {
    console.log('[webhook] No profile found for:', phone)
    return new NextResponse('', { status: 200 })
  }

  // ── CV language preference capture ───────────────────────────────────────
  // awaiting_cv_language: null | 'choice' | 'custom'
  // 'choice'  = we sent the numbered menu, waiting for 1/2/3/4 or direct language name
  // 'custom'  = they picked Other (4), waiting for them to type the language name
  const awaitingLang = profile.awaiting_cv_language as string | null

  if (awaitingLang === 'choice' || awaitingLang === 'custom') {
    const reply = body?.trim() || ''
    const replyLower = reply.toLowerCase()
    const detectedNative = (profile.native_language as string | null) || null

    let preference: string | null = null
    let nextStep: string | null = null
    let responseMsg = ''

    if (awaitingLang === 'custom') {
      // Whatever they typed IS the language — store it directly
      preference = reply
      responseMsg = `Perfect — we'll build your CV in *${reply}*. Head back to the app to generate and download it 🎉`
    } else {
      // Parse their choice from the menu
      if (reply === '1' || replyLower.includes('english only') || (replyLower === 'english' && !replyLower.includes('+'))) {
        preference = 'English'
        responseMsg = `Got it — English CV it is. Head to the app to generate and download yours 🎉`
      } else if (reply === '2' && detectedNative) {
        preference = detectedNative
        responseMsg = `Perfect — ${detectedNative} CV coming up. Head to the app to generate and download it 🎉`
      } else if (reply === '3') {
        preference = detectedNative ? `Both — English and ${detectedNative}` : 'Both — English and native language'
        responseMsg = `Both versions — love it. Head to the app to generate and download them 🎉`
      } else if (reply === '4' || replyLower.includes('other')) {
        // Ask them to type the language
        nextStep = 'custom'
        responseMsg = `No problem — just type the language you want your CV in and we'll handle it.`
      } else {
        // They typed a language name directly instead of a number — treat it as their answer
        preference = reply
        responseMsg = `Got it — *${reply}* CV it is. Head to the app to generate and download it 🎉`
      }
    }

    const langUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (preference) {
      langUpdates.cv_language_preference = preference
      langUpdates.awaiting_cv_language = null
    }
    if (nextStep) {
      langUpdates.awaiting_cv_language = nextStep
    }

    await admin.from('profiles').update(langUpdates).eq('id', profile.id)
    await sendWhatsApp(phone, responseMsg)
    console.log('[webhook] CV language captured:', preference || 'awaiting custom', '| phone:', phone)
    return new NextResponse('', { status: 200 })
  }

  // ── Voice note — Deepgram transcription ─────────────────────────────────
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

  // ── Conversation history ─────────────────────────────────────────────────
  const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> =
    Array.isArray(profile.whatsapp_chat) ? profile.whatsapp_chat : []

  const userTurns = chatHistory.filter(m => m.role === 'user').length
  chatHistory.push({ role: 'user', content: userMessage })

  // ── Build context from CV ────────────────────────────────────────────────
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

  // ── The 6 quality signals Claude must hunt for ───────────────────────────
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

  // ── Claude call ──────────────────────────────────────────────────────────
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

  // ── Save to profile ──────────────────────────────────────────────────────
  const updates: Record<string, unknown> = {
    whatsapp_chat: chatHistory,
    industry,
    updated_at: new Date().toISOString(),
  }

  if (isDone) {
    updates.completion_pct = Math.max((profile.completion_pct as number) || 0, 65)
    updates.whatsapp_conversation_active = false

    // ── Language proficiency assessment from the conversation ────────────────
    // Analyse the candidate's actual writing quality — don't guess from location
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
          // If they wrote in a non-English language and we don't have a native_language set yet,
          // use the conversation language as a signal (but don't override CV-detected nationality)
          if (langData.conversation_language_code !== 'en') {
            updates.whatsapp_language = langData.conversation_language
          }
        }
      } catch (err) {
        console.error('[webhook] Language assessment failed:', err)
        // Non-fatal — continue
      }
    }
  }

  await admin.from('profiles').update(updates).eq('id', profile.id)

  await sendWhatsApp(phone, cleanReply)

  // ── CV language preference question — sent immediately after [DONE] ──────
  if (isDone) {
    const detectedNative = (profile.native_language as string | null) || null

    // Build the options dynamically based on what we know about them
    let langQuestion: string
    if (detectedNative) {
      langQuestion = `One last thing before we build your CV 🎨

Which language do you want it in?

1️⃣ English
2️⃣ ${detectedNative}
3️⃣ Both — English + ${detectedNative}
4️⃣ Other — just type the language you need`
    } else {
      langQuestion = `One last thing before we build your CV 🎨

Which language do you want it in?

1️⃣ English
2️⃣ Other — just type the language you need`
    }

    await sendWhatsApp(phone, langQuestion)
    await admin.from('profiles').update({ awaiting_cv_language: 'choice' }).eq('id', profile.id)
  }

  // ── Post-completion emails (non-blocking) ────────────────────────────────
  if (isDone) {
    // Fetch email for the candidate
    const { data: authUser } = await admin.auth.admin.getUserById(profile.id as string)
    const candidateEmail = authUser?.user?.email

    if (candidateEmail) {
      // 1. Tell candidate their profile is live
      sendProfileLiveEmail(candidateEmail, profile.full_name as string || '', profile.id as string)
        .catch(err => console.error('[email] profile-live failed:', err))

      // 2. Find companies with active roles that match this candidate well
      const { data: activeRoles } = await admin
        .from('roles')
        .select('id, title, company_id')
        .eq('status', 'active')

      if (activeRoles && activeRoles.length > 0) {
        // Simple scoring: count how many candidate skills appear in role title (fast, no Claude)
        const candidateSkillsLower = ((profile.skills as string[]) || []).map((s: string) => s.toLowerCase())
        const headlineLower = ((profile.headline as string) || '').toLowerCase()

        for (const role of activeRoles) {
          const roleText = role.title.toLowerCase()
          const skillHits = candidateSkillsLower.filter(s => roleText.includes(s)).length
          const headlineHit = roleText.split(/\s+/).some((w: string) => w.length > 3 && headlineLower.includes(w))
          const quickScore = Math.min(100, skillHits * 20 + (headlineHit ? 30 : 0) + 20) // baseline 20

          if (quickScore >= 40) {
            // Get company email
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
