-- ============================================================================
-- workforce_os_alerts.sql — Tier C Workforce OS drift alerts (STRATEGY §16)
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- The Workforce OS is the continuous-monitoring tier that sits on top of the
-- one-shot Workforce Snapshot. It watches a company's readiness score and
-- platform activity over time, and fires an alert when something drifts:
--   - readiness_drop          → headline score fell vs the prior snapshot
--   - team_overload           → interview / role load spiked beyond capacity
--   - attrition_risk          → talent flight signal from candidate activity
--   - ai_displacement_signal  → market shift exposes a role faster than planned
--   - cost_overrun            → AI integration cost band breached
--
-- In Phase 3 a Vercel cron job will compute these from
-- company_workforce_audits + staffing_recommendations + interviews and INSERT
-- via the service role (which bypasses RLS). For tonight the table just
-- backs the Workforce OS dashboard scaffold so the value is visible.
--
-- 70%-confidence reads only. Each alert names a metric_before/metric_after
-- delta and a human-readable detail so the company can act, not just notice.
-- ============================================================================

create table if not exists public.workforce_os_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references auth.users(id) on delete cascade,
  kind text,                          -- 'readiness_drop' | 'team_overload' | 'attrition_risk' | 'ai_displacement_signal' | 'cost_overrun'
  severity text,                      -- 'info' | 'warning' | 'critical'
  title text,
  detail text,
  metric_before numeric,
  metric_after numeric,
  status text default 'open',         -- 'open' | 'acked' | 'resolved'
  triggered_at timestamptz default now(),
  acked_at timestamptz,
  resolved_at timestamptz
);

create index if not exists wf_os_alerts_company_idx on public.workforce_os_alerts (company_id, status, triggered_at desc);

alter table public.workforce_os_alerts enable row level security;

drop policy if exists "company manages own alerts" on public.workforce_os_alerts;
create policy "company manages own alerts" on public.workforce_os_alerts
  using (company_id = auth.uid()) with check (company_id = auth.uid());
