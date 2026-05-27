// Autonomous Staffing Recommendations — proactive AI suggestions for the
// company ("what we'd do next if we ran your team"). STRATEGY §16 Tier C,
// shipped pre-launch as a standalone tool.
//
// GET  — returns the company's open recommendations, sorted by urgency
//        ('now' > 'this quarter' > 'next 6 months'), then created_at desc.
// POST — generates 2-4 fresh recommendations via Claude Sonnet + persists
//        them to public.staffing_recommendations for the authed company.
//
// Auth: signed-in company account only.

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const URGENCY_RANK: Record<string, number> = {
  'now': 0,
  'this quarter': 1,
  'next 6 months': 2,
}

type RecRow = {
  id: string
  company_id: string | null
  kind: string | null
  title: string | null
  rationale: string | null
  urgency: string | null
  variance_driver: string | null
  sources: string | null
  status: string | null
  created_at: string
}

function sortByUrgency(rows: RecRow[]): RecRow[] {
  return [...rows].sort((a, b) => {
    const ra = URGENCY_RANK[(a.urgency || '').toLowerCase()] ?? 99
    const rb = URGENCY_RANK[(b.urgency || '').toLowerCase()] ?? 99
    if (ra !== rb) return ra - rb
    // newer first inside same urgency bucket
    return (b.created_at || '').localeCompare(a.created_at || '')
  })
}

async function requireCompany() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles')
    .select('type, company_name, industry, company_data, location, headline, summary')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }
  if (profile.type !== 'company') {
    return { error: NextResponse.json({ error: 'Company accounts only' }, { status: 403 }) }
  }
  return { supabase, user, profile }
}

