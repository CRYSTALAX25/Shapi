-- ─────────────────────────────────────────────────────────────────────────────
-- company_culture_references
--
-- PURPOSE
-- Anonymous, aggregated past/current employee vouching on a company's
-- culture: paid on time, real hours respected, manager quality. This is
-- Shapi's deepest moat on the company side — the mirror of independent
-- candidate references. STRATEGY §14 Tier 3, §15 component.
--
-- ANTI-MANIPULATION
-- Companies email invites (with a one-shot token) and the survey is
-- submitted anonymously by the recipient at /culture/[token]. We record:
--   - invite_ip  → where the company sent the invite from
--   - submit_ip  → where the response came from
-- If the two match (company self-submitting), flagged = true.
-- The submit endpoint also flags responses when a company has > 5 flagged
-- submissions in a rolling 24h window (stuffing attempt).
-- We never store the raw invited email — only sha256(lower(trim(email))).
--
-- PRIVACY / NO RAW EXPOSURE
-- There is intentionally NO row-level SELECT policy. Companies CANNOT read
-- raw rows. The API (src/lib/culture-references.ts → getCultureAggregate)
-- returns only counts and averages, and only when count - flagged_count
-- >= MIN_RESPONSES (= 3). Below the threshold the aggregate omits averages
-- so individual respondents stay anonymous.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.company_culture_references (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references auth.users(id) on delete cascade,

  -- An emailed invite token; nullable for direct submissions
  token text unique,
  invited_email_hash text,            -- sha256(lower(trim(email))), never the raw email
  invited_at timestamptz not null default now(),

  -- Survey responses (1-5 ratings, all nullable until submitted)
  paid_on_time int,                   -- 1-5
  real_hours int,                     -- 1-5
  manager_quality int,                -- 1-5
  notes text,                         -- optional 1-2 sentence open response
  period_worked text,                 -- free text "2020-2023" / "current"
  submitted_at timestamptz,

  -- Anti-manipulation
  invite_ip inet,                     -- where the company sent the invite from
  submit_ip inet,                     -- where the response came from (compare)
  flagged boolean default false,      -- set true when invite_ip == submit_ip OR same domain spamming

  constraint paid_on_time_range  check (paid_on_time  is null or (paid_on_time  between 1 and 5)),
  constraint real_hours_range    check (real_hours    is null or (real_hours    between 1 and 5)),
  constraint manager_quality_rng check (manager_quality is null or (manager_quality between 1 and 5))
);

create index if not exists culture_refs_company_idx on public.company_culture_references (company_id);
create index if not exists culture_refs_token_idx   on public.company_culture_references (token);
create index if not exists culture_refs_submitted_idx on public.company_culture_references (submitted_at);

alter table public.company_culture_references enable row level security;

-- NOTE: No row-level SELECT/INSERT/UPDATE policies are created.
-- All reads go through the service role (admin client) which bypasses RLS,
-- and the API only ever returns aggregates. Anon users cannot read rows.
-- Companies can SEE only the AGGREGATE on their own count via the API
-- (never raw rows).
