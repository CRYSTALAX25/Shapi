import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Countries where English is the primary native language — hide native CV option for these
const NATIVE_ENGLISH_COUNTRIES = [
  'uk', 'united kingdom', 'england', 'scotland', 'wales', 'northern ireland',
  'usa', 'united states', 'united states of america', 'america',
  'australia', 'canada', 'ireland', 'new zealand', 'nz',
]

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

const INDUSTRY_GUIDES: Record<string, string> = {
  finance: 'Lead achievements with numbers. Formal tone. Highlight P&L, AUM, risk, compliance outcomes.',
  tech: 'Name specific stack in context. Quantify scale (users, uptime, latency). Show ownership.',
  creative: 'Evocative language. Name brands and campaigns. Include reach/engagement metrics.',
  healthcare: 'Certifications and licenses prominent. Clinical hours and patient volumes. Formal and precise.',
  legal: 'Practice areas clear. Deal/case experience named. Academic credentials weighted.',
  marketing: 'Every campaign gets a metric: ROAS, conversion, CAC, reach. Channel ownership clear.',
  operations: 'Certifications and licences first. Volume, scale, safety record. Direct and factual.',
  hospitality: 'Property name and star rating upfront. RevPAR, covers, guest scores. Languages listed.',
  education: 'Student outcomes and cohort size. Research and publications. Safeguarding noted.',
  sales: 'Quota attainment % in every role. Deal size, revenue generated. Methodology named.',
  general: 'Lead with impact. Quantify wherever possible. Clear upward progression.',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const mode: string = body.mode // 'english' | 'native' | 'universal'
  const targetIndustry: string | null = body.targetIndustry || null // override profile industry

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, headline, location, summary, skills, work_history, whatsapp_chat, industry, whatsapp_number, ai_tier')
    .eq('id', user.id)
    .single()

  if (!profile || profileError) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Fetch identity/language fields separately — graceful if columns don't exist yet
  let extraFields: {
    native_language?: string | null
    nationality?: string | null
    languages_spoken?: Array<{ language: string; level: string }> | null
    whatsapp_language?: string | null
    cv_language_preference?: string | null
  } | null = null
  try {
    const { data } = await supabase
      .from('profiles')
      .select('native_language, nationality, languages_spoken, whatsapp_language, cv_language_preference')
      .eq('id', user.id)
      .single()
    extraFields = data
  } catch { extraFields = null }

  const workHistory: WorkEntry[] = Array.isArray(profile.work_history) ? profile.work_history as WorkEntry[] : []
  const skills: string[] = Array.isArray(profile.skills) ? profile.skills as string[] : []
  const allChat: Array<{ role: string; content: string }> = Array.isArray(profile.whatsapp_chat) ? profile.whatsapp_chat as Array<{ role: string; content: string }> : []
  const userMessages = allChat.filter(m => m.role === 'user').map(m => m.content)
  const sampleText = userMessages.slice(0, 5).join(' | ')
  const industry = targetIndustry || (profile.industry as string) || 'general'
  const industryGuide = INDUSTRY_GUIDES[industry] || INDUSTRY_GUIDES.general

  // ── Native language resolution — nationality-first, never guess from WhatsApp ──
  // Priority order:
  // 1. Manually declared native_language in profile (set by candidate in profile/edit)
  // 2. native_language extracted from their actual CV document (nationality-based)
  // 3. The language they wrote WhatsApp in (if non-English — signals fluency, not necessarily native)
  // 4. Never fall back to location or WhatsApp content — ask candidate instead

  // cv_language_preference is the most explicit signal — candidate chose it directly
  // Strip "Both — English and " or "Both — " prefix if present; extract the non-English language
  const rawLangPref = extraFields?.cv_language_preference || null
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

  const storedNativeLang = extraFields?.native_language || null
  const languagesOnCV = (extraFields?.languages_spoken || []) as Array<{ language: string; level: string }>
  const nativeOnCV = languagesOnCV.find(l =>
    l.level?.toLowerCase().includes('native') && l.language?.toLowerCase() !== 'english'
  )
  const nonEnglishOnCV = languagesOnCV.find(l => l.language?.toLowerCase() !== 'english')
  const whatsappLang = extraFields?.whatsapp_language || null

  const resolvedNativeLang =
    prefLang ||                        // Explicit candidate choice (most authoritative)
    storedNativeLang ||                // From CV nationality field
    nativeOnCV?.language ||            // Native-level language listed on CV
    nonEnglishOnCV?.language ||        // Any non-English language on CV
    whatsappLang ||                    // Language they wrote WhatsApp in
    null                               // Unknown — don't guess

  const languageInstruction = mode === 'native'
    ? resolvedNativeLang
      ? `Translate this ENTIRE CV into ${resolvedNativeLang}. Every word of every text value must be in ${resolvedNativeLang}. Do not leave any English text in the values. Keep JSON keys in English.`
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
- WhatsApp conversation (use these stories and insights to ENRICH achievements and summary — this is gold): ${JSON.stringify(userMessages)}

${mode === 'universal'
  ? `UNIVERSAL CV MODE: This CV must work for candidates switching industries or applying for cross-sector roles. Avoid all industry-specific jargon. Lead with: leadership, communication, problem-solving, project management, budgets, team size, % improvements, time saved, revenue impact. Every achievement must be understood by a hiring manager in ANY sector.`
  : `INDUSTRY WRITING GUIDE — ${industry.toUpperCase()}:\n${industryGuide}`
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
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Claude returned invalid JSON' }, { status: 500 })

    const cv = JSON.parse(jsonMatch[0])

    // Merge with profile fields not in the CV (for the render)
    return NextResponse.json({
      cv,
      meta: {
        whatsapp_number: profile.whatsapp_number,
        ai_tier: profile.ai_tier,
        has_whatsapp: userMessages.length > 0,
      }
    })
  } catch (err) {
    console.error('[cv/generate] error:', err)
    return NextResponse.json({ error: 'CV generation failed' }, { status: 500 })
  }
}
