// Translate a JD into another language — for companies hiring across
// countries (Gulf reality: the same role is read in Arabic, Hindi, Urdu,
// Tagalog…). POST { target_language, title?, description?, requirements? }
// or { target_language, jd_text }.
//
// Returns { translated: { title, description, requirements } } (or
// { translated: { jd_text } } when raw text was sent). The translation is
// ALWAYS shown editable in the UI before being saved with the role —
// roles.translations jsonb, keyed by locale code (see
// supabase/jd_translations.sql).

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { LOCALES, type Locale } from '@/lib/i18n/locales'

export const maxDuration = 60

const TRANSLATABLE = LOCALES.filter(l => l.code !== 'en')

function extractJson(raw: string): Record<string, unknown> | null {
  try { return JSON.parse(raw) } catch { /* fall through */ }
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first !== -1 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)) } catch { /* fall through */ }
  }
  return null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const targetCode = typeof body.target_language === 'string' ? body.target_language.toLowerCase() : ''
  const target = TRANSLATABLE.find(l => l.code === targetCode)
  if (!target) {
    return NextResponse.json({
      error: `target_language must be one of: ${TRANSLATABLE.map(l => l.code).join(', ')}`,
    }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const requirements = typeof body.requirements === 'string' ? body.requirements.trim() : ''
  const jdText = typeof body.jd_text === 'string' ? body.jd_text.trim() : ''

  if (!jdText && !title && !description && !requirements) {
    return NextResponse.json({ error: 'Provide role fields (title/description/requirements) or jd_text' }, { status: 400 })
  }

  // Structured mode (preferred) vs raw text mode
  const structured = !jdText
  const sourcePayload = structured
    ? JSON.stringify({ title, description, requirements })
    : JSON.stringify({ jd_text: jdText.slice(0, 12000) })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let response
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Translate this job description into ${target.label} (${target.native}).

RULES:
- Natural, professional ${target.label} as a native recruiter in that market would write it — not literal word-for-word translation.
- Keep job titles people search for understandable: translate the title, but if the English title is the industry-standard term, keep it and add the ${target.label} rendering alongside.
- NEVER translate: company names, product names, technology/tool names (e.g. Excel, SAP, AWS), certification names (e.g. PMP, ACCA), currency codes, numbers.
- Preserve the structure exactly: same paragraphs, same bullet list format (lines starting with a dash stay lines starting with a dash).
- Plain text only, no markdown.

SOURCE (JSON):
${sourcePayload}

Return ONLY valid JSON with exactly the same keys as the source, values translated into ${target.label}. No other text, no markdown fences.`,
      }],
    })
  } catch (err) {
    console.error('[jd-translate] Anthropic error:', err)
    return NextResponse.json({ error: 'Translation failed — please try again' }, { status: 500 })
  }

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = extractJson(text)
  if (!parsed) return NextResponse.json({ error: 'Translation failed — please try again' }, { status: 500 })

  if (structured) {
    return NextResponse.json({
      target_language: target.code as Locale,
      rtl: !!target.rtl,
      translated: {
        title: typeof parsed.title === 'string' ? parsed.title : '',
        description: typeof parsed.description === 'string' ? parsed.description : '',
        requirements: typeof parsed.requirements === 'string' ? parsed.requirements : '',
      },
    })
  }
  return NextResponse.json({
    target_language: target.code as Locale,
    rtl: !!target.rtl,
    translated: { jd_text: typeof parsed.jd_text === 'string' ? parsed.jd_text : '' },
  })
}
