// POST /api/brain/ingest — Company Brain ingestion (Enterprise feature).
//
// Accepts a text chunk (dashboard paste / file text for now). Creates one
// brain_source row + one brain_entry row, anchored optionally to a seat
// (Seat Inheritance Playbook). Embeds the chunk via OpenAI when OPENAI_API_KEY
// is present; otherwise stores the row WITHOUT an embedding (status stays
// 'pending' / needs_embedding) and logs a warning — the feature degrades
// gracefully and is testable today.
//
// SECURITY: writes run under the normal RLS client (createClient). company_id
// is stamped from auth.uid() — never trusted from the request body.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { embedText, toVectorLiteral, EMBEDDING_DIMS } from '@/lib/embeddings'

export const maxDuration = 60

const SENSITIVITIES = ['team', 'manager', 'private'] as const
type Sensitivity = (typeof SENSITIVITIES)[number]

async function requireCompany() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', user.id)
    .single()
  if (!profile || profile.type !== 'company') {
    return { error: NextResponse.json({ error: 'Company account required' }, { status: 403 }) }
  }
  return { supabase, user }
}

export async function POST(request: Request) {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx

  const body = await request.json().catch(() => ({}))
  const content: string = typeof body.content === 'string' ? body.content.trim() : ''
  const sourceName: string =
    typeof body.source_name === 'string' && body.source_name.trim()
      ? body.source_name.trim()
      : 'Pasted note'
  const rawSensitivity: string = typeof body.sensitivity === 'string' ? body.sensitivity : 'team'
  const sensitivity: Sensitivity = (SENSITIVITIES as readonly string[]).includes(rawSensitivity)
    ? (rawSensitivity as Sensitivity)
    : 'team'
  const anchorSeatId: string | null =
    typeof body.anchor_seat_id === 'string' && body.anchor_seat_id ? body.anchor_seat_id : null
  const anchorTeamId: string | null =
    typeof body.anchor_team_id === 'string' && body.anchor_team_id ? body.anchor_team_id : null
  const sourceType: string = typeof body.source_type === 'string' ? body.source_type : 'manual_note'

  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  if (content.length > 50000) {
    return NextResponse.json({ error: 'content too large (max 50k chars per chunk)' }, { status: 400 })
  }

  // Validate the seat anchor belongs to this company (defence in depth — RLS on
  // brain_entries would reject a cross-company FK on write anyway, but a clear
  // 400 is friendlier than an opaque constraint error).
  if (anchorSeatId) {
    const { data: seat } = await supabase
      .from('roles_seats')
      .select('id, team_id')
      .eq('id', anchorSeatId)
      .eq('company_id', user.id)
      .maybeSingle()
    if (!seat) {
      return NextResponse.json({ error: 'anchor_seat_id not found for this company' }, { status: 400 })
    }
  }

  // 1) Create the source row (provenance).
  const { data: source, error: srcErr } = await supabase
    .from('brain_sources')
    .insert({
      company_id: user.id,
      source_type: sourceType,
      source_name: sourceName,
      sensitivity,
      uploaded_by_user_id: user.id,
      default_anchor_seat_id: anchorSeatId,
      default_anchor_team_id: anchorTeamId,
      status: 'processing',
    })
    .select()
    .single()

  if (srcErr || !source) {
    return NextResponse.json({ error: srcErr?.message || 'Failed to create source' }, { status: 500 })
  }

  // 2) Embed (graceful: null when key missing or call fails).
  const vector = await embedText(content)
  const embedded = vector !== null
  const vectorLiteral = toVectorLiteral(vector)

  // 3) Insert the entry. Store the embedding when we have one; otherwise leave
  //    it null and keep the source 'pending' so a future backfill can find it.
  const { data: entry, error: entryErr } = await supabase
    .from('brain_entries')
    .insert({
      company_id: user.id,
      source_id: source.id,
      anchor_seat_id: anchorSeatId,
      anchor_team_id: anchorTeamId,
      content,
      embedding: vectorLiteral,
      sensitivity,
      chunk_index: 0,
      token_count: Math.ceil(content.length / 4),
    })
    .select('id, content, sensitivity, anchor_seat_id, created_at')
    .single()

  if (entryErr || !entry) {
    // Roll back the orphaned source so we don't leave half-ingested rows.
    await supabase.from('brain_sources').delete().eq('id', source.id).eq('company_id', user.id)
    return NextResponse.json({ error: entryErr?.message || 'Failed to create entry' }, { status: 500 })
  }

  // 4) Mark source lifecycle. 'embedded' when we have a vector, else stay
  //    'pending' (needs an embedding backfill once the key is added).
  await supabase
    .from('brain_sources')
    .update({
      status: embedded ? 'embedded' : 'pending',
      processed_at: embedded ? new Date().toISOString() : null,
      ingestion_error: embedded ? null : 'OPENAI_API_KEY missing — stored without embedding',
    })
    .eq('id', source.id)
    .eq('company_id', user.id)

  if (!embedded) {
    console.warn(
      `[brain/ingest] Entry ${entry.id} stored WITHOUT embedding (key missing or embed failed). ` +
      `It will be searchable via keyword fallback and can be backfilled once OPENAI_API_KEY is set.`
    )
  }

  return NextResponse.json({
    ok: true,
    embedded,
    dims: embedded ? EMBEDDING_DIMS : 0,
    source_id: source.id,
    entry,
  })
}
