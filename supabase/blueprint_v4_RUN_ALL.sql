-- ============================================================
-- Shapi v4 schema — CONSOLIDATED RUN-ALL (paste once, top→bottom)
-- Correct dependency order. Every section is idempotent / re-runnable.
-- Prereqs company_members + profiles_v3 are included FIRST because
-- blueprint_v4_00 (is_company_member) and _01 (subscription_status
-- constraint) depend on them. If 'create extension' errors on perms,
-- toggle vector + pgcrypto ON in Supabase Studio > Database > Extensions.
-- ============================================================


-- ===== BEGIN company_members.sql =====
-- ============================================================================
-- company_members.sql — team-invite storage for company accounts
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor.
--
-- /api/company/invite upserts into this table when a hiring manager invites
-- a colleague via the "Team access" panel on /company/dashboard. The invite
-- email goes via Resend with a tokenless signup link
-- (/signup?company_invite=<company_id>&email=<email>). On accept,
-- /api/company/invite/accept stamps accepted_at + accepted_user_id.
--
-- ROOT CAUSE of the "add team member fail" bug: the table simply didn't
-- exist. The upsert with onConflict: 'company_id,email' was failing with a
-- "relation does not exist" error, surfaced as a 500 in the UI.
-- ============================================================================

create table if not exists public.company_members (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references auth.users(id) on delete cascade,
  email         text not null,
  invited_by    uuid references auth.users(id) on delete set null,
  accepted_at   timestamptz,
  accepted_user_id uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (company_id, email)
);

create index if not exists idx_company_members_company on public.company_members (company_id);
create index if not exists idx_company_members_email on public.company_members (email);

