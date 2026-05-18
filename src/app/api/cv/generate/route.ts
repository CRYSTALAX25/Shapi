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
    .select('full_name, headline, location, summary, skills, work_history, whatsapp_chat, industry, whatsapp_number, ai_tier, industry_chats, native_language, cv_language_preference, cv_kit_purchased, cv_tier')
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

  const workHistory: WorkEntry[] = Array.isArray(profile.work_history) ? profile.work_history as WorkEntry[] : []
  const skills: string[] = Array.isArray(profile.skills) ? profile.skills as string[] : []
  const allChat: Array<{ role: string; content: string }> = Array.isArray(profile.whatsapp_chat) ? profile.whatsapp_chat as Array<{ role: string; content: string }> : []
  const userMessages = allChat.filter(m => m.role === 'user').map(m => m.content)
  // Cap at 10 messages to keep prompt size manageable and avoid truncated JSON
  const cappedMessages = userMessages.slice(0, 10)
  const sampleText = cappedMessages.slice(0, 5).join(' | ')

  // ── Pro deep-dive answers for this specific industry ─────────────────────────
  const industryChats = (profile.industry_chats as Record<string, { answers?: string[] }> | null) || {}
  const deepDiveAnswers: string[] = targetIndustry && industryChats[targetIndustry]?.answers
    ? industryChats[targetIndustry].answers!
    : []
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
- WhatsApp conversation (use these stories and insights to ENRICH achievements and summary — this is gold): ${JSON.stringify(cappedMessages)}${deepDiveAnswers.length > 0 ? `\n- INDUSTRY DEEP-DIVE ANSWERS (${targetIndustry} specific — these are the most valuable, prioritise them heavily): ${JSON.stringify(deepDiveAnswers)}` : ''}

${mode === 'universal'
  ? `UNIVERSAL CV MODE: This CV must work for candidates switching industries or applying for cross-sector roles. Avoid all industry-specific jargon. Lead with: leadership, communication, problem-solving, project management, budgets, team size, % improvements, time saved, revenue impact. Every achievement must be understood by a hiring manager in ANY sector.`
  : `INDUSTRY STYLE ANCHOR — ${industry.toUpperCase()}:\n${industryGuide}\n\n═══ WHAT AN EXCEPTIONAL CV IN ${industry.toUpperCase()} LOOKS LIKE (write to this bar) ═══\n${industryFullBrief}\n\nWrite this candidate's CV against that bar. Use the industry's "Vocabulary of expertise" naturally in their achievements. If their work history mentions something that maps to a "Hidden goldmine" from the brief, surface it prominently. Match the "Exemplary achievement" tone and specificity wherever the candidate's actual experience supports it.`
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
    "profile": "...",
    "inTheirOwnWords": "...",
    "experience": "...",
    "skills": "...",
    "present": "...",
    "verifiedBy": "..."
  },
  "workHistory": [{"title":"...","company":"...","start":"...","end":"...","achievements":"2-3 bullet points with metrics"}],
  "chatAnswers": ["best quote 1 from whatsapp", "best quote 2", "best quote 3"],
  "skills": ["skill1","skill2"]
}`

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
