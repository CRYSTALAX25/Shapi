import type { SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { sendWhatsApp } from '@/lib/whatsapp'

// ─────────────────────────────────────────────────────────────────────────────
// Culture sourcing — Shapi INDEPENDENTLY finds past employees of a company in
// our OWN candidate pool (their CV work_history lists the company, with an end
// date = they've left) and sends the anonymous culture interview. The company
// has zero input — this mirrors how we independently source candidate references.
// Current employees come via the seat-confirmation piggyback, not here.
//
// See memory: project_trust_score_model.
// ─────────────────────────────────────────────────────────────────────────────

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://shapi.io'

// Strip legal suffixes + punctuation so "Acme Group LLC" ≈ "acme".
function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(llc|inc|ltd|limited|co|company|corp|corporation|group|holding|holdings|fz|fze|fzco|wll|est|plc|gmbh|sa|llp)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

type WorkEntry = { company?: string; end?: string; current?: boolean }

// True if this candidate's work history shows a PAST stint at `target`.
export function isPastEmployerMatch(workHistory: unknown, target: string): boolean {
  if (!Array.isArray(workHistory)) return false
  const t = normalizeCompany(target)
  if (t.length < 2) return false
  return (workHistory as WorkEntry[]).some(w => {
    if (!w?.company) return false
    const c = normalizeCompany(w.company)
    if (c.length < 2) return false
    const nameMatch = c === t || c.includes(t) || t.includes(c)
    if (!nameMatch) return false
    // Past = an end value present and not "current/present" and not flagged current.
    const end = (w.end ?? '').toString().toLowerCase().trim()
    return !!end && !['present', 'current', 'now', 'ongoing'].includes(end) && w.current !== true
  })
}

function openingMessage(name: string | null, companyName: string, surveyUrl: string): string {
  const first = (name || '').split(' ')[0] || 'there'
  return (
    `Hi ${first} — this is Shapi, the verified hiring platform.\n\n` +
    `You worked at *${companyName}*, and we build an honest, independent picture of what it's really like to work somewhere — the thing candidates wish they had before accepting an offer.\n\n` +
    `Could you spare ~2 minutes? It's *completely anonymous*: ${companyName} only ever sees the combined averages — never your name, never your individual answers, and never even that you took part. A score only appears once at least 3 people respond.\n\n` +
    `Skip any question or stop anytime:\n${surveyUrl}`
  )
}

// Source one company. Idempotent: a candidate already invited for this company
// (unique index on company_id + candidate_id) is skipped.
export async function sourcePastEmployeesFromPool(
  admin: SupabaseClient,
  companyId: string,
  opts: { limit?: number; poolScan?: number } = {},
): Promise<{ company: string | null; matched: number; invited: number; sent: number }> {
  const limit = opts.limit ?? 50
  const poolScan = opts.poolScan ?? 3000

  const { data: company } = await admin
    .from('profiles')
    .select('company_name, full_name')
    .eq('id', companyId)
    .single()
  const companyName = ((company?.company_name || company?.full_name) as string | undefined) ?? null
  if (!companyName) return { company: null, matched: 0, invited: 0, sent: 0 }

  // Already-sourced candidates (dedupe in JS as well as via the unique index).
  const { data: existing } = await admin
    .from('company_culture_references')
    .select('candidate_id')
    .eq('company_id', companyId)
    .not('candidate_id', 'is', null)
  const already = new Set((existing || []).map(r => r.candidate_id as string))

  // Candidate pool. NOTE: scans candidate profiles; fine at launch scale —
  // optimise with a normalised employer index when the pool is large.
  const { data: candidates } = await admin
    .from('profiles')
    .select('id, full_name, whatsapp_number, work_history')
    .eq('type', 'candidate')
    .not('work_history', 'is', null)
    .limit(poolScan)

  let matched = 0
  let invited = 0
  let sent = 0

  for (const c of candidates || []) {
    const id = c.id as string
    if (already.has(id)) continue
    if (!isPastEmployerMatch(c.work_history, companyName)) continue
    matched++
    if (invited >= limit) continue

    const token = crypto.randomBytes(32).toString('hex')
    const { error } = await admin.from('company_culture_references').insert({
      company_id: companyId,
      token,
      respondent_type: 'past',
      source: 'candidate_pool',
      candidate_id: id,
    })
    if (error) continue // unique-index dedupe or transient — skip
    invited++

    const phone = c.whatsapp_number as string | null
    if (phone) {
      try {
        await sendWhatsApp(phone, openingMessage(c.full_name as string | null, companyName, `${SITE}/culture/${token}`))
        sent++
      } catch (e) {
        console.error('[culture-sourcing] whatsapp send failed', e)
      }
    }
  }

  return { company: companyName, matched, invited, sent }
}