-- RLS: companies can read + manage their own member rows. The /api/company/*
-- routes already use the admin (service-role) client so RLS doesn't gate
-- writes; this policy mainly lets server-side server-client reads work for
-- the company owner.
alter table public.company_members enable row level security;

drop policy if exists "Companies can view their members" on public.company_members;
create policy "Companies can view their members"
  on public.company_members for select
  using (auth.uid() = company_id);

drop policy if exists "Companies can manage their members" on public.company_members;
create policy "Companies can manage their members"
  on public.company_members for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);
-- ===== END company_members.sql =====


-- ===== BEGIN profiles_v3.sql =====
-- Add subscription fields to profiles (run in Supabase SQL editor)
alter table profiles
  add column if not exists subscription_tier text check (subscription_tier in ('starter', 'growth', 'enterprise')),
  add column if not exists subscription_status text default 'inactive' check (subscription_status in ('inactive', 'active', 'cancelled', 'past_due')),
  add column if not exists stripe_subscription_id text;
-- ===== END profiles_v3.sql =====


-- ===== BEGIN blueprint_v4_00_helpers.sql =====
-- ============================================================================
-- blueprint_v4_00_helpers.sql — Extensions + RLS helper functions
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor. Run FIRST before any other
-- blueprint_v4_* migration.
--
-- What this does:
--   1. Enables pgvector for brain_entries.embedding (Company Brain semantic search)
--   2. Enables pgcrypto for future column-level encryption on HR-private data
--   3. Defines is_company_member(company_id) — used in every RLS policy across
--      the blueprint v4 schema so the company owner AND invited team members
--      (via company_members) can access tenant data, but nobody else can.
--
-- Why this matters:
--   The blueprint v4 schema is heavily multi-tenant. Without the helper, every
--   policy would have to repeat the company_id = auth.uid() OR EXISTS (SELECT
--   FROM company_members ...) pattern. One helper, all tables consistent.
-- ============================================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- is_company_member(company_id uuid) — true if auth.uid() is the company
-- owner OR an accepted member of company_members. Used in every blueprint_v4
-- RLS policy. SECURITY DEFINER so it can read company_members without
-- triggering its own RLS recursion.
-- ---------------------------------------------------------------------------
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;
  if v_uid = p_company_id then return true; end if;
  return exists (
    select 1 from public.company_members
    where company_id = p_company_id
      and accepted_user_id = v_uid
      and accepted_at is not null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- touch_updated_at() — generic trigger function for updated_at columns.
-- Defined once here, re-used by every blueprint v4 table.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
-- ===== END blueprint_v4_00_helpers.sql =====


-- ===== BEGIN blueprint_v4_01_company_tier.sql =====
-- ============================================================================
-- blueprint_v4_01_company_tier.sql — Extend profiles with v4 tier state
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor.
--
-- The blueprint v4 packaging model uses ONE plan with three cumulative tiers
-- (free / pro / enterprise) plus a 14-day Pro trial. Rather than introducing
-- a separate `companies` table that duplicates the company-level fields
-- already on profiles (company_name, company_size, etc.), we extend profiles
-- with the v4 tier state. The FeatureGate cumulative check becomes:
--
--     profiles.plan_tier >= required_tier
--
-- Locked numbers (see memory project-pricing-locked-v4):
--   • Free: single-location org chart + 1 upload-and-map. No export.
--   • Pro $499/mo: multi-location + Talent Match + Active Hiring.
--   • Enterprise $2,500-5,000/mo: Strategic Planner + HR OS + Company Brain.
--   • Bespoke $15-25k: bespoke_config jsonb, sold INSIDE Enterprise.
-- ============================================================================

alter table public.profiles
  add column if not exists plan_tier text default 'free'
    check (plan_tier in ('free', 'pro', 'enterprise')),
  -- 14-day Pro trial: when not null + in the future, gates render Pro features.
  -- Stripe webhook stamps this on checkout.session.completed with
  -- subscription.status = 'trialing'.
  add column if not exists trial_ends_at timestamptz,
  -- Bespoke Transformation ($15-25k) config: severance multipliers, custom
  -- overhead %, taxonomy overrides. Populated only when the per-engagement
  -- Bespoke product is purchased on top of an active Enterprise subscription.
  add column if not exists bespoke_config jsonb default '{}'::jsonb,
  -- Free tier hard gate: caps Anthropic spend at ~$0.50/free user. Increment
  -- on every /api/company/upload-and-map run; if >= 1 AND plan_tier = 'free',
  -- the endpoint returns 402 + FeatureGate overlay drives upgrade.
  add column if not exists upload_and_map_count int default 0,
  -- Subscription lifecycle from Stripe (extends existing subscription_status).
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_canceled_at timestamptz;

-- The existing subscription_status check constraint only allowed
-- inactive/active/cancelled/past_due. Pro trial needs 'trialing'. Drop +
-- re-add the constraint with the expanded set.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_subscription_status_check'
  ) then
    alter table public.profiles drop constraint profiles_subscription_status_check;
  end if;
end$$;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in (
    'inactive', 'trialing', 'active', 'cancelled', 'past_due', 'grace_expired'
  ));

-- Index for FeatureGate lookups + Stripe webhook handler trial-expiry sweeps.
create index if not exists idx_profiles_plan_tier on public.profiles (plan_tier);
create index if not exists idx_profiles_trial_ends_at on public.profiles (trial_ends_at)
  where trial_ends_at is not null;
-- ===== END blueprint_v4_01_company_tier.sql =====


-- ===== BEGIN blueprint_v4_02_locations_teams.sql =====
-- ============================================================================
-- blueprint_v4_02_locations_teams.sql — locations + teams + free-tier gate
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor. Requires blueprint_v4_00 + _01.
--
-- This is where the v4 hard gate lives. Free tier = ONE location. A DB trigger
-- (not app-level logic) blocks the INSERT of a 2nd location. That keeps the
-- gate enforceable even if a future bug bypasses the app check, AND surfaces
-- a consistent SQLSTATE the API layer can catch + map to a FeatureGate
-- overlay → drives upgrade conversion.
--
-- Teams form a self-referencing tree per company. Each team lives in a
-- location (a team can't span locations — if it does, that's two teams that
-- collaborate). This matches the org-chart visual builder (Prompt 05).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- locations — physical/legal entity per company. Free tier capped at 1.
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references auth.users(id) on delete cascade,
  name        text not null,                              -- "Riyadh HQ"
  country     text not null,                              -- ISO-3166-1 alpha-2: "SA", "AE", "IN"
  city        text,
  timezone    text,                                       -- "Asia/Riyadh"
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_locations_company on public.locations (company_id);
create unique index if not exists uq_locations_one_primary_per_company
  on public.locations (company_id) where is_primary = true;

drop trigger if exists locations_touch_updated_at on public.locations;
create trigger locations_touch_updated_at
  before update on public.locations
  for each row execute procedure public.touch_updated_at();

alter table public.locations enable row level security;
drop policy if exists "locations: company member read" on public.locations;
create policy "locations: company member read"
  on public.locations for select
  using (public.is_company_member(company_id));
drop policy if exists "locations: company owner write" on public.locations;
create policy "locations: company owner write"
  on public.locations for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

-- ---------------------------------------------------------------------------
-- THE FREE-TIER HARD GATE — enforced in DB so a UI bug can't bypass it.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_free_tier_location_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_tier text;
  v_count     int;
begin
  select plan_tier into v_plan_tier from public.profiles where id = new.company_id;
  if v_plan_tier is null or v_plan_tier = 'free' then
    select count(*) into v_count from public.locations where company_id = new.company_id;
    if v_count >= 1 then
      raise exception 'free_tier_location_limit_exceeded'
        using
          errcode = 'P0001',
          hint    = 'Free tier supports a single location. Upgrade to Pro to add more.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_free_tier_location_limit on public.locations;
create trigger enforce_free_tier_location_limit
  before insert on public.locations
  for each row execute procedure public.enforce_free_tier_location_limit();

-- ---------------------------------------------------------------------------
-- teams — self-referencing tree per company. parent_team_id NULL = root.
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references auth.users(id) on delete cascade,
  location_id     uuid not null references public.locations(id) on delete restrict,
  parent_team_id  uuid references public.teams(id) on delete set null,
  name            text not null,                          -- "Engineering"
  function        text,                                   -- "engineering" | "sales" | "ops" | "finance" | "people" | "marketing" | "other"
  description     text,
  -- Activity Catalogue Sliders (brand vocab) — sized at the team level for
  -- now; can drill to individual seats once the catalogue UI ships.
  total_fte       numeric default 0,                      -- sum of all seats' FTE
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_teams_company on public.teams (company_id);
create index if not exists idx_teams_location on public.teams (location_id);
create index if not exists idx_teams_parent on public.teams (parent_team_id);

drop trigger if exists teams_touch_updated_at on public.teams;
create trigger teams_touch_updated_at
  before update on public.teams
  for each row execute procedure public.touch_updated_at();

alter table public.teams enable row level security;
drop policy if exists "teams: company member read" on public.teams;
create policy "teams: company member read"
  on public.teams for select
  using (public.is_company_member(company_id));
drop policy if exists "teams: company owner write" on public.teams;
create policy "teams: company owner write"
  on public.teams for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);
-- ===== END blueprint_v4_02_locations_teams.sql =====


-- ===== BEGIN blueprint_v4_03_persons_seats.sql =====
-- ============================================================================
-- blueprint_v4_03_persons_seats.sql — persons + roles_seats (THE spine)
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor. Requires blueprint_v4_00 + _01
-- + _02.
--
-- This is the heart of the v4 architecture.
--
-- persons     = decoupled identity. An employee record managed by the
--               company. They do NOT have to be a Shapi auth user.
--               linked_user_id is optional (set if they later sign up).
--               This is what makes "seat survives departure" work — when
--               person.linked_user_id is cleared or the person is archived,
--               the seat persists with its activity catalogue, brain
--               anchoring, and Seat Inheritance Playbook for the successor.
--
-- roles_seats = THE SPINE. Every other v4 module reads from here:
--               Workforce Snapshot, Salary Benchmark, Hiring Roadmap, Org
--               Design, Staffing Recommendations, Cognitive Load, Talent
--               Match, HR OS, Company Brain anchoring. A seat lives in a
--               team, optionally occupied by a person, and carries the
--               per-seat metrics that drive HRBP overlays (OKR completion,
--               capacity, AI-Exposure Score, flight risk).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- persons — decoupled identity. NOT references auth.users.
-- ---------------------------------------------------------------------------
create table if not exists public.persons (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references auth.users(id) on delete cascade,
  full_name       text not null,
  preferred_name  text,
  email           text,
  whatsapp_number text,
  -- Optional link to a Shapi auth user. Cleared on departure so the person
  -- record persists but no longer has app access.
  linked_user_id  uuid references auth.users(id) on delete set null,
  -- Lifecycle status — separate from any individual seat's status.
  status          text not null default 'active'
    check (status in ('active', 'on_leave', 'separating', 'departed', 'archived')),
  -- Identity-level flags only. Performance/leave/visa data lives on
  -- employee_hr_profiles (RBAC-gated separately).
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_persons_company on public.persons (company_id);
create index if not exists idx_persons_status on public.persons (company_id, status);
create index if not exists idx_persons_linked_user on public.persons (linked_user_id)
  where linked_user_id is not null;

drop trigger if exists persons_touch_updated_at on public.persons;
create trigger persons_touch_updated_at
  before update on public.persons
  for each row execute procedure public.touch_updated_at();

alter table public.persons enable row level security;
drop policy if exists "persons: company member read" on public.persons;
create policy "persons: company member read"
  on public.persons for select
  using (public.is_company_member(company_id));
drop policy if exists "persons: company owner write" on public.persons;
create policy "persons: company owner write"
  on public.persons for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

-- ---------------------------------------------------------------------------
-- roles_seats — THE SPINE. Every v4 module reads from this table.
-- ---------------------------------------------------------------------------
create table if not exists public.roles_seats (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references auth.users(id) on delete cascade,
  team_id                 uuid not null references public.teams(id) on delete cascade,
  -- The role definition.
  title                   text not null,                           -- "Senior Data Analyst"
  seniority               text check (seniority in (
    'intern', 'junior', 'mid', 'senior', 'lead', 'manager', 'director', 'vp', 'cxo'
  )),
  function                text,                                    -- "data" | "engineering" | "sales" | etc.
  -- Occupancy. NULL = vacant seat (still counted in the spine).
  person_id               uuid references public.persons(id) on delete set null,
  -- Seat lifecycle. Independent of person.status — a person can leave a seat
  -- and the seat stays open (planned/vacant) waiting for a successor.
  status                  text not null default 'active'
    check (status in (
      'planned',      -- on hiring roadmap, not filled yet
      'vacant',       -- previously filled, currently open
      'active',       -- filled and operating
      'frozen',       -- temporarily not filling
      'separating',   -- person departing, HR program open
      'redeployed'    -- person moved to another seat; this seat retired
    )),
  -- Dual budget bands (Pro tier feature) — blueprint v3 Section X carried
  -- forward into v4. experienced = market rate; pivot = cross-industry hire.
  experienced_budget_sar  numeric,
  pivot_budget_sar        numeric,
  -- Activity Catalogue Sliders accumulate here:
  total_weekly_hours      numeric,                                 -- sum of activities allocated to this seat
  fte_equivalent          numeric,                                 -- total_weekly_hours / 40 (or local norm)
  -- AI-Exposure Score (brand vocab) — per-seat automation risk, 0-100.
  ai_exposure_score       int check (ai_exposure_score between 0 and 100),
  -- HRBP Calibration Lens inputs:
  okr_completion_pct      int check (okr_completion_pct between 0 and 100),
  -- Absorbed Capacity Index — can exceed 100 to indicate overload.
  absorbed_capacity_pct   int check (absorbed_capacity_pct between 0 and 250),
  -- Flight risk score — Year 2 ML signal, nullable for now.
  flight_risk_score       int check (flight_risk_score between 0 and 100),
  flight_risk_updated_at  timestamptz,
  -- OKR text (for the lens drilldown).
  current_okrs            jsonb default '[]'::jsonb,
  -- Activity reference (denormalized for quick reads on the spine).
  primary_activities      text[] default '{}'::text[],
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_roles_seats_company on public.roles_seats (company_id);
create index if not exists idx_roles_seats_team on public.roles_seats (team_id);
create index if not exists idx_roles_seats_person on public.roles_seats (person_id)
  where person_id is not null;
create index if not exists idx_roles_seats_status on public.roles_seats (company_id, status);
-- For Hiring Roadmap "what's planned/vacant" reads:
create index if not exists idx_roles_seats_planned_or_vacant on public.roles_seats (company_id)
  where status in ('planned', 'vacant');

drop trigger if exists roles_seats_touch_updated_at on public.roles_seats;
create trigger roles_seats_touch_updated_at
  before update on public.roles_seats
  for each row execute procedure public.touch_updated_at();

alter table public.roles_seats enable row level security;
drop policy if exists "roles_seats: company member read" on public.roles_seats;
create policy "roles_seats: company member read"
  on public.roles_seats for select
  using (public.is_company_member(company_id));
drop policy if exists "roles_seats: company owner write" on public.roles_seats;
create policy "roles_seats: company owner write"
  on public.roles_seats for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);
-- ===== END blueprint_v4_03_persons_seats.sql =====


-- ===== BEGIN blueprint_v4_04_activity_workload.sql =====
-- ============================================================================
-- blueprint_v4_04_activity_workload.sql — activity_catalogue + delegations
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor. Requires blueprint_v4_00..03.
--
-- The Activity Catalogue is brand vocab — what people in seats are DOING, not
-- just that they exist. This is the ChartHop dismantle: ChartHop counts
-- headcount. Shapi sizes work via natural-language activity sliders, pre-fills
-- 80% from industry taxonomies, converts hours → FTE math.
--
-- workload_delegations tracks temporary task transfers (coverage during
-- leave, project loans, redeployment trials). Feeds two downstream features:
--   1. AI-detected skill acquisition (Brain reads deliverables produced under
--      delegation → updates the covering seat's skills array)
--   2. Fair-Share Performance Bonus auto-flags (consistent over-delivery on
--      delegated work → HRBP nudge to recognize)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- activity_catalogue — natural-language activities with FTE math.
-- ---------------------------------------------------------------------------
create table if not exists public.activity_catalogue (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references auth.users(id) on delete cascade,
  team_id                 uuid references public.teams(id) on delete cascade,
  -- An activity can be attached to a team OR an individual seat. NULL team_id
  -- + NOT NULL seat_id = seat-level; NOT NULL team_id + NULL seat_id =
  -- team-wide; both NOT NULL is fine (drilldown).
  seat_id                 uuid references public.roles_seats(id) on delete cascade,
  -- "Run weekly client status meetings", "Triage support tickets"
  activity_name           text not null,
  description             text,
  category                text check (category in (
    'core',         -- mission-critical recurring work
    'support',      -- enabling, lower-leverage
    'discretionary',-- nice-to-have
    'compliance',   -- mandatory but not value-generating
    'leadership'    -- people/strategy
  )),
  -- Sliders translate to hours.
  estimated_hours_per_week numeric not null check (estimated_hours_per_week >= 0),
  -- AI-Exposure Score per activity (not just per seat) — fine-grained
  -- automation risk for the Workforce P&L Ledger.
  automation_potential_pct int check (automation_potential_pct between 0 and 100),
  -- Skill tags — what does someone need to do this activity?
  required_skills          text[] default '{}'::text[],
  -- Was this row pre-filled from the industry taxonomy or user-added?
  source                   text not null default 'manual'
    check (source in ('manual', 'industry_taxonomy', 'ai_inferred')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_activity_company on public.activity_catalogue (company_id);
create index if not exists idx_activity_team on public.activity_catalogue (team_id)
  where team_id is not null;
create index if not exists idx_activity_seat on public.activity_catalogue (seat_id)
  where seat_id is not null;

drop trigger if exists activity_touch_updated_at on public.activity_catalogue;
create trigger activity_touch_updated_at
  before update on public.activity_catalogue
  for each row execute procedure public.touch_updated_at();

alter table public.activity_catalogue enable row level security;
drop policy if exists "activity: company member read" on public.activity_catalogue;
create policy "activity: company member read"
  on public.activity_catalogue for select
  using (public.is_company_member(company_id));
drop policy if exists "activity: company owner write" on public.activity_catalogue;
create policy "activity: company owner write"
  on public.activity_catalogue for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

-- ---------------------------------------------------------------------------
-- workload_delegations — temporary task transfer between seats.
-- ---------------------------------------------------------------------------
create table if not exists public.workload_delegations (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references auth.users(id) on delete cascade,
  from_seat_id    uuid not null references public.roles_seats(id) on delete cascade,
  to_seat_id      uuid not null references public.roles_seats(id) on delete cascade,
  activity_id     uuid references public.activity_catalogue(id) on delete set null,
  -- % of the from_seat's activity being transferred. 100 = full coverage.
  percentage      int not null check (percentage between 1 and 100),
  reason          text,                                           -- "annual leave 12-19 Aug"
  start_date      date not null,
  end_date        date,                                           -- NULL = ongoing
  -- Set when AI reads deliverables produced under this delegation and detects
  -- new skills the to_seat is demonstrating. Feeds Skill Density / Capability
  -- Matrix + Fair-Share Bonus flags.
  ai_detected_skills_gained text[] default '{}'::text[],
  quality_score   int check (quality_score between 0 and 100),    -- managerial rating
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_delegations_company on public.workload_delegations (company_id);
create index if not exists idx_delegations_from on public.workload_delegations (from_seat_id);
create index if not exists idx_delegations_to on public.workload_delegations (to_seat_id);
-- For Skill Density queries — find delegations with skills gained.
create index if not exists idx_delegations_skills_gained on public.workload_delegations
  using gin (ai_detected_skills_gained);

drop trigger if exists delegations_touch_updated_at on public.workload_delegations;
create trigger delegations_touch_updated_at
  before update on public.workload_delegations
  for each row execute procedure public.touch_updated_at();

alter table public.workload_delegations enable row level security;
drop policy if exists "delegations: company member read" on public.workload_delegations;
create policy "delegations: company member read"
  on public.workload_delegations for select
  using (public.is_company_member(company_id));
drop policy if exists "delegations: company owner write" on public.workload_delegations;
create policy "delegations: company owner write"
  on public.workload_delegations for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);
-- ===== END blueprint_v4_04_activity_workload.sql =====


-- ===== BEGIN blueprint_v4_05_hr_os.sql =====
-- ============================================================================
-- blueprint_v4_05_hr_os.sql — Living HR OS (Enterprise tier)
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor. Requires blueprint_v4_00..03.
--
-- The Living HR OS is the Enterprise differentiator. Three tables:
--
--   employee_hr_profiles      — comp / leave balance / visa per person (RBAC)
--   employee_attendance_ledger — every leave/sick/parental log (PDPL-aware)
--   hr_lifecycle_programs     — PIPs, separations, redeployments, onboarding
--
-- HRBP RBAC principle: the HR profile + attendance ledger + lifecycle program
-- rows are NOT visible to all company_members. They're scoped to:
--   1. The company owner (auth.uid() = company_id)
--   2. The assigned_hrbp_user_id on the row
--   3. The reporting_manager_user_id on the row
--
-- This is the "encrypted blocks restricted to assigned HRBP" floor referenced
-- in the HRBP layer brief. Full app-layer encryption can come later — for
-- now, RLS gates access at the row level.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- employee_hr_profiles — HR-private state per person.
-- ---------------------------------------------------------------------------
create table if not exists public.employee_hr_profiles (
  id                            uuid primary key default gen_random_uuid(),
  company_id                    uuid not null references auth.users(id) on delete cascade,
  person_id                     uuid not null references public.persons(id) on delete cascade,
  current_seat_id               uuid references public.roles_seats(id) on delete set null,
  -- Comp.
  base_salary_sar               numeric,
  base_salary_currency          text default 'SAR',
  accrued_performance_bonus_sar numeric default 0,
  last_comp_review_at           date,
  -- Leave balances (in days).
  annual_leave_balance_days     numeric default 0,
  sick_leave_taken_ytd_days     numeric default 0,
  parental_leave_balance_days   numeric default 0,
  -- Visa / immigration.
  nationality                   text,                          -- ISO-3166-1 alpha-2
  visa_type                     text,                          -- "work_permit" | "iqama" | "residency" | "citizen"
  visa_expires_at               date,
  -- Contract.
  contract_type                 text check (contract_type in (
    'full_time', 'part_time', 'contract', 'consultant', 'intern'
  )),
  start_date                    date,
  end_date                      date,
  -- RBAC anchors — who can see this row beyond the company owner.
  assigned_hrbp_user_id         uuid references auth.users(id) on delete set null,
  reporting_manager_user_id     uuid references auth.users(id) on delete set null,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  unique (company_id, person_id)
);

create index if not exists idx_hr_profiles_company on public.employee_hr_profiles (company_id);
create index if not exists idx_hr_profiles_person on public.employee_hr_profiles (person_id);
create index if not exists idx_hr_profiles_seat on public.employee_hr_profiles (current_seat_id);
create index if not exists idx_hr_profiles_visa_expiry on public.employee_hr_profiles (visa_expires_at)
  where visa_expires_at is not null;

drop trigger if exists hr_profiles_touch_updated_at on public.employee_hr_profiles;
create trigger hr_profiles_touch_updated_at
  before update on public.employee_hr_profiles
  for each row execute procedure public.touch_updated_at();

alter table public.employee_hr_profiles enable row level security;

-- HRBP / manager / owner only — NOT general company_members. This is the
-- "encrypted blocks restricted exclusively to HRBP + direct reporting
-- manager" pattern from the HRBP brief.
drop policy if exists "hr_profiles: hrbp+manager+owner read" on public.employee_hr_profiles;
create policy "hr_profiles: hrbp+manager+owner read"
  on public.employee_hr_profiles for select
  using (
    auth.uid() = company_id
    or auth.uid() = assigned_hrbp_user_id
    or auth.uid() = reporting_manager_user_id
  );

drop policy if exists "hr_profiles: hrbp+owner write" on public.employee_hr_profiles;
create policy "hr_profiles: hrbp+owner write"
  on public.employee_hr_profiles for all
  using (
    auth.uid() = company_id
    or auth.uid() = assigned_hrbp_user_id
  )
  with check (
    auth.uid() = company_id
    or auth.uid() = assigned_hrbp_user_id
  );

-- ---------------------------------------------------------------------------
-- employee_attendance_ledger — every leave/sick/etc entry, PDPL-aware.
-- ---------------------------------------------------------------------------
create table if not exists public.employee_attendance_ledger (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references auth.users(id) on delete cascade,
  person_id       uuid not null references public.persons(id) on delete cascade,
  entry_type      text not null check (entry_type in (
    'annual_leave', 'sick_leave', 'parental_leave',
    'bereavement', 'personal', 'unpaid', 'public_holiday'
  )),
  start_date      date not null,
  end_date        date not null,
  days            numeric not null check (days >= 0),
  notes           text,
  -- PDPL/GDPR floor: medical entries (sick_leave) require explicit consent
  -- to be logged at this level of detail. WhatsApp sick-day handler stamps
  -- this true; UI dashboard logging defaults to false (notes-only).
  medical_consent_logged boolean not null default false,
  logged_via      text not null default 'dashboard'
    check (logged_via in ('dashboard', 'whatsapp', 'email', 'api')),
  approved_at     timestamptz,
  approved_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_attendance_company on public.employee_attendance_ledger (company_id);
create index if not exists idx_attendance_person on public.employee_attendance_ledger (person_id);
create index if not exists idx_attendance_dates on public.employee_attendance_ledger (start_date, end_date);

drop trigger if exists attendance_touch_updated_at on public.employee_attendance_ledger;
create trigger attendance_touch_updated_at
  before update on public.employee_attendance_ledger
  for each row execute procedure public.touch_updated_at();

alter table public.employee_attendance_ledger enable row level security;

-- Owner + assigned HRBP + reporting manager (via hr_profile lookup) can read.
-- Medical-consent-logged rows are EXTRA gated — even reporting manager can't
-- see them unless they're also the assigned HRBP.
drop policy if exists "attendance: hrbp+manager+owner read" on public.employee_attendance_ledger;
create policy "attendance: hrbp+manager+owner read"
  on public.employee_attendance_ledger for select
  using (
    auth.uid() = company_id
    or exists (
      select 1 from public.employee_hr_profiles hp
      where hp.company_id = employee_attendance_ledger.company_id
        and hp.person_id = employee_attendance_ledger.person_id
        and (
          auth.uid() = hp.assigned_hrbp_user_id
          or (auth.uid() = hp.reporting_manager_user_id
              and not employee_attendance_ledger.medical_consent_logged)
        )
    )
  );

drop policy if exists "attendance: owner+hrbp write" on public.employee_attendance_ledger;
create policy "attendance: owner+hrbp write"
  on public.employee_attendance_ledger for all
  using (
    auth.uid() = company_id
    or exists (
      select 1 from public.employee_hr_profiles hp
      where hp.company_id = employee_attendance_ledger.company_id
        and hp.person_id = employee_attendance_ledger.person_id
        and auth.uid() = hp.assigned_hrbp_user_id
    )
  )
  with check (
    auth.uid() = company_id
    or exists (
      select 1 from public.employee_hr_profiles hp
      where hp.company_id = employee_attendance_ledger.company_id
        and hp.person_id = employee_attendance_ledger.person_id
        and auth.uid() = hp.assigned_hrbp_user_id
    )
  );

-- ---------------------------------------------------------------------------
-- hr_lifecycle_programs — PIPs, separations, redeployments, onboardings.
-- ---------------------------------------------------------------------------
create table if not exists public.hr_lifecycle_programs (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references auth.users(id) on delete cascade,
  person_id           uuid not null references public.persons(id) on delete cascade,
  -- The seat involved in the program. For redeployment, source_seat_id +
  -- target_seat_id let us track the move.
  source_seat_id      uuid references public.roles_seats(id) on delete set null,
  target_seat_id      uuid references public.roles_seats(id) on delete set null,
  program_type        text not null check (program_type in (
    'onboarding', 'pip', 'separation', 'redeploy', 'reskill', 'augment'
  )),
  status              text not null default 'open' check (status in (
    'open', 'in_progress', 'completed', 'abandoned', 'escalated'
  )),
  start_date          date not null default current_date,
  target_end_date     date,
  actual_end_date     date,
  -- 30/60/90 milestone blocks. Notes are gated by RLS — not encrypted at
  -- column level yet, but RBAC-restricted to assigned HRBP + reporting
  -- manager (NOT general company_members).
  milestones_30d      jsonb default '[]'::jsonb,
  milestones_60d      jsonb default '[]'::jsonb,
  milestones_90d      jsonb default '[]'::jsonb,
  private_notes       text,
  -- Country-specific legal template reference. App layer maps country →
  -- vetted template; we do NOT auto-generate legal text in PIP rows.
  legal_template_ref  text,                                  -- "UAE-MOL-PIP-v3" | "KSA-NITAQAT-EXIT-v2"
  -- RBAC anchors.
  assigned_hrbp_user_id     uuid references auth.users(id) on delete set null,
  reporting_manager_user_id uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_lifecycle_company on public.hr_lifecycle_programs (company_id);
create index if not exists idx_lifecycle_person on public.hr_lifecycle_programs (person_id);
create index if not exists idx_lifecycle_type_status on public.hr_lifecycle_programs (company_id, program_type, status);

drop trigger if exists lifecycle_touch_updated_at on public.hr_lifecycle_programs;
create trigger lifecycle_touch_updated_at
  before update on public.hr_lifecycle_programs
  for each row execute procedure public.touch_updated_at();

alter table public.hr_lifecycle_programs enable row level security;

drop policy if exists "lifecycle: hrbp+manager+owner read" on public.hr_lifecycle_programs;
create policy "lifecycle: hrbp+manager+owner read"
  on public.hr_lifecycle_programs for select
  using (
    auth.uid() = company_id
    or auth.uid() = assigned_hrbp_user_id
    or auth.uid() = reporting_manager_user_id
  );

drop policy if exists "lifecycle: hrbp+owner write" on public.hr_lifecycle_programs;
create policy "lifecycle: hrbp+owner write"
  on public.hr_lifecycle_programs for all
  using (
    auth.uid() = company_id
    or auth.uid() = assigned_hrbp_user_id
  )
  with check (
    auth.uid() = company_id
    or auth.uid() = assigned_hrbp_user_id
  );
-- ===== END blueprint_v4_05_hr_os.sql =====


-- ===== BEGIN blueprint_v4_06_decisions.sql =====
-- ============================================================================
-- blueprint_v4_06_decisions.sql — organizational_decisions (IMMUTABLE audit)
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor. Requires blueprint_v4_00..03.
--
-- Every restructuring action — hire, separate, redeploy, promote, reorg —
-- writes an immutable row here with a mandatory free-text justification.
-- This is the legally defensible audit trail for:
--   • UAE wrongful-termination disputes (12-24mo severance risk)
--   • KSA Nitaqat reorganization filings
--   • PDPL data-subject-access requests
--   • Investor due diligence on restructuring conducted
--
-- IMMUTABILITY: no UPDATE or DELETE policy. Inserts only. Even the company
-- owner cannot edit the justification post-hoc. A correction = a new row
-- referencing the previous one via corrects_decision_id.
-- ============================================================================

create table if not exists public.organizational_decisions (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references auth.users(id) on delete cascade,
  decision_type         text not null check (decision_type in (
    'hire', 'separate', 'restructure', 'redeploy', 'promote',
    'demote', 'reskill_assign', 'augment_assign', 'comp_change',
    'team_split', 'team_merge', 'location_change'
  )),
  -- MANDATORY free-text justification. Enforce via NOT NULL + min length
  -- check. The HRBP brief Section 13 specifies this as the immutable
  -- advisory routing — a non-empty manager justification is the legal floor.
  justification         text not null check (length(justification) >= 20),
  -- Who made the decision. NOT NULL: every decision has a human owner.
  decided_by_user_id    uuid not null references auth.users(id) on delete restrict,
  -- What this decision affects. Either or both can be set.
  impacted_seat_id      uuid references public.roles_seats(id) on delete set null,
  impacted_person_id    uuid references public.persons(id) on delete set null,
  impacted_team_id      uuid references public.teams(id) on delete set null,
  -- For corrections: a new row pointing to the previous decision being
  -- amended. The original row is never modified.
  corrects_decision_id  uuid references public.organizational_decisions(id) on delete restrict,
  -- Snapshot of the before/after state at decision time. JSONB so the audit
  -- captures the actual values that existed when the decision was made,
  -- independent of later state changes.
  state_snapshot        jsonb not null default '{}'::jsonb,
  decided_at            timestamptz not null default now()
);

create index if not exists idx_decisions_company on public.organizational_decisions (company_id);
create index if not exists idx_decisions_seat on public.organizational_decisions (impacted_seat_id)
  where impacted_seat_id is not null;
create index if not exists idx_decisions_person on public.organizational_decisions (impacted_person_id)
  where impacted_person_id is not null;
create index if not exists idx_decisions_type_date on public.organizational_decisions (company_id, decision_type, decided_at desc);

alter table public.organizational_decisions enable row level security;

-- Read: company member can see the audit log. This is intentional —
-- transparency is the point of an audit trail. If a particular decision row
-- contains sensitive comp data in state_snapshot, that's an app-layer
-- problem (don't snapshot it) not an RLS problem.
drop policy if exists "decisions: company member read" on public.organizational_decisions;
create policy "decisions: company member read"
  on public.organizational_decisions for select
  using (public.is_company_member(company_id));

-- Insert: company owner + any authenticated company_member can record a
-- decision they made.
drop policy if exists "decisions: company member insert" on public.organizational_decisions;
create policy "decisions: company member insert"
  on public.organizational_decisions for insert
  with check (
    public.is_company_member(company_id)
    and decided_by_user_id = auth.uid()
  );

-- IMMUTABLE: no UPDATE or DELETE policies. Postgres denies by default when
-- RLS is enabled with no matching policy. Corrections require inserting a
-- new row with corrects_decision_id set.
-- ===== END blueprint_v4_06_decisions.sql =====


-- ===== BEGIN blueprint_v4_07_brain.sql =====
-- ============================================================================
-- blueprint_v4_07_brain.sql — Company Brain (Enterprise tier)
-- ============================================================================
-- Idempotent. Paste into Supabase SQL editor. Requires blueprint_v4_00..03.
--
-- The Company Brain is THE MOAT. Two tables:
--
--   brain_sources — ingestion endpoints. One row per upload/email/voice/chat
--   brain_entries — chunked + embedded content. One row per ~512-token chunk
--
-- Anchored to role_seat_id, NOT person_id. This is the Seat Inheritance
-- Playbook architecture: when an employee leaves, the knowledge anchored to
-- their seat stays with the seat. The successor inherits a conversational
-- onboarding co-pilot on Day 1.
--
-- Embeddings: pgvector vector(1536) for OpenAI text-embedding-3-small. Use
-- HNSW index for cosine similarity queries.
--
-- Sensitivity tiers:
--   • team    — visible to all seats in the same team (default)
--   • manager — visible to managers in the chain only
--   • private — visible only to the seat-holder + assigned HRBP
--
-- Skill detection: ai_detected_skills_gained on brain_entries feeds the
-- Skill Density / Capability Matrix (HRBP Layer #1 — keystone). Without
-- this column populated, the redeployment engine has nothing to query.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- brain_sources — ingestion provenance.
-- ---------------------------------------------------------------------------
create table if not exists public.brain_sources (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references auth.users(id) on delete cascade,
  source_type           text not null check (source_type in (
    'slack_export',
    'email_thread',
    'meeting_transcript',
    'file_upload',
    'whatsapp_voice',
    'whatsapp_text',
    'document_drop',
    'manual_note'
  )),
  source_name           text not null,                       -- "Q3 Strategy Meeting"
  -- Default sensitivity applied to all entries from this source. Individual
  -- entries can override via brain_entries.sensitivity.
  sensitivity           text not null default 'team' check (sensitivity in (
    'team', 'manager', 'private'
  )),
  uploaded_by_user_id   uuid references auth.users(id) on delete set null,
  -- Anchor at the source level — if every entry from this source belongs to
  -- the same seat (e.g., a person's email export), set it here. Entry-level
  -- anchors override.
  default_anchor_seat_id uuid references public.roles_seats(id) on delete set null,
  default_anchor_team_id uuid references public.teams(id) on delete set null,
  -- Storage references (Supabase Storage).
  file_storage_path     text,
  file_size_bytes       bigint,
  file_mime_type        text,
  -- Ingestion lifecycle.
  status                text not null default 'pending' check (status in (
    'pending', 'processing', 'embedded', 'failed', 'rejected'
  )),
  ingestion_error       text,
  raw_metadata          jsonb default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  processed_at          timestamptz
);

create index if not exists idx_brain_sources_company on public.brain_sources (company_id);
create index if not exists idx_brain_sources_status on public.brain_sources (company_id, status);
create index if not exists idx_brain_sources_seat on public.brain_sources (default_anchor_seat_id)
  where default_anchor_seat_id is not null;

alter table public.brain_sources enable row level security;
drop policy if exists "brain_sources: company member read" on public.brain_sources;
create policy "brain_sources: company member read"
  on public.brain_sources for select
  using (public.is_company_member(company_id));
drop policy if exists "brain_sources: company owner write" on public.brain_sources;
create policy "brain_sources: company owner write"
  on public.brain_sources for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

-- ---------------------------------------------------------------------------
-- brain_entries — chunked content + vector embeddings.
-- ---------------------------------------------------------------------------
create table if not exists public.brain_entries (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references auth.users(id) on delete cascade,
  source_id             uuid not null references public.brain_sources(id) on delete cascade,
  -- THE anchor — anchored to seat (Seat Inheritance Playbook), NOT person.
  -- When a person leaves, the seat stays + their entries stay anchored.
  anchor_seat_id        uuid references public.roles_seats(id) on delete set null,
  anchor_team_id        uuid references public.teams(id) on delete set null,
  content               text not null,
  -- pgvector embedding. text-embedding-3-small returns 1536 dims.
  embedding             vector(1536),
  -- Per-entry sensitivity override (defaults to brain_sources.sensitivity).
  sensitivity           text not null default 'team' check (sensitivity in (
    'team', 'manager', 'private'
  )),
  -- AI-detected skills demonstrated in this entry. THIS COLUMN POWERS the
  -- Skill Density / Capability Matrix (HRBP Layer #1, the keystone). The
  -- ingestion worker runs a Claude call against each chunk asking "what
  -- skills does this content demonstrate?" → text[] array → gin-indexed.
  ai_detected_skills_gained text[] default '{}'::text[],
  -- Chunking metadata.
  chunk_index           int,
  token_count           int,
  created_at            timestamptz not null default now()
);

create index if not exists idx_brain_entries_company on public.brain_entries (company_id);
create index if not exists idx_brain_entries_source on public.brain_entries (source_id);
create index if not exists idx_brain_entries_seat on public.brain_entries (anchor_seat_id)
  where anchor_seat_id is not null;
create index if not exists idx_brain_entries_team on public.brain_entries (anchor_team_id)
  where anchor_team_id is not null;
-- GIN index for Skill Density queries — "show seats with skill X".
create index if not exists idx_brain_entries_skills_gained on public.brain_entries
  using gin (ai_detected_skills_gained);

-- HNSW vector index for semantic search. Cosine distance is the default for
-- text-embedding-3-small. m=16, ef_construction=64 are the standard
-- sensible defaults for sub-1M vectors.
do $$
begin
  if not exists (
    select 1 from pg_indexes where indexname = 'idx_brain_entries_embedding_hnsw'
  ) then
    create index idx_brain_entries_embedding_hnsw
      on public.brain_entries
      using hnsw (embedding vector_cosine_ops)
      with (m = 16, ef_construction = 64);
  end if;
end$$;

alter table public.brain_entries enable row level security;

-- Reading entries is trickier than other tables because of sensitivity.
-- For v1: company member can read team-level entries; only company owner
-- can read manager/private entries. Phase 2 will fold in chain-of-command
-- lookups via roles_seats.team_id traversal.
drop policy if exists "brain_entries: tier-gated read" on public.brain_entries;
create policy "brain_entries: tier-gated read"
  on public.brain_entries for select
  using (
    (public.is_company_member(company_id) and sensitivity = 'team')
    or auth.uid() = company_id
  );

drop policy if exists "brain_entries: company owner write" on public.brain_entries;
create policy "brain_entries: company owner write"
  on public.brain_entries for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);
-- ===== END blueprint_v4_07_brain.sql =====

