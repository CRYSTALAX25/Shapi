import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { INDUSTRY_BRIEFS, INDUSTRY_FOCUS_SHORT, type Industry } from '@/lib/industry-briefs'

// Countries where English is the primary native language — hide native CV option for these
const NATIVE_ENGLISH_COUNTRIES = [
  'uk', 'united kingdom', 'england', 'scotland', 'wales', 'northern ireland',
  'usa', 'united states', 'united states of america', 'america',
  'australia', 'canada', 'ireland', 'new zealand', 'nz',
]

// Known language whitelist — reject garbage stored values like "Sure go ahead"
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
  'catalan', 'basque', 'galician', 'welsh', 'irish', 'icelandic',
]
function isKnownLanguageValue(value: string | null | undefined): boolean {
  if (!value) return false
  const v = value.toLowerCase().trim()
  if (v === 'english') return true
  if (v.startsWith('both')) return true
  const cleaned = v.replace(/[^a-z\s]/g, '').trim()
  if (cleaned.length < 2 || cleaned.length > 30) return false
  return KNOWN_LANGUAGES.some(l => cleaned === l || cleaned.split(' ').includes(l))
}

export function isNativeEnglishLocation(location: string): boolean {
  const loc = (location || '').toLowerCase()
  return NATIVE_ENGLISH_COUNTRIES.some(c => loc.includes(c))
}

// Extend Vercel function timeout to 60s for Claude CV generation
export const maxDuration = 60

type WorkEntry = {
  title?: string
  company?: string
  start?: string
  end?: string
  achievements?: string
}

