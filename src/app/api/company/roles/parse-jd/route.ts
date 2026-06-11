// Parse a company's internal JD into structured role fields — the PRIMARY
// path for posting a role (companies already have internally drafted JDs).
//
// Supersedes /api/company/parse-jd (paste-only, kept untouched for backward
// compatibility). Accepts EITHER:
//   • multipart/form-data with a `file` field — PDF (sent to Claude as a
//     document block, same pattern as /api/cv-parse), DOCX (text extracted
//     via mammoth), or TXT
//   • JSON { jd_text } — pasted JD text
//
// Returns { parsed } with every field the /company/roles/new form knows,
// including description + requirements kept faithful to the source JD so the
// company's own JD lands in the editable form (never auto-published).

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB — same cap as cv-parse

const EXTRACTION_PROMPT = (jdSourceNote: string) => `Extract structured information from this job description${jdSourceNote}. Return ONLY valid JSON — no other text, no markdown fences.

Return this JSON:
{
  "title": "exact job title",
  "department": "department or function (e.g. Operations, Finance, Tech) or null",
  "location": "city, country or null",
  "remote": true or false,
  "engagement_type": "permanent | contract | temp — infer from the JD (full-time/permanent → permanent, fixed-term/day-rate/freelance → contract, shift/seasonal/short-term cover → temp). Default permanent.",
  "salary_min": number or null (annual, in the currency mentioned),
  "salary_max": number or null,
  "salary_currency": "USD" or detected currency code or null,
  "description": "the job description body, cleaned up: 3-4 paragraphs covering what the role is, why it matters, the team, and what they'll actually do. Stay faithful to the source JD — preserve its specifics and voice, just remove boilerplate (EEO statements, apply instructions, company-wide blurb). Plain text, no markdown.",
  "requirements": "the requirements/must-haves from the JD as a bullet list, one per line, each starting with a dash. Stay faithful to the source — do not invent requirements.",
  "problem_to_solve": "1-2 sentences: what business problem does this role solve? Extract from the JD.",
  "ideal_candidate": "1-2 sentences: what does the ideal candidate look like based on requirements?",
  "team_context": "what team/reporting structure is mentioned, or null",
  "what_success_looks_like": "any KPIs or success criteria mentioned, or null",
  "deal_breakers": "any must-haves or deal-breakers mentioned, or null",
  "growth_path": "any career progression mentioned, or null"
}`

// Defensive JSON extraction — same pattern as cv-parse. Claude occasionally
// wraps in ```json fences or adds prose around the JSON.
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

async function textFromFile(file: File): Promise<{ text?: string; pdfBase64?: string; error?: string }> {
  const name = (file.name || '').toLowerCase()
  const type = file.type || ''

  if (file.size > MAX_FILE_BYTES) return { error: 'File too large (max 5MB)' }

  const isPdf = type === 'application/pdf' || name.endsWith('.pdf')
  const isDocx = type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')
  const isTxt = type === 'text/plain' || name.endsWith('.txt')
  const isLegacyDoc = type === 'application/msword' || name.endsWith('.doc')

  if (isPdf) {
    const bytes = await file.arrayBuffer()
    return { pdfBase64: Buffer.from(bytes).toString('base64') }
  }
  if (isDocx) {
    try {
      const mammoth = (await import('mammoth')).default
      const bytes = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
      const text = (result.value || '').trim()
      if (!text) return { error: 'Could not read any text from that DOCX — try exporting it as PDF' }
      return { text }
    } catch (err) {
      console.error('[roles/parse-jd] DOCX extraction failed:', err)
      return { error: 'Could not read that DOCX — try exporting it as PDF' }
    }
  }
  if (isTxt) {
    const text = (await file.text()).trim()
    if (!text) return { error: 'That file is empty' }
    return { text }
  }
  if (isLegacyDoc) {
    return { error: 'Legacy .doc files aren’t supported — save it as PDF or DOCX and try again' }
  }
  return { error: 'Unsupported file type — upload a PDF, DOCX or TXT' }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Accept multipart (file upload) or JSON (pasted text)
  let jdText: string | null = null
  let pdfBase64: string | null = null

  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }
    const extracted = await textFromFile(file)
    if (extracted.error) return NextResponse.json({ error: extracted.error }, { status: 400 })
    jdText = extracted.text ?? null
    pdfBase64 = extracted.pdfBase64 ?? null
  } else {
    const body = await request.json().catch(() => ({}))
    jdText = typeof body.jd_text === 'string' ? body.jd_text : null
    if (!jdText?.trim()) return NextResponse.json({ error: 'jd_text required' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let response
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      messages: [{
        role: 'user',
        content: pdfBase64
          ? [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
              { type: 'text', text: EXTRACTION_PROMPT(' (attached as a document)') },
            ]
          : `${EXTRACTION_PROMPT('')}

JOB DESCRIPTION:
${(jdText || '').slice(0, 12000)}`,
      }],
    })
  } catch (err) {
    console.error('[roles/parse-jd] Anthropic error:', err)
    return NextResponse.json({ error: 'AI parsing failed — please try again' }, { status: 500 })
  }

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = extractJson(text)
  if (!parsed) return NextResponse.json({ error: 'Could not parse that JD — please try again' }, { status: 500 })

  return NextResponse.json({ parsed })
}