export async function GET() {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx

  const { data, error } = await supabase
    .from('staffing_recommendations')
    .select('id, company_id, kind, title, rationale, urgency, variance_driver, sources, status, created_at')
    .eq('company_id', user.id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[staffing-recommendations GET] error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const recommendations = sortByUrgency((data || []) as RecRow[])
  return NextResponse.json({ success: true, recommendations })
}

export async function POST(request: Request) {
  const ctx = await requireCompany()
  if ('error' in ctx) return ctx.error
  const { supabase, user, profile } = ctx

  const body = await request.json().catch(() => ({}))
  const teamComposition: string = typeof body?.team_composition === 'string'
    ? body.team_composition.trim().slice(0, 1000)
    : ''

  // Pull open roles for grounded context. Defensive — table may not exist
  // on every env, so we soft-fail and continue without roles.
  let roles: Array<{ title?: string; description?: string; status?: string }> = []
  try {
    const { data: rolesData } = await supabase
      .from('roles')
      .select('title, description, status')
      .eq('company_id', user.id)
      .limit(20)
    if (Array.isArray(rolesData)) roles = rolesData
  } catch {
    // optional
  }

  const companyData = (profile.company_data as Record<string, unknown> | null) || {}
  const headcount = companyData.headcount || companyData.team_size || companyData.size || null
  const stage = companyData.stage || companyData.funding_stage || null
  const hq = companyData.hq || companyData.headquarters || profile.location || null

  const openRoles = roles.filter(r => r.status === 'active' || !r.status)
  const openRolesBlock = openRoles.length
    ? openRoles.map((r, i) => `${i + 1}. ${r.title || 'untitled'}${r.description ? ` — ${String(r.description).slice(0, 180)}` : ''}`).join('\n')
    : 'None posted on Shapi yet.'
  const teamBlock = teamComposition
    ? teamComposition
    : 'Not provided — work from open roles + industry signals only, and name the variance driver explicitly (e.g. "scales with team makeup we don\'t yet have").'

  const prompt = `You are Shapi's autonomous staffing strategist. Generate 2-4 PROACTIVE recommendations the company should consider acting on right now. Think of yourself as a chief-of-staff who reads the market daily and writes the company a short briefing.

═══ COMPANY ═══
Name: ${profile.company_name || 'not provided'}
Industry: ${profile.industry || 'not provided'}
HQ / location: ${hq || 'not provided'}
Headcount signal: ${headcount || 'unknown — infer from industry/stage'}
Stage signal: ${stage || 'unknown — infer from industry/headcount'}
Headline: ${profile.headline || 'not provided'}
Summary: ${(profile.summary as string) || 'not provided'}

═══ TEAM THEY ALREADY HAVE (from the company directly) ═══
${teamBlock}

═══ ROLES STILL OPEN ON SHAPI (already being hired — do NOT re-recommend) ═══
${openRolesBlock}

═══ VOICE (STRICT) ═══
Speak with sourced confidence. NEVER use the words "indicative", "approximate" (as a hedge), or "rough". Use 70%-confidence bands and name variance drivers. Synthesise from Mercer salary data + Anthropic/OpenAI published API pricing + WEF Future of Jobs + Shapi platform data.

═══ OUTPUT ═══
Return EXACTLY 2-4 recommendations. Each recommendation must be specific to THIS company (industry, stage, team). Generic = useless.

Each recommendation:
  - kind: one of "hire" | "reskill" | "freeze" | "redeploy" | "restructure"
  - title: one-line headline, max 14 words (e.g. "Reskill 2 analysts onto AI-Ops before Q3 budgeting")
  - rationale: 2-3 sentences explaining WHY now, grounded in their team + market shifts. Cite sourced numbers where they sharpen the case (Mercer band, WEF projection, published API pricing). Max 60 words.
  - urgency: one of "now" | "this quarter" | "next 6 months"
  - variance_driver: 1 short phrase naming what could change this (e.g. "scales with revenue Q4", "depends on Series A timing", "shifts if Claude/GPT API pricing halves again").
  - sources: short slash-joined string, e.g. "Mercer / Shapi platform data / WEF Future of Jobs / Anthropic published API pricing".

Return ONLY valid JSON in this exact shape:
{
  "recommendations": [
    {
      "kind": "hire|reskill|freeze|redeploy|restructure",
      "title": "...",
      "rationale": "...",
      "urgency": "now|this quarter|next 6 months",
      "variance_driver": "...",
      "sources": "..."
    }
  ]
}

Be specific. Be sourced. Name variance drivers instead of using hedge-words.`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let parsed: { recommendations?: unknown }
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[staffing-recommendations POST] no JSON in response')
      return NextResponse.json({ error: 'Could not parse recommendations' }, { status: 500 })
    }
    try {
      parsed = JSON.parse(match[0])
    } catch (e) {
      console.error('[staffing-recommendations POST] JSON parse error:', e)
      return NextResponse.json({ error: 'Response was malformed — try again.' }, { status: 500 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[staffing-recommendations POST] anthropic error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const list = Array.isArray(parsed.recommendations) ? parsed.recommendations : []
  if (list.length === 0) {
    return NextResponse.json({ error: 'No recommendations generated — try again.' }, { status: 500 })
  }

  type RawRec = {
    kind?: unknown
    title?: unknown
    rationale?: unknown
    urgency?: unknown
    variance_driver?: unknown
    sources?: unknown
  }

  const VALID_KINDS = new Set(['hire', 'reskill', 'freeze', 'redeploy', 'restructure'])
  const VALID_URGENCY = new Set(['now', 'this quarter', 'next 6 months'])

  const rowsToInsert = list.slice(0, 4).map((r: RawRec) => {
    const kindRaw = String(r.kind || '').toLowerCase().trim()
    const urgencyRaw = String(r.urgency || '').toLowerCase().trim()
    return {
      company_id: user.id,
      kind: VALID_KINDS.has(kindRaw) ? kindRaw : 'hire',
      title: String(r.title || '').slice(0, 280),
      rationale: String(r.rationale || '').slice(0, 1200),
      urgency: VALID_URGENCY.has(urgencyRaw) ? urgencyRaw : 'this quarter',
      variance_driver: String(r.variance_driver || '').slice(0, 280),
      sources: String(r.sources || '').slice(0, 280),
      status: 'open',
    }
  }).filter(r => r.title.length > 0)

  if (rowsToInsert.length === 0) {
    return NextResponse.json({ error: 'No valid recommendations to save — try again.' }, { status: 500 })
  }

  // Use service-role admin client so inserts bypass RLS (no insert policy
  // on the table — only the API route writes here).
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: inserted, error: insertError } = await admin
    .from('staffing_recommendations')
    .insert(rowsToInsert)
    .select('id, company_id, kind, title, rationale, urgency, variance_driver, sources, status, created_at')

  if (insertError) {
    console.error('[staffing-recommendations POST] insert error:', insertError.message)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const recommendations = sortByUrgency((inserted || []) as RecRow[])
  return NextResponse.json({ success: true, recommendations })
}
