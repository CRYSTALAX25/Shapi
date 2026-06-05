import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Vercel Pro plan: Claude column-mapping + structuring of a ~200-row CSV
// usually finishes inside 30s but cold starts + large headers can push us
// past the 60s default. 120s is comfortable.
export const maxDuration = 120

// POST /api/company/spine/import-csv
//
// Body: { csv_text: string }     — raw CSV content the user pasted/uploaded
//
// Returns: {
//   rows: [{ full_name, email?, role_title, team_name, location_name?,
//            manager_email?, seniority? }],
//   detected_columns: string[],
//   row_count: number,
//   notes?: string                — Claude's confidence notes
// }
//
// This endpoint ONLY parses + previews. The user reviews the preview, then
// the separate /api/company/spine/import-commit endpoint persists.
//
// Free-tier guard: profiles.upload_and_map_count >= 1 → blocked. Pro and
// Enterprise are uncapped. We count parses, not commits, so users can't
// burn budget by uploading variations endlessly.

const MAX_CSV_BYTES = 200_000        // ~200KB cap, more than enough for ~500 rows
const MAX_ROWS = 200                  // cap to keep Claude under context

type ParsedRow = {
  full_name: string
  email?: string
  role_title: string
  team_name: string
  location_name?: string
  manager_email?: string
  seniority?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('type, plan_tier, upload_and_map_count')
      .eq('id', user.id)
      .single()
    if (!profile || profile.type !== 'company') {
      return NextResponse.json({ error: 'Company account required' }, { status: 403 })
    }

    const planTier = (profile as { plan_tier?: string | null }).plan_tier || 'free'
    const usedCount = (profile as { upload_and_map_count?: number | null }).upload_and_map_count || 0
    if (planTier === 'free' && usedCount >= 1) {
      return NextResponse.json({
        error: 'free_tier_upload_limit_exceeded',
        message: 'Free tier allows one upload-and-map. Upgrade to Pro for unlimited.',
      }, { status: 402 })
    }

    const body = await request.json().catch(() => ({}))
    const csvText = String(body?.csv_text || '').trim()
    if (!csvText) return NextResponse.json({ error: 'csv_text required' }, { status: 400 })
    if (csvText.length > MAX_CSV_BYTES) {
      return NextResponse.json({
        error: 'csv_too_large',
        message: `CSV is too large — keep it under ~${Math.round(MAX_CSV_BYTES / 1000)}KB or split it into multiple uploads.`,
      }, { status: 413 })
    }

    // Truncate to MAX_ROWS rows + 1 header to keep Claude prompt manageable.
    // Real users with >200 employees can upload in chunks for now; a follow-up
    // can stream/chunk this server-side.
    const lines = csvText.split(/\r?\n/).filter(l => l.trim())
    const truncated = lines.length > MAX_ROWS + 1
    const csvForClaude = truncated ? lines.slice(0, MAX_ROWS + 1).join('\n') : csvText

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: `You are parsing a company's employee export CSV for an HR platform. Your job is to detect the column meanings and emit a clean JSON array of employees.

CSV INPUT:
\`\`\`
${csvForClaude}
\`\`\`

INSTRUCTIONS:
1. Detect which CSV columns map to: full_name, email, role_title, team_name, location_name, manager_email, seniority. Headers vary wildly — be flexible (e.g. "Name" / "Full Name" / "Employee Name" all map to full_name; "Title" / "Position" / "Role" / "Job Title" all map to role_title).
2. Skip blank rows and rows that look like a header repeat or a section divider.
3. Normalize whitespace and trim values.
4. If seniority can be inferred from the title (e.g. "Senior Backend Engineer" → "senior", "Engineering Manager" → "manager"), set it. Otherwise leave undefined.
5. team_name + location_name should be exactly as the company uses them — don't translate or rename.
6. If a row is missing a required field (full_name or role_title), skip it but note it in confidence_notes.

Return ONLY valid JSON in this exact shape, no commentary:
{
  "detected_columns": ["the column headers you used"],
  "row_count": N,
  "skipped_count": N,
  "notes": "Optional short note about what was tricky / skipped",
  "rows": [
    {
      "full_name": "Ahmed Al-Saud",
      "email": "ahmed@example.com",
      "role_title": "Senior Backend Engineer",
      "team_name": "Backend",
      "location_name": "Riyadh HQ",
      "manager_email": "manager@example.com",
      "seniority": "senior"
    }
  ]
}`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[import-csv] Claude returned no JSON:', text.slice(0, 500))
      return NextResponse.json({ error: 'Could not parse the CSV. Try the downloadable template format.' }, { status: 422 })
    }

    let parsed: {
      detected_columns?: string[]
      row_count?: number
      skipped_count?: number
      notes?: string
      rows?: ParsedRow[]
    } = {}
    try {
      parsed = JSON.parse(match[0])
    } catch (err) {
      console.error('[import-csv] JSON parse failed:', err)
      return NextResponse.json({ error: 'Parser returned malformed JSON. Try again.' }, { status: 422 })
    }

    const rows = Array.isArray(parsed.rows) ? parsed.rows : []
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No employee rows detected in the CSV. Check the format.' }, { status: 422 })
    }

    // Bump the upload-and-map count NOW so a free-tier user can't repeatedly
    // re-parse to dodge the cap. The commit endpoint runs against the same
    // user and just creates the entities.
    if (planTier === 'free') {
      await supabase
        .from('profiles')
        .update({ upload_and_map_count: usedCount + 1 })
        .eq('id', user.id)
    }

    return NextResponse.json({
      rows,
      detected_columns: parsed.detected_columns || [],
      row_count: rows.length,
      skipped_count: parsed.skipped_count || 0,
      notes: parsed.notes || (truncated ? `Imported the first ${MAX_ROWS} rows; the file had more — upload the rest as a second batch.` : undefined),
    })
  } catch (err) {
    console.error('[import-csv] Unhandled error:', err)
    return NextResponse.json({
      error: 'parse_failed',
      message: err instanceof Error ? err.message : String(err),
    }, { status: 200 })
  }
}
