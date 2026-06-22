-- crosssell_outreach + outreach_suppression = the data layer for the
-- Direction-A "Trojan candidate" cross-sell loop (SPEC_ACTIVE_CROSSSELL.md).
--
-- A candidate imports an external job they're chasing (active_applications) →
-- Shapi enriches the hiring manager (Hunter) → emails them an anonymized,
-- verified candidate teaser for that exact role → the company signs up free to
-- unlock the candidate. One row per (candidate, target company + role) attempt.
--
-- outreach_suppression = the global do-not-contact list (opt-outs, bounces,
-- complaints, manual). Checked before every send.
--
-- Both tables are SERVICE-ROLE-ONLY: RLS is enabled with NO client policies, so
-- all reads/writes go through the admin client (API routes + cron). The
-- candidate sees their own outreach via a scoped admin-backed API, never direct.
--
-- Idempotent — safe to re-run. Paste into the Supabase SQL editor.

create table if not exists public.crosssell_outreach (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users(id) on delete cascade,
  -- the imported external job that triggered this outreach (nullable; the job
  -- row may be deleted later without losing the outreach record)
  active_application_id uuid references public.active_applications(id) on delete set null,
  -- 'A' candidate-led (now) / 'B' company-led (future, see spec §9)
  direction text not null default 'A',
  company_name text not null,
  company_domain text,
  target_role text,
  -- hiring manager — enriched (Hunter) or carried from the posting
  hm_name text,
  hm_email text,
  hm_title text,
  hm_source text,           -- 'hunter' | 'posting' | null
  -- candidate consent gate (set true when the candidate approves the teaser)
  teaser_approved boolean not null default false,
  -- draft | queued | enriching | ready | ready_no_email | sent | opened
  --   | unlocked | declined | bounced | suppressed | failed
  status text not null default 'draft',
  -- the company signup/unlock link token
  unlock_token text not null unique,
  -- the company account that signed up to unlock the candidate
  unlocked_company_id uuid references auth.users(id) on delete set null,
  suppression_reason text,
  sent_at timestamptz,
  opened_at timestamptz,
  unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dedupe re-imports of the same job: one live outreach per
-- (candidate, target company domain, role).
create unique index if not exists crosssell_outreach_dedupe_idx
  on public.crosssell_outreach (candidate_id, company_domain, target_role);

create index if not exists crosssell_outreach_status_idx
  on public.crosssell_outreach (status, created_at);

create index if not exists crosssell_outreach_candidate_idx
  on public.crosssell_outreach (candidate_id, created_at desc);

create table if not exists public.outreach_suppression (
  id uuid primary key default gen_random_uuid(),
  value text not null,          -- an email or a domain
  scope text not null,          -- 'email' | 'domain'
  reason text,                  -- 'unsubscribe' | 'bounce' | 'complaint' | 'manual'
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness per scope.
create unique index if not exists outreach_suppression_scope_value_idx
  on public.outreach_suppression (scope, lower(value));

-- ── RLS — service-role only (no client policies) ────────────────────────────
alter table public.crosssell_outreach enable row level security;
alter table public.outreach_suppression enable row level security;

-- ── keep crosssell_outreach.updated_at fresh ────────────────────────────────
create or replace function set_crosssell_outreach_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists crosssell_outreach_updated_at on public.crosssell_outreach;
create trigger crosssell_outreach_updated_at before update on public.crosssell_outreach
  for each row execute procedure set_crosssell_outreach_updated_at();