// One-liner industry styling guidance, used as a quick anchor in the CV-writing prompt.
// The full rich brief is also included below (FULL_BRIEF) so Claude knows what an
// exceptional CV in this industry looks like and writes to that bar.
const INDUSTRY_GUIDES: Record<string, string> = {
  ...INDUSTRY_FOCUS_SHORT,
  general: 'Lead with impact. Quantify wherever possible. Clear upward progression. No industry jargon.',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  let mode: string = body.mode // 'english' | 'native' | 'universal'
  const targetIndustry: string | null = body.targetIndustry || null // override profile industry
  const targetLanguage: string | null = body.targetLanguage || null // specific language override (e.g. "Italian", "Croatian")
  const forceRefresh: boolean = body.forceRefresh || false // bypass cache

  // When a specific target language is requested, route through the native-language code path
  // but lock the resolved language to whatever was asked for.
  if (targetLanguage && targetLanguage.toLowerCase() !== 'english') {
    mode = 'native'
  }

  // Cache key: "english", "native", "universal", "english_tech", "lang_italian", etc.
  const cacheKey = targetLanguage
    ? `lang_${targetLanguage.toLowerCase().replace(/\s+/g, '_')}`
    : targetIndustry
      ? `english_${targetIndustry}`
      : mode

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, headline, location, summary, skills, work_history, whatsapp_chat, industry, whatsapp_number, ai_tier, industry_chats, native_language, cv_language_preference, cv_kit_purchased, cv_tier, continuous_learning')
    .eq('id', user.id)
    .single()

  if (!profile || profileError) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  // Gate: Kit OR Pro purchase grants access (Pro is the upgraded Kit)
  const hasAccess = !!profile.cv_kit_purchased || profile.cv_tier === 'pro'
  if (!hasAccess) return NextResponse.json({ error: 'CV kit not purchased' }, { status: 403 })

  // ── Cache check (separate query — cv_cache column may not exist yet) ─────────
  let existingCache: Record<string, unknown> = {}
  try {
    const { data: cacheRow } = await supabase
      .from('profiles')
      .select('cv_cache')
      .eq('id', user.id)
      .single()
    existingCache = (cacheRow?.cv_cache as Record<string, unknown>) || {}
  } catch { existingCache = {} }

  if (!forceRefresh && existingCache[cacheKey]) {
    const cached = existingCache[cacheKey] as { cv: { languageCode?: string; language?: string }; meta: unknown }
    // For native mode, reject cached result if it's English — it was generated before translation was working
    const cachedLangCode = cached.cv?.languageCode || 'en'
    const isCachedEnglish = cachedLangCode === 'en' || cachedLangCode === ''
    if (mode === 'native' && isCachedEnglish) {
      // Stale English cache — fall through to regenerate
    } else {
      return NextResponse.json({ cv: cached.cv, meta: cached.meta, cached: true })
    }
  }

  // ─── FAST PATH: translate cached English CV instead of regenerating ────────
  // Fresh-language generation from scratch (full work_history reasoning +
  // industry brief + WhatsApp messages) was hitting Vercel's 60s timeout for
  // rich profiles. If the English CV is already cached, send JUST that JSON
  // to Claude with a translation-only prompt — much smaller, much faster
  // (typically 10-15s vs 50-70s).
  if (targetLanguage && targetLanguage.toLowerCase() !== 'english' && !forceRefresh) {
    const englishCached = existingCache['english'] as { cv: Record<string, unknown> } | undefined
    if (englishCached?.cv) {
      try {
        const anthropicForTranslate = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const translatePrompt = `Translate this CV JSON's TEXT VALUES to ${targetLanguage}.

RULES:
- Keep ALL JSON keys in English exactly as-is — do NOT translate keys
- Translate ALL text values (full_name stays as-is; everything else translates: headline, location names if standard, summary, sectionLabels values, achievements, language proficiency level names, certification names if they're descriptions not brand names, etc.)
- DO NOT translate: brand names (Marriott, NEOM, KFC), software/tools (Claude, AWS, HubSpot), certifications with standard global names (PMP, CFA, ACCA), URLs, numbers, currency
- Set language to "${targetLanguage}" and languageCode to the correct 2-letter ISO code (Croatian=hr, Italian=it, Spanish=es, French=fr, German=de, Portuguese=pt, Arabic=ar, etc.)
- Return the SAME JSON structure with translated values

INPUT (English CV):
${JSON.stringify(englishCached.cv)}

Return ONLY valid JSON, no prose.`

        // Haiku for translation — 3-4x faster than Sonnet, quality plenty good
        // for value-only translation (no reasoning needed). Comfortably fits
        // under Vercel Hobby plan's 60s timeout.
        const tRes = await anthropicForTranslate.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{ role: 'user', content: translatePrompt }],
        })
        const tText = tRes.content[0].type === 'text' ? tRes.content[0].text.trim() : ''
        const tMatch = tText.match(/\{[\s\S]*\}/)
        if (tMatch) {
          const translatedCV = JSON.parse(tMatch[0])
          const meta = {
            whatsapp_number: profile.whatsapp_number,
            ai_tier: profile.ai_tier,
            has_whatsapp: Array.isArray(profile.whatsapp_chat) && (profile.whatsapp_chat as unknown[]).length > 0,
          }
          // Cache the translation
          try {
            const updatedCache = { ...existingCache, [cacheKey]: { cv: translatedCV, meta, generated_at: new Date().toISOString() } }
            await supabase.from('profiles').update({ cv_cache: updatedCache }).eq('id', user.id)
          } catch { /* non-fatal */ }
          return NextResponse.json({ cv: translatedCV, meta, translated: true })
        }
      } catch (err) {
        console.error('[cv/generate] translation fast-path failed, falling back to fresh generation:', err)
      }
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  // Fetch supplementary language fields — graceful if columns don't exist yet
  // NOTE: native_language and cv_language_preference are already in the main profile query above
  let extraFields: {
    nationality?: string | null
    languages_spoken?: Array<{ language: string; level: string }> | null
    whatsapp_language?: string | null
  } | null = null
  try {
    const { data } = await supabase
      .from('profiles')
      .select('nationality, languages_spoken, whatsapp_language')
      .eq('id', user.id)
      .single()
    extraFields = data
  } catch { extraFields = null }

  const workHistoryFull: WorkEntry[] = Array.isArray(profile.work_history) ? profile.work_history as WorkEntry[] : []
  // Aggressive trims so fresh-language generation reliably fits under
  // Vercel Hobby plan's 60s function timeout for rich profiles (10+ roles).
  // For native-language fresh generation we trim even harder — translation
  // doesn't need full work-history reasoning.
  const isNativeMode = mode === 'native'
  const maxRoles = isNativeMode ? 5 : 7
  const maxAchievementChars = isNativeMode ? 250 : 400
  const workHistory: WorkEntry[] = workHistoryFull.slice(0, maxRoles).map(w => ({
    ...w,
    achievements: typeof w.achievements === 'string' ? w.achievements.slice(0, maxAchievementChars) : w.achievements,
  }))
  const skills: string[] = Array.isArray(profile.skills) ? profile.skills as string[] : []
  const allChat: Array<{ role: string; content: string }> = Array.isArray(profile.whatsapp_chat) ? profile.whatsapp_chat as Array<{ role: string; content: string }> : []
  const userMessages = allChat.filter(m => m.role === 'user').map(m => m.content)
  // Cap messages further for native — translation doesn't need rich source
  const cappedMessages = userMessages.slice(0, isNativeMode ? 4 : 6)
  const sampleText = cappedMessages.slice(0, 4).join(' | ')

  // ── Pro deep-dive answers — HYBRID ───────────────────────────────────────────
  // Deep-dive answers are real achievements that belong on EVERY version, not
  // just the industry they were captured under. So we pull from ALL industries
  // the candidate has done, with the target industry's answers first (most
  // relevant framing for this specific CV). The base English / language /
  // universal versions get the full pool too — they just frame it generally.
  const industryChats = (profile.industry_chats as Record<string, { answers?: string[] }> | null) || {}
  const targetAnswers: string[] = targetIndustry && industryChats[targetIndustry]?.answers
    ? industryChats[targetIndustry].answers!
    : []
  const otherAnswers: string[] = Object.entries(industryChats)
    .filter(([key]) => key !== targetIndustry)
    .flatMap(([, v]) => Array.isArray(v?.answers) ? v.answers! : [])
  // Target industry answers first, then everything else; dedupe + cap to keep
  // the prompt under the Vercel 60s timeout budget.
  const deepDiveAnswers: string[] = [...new Set([...targetAnswers, ...otherAnswers])].slice(0, 12)
  const industry = targetIndustry || (profile.industry as string) || 'general'
  const industryGuide = INDUSTRY_GUIDES[industry] || INDUSTRY_GUIDES.general
  // Full rich brief — handed to Claude so the CV writer aligns with the same rubric
  // the deep-dive questions were generated against.
  const industryFullBrief = INDUSTRY_BRIEFS[industry as Industry] || ''

  // ── Native language resolution — nationality-first, never guess from WhatsApp ──
  // Priority order:
  // 1. Manually declared native_language in profile (set by candidate in profile/edit)
  // 2. native_language extracted from their actual CV document (nationality-based)
  // 3. The language they wrote WhatsApp in (if non-English — signals fluency, not necessarily native)
  // 4. Never fall back to location or WhatsApp content — ask candidate instead

  // cv_language_preference is the most explicit signal — candidate chose it directly
  // Strip "Both — English and " or "Both — " prefix if present; extract the non-English language
  // Use profile directly for critical language fields (always loaded), extraFields as supplement
  // Only trust the saved preference if it's actually a language (not "Sure go ahead", etc.)
  const rawLangPref = isKnownLanguageValue(profile.cv_language_preference as string | null)
    ? (profile.cv_language_preference as string)
    : null
  let prefLang: string | null = null
  if (rawLangPref) {
    const pref = rawLangPref.toLowerCase().trim()
    if (pref === 'english') {
      prefLang = null // English only — no native
    } else if (pref.startsWith('both')) {
      // "Both — English and Croatian" → extract "Croatian"
      const m = rawLangPref.match(/both\s*[—\-]+\s*english\s*(?:and|&|\+)\s*(.+)/i)
        || rawLangPref.match(/both\s*[—\-]+\s*(.+)\s*(?:and|&|\+)\s*english/i)
      prefLang = m?.[1]?.trim() || null
    } else {
      prefLang = rawLangPref.trim() // e.g. "Croatian", "Tagalog", "French"
    }
  }

  const storedNativeLang = (profile.native_language as string | null) || null
  const languagesOnCV = (extraFields?.languages_spoken || []) as Array<{ language: string; level: string }>
  const nativeOnCV = languagesOnCV.find(l =>
    l.level?.toLowerCase().includes('native') && l.language?.toLowerCase() !== 'english'
  )
  const nonEnglishOnCV = languagesOnCV.find(l => l.language?.toLowerCase() !== 'english')
  const whatsappLang = extraFields?.whatsapp_language || null

  const resolvedNativeLang =
    targetLanguage ||                  // Explicit per-request override (most authoritative — UI button click)
    prefLang ||                        // Explicit candidate choice from WhatsApp picker
    storedNativeLang ||                // From CV nationality field
    nativeOnCV?.language ||            // Native-level language listed on CV
    nonEnglishOnCV?.language ||        // Any non-English language on CV
    whatsappLang ||                    // Language they wrote WhatsApp in
    null                               // Unknown — don't guess

  const languageInstruction = mode === 'native'
    ? resolvedNativeLang
      ? `You MUST write this ENTIRE CV in ${resolvedNativeLang}. This is critical. Every single word of every text value — summary, job titles, company names (if translatable), achievements, skills, section labels, quotes — MUST be in ${resolvedNativeLang}. Do NOT write any English words in the values. The JSON keys stay in English but ALL values must be in ${resolvedNativeLang}. Set languageCode to the correct 2-letter ISO code for ${resolvedNativeLang}.`
      : `You cannot determine this candidate's native language from available data. Write the CV in English and note in the "language" field: "Native language not detected — candidate should declare in profile settings."`
    : mode === 'universal'
    ? `Write everything in polished, plain professional English. No industry-specific jargon. Focus entirely on transferable skills, leadership qualities, problem-solving, and measurable outcomes that would be understood and valued across ANY industry. Strip out niche terminology and replace with universally understood language.`
    : `Write everything in polished professional English.`

  const promptTitle = mode === 'native' ? 'native language'
    : mode === 'universal' ? 'industry-agnostic universal'
    : targetIndustry ? `${targetIndustry}-targeted English`
    : 'English'

  const prompt = `You are an expert CV writer producing a world-class ${promptTitle} CV.

CANDIDATE INFO:
- Name: ${profile.full_name || ''}
- Headline: ${profile.headline || ''}
- Location: ${profile.location || ''}
- Industry: ${industry}
- Summary: ${(profile.summary as string || '').replace(/"/g, "'")}
- Work history: ${JSON.stringify(workHistory)}
- Skills: ${JSON.stringify(skills)}
- Languages spoken: ${JSON.stringify(extraFields?.languages_spoken || [])}
- Continuous learning (certifications / events / talks / OSS / courses): ${JSON.stringify((profile as { continuous_learning?: unknown }).continuous_learning || {})}
- WhatsApp conversation (use these stories and insights to ENRICH achievements and summary — this is gold): ${JSON.stringify(cappedMessages)}${deepDiveAnswers.length > 0 ? `\n- INDUSTRY DEEP-DIVE ANSWERS (${targetIndustry} specific — these are the most valuable, prioritise them heavily): ${JSON.stringify(deepDiveAnswers)}` : ''}

${mode === 'universal'
  ? `UNIVERSAL CV MODE: This CV must work for candidates switching industries or applying for cross-sector roles. Avoid all industry-specific jargon. Lead with: leadership, communication, problem-solving, project management, budgets, team size, % improvements, time saved, revenue impact. Every achievement must be understood by a hiring manager in ANY sector.`
  : mode === 'native'
  ? `INDUSTRY STYLE ANCHOR — ${industry.toUpperCase()}:\n${industryGuide}\n\nWrite the CV in ${resolvedNativeLang || 'the target language'} using this industry's voice. Keep numbers, brands and proper nouns intact.`
  : `═══ THIS IS A ${(targetIndustry || industry).toUpperCase()}-TARGETED CV ═══

This CV must be VISIBLY, MATERIALLY DIFFERENT from a generic CV — a hiring manager in ${(targetIndustry || industry).toUpperCase()} should immediately see this candidate as a ${(targetIndustry || industry).toUpperCase()} specialist, not a generalist.

═══ WHAT AN EXCEPTIONAL CV IN ${(targetIndustry || industry).toUpperCase()} LOOKS LIKE ═══
${industryFullBrief}

═══ INDUSTRY-FIRST RE-FRAMING — APPLY ALL FIVE ═══

1. **HEADLINE** — Rewrite to position them as a ${(targetIndustry || industry).toUpperCase()} specialist. Use industry-standard role nomenclature (not whatever was on the original CV).

2. **SUMMARY** — Re-write the entire summary through a ${(targetIndustry || industry).toUpperCase()} lens. Use the industry's vocabulary from the brief above (especially the "Vocabulary of expertise" list). Lead with the SCALE and METRICS that recruiters in this industry pattern-match on.

3. **WORK HISTORY ORDERING + EMPHASIS** — Re-order so the MOST ${(targetIndustry || industry).toUpperCase()}-relevant roles come FIRST (don't auto-default to chronological). For each role, re-write achievements to:
   - Use industry vocabulary (replace generic verbs with industry power verbs)
   - Surface ${(targetIndustry || industry).toUpperCase()} HIDDEN GOLDMINES from the brief above wherever the source mentions anything close (this is where you find differentiation — don't skip this step)
   - Lead each bullet with the metric the industry cares about most
   - For roles in OTHER industries, briefly reframe responsibilities through transferable-skills lens — don't drop them, but don't dwell on irrelevant detail
   - Match the "Exemplary achievement" tone and specificity from the brief

4. **SKILLS** — Re-order so industry-specific tech/tools come first (e.g. Opera Cloud + IDeaS first for hospitality, SAP + lean methodologies first for operations, Salesforce + MEDDIC first for sales). Drop or move down skills that aren't relevant to this industry.

5. **SECTION LABELS** — Use industry-conventional labels where they differ (e.g. "Properties Operated" instead of "Experience" for hospitality, "Deals Closed" sub-section for sales, "Cases / Practice Areas" for legal, "Clinical Experience" for healthcare).

═══ ACID TEST ═══
If you generated this CV side-by-side with a generic English CV for the same candidate, a recruiter must IMMEDIATELY know which one is the ${(targetIndustry || industry).toUpperCase()} version — different headline, different summary, different role order, different vocabulary, different bullet emphasis. If you can't see the difference, you haven't done the job.`
}

