import { getAnthropic } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Conversational company onboarding — mirrors /api/cv-builder. A short Claude
// interview (~5–8 turns) that collects the same fields the static form wrote:
//   company_name, company_size, industry, location (HQ), summary (what they do),
//   company_website, whatsapp_number.
// Returns { reply, ready, extracted }. When the interview is complete, Claude
// emits the [COMPANY_READY] sentinel and a JSON block we parse into `extracted`.
// The client persists those fields via /api/profile/update (same as the form).

// Normalise free-text size into one of the form's six buckets, so the chat and
// the manual form write IDENTICAL company_size values. Mirrors the form's
// normalizeSize() + SIZE_MATCH map. Falls back to the raw value if no match.
const SIZE_BUCKETS = ['1–10', '11–50', '51–200', '201–500', '500–2000', '2000+']
const SIZE_MATCH: Record<string, string> = {
  '1-10': '1–10', '1-50': '11–50', '11-50': '11–50',
  '51-200': '51–200', '201-500': '201–500', '500-1000': '500–2000',
  '500-2000': '500–2000', '1000-5000': '500–2000', '2000+': '2000+',
  '5000+': '2000+', '10000+': '2000+',
}
function normalizeSize(raw: unknown): string | null {
  if (!raw) return null
  const s = String(raw).toLowerCase().replace(/[\s,]/g, '').replace(/–/g, '-')
  if (SIZE_MATCH[s]) return SIZE_MATCH[s]
  // already a valid bucket? (e.g. "51–200")
  const direct = SIZE_BUCKETS.find(b => b.toLowerCase().replace(/–/g, '-') === s)
  return direct || null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages } = await request.json()

  const anthropic = getAnthropic()

  const systemPrompt = `You are Shapi's company onboarding assistant. Your job is to set up a company's profile through a short, friendly conversation — not a form.

Shapi is a verified job-matching platform. Candidates see independent public signals (Glassdoor, Reddit, news) alongside what a company writes, so be warm and direct — you're helping them tell their story, the verification floor is handled elsewhere.

You ask ONE focused question at a time. Keep it human and brief. You need to collect these seven things:
1. Company name
2. Company website (optional but ask once — they can say "skip")
3. Industry / sector (e.g. healthcare, fintech, logistics)
4. Headquarters location (city, country)
5. Company size (how many people work there)
6. A short description of what the company does and what makes it a great place to work (their "about")
7. WhatsApp number (most of Shapi runs through WhatsApp — say it's strongly recommended; they can skip)

Rules:
- Ask one question at a time. You can confirm + group naturally (e.g. acknowledge the answer, then ask the next thing).
- Aim for about 5–8 short turns total. Don't drag it out.
- Be conversational, not a checklist robot. Acknowledge what they say before moving on.
- For website and WhatsApp, it's fine if they decline — just move on.
- Keep each response short: max 2–3 sentences plus your question.
- Never use corporate jargon.
- For company size, you can ask "roughly how many people?" — you'll bucket it later, don't make them pick from a list.

When you have collected ENOUGH (at minimum: company name, industry, location, size, and a description — website and WhatsApp are nice-to-have), do BOTH of these in your FINAL message:
1. Write a warm one-line wrap-up confirming you've got what you need.
2. On new lines after that, output the sentinel token [COMPANY_READY] followed by a single JSON object with the collected fields, using EXACTLY these keys (omit a key only if truly not provided):

[COMPANY_READY]
{"company_name": "...", "company_website": "...", "industry": "...", "location": "...", "company_size": "...", "summary": "...", "whatsapp_number": "..."}

- company_size: give the raw answer they told you (e.g. "about 120 people" or "11-50") — it'll be normalised later.
- whatsapp_number / company_website: include the full value if given, otherwise omit the key.
- Do NOT output the JSON or [COMPANY_READY] until you genuinely have the required fields. Never show the JSON earlier in the conversation.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const rawReply = response.content[0].type === 'text' ? response.content[0].text : ''
  const ready = rawReply.includes('[COMPANY_READY]')

  // Parse the structured fields out of the JSON block that follows the sentinel.
  // Best-effort: if parsing fails we still return ready=true so the client can
  // fall back to its own collected state — but normally Claude emits clean JSON.
  let extracted: Record<string, unknown> | null = null
  if (ready) {
    const afterToken = rawReply.split('[COMPANY_READY]')[1] || ''
    const match = afterToken.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>
        const size = normalizeSize(parsed.company_size)
        extracted = {
          company_name: parsed.company_name ? String(parsed.company_name).trim() : null,
          company_website: parsed.company_website ? String(parsed.company_website).trim() : null,
          industry: parsed.industry ? String(parsed.industry).trim() : null,
          location: parsed.location ? String(parsed.location).trim() : null,
          company_size: size,
          summary: parsed.summary ? String(parsed.summary).trim() : null,
          whatsapp_number: parsed.whatsapp_number ? String(parsed.whatsapp_number).trim() : null,
        }
      } catch {
        extracted = null
      }
    }
  }

  // Strip the sentinel + JSON block from the user-visible reply so the chat
  // bubble only shows the friendly wrap-up line.
  const reply = rawReply.split('[COMPANY_READY]')[0].trim()

  return NextResponse.json({ reply, ready, extracted })
}
