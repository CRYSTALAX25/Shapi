-- ============================================================================
-- staffing_recommendations.sql — Autonomous Staffing Recommendations
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- Purpose:
--   Proactive AI-generated staffing recommendations Shapi surfaces to companies
--   ("what we'd do next if we ran your team"). Each row is one suggestion the
--   company can mark as 'acted', 'dismissed', or leave 'open'.
--
--   STRATEGY §16 Tier C feature, shipped pre-launch as a standalone tool.
--
--   Inserts run via the service-role admin client from the generate API route
--   (Sonnet returns 2-4 recs at a time). Companies can only read + update
--   their own rows via RLS. Service role bypasses RLS for inserts.
-- ============================================================================

create table if not exists public.staffing_recommendations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references auth.users(id) on delete cascade,
  kind text,            -- 'hire' | 'reskill' | 'freeze' | 'redeploy' | 'restructure'
  title text,           -- one-line headline e.g. "Consider reskilling 2 analysts onto AI-Ops"
  rationale text,       -- 2-3 sentence reasoning
  urgency text,         -- 'now' | 'this quarter' | 'next 6 months'
  variance_driver text, -- what could change this (e.g. "scales with revenue Q4")
  sources text,         -- "Mercer / Shapi platform data / WEF Future of Jobs"
  status text default 'open',  -- 'open' | 'acted' | 'dismissed'
  created_at timestamptz default now()
);

create index if not exists staffing_rec_company_idx
  on public.staffing_recommendations (company_id, status, created_at desc);

alter table public.staffing_recommendations enable row level security;

drop policy if exists "company reads own recs" on public.staffing_recommendations;
create policy "company reads own recs" on public.staffing_recommendations
  for select using (company_id = auth.uid());

drop policy if exists "company updates own recs" on public.staffing_recommendations;
create policy "company updates own recs" on public.staffing_recommendations
  for update using (company_id = auth.uid()) with check (company_id = auth.uid());
