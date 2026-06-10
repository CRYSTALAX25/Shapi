// POST /api/brain/search — Company Brain semantic retrieval (Enterprise).
//
// SECURITY (critical):
//   • Runs under the NORMAL user client (createClient → RLS enforced). We NEVER
//     use the service-role client here — that would bypass the sensitivity RLS
//     and leak manager/private/medical content.
//   • The brain_entries RLS policy ("tier-gated read") already restricts rows:
//     company members see only sensitivity='team'; the company owner sees all.
//   • Belt AND braces: we ALSO explicitly exclude sensitivity='private' in the
//     query, and drop any snippet that smells like medical/PIP/termination
//     content from general queries. So even the owner doesn't get sensitive
//     HR material surfaced in an open semantic search.
//
// RETRIEVAL:
//   • If embeddings exist (OPENAI_API_KEY set): embed the query, fetch the
//     RLS-visible candidate rows that HAVE an embedding, rank by cosine
//     similarity in-process, return the top-k snippets.
//   • If no embeddings (key missing): fall back to ilike keyword match so the
//     feature is fully testable today.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/embeddings'

export const maxDuration = 60

// Content that must never be surfaced in a general semantic query, regardless
// of who is asking. Belt-and-braces on top of sensitivity RLS.
const SENSITIVE_PATTERNS = [
  /\bmedical\b/i,
  /\bdiagnos/i,
  /\bsick leave\b/i,
  /\bdisabilit/i,
  /\bpip\b/i,
  /performance improvement plan/i,
  /\bterminat/i,
  /\bgrievance\b/i,
  /\bdisciplinary\b/i,
  /\bsalary\b/i,
  /\bcompensation\b/i,
]

function looksSensitive(text: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(text))
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function parseVector(raw: unknown): number[] | null {
  // pgvector comes back as a string like "[0.1,0.2,...]" via PostgREST.
  if (Array.isArray(raw)) return raw as number[]
  if (typeof raw === 'string') {
    try {
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? (arr as number[]) : null
    } catch {
      return null
    }
  }
  return null
}

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

type EntryRow = {
  id: string
  content: string
  sensitivity: string
  anchor_seat_id: string | null
  anchor_team_id: string | null
  embedding: unknown
  created_at: string
}

export async function POST(request: Request) {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx

  const body = await request.json().catch(() => ({}))
  const query: string = typeof body.query === 'string' ? body.query.trim() : ''
  const limit: number = Math.min(Math.max(Number(body.limit) || 8, 1), 25)
  const seatId: string | null =
    typeof body.anchor_seat_id === 'string' && body.anchor_seat_id ? body.anchor_seat_id : null

  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  // RLS-scoped base query. We explicitly add company_id (RLS would enforce it
  // too, but this keeps the index hot) and EXCLUDE private entries outright.
  // sensitivity RLS still gates manager-level rows to the owner.
  function baseSelect() {
    let q = supabase
      .from('brain_entries')
      .select('id, content, sensitivity, anchor_seat_id, anchor_team_id, embedding, created_at')
      .eq('company_id', user.id)
      .neq('sensitivity', 'private')
    if (seatId) q = q.eq('anchor_seat_id', seatId)
    return q
  }

  const queryVector = await embedText(query)
  const semantic = queryVector !== null

  let results: Array<{
    id: string
    content: string
    sensitivity: string
    anchor_seat_id: string | null
    anchor_team_id: string | null
    created_at: string
    score: number | null
  }> = []

  if (semantic && queryVector) {
    // VECTOR PATH — fetch RLS-visible embedded rows, rank by cosine in-process.
    // (We avoid a service-role RPC precisely to keep sensitivity RLS in force.)
    const { data, error } = await baseSelect()
      .not('embedding', 'is', null)
      .limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data || []) as EntryRow[]
    results = rows
      .filter((r) => !looksSensitive(r.content))
      .map((r) => {
        const vec = parseVector(r.embedding)
        const score = vec ? cosine(queryVector, vec) : 0
        return {
          id: r.id,
          content: r.content,
          sensitivity: r.sensitivity,
          anchor_seat_id: r.anchor_seat_id,
          anchor_team_id: r.anchor_team_id,
          created_at: r.created_at,
          score,
        }
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit)
  } else {
    // KEYWORD FALLBACK — no embeddings available. ilike over content.
    const { data, error } = await baseSelect()
      .ilike('content', `%${query.replace(/[%_]/g, '')}%`)
      .order('created_at', { ascending: false })
      .limit(limit * 3)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data || []) as EntryRow[]
    results = rows
      .filter((r) => !looksSensitive(r.content))
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        content: r.content,
        sensitivity: r.sensitivity,
        anchor_seat_id: r.anchor_seat_id,
        anchor_team_id: r.anchor_team_id,
        created_at: r.created_at,
        score: null,
      }))
  }

  return NextResponse.json({
    mode: semantic ? 'semantic' : 'keyword',
    embeddings_enabled: semantic,
    count: results.length,
    results,
  })
}
