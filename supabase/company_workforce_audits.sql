-- ============================================================================
-- company_workforce_audits.sql — Tier A Workforce Snapshot reports (STRATEGY §16)
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- Every Workforce Snapshot a company runs (signed-in OR anonymous prospect)
-- is logged here. Drives:
--   1. Follow-up flow: prospects who scored low → outreach for Tier B engagement
--   2. Aggregate insights: industry-level readiness benchmarks (Phase 2)
--   3. Ana's sales dashboard: who audited, what they got, who's primed to buy
--
-- L1 data only — anonymised role counts, no names, no exact salaries.
-- ============================================================================

create table if not exists public.company_workforce_audits (
  id uuid primary key default gen_random_uuid(),
  -- null when an anonymous prospect runs the audit before signing up
  company_id uuid references auth.users(id) on delete set null,
  -- Inputs
  industry text,
  company_size text,
  country text,
  ai_maturity text,          -- experimenting | piloting | scaling | mature
  operating_model text,      -- centralised | decentralised | agile-pod | skills-marketplace | hybrid-ai | outcome-based | hybrid
  roles_input jsonb,         -- [{ role, dept?, count? }] — anonymised role counts
  use_cases jsonb,           -- ["..."] short text use cases under consideration
  -- Outputs
  readiness_score integer,   -- 0-100 headline metric
  report jsonb,              -- full structured report
  -- Telemetry
  source text default 'web', -- 'web' | 'whatsapp' | 'api' for future channels
  created_at timestamptz not null default now()
);

create index if not exists company_workforce_audits_company_idx
  on public.company_workforce_audits (company_id, created_at desc);
create index if not exists company_workforce_audits_score_idx
  on public.company_workforce_audits (readiness_score);
create index if not exists company_workforce_audits_created_idx
  on public.company_workforce_audits (created_at desc);

alter table public.company_workforce_audits enable row level security;

-- Signed-in companies can read THEIR OWN audits.
drop policy if exists "company reads own audits" on public.company_workforce_audits;
create policy "company reads own audits" on public.company_workforce_audits
  for select using (company_id = auth.uid());

-- Inserts run via the service-role admin client from the API route, so we
-- don't need a candidate-side insert policy. Service role bypasses RLS anyway.