LANGUAGE: ${languageInstruction}

Using ALL of the above — CV data AND WhatsApp insights — produce an enriched, polished CV. The WhatsApp answers often contain specific numbers, challenges, and stories missing from the raw CV. Weave them in.

Return ONLY valid JSON:
{
  "language": "${mode === 'english' ? 'English' : mode === 'universal' ? 'Universal (English)' : (resolvedNativeLang || 'detected language name')}",
  "languageCode": "${mode === 'native' ? 'detected 2-letter ISO code e.g. ar, fr, es' : 'en'}",
  "full_name": "...",
  "headline": "...",
  "location": "...",
  "summary": "3-4 sentence enriched professional summary",
  "sectionLabels": {
    "profile": "Profile (or equivalent in target language)",
    "inTheirOwnWords": "In Their Own Words",
    "experience": "Experience",
    "skills": "Skills",
    "languages": "Languages",
    "certifications": "Certifications & Learning",
    "present": "Present",
    "verifiedBy": "Verified by Shapi"
  },
  "workHistory": [{"title":"...","company":"...","start":"...","end":"...","achievements":"2-3 bullet points with metrics"}],
  "chatAnswers": ["best quote 1 from whatsapp", "best quote 2", "best quote 3"],
  "skills": ["skill1","skill2"],
  "languages_spoken": [{"language": "English", "level": "Fluent"}, {"language": "Croatian", "level": "Native"}],
  "certifications": [{"name": "PMP", "issuer": "PMI", "year": "2023"}],
  "courses": [{"name": "AWS Solutions Architect", "platform": "Coursera", "year": "2024"}],
  "events": [{"name": "Money 20/20", "year": "2024", "role": "attendee"}],
  "talks": [{"venue": "Conference name", "year": "2023", "title": "Talk title"}]
}

For languages_spoken: copy from the input "Languages spoken" field. If empty, return [].
For certifications/courses/events/talks: copy from input "Continuous learning". Empty arrays if none. These appear on the CV under a "Certifications & Learning" section.
For sectionLabels: localise to the target language if not English (e.g. "Esperienza" for Italian Experience).`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Claude returned invalid JSON' }, { status: 500 })

    const cv = JSON.parse(jsonMatch[0])

    const meta = {
      whatsapp_number: profile.whatsapp_number,
      ai_tier: profile.ai_tier,
      has_whatsapp: userMessages.length > 0,
    }

    // ── Save to cache ──────────────────────────────────────────────────────────
    try {
      const updatedCache = { ...existingCache, [cacheKey]: { cv, meta, generated_at: new Date().toISOString() } }
      await supabase.from('profiles').update({ cv_cache: updatedCache }).eq('id', user.id)
    } catch { /* Cache save failing is non-fatal */ }

    return NextResponse.json({ cv, meta })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cv/generate] error:', msg)
    return NextResponse.json({ error: msg || 'CV generation failed' }, { status: 500 })
  }
}
