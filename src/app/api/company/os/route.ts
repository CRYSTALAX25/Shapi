// Workforce OS — Tier C live monitoring feed (STRATEGY §16).
//
// GET /api/company/os
// Returns the data needed to render the Workforce OS dashboard:
//   - current_score:   most recent Workforce Snapshot readiness score
//   - score_trend:     last 5 snapshot scores (oldest → newest) for the sparkline
//   - alerts:          all open drift alerts, severity-ordered then newest-first
//   - counts:          live counts strip — open staffing recs, interviews this
//                      week, candidates_active (distinct candidates in this
//                      company's pipeline with stage != rejected/withdrawn)
//   - hris_connected:  always false for now — Workday / BambooHR / Personio /
//                      Rippling integrations land with the enterprise beta.
//
// Auth: signed-in company account only.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

type AuditRow = { readiness_score: number | null; created_at: string }
type AlertRow = {
  id: string
  kind: string | null
  severity: string | null
  title: string | null
  detail: string | null
  metric_before: number | null
  metric_after: number | null
  status: string | null
  triggered_at: string
  acked_at: string | null
  resolved_at: string | null
}

function sortAlerts(rows: AlertRow[]): AlertRow[] {
  return [...rows].sort((a, b) => {
    const sa = SEVERITY_RANK[(a.severity || '').toLowerCase()] ?? 99
    const sb = SEVERITY_RANK[(b.severity || '').toLowerCase()] ?? 99
    if (sa !== sb) return sa - sb
    return (b.triggered_at || '').localeCompare(a.triggered_at || '')
  })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (profile.type !== 'company') {
    return NextResponse.json({ error: 'Company accounts only' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Last 5 Workforce Snapshot scores — DESC from the DB, then we reverse so the
  // sparkline reads left→right oldest→newest.
  const { data: auditsData } = await admin
    .from('company_workforce_audits')
    .select('readiness_score, created_at')
    .eq('company_id', user.id)
    .not('readiness_score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5)

  const auditsDesc = (auditsData || []) as AuditRow[]
  const scoreTrend = [...auditsDesc].reverse().map(a => ({
    score: a.readiness_score as number,
    when: a.created_at,
  }))
  const currentScore = auditsDesc.length > 0 ? (auditsDesc[0].readiness_score as number) : null

  // Open drift alerts — RLS scopes to this company, but we keep the explicit
  // company_id filter so the query plan stays tight.
  const { data: alertsData, error: alertsErr } = await supabase
    .from('workforce_os_alerts')
    .select('id, kind, severity, title, detail, metric_before, metric_after, status, triggered_at, acked_at, resolved_at')
    .eq('company_id', user.id)
    .eq('status', 'open')
    .order('triggered_at', { ascending: false })
    .limit(50)

  if (alertsErr) {
    // Table may not exist yet on an env that hasn't run the migration —
    // soft-fail so the page still renders the score + counts.
    console.warn('[company/os GET] alerts query failed:', alertsErr.message)
  }
  const alerts = sortAlerts((alertsData || []) as AlertRow[])

  // ── Live counts strip ──────────────────────────────────────────────────
  const nowIso = new Date().toISOString()
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const [staffingRecsRes, interviewsRes, applicationsRes] = await Promise.all([
    admin
      .from('staffing_recommendations')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.id)
      .eq('status', 'open'),
    admin
      .from('interviews')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.id)
      .eq('status', 'scheduled')
      .gte('scheduled_at', nowIso)
      .lte('scheduled_at', sevenDaysFromNow),
    admin
      .from('applications')
      .select('candidate_id, stage')
      .eq('company_id', user.id),
  ])

  const staffingRecsOpen = staffingRecsRes.count ?? 0
  const interviewsWeek = interviewsRes.count ?? 0

  const apps = (applicationsRes.data || []) as Array<{ candidate_id: string | null; stage: string | null }>
  const activeStages = new Set([null, 'applied', 'shortlisted', 'interview', 'offer'])
  const activeCandidateIds = new Set(
    apps
      .filter(a => activeStages.has(a.stage))
      .map(a => a.candidate_id)
      .filter((id): id is string => !!id)
  )
  const candidatesActive = activeCandidateIds.size

  return NextResponse.json({
    success: true,
    current_score: currentScore,
    score_trend: scoreTrend,
    alerts,
    counts: {
      staffing_recs: staffingRecsOpen,
      interviews_week: interviewsWeek,
      candidates_active: candidatesActive,
    },
    hris_connected: false,
  })
}
