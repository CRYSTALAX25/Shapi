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
