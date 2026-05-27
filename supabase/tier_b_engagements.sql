-- Tier B Engagements — 5-year Workforce Plan Workspace
--
-- Purpose: a multi-step paid engagement workspace for the Tier B ($25k-$100k)
-- "Engagement" product described in STRATEGY §16. Each company gets ONE
-- engagement row that walks through 4 wizard steps:
--   1. Operating model diagnostic (per business unit, target state, transitions)
--   2. Org DNA mapping (culture, leadership, risk, innovation, collab maturity)
--   3. 5-year workforce + AI plan (Y1/Y3/Y5 scenarios, cost trajectory,
--      5-way Replace/Augment/Reskill/Redeploy/Protect counts)
--   4. Execution playbook (comms drafts, compliance, outplacement, hiring, 90-day milestones)
--
-- Reuses the Workforce Intelligence engines (Workforce Snapshot, Hiring Roadmap,
-- Salary Benchmark, etc.) listed in STRATEGY §16. Supersedes the one-shot
-- Workforce Snapshot product for paying engagement clients — the Snapshot becomes
-- the first hour of the engagement, not the whole deliverable.
--
-- Idempotent — safe to re-run.

create table if not exists public.tier_b_engagements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references auth.users(id) on delete cascade,
  step int not null default 1,        -- 1..4 (current step in the wizard)
  operating_model_diagnostic jsonb,   -- { perBU: [{bu, model, target_model, why}], misalignments: [...] }
  org_dna jsonb,                       -- { culture, leadership_style, risk_tolerance, innovation_appetite, collaboration_maturity }
  workforce_plan jsonb,                -- { y1, y3, y5: {scenarios, cost_trajectory, replace_augment_reskill_redeploy_protect_counts} }
  execution_playbook jsonb,            -- { comms_drafts, compliance_notes, outplacement_plan, hiring_plan, milestones }
  audit_trail jsonb default '[]',      -- [{ts, who, what}]  — decision log
  status text default 'in_progress',  -- in_progress | locked | annual_refresh_due
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tier_b_company_idx on public.tier_b_engagements (company_id);

alter table public.tier_b_engagements enable row level security;

drop policy if exists "company manages own engagement" on public.tier_b_engagements;
create policy "company manages own engagement" on public.tier_b_engagements
  using (company_id = auth.uid()) with check (company_id = auth.uid());
