-- ============================================================================
-- org_restructure.sql — free re-parenting (reports_to) + saved restructure
-- scenarios for the Restructure Studio.
-- ============================================================================
-- Idempotent. Paste into the Supabase SQL editor. Requires
-- blueprint_v4_03_persons_seats.sql (roles_seats) to exist first.
--
-- WHY
--   The org chart previously derived every reporting line from team membership
--   (each team's highest-seniority seat = the head, everyone else reports to
--   it). That makes "make the Eng Lead report to the CTO" impossible without
--   moving them into the CTO's team. reports_to adds a true, person-to-person
--   reporting edge. When NULL the chart falls back to the team-anchor model, so
--   existing orgs render exactly as before — this is purely additive.
--
--   org_scenarios stores draft restructures (template previews + manual edits)
--   so a company can model "what would Matrix look like?", amend it, save it,
--   print it, or share a read-only link — all WITHOUT touching the live spine
--   until they explicitly Implement.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. reports_to — a seat reports to another seat (self-referencing edge).
--    on delete set null: deleting a manager seat orphans reports cleanly back
--    to the team-anchor fallback rather than cascading.
-- ---------------------------------------------------------------------------
alter table public.roles_seats
  add column if not exists reports_to uuid references public.roles_seats(id) on delete set null;

create index if not exists idx_roles_seats_reports_to on public.roles_seats (reports_to)
  where reports_to is not null;

-- ---------------------------------------------------------------------------
-- 2. org_scenarios — saved restructure drafts (never the live source of truth).
--    snapshot holds the proposed arrangement as a JSON array of seat overrides:
--      [{ seat_id, team_id, reports_to, seniority, title }]
--    template_kind records which template (if any) seeded the draft.
-- ---------------------------------------------------------------------------
create table if not exists public.org_scenarios (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  template_kind text check (template_kind in (
    'flat', 'functional', 'divisional', 'matrix', 'pod', 'custom'
  )),
  snapshot      jsonb not null default '[]'::jsonb,
  -- Read-only share link token (for presentation). NULL = not shared.
  share_token   text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_org_scenarios_company on public.org_scenarios (company_id);
create index if not exists idx_org_scenarios_share_token on public.org_scenarios (share_token)
  where share_token is not null;

drop trigger if exists org_scenarios_touch_updated_at on public.org_scenarios;
create trigger org_scenarios_touch_updated_at
  before update on public.org_scenarios
  for each row execute procedure public.touch_updated_at();

alter table public.org_scenarios enable row level security;

-- Company members can read their own scenarios.
drop policy if exists "org_scenarios: company member read" on public.org_scenarios;
create policy "org_scenarios: company member read"
  on public.org_scenarios for select
  using (public.is_company_member(company_id));

-- Owner can do everything.
drop policy if exists "org_scenarios: company owner write" on public.org_scenarios;
create policy "org_scenarios: company owner write"
  on public.org_scenarios for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

-- Public read of a SHARED scenario by token (anon, read-only). The share page
-- queries with the anon key filtered by share_token; this policy allows that
-- single row through without exposing the rest of the table.
drop policy if exists "org_scenarios: public shared read" on public.org_scenarios;
create policy "org_scenarios: public shared read"
  on public.org_scenarios for select
  using (share_token is not null);
