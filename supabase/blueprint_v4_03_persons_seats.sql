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
